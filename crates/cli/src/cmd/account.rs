//! `account` command — self-service profile, password, 2FA, OAuth, topup,
//! PAT, redeem, and affiliate for the calling user.
//!
//! All paths are scoped to `/api/user/self/*`, `/api/user/models`,
//! `/api/user/token`, `/api/user/topup/*`, and `/api/user/aff*`.
//! The admin `/api/user/:id` surface is unreachable from this command.
//! Payment amount, payment URL, OAuth, WebAuthn/passkey, email/WeChat/
//! Telegram browser binding, and login session UI are explicitly excluded.

use anyhow::{bail, Result};
use clap::Subcommand;
use serde_json::Value;

use crate::client::ApiClient;
use crate::json_input::read_json_arg;
use crate::output::print_json;

const SELF: &str = "/api/user/self";
const TOPUP_INFO: &str = "/api/user/topup/info";
const TOPUP: &str = "/api/user/topup";
const TOPUP_HISTORY: &str = "/api/user/topup/self";
const TOKEN_PAT: &str = "/api/user/token";
const AFF: &str = "/api/user/aff";
const AFF_TRANSFER: &str = "/api/user/aff_transfer";
const MODELS: &str = "/api/user/models";

#[derive(Subcommand)]
pub enum AccountCommand {
    /// GET /api/user/self — caller profile
    Show,
    /// PUT /api/user/self — update display_name, email, etc.
    /// Sensitive fields (password, OAuth credentials) only flow through
    /// their dedicated subcommands.
    Update { json: String },
    /// DELETE /api/user/self (requires --yes)
    Delete {
        #[arg(long)]
        yes: bool,
    },
    /// GET /api/user/self/groups — groups visible to the caller
    Groups,
    /// GET /api/user/models — models the caller can access
    Models,
    /// POST /api/user/self/change_password — body {old_password,new_password}
    ChangePassword { json: String },
    /// POST /api/user/self/2fa/setup — start 2FA enrolment
    Setup2fa,
    /// POST /api/user/self/2fa (requires --yes to commit)
    Enable2fa {
        json: String,
        #[arg(long)]
        yes: bool,
    },
    /// DELETE /api/user/self/2fa (requires --yes)
    Disable2fa {
        #[arg(long)]
        yes: bool,
    },
    /// GET /api/user/self/oauth — list OAuth bindings
    Oauth,
    /// POST /api/user/self/oauth — body {provider, code, redirect_uri, state}
    LinkOauth { json: String },
    /// DELETE /api/user/self/oauth/:provider (requires --yes)
    UnlinkOauth {
        provider: String,
        #[arg(long)]
        yes: bool,
    },
    /// GET /api/user/topup/info — payment methods + topup info
    TopupInfo,
    /// POST /api/user/topup — body {amount, payment_method, redemption_code?}
    Redeem { json: String },
    /// GET /api/user/topup/self?p=&page_size=
    TopupHistory {
        #[arg(long)]
        p: Option<u32>,
        #[arg(long)]
        page_size: Option<u32>,
    },
    /// POST /api/user/topup — body {amount, payment_method}
    Topup { json: String },
    /// POST /api/user/token — generate a Personal Access Token.
    /// PAT is written to stdout only on this subcommand and never
    /// enters default debug/error output.
    PatGenerate { json: String },
    /// GET /api/user/aff — affiliate summary
    AffiliateShow,
    /// POST /api/user/aff_transfer (requires --yes) — body {to_user_id, amount}
    AffiliateTransfer {
        json: String,
        #[arg(long)]
        yes: bool,
    },
}

pub fn run(client: &ApiClient, cmd: &AccountCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &AccountCommand) -> Result<Value> {
    match cmd {
        AccountCommand::Show => client.get(SELF, &[]),
        AccountCommand::Update { json } => {
            let body = read_json_arg(json)?;
            client.put_json(SELF, &body)
        }
        AccountCommand::Delete { yes } => {
            require_yes(*yes, "account delete")?;
            client.delete(SELF)
        }
        AccountCommand::Groups => client.get(&format!("{}/groups", SELF), &[]),
        AccountCommand::Models => client.get(MODELS, &[]),
        AccountCommand::ChangePassword { json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/change_password", SELF), &body)
        }
        AccountCommand::Setup2fa => client.post_json(
            &format!("{}/2fa/setup", SELF),
            &Value::Object(Default::default()),
        ),
        AccountCommand::Enable2fa { json, yes } => {
            require_yes(*yes, "2fa enable")?;
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/2fa", SELF), &body)
        }
        AccountCommand::Disable2fa { yes } => {
            require_yes(*yes, "2fa disable")?;
            client.delete(&format!("{}/2fa", SELF))
        }
        AccountCommand::Oauth => client.get(&format!("{}/oauth", SELF), &[]),
        AccountCommand::LinkOauth { json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/oauth", SELF), &body)
        }
        AccountCommand::UnlinkOauth { provider, yes } => {
            require_yes(*yes, "oauth unlink")?;
            client.delete(&format!("{}/oauth/{}", SELF, provider))
        }
        AccountCommand::TopupInfo => client.get(TOPUP_INFO, &[]),
        AccountCommand::Redeem { json } => {
            let body = read_json_arg(json)?;
            client.post_json(TOPUP, &body)
        }
        AccountCommand::TopupHistory { p, page_size } => {
            let mut q: Vec<(&str, String)> = Vec::new();
            if let Some(p) = p {
                q.push(("p", p.to_string()));
            }
            if let Some(ps) = page_size {
                q.push(("page_size", ps.to_string()));
            }
            client.get(TOPUP_HISTORY, &q)
        }
        AccountCommand::Topup { json } => {
            let body = read_json_arg(json)?;
            client.post_json(TOPUP, &body)
        }
        AccountCommand::PatGenerate { json } => {
            let body = read_json_arg(json)?;
            client.post_json(TOKEN_PAT, &body)
        }
        AccountCommand::AffiliateShow => client.get(AFF, &[]),
        AccountCommand::AffiliateTransfer { json, yes } => {
            require_yes(*yes, "affiliate transfer")?;
            let body = read_json_arg(json)?;
            client.post_json(AFF_TRANSFER, &body)
        }
    }
}

fn require_yes(yes: bool, op: &str) -> Result<()> {
    if !yes {
        bail!("{op} requires --yes");
    }
    Ok(())
}
