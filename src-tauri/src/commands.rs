use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};

use crate::auth;
use crate::bridge::emit_ui;
use crate::discord;
use crate::media;
use crate::player::{self, PLAYER_LABEL, YTM_URL};
use crate::settings::{self, Settings, SettingsStore};
use crate::shortcuts::{self, ShortcutAction};
use crate::state::{Hub, LikeStatus, PlayerState, SessionInfo};

const API_TIMEOUT: Duration = Duration::from_secs(15);
/// How long a request waits for the player page to finish loading.
const READY_TIMEOUT: Duration = Duration::from_secs(45);

/// InnerTube endpoints the UI may reach through the bridge.
const ALLOWED_ENDPOINTS: &[&str] = &[
    "search",
    "browse",
    "next",
    "music/get_search_suggestions",
    "like/like",
    "like/dislike",
    "like/removelike",
    "browse/edit_playlist",
];

/// Mirrors `PlayerCommand` in src/shared/types.ts.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PlayerCommand {
    Play,
    Pause,
    Toggle,
    Next,
    Previous,
    Seek { position_sec: f64 },
    Volume { value: f64 },
    Watch {
        video_id: Option<String>,
        playlist_id: Option<String>,
        params: Option<String>,
    },
    Repeat,
    Shuffle,
    Like { status: LikeStatus },
    QueuePlay { index: u32 },
    QueueMove { from: u32, to: u32 },
    QueueRemove { index: u32 },
    QueueAdd {
        video_id: Option<String>,
        playlist_id: Option<String>,
        next: bool,
    },
}

/// Runs a command in the player page. Also used by the tray and the media keys.
pub fn send_command(app: &AppHandle, cmd: &PlayerCommand) -> Result<(), String> {
    let cmd = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
    player::eval_bridge(app, &format!("command({cmd})"))
}

#[tauri::command]
pub fn player_cmd(app: AppHandle, cmd: PlayerCommand) -> Result<(), String> {
    send_command(&app, &cmd)
}

#[tauri::command]
pub async fn ytm_api(
    app: AppHandle,
    hub: State<'_, Hub>,
    endpoint: String,
    body: Value,
) -> Result<Value, String> {
    if !ALLOWED_ENDPOINTS.contains(&endpoint.as_str()) {
        return Err(format!("endpoint not allowed: {endpoint}"));
    }
    // On startup the UI asks for content before the hidden page has loaded: wait for it.
    let started = tokio::time::Instant::now();
    while !hub.is_ready() {
        if started.elapsed() > READY_TIMEOUT {
            return Err("YouTube Music did not finish loading".into());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let (id, rx) = hub.register_request();
    let request = json!({ "id": id, "endpoint": endpoint, "body": body });
    if let Err(err) = player::eval_bridge(&app, &format!("request({request})")) {
        hub.cancel_request(id);
        return Err(err);
    }

    match tokio::time::timeout(API_TIMEOUT, rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("the request was cancelled".into()),
        Err(_) => {
            hub.cancel_request(id);
            Err(format!("YouTube Music did not answer \"{endpoint}\" in time"))
        }
    }
}

/// Opens Google's sign-in in the player window; resolves once signed in, fails if cancelled.
#[tauri::command]
pub async fn sign_in(app: AppHandle, hub: State<'_, Hub>) -> Result<(), String> {
    auth::sign_in(&app, &hub).await
}

/// Shows the YouTube Music window (debugging).
#[tauri::command]
pub fn show_player(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(PLAYER_LABEL)
        .ok_or("the player window does not exist")?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

/// Swaps the main window for the mini player.
/// Async because creating a window from a sync command deadlocks the main thread on Windows.
#[tauri::command]
pub async fn open_mini_player(app: AppHandle) -> Result<(), String> {
    crate::mini::open(&app).map_err(|e| e.to_string())
}

/// Closes the mini player and brings the main window back.
#[tauri::command]
pub fn close_mini_player(app: AppHandle) {
    crate::mini::close(&app);
}

#[tauri::command]
pub fn hide_player(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(PLAYER_LABEL)
        .ok_or("the player window does not exist")?;
    window.hide().map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    session: Option<SessionInfo>,
    state: PlayerState,
    queue: Value,
}

#[tauri::command]
pub fn get_settings(store: State<'_, SettingsStore>) -> Settings {
    store.0.lock().unwrap().clone()
}

/// Saves and applies the settings, then tells every window. Fails, after saving, if a global
/// shortcut could not be registered.
/// Async: registering global shortcuts waits for the main thread, so it can't run on it.
#[tauri::command]
pub async fn set_settings(app: AppHandle, store: State<'_, SettingsStore>, mut settings: Settings) -> Result<(), String> {
    settings.shortcuts = shortcuts::complete(settings.shortcuts);
    settings::save(&app, &settings)?;
    *store.0.lock().unwrap() = settings.clone();

    let handle = app.clone();
    let media_controls = settings.media_controls;
    app.run_on_main_thread(move || media::set_enabled(&handle, media_controls))
        .map_err(|e| e.to_string())?;
    discord::set_enabled(&app, settings.discord_presence);
    // The player page may still be loading; bridge_ready sends it again then.
    let _ = crate::bridge::send_page_settings(&app, &settings);
    let errors = shortcuts::apply(&app, &settings);
    emit_ui(&app, "settings://changed", &settings);

    if errors.is_empty() {
        Ok(())
    } else {
        Err(format!("Some global shortcuts could not be set: {}", errors.join("; ")))
    }
}

/// Runs a shortcut's action from a key press in a Dyno Music window.
/// Async because the mini player action may create a window (see open_mini_player).
#[tauri::command]
pub async fn run_shortcut(app: AppHandle, action: ShortcutAction) {
    shortcuts::run(&app, action);
}

/// Forgets the Google session: clears the player's browsing data and reloads YouTube Music,
/// whose bridge then reports the signed-out session.
#[tauri::command]
pub fn sign_out(app: AppHandle, hub: State<'_, Hub>) -> Result<(), String> {
    let window = app
        .get_webview_window(PLAYER_LABEL)
        .ok_or("the player window does not exist")?;
    *hub.session.lock().unwrap() = None;
    window.clear_all_browsing_data().map_err(|e| e.to_string())?;
    window
        .navigate(YTM_URL.parse().expect("valid YouTube Music URL"))
        .map_err(|e| e.to_string())
}

/// UI messages, printed next to the bridge's so `tauri dev` shows both.
#[tauri::command]
pub fn ui_log(level: String, message: String) {
    eprintln!("[ui:{level}] {message}");
}

/// Current state for a window that has just loaded and missed earlier events.
#[tauri::command]
pub fn get_snapshot(hub: State<'_, Hub>) -> Snapshot {
    Snapshot {
        session: hub.session.lock().unwrap().clone(),
        state: hub.player.lock().unwrap().clone(),
        queue: hub.queue.lock().unwrap().clone(),
    }
}
