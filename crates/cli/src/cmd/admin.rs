//! `admin` command — user, redemption, subscription, group, permission
//! catalog, and non-pricing option management.
//!
//! Destructive operations require `--yes`. Sensitive option writes
//! (SMTP, OAuth, payment secrets) only flow through `--json`/`@file`.

use anyhow::{bail, Result};
use clap::{Args, Subcommand};
use serde_json::{json, Value};

use crate::client::ApiClient;
use crate::json_input::read_json_arg;
use crate::output::print_json;

const USER: &str = "/api/user";
const REDEMPTION: &str = "/api/redemption";
const SUB_PLAN: &str = "/api/subscription/admin/plans";
const SUB_BIND: &str = "/api/subscription/admin/bind";
const SUB_USER: &str = "/api/subscription/admin/users";
const SUB_USER_SUB: &str = "/api/subscription/admin/user_subscriptions";
const GROUP: &str = "/api/group";
const AUTHZ: &str = "/api/authz/catalog";
const OPTION: &str = "/api/option";

#[derive(Args)]
pub struct UserListArgs {
    #[arg(long)]
    pub p: Option<u32>,
    #[arg(long)]
    pub page_size: Option<u32>,
}

#[derive(Args)]
pub struct UserSearchArgs {
    pub keyword: String,
    #[arg(long)]
    pub group: Option<String>,
    #[arg(long)]
    pub p: Option<u32>,
    #[arg(long)]
    pub page_size: Option<u32>,
}

#[derive(Args)]
pub struct UserDeleteArgs {
    pub id: i32,
    #[arg(long)]
    pub yes: bool,
}

#[derive(Subcommand)]
pub enum UserCommand {
    List(UserListArgs),
    Search(UserSearchArgs),
    Get {
        id: i32,
    },
    Create {
        json: String,
    },
    Update {
        json: String,
    },
    Delete(UserDeleteArgs),
    /// Body must include action (promote|demote|enable|disable|delete|add_quota)
    /// and optional mode (add|subtract|override) + value.
    /// Override and subtract quota modes require --yes because they mutate
    /// the user's balance destructively.
    Manage {
        json: String,
        #[arg(long)]
        yes: bool,
    },
    ResetPasskey {
        id: i32,
    },
    Reset2fa {
        id: i32,
    },
    OauthBindings {
        id: i32,
    },
    /// Clear a binding by binding_type (e.g. wechat, telegram, email).
    ClearBinding {
        id: i32,
        binding_type: String,
    },
}

#[derive(Subcommand)]
pub enum RedemptionCommand {
    List(UserListArgs),
    Search {
        keyword: String,
    },
    Get {
        id: i32,
    },
    Create {
        json: String,
    },
    Update {
        json: String,
    },
    /// Status-only update (server treats status as integer).
    SetStatus {
        id: i32,
        status: i32,
    },
    Delete {
        id: i32,
        #[arg(long)]
        yes: bool,
    },
    DeleteInvalid {
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Args)]
pub struct SubPlanListArgs {
    #[arg(long)]
    pub p: Option<u32>,
    #[arg(long)]
    pub page_size: Option<u32>,
}

#[derive(Subcommand)]
pub enum SubPlanCommand {
    List(SubPlanListArgs),
    Create {
        json: String,
    },
    Update {
        id: i32,
        json: String,
    },
    SetStatus {
        id: i32,
        status: i32,
    },
    Bind {
        json: String,
    },
    Reset {
        id: i32,
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Subcommand)]
pub enum SubUserCommand {
    List {
        id: i32,
    },
    Create {
        id: i32,
        json: String,
    },
    Invalidate {
        id: i32,
        #[arg(long)]
        yes: bool,
    },
    Delete {
        id: i32,
        #[arg(long)]
        yes: bool,
    },
    Reset {
        id: i32,
        json: String,
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Subcommand)]
pub enum SubscriptionCommand {
    #[command(subcommand)]
    Plan(SubPlanCommand),
    #[command(subcommand)]
    User(SubUserCommand),
}

#[derive(Subcommand)]
pub enum SettingCommand {
    Get {
        key: String,
    },
    /// Update a non-pricing option key (e.g. SMTP, OAuth, payment secrets).
    /// Secret keys are never echoed in error or debug output; they only flow
    /// through `--json` / `@file`.
    Set {
        key: String,
        json: String,
    },
}

