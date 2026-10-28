mod api;
mod auth;
mod bridge;
mod commands;
mod cover;
mod discord;
mod media;
mod mini;
mod player;
mod settings;
mod shortcuts;
mod state;
mod tray;

use std::sync::Mutex;

use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

/// Passed when Windows (or macOS, Linux) launches the app at login: start in the tray.
const HIDDEN_ARG: &str = "--hidden";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must come first: a second launch hands over to the running app, which shows its window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_main_window(app)))
        // Remembers where and how big the main window was. Not the hidden player window or the mini
        // player, and not visibility, or the player would reappear on launch.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&[player::PLAYER_LABEL, mini::MINI_LABEL])
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![HIDDEN_ARG])))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(shortcuts::on_global).build())
        .manage(state::Hub::default())
        .manage(shortcuts::Registered::default())
        .register_asynchronous_uri_scheme_protocol(cover::SCHEME, cover::handle)
        .invoke_handler(tauri::generate_handler![
            commands::player_cmd,
            commands::ytm_api,
            commands::sign_in,
            commands::sign_out,
            commands::show_player,
            commands::hide_player,
            commands::open_mini_player,
            commands::close_mini_player,
            commands::get_snapshot,
            commands::get_settings,
            commands::set_settings,
            commands::ui_log,
            commands::run_shortcut,
            commands::api_status,
            bridge::bridge_ready,
            bridge::bridge_state,
            bridge::bridge_queue,
            bridge::bridge_response,
            bridge::bridge_log,
        ])
        .setup(|app| {
            let handle = app.handle();
            let settings = settings::load(handle);
            let media_controls = settings.media_controls;
            discord::start(handle, settings.discord_presence);
            // Off the main thread: the shortcut plugin waits for it, and setup() runs on it.
            let shortcuts_handle = handle.clone();
            let startup_settings = settings.clone();
            tauri::async_runtime::spawn(async move {
                for err in shortcuts::apply(&shortcuts_handle, &startup_settings) {
                    eprintln!("[shortcuts] {err}");
                }
            });
            app.manage(api::ApiServer::default());
            if let Err(err) = api::apply(handle, &settings) {
                eprintln!("[api] {err}");
            }
            app.manage(settings::SettingsStore(Mutex::new(settings)));

            player::create(handle)?;
            if let Err(err) = tray::create(handle) {
                eprintln!("[tray] could not create the tray icon: {err}");
            }
            // setup() runs on the main thread, where the media controls must live.
            media::set_enabled(handle, media_controls);

            // Launched at login: stay in the tray until the user opens the window.
            if std::env::args().any(|arg| arg == HIDDEN_ARG) {
                if let Some(window) = app.get_webview_window(tray::MAIN_WINDOW) {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                match window.label() {
                    // The player must outlive its window being closed: just hide it.
                    player::PLAYER_LABEL => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    // Alt+F4 on the mini player: back to the main window.
                    mini::MINI_LABEL => {
                        api.prevent_close();
                        mini::close(app);
                    }
                    // Keep playing from the tray, or quit (the hidden player would otherwise
                    // keep the app running with no window).
                    tray::MAIN_WINDOW => {
                        let to_tray =
                            settings::current(app).close_to_tray && app.try_state::<tray::Tray>().is_some();
                        if to_tray {
                            api.prevent_close();
                            let _ = window.hide();
                        } else {
                            app.exit(0);
                        }
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
