//! `device` command — proxy/sing-box nodes + system-instance management.
//!
//! Destructive operations require an explicit `--yes` flag and refuse to
//! send HTTP without it. Proxy secrets only ever flow in through `--json`
//! or `@file`; default JSON/error/debug output never echoes the proxy
//! value because we only forward the server's own response.

use anyhow::{bail, Result};
use clap::{Args, Subcommand};
use serde_json::{json, Value};

use crate::client::ApiClient;
use crate::json_input::read_json_arg;
use crate::output::print_json;

const PROXY: &str = "/api/proxy";
const SYSTEM_INFO: &str = "/api/system-info";

/// URL-encode a node name before placing it in the path segment to
/// avoid the name being parsed as additional path components.
fn encode_path(name: &str) -> String {
    // Minimal path-segment encoding: only `%`-encode characters that
    // would change the request line.
    let mut out = String::with_capacity(name.len());
    for b in name.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

#[derive(Args)]
pub struct ProxyCreateArgs {
    /// JSON body for the new proxy node. Must include name and protocol.
    pub json: String,
}

#[derive(Args)]
pub struct ProxyUpdateArgs {
    pub id: u32,
    pub json: String,
}

#[derive(Args)]
pub struct ProxyDeleteArgs {
    pub id: u32,
    #[arg(long)]
    pub yes: bool,
}

#[derive(Args)]
pub struct ProxyBatchCreateArgs {
    pub json: String,
    #[arg(long)]
    pub yes: bool,
}

#[derive(Args)]
pub struct ProxySetEnabledArgs {
    pub json: String,
}

#[derive(Args)]
pub struct ProxyClearErrorsArgs {
    pub json: String,
    #[arg(long)]
    pub yes: bool,
}

#[derive(Subcommand)]
pub enum ProxyCommand {
    /// Show the current proxy config
    ConfigShow,
    /// Replace the proxy config (body is the full config JSON)
    ConfigSet { json: String },
    /// Generate the proxy config from current nodes
    ConfigGenerate,
    /// Show the proxy status
    Status,
    /// Reload the proxy (destructive — requires --yes)
    Reload {
        #[arg(long)]
        yes: bool,
    },
    /// List proxy nodes
    List,
    /// Aggregated health report for all proxy nodes
    Report,
    /// Get one proxy node by id
    Get { id: u32 },
    /// Create a new proxy node
    Create(ProxyCreateArgs),
    /// Update a proxy node
    Update(ProxyUpdateArgs),
    /// Delete a proxy node (requires --yes)
    Delete(ProxyDeleteArgs),
    /// Test one proxy node (omit id to test all)
    Test { id: Option<u32> },
    /// Batch create proxy nodes (requires --yes)
    BatchCreate(ProxyBatchCreateArgs),
    /// Batch set enabled state
    SetEnabled(ProxySetEnabledArgs),
    /// Batch clear errors (requires --yes)
    ClearErrors(ProxyClearErrorsArgs),
}

#[derive(Subcommand)]
pub enum InstanceCommand {
    /// List system instances
    List,
    /// Delete all stale instances (requires --yes)
    DeleteStale {
        #[arg(long)]
        yes: bool,
    },
    /// Delete one instance by node name (requires --yes)
    Delete {
        node_name: String,
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Subcommand)]
pub enum DeviceCommand {
    #[command(subcommand)]
    Proxy(ProxyCommand),
    #[command(subcommand)]
    Instance(InstanceCommand),
}

pub fn run(client: &ApiClient, cmd: &DeviceCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &DeviceCommand) -> Result<Value> {
    match cmd {
        DeviceCommand::Proxy(p) => dispatch_proxy(client, p),
        DeviceCommand::Instance(i) => dispatch_instance(client, i),
    }
}

fn dispatch_proxy(client: &ApiClient, p: &ProxyCommand) -> Result<Value> {
    match p {
        ProxyCommand::ConfigShow => client.get(&format!("{}/config", PROXY), &[]),
        ProxyCommand::ConfigSet { json } => {
            let body = read_json_arg(json)?;
            client.put_json(&format!("{}/config", PROXY), &body)
        }
        ProxyCommand::ConfigGenerate => client.get(&format!("{}/config/generate", PROXY), &[]),
        ProxyCommand::Status => client.get(&format!("{}/status", PROXY), &[]),
        ProxyCommand::Reload { yes } => {
            if !yes {
                bail!("reload requires --yes");
            }
            client.post_json(&format!("{}/reload", PROXY), &json!({}))
        }
        ProxyCommand::List => client.get(&format!("{}/nodes", PROXY), &[]),
        ProxyCommand::Report => client.get(&format!("{}/nodes/report", PROXY), &[]),
        ProxyCommand::Get { id } => client.get(&format!("{}/nodes/{}", PROXY, id), &[]),
        ProxyCommand::Create(args) => {
            let body = read_json_arg(&args.json)?;
            client.post_json(&format!("{}/nodes", PROXY), &body)
        }
        ProxyCommand::Update(args) => {
            let body = read_json_arg(&args.json)?;
            client.put_json(&format!("{}/nodes/{}", PROXY, args.id), &body)
        }
        ProxyCommand::Delete(args) => {
            if !args.yes {
                bail!("delete requires --yes");
            }
            client.delete(&format!("{}/nodes/{}", PROXY, args.id))
        }
        ProxyCommand::Test { id } => match id {
            Some(i) => client.post_json(&format!("{}/nodes/{}/test", PROXY, i), &json!({})),
            None => client.post_json(&format!("{}/nodes/test", PROXY), &json!({})),
        },
        ProxyCommand::BatchCreate(args) => {
            if !args.yes {
                bail!("batch-create requires --yes");
            }
            let body = read_json_arg(&args.json)?;
            client.post_json(&format!("{}/nodes/batch", PROXY), &body)
        }
        ProxyCommand::SetEnabled(args) => {
            let body = read_json_arg(&args.json)?;
            client.post_json(&format!("{}/nodes/batch-enabled", PROXY), &body)
        }
        ProxyCommand::ClearErrors(args) => {
            if !args.yes {
                bail!("clear-errors requires --yes");
            }
            let body = read_json_arg(&args.json)?;
            client.post_json(&format!("{}/nodes/batch-clear-errors", PROXY), &body)
        }
    }
}

fn dispatch_instance(client: &ApiClient, i: &InstanceCommand) -> Result<Value> {
    match i {
        InstanceCommand::List => client.get(&format!("{}/instances", SYSTEM_INFO), &[]),
        InstanceCommand::DeleteStale { yes } => {
            if !yes {
                bail!("delete-stale requires --yes");
            }
            client.delete(&format!("{}/stale-instances", SYSTEM_INFO))
        }
        InstanceCommand::Delete { node_name, yes } => {
            if !yes {
                bail!("instance delete requires --yes");
            }
            client.delete(&format!(
                "{}/instances/{}",
                SYSTEM_INFO,
                encode_path(node_name)
            ))
        }
    }
}
