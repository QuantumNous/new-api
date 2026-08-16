//! `token` command — API token management for the calling user.
//!
//! Destructive operations require `--yes`. Token strings only flow through
//! the server's create / reveal response and are never echoed in error
//! output. All paths are fixed to `/api/token/**`; the command never
//! accepts a username / user-id / admin filter.

use anyhow::{bail, Result};
use clap::Subcommand;
use serde_json::Value;

use crate::client::ApiClient;
use crate::json_input::read_json_arg;
use crate::output::print_json;

const TOKEN: &str = "/api/token";

#[derive(Subcommand)]
pub enum TokenCommand {
    /// GET /api/token?p=&page_size=
    List {
        #[arg(long)]
        p: Option<u32>,
        #[arg(long)]
        page_size: Option<u32>,
    },
    /// GET /api/token/search?keyword=
    Search {
        keyword: String,
        #[arg(long)]
        p: Option<u32>,
        #[arg(long)]
        page_size: Option<u32>,
    },
    /// GET /api/token/:id
    Get { id: i32 },
    /// POST /api/token — body must include name, group, expired_at,
    /// remain_quota, unlimited_quota, model_limits, auto_group, etc.
    /// Explicit zero/false values are preserved.
    Create { json: String },
    /// PATCH /api/token/:id — update fields (status, expired_at,
    /// remain_quota, unlimited_quota, model_limits, group, name, etc.)
    Update { id: i32, json: String },
    /// DELETE /api/token/:id (requires --yes)
    Delete {
        id: i32,
        #[arg(long)]
        yes: bool,
    },
    /// POST /api/token/batch/delete (requires --yes)
    /// Body: {"ids":[1,2,3]}
    BatchDelete {
        json: String,
        #[arg(long)]
        yes: bool,
    },
    /// POST /api/token/status?status=1 (status-only update)
    SetStatus { id: i32, status: i32 },
    /// POST /api/token/auto_group — body: {"model":"...", "group":"..."}
    AutoGroup { json: String },
    /// POST /api/token/reveal?ids=1,2,3 — server-guarded key reveal
    Reveal { ids: String },
    /// POST /api/token/reveal/batch (requires --yes) — body: {"ids":[...]}
    RevealBatch {
        json: String,
        #[arg(long)]
        yes: bool,
    },
}

pub fn run(client: &ApiClient, cmd: &TokenCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &TokenCommand) -> Result<Value> {
    match cmd {
        TokenCommand::List { p, page_size } => {
            let mut q: Vec<(&str, String)> = Vec::new();
            if let Some(p) = p {
                q.push(("p", p.to_string()));
            }
            if let Some(ps) = page_size {
                q.push(("page_size", ps.to_string()));
            }
            client.get(TOKEN, &q)
        }
        TokenCommand::Search {
            keyword,
            p,
            page_size,
        } => {
            let mut q = vec![("keyword", keyword.clone())];
            if let Some(p) = p {
                q.push(("p", p.to_string()));
            }
            if let Some(ps) = page_size {
                q.push(("page_size", ps.to_string()));
            }
            client.get(&format!("{}/search", TOKEN), &q)
        }
        TokenCommand::Get { id } => client.get(&format!("{}/{}", TOKEN, id), &[]),
        TokenCommand::Create { json } => {
            let body = read_json_arg(json)?;
            client.post_json(TOKEN, &body)
        }
        TokenCommand::Update { id, json } => {
            let body = read_json_arg(json)?;
            client.patch_json(&format!("{}/{}", TOKEN, id), &body)
        }
        TokenCommand::Delete { id, yes } => {
            require_yes(*yes, "token delete")?;
            client.delete(&format!("{}/{}", TOKEN, id))
        }
        TokenCommand::BatchDelete { json, yes } => {
            require_yes(*yes, "token batch-delete")?;
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/batch/delete", TOKEN), &body)
        }
        TokenCommand::SetStatus { id, status } => client.post_with_query(
            &format!("{}/{}/status", TOKEN, id),
            &[("status", status.to_string())],
        ),
        TokenCommand::AutoGroup { json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/auto_group", TOKEN), &body)
        }
        TokenCommand::Reveal { ids } => {
            // ids is a comma-separated list forwarded as `ids` query.
            client.post_with_query(&format!("{}/reveal", TOKEN), &[("ids", ids.clone())])
        }
        TokenCommand::RevealBatch { json, yes } => {
            require_yes(*yes, "token reveal-batch")?;
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/reveal/batch", TOKEN), &body)
        }
    }
}

fn require_yes(yes: bool, op: &str) -> Result<()> {
    if !yes {
        bail!("{op} requires --yes");
    }
    Ok(())
}
