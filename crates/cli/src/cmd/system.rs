//! `system` command — admin performance, system task, and admin log.
//!
//! Destructive operations require an explicit `--yes`. The `log` subcommand
//! only ever builds admin paths; `/api/log/self` and other user-level
//! paths are unreachable from this command.

use anyhow::{bail, Result};
use clap::Subcommand;
use serde_json::{json, Value};

use crate::client::ApiClient;
use crate::output::print_json;

const PERFORMANCE: &str = "/api/performance";
const SYSTEM_TASK: &str = "/api/system-task";
const LOG: &str = "/api/log";

const CLEANUP_MODES: &[&str] = &["by_count", "by_days"];

#[derive(Subcommand)]
pub enum PerformanceCommand {
    /// GET /api/performance/stats
    Stats,
    /// DELETE /api/performance/disk_cache (requires --yes)
    DiskCacheClear {
        #[arg(long)]
        yes: bool,
    },
    /// POST /api/performance/reset_stats (requires --yes)
    StatsReset {
        #[arg(long)]
        yes: bool,
    },
    /// POST /api/performance/gc (requires --yes)
    Gc {
        #[arg(long)]
        yes: bool,
    },
    /// GET /api/performance/logs
    LogFiles,
    /// DELETE /api/performance/logs?mode=...&value=... (requires --yes)
    LogFilesCleanup {
        /// "by_count" or "by_days"
        mode: String,
        /// Numeric value paired with the mode (count or days)
        value: u32,
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Subcommand)]
pub enum TaskCommand {
    /// GET /api/system-task/list?limit=...
    List {
        #[arg(long)]
        limit: Option<u32>,
    },
    /// GET /api/system-task/current?type=...
    Current {
        #[arg(long, default_value = "log_cleanup")]
        r#type: String,
    },
    /// GET /api/system-task/:task_id
    Get { task_id: String },
    /// POST /api/system-task/log-cleanup (requires --yes)
    LogCleanup {
        target_timestamp: i64,
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Subcommand)]
pub enum LogCommand {
    /// GET /api/log (admin-only filters)
    List(LogListArgs),
    /// GET /api/log/search (admin endpoint, no params)
    Search,
    /// GET /api/log/stat
    Stat(LogStatArgs),
}

#[derive(clap::Args)]
pub struct LogListArgs {
    #[arg(long)]
    pub p: Option<u32>,
    #[arg(long)]
    pub page_size: Option<u32>,
    #[arg(long)]
    pub r#type: Option<i32>,
    #[arg(long)]
    pub username: Option<String>,
    #[arg(long)]
    pub token_name: Option<String>,
    #[arg(long)]
    pub model_name: Option<String>,
    #[arg(long)]
    pub start_timestamp: Option<i64>,
    #[arg(long)]
    pub end_timestamp: Option<i64>,
    #[arg(long)]
    pub channel: Option<i32>,
    #[arg(long)]
    pub group: Option<String>,
    #[arg(long)]
    pub request_id: Option<String>,
    #[arg(long)]
    pub upstream_request_id: Option<String>,
}

#[derive(clap::Args)]
pub struct LogStatArgs {
    #[arg(long)]
    pub r#type: Option<i32>,
    #[arg(long)]
    pub username: Option<String>,
    #[arg(long)]
    pub token_name: Option<String>,
    #[arg(long)]
    pub model_name: Option<String>,
    #[arg(long)]
    pub start_timestamp: Option<i64>,
    #[arg(long)]
    pub end_timestamp: Option<i64>,
    #[arg(long)]
    pub channel: Option<i32>,
    #[arg(long)]
    pub group: Option<String>,
}

#[derive(Subcommand)]
pub enum SystemCommand {
    #[command(subcommand)]
    Performance(PerformanceCommand),
    #[command(subcommand)]
    Task(TaskCommand),
    #[command(subcommand)]
    Log(LogCommand),
}

pub fn run(client: &ApiClient, cmd: &SystemCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &SystemCommand) -> Result<Value> {
    match cmd {
        SystemCommand::Performance(p) => dispatch_perf(client, p),
        SystemCommand::Task(t) => dispatch_task(client, t),
        SystemCommand::Log(l) => dispatch_log(client, l),
    }
}

