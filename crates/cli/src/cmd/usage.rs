//! `usage` command — caller self-log, drawing log, task log, quota dates,
//! and flow dates.
//!
//! All paths are fixed to `/api/log/self/*`, `/api/mj/self`, `/api/task/self`,
//! `/api/data/self`, and `/api/data/flow/self`. The command refuses any
//! filter that could leak across users (username, channel, admin global).
//! Illegal filters fail before any HTTP call; server 401/403/validation
//! messages surface verbatim.

use anyhow::{bail, Result};
use clap::Subcommand;
use serde_json::Value;

use crate::client::ApiClient;
use crate::output::print_json;

const LOG_SELF: &str = "/api/log/self";
const LOG_SELF_SEARCH: &str = "/api/log/self/search";
const LOG_SELF_STAT: &str = "/api/log/self/stat";
const MJ_SELF: &str = "/api/mj/self";
const TASK_SELF: &str = "/api/task/self";
const DATA_SELF: &str = "/api/data/self";
const DATA_FLOW_SELF: &str = "/api/data/flow/self";

const FORBIDDEN_FILTERS: &[&str] = &["username", "user_id", "channel", "admin"];

#[derive(Subcommand)]
pub enum UsageCommand {
    /// GET /api/log/self — paginated usage entries
    LogList {
        #[arg(long)]
        p: Option<u32>,
        #[arg(long)]
        page_size: Option<u32>,
        #[arg(long)]
        start_timestamp: Option<i64>,
        #[arg(long)]
        end_timestamp: Option<i64>,
        #[arg(long)]
        model_name: Option<String>,
        #[arg(long)]
        r#type: Option<i32>,
        #[arg(long)]
        token_name: Option<String>,
        #[arg(long)]
        request_id: Option<String>,
        #[arg(long)]
        upstream_request_id: Option<String>,
    },
    /// GET /api/log/self/search — log full-text search
    LogSearch {
        keyword: String,
        #[arg(long)]
        p: Option<u32>,
        #[arg(long)]
        page_size: Option<u32>,
    },
    /// GET /api/log/self/stat — quota summary
    LogStat {
        #[arg(long)]
        start_timestamp: Option<i64>,
        #[arg(long)]
        end_timestamp: Option<i64>,
        #[arg(long)]
        model_name: Option<String>,
        #[arg(long)]
        token_name: Option<String>,
    },
    /// GET /api/mj/self — drawing log (MidJourney-style)
    DrawingList {
        #[arg(long)]
        p: Option<u32>,
        #[arg(long)]
        page_size: Option<u32>,
    },
    /// GET /api/task/self — async task log
    TaskList {
        #[arg(long)]
        p: Option<u32>,
        #[arg(long)]
        page_size: Option<u32>,
    },
    /// GET /api/data/self — quota dates (per-day quota usage)
    QuotaDates {
        #[arg(long)]
        start_timestamp: Option<i64>,
        #[arg(long)]
        end_timestamp: Option<i64>,
    },
    /// GET /api/data/flow/self — flow dates (per-day request flow)
    FlowDates {
        #[arg(long)]
        start_timestamp: Option<i64>,
        #[arg(long)]
        end_timestamp: Option<i64>,
    },
}

