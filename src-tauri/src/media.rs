//! Media keys and the system media panel (Windows SMTC, macOS Now Playing, Linux MPRIS),
//! through souvlaki. WebView2's own integration is turned off (see player.rs), so this is the
//! only entry the system shows.
//!
//! The controls live on the main thread: macOS requires it, and it avoids sharing them across
//! threads elsewhere.

use std::cell::RefCell;
use std::time::Duration;

use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig};
use tauri::{AppHandle, Manager};

use crate::commands::{send_command, PlayerCommand};
use crate::state::{PlayerState, PlayerStatus};
use crate::tray::{show_main_window, MAIN_WINDOW};

thread_local! {
    static CONTROLS: RefCell<Option<MediaControls>> = const { RefCell::new(None) };
}

fn on_event(app: &AppHandle, event: MediaControlEvent) {
    let command = match event {
        MediaControlEvent::Play => PlayerCommand::Play,
        MediaControlEvent::Pause | MediaControlEvent::Stop => PlayerCommand::Pause,
        MediaControlEvent::Toggle => PlayerCommand::Toggle,
        MediaControlEvent::Next => PlayerCommand::Next,
        MediaControlEvent::Previous => PlayerCommand::Previous,
        MediaControlEvent::SetPosition(MediaPosition(position)) => PlayerCommand::Seek {
            position_sec: position.as_secs_f64(),
        },
        MediaControlEvent::Raise => return show_main_window(app),
        _ => return,
    };
    if let Err(err) = send_command(app, &command) {
        eprintln!("[media] {err}");
    }
}

fn create(app: &AppHandle) -> Result<MediaControls, String> {
    #[cfg(windows)]
    let hwnd = Some(
        app.get_webview_window(MAIN_WINDOW)
            .ok_or("main window missing")?
            .hwnd()
            .map_err(|e| e.to_string())?
            .0 as *mut std::ffi::c_void,
    );
    #[cfg(not(windows))]
    let hwnd = {
        let _ = MAIN_WINDOW;
        None
    };

    let mut controls = MediaControls::new(PlatformConfig {
        display_name: "Dyno Music",
        dbus_name: "dyno_music",
        hwnd,
    })
    .map_err(|e| format!("{e:?}"))?;
    let handle = app.clone();
    controls
        .attach(move |event| on_event(&handle, event))
        .map_err(|e| format!("{e:?}"))?;
    Ok(controls)
}

/// Turns the system integration on or off. Call on the main thread.
pub fn set_enabled(app: &AppHandle, enabled: bool) {
    CONTROLS.with(|cell| {
        let mut slot = cell.borrow_mut();
        if !enabled {
            if let Some(mut controls) = slot.take() {
                let _ = controls.detach();
            }
        } else if slot.is_none() {
            match create(app) {
                Ok(controls) => *slot = Some(controls),
                Err(err) => eprintln!("[media] could not set up media controls: {err}"),
            }
        }
    });
}

/// Reflects the player in the system panel. `track_changed` also refreshes title and artwork.
pub fn update(app: &AppHandle, state: &PlayerState, track_changed: bool) {
    let state = state.clone();
    let _ = app.run_on_main_thread(move || {
        CONTROLS.with(|cell| {
            let mut slot = cell.borrow_mut();
            let Some(controls) = slot.as_mut() else { return };
            if track_changed {
                let artists = state
                    .track
                    .as_ref()
                    .map(|t| t.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", "))
                    .unwrap_or_default();
                let track = state.track.as_ref();
                let _ = controls.set_metadata(MediaMetadata {
                    title: track.map(|t| t.title.as_str()),
                    artist: Some(artists.as_str()).filter(|a| !a.is_empty()),
                    album: track.and_then(|t| t.album.as_deref()),
                    cover_url: track.map(|t| t.thumbnail.as_str()).filter(|u| !u.is_empty()),
                    duration: track.map(|t| Duration::from_secs_f64(t.duration_sec.max(0.0))),
                });
            }
            let progress = Some(MediaPosition(Duration::from_secs_f64(state.position_sec.max(0.0))));
            let _ = controls.set_playback(match (&state.track, state.status) {
                (None, _) | (_, PlayerStatus::Idle) => MediaPlayback::Stopped,
                (_, PlayerStatus::Playing | PlayerStatus::Buffering) => MediaPlayback::Playing { progress },
                _ => MediaPlayback::Paused { progress },
            });
        });
    });
}