fn dispatch_perf(client: &ApiClient, p: &PerformanceCommand) -> Result<Value> {
    match p {
        PerformanceCommand::Stats => client.get(&format!("{}/stats", PERFORMANCE), &[]),
        PerformanceCommand::DiskCacheClear { yes } => {
            require_yes(*yes, "disk-cache-clear")?;
            client.delete(&format!("{}/disk_cache", PERFORMANCE))
        }
        PerformanceCommand::StatsReset { yes } => {
            require_yes(*yes, "stats-reset")?;
            client.post_json(&format!("{}/reset_stats", PERFORMANCE), &json!({}))
        }
        PerformanceCommand::Gc { yes } => {
            require_yes(*yes, "gc")?;
            client.post_json(&format!("{}/gc", PERFORMANCE), &json!({}))
        }
        PerformanceCommand::LogFiles => client.get(&format!("{}/logs", PERFORMANCE), &[]),
        PerformanceCommand::LogFilesCleanup { mode, value, yes } => {
            require_yes(*yes, "log-files-cleanup")?;
            if !CLEANUP_MODES.contains(&mode.as_str()) {
                bail!(
                    "invalid cleanup mode {} (expected one of {:?})",
                    mode,
                    CLEANUP_MODES
                );
            }
            client.delete_with_query(
                &format!("{}/logs", PERFORMANCE),
                &[("mode", mode.clone()), ("value", value.to_string())],
            )
        }
    }
}

fn dispatch_task(client: &ApiClient, t: &TaskCommand) -> Result<Value> {
    match t {
        TaskCommand::List { limit } => {
            let q: Vec<(&str, String)> = match limit {
                Some(l) => vec![("limit", l.to_string())],
                None => Vec::new(),
            };
            client.get(&format!("{}/list", SYSTEM_TASK), &q)
        }
        TaskCommand::Current { r#type } => client.get(
            &format!("{}/current", SYSTEM_TASK),
            &[("type", r#type.clone())],
        ),
        TaskCommand::Get { task_id } => client.get(&format!("{}/{}", SYSTEM_TASK, task_id), &[]),
        TaskCommand::LogCleanup {
            target_timestamp,
            yes,
        } => {
            require_yes(*yes, "task log-cleanup")?;
            // Server reads target_timestamp from the query string; POST
            // carries no body so the request stays idempotent.
            client.post_with_query(
                &format!("{}/log-cleanup", SYSTEM_TASK),
                &[("target_timestamp", target_timestamp.to_string())],
            )
        }
    }
}

fn dispatch_log(client: &ApiClient, l: &LogCommand) -> Result<Value> {
    match l {
        LogCommand::List(args) => client.get(LOG, &log_list_query(args)),
        LogCommand::Search => client.get(&format!("{}/search", LOG), &[]),
        LogCommand::Stat(args) => client.get(&format!("{}/stat", LOG), &log_stat_query(args)),
    }
}

fn log_list_query(a: &LogListArgs) -> Vec<(&'static str, String)> {
    let mut q: Vec<(&'static str, String)> = Vec::new();
    if let Some(p) = a.p {
        q.push(("p", p.to_string()));
    }
    if let Some(ps) = a.page_size {
        q.push(("page_size", ps.to_string()));
    }
    if let Some(t) = a.r#type {
        q.push(("type", t.to_string()));
    }
    if let Some(u) = &a.username {
        q.push(("username", u.clone()));
    }
    if let Some(c) = a.channel {
        q.push(("channel", c.to_string()));
    }
    if let Some(g) = &a.group {
        q.push(("group", g.clone()));
    }
    if let Some(m) = &a.model_name {
        q.push(("model_name", m.clone()));
    }
    if let Some(t) = &a.token_name {
        q.push(("token_name", t.clone()));
    }
    if let Some(s) = a.start_timestamp {
        q.push(("start_timestamp", s.to_string()));
    }
    if let Some(e) = a.end_timestamp {
        q.push(("end_timestamp", e.to_string()));
    }
    if let Some(r) = &a.request_id {
        q.push(("request_id", r.clone()));
    }
    if let Some(u) = &a.upstream_request_id {
        q.push(("upstream_request_id", u.clone()));
    }
    q
}

fn log_stat_query(a: &LogStatArgs) -> Vec<(&'static str, String)> {
    let mut q: Vec<(&'static str, String)> = Vec::new();
    if let Some(t) = a.r#type {
        q.push(("type", t.to_string()));
    }
    if let Some(u) = &a.username {
        q.push(("username", u.clone()));
    }
    if let Some(c) = a.channel {
        q.push(("channel", c.to_string()));
    }
    if let Some(g) = &a.group {
        q.push(("group", g.clone()));
    }
    if let Some(m) = &a.model_name {
        q.push(("model_name", m.clone()));
    }
    if let Some(t) = &a.token_name {
        q.push(("token_name", t.clone()));
    }
    if let Some(s) = a.start_timestamp {
        q.push(("start_timestamp", s.to_string()));
    }
    if let Some(e) = a.end_timestamp {
        q.push(("end_timestamp", e.to_string()));
    }
    q
}

fn require_yes(yes: bool, op: &str) -> Result<()> {
    if !yes {
        bail!("{op} requires --yes");
    }
    Ok(())
}
