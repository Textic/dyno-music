use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::oneshot;

// Mirrors src/shared/types.ts.

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlayerStatus {
    #[default]
    Idle,
    Playing,
    Paused,
    Buffering,
    Ended,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub video_id: String,
    pub title: String,
    pub artists: Vec<Artist>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub album: Option<String>,
    pub thumbnail: String,
    pub duration_sec: f64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    pub status: PlayerStatus,
    pub track: Option<Track>,
    pub position_sec: f64,
    pub volume: f64,
    pub muted: bool,
    pub is_ad: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub logged_in: bool,
    pub url: String,
}

type ApiResult = Result<Value, String>;

/// Shared state: everything between the UI and the hidden player passes through here.
#[derive(Default)]
pub struct Hub {
    pub player: Mutex<PlayerState>,
    /// `None` until the bridge reports that music.youtube.com finished loading.
    pub session: Mutex<Option<SessionInfo>>,
    /// Set while the player window is shown for Google sign-in; it hides again once signed in.
    pub login_pending: AtomicBool,
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<ApiResult>>>,
}

impl Hub {
    pub fn is_ready(&self) -> bool {
        self.session.lock().unwrap().is_some()
    }

    pub fn register_request(&self) -> (u64, oneshot::Receiver<ApiResult>) {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap().insert(id, tx);
        (id, rx)
    }

    pub fn resolve_request(&self, id: u64, result: ApiResult) {
        if let Some(tx) = self.pending.lock().unwrap().remove(&id) {
            let _ = tx.send(result);
        }
    }

    pub fn cancel_request(&self, id: u64) {
        self.pending.lock().unwrap().remove(&id);
    }
}
