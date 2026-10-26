//! Keyboard shortcuts. Each action has one key combination; a global one works from any app,
//! the others only while a Dyno Music window has focus (handled by the UI, see
//! src/main/composables/useShortcuts.ts).
//!
//! Keys are written as `Ctrl+Shift+KeyP`: modifiers, then the key's `KeyboardEvent.code`, which
//! is also what the global hotkey parser understands.

use std::collections::{BTreeMap, HashMap};
use std::str::FromStr;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::commands::{send_command, PlayerCommand};
use crate::settings::Settings;
use crate::state::{Hub, LikeStatus};
use crate::{mini, tray};

/// Mirrors `ShortcutAction` in src/shared/types.ts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ShortcutAction {
    PlayPause,
    Next,
    Previous,
    VolumeUp,
    VolumeDown,
    Like,
    MiniPlayer,
    ShowWindow,
}

const ALL: [ShortcutAction; 8] = [
    ShortcutAction::PlayPause,
    ShortcutAction::Next,
    ShortcutAction::Previous,
    ShortcutAction::VolumeUp,
    ShortcutAction::VolumeDown,
    ShortcutAction::Like,
    ShortcutAction::MiniPlayer,
    ShortcutAction::ShowWindow,
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    pub keys: Option<String>,
    pub global: bool,
}

pub type Bindings = BTreeMap<ShortcutAction, Binding>;

const VOLUME_STEP: f64 = 5.0;

fn default_keys(action: ShortcutAction) -> Option<&'static str> {
    match action {
        ShortcutAction::PlayPause => Some("Space"),
        ShortcutAction::Next => Some("Ctrl+ArrowRight"),
        ShortcutAction::Previous => Some("Ctrl+ArrowLeft"),
        ShortcutAction::VolumeUp => Some("Ctrl+ArrowUp"),
        ShortcutAction::VolumeDown => Some("Ctrl+ArrowDown"),
        ShortcutAction::Like => Some("Ctrl+KeyL"),
        ShortcutAction::MiniPlayer => Some("Ctrl+KeyM"),
        ShortcutAction::ShowWindow => None,
    }
}

/// Fills in the actions a settings file doesn't mention (new ones, or after a reset).
pub fn complete(mut bindings: Bindings) -> Bindings {
    for action in ALL {
        bindings.entry(action).or_insert_with(|| Binding {
            keys: default_keys(action).map(str::to_string),
            global: false,
        });
    }
    bindings
}

pub fn defaults() -> Bindings {
    complete(Bindings::new())
}

/// Which global shortcut runs which action.
#[derive(Default)]
pub struct Registered(Mutex<HashMap<u32, ShortcutAction>>);

/// Called by the global shortcut plugin for every registered shortcut.
pub fn on_global(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state != ShortcutState::Pressed {
        return;
    }
    let action = app
        .try_state::<Registered>()
        .and_then(|registered| registered.0.lock().unwrap().get(&shortcut.id()).copied());
    if let Some(action) = action {
        run(app, action);
    }
}

/// Registers the global shortcuts in `settings`, replacing the previous ones. Returns a message
/// for each one that could not be registered (bad keys, or taken by another app).
///
/// Never call this on the main thread: the plugin waits for the main thread to register.
pub fn apply(app: &AppHandle, settings: &Settings) -> Vec<String> {
    let manager = app.global_shortcut();
    let mut errors = Vec::new();
    if let Err(err) = manager.unregister_all() {
        errors.push(format!("could not clear the global shortcuts: {err}"));
    }
    let mut registered = HashMap::new();
    for (action, binding) in &settings.shortcuts {
        let (true, Some(keys)) = (binding.global, binding.keys.as_deref()) else { continue };
        let result = Shortcut::from_str(keys)
            .map_err(|e| e.to_string())
            .and_then(|shortcut| manager.register(shortcut).map(|()| shortcut).map_err(|e| e.to_string()));
        match result {
            Ok(shortcut) => {
                registered.insert(shortcut.id(), *action);
            }
            Err(err) => errors.push(format!("{keys}: {err}")),
        }
    }
    *app.state::<Registered>().0.lock().unwrap() = registered;
    errors
}

pub fn run(app: &AppHandle, action: ShortcutAction) {
    let command = match action {
        ShortcutAction::PlayPause => PlayerCommand::Toggle,
        ShortcutAction::Next => PlayerCommand::Next,
        ShortcutAction::Previous => PlayerCommand::Previous,
        ShortcutAction::VolumeUp | ShortcutAction::VolumeDown => {
            let current = app.state::<Hub>().player.lock().unwrap().volume;
            let step = if action == ShortcutAction::VolumeUp { VOLUME_STEP } else { -VOLUME_STEP };
            PlayerCommand::Volume { value: (current + step).clamp(0.0, 100.0) }
        }
        ShortcutAction::Like => {
            let state = app.state::<Hub>().player.lock().unwrap().clone();
            if state.track.is_none() {
                return;
            }
            let status = if state.like_status == LikeStatus::Like { LikeStatus::Indifferent } else { LikeStatus::Like };
            PlayerCommand::Like { status }
        }
        ShortcutAction::MiniPlayer => return mini::toggle(app),
        ShortcutAction::ShowWindow => return tray::show_main_window(app),
    };
    if let Err(err) = send_command(app, &command) {
        eprintln!("[shortcuts] {err}");
    }
}
