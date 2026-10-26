use std::sync::atomic::Ordering;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};

use crate::player::{self, PLAYER_LABEL};
use crate::state::{Hub, PlayerState, SessionInfo};

const API_TIMEOUT: Duration = Duration::from_secs(15);

/// InnerTube endpoints the UI may reach through the bridge.
const ALLOWED_ENDPOINTS: &[&str] = &["search", "browse", "next", "music/get_search_suggestions"];

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
    PlayVideo { video_id: String, playlist_id: Option<String> },
}

#[tauri::command]
pub fn player_cmd(app: AppHandle, cmd: PlayerCommand) -> Result<(), String> {
    let cmd = serde_json::to_string(&cmd).map_err(|e| e.to_string())?;
    player::eval_bridge(&app, &format!("command({cmd})"))
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
    if !hub.is_ready() {
        return Err("YouTube Music is still loading".into());
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

/// Shows the YouTube Music window. With `login`, it hides itself again once the user signs in.
#[tauri::command]
pub fn show_player(app: AppHandle, hub: State<'_, Hub>, login: bool) -> Result<(), String> {
    let window = app
        .get_webview_window(PLAYER_LABEL)
        .ok_or("the player window does not exist")?;
    hub.login_pending.store(login, Ordering::SeqCst);
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_player(app: AppHandle, hub: State<'_, Hub>) -> Result<(), String> {
    hub.login_pending.store(false, Ordering::SeqCst);
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
}

/// Current state for a window that has just loaded and missed earlier events.
#[tauri::command]
pub fn get_snapshot(hub: State<'_, Hub>) -> Snapshot {
    Snapshot {
        session: hub.session.lock().unwrap().clone(),
        state: hub.player.lock().unwrap().clone(),
    }
}
