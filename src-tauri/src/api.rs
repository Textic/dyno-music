//! The developer API: a WebSocket on 127.0.0.1 that other apps (a Stream Deck plugin, an OBS
//! overlay, a bot) use to follow and control playback. Documented in docs/websocket-api.md.
//!
//! Off by default. Clients need the token from Settings, and pages from websites are refused
//! (only local pages and non-browser clients may connect), so a site can't reach it through
//! localhost. Nothing is sent on a timer: a client gets everything when it connects, then a
//! message only when something changes.

use std::collections::HashMap;
use std::net::{Ipv4Addr, TcpListener};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State as Shared};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::sync::broadcast::error::RecvError;
use tokio::sync::{broadcast, watch};

use crate::bridge::emit_ui;
use crate::commands::{send_command, PlayerCommand};
use crate::settings::Settings;
use crate::state::{Hub, PlayerState, PlayerStatus, Track};

pub const DEFAULT_PORT: u16 = 26538;
/// Bumped when a message changes in a way existing clients can't follow.
const PROTOCOL: u32 = 1;
/// A position this far from where the last message predicts means the user sought.
const SEEK_TOLERANCE_SEC: f64 = 2.0;
/// Small enough to send whole, big enough for a Stream Deck key (72–144 px).
const ARTWORK_SIZE: u32 = 144;
/// How long to keep trying to bind a port the previous server is still letting go of.
const BIND_RETRY: Duration = Duration::from_millis(100);
const BIND_ATTEMPTS: u32 = 10;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiStatus {
    pub running: bool,
    pub port: u16,
    pub clients: usize,
    /// Why it isn't running although it's turned on (say, the port is taken).
    pub error: Option<String>,
}

struct Running {
    port: u16,
    token: Arc<Mutex<String>>,
    /// Bumped to make every connected client disconnect (token changed, server stopping).
    kick: watch::Sender<u64>,
    stop: watch::Sender<bool>,
}

/// The last state sent to clients, to tell a real change from the position moving on.
struct Sent {
    state: PlayerState,
    at: i64,
}

/// The current song's artwork as a data URL; `None` while it's being fetched.
struct Artwork {
    video_id: String,
    image: Option<String>,
}

pub struct ApiServer {
    running: Mutex<Option<Running>>,
    error: Mutex<Option<String>>,
    clients: AtomicUsize,
    /// Messages for every connected client, already serialized.
    events: broadcast::Sender<Arc<str>>,
    sent: Mutex<Option<Sent>>,
    /// When the page last reported its state (Unix ms): the `positionAt` of `Hub::player`.
    state_at: Mutex<i64>,
    artwork: Mutex<Option<Artwork>>,
}

