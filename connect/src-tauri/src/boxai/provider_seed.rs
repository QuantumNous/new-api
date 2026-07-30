//! The built-in BoxAI provider.
//!
//! Every supported client gets exactly one BoxAI entry whose endpoint and
//! user-owned account key point directly at BoxAI.
//!
//! Nothing is seeded while signed out. The entry is created when an account
//! connects and removed when it disconnects, so the panel never offers a
//! provider whose requests the Gateway would reject.
//!
//! Which models an entry may use is the gateway's answer for that account, not
//! a guess compiled into Connect.

use crate::app_config::AppType;
use crate::database::Database;
use crate::error::AppError;
use crate::provider::Provider;
use serde_json::{json, Value};

pub const PROVIDER_NAME: &str = "BoxAI";
pub const WEBSITE_URL: &str = "https://you-box.com";

/// Clients that can be projected at BoxAI.
///
/// Every upstream client is here except Claude Desktop, which has no chat
/// provider to point anywhere: upstream manages it through a profile library
/// and Connect's own local proxy against a fixed table of Anthropic route ids.
/// It stays visible and detectable in the panel; it is simply never seeded.
pub const SUPPORTED_APPS: [AppType; 7] = [
    AppType::Claude,
    AppType::Codex,
    AppType::Gemini,
    AppType::GrokBuild,
    AppType::OpenCode,
    AppType::OpenClaw,
    AppType::Hermes,
];

pub fn provider_id(app: &AppType) -> String {
    format!("boxai-{}", app.as_str())
}

fn model_setting_key(app: &AppType) -> String {
    format!("boxai_model_{}", app.as_str())
}

/// The model the user picked for a client, if any.
///
/// There is deliberately no compiled-in fallback: Connect cannot know which
/// models an account may use, and naming one it cannot reach produces a client
/// that fails on its first request.
pub fn selected_model(db: &Database, app: &AppType) -> Option<String> {
    db.get_setting(&model_setting_key(app))
        .ok()
        .flatten()
        .filter(|value| !value.trim().is_empty())
}

pub fn set_selected_model(db: &Database, app: &AppType, model: &str) -> Result<(), AppError> {
    db.set_setting(&model_setting_key(app), model)
}

fn toml_string(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| format!("\"{value}\""))
}

/// Codex-style TOML carrier. Grok Build reuses the same shape upstream: its
/// form only reads back `base_url` / `model` / `wire_api`.
fn codex_style_config(model: &str, base_url: &str) -> String {
    format!(
        "model_provider = \"boxai\"\n\
         model = {model}\n\
         model_reasoning_effort = \"high\"\n\
         disable_response_storage = true\n\
         \n\
         [model_providers.boxai]\n\
         name = {name}\n\
         base_url = {base_url}\n\
         wire_api = \"responses\"\n\
         requires_openai_auth = true",
        model = toml_string(model),
        name = toml_string(PROVIDER_NAME),
        base_url = toml_string(&format!("{base_url}/v1")),
    )
}

/// The settings payload upstream writes into a client's live config when this
/// provider is activated. Shapes mirror `src/config/*ProviderPresets.ts`.
pub fn settings_config(app: &AppType, secret: &str, model: &str) -> Value {
    // Claude Code appends `/v1/messages` itself, so it gets the bare origin;
    // the OpenAI-compatible clients get the `/v1` form the gateway reported.
    let base = super::gateway_auth::relay_origin_url();
    let v1 = super::gateway_auth::relay_v1_url();
    match app {
        AppType::Claude => json!({
            "env": {
                "ANTHROPIC_BASE_URL": base,
                "ANTHROPIC_AUTH_TOKEN": secret,
                "ANTHROPIC_MODEL": model,
            }
        }),
        AppType::Codex | AppType::GrokBuild => json!({
            "auth": { "OPENAI_API_KEY": secret },
            "config": codex_style_config(model, &base),
        }),
        AppType::Gemini => json!({
            "env": {
                "GOOGLE_GEMINI_BASE_URL": base,
                "GEMINI_API_KEY": secret,
                "GEMINI_MODEL": model,
            },
            "config": {}
        }),
        AppType::OpenCode => json!({
            "npm": "@ai-sdk/openai-compatible",
            "name": PROVIDER_NAME,
            "options": { "baseURL": v1, "apiKey": secret },
            "models": { model: { "name": model } },
        }),
        // Deserialized into `OpenClawProviderConfig`, which is camelCase.
        AppType::OpenClaw => json!({
            "baseUrl": v1,
            "apiKey": secret,
            "api": "openai-completions",
            "models": [{ "id": model, "name": model }],
        }),
        // Written into `custom_providers:`; upstream normalizes camelCase to
        // snake_case, but writing the YAML shape directly keeps the stored
        // value and the live file identical. `api_mode` must be set: the BoxAI
        // relay speaks OpenAI chat completions under /v1.
        AppType::Hermes => json!({
            "name": provider_id(app),
            "base_url": v1,
            "api_key": secret,
            "api_mode": "chat_completions",
            "models": [{ "id": model, "name": model }],
        }),
        // Detection only; never seeded. See SUPPORTED_APPS.
        AppType::ClaudeDesktop => json!({}),
    }
}

