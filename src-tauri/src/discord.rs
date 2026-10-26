//! Discord Rich Presence: "Listening to…" with the artwork and progress, through Discord's
//! local IPC. A worker thread owns the connection, so a missing or restarting Discord never
//! slows down the player; it reconnects by itself.

use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use discord_rich_presence::activity::{Activity, ActivityType, Assets, Button, StatusDisplayType, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use tauri::{AppHandle, Manager};

use crate::state::{PlayerState, PlayerStatus};

/// The "Dyno Music" application in the Discord Developer Portal; its name is what Discord shows.
const CLIENT_ID: &str = "1564391999711223988";

const RETRY_EVERY: Duration = Duration::from_secs(15);
/// How often the worker wakes up with nothing new, to retry a lost connection.
const IDLE_WAKE: Duration = Duration::from_secs(5);
/// The start time drifts a little with every position report; only a real seek is worth an update.
const SEEK_TOLERANCE_MS: i64 = 3_000;

enum Message {
    Enabled(bool),
    State(PlayerState),
}

pub struct Presence(Mutex<Sender<Message>>);

/// What Discord should show, or shows.
#[derive(Clone, PartialEq)]
struct Listening {
    video_id: String,
    title: String,
    artists: String,
    album: Option<String>,
    thumbnail: String,
    /// Unix milliseconds the song would have started at, playing without pauses.
    start_ms: i64,
    duration_ms: i64,
}

impl Listening {
    fn same_as(&self, other: &Self) -> bool {
        self.video_id == other.video_id
            && self.title == other.title
            && self.thumbnail == other.thumbnail
            && (self.start_ms - other.start_ms).abs() <= SEEK_TOLERANCE_MS
    }
}

#[derive(Clone, PartialEq)]
enum Shown {
    /// Just connected: Discord shows nothing of ours yet, but send whatever we have.
    Unknown,
    Nothing,
    Song(Listening),
}

pub fn start(app: &AppHandle, enabled: bool) {
    let (tx, rx) = mpsc::channel();
    let _ = tx.send(Message::Enabled(enabled));
    app.manage(Presence(Mutex::new(tx)));
    if CLIENT_ID.is_empty() {
        eprintln!("[discord] no client id set; Rich Presence is off");
        return;
    }
    thread::Builder::new()
        .name("discord-presence".into())
        .spawn(move || worker(rx))
        .expect("could not start the Discord thread");
}

fn send(app: &AppHandle, message: Message) {
    if let Some(presence) = app.try_state::<Presence>() {
        let _ = presence.0.lock().unwrap().send(message);
    }
}

pub fn set_enabled(app: &AppHandle, enabled: bool) {
    send(app, Message::Enabled(enabled));
}

pub fn update(app: &AppHandle, state: &PlayerState) {
    send(app, Message::State(state.clone()));
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

/// Only a song that is actually playing is shown; paused, idle and ads clear the status.
fn wanted(state: &PlayerState) -> Option<Listening> {
    let playing = matches!(state.status, PlayerStatus::Playing | PlayerStatus::Buffering);
    let track = state.track.as_ref().filter(|_| playing && !state.is_ad)?;
    Some(Listening {
        video_id: track.video_id.clone(),
        title: track.title.clone(),
        artists: track.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", "),
        album: track.album.clone(),
        thumbnail: track.thumbnail.clone(),
        start_ms: now_ms() - (state.position_sec * 1000.0) as i64,
        duration_ms: (track.duration_sec * 1000.0) as i64,
    })
}

/// Discord rejects texts shorter than 2 or longer than 128 characters.
fn fit(text: &str) -> String {
    let mut text: String = text.chars().take(128).collect();
    while text.chars().count() < 2 {
        text.push('\u{2800}');
    }
    text
}

fn activity(song: &Listening) -> Activity<'static> {
    let mut timestamps = Timestamps::new().start(song.start_ms);
    if song.duration_ms > 0 {
        timestamps = timestamps.end(song.start_ms + song.duration_ms);
    }
    let artists = if song.artists.is_empty() { "YouTube Music".to_string() } else { song.artists.clone() };
    let large_text = song.album.clone().unwrap_or_else(|| song.title.clone());
    Activity::new()
        .activity_type(ActivityType::Listening)
        // The member list reads "Listening to <song>" instead of "Listening to Dyno Music".
        .status_display_type(StatusDisplayType::Details)
        .details(fit(&song.title))
        .state(fit(&artists))
        .assets(Assets::new().large_image(song.thumbnail.clone()).large_text(fit(&large_text)))
        .timestamps(timestamps)
        .buttons(vec![Button::new(
            "Listen on YouTube Music",
            format!("https://music.youtube.com/watch?v={}", song.video_id),
        )])
}

fn worker(rx: Receiver<Message>) {
    let mut enabled = false;
    let mut state = PlayerState::default();
    let mut client: Option<DiscordIpcClient> = None;
    let mut shown = Shown::Nothing;
    let mut next_attempt = Instant::now();

    loop {
        let first = match rx.recv_timeout(IDLE_WAKE) {
            Ok(message) => Some(message),
            Err(RecvTimeoutError::Timeout) => None,
            Err(RecvTimeoutError::Disconnected) => break,
        };
        // Only the latest state matters.
        for message in first.into_iter().chain(rx.try_iter()) {
            match message {
                Message::Enabled(on) => enabled = on,
                Message::State(next) => state = next,
            }
        }

        if !enabled {
            if let Some(mut connection) = client.take() {
                let _ = connection.clear_activity();
                let _ = connection.close();
            }
            shown = Shown::Nothing;
            continue;
        }

        let target = match wanted(&state) {
            Some(song) => Shown::Song(song),
            None => Shown::Nothing,
        };
        let up_to_date = match (&shown, &target) {
            (Shown::Song(a), Shown::Song(b)) => a.same_as(b),
            (a, b) => a == b,
        };
        if up_to_date {
            continue;
        }

        if client.is_none() {
            // Nothing to show and nothing shown: no need to reach Discord at all.
            if target == Shown::Nothing || Instant::now() < next_attempt {
                continue;
            }
            let mut connection = DiscordIpcClient::new(CLIENT_ID);
            match connection.connect() {
                Ok(()) => {
                    eprintln!("[discord] connected");
                    client = Some(connection);
                    shown = Shown::Unknown;
                }
                Err(_) => {
                    // Discord isn't running; that's normal, so stay quiet.
                    next_attempt = Instant::now() + RETRY_EVERY;
                    continue;
                }
            }
        }

        let Some(connection) = client.as_mut() else { continue };
        let result = match &target {
            Shown::Song(song) => connection.set_activity(activity(song)),
            _ => connection.clear_activity(),
        };
        match result {
            Ok(()) => shown = target,
            Err(err) => {
                eprintln!("[discord] lost the connection: {err}");
                client = None;
                shown = Shown::Nothing;
                next_attempt = Instant::now() + IDLE_WAKE;
            }
        }
    }
}