impl Default for ApiServer {
    fn default() -> Self {
        Self {
            running: Mutex::default(),
            error: Mutex::default(),
            clients: AtomicUsize::new(0),
            events: broadcast::channel(64).0,
            sent: Mutex::default(),
            state_at: Mutex::new(now_ms()),
            artwork: Mutex::default(),
        }
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

/// 128 random bits, as hex.
pub fn new_token() -> String {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes).expect("no source of randomness");
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn status(app: &AppHandle) -> ApiStatus {
    let server = app.state::<ApiServer>();
    let running = server.running.lock().unwrap();
    let port = running.as_ref().map(|r| r.port).unwrap_or_default();
    ApiStatus {
        running: running.is_some(),
        port,
        clients: server.clients.load(Ordering::Relaxed),
        error: server.error.lock().unwrap().clone(),
    }
}

fn emit_status(app: &AppHandle) {
    emit_ui(app, "api://status", &status(app));
}

/// Starts, stops or reconfigures the server to match the settings. A new token only
/// disconnects the clients; a new port restarts the server.
pub fn apply(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let server = app.state::<ApiServer>();
    let mut running = server.running.lock().unwrap();
    let wanted = settings.api_enabled.then_some(settings.api_port);

    if let (Some(current), Some(port)) = (running.as_ref(), wanted)
        && current.port == port
    {
        let mut token = current.token.lock().unwrap();
        if *token != settings.api_token {
            *token = settings.api_token.clone();
            current.kick.send_modify(|n| *n += 1);
        }
        return Ok(());
    }
    if running.is_none() && wanted.is_none() {
        *server.error.lock().unwrap() = None;
        return Ok(());
    }

    if let Some(old) = running.take() {
        old.kick.send_modify(|n| *n += 1);
        let _ = old.stop.send(true);
        eprintln!("[api] stopped");
    }
    *server.error.lock().unwrap() = None;
    let result = match wanted {
        None => Ok(()),
        Some(port) => match start(app, port, settings.api_token.clone()) {
            Ok(started) => {
                *running = Some(started);
                eprintln!("[api] listening on ws://127.0.0.1:{port}/ws");
                Ok(())
            }
            Err(err) => {
                let message = format!("The developer API couldn't use port {port}: {err}");
                *server.error.lock().unwrap() = Some(message.clone());
                Err(message)
            }
        },
    };
    drop(running);
    emit_status(app);
    result
}

/// The previous server may still be releasing the port (it waits for its clients to go).
fn bind(port: u16) -> std::io::Result<TcpListener> {
    let mut attempt = 0;
    loop {
        match TcpListener::bind((Ipv4Addr::LOCALHOST, port)) {
            Ok(listener) => return Ok(listener),
            Err(err) if err.kind() == std::io::ErrorKind::AddrInUse && attempt < BIND_ATTEMPTS => {
                attempt += 1;
                std::thread::sleep(BIND_RETRY);
            }
            Err(err) => return Err(err),
        }
    }
}

#[derive(Clone)]
struct Context {
    app: AppHandle,
    token: Arc<Mutex<String>>,
    kick: watch::Receiver<u64>,
}

fn start(app: &AppHandle, port: u16, token: String) -> std::io::Result<Running> {
    let listener = bind(port)?;
    listener.set_nonblocking(true)?;
    let (stop, mut stopped) = watch::channel(false);
    let (kick, kicked) = watch::channel(0u64);
    let token = Arc::new(Mutex::new(token));
    let context = Context { app: app.clone(), token: token.clone(), kick: kicked };
    let router = Router::new().route("/ws", get(upgrade)).with_state(context);

    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(err) => return eprintln!("[api] {err}"),
        };
        let shutdown = async move {
            let _ = stopped.wait_for(|stop| *stop).await;
        };
        if let Err(err) = axum::serve(listener, router).with_graceful_shutdown(shutdown).await {
            eprintln!("[api] {err}");
        }
    });
    Ok(Running { port, token, kick, stop })
}

/// Websites are refused; local pages (an OBS overlay opened from a file, a page on localhost)
/// and clients that aren't browsers (no Origin header) may connect.
fn origin_allowed(headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) else {
        return true;
    };
    if origin == "null" || origin.starts_with("file://") {
        return true;
    }
    url::Url::parse(origin)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .is_some_and(|host| host == "localhost" || host == "127.0.0.1" || host == "[::1]")
}

/// Compares in constant time, so the answer's timing says nothing about the token.
fn same_token(given: &str, expected: &str) -> bool {
    given.len() == expected.len() && given.bytes().zip(expected.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
}

async fn upgrade(
    ws: WebSocketUpgrade,
    Shared(context): Shared<Context>,
    Query(query): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    if !origin_allowed(&headers) {
        return (StatusCode::FORBIDDEN, "Websites can't connect to the Dyno Music API").into_response();
    }
    let expected = context.token.lock().unwrap().clone();
    let given = query.get("token").map(String::as_str).unwrap_or_default();
    if !same_token(given, &expected) {
        return (StatusCode::UNAUTHORIZED, "Missing or wrong token (Settings → Developers)").into_response();
    }
    ws.on_upgrade(move |socket| client(socket, context))
}

async fn send(socket: &mut WebSocket, text: String) -> bool {
    socket.send(Message::Text(text.into())).await.is_ok()
}

async fn client(mut socket: WebSocket, context: Context) {
    let app = context.app.clone();
    let server = app.state::<ApiServer>();
    server.clients.fetch_add(1, Ordering::Relaxed);
    emit_status(&app);
    let mut events = server.events.subscribe();
    let mut kick = context.kick.clone();
    kick.borrow_and_update();

    let mut open = send(&mut socket, hello(&app)).await;
    for message in snapshot(&app) {
        open = open && send(&mut socket, message).await;
    }
    while open {
        tokio::select! {
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Text(text))) => {
                    for reply in handle(&app, text.as_str()) {
                        open = open && send(&mut socket, reply).await;
                    }
                }
                Some(Ok(Message::Close(_))) | Some(Err(_)) | None => open = false,
                // Pings are answered by the library; binary messages mean nothing here.
                Some(Ok(_)) => {}
            },
            event = events.recv() => match event {
                Ok(message) => open = send(&mut socket, message.to_string()).await,
                // Too slow to keep up: start it over from the current state.
                Err(RecvError::Lagged(_)) => {
                    for message in snapshot(&app) {
                        open = open && send(&mut socket, message).await;
                    }
                }
                Err(RecvError::Closed) => open = false,
            },
            _ = kick.changed() => {
                let _ = socket.send(Message::Close(None)).await;
                open = false;
            }
        }
    }

    server.clients.fetch_sub(1, Ordering::Relaxed);
    if server.clients.load(Ordering::Relaxed) == 0 {
        *server.sent.lock().unwrap() = None;
    }
    emit_status(&app);
}

