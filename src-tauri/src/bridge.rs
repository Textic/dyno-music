//! Commands called by the script injected into music.youtube.com (src/bridge).
//! Only these are allowed for the remote origin (capabilities/ytm-remote.json).

use std::sync::atomic::Ordering;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::player::PLAYER_LABEL;
use crate::state::{Hub, PlayerState, SessionInfo};

const UI_WINDOW: &str = "main";

#[tauri::command]
pub fn bridge_ready(app: AppHandle, hub: State<'_, Hub>, session: SessionInfo) {
    eprintln!("[bridge] ready: signed in = {}, {}", session.logged_in, session.url);
    if session.logged_in && hub.login_pending.swap(false, Ordering::SeqCst) {
        if let Some(window) = app.get_webview_window(PLAYER_LABEL) {
            let _ = window.hide();
        }
    }
    let _ = app.emit_to(UI_WINDOW, "player://session", &session);
    *hub.session.lock().unwrap() = Some(session);
}

#[tauri::command]
pub fn bridge_state(app: AppHandle, hub: State<'_, Hub>, state: PlayerState) {
    {
        let mut current = hub.player.lock().unwrap();
        if *current == state {
            return;
        }
        *current = state.clone();
    }
    let _ = app.emit_to(UI_WINDOW, "player://state", &state);
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

/// Phase 0 diagnostics (timer throttling, page visibility...), forwarded to the UI as-is.
#[tauri::command]
pub fn bridge_diag(app: AppHandle, diag: Value) {
    let _ = app.emit_to(UI_WINDOW, "player://diag", &diag);
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
