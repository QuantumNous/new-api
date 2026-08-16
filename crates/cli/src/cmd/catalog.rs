//! `catalog` command — model catalog, vendor, prefill, and upstream sync.
//!
//! JSON-first; preserves explicit zero/false; never echoes vendor/model
//! secrets (none expected) and respects server error messages.

use anyhow::Result;
use clap::{Args, Subcommand};
use serde_json::Value;

use crate::client::ApiClient;
use crate::json_input::read_json_arg;
use crate::output::print_json;

const MODELS: &str = "/api/models";
const VENDORS: &str = "/api/vendors";
const PREFILL: &str = "/api/prefill_group";
const RATIO_SYNC: &str = "/api/ratio_sync";

#[derive(Args)]
pub struct ListPageArgs {
    #[arg(long)]
    pub p: Option<u32>,
    #[arg(long)]
    pub page_size: Option<u32>,
}

#[derive(Args)]
pub struct ModelSearchArgs {
    pub keyword: String,
    #[arg(long)]
    pub vendor: Option<String>,
    #[arg(long)]
    pub status: Option<String>,
    #[arg(long)]
    pub sync: Option<String>,
    #[arg(long)]
    pub p: Option<u32>,
    #[arg(long)]
    pub page_size: Option<u32>,
}

#[derive(Subcommand)]
pub enum ModelCommand {
    /// List model metadata (pagination)
    List(ListPageArgs),
    /// Search model metadata
    Search(ModelSearchArgs),
    /// Get one model by id
    Get { id: i32 },
    /// Create a model (body matches AddModelMetaRequest)
    Create { json: String },
    /// Update a model (body includes id)
    Update { json: String },
    /// Delete a model
    Delete { id: i32 },
    /// List models present in channels but missing from the catalog
    Missing,
}

#[derive(Subcommand)]
pub enum VendorCommand {
    /// List vendors (pagination)
    List(ListPageArgs),
    /// Search vendors
    Search { keyword: String },
    /// Get one vendor
    Get { id: i32 },
    /// Create a vendor
    Create { json: String },
    /// Update a vendor
    Update { json: String },
    /// Delete a vendor
    Delete { id: i32 },
}

#[derive(Subcommand)]
pub enum PrefillCommand {
    /// List prefill groups
    List {
        /// kind filter: model | group | endpoint
        #[arg(long)]
        kind: Option<String>,
    },
    /// Create a prefill group
    Create { json: String },
    /// Update a prefill group
    Update { json: String },
    /// Delete a prefill group
    Delete { id: i32 },
}

#[derive(Subcommand)]
pub enum SyncCommand {
    /// Preview upstream model drift (read-only)
    UpstreamPreview,
    /// Apply upstream model sync
    UpstreamApply {
        /// Optional JSON body. POST /api/models/sync_upstream
        json: Option<String>,
    },
    /// List channels that can be ratio-synced
    RatioChannels,
    /// Fetch upstream ratios (POST /api/ratio_sync/fetch, optional body)
    RatioFetch { json: Option<String> },
}

#[derive(Subcommand)]
pub enum CatalogCommand {
    #[command(subcommand)]
    Model(ModelCommand),
    #[command(subcommand)]
    Vendor(VendorCommand),
    #[command(subcommand)]
    Prefill(PrefillCommand),
    #[command(subcommand)]
    Sync(SyncCommand),
}

pub fn run(client: &ApiClient, cmd: &CatalogCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &CatalogCommand) -> Result<Value> {
    match cmd {
        CatalogCommand::Model(m) => dispatch_model(client, m),
        CatalogCommand::Vendor(v) => dispatch_vendor(client, v),
        CatalogCommand::Prefill(p) => dispatch_prefill(client, p),
        CatalogCommand::Sync(s) => dispatch_sync(client, s),
    }
}