fn hello(app: &AppHandle) -> String {
    json!({
        "type": "hello",
        "app": "Dyno Music",
        "version": app.package_info().version.to_string(),
        "protocol": PROTOCOL,
    })
    .to_string()
}

fn state_message(state: &PlayerState, at: i64) -> String {
    let mut value = serde_json::to_value(state).unwrap_or(Value::Null);
    if let Value::Object(fields) = &mut value {
        fields.insert("positionAt".into(), json!(at));
    }
    json!({ "type": "state", "state": value }).to_string()
}

fn queue_message(queue: &Value) -> String {
    let queue = if queue.is_array() { queue.clone() } else { json!([]) };
    json!({ "type": "queue", "queue": queue }).to_string()
}

fn artwork_message(video_id: &str, image: &str) -> String {
    json!({ "type": "artwork", "videoId": video_id, "image": image }).to_string()
}

/// Everything a client needs to draw itself: state, queue and, when ready, the artwork.
fn snapshot(app: &AppHandle) -> Vec<String> {
    let hub = app.state::<Hub>();
    let server = app.state::<ApiServer>();
    let state = hub.player.lock().unwrap().clone();
    let at = *server.state_at.lock().unwrap();
    let mut messages = vec![state_message(&state, at), queue_message(&hub.queue.lock().unwrap())];
    if let Some(track) = state.track.as_ref().filter(|_| !state.is_ad) {
        let artwork = server.artwork.lock().unwrap();
        match artwork.as_ref() {
            Some(Artwork { video_id, image: Some(image) }) if *video_id == track.video_id => {
                messages.push(artwork_message(video_id, image));
            }
            // Fetching, or not yet: it's broadcast when it arrives.
            _ => {
                drop(artwork);
                ensure_artwork(app, track);
            }
        }
    }
    messages
}

#[derive(Deserialize)]
struct Request {
    #[serde(default)]
    id: Option<Value>,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    command: Option<Value>,
}

fn result(id: Option<Value>, outcome: Result<(), String>) -> String {
    let id = id.unwrap_or(Value::Null);
    match outcome {
        Ok(()) => json!({ "type": "result", "id": id, "ok": true }),
        Err(error) => json!({ "type": "result", "id": id, "ok": false, "error": error }),
    }
    .to_string()
}

/// Answers one message from a client.
fn handle(app: &AppHandle, text: &str) -> Vec<String> {
    let request: Request = match serde_json::from_str(text) {
        Ok(request) => request,
        Err(err) => return vec![result(None, Err(format!("not a valid message: {err}")))],
    };
    match request.kind.as_str() {
        "get" => {
            let mut messages = snapshot(app);
            messages.push(result(request.id, Ok(())));
            messages
        }
        "command" => {
            let outcome = request
                .command
                .ok_or_else(|| "\"command\" is missing".to_string())
                .and_then(|command| {
                    serde_json::from_value::<PlayerCommand>(command).map_err(|err| format!("not a valid command: {err}"))
                })
                .and_then(|command| send_command(app, &command));
            vec![result(request.id, outcome)]
        }
        other => vec![result(request.id, Err(format!("unknown message type \"{other}\"")))],
    }
}