#[derive(Subcommand)]
pub enum AdminCommand {
    #[command(subcommand)]
    User(UserCommand),
    #[command(subcommand)]
    Redemption(RedemptionCommand),
    #[command(subcommand)]
    Subscription(SubscriptionCommand),
    /// List user groups
    Group,
    /// Permission catalog
    PermissionCatalog,
    /// Non-pricing option settings
    #[command(subcommand)]
    Setting(SettingCommand),
}

pub fn run(client: &ApiClient, cmd: &AdminCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &AdminCommand) -> Result<Value> {
    match cmd {
        AdminCommand::User(u) => dispatch_user(client, u),
        AdminCommand::Redemption(r) => dispatch_redemption(client, r),
        AdminCommand::Subscription(s) => dispatch_subscription(client, s),
        AdminCommand::Group => client.get(GROUP, &[]),
        AdminCommand::PermissionCatalog => client.get(AUTHZ, &[]),
        AdminCommand::Setting(s) => dispatch_setting(client, s),
    }
}

fn page_q(p: Option<u32>, ps: Option<u32>) -> Vec<(&'static str, String)> {
    let mut q = Vec::new();
    if let Some(p) = p {
        q.push(("p", p.to_string()));
    }
    if let Some(ps) = ps {
        q.push(("page_size", ps.to_string()));
    }
    q
}

fn dispatch_user(client: &ApiClient, u: &UserCommand) -> Result<Value> {
    match u {
        UserCommand::List(a) => client.get(USER, &page_q(a.p, a.page_size)),
        UserCommand::Search(a) => {
            let mut q = vec![("keyword", a.keyword.clone())];
            if let Some(g) = &a.group {
                q.push(("group", g.clone()));
            }
            q.extend(page_q(a.p, a.page_size));
            client.get(&format!("{}/search", USER), &q)
        }
        UserCommand::Get { id } => client.get(&format!("{}/{}", USER, id), &[]),
        UserCommand::Create { json } => {
            let body = read_json_arg(json)?;
            client.post_json(USER, &body)
        }
        UserCommand::Update { json } => {
            let body = read_json_arg(json)?;
            client.put_json(USER, &body)
        }
        UserCommand::Delete(args) => {
            require_yes(args.yes, "user delete")?;
            client.delete(&format!("{}/{}", USER, args.id))
        }
        UserCommand::Manage { json, yes } => {
            let body = read_json_arg(json)?;
            // Override and subtract quota modes are destructive (they
            // mutate or reduce the user's balance); require --yes.
            let mode = body.get("mode").and_then(|m| m.as_str()).unwrap_or("");
            if matches!(mode, "override" | "subtract") && !*yes {
                bail!("user manage with mode={mode} requires --yes");
            }
            client.post_json(&format!("{}/manage", USER), &body)
        }
        UserCommand::ResetPasskey { id } => {
            client.delete(&format!("{}/{}/reset_passkey", USER, id))
        }
        UserCommand::Reset2fa { id } => client.delete(&format!("{}/{}/2fa", USER, id)),
        UserCommand::OauthBindings { id } => {
            client.get(&format!("{}/{}/oauth/bindings", USER, id), &[])
        }
        UserCommand::ClearBinding { id, binding_type } => {
            client.delete(&format!("{}/{}/bindings/{}", USER, id, binding_type))
        }
    }
}

fn dispatch_redemption(client: &ApiClient, r: &RedemptionCommand) -> Result<Value> {
    match r {
        RedemptionCommand::List(a) => client.get(REDEMPTION, &page_q(a.p, a.page_size)),
        RedemptionCommand::Search { keyword } => client.get(
            &format!("{}/search", REDEMPTION),
            &[("keyword", keyword.clone())],
        ),
        RedemptionCommand::Get { id } => client.get(&format!("{}/{}", REDEMPTION, id), &[]),
        RedemptionCommand::Create { json } => {
            let body = read_json_arg(json)?;
            client.post_json(REDEMPTION, &body)
        }
        RedemptionCommand::Update { json } => {
            let body = read_json_arg(json)?;
            client.put_json(REDEMPTION, &body)
        }
        RedemptionCommand::SetStatus { id, status } => client.put_json(
            REDEMPTION,
            &json!({ "id": id, "status": status, "status_only": true }),
        ),
        RedemptionCommand::Delete { id, yes } => {
            require_yes(*yes, "redemption delete")?;
            client.delete(&format!("{}/{}", REDEMPTION, id))
        }
        RedemptionCommand::DeleteInvalid { yes } => {
            require_yes(*yes, "redemption delete-invalid")?;
            client.delete(&format!("{}/invalid", REDEMPTION))
        }
    }
}

