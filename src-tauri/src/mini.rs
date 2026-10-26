//! Mini player: the player island in a small window of its own, always on top.
//! Opening it hides the main window; closing it brings the main window back.

use tauri::{AppHandle, LogicalPosition, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::tray;

pub const MINI_LABEL: &str = "mini";

const WIDTH: f64 = 360.0;
const HEIGHT: f64 = 112.0;
/// Gap to the screen's corner the first time it opens.
const MARGIN: f64 = 24.0;

pub fn open(app: &AppHandle) -> tauri::Result<()> {
    // Kept hidden rather than closed, so it reopens where the user left it.
    let window = match app.get_webview_window(MINI_LABEL) {
        Some(window) => window,
        None => create(app)?,
    };
    window.show()?;
    window.set_focus()?;
    if let Some(main) = app.get_webview_window(tray::MAIN_WINDOW) {
        main.hide()?;
    }
    Ok(())
}

pub fn close(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MINI_LABEL) {
        let _ = window.hide();
    }
    tray::show_main_window(app);
}

pub fn toggle(app: &AppHandle) {
    let visible = app
        .get_webview_window(MINI_LABEL)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);
    if visible {
        close(app);
    } else if let Err(err) = open(app) {
        eprintln!("[mini] could not open the mini player: {err}");
    }
}

fn create(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let builder = WebviewWindowBuilder::new(app, MINI_LABEL, WebviewUrl::App("mini.html".into()))
        .title("Dyno Music · Mini player")
        .inner_size(WIDTH, HEIGHT)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .shadow(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false);
    #[cfg(windows)]
    let builder = builder.additional_browser_args(crate::player::WEBVIEW2_ARGS);
    let builder = match bottom_right(app) {
        Some(position) => builder.position(position.x, position.y),
        None => builder.center(),
    };
    builder.build()
}

/// The bottom-right corner of the screen the main window is on, above the taskbar.
fn bottom_right(app: &AppHandle) -> Option<LogicalPosition<f64>> {
    let main = app.get_webview_window(tray::MAIN_WINDOW)?;
    let monitor = main.current_monitor().ok().flatten()?;
    let area = monitor.work_area();
    let scale = monitor.scale_factor();
    let right = f64::from(area.position.x) / scale + f64::from(area.size.width) / scale;
    let bottom = f64::from(area.position.y) / scale + f64::from(area.size.height) / scale;
    Some(LogicalPosition::new(right - WIDTH - MARGIN, bottom - HEIGHT - MARGIN))
}
