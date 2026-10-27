//! The `cover://` protocol: artwork fetched by Rust for the UI.
//!
//! Google's image servers sometimes refuse artwork to the WebView (429) while the same URL loads
//! fine from anywhere else, so a cover that fails to load is asked for again through here.
//! Only Google's and YouTube's image hosts are served: this is not an open proxy.

use std::sync::OnceLock;
use std::time::Duration;

use tauri::http::{header, Request, Response, StatusCode};
use tauri::{Runtime, UriSchemeContext, UriSchemeResponder};

pub const SCHEME: &str = "cover";

const ALLOWED_HOSTS: &[&str] = &["googleusercontent.com", "ggpht.com", "ytimg.com"];
const TIMEOUT: Duration = Duration::from_secs(15);

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        // The updater's reqwest brings rustls without a default crypto provider; it installs one
        // the same way before its own requests.
        if rustls::crypto::CryptoProvider::get_default().is_none() {
            let _ = rustls::crypto::ring::default_provider().install_default();
        }
        reqwest::Client::builder()
            .timeout(TIMEOUT)
            .build()
            .expect("could not build the cover client")
    })
}

/// The artwork URL in `cover://localhost/?u=<url>` (`http://cover.localhost/?u=…` on Windows),
/// if it points at an allowed host.
fn target(request: &Request<Vec<u8>>) -> Option<url::Url> {
    let uri = url::Url::parse(&request.uri().to_string()).ok()?;
    let raw = uri.query_pairs().find(|(key, _)| key == "u")?.1.into_owned();
    let target = url::Url::parse(&raw).ok()?;
    let host = target.host_str()?;
    let allowed = target.scheme() == "https"
        && ALLOWED_HOSTS.iter().any(|h| host == *h || host.ends_with(&format!(".{h}")));
    allowed.then_some(target)
}

fn error(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder().status(status).body(Vec::new()).unwrap()
}

async fn fetch(target: url::Url) -> Response<Vec<u8>> {
    let response = match client().get(target).send().await {
        Ok(response) => response,
        Err(_) => return error(StatusCode::BAD_GATEWAY),
    };
    if !response.status().is_success() {
        return error(response.status());
    }
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    match response.bytes().await {
        Ok(bytes) => Response::builder()
            .header(header::CONTENT_TYPE, content_type)
            // Lets the WebView keep it, and the colour sampler read it from a canvas.
            .header(header::CACHE_CONTROL, "public, max-age=86400")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(bytes.to_vec())
            .unwrap(),
        Err(_) => error(StatusCode::BAD_GATEWAY),
    }
}

pub fn handle<R: Runtime>(_ctx: UriSchemeContext<'_, R>, request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let Some(target) = target(&request) else {
        return responder.respond(error(StatusCode::BAD_REQUEST));
    };
    tauri::async_runtime::spawn(async move {
        responder.respond(fetch(target).await);
    });
}
