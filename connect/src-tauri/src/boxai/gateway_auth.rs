use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::{sync::OnceLock, time::Duration};

/// Long enough for a first-time sign-in that has to register an account in the
/// browser, short enough that an abandoned attempt does not keep a loopback
/// listener open all day.
const BROWSER_LOGIN_TIMEOUT_SECS: u64 = 600;

/// The client identity BoxAI's desktop authorization endpoints accept for
/// Connect. The gateway keeps a separate id for BoxAI Desktop so a user can
/// tell the two apart — and revoke them separately — in their session list.
const CLIENT_ID: &str = "boxai-connect";

/// Single on-disk account record under `~/.boxai-connect`.
///
/// Keychain storage was dropped: macOS keyring for a local Tauri binary is
/// flaky (silent NoEntry, no migration path, hard to debug). One file is the
/// whole signed-in state — credentials and account snapshot.
const ACCOUNT_FILE: &str = "gateway-account.json";

/// The single BoxAI origin. Portal and relay share it; the relay lives under
/// `/v1`.
pub(crate) fn portal_host() -> String {
    #[cfg(any(debug_assertions, feature = "test-hooks"))]
    let host = std::env::var("BOXAI_CONNECT_HOST").unwrap_or_else(|_| "https://you-box.com".into());
    #[cfg(not(any(debug_assertions, feature = "test-hooks")))]
    let host = "https://you-box.com".to_string();
    host.trim_end_matches('/').into()
}

/// Shared client for bounded JSON API calls; a total timeout keeps commands from hanging forever.
pub(crate) fn http() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()
            .expect("HTTP client")
    })
}

fn account_path() -> PathBuf {
    crate::config::get_app_config_dir().join(ACCOUNT_FILE)
}

/// On-disk signed-in state. One record, one source of truth.
///
/// Two credentials arrive from one exchange and they are not interchangeable:
///
/// - `api_key` is the `sk-` relay key. It never expires, and it is the only
///   thing written into a client's config file or an MCP header.
/// - `access_token` / `refresh_token` are the session. Connect needs them only
///   to revoke the relay key server-side at sign-out; nothing in a client
///   config ever sees them.
#[derive(Debug, Clone, Deserialize, Serialize)]
struct StoredAccount {
    api_key: String,
    #[serde(default)]
    base_url: String,
    #[serde(default)]
    access_token: String,
    #[serde(default)]
    refresh_token: String,
    #[serde(default)]
    account: Option<Account>,
}

fn load_account() -> Option<StoredAccount> {
    let raw = fs::read_to_string(account_path()).ok()?;
    serde_json::from_str::<StoredAccount>(&raw)
        .ok()
        .filter(|stored| !stored.api_key.is_empty())
}

fn save_account(stored: &StoredAccount) -> Result<(), String> {
    let path = account_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create the Connect config directory: {e}"))?;
    }
    let serialized = serde_json::to_string_pretty(stored)
        .map_err(|_| "Could not serialize the account record".to_string())?;
    // Write then chmod so a half-written world-readable file never sticks.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serialized).map_err(|e| format!("Could not write the account record: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Could not restrict the account record: {e}"))?;
    }
    fs::rename(&tmp, &path).map_err(|e| format!("Could not install the account record: {e}"))?;
    Ok(())
}

fn clear_account() {
    let path = account_path();
    match fs::remove_file(&path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => log::warn!("Could not remove the account record: {error}"),
    }
}

fn stored_account() -> Result<StoredAccount, String> {
    load_account().ok_or_else(|| "BoxAI account is not connected".to_string())
}

/// The `sk-` relay key. This is what goes into client config files.
pub(crate) fn api_key() -> Result<String, String> {
    stored_account().map(|stored| stored.api_key)
}

/// The OpenAI-compatible relay base, as the server reported it at sign-in.
pub(crate) fn relay_v1_url() -> String {
    load_account()
        .map(|stored| stored.base_url)
        .filter(|url| !url.is_empty())
        .unwrap_or_else(|| format!("{}/v1", portal_host()))
}