pub fn run(client: &ApiClient, cmd: &UsageCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &UsageCommand) -> Result<Value> {
    match cmd {
        UsageCommand::LogList {
            p,
            page_size,
            start_timestamp,
            end_timestamp,
            model_name,
            r#type,
            token_name,
            request_id,
            upstream_request_id,
        } => {
            reject_forbidden_filters(&[
                model_name.as_deref(),
                token_name.as_deref(),
                request_id.as_deref(),
                upstream_request_id.as_deref(),
            ])?;
            client.get(
                LOG_SELF,
                &list_query(
                    *p,
                    *page_size,
                    *start_timestamp,
                    *end_timestamp,
                    model_name.as_deref(),
                    *r#type,
                    token_name.as_deref(),
                    request_id.as_deref(),
                    upstream_request_id.as_deref(),
                ),
            )
        }
        UsageCommand::LogSearch {
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
            client.get(LOG_SELF_SEARCH, &q)
        }
        UsageCommand::LogStat {
            start_timestamp,
            end_timestamp,
            model_name,
            token_name,
        } => client.get(
            LOG_SELF_STAT,
            &stat_query(
                *start_timestamp,
                *end_timestamp,
                model_name.as_deref(),
                token_name.as_deref(),
            ),
        ),
        UsageCommand::DrawingList { p, page_size } => {
            let mut q: Vec<(&str, String)> = Vec::new();
            if let Some(p) = p {
                q.push(("p", p.to_string()));
            }
            if let Some(ps) = page_size {
                q.push(("page_size", ps.to_string()));
            }
            client.get(MJ_SELF, &q)
        }
        UsageCommand::TaskList { p, page_size } => {
            let mut q: Vec<(&str, String)> = Vec::new();
            if let Some(p) = p {
                q.push(("p", p.to_string()));
            }
            if let Some(ps) = page_size {
                q.push(("page_size", ps.to_string()));
            }
            client.get(TASK_SELF, &q)
        }
        UsageCommand::QuotaDates {
            start_timestamp,
            end_timestamp,
        } => client.get(DATA_SELF, &ts_query(*start_timestamp, *end_timestamp)),
        UsageCommand::FlowDates {
            start_timestamp,
            end_timestamp,
        } => client.get(DATA_FLOW_SELF, &ts_query(*start_timestamp, *end_timestamp)),
    }
}

/// Reject any caller-supplied filter that could leak across users.
/// (Today none of the log_list filters are forbidden; the harness is here
/// to refuse new ones such as `username`/`channel` if anyone adds them.)
fn reject_forbidden_filters(values: &[Option<&str>]) -> Result<()> {
    let _ = values;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn list_query(
    p: Option<u32>,
    page_size: Option<u32>,
    start_timestamp: Option<i64>,
    end_timestamp: Option<i64>,
    model_name: Option<&str>,
    r#type: Option<i32>,
    token_name: Option<&str>,
    request_id: Option<&str>,
    upstream_request_id: Option<&str>,
) -> Vec<(&'static str, String)> {
    let mut q: Vec<(&'static str, String)> = Vec::new();
    if let Some(p) = p {
        q.push(("p", p.to_string()));
    }
    if let Some(ps) = page_size {
        q.push(("page_size", ps.to_string()));
    }
    if let Some(s) = start_timestamp {
        q.push(("start_timestamp", s.to_string()));
    }
    if let Some(e) = end_timestamp {
        q.push(("end_timestamp", e.to_string()));
    }
    if let Some(m) = model_name {
        q.push(("model_name", m.to_string()));
    }
    if let Some(t) = r#type {
        q.push(("type", t.to_string()));
    }
    if let Some(t) = token_name {
        q.push(("token_name", t.to_string()));
    }
    if let Some(r) = request_id {
        q.push(("request_id", r.to_string()));
    }
    if let Some(u) = upstream_request_id {
        q.push(("upstream_request_id", u.to_string()));
    }
    q
}

fn stat_query(
    start_timestamp: Option<i64>,
    end_timestamp: Option<i64>,
    model_name: Option<&str>,
    token_name: Option<&str>,
) -> Vec<(&'static str, String)> {
    let mut q: Vec<(&'static str, String)> = Vec::new();
    if let Some(s) = start_timestamp {
        q.push(("start_timestamp", s.to_string()));
    }
    if let Some(e) = end_timestamp {
        q.push(("end_timestamp", e.to_string()));
    }
    if let Some(m) = model_name {
        q.push(("model_name", m.to_string()));
    }
    if let Some(t) = token_name {
        q.push(("token_name", t.to_string()));
    }
    q
}

fn ts_query(
    start_timestamp: Option<i64>,
    end_timestamp: Option<i64>,
) -> Vec<(&'static str, String)> {
    let mut q: Vec<(&'static str, String)> = Vec::new();
    if let Some(s) = start_timestamp {
        q.push(("start_timestamp", s.to_string()));
    }
    if let Some(e) = end_timestamp {
        q.push(("end_timestamp", e.to_string()));
    }
    q
}

/// Module-private alias kept so future forbidden-filter checks have an
/// authoritative source. Currently unused; suppress the dead-code warning.
#[allow(dead_code)]
const _FORBIDDEN_REFERENCE: &[&str] = FORBIDDEN_FILTERS;

#[allow(dead_code)]
fn _bail_if_forbidden(name: &str) -> Result<()> {
    if FORBIDDEN_FILTERS.contains(&name) {
        bail!("filter `{name}` is not allowed in usage command");
    }
    Ok(())
}
