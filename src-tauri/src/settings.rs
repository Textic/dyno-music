//! App settings, kept in `settings.json` in the app's config folder.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::shortcuts::{self, Bindings};

/// Mirrors `Settings` in src/shared/types.ts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Closing the main window hides it to the tray and keeps the music playing. Off by
    /// default: the close button quits unless the user asks otherwise.
    pub close_to_tray: bool,
    /// Media keys and the system media panel (Windows SMTC, macOS Now Playing, Linux MPRIS).
    pub media_controls: bool,
    /// "Listening to…" on the user's Discord profile, while Discord runs on this computer.
    pub discord_presence: bool,
    pub shortcuts: Bindings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            close_to_tray: false,
            media_controls: true,
            discord_presence: true,
            shortcuts: shortcuts::defaults(),
        }
    }
}

pub struct SettingsStore(pub Mutex<Settings>);

fn path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("settings.json"))
}

/// Missing or unreadable settings fall back to the defaults.
pub fn load(app: &AppHandle) -> Settings {
    let mut settings: Settings = path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    settings.shortcuts = shortcuts::complete(settings.shortcuts);
    settings
}

pub fn save(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = path(app).ok_or("no config folder for settings")?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

pub fn current(app: &AppHandle) -> Settings {
    app.state::<SettingsStore>().0.lock().unwrap().clone()
}
