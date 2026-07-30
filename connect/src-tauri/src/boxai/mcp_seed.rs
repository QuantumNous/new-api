//! Built-in BoxAI MCP servers.
//!
//! BoxAI does not operate an MCP service yet, so the official list is empty and
//! Connect seeds nothing. The machinery is kept whole rather than deleted: when
//! BoxAI ships an MCP endpoint, filling in `definitions()` and `ALL_SERVER_IDS`
//! is a data edit, and the install-on-sign-in / withdraw-on-sign-out behaviour
//! that has to be right is already here.
//!
//! Users can still add their own MCP servers — upstream's MCP panel is
//! untouched. Only the *seeded* set is empty.

use crate::app_config::{McpApps, McpServer};
use crate::error::AppError;
use crate::services::mcp::McpService;
use crate::store::AppState;

use super::provider_seed::SUPPORTED_APPS;

/// Ids Connect owns. Anything listed here is withdrawn on sign-out, so an id
/// must never be removed from this list without also being removed from every
/// client that ever received it.
const ALL_SERVER_IDS: [&str; 0] = [];

#[allow(dead_code)]
fn seeded_apps() -> McpApps {
    let mut apps = McpApps::default();
    for app in SUPPORTED_APPS {
        apps.set_enabled_for(&app, true);
    }
    apps
}

/// The MCP servers a signed-in account should have. Empty until BoxAI operates
/// one; `secret` is the account's relay key, which each entry would carry as
/// its `Authorization` header.
fn definitions(_secret: &str) -> [McpServer; 0] {
    []
}

fn upsert_if_changed(state: &AppState, desired: McpServer) -> Result<(), AppError> {
    let id = desired.id.clone();
    let unchanged = state
        .db
        .get_all_mcp_servers()?
        .get(&id)
        .is_some_and(|existing| existing.server == desired.server && existing.apps == desired.apps);
    if unchanged {
        return Ok(());
    }
    McpService::upsert_server(state, desired)
}

/// Create or refresh every BoxAI MCP server and push them into the live
/// configuration of every enabled client. Signed out: withdraw them all.
pub fn sync(state: &AppState) -> Result<(), AppError> {
    if !super::gateway_auth::is_connected() {
        // Signed out: withdraw account-authorized entries.
        for id in ALL_SERVER_IDS {
            McpService::delete_server(state, id)?;
        }
        return Ok(());
    }
    let secret = match super::gateway_auth::api_key() {
        Ok(secret) => secret,
        Err(error) => {
            log::warn!("BoxAI MCP seed skipped: {error}");
            return Ok(());
        }
    };

    for desired in definitions(&secret) {
        upsert_if_changed(state, desired)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A signed-out install must withdraw exactly what a signed-in one seeds.
    /// With no official servers both sides are empty, and this is the assertion
    /// that will fail loudly if someone adds a definition without adding its id.
    #[test]
    fn every_seeded_server_is_also_withdrawn_on_sign_out() {
        let seeded: Vec<String> = definitions("sk-user")
            .into_iter()
            .map(|server| server.id)
            .collect();
        let withdrawn: Vec<String> = ALL_SERVER_IDS.iter().map(|id| id.to_string()).collect();
        assert_eq!(seeded, withdrawn);
    }
}
