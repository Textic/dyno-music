//! Commands called by the script injected into music.youtube.com (src/bridge).
//! Only these are allowed for the remote origin (capabilities/ytm-remote.json).

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::player::PLAYER_LABEL;
use crate::{auth, media, tray};
use crate::state::{Hub, PlayerState, SessionInfo};

const UI_WINDOW: &str = "main";

/// Async because reading cookies deadlocks on the main thread on Windows.
#[tauri::command]
pub async fn bridge_ready(
    app: AppHandle,
    hub: State<'_, Hub>,
    mut session: SessionInfo,
) -> Result<(), String> {
    // The session cookies are the source of truth; the page's own flag is only a fallback.
    if let Some(window) = app.get_webview_window(PLAYER_LABEL) {
        match auth::has_session_cookie(&window) {
            Ok(signed_in) => session.logged_in = signed_in,
            Err(err) => eprintln!("[bridge] could not read cookies: {err}"),
        }
    }
    eprintln!("[bridge] ready: signed in = {}, {}", session.logged_in, session.url);
    let _ = app.emit_to(UI_WINDOW, "player://session", &session);
    *hub.session.lock().unwrap() = Some(session);
    Ok(())
}

#[tauri::command]
pub fn bridge_state(app: AppHandle, hub: State<'_, Hub>, state: PlayerState) {
    let track_changed = {
        let mut current = hub.player.lock().unwrap();
        if *current == state {
            return;
        }
        let changed = current.track != state.track;
        *current = state.clone();
        changed
    };
    let _ = app.emit_to(UI_WINDOW, "player://state", &state);
    tray::update(&app, &state);
    media::update(&app, &state, track_changed);
}

#[tauri::command]
pub fn bridge_queue(app: AppHandle, hub: State<'_, Hub>, queue: Value) {
    *hub.queue.lock().unwrap() = queue.clone();
    let _ = app.emit_to(UI_WINDOW, "player://queue", &queue);
}

#[tauri::command]
pub fn bridge_response(
    hub: State<'_, Hub>,
    id: u64,
    ok: bool,
    data: Option<Value>,
    error: Option<String>,
) {
    let result = if ok {
        Ok(data.unwrap_or(Value::Null))
    } else {
        Err(error.unwrap_or_else(|| "unknown error in YouTube Music".into()))
    };
    hub.resolve_request(id, result);
}

#[tauri::command]
pub fn bridge_log(app: AppHandle, level: String, message: String) {
    eprintln!("[bridge:{level}] {message}");
    let _ = app.emit_to(
        UI_WINDOW,
        "player://log",
        json!({ "level": level, "message": message }),
    );
}
