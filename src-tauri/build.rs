fn main() {
    // Listing the app commands generates `allow-<command>` permissions, so each
    // capability file decides exactly which commands a window may call.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            // UI (main window)
            "player_cmd",
            "ytm_api",
            "show_player",
            "hide_player",
            "get_snapshot",
            // Bridge (music.youtube.com inside the hidden player window)
            "bridge_ready",
            "bridge_state",
            "bridge_response",
            "bridge_diag",
            "bridge_log",
        ]),
    ))
    .expect("failed to run tauri-build");
}