/// The bare relay origin, for clients that append their own API path.
///
/// Claude Code appends `/v1/messages` to `ANTHROPIC_BASE_URL`, so handing it
/// the `/v1` form would produce `/v1/v1/messages`.
pub(crate) fn relay_origin_url() -> String {
    relay_v1_url().trim_end_matches("/v1").to_string()
}

pub(crate) fn is_connected() -> bool {
    load_account().is_some()
}

/// Cache the account snapshot the provisioning call returned, so the account
/// dialog can render an identity without a network round trip on every open.
pub(crate) fn remember_account(account: Option<Account>) {
    let Some(mut stored) = load_account() else {
        return;
    };
    if stored.account == account {
        return;
    }
    stored.account = account;
    if let Err(error) = save_account(&stored) {
        log::warn!("Could not cache the account snapshot: {error}");
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct Account {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub quota: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    connected: bool,
    account: Option<Account>,
    portal_host: String,
    ai_host: String,
    message: Option<String>,
}

impl GatewayStatus {
    fn disconnected(message: Option<String>) -> Self {
        Self {
            connected: false,
            account: None,
            portal_host: portal_host(),
            ai_host: relay_origin_url(),
            message,
        }
    }
    fn connected(account: Option<Account>) -> Self {
        Self {
            connected: true,
            account,
            portal_host: portal_host(),
            ai_host: relay_origin_url(),
            message: None,
        }
    }
}

#[tauri::command]
pub fn gateway_auth_status() -> GatewayStatus {
    match load_account() {
        Some(stored) => GatewayStatus::connected(stored.account),
        None => GatewayStatus::disconnected(None),
    }
}

#[derive(Debug, Deserialize)]
struct AuthorizationRequestCreated {
    id: String,
}

#[derive(Debug, Deserialize)]
struct TokenSuccess {
    #[serde(default)]
    access_token: String,
    #[serde(default)]
    refresh_token: String,
    api_key: String,
    #[serde(default)]
    base_url: String,
}

/// One browser sign-in attempt.
///
/// The verifier never leaves this process and the state never leaves this
/// struct, so a callback that carries neither is not this attempt's callback.
/// The redirect is an ephemeral loopback port, which is the only kind of
/// redirect the gateway will send a code to: an approval cannot travel off the
/// machine that asked for it.
struct BrowserLogin {
    verifier: String,
    state: String,
    redirect_uri: String,
    authorize_url: String,
    listener: tokio::net::TcpListener,
}

#[derive(Debug)]
enum CallbackOutcome {
    Code(String),
    Denied(String),
}

fn pkce_challenge(verifier: &str) -> String {
    use base64::Engine as _;
    use sha2::{Digest, Sha256};
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// Reads a JSON API error into something worth showing a user.
async fn describe_failure(context: &str, response: reqwest::Response) -> String {
    let status = response.status().as_u16();
    let body = response.text().await.unwrap_or_default();
    let detail = serde_json::from_str::<serde_json::Value>(&body)
        .ok()
        .and_then(|value| {
            value["error_description"]
                .as_str()
                .or_else(|| value["message"].as_str())
                .or_else(|| value["error"].as_str())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| body.chars().take(200).collect());
    if detail.is_empty() {
        format!("{context} (HTTP {status})")
    } else {
        format!("{context}: {detail}")
    }
}

/// Registers the sign-in with the gateway, then builds the browser URL.
///
/// BoxAI creates the authorization record before the browser is opened, so the
/// page the user lands on carries only an opaque request id — no challenge, no
/// redirect, nothing an onlooker could replay elsewhere.
async fn start_browser_login() -> Result<BrowserLogin, String> {
    let verifier = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let state = uuid::Uuid::new_v4().simple().to_string();
    let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(|e| format!("Could not open the local sign-in callback: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Could not open the local sign-in callback: {e}"))?
        .port();
    // The gateway accepts exactly this path on 127.0.0.1 and nothing else.
    let redirect_uri = format!("http://127.0.0.1:{port}/auth/callback");

    let device_name = crate::services::sync_protocol::detect_system_device_name()
        .unwrap_or_else(|| "this computer".into());
    // Always send a name. Left blank, the gateway falls back to the operator's
    // configured desktop token name, and every Connect sign-in would show up in
    // the user's session list under BoxAI Desktop's name.
    let client_name = format!("BoxAI Connect · {device_name}");

    let response = http()
        .post(format!(
            "{}/api/desktop/authorization-requests",
            portal_host()
        ))
        .json(&serde_json::json!({
            "client_id": CLIENT_ID,
            "redirect_uri": redirect_uri,
            "code_challenge": pkce_challenge(&verifier),
            "code_challenge_method": "S256",
            "state": state,
            "client_name": client_name,
        }))
        .send()
        .await
        .map_err(|e| format!("BoxAI sign-in is unavailable: {e}"))?;
    if !response.status().is_success() {
        return Err(describe_failure("BoxAI rejected this sign-in", response).await);
    }
    let created: AuthorizationRequestCreated = response
        .json()
        .await
        .map_err(|e| format!("BoxAI returned an unsupported sign-in response: {e}"))?;

    let mut authorize_url = reqwest::Url::parse(&format!("{}/desktop/authorize", portal_host()))
        .map_err(|_| "Invalid configured portal origin".to_string())?;
    authorize_url
        .query_pairs_mut()
        .append_pair("request", &created.id);

    Ok(BrowserLogin {
        verifier,
        state,
        redirect_uri,
        authorize_url: authorize_url.to_string(),
        listener,
    })
}

fn callback_page(headline: &str) -> String {
    format!(
        "<!doctype html><meta charset=\"utf-8\"><title>BoxAI Connect</title>\
<body style=\"font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#f6f7f9;color:#16181d\">\
<main style=\"text-align:center\"><h1 style=\"font-size:18px\">{headline}</h1>\
<p style=\"font-size:13px;opacity:.7\">You can close this tab.</p></main>"
    )
}

/// Serves the loopback callback until the browser delivers this attempt's
/// outcome, then shuts the listener down. A callback carrying someone else's
/// state is answered and ignored rather than accepted.
async fn await_callback(
    listener: tokio::net::TcpListener,
    expected_state: String,
    timeout: Duration,
) -> Result<CallbackOutcome, String> {
    use axum::{extract::Query, response::Html, routing::get, Router};
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::{mpsc, oneshot, Mutex as AsyncMutex};

    let (sender, mut receiver) = mpsc::channel::<CallbackOutcome>(1);
    let sender = Arc::new(AsyncMutex::new(Some(sender)));
    let app = Router::new().route(
        "/auth/callback",
        get(move |Query(params): Query<HashMap<String, String>>| {
            let expected_state = expected_state.clone();
            let sender = sender.clone();
            async move {
                if params.get("state").map(String::as_str) != Some(expected_state.as_str()) {
                    return Html(callback_page("This sign-in link is not for this window."));
                }
                let outcome = match (params.get("code"), params.get("error")) {
                    (Some(code), _) if !code.is_empty() => CallbackOutcome::Code(code.clone()),
                    (_, Some(error)) => CallbackOutcome::Denied(error.clone()),
                    _ => CallbackOutcome::Denied("invalid_request".into()),
                };
                let denied = matches!(outcome, CallbackOutcome::Denied(_));
                if let Some(sender) = sender.lock().await.take() {
                    let _ = sender.send(outcome).await;
                }
                Html(callback_page(if denied {
                    "Sign-in was not completed."
                } else {
                    "Signed in. Return to BoxAI Connect."
                }))
            }
        }),
    );

    let (shutdown, shutdown_signal) = oneshot::channel::<()>();
    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_signal.await;
            })
            .await
    });

    let received = tokio::time::timeout(timeout, receiver.recv()).await;
    // Graceful shutdown lets the browser finish reading the page it was just
    // served; without it the tab would end on a connection reset.
    let _ = shutdown.send(());
    let _ = server.await;

    match received {
        Ok(Some(outcome)) => Ok(outcome),
        Ok(None) => Err("The sign-in callback closed before the browser answered".into()),
        Err(_) => Err("Sign-in timed out. Try again.".into()),
    }
}