fn dispatch_model(client: &ApiClient, m: &ModelCommand) -> Result<Value> {
    match m {
        ModelCommand::List(a) => client.get(MODELS, &page_query(a.p, a.page_size)),
        ModelCommand::Search(a) => {
            let mut q: Vec<(&str, String)> = vec![("keyword", a.keyword.clone())];
            if let Some(v) = &a.vendor {
                q.push(("vendor", v.clone()));
            }
            if let Some(s) = &a.status {
                q.push(("status", s.clone()));
            }
            if let Some(s) = &a.sync {
                q.push(("sync", s.clone()));
            }
            q.extend(page_query(a.p, a.page_size));
            client.get(&format!("{}/search", MODELS), &q)
        }
        ModelCommand::Get { id } => client.get(&format!("{}/{}", MODELS, id), &[]),
        ModelCommand::Create { json } => {
            let body = read_json_arg(json)?;
            client.post_json(MODELS, &body)
        }
        ModelCommand::Update { json } => {
            let body = read_json_arg(json)?;
            client.put_json(MODELS, &body)
        }
        ModelCommand::Delete { id } => client.delete(&format!("{}/{}", MODELS, id)),
        ModelCommand::Missing => client.get(&format!("{}/missing", MODELS), &[]),
    }
}

fn dispatch_vendor(client: &ApiClient, v: &VendorCommand) -> Result<Value> {
    match v {
        VendorCommand::List(a) => client.get(VENDORS, &page_query(a.p, a.page_size)),
        VendorCommand::Search { keyword } => client.get(
            &format!("{}/search", VENDORS),
            &[("keyword", keyword.clone())],
        ),
        VendorCommand::Get { id } => client.get(&format!("{}/{}", VENDORS, id), &[]),
        VendorCommand::Create { json } => {
            let body = read_json_arg(json)?;
            client.post_json(VENDORS, &body)
        }
        VendorCommand::Update { json } => {
            let body = read_json_arg(json)?;
            client.put_json(VENDORS, &body)
        }
        VendorCommand::Delete { id } => client.delete(&format!("{}/{}", VENDORS, id)),
    }
}

fn dispatch_prefill(client: &ApiClient, p: &PrefillCommand) -> Result<Value> {
    match p {
        PrefillCommand::List { kind } => {
            let q: Vec<(&str, String)> = match kind {
                Some(k) => vec![("kind", k.clone())],
                None => Vec::new(),
            };
            client.get(PREFILL, &q)
        }
        PrefillCommand::Create { json } => {
            let body = read_json_arg(json)?;
            client.post_json(PREFILL, &body)
        }
        PrefillCommand::Update { json } => {
            let body = read_json_arg(json)?;
            client.put_json(PREFILL, &body)
        }
        PrefillCommand::Delete { id } => client.delete(&format!("{}/{}", PREFILL, id)),
    }
}

fn dispatch_sync(client: &ApiClient, s: &SyncCommand) -> Result<Value> {
    match s {
        SyncCommand::UpstreamPreview => {
            client.get(&format!("{}/sync_upstream/preview", MODELS), &[])
        }
        SyncCommand::UpstreamApply { json } => {
            let body = match json {
                Some(j) => read_json_arg(j)?,
                None => Value::Object(Default::default()),
            };
            client.post_json(&format!("{}/sync_upstream", MODELS), &body)
        }
        SyncCommand::RatioChannels => client.get(&format!("{}/channels", RATIO_SYNC), &[]),
        SyncCommand::RatioFetch { json } => {
            let body = match json {
                Some(j) => read_json_arg(j)?,
                None => Value::Object(Default::default()),
            };
            client.post_json(&format!("{}/fetch", RATIO_SYNC), &body)
        }
    }
}

fn page_query(p: Option<u32>, page_size: Option<u32>) -> Vec<(&'static str, String)> {
    let mut q: Vec<(&'static str, String)> = Vec::new();
    if let Some(p) = p {
        q.push(("p", p.to_string()));
    }
    if let Some(ps) = page_size {
        q.push(("page_size", ps.to_string()));
    }
    q
}
