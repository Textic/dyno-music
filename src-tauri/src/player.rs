use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const PLAYER_LABEL: &str = "player";

pub const YTM_URL: &str = "https://music.youtube.com/";

/// Built by `npm run build:bridge` (see vite.bridge.config.ts).
const BRIDGE_JS: &str = include_str!("../../dist-bridge/bridge.js");

/// WebView2 shares one browser environment per data directory, so every window must use the
/// same arguments: keep this identical to `additionalBrowserArgs` in tauri.conf.json.
/// - HardwareMediaKeyHandling off: media keys and the system media panel will be ours (phase 3).
/// - Autoplay without a user gesture: the hidden page never receives clicks.
#[cfg(windows)]
pub const WEBVIEW2_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,HardwareMediaKeyHandling --autoplay-policy=no-user-gesture-required";

/// Google may refuse to sign in on embedded webviews with their default user agent.
/// WebView2's default already matches Edge, so Windows keeps it.
#[cfg(target_os = "macos")]
const USER_AGENT: Option<&str> = Some(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
);
#[cfg(target_os = "linux")]
const USER_AGENT: Option<&str> = Some(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
);
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
const USER_AGENT: Option<&str> = None;

/// Creates the hidden window that runs music.youtube.com with the bridge injected.
pub fn create(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let url = WebviewUrl::External(YTM_URL.parse().expect("valid YouTube Music URL"));
    let builder = WebviewWindowBuilder::new(app, PLAYER_LABEL, url)
        .title("YouTube Music · Dyno Music")
        .inner_size(1100.0, 760.0)
        .visible(false)
        .initialization_script(BRIDGE_JS)
        .background_throttling(BackgroundThrottlingPolicy::Disabled);
    #[cfg(windows)]
    let builder = builder.additional_browser_args(WEBVIEW2_ARGS);
    let builder = match USER_AGENT {
        Some(ua) => builder.user_agent(ua),
        None => builder,
    };
    builder.build()
}

/// Calls `window.__dynoBridge.<call>` inside the player page.
/// Arguments embedded in `call` must come from `serde_json`, never from string formatting.
pub fn eval_bridge(app: &AppHandle, call: &str) -> Result<(), String> {
    let window = app
        .get_webview_window(PLAYER_LABEL)
        .ok_or("the player window does not exist")?;
    let script = format!("window.__dynoBridge && window.__dynoBridge.{call};");
    window.eval(script.as_str()).map_err(|e| e.to_string())
}