/// Signs in through the system browser.
///
/// Everything secret stays in Rust: the renderer starts this, sees a window
/// open, and gets back only the resulting account state.
#[tauri::command]
pub async fn gateway_browser_login(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::store::AppState>,
) -> Result<GatewayStatus, String> {
    let login = match start_browser_login().await {
        Ok(login) => login,
        Err(message) => return Ok(GatewayStatus::disconnected(Some(message))),
    };
    open_portal_url(&app, &login.authorize_url)?;

    let outcome = match await_callback(
        login.listener,
        login.state,
        Duration::from_secs(BROWSER_LOGIN_TIMEOUT_SECS),
    )
    .await
    {
        Ok(outcome) => outcome,
        Err(message) => return Ok(GatewayStatus::disconnected(Some(message))),
    };
    let code = match outcome {
        CallbackOutcome::Code(code) => code,
        CallbackOutcome::Denied(error) => {
            return Ok(GatewayStatus::disconnected(Some(match error.as_str() {
                "access_denied" => "Sign-in was declined".into(),
                other => format!("Sign-in failed: {other}"),
            })))
        }
    };

    let response = http()
        .post(format!("{}/api/desktop/token", portal_host()))
        .json(&serde_json::json!({
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": login.verifier,
            "client_id": CLIENT_ID,
            "redirect_uri": login.redirect_uri,
        }))
        .send()
        .await
        .map_err(|e| format!("BoxAI sign-in is unavailable: {e}"))?;
    if !response.status().is_success() {
        return Ok(GatewayStatus::disconnected(Some(
            describe_failure("BoxAI rejected this sign-in", response).await,
        )));
    }
    let success: TokenSuccess = response
        .json()
        .await
        .map_err(|e| format!("BoxAI returned an unsupported sign-in response: {e}"))?;

    let stored = StoredAccount {
        api_key: success.api_key,
        base_url: success.base_url,
        access_token: success.access_token,
        refresh_token: success.refresh_token,
        account: None,
    };
    save_account(&stored)?;
    log::info!("✓ BoxAI account connected");
    refresh_seeds(&app, &state).await;
    Ok(GatewayStatus::connected(
        load_account().and_then(|stored| stored.account),
    ))
}

