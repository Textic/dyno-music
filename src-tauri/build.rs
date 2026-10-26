fn main() {
    // The app icon is compiled into the executable; without this, regenerated icons are only
    // picked up after a clean build.
    println!("cargo:rerun-if-changed=icons");

    // Listing the app commands generates `allow-<command>` permissions, so each
    // capability file decides exactly which commands a window may call.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            // UI (main window)
            "player_cmd",
            "ytm_api",
            "sign_in",
            "show_player",
            "hide_player",
            "get_snapshot",
            "ui_log",
            "get_settings",
            "set_settings",
            "sign_out",
            // Bridge (music.youtube.com inside the hidden player window)
            "bridge_ready",
            "bridge_state",
            "bridge_queue",
            "bridge_response",
            "bridge_log",
        ]),
    ))
    .expect("failed to run tauri-build");
}