fn dispatch_subscription(client: &ApiClient, s: &SubscriptionCommand) -> Result<Value> {
    match s {
        SubscriptionCommand::Plan(p) => dispatch_sub_plan(client, p),
        SubscriptionCommand::User(u) => dispatch_sub_user(client, u),
    }
}

fn dispatch_sub_plan(client: &ApiClient, p: &SubPlanCommand) -> Result<Value> {
    match p {
        SubPlanCommand::List(a) => client.get(SUB_PLAN, &page_q(a.p, a.page_size)),
        SubPlanCommand::Create { json } => {
            let body = read_json_arg(json)?;
            client.post_json(SUB_PLAN, &body)
        }
        SubPlanCommand::Update { id, json } => {
            let body = read_json_arg(json)?;
            client.put_json(&format!("{}/{}", SUB_PLAN, id), &body)
        }
        SubPlanCommand::SetStatus { id, status } => client.patch_json(
            &format!("{}/{}", SUB_PLAN, id),
            &json!({ "status": status }),
        ),
        SubPlanCommand::Bind { json } => {
            let body = read_json_arg(json)?;
            client.post_json(SUB_BIND, &body)
        }
        SubPlanCommand::Reset { id, yes } => {
            require_yes(*yes, "subscription plan reset")?;
            client.post_json(
                &format!("{}/{}/subscriptions/reset", SUB_PLAN, id),
                &json!({}),
            )
        }
    }
}

fn dispatch_sub_user(client: &ApiClient, u: &SubUserCommand) -> Result<Value> {
    match u {
        SubUserCommand::List { id } => {
            client.get(&format!("{}/{}/subscriptions", SUB_USER, id), &[])
        }
        SubUserCommand::Create { id, json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/{}/subscriptions", SUB_USER, id), &body)
        }
        SubUserCommand::Invalidate { id, yes } => {
            require_yes(*yes, "subscription user invalidate")?;
            client.post_json(&format!("{}/{}/invalidate", SUB_USER_SUB, id), &json!({}))
        }
        SubUserCommand::Delete { id, yes } => {
            require_yes(*yes, "subscription user delete")?;
            client.delete(&format!("{}/{}", SUB_USER_SUB, id))
        }
        SubUserCommand::Reset { id, json, yes } => {
            require_yes(*yes, "subscription user reset")?;
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/{}/reset", SUB_USER_SUB, id), &body)
        }
    }
}

/// Keys that the pricing command owns; the admin setting command refuses
/// to touch them so the two surfaces stay cleanly separated.
const PRICING_OPTION_KEYS: &[&str] = &[
    "ModelRatio",
    "ModelPrice",
    "CompletionRatio",
    "CacheRatio",
    "CreateCacheRatio",
    "ImageRatio",
    "AudioRatio",
    "AudioCompletionRatio",
    "GroupRatio",
    "GroupGroupRatio",
    "TopupGroupRatio",
    "Price",
    "USDExchangeRate",
    "QuotaPerUnit",
];

fn dispatch_setting(client: &ApiClient, s: &SettingCommand) -> Result<Value> {
    match s {
        SettingCommand::Get { key } => {
            if PRICING_OPTION_KEYS.contains(&key.as_str()) {
                bail!("{key} belongs to the `pricing` command, not admin setting");
            }
            let opts = client.get_raw(OPTION, &[])?;
            Ok(opts.get(key).cloned().unwrap_or(Value::Null))
        }
        SettingCommand::Set { key, json } => {
            if PRICING_OPTION_KEYS.contains(&key.as_str()) {
                bail!("{key} belongs to the `pricing` command, not admin setting");
            }
            // Pass the value through verbatim: strings stay raw, JSON
            // literals stay as objects/arrays.
            let body = json!({ "key": key, "value": json });
            client.put_json(OPTION, &body)
        }
    }
}

fn require_yes(yes: bool, op: &str) -> Result<()> {
    if !yes {
        bail!("{op} requires --yes");
    }
    Ok(())
}