/// Bring every account-scoped surface in line with the stored credential.
///
/// The same call serves sign-in, sign-out and startup, because each seed
/// installs or withdraws itself based on whether an account is connected. Doing
/// it in one place is what keeps a signed-out install from keeping a provider
/// or an MCP server that no longer resolves.
pub(crate) async fn reconcile_account_surface(
    app: &tauri::AppHandle,
    state: &crate::store::AppState,
) {
    refresh_seeds(app, state).await;
}

async fn refresh_seeds(app: &tauri::AppHandle, state: &crate::store::AppState) {
    let connected = is_connected();
    let providers = super::provider_seed::sync_all(state).await;
    match super::mcp_seed::sync(state) {
        Ok(()) => log::info!("✓ BoxAI MCP seeds reconciled (connected={connected})"),
        Err(error) => log::warn!("Could not refresh BoxAI MCP servers: {error}"),
    }
    if providers > 0 {
        log::info!("✓ Seeded {providers} BoxAI provider(s)");
    } else if connected {
        log::warn!("BoxAI providers were not seeded while signed in; check provisioning");
    }
    // Startup seed is async relative to the first React Query fetch. Without
    // this, a signed-in cold start can paint empty provider/MCP panels and
    // never re-read the database after reconcile finishes.
    use tauri::Emitter;
    if let Err(error) = app.emit("boxai-account-surface-updated", ()) {
        log::warn!("Could not notify the UI that account surface changed: {error}");
    }
}

