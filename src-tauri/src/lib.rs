mod auth;
mod bridge;
mod commands;
mod player;
mod state;

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(state::Hub::default())
        .invoke_handler(tauri::generate_handler![
            commands::player_cmd,
            commands::ytm_api,
            commands::sign_in,
            commands::show_player,
            commands::hide_player,
            commands::get_snapshot,
            commands::ui_log,
            bridge::bridge_ready,
            bridge::bridge_state,
            bridge::bridge_queue,
            bridge::bridge_response,
            bridge::bridge_log,
        ])
        .setup(|app| {
            player::create(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                match window.label() {
                    // The player must outlive its window being closed: just hide it.
                    player::PLAYER_LABEL => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    // Otherwise the hidden player would keep the app running.
                    "main" => window.app_handle().exit(0),
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