fn is_running(app: &AppHandle) -> Option<tauri::State<'_, ApiServer>> {
    let server = app.try_state::<ApiServer>()?;
    let running = server.running.lock().unwrap().is_some();
    running.then_some(server)
}

/// Whether `next` is worth sending: anything but the position changed, or the position jumped.
fn changed(previous: &Sent, next: &PlayerState, now: i64) -> bool {
    let mut a = previous.state.clone();
    let mut b = next.clone();
    a.position_sec = 0.0;
    b.position_sec = 0.0;
    if a != b {
        return true;
    }
    let elapsed = if previous.state.status == PlayerStatus::Playing { (now - previous.at) as f64 / 1000.0 } else { 0.0 };
    (next.position_sec - (previous.state.position_sec + elapsed)).abs() > SEEK_TOLERANCE_SEC
}

/// Called with every state the page reports (bridge.rs).
pub fn on_state(app: &AppHandle, state: &PlayerState) {
    let Some(server) = app.try_state::<ApiServer>() else { return };
    let now = now_ms();
    *server.state_at.lock().unwrap() = now;
    if is_running(app).is_none() {
        return;
    }
    if let Some(track) = state.track.as_ref().filter(|_| !state.is_ad) {
        ensure_artwork(app, track);
    }
    if server.clients.load(Ordering::Relaxed) == 0 {
        return;
    }
    let mut sent = server.sent.lock().unwrap();
    if sent.as_ref().is_some_and(|previous| !changed(previous, state, now)) {
        return;
    }
    *sent = Some(Sent { state: state.clone(), at: now });
    drop(sent);
    let _ = server.events.send(state_message(state, now).into());
}

/// Called with every queue the page reports (bridge.rs).
pub fn on_queue(app: &AppHandle, queue: &Value) {
    let Some(server) = is_running(app) else { return };
    if server.clients.load(Ordering::Relaxed) > 0 {
        let _ = server.events.send(queue_message(queue).into());
    }
}

/// Google's artwork at the size the API sends; other hosts' as they are.
fn small_artwork(thumbnail: &str) -> Option<url::Url> {
    let mut url = url::Url::parse(thumbnail).ok()?;
    let host = url.host_str()?.to_string();
    if host.ends_with("googleusercontent.com") || host.ends_with("ggpht.com") {
        let path = url.path().to_string();
        if let Some(cut) = path.rfind('=').filter(|&i| i > path.rfind('/').unwrap_or(0)) {
            url.set_path(&format!("{}=w{ARTWORK_SIZE}-h{ARTWORK_SIZE}-l90-rj", &path[..cut]));
        }
    }
    Some(url)
}

/// Fetches the current song's artwork once, then sends it to every client.
fn ensure_artwork(app: &AppHandle, track: &Track) {
    let Some(server) = app.try_state::<ApiServer>() else { return };
    {
        let mut artwork = server.artwork.lock().unwrap();
        if artwork.as_ref().is_some_and(|a| a.video_id == track.video_id) {
            return;
        }
        *artwork = Some(Artwork { video_id: track.video_id.clone(), image: None });
    }
    let Some(url) = small_artwork(&track.thumbnail) else { return };
    let app = app.clone();
    let video_id = track.video_id.clone();
    tauri::async_runtime::spawn(async move {
        let Ok((bytes, content_type)) = crate::cover::download(url).await else {
            // Forget it, so the next state or client tries again.
            let server = app.state::<ApiServer>();
            let mut artwork = server.artwork.lock().unwrap();
            if artwork.as_ref().is_some_and(|a| a.video_id == video_id) {
                *artwork = None;
            }
            return;
        };
        let image = format!(
            "data:{content_type};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        );
        let server = app.state::<ApiServer>();
        {
            let mut artwork = server.artwork.lock().unwrap();
            // The song may have changed while this was downloading.
            match artwork.as_mut() {
                Some(current) if current.video_id == video_id => current.image = Some(image.clone()),
                _ => return,
            }
        }
        let _ = server.events.send(artwork_message(&video_id, &image).into());
    });
}