fn next_sort_index(db: &Database, app_type: &str) -> usize {
    db.get_all_providers(app_type)
        .map(|providers| providers.len())
        .unwrap_or(0)
}

/// Create or refresh the BoxAI provider for one client.
///
/// `save_provider` is an UPSERT that preserves `is_current`, so refreshing a
/// rotated secret never silently deactivates the user's selection.
pub fn upsert_for(
    db: &Database,
    app: &AppType,
    secret: &str,
    model: &str,
) -> Result<bool, AppError> {
    let app_type = app.as_str();
    let id = provider_id(app);
    let desired = settings_config(app, secret, model);

    let existing = db.get_provider_by_id(&id, app_type)?;
    if let Some(current) = &existing {
        if current.settings_config == desired {
            return Ok(false);
        }
    }

    let mut provider = Provider::with_id(
        id,
        PROVIDER_NAME.to_string(),
        desired,
        Some(WEBSITE_URL.to_string()),
    );
    // Not "official": upstream reads that category as "an official OAuth login
    // with no base_url a local proxy could take over" and badges the card
    // "no routing support". This provider is a relayed endpoint.
    provider.category = Some("third_party".to_string());
    provider.icon = Some("openai".to_string());
    provider.icon_color = Some("#6575ff".to_string());
    provider.sort_index = existing
        .as_ref()
        .and_then(|p| p.sort_index)
        .or_else(|| Some(next_sort_index(db, app_type)));
    provider.created_at = existing
        .as_ref()
        .and_then(|p| p.created_at)
        .or_else(|| Some(chrono::Utc::now().timestamp_millis()));

    db.save_provider(app_type, &provider)?;
    Ok(true)
}

/// Remove the BoxAI provider from every client.
///
/// Used when the account disconnects: leaving the entry behind would leave a
/// provider the user can still select and that can no longer work.
pub fn remove_all(db: &Database) {
    for app in SUPPORTED_APPS {
        if let Err(error) = db.delete_provider(app.as_str(), &provider_id(&app)) {
            log::warn!(
                "✗ Failed to remove the BoxAI provider for {}: {error}",
                app.as_str()
            );
        }
    }
}

/// The account-scoped configuration BoxAI issues after sign-in.
///
/// Connect owns none of it. Which models exist is per-account, and which one a
/// fresh install should select is an operator decision, so both answers arrive
/// from the server rather than being decided by the desktop build.
#[derive(Debug, Default, PartialEq)]
pub struct Provisioning {
    pub chat_models: Vec<String>,
    pub default_model: Option<String>,
    pub account: Option<super::gateway_auth::Account>,
}

pub fn parse_provisioning(body: &Value) -> Provisioning {
    let data = &body["data"];
    Provisioning {
        chat_models: data["chat_models"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|model| model.as_str().map(str::to_owned))
            .collect(),
        default_model: data["default_model"]
            .as_str()
            .filter(|model| !model.is_empty())
            .map(str::to_owned),
        account: serde_json::from_value(data["account"].clone()).ok(),
    }
}

async fn fetch_provisioning() -> Result<Provisioning, String> {
    let token = super::gateway_auth::api_key()?;
    let response = super::gateway_auth::http()
        .get(format!(
            "{}/api/connect/provisioning",
            super::gateway_auth::portal_host()
        ))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| format!("BoxAI is unavailable: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(200).collect();
        return Err(format!(
            "BoxAI provisioning returned HTTP {}{}",
            status.as_u16(),
            if snippet.is_empty() {
                String::new()
            } else {
                format!(": {snippet}")
            }
        ));
    }
    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("BoxAI returned an unsupported provisioning response: {e}"))?;
    Ok(parse_provisioning(&body))
}