/// True only for URLs on the configured portal origin, so neither a compromised
/// renderer nor a redirected sign-in can use Connect as a generic opener.
fn is_portal_url(url: &str, portal: &str) -> bool {
    let (Ok(parsed), Ok(allowed)) = (reqwest::Url::parse(url), reqwest::Url::parse(portal)) else {
        return false;
    };
    parsed.scheme() == allowed.scheme()
        && parsed.host_str() == allowed.host_str()
        && parsed.port_or_known_default() == allowed.port_or_known_default()
}

fn open_portal_url(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    if !is_portal_url(url, &portal_host()) {
        return Err("Only BoxAI links may be opened".into());
    }
    app.opener()
        .open_url(url.to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Opens a link in the system browser only when it points at the configured
/// portal origin.
#[tauri::command]
pub fn boxai_open_portal(app: tauri::AppHandle, url: String) -> Result<(), String> {
    open_portal_url(&app, &url)
}

#[tauri::command]
pub async fn gateway_logout(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::store::AppState>,
) -> Result<(), String> {
    // Revoke first. The relay key Connect wrote into real client config files
    // outlives this process, so a purely local sign-out would leave a live key
    // behind. Best-effort: a machine that is offline must still be able to sign
    // out locally.
    if let Some(refresh_token) = load_account()
        .map(|stored| stored.refresh_token)
        .filter(|token| !token.is_empty())
    {
        match http()
            .post(format!("{}/api/desktop/revoke", portal_host()))
            .json(&serde_json::json!({ "refresh_token": refresh_token }))
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                log::info!("✓ BoxAI session revoked")
            }
            Ok(response) => log::warn!(
                "BoxAI did not revoke this session (HTTP {}); revoke it from the website",
                response.status().as_u16()
            ),
            Err(error) => log::warn!("Could not reach BoxAI to revoke this session: {error}"),
        }
    }

    clear_account();
    // Withdraw everything the account authorized. The seeds are removed rather
    // than rewritten: a signed-out install must not leave a provider or MCP
    // server behind with a revoked account key.
    refresh_seeds(&app, &state).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_challenge_matches_the_rfc_vector() {
        assert_eq!(
            pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    /// The gateway rejects a challenge that is not exactly 43 characters and a
    /// state outside 22..=128, with a bare `400 invalid_request` that says
    /// nothing about which field was wrong.
    #[test]
    fn generated_pkce_values_satisfy_the_gateway_bounds() {
        let verifier = format!(
            "{}{}",
            uuid::Uuid::new_v4().simple(),
            uuid::Uuid::new_v4().simple()
        );
        let state = uuid::Uuid::new_v4().simple().to_string();
        assert_eq!(pkce_challenge(&verifier).len(), 43);
        assert!((43..=128).contains(&verifier.len()));
        assert!((22..=128).contains(&state.len()));
    }

    #[test]
    fn the_relay_origin_drops_the_version_segment() {
        // Claude Code appends /v1/messages itself; handing it the /v1 form
        // produces /v1/v1/messages and every request 404s.
        assert_eq!(
            "https://you-box.com/v1".trim_end_matches("/v1"),
            "https://you-box.com"
        );
    }

    #[test]
    fn only_portal_links_may_be_opened() {
        let portal = "https://you-box.com";
        assert!(is_portal_url(
            "https://you-box.com/desktop/authorize",
            portal
        ));
        assert!(!is_portal_url("https://you-box.com.evil.test/x", portal));
        assert!(!is_portal_url("http://you-box.com/x", portal));
    }
}
