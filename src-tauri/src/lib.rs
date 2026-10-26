mod auth;
mod bridge;
mod commands;
mod media;
mod player;
mod settings;
mod state;
mod tray;

use std::sync::Mutex;

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(state::Hub::default())
        .invoke_handler(tauri::generate_handler![
            commands::player_cmd,
            commands::ytm_api,
            commands::sign_in,
            commands::sign_out,
            commands::show_player,
            commands::hide_player,
            commands::get_snapshot,
            commands::get_settings,
            commands::set_settings,
            commands::ui_log,
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
            app.manage(settings::SettingsStore(Mutex::new(settings)));

            player::create(handle)?;
            if let Err(err) = tray::create(handle) {
                eprintln!("[tray] could not create the tray icon: {err}");
            }
            // setup() runs on the main thread, where the media controls must live.
            media::set_enabled(handle, media_controls);
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
