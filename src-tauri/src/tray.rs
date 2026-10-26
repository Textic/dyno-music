//! System tray icon: playback controls, show the window, quit.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::commands::{send_command, PlayerCommand};
use crate::state::{PlayerState, PlayerStatus};

pub const MAIN_WINDOW: &str = "main";

pub struct Tray {
    icon: TrayIcon,
    toggle: MenuItem<Wry>,
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn on_menu(app: &AppHandle, id: &str) {
    let command = match id {
        "toggle" => PlayerCommand::Toggle,
        "next" => PlayerCommand::Next,
        "previous" => PlayerCommand::Previous,
        "show" => return show_main_window(app),
        "quit" => return app.exit(0),
        _ => return,
    };
    if let Err(err) = send_command(app, &command) {
        eprintln!("[tray] {err}");
    }
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Play", true, None::<&str>)?;
    let previous = MenuItem::with_id(app, "previous", "Previous", true, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", "Next", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show Dyno Music", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&toggle, &previous, &next, &separator, &show, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Dyno Music")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| on_menu(app, event.id.as_ref()))
        // Left click plays or pauses; the window is in the menu (right click).
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                on_menu(tray.app_handle(), "toggle");
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    let icon = builder.build(app)?;
    app.manage(Tray { icon, toggle });
    Ok(())
}

/// Keeps the Play/Pause label and the tooltip in step with the player.
pub fn update(app: &AppHandle, state: &PlayerState) {
    let Some(tray) = app.try_state::<Tray>() else { return };
    let playing = matches!(state.status, PlayerStatus::Playing | PlayerStatus::Buffering);
    let _ = tray.toggle.set_text(if playing { "Pause" } else { "Play" });
    let tooltip = match &state.track {
        Some(track) => {
            let artists = track.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", ");
            if artists.is_empty() {
                track.title.clone()
            } else {
                format!("{} — {}", track.title, artists)
            }
        }
        None => "Dyno Music".to_string(),
    };
    let _ = tray.icon.set_tooltip(Some(tooltip));
}