/// Create the BoxAI provider for every supported client, using the model
/// catalog BoxAI reports for this account.
///
/// Does nothing while signed out, and removes any existing entries: an account
/// that is not connected must not leave behind a provider that authorizes
/// nothing.
pub async fn sync_all(state: &crate::store::AppState) -> usize {
    let db = &state.db;
    if !super::gateway_auth::is_connected() {
        remove_all(db);
        return 0;
    }
    let secret = match super::gateway_auth::api_key() {
        Ok(secret) => secret,
        Err(error) => {
            log::warn!("BoxAI provider seed skipped: {error}");
            return 0;
        }
    };
    let provisioning = match fetch_provisioning().await {
        Ok(provisioning) => provisioning,
        Err(error) => {
            log::warn!("BoxAI provider seed skipped, provisioning unavailable: {error}");
            return 0;
        }
    };
    // The same call that answers "which models" also answers "who is this",
    // so the account dialog can render an identity without its own request.
    super::gateway_auth::remember_account(provisioning.account.clone());
    let Some(fallback) = provisioning
        .default_model
        .clone()
        .or_else(|| provisioning.chat_models.first().cloned())
    else {
        log::warn!("BoxAI offers this account no chat models; provider not seeded");
        return 0;
    };

    let mut changed = 0;
    for app in SUPPORTED_APPS {
        // Keep the user's pick only while the account can still use it.
        let model = selected_model(db, &app)
            .filter(|model| provisioning.chat_models.contains(model))
            .unwrap_or_else(|| fallback.clone());
        if let Err(error) = set_selected_model(db, &app, &model) {
            log::warn!("✗ Failed to record the model for {}: {error}", app.as_str());
        }
        let reconciled = match upsert_for(db, &app, &secret, &model) {
            Ok(true) => {
                changed += 1;
                log::info!("✓ Reconciled BoxAI provider for {}", app.as_str());
                true
            }
            Ok(false) => true,
            Err(error) => {
                log::warn!(
                    "✗ Failed to seed BoxAI provider for {}: {error}",
                    app.as_str()
                );
                false
            }
        };
        // The database may already contain the direct provider while a live
        // client config still carries a stale entry from an earlier install.
        // Re-project the active entry on startup even when the DB row itself
        // did not change.
        let id = provider_id(&app);
        if reconciled
            && crate::services::provider::ProviderService::current(state, app.clone())
                .is_ok_and(|current| current == id)
        {
            if let Err(error) =
                crate::services::provider::ProviderService::switch(state, app.clone(), &id)
            {
                log::warn!(
                    "✗ Failed to refresh active BoxAI provider for {}: {error}",
                    app.as_str()
                );
            }
        }
    }
    changed
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientModel {
    app: String,
    selected: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProfiles {
    available: Vec<String>,
    clients: Vec<ClientModel>,
}

/// What the account may run, and what each client is currently set to.
///
/// One call rather than one per client: the catalog is account-scoped, so
/// asking the Gateway once per client would repeat the same answer.
#[tauri::command]
pub async fn boxai_model_profiles(
    state: tauri::State<'_, crate::store::AppState>,
) -> Result<ModelProfiles, String> {
    let provisioning = fetch_provisioning().await?;
    let clients = SUPPORTED_APPS
        .iter()
        .map(|app| ClientModel {
            app: app.as_str().to_string(),
            selected: selected_model(&state.db, app).or_else(|| provisioning.default_model.clone()),
        })
        .collect();
    Ok(ModelProfiles {
        available: provisioning.chat_models,
        clients,
    })
}

/// Pick the model a client uses through BoxAI, and push it through to the
/// live config when the BoxAI provider is the active one.
#[tauri::command]
pub async fn boxai_model_select(
    state: tauri::State<'_, crate::store::AppState>,
    app: AppType,
    model: String,
) -> Result<(), String> {
    if !SUPPORTED_APPS.contains(&app) {
        return Err(format!(
            "{} is not a client BoxAI Connect manages",
            app.as_str()
        ));
    }
    // Validate against the Gateway rather than trusting the renderer: a model
    // this account cannot use would be written into a real client config file.
    if !fetch_provisioning().await?.chat_models.contains(&model) {
        return Err(format!("BoxAI does not offer {model} to this account"));
    }
    set_selected_model(&state.db, &app, &model).map_err(|e| e.to_string())?;

    let secret = super::gateway_auth::api_key()?;
    upsert_for(&state.db, &app, &secret, &model).map_err(|e| e.to_string())?;

    let id = provider_id(&app);
    let is_active = crate::services::provider::ProviderService::current(&state, app.clone())
        .map(|current| current == id)
        .unwrap_or(false);
    if is_active {
        crate::services::provider::ProviderService::switch(&state, app, &id)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Shaped after a real `GET /api/connect/provisioning` response.
    fn provisioning_response() -> Value {
        json!({"success": true, "data": {
            "chat_models": ["deepseek-v4-pro", "gpt-5.6-sol", "kimi-k2.7-code"],
            "default_model": "gpt-5.6-sol",
            "account": {
                "id": 7,
                "username": "ada",
                "display_name": "Ada",
                "email": "ada@example.com",
                "quota": 12345,
            },
        }})
    }

    #[test]
    fn the_model_catalog_comes_from_the_server() {
        let parsed = parse_provisioning(&provisioning_response());
        assert_eq!(
            parsed.chat_models,
            ["deepseek-v4-pro", "gpt-5.6-sol", "kimi-k2.7-code"]
        );
        assert_eq!(parsed.default_model.as_deref(), Some("gpt-5.6-sol"));
    }

    #[test]
    fn the_same_call_carries_the_account_identity() {
        // One request answers both "which models" and "who is this", so the
        // account dialog never needs a second round trip.
        let account = parse_provisioning(&provisioning_response())
            .account
            .expect("account");
        assert_eq!(account.id, 7);
        assert_eq!(account.username, "ada");
        assert_eq!(account.quota, 12345);
    }

    #[test]
    fn an_account_with_no_chat_models_yields_no_default() {
        // Connect must not substitute a model name of its own here.
        let parsed = parse_provisioning(&json!({
            "data": {"chat_models": [], "default_model": ""}
        }));
        assert!(parsed.chat_models.is_empty());
        assert_eq!(parsed.default_model, None);
    }

    #[test]
    fn a_malformed_response_yields_nothing_rather_than_a_guess() {
        assert_eq!(parse_provisioning(&json!({})), Provisioning::default());
    }

    #[test]
    fn every_supported_client_points_at_the_gateway_with_the_user_key() {
        for app in SUPPORTED_APPS {
            let rendered = settings_config(&app, "sk-user", "some-model").to_string();
            assert!(
                rendered.contains("you-box.com"),
                "{} must target BoxAI: {rendered}",
                app.as_str()
            );
            assert!(
                rendered.contains("sk-user"),
                "{} must carry the user's account key: {rendered}",
                app.as_str()
            );
            assert!(
                rendered.contains("some-model"),
                "{} must carry the selected model: {rendered}",
                app.as_str()
            );
        }
    }

    /// Claude Code appends `/v1/messages` to ANTHROPIC_BASE_URL. Handing it the
    /// `/v1` form yields `/v1/v1/messages` and every request 404s, while the
    /// OpenAI-compatible clients need exactly the `/v1` form.
    #[test]
    fn claude_gets_the_bare_origin_and_the_openai_clients_get_v1() {
        let claude = settings_config(&AppType::Claude, "sk-user", "m");
        assert_eq!(
            claude["env"]["ANTHROPIC_BASE_URL"].as_str(),
            Some("https://you-box.com")
        );

        let opencode = settings_config(&AppType::OpenCode, "sk-user", "m");
        assert_eq!(
            opencode["options"]["baseURL"].as_str(),
            Some("https://you-box.com/v1")
        );
        let openclaw = settings_config(&AppType::OpenClaw, "sk-user", "m");
        assert_eq!(openclaw["baseUrl"].as_str(), Some("https://you-box.com/v1"));
        let hermes = settings_config(&AppType::Hermes, "sk-user", "m");
        assert_eq!(hermes["base_url"].as_str(), Some("https://you-box.com/v1"));
    }

    /// OpenClaw and Hermes each deserialize this payload into their own typed
    /// config before it reaches the user's real file, so the key casing is a
    /// contract, not a style choice.
    #[test]
    fn additive_clients_use_the_key_names_their_own_writers_expect() {
        let openclaw = settings_config(&AppType::OpenClaw, "sk-user", "m");
        assert_eq!(openclaw["apiKey"].as_str(), Some("sk-user"));
        assert_eq!(openclaw["models"][0]["id"].as_str(), Some("m"));

        let hermes = settings_config(&AppType::Hermes, "sk-user", "m");
        assert_eq!(hermes["api_key"].as_str(), Some("sk-user"));
        // Without api_mode Hermes cannot tell which wire format to speak.
        assert_eq!(hermes["api_mode"].as_str(), Some("chat_completions"));
        assert_eq!(hermes["models"][0]["id"].as_str(), Some("m"));
    }

    #[test]
    fn claude_desktop_renders_nothing_to_project() {
        // It has no chat provider concept: upstream drives it through a profile
        // library and the local proxy instead.
        assert_eq!(
            settings_config(&AppType::ClaudeDesktop, "sk-user", "m"),
            json!({})
        );
        assert!(!SUPPORTED_APPS.contains(&AppType::ClaudeDesktop));
    }

    #[test]
    fn provider_ids_are_namespaced_per_client() {
        assert_eq!(provider_id(&AppType::Claude), "boxai-claude");
        assert_eq!(provider_id(&AppType::OpenCode), "boxai-opencode");
    }

    #[test]
    fn codex_carrier_is_parseable_toml_naming_the_boxai_provider() {
        let config = codex_style_config("gpt-5.5", "https://you-box.com");
        let document: toml_edit::DocumentMut = config.parse().expect("valid TOML");
        assert_eq!(
            document["model_provider"].as_str(),
            Some("boxai"),
            "{config}"
        );
        assert_eq!(document["model"].as_str(), Some("gpt-5.5"));
        assert_eq!(
            document["model_providers"]["boxai"]["base_url"].as_str(),
            Some("https://you-box.com/v1")
        );
    }
}
