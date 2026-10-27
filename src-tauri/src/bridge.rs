//! Commands called by the script injected into music.youtube.com (src/bridge).
//! Only these are allowed for the remote origin (capabilities/ytm-remote.json).

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, EventTarget, Manager, State};

use crate::mini::MINI_LABEL;
use crate::player::PLAYER_LABEL;
use crate::{auth, discord, media, player, settings, tray};
use crate::state::{Hub, PlayerState, SessionInfo};

/// Sends an event to our own windows (main and mini player), never to the YouTube Music page.
pub fn emit_ui<S: Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    let _ = app.emit_filter(event, payload, |target| match target {
        EventTarget::Window { label } | EventTarget::Webview { label } | EventTarget::WebviewWindow { label } => {
            label == tray::MAIN_WINDOW || label == MINI_LABEL
        }
        _ => false,
    });
}

/// Passes the settings the player page acts on itself (ads, audio quality).
pub fn send_page_settings(app: &AppHandle, settings: &settings::Settings) -> Result<(), String> {
    let page = json!({ "skipAds": settings.skip_ads, "audioQuality": settings.audio_quality });
    player::eval_bridge(app, &format!("applySettings({page})"))
}

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
    if let Err(err) = send_page_settings(&app, &settings::current(&app)) {
        eprintln!("[bridge] could not send the page settings: {err}");
    }
    emit_ui(&app, "player://session", &session);
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
    emit_ui(&app, "player://state", &state);
    tray::update(&app, &state);
    media::update(&app, &state, track_changed);
    discord::update(&app, &state);
}

#[tauri::command]
pub fn bridge_queue(app: AppHandle, hub: State<'_, Hub>, queue: Value) {
    *hub.queue.lock().unwrap() = queue.clone();
    emit_ui(&app, "player://queue", &queue);
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
    emit_ui(&app, "player://log", json!({ "level": level, "message": message }));
}
