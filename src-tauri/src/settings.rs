//! App settings, kept in `settings.json` in the app's config folder.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::shortcuts::{self, Bindings};

#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    #[default]
    Dark,
    Light,
    /// Follows the system's light or dark mode.
    System,
}

/// YouTube Music's own audio quality choices; `Auto` leaves the account's setting alone.
#[derive(Debug, Clone, Copy, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioQuality {
    #[default]
    Auto,
    Low,
    Normal,
    /// Only Premium accounts get it; others play at normal quality.
    High,
}

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
    /// Mutes and skips YouTube Music's ads (accounts without Premium). Off by default.
    pub skip_ads: bool,
    /// The local WebSocket API other apps control Dyno Music with (api.rs). Off by default.
    pub api_enabled: bool,
    pub api_port: u16,
    /// Clients must send it to connect; generated when empty (so clearing it makes a new one).
    pub api_token: String,
    pub audio_quality: AudioQuality,
    pub theme: Theme,
    /// The accent colour follows the current song's artwork.
    pub artwork_accent: bool,
    /// Calmer animations, on top of the system's own reduced-motion setting.
    pub reduce_motion: bool,
    pub shortcuts: Bindings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            close_to_tray: false,
            media_controls: true,
            discord_presence: true,
            skip_ads: false,
            api_enabled: false,
            api_port: crate::api::DEFAULT_PORT,
            api_token: String::new(),
            audio_quality: AudioQuality::Auto,
            theme: Theme::Dark,
            artwork_accent: true,
            reduce_motion: false,
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
    complete_api_token(&mut settings);
    settings
}

/// Gives the API a token if it has none: on first start, or after "Regenerate" cleared it.
pub fn complete_api_token(settings: &mut Settings) {
    if settings.api_token.trim().is_empty() {
        settings.api_token = crate::api::new_token();
    }
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
