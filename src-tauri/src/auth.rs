//! Google sign-in inside the player window.
//!
//! The player window goes straight to Google's sign-in page, which returns to
//! music.youtube.com afterwards. Rust watches the window's cookies to know when that happened;
//! the cookies then stay in the player's webview, which keeps renewing them on its own.

use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, Manager, WebviewWindow};

use crate::player::{PLAYER_LABEL, YTM_URL};
use crate::state::Hub;

const SIGN_IN_URL: &str = "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F";

/// Cookies YouTube Music signs authenticated requests with (`SAPISIDHASH`).
const AUTH_COOKIES: &[&str] = &["SAPISID", "__Secure-1PAPISID", "__Secure-3PAPISID"];

const POLL_INTERVAL: Duration = Duration::from_secs(1);
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);

/// Whether the webview holds a YouTube Music session.
///
/// On Windows this deadlocks if called from the main thread: only use it from async commands
/// or spawned tasks.
pub fn has_session_cookie(window: &WebviewWindow) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    let cookies = window
        .cookies()
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter(|cookie| {
            cookie
                .domain()
                .is_some_and(|domain| domain_matches("music.youtube.com", domain))
        })
        .collect::<Vec<_>>();
    #[cfg(not(target_os = "macos"))]
    let cookies = window
        .cookies_for_url(YTM_URL.parse().map_err(|e| format!("{e}"))?)
        .map_err(|e| e.to_string())?;

    Ok(cookies.iter().any(|cookie| AUTH_COOKIES.contains(&cookie.name())))
}

#[cfg(target_os = "macos")]
fn domain_matches(host: &str, cookie_domain: &str) -> bool {
    let domain = cookie_domain.trim_start_matches('.');
    host == domain || host.ends_with(&format!(".{domain}"))
}

fn on_music_page(window: &WebviewWindow) -> bool {
    window
        .url()
        .is_ok_and(|url| url.domain() == Some("music.youtube.com"))
}

/// Shows Google's sign-in page in the player window and waits until the user is signed in.
/// Closing or hiding the window cancels it.
pub async fn sign_in(app: &AppHandle, hub: &Hub) -> Result<(), String> {
    let window = app
        .get_webview_window(PLAYER_LABEL)
        .ok_or("the player window does not exist")?;

    // A second click while signing in just brings the window back up.
    if hub.signing_in.swap(true, Ordering::SeqCst) {
        window.show().map_err(|e| e.to_string())?;
        return window.set_focus().map_err(|e| e.to_string());
    }
    let result = wait_for_sign_in(&window).await;
    hub.signing_in.store(false, Ordering::SeqCst);

    let _ = window.hide();
    if result.is_err() && !on_music_page(&window) {
        // Leave the player on YouTube Music, not halfway through Google's pages.
        let _ = window.navigate(YTM_URL.parse().expect("valid YouTube Music URL"));
    }
    result
}

async fn wait_for_sign_in(window: &WebviewWindow) -> Result<(), String> {
    window
        .navigate(SIGN_IN_URL.parse().expect("valid sign-in URL"))
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    let polls = SIGN_IN_TIMEOUT.as_secs() / POLL_INTERVAL.as_secs();
    for _ in 0..polls {
        tokio::time::sleep(POLL_INTERVAL).await;
        // Landing back on music.youtube.com is what proves Google accepted the sign-in.
        if on_music_page(window) && has_session_cookie(window)? {
            eprintln!("[auth] signed in");
            return Ok(());
        }
        if !window.is_visible().unwrap_or(false) {
            eprintln!("[auth] sign-in cancelled");
            return Err("sign-in was cancelled".into());
        }
    }
    eprintln!("[auth] sign-in timed out");
    Err("sign-in timed out".into())
}
