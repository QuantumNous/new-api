//! `channel` command — upstream provider management.
//!
//! JSON-first; preserves explicit zero/false, distinct `setting`/`settings`
//! JSON-string transport, never echoes secrets to stdout/stderr.
//!
//! Routes mirror `apps/api/router/channel-router.go` and
//! `apps/web/src/features/channels/api.ts`.

use anyhow::Result;
use clap::{Args, Subcommand};
use serde_json::{json, Value};

use crate::client::ApiClient;
use crate::json_input::read_json_arg;
use crate::output::print_json;

const API_PREFIX: &str = "/api/channel";

#[derive(Args)]
pub struct ChannelListArgs {
    #[arg(long)]
    pub p: Option<u32>,
    #[arg(long)]
    pub page_size: Option<u32>,
    /// "enabled"/"disabled"/empty for all
    #[arg(long, default_value = "")]
    pub status: String,
    #[arg(long)]
    pub r#type: Option<i32>,
    #[arg(long)]
    pub group: Option<String>,
    #[arg(long, default_value_t = false)]
    pub id_sort: bool,
    #[arg(long, default_value_t = false)]
    pub tag_mode: bool,
    #[arg(long)]
    pub sort_by: Option<String>,
    #[arg(long)]
    pub sort_order: Option<String>,
}

#[derive(Args)]
pub struct ChannelSearchArgs {
    pub keyword: String,
    #[arg(long)]
    pub group: Option<String>,
    #[arg(long)]
    pub model: Option<String>,
    #[arg(long, default_value = "")]
    pub status: String,
    #[arg(long)]
    pub r#type: Option<i32>,
    #[arg(long, default_value_t = false)]
    pub id_sort: bool,
    #[arg(long, default_value_t = false)]
    pub tag_mode: bool,
    #[arg(long)]
    pub sort_by: Option<String>,
    #[arg(long)]
    pub sort_order: Option<String>,
    #[arg(long)]
    pub p: Option<u32>,
    #[arg(long)]
    pub page_size: Option<u32>,
}

#[derive(Subcommand)]
pub enum TagCommand {
    /// Enable all channels with a tag
    Enable { tag: String },
    /// Disable all channels with a tag
    Disable { tag: String },
    /// Edit channels with a tag (body: {tag, new_tag?, priority?, weight?, model_mapping?, models?, groups?})
    Edit { json: String },
    /// Get models for channels with a tag
    Models { tag: String },
    /// Batch set tag for channels (body: {ids, tag})
    SetBatch { json: String },
}

#[derive(Subcommand)]
pub enum UpstreamCommand {
    /// Detect pending upstream model updates for one channel (body: {id})
    Detect { json: Option<String> },
    /// Detect pending upstream model updates for all channels
    DetectAll,
    /// Apply staged upstream model updates for one channel
    Apply { json: String },
    /// Apply staged upstream model updates for all channels
    ApplyAll { json: Option<String> },
}

#[derive(Subcommand)]
pub enum ChannelCommand {
    /// List channels (pagination + filters)
    List(ChannelListArgs),
    /// Search channels (keyword + filters)
    Search(ChannelSearchArgs),
    /// Get a single channel by id (response does not echo the key)
    Get { id: i32 },
    /// List models across channels; `--enabled-only` for enabled models only
    Models { enabled_only: bool },
    /// Channel operations summary
    Ops,
    /// Create one or more channels (body: {mode, multi_key_mode?, batch_add_set_key_prefix_2_name?, channel})
    Create { json: String },
    /// Update a channel (body carries id; missing key retains the existing key)
    Update { json: String },
    /// Delete a channel
    Delete { id: i32 },
    /// Copy/clone a channel
    Copy {
        id: i32,
        #[arg(long)]
        suffix: Option<String>,
        #[arg(long, default_value_t = true)]
        reset_balance: bool,
    },
    /// Batch delete channels (body: {ids:[...]})
    BatchDelete { json: String },
    /// Delete all disabled channels
    DeleteDisabled,
    /// Test channel connectivity; no id tests all channels
    Test {
        id: Option<i32>,
        #[arg(long)]
        model: Option<String>,
        #[arg(long)]
        endpoint_type: Option<String>,
        #[arg(long, default_value_t = false)]
        stream: bool,
    },
    /// Set channel enabled/disabled status (1 enabled, 2 manual disabled)
    SetStatus { id: i32, status: i32 },
    /// Batch set channel status (body: {ids, status})
    SetStatusBatch { json: String },
    /// Refresh channel balance; no id refreshes all enabled channels
    RefreshBalance { id: Option<i32> },
    /// Fetch available models from an upstream provider
    FetchModels { id: i32 },
    /// Fix channel abilities (sync ability table)
    FixAbilities,
    /// Tag operations: enable/disable/edit/models/set-batch
    #[command(subcommand)]
    Tag(TagCommand),
    /// Multi-key management (body: {channel_id, action, key_index?, page?, page_size?, status?})
    MultiKey { json: String },
    /// Upstream model-update detect/apply for one or all channels
    #[command(subcommand)]
    Upstream(UpstreamCommand),
}

pub fn run(client: &ApiClient, cmd: &ChannelCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &ChannelCommand) -> Result<Value> {
    match cmd {
        ChannelCommand::List(a) => list_channels(client, a),
        ChannelCommand::Search(a) => search_channels(client, a),
        ChannelCommand::Get { id } => client.get(&format!("{}/{}", API_PREFIX, id), &[]),
        ChannelCommand::Models { enabled_only } => {
            if *enabled_only {
                client.get(&format!("{}/models_enabled", API_PREFIX), &[])
            } else {
                client.get(&format!("{}/models", API_PREFIX), &[])
            }
        }
        ChannelCommand::Ops => client.get(&format!("{}/ops", API_PREFIX), &[]),
        ChannelCommand::Create { json } => {
            let body = read_json_arg(json)?;
            client.post_json(API_PREFIX, &body)
        }
        ChannelCommand::Update { json } => {
            let body = read_json_arg(json)?;
            client.put_json(API_PREFIX, &body)
        }
        ChannelCommand::Delete { id } => client.delete(&format!("{}/{}", API_PREFIX, id)),
        ChannelCommand::Copy {
            id,
            suffix,
            reset_balance,
        } => {
            let mut query: Vec<(&str, String)> = Vec::new();
            if let Some(s) = suffix {
                query.push(("suffix", s.clone()));
            }
            query.push(("reset_balance", reset_balance.to_string()));
            client.post_with_query(&format!("{}/copy/{}", API_PREFIX, id), &query)
        }
        ChannelCommand::BatchDelete { json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/batch", API_PREFIX), &body)
        }
        ChannelCommand::DeleteDisabled => client.delete(&format!("{}/disabled", API_PREFIX)),
        ChannelCommand::Test {
            id,
            model,
            endpoint_type,
            stream,
        } => {
            let mut query: Vec<(&str, String)> = Vec::new();
            if let Some(m) = model {
                query.push(("model", m.clone()));
            }
            if let Some(et) = endpoint_type {
                query.push(("endpoint_type", et.clone()));
            }
            query.push(("stream", stream.to_string()));
            match id {
                Some(i) => client.get(&format!("{}/test/{}", API_PREFIX, i), &query),
                None => client.get(&format!("{}/test", API_PREFIX), &query),
            }
        }
        ChannelCommand::SetStatus { id, status } => client.post_json(
            &format!("{}/{}/status", API_PREFIX, id),
            &json!({ "status": status }),
        ),
        ChannelCommand::SetStatusBatch { json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/status/batch", API_PREFIX), &body)
        }
        ChannelCommand::RefreshBalance { id } => match id {
            Some(i) => client.get(&format!("{}/update_balance/{}", API_PREFIX, i), &[]),
            None => client.get(&format!("{}/update_balance", API_PREFIX), &[]),
        },
        ChannelCommand::FetchModels { id } => {
            client.get(&format!("{}/fetch_models/{}", API_PREFIX, id), &[])
        }
        ChannelCommand::FixAbilities => {
            client.post_json(&format!("{}/fix", API_PREFIX), &json!({}))
        }
        ChannelCommand::Tag(tag) => dispatch_tag(client, tag),
        ChannelCommand::MultiKey { json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/multi_key/manage", API_PREFIX), &body)
        }
        ChannelCommand::Upstream(up) => dispatch_upstream(client, up),
    }
}

fn dispatch_tag(client: &ApiClient, tag: &TagCommand) -> Result<Value> {
    match tag {
        TagCommand::Enable { tag } => client.post_json(
            &format!("{}/tag/enabled", API_PREFIX),
            &json!({ "tag": tag }),
        ),
        TagCommand::Disable { tag } => client.post_json(
            &format!("{}/tag/disabled", API_PREFIX),
            &json!({ "tag": tag }),
        ),
        TagCommand::Edit { json } => {
            let body = read_json_arg(json)?;
            client.put_json(&format!("{}/tag", API_PREFIX), &body)
        }
        TagCommand::Models { tag } => client.get(
            &format!("{}/tag/models", API_PREFIX),
            &[("tag", tag.clone())],
        ),
        TagCommand::SetBatch { json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/batch/tag", API_PREFIX), &body)
        }
    }
}

fn dispatch_upstream(client: &ApiClient, up: &UpstreamCommand) -> Result<Value> {
    match up {
        UpstreamCommand::Detect { json } => {
            let body = match json {
                Some(j) => read_json_arg(j)?,
                None => json!({}),
            };
            client.post_json(&format!("{}/upstream_updates/detect", API_PREFIX), &body)
        }
        UpstreamCommand::DetectAll => client.post_json(
            &format!("{}/upstream_updates/detect_all", API_PREFIX),
            &json!({}),
        ),
        UpstreamCommand::Apply { json } => {
            let body = read_json_arg(json)?;
            client.post_json(&format!("{}/upstream_updates/apply", API_PREFIX), &body)
        }
        UpstreamCommand::ApplyAll { json } => {
            let body = match json {
                Some(j) => read_json_arg(j)?,
                None => json!({}),
            };
            client.post_json(&format!("{}/upstream_updates/apply_all", API_PREFIX), &body)
        }
    }
}

fn list_channels(client: &ApiClient, a: &ChannelListArgs) -> Result<Value> {
    let mut q: Vec<(&str, String)> = Vec::new();
    if let Some(p) = a.p {
        q.push(("p", p.to_string()));
    }
    if let Some(ps) = a.page_size {
        q.push(("page_size", ps.to_string()));
    }
    if !a.status.is_empty() {
        q.push(("status", a.status.clone()));
    }
    if let Some(t) = a.r#type {
        q.push(("type", t.to_string()));
    }
    if let Some(g) = &a.group {
        q.push(("group", g.clone()));
    }
    q.push(("id_sort", a.id_sort.to_string()));
    q.push(("tag_mode", a.tag_mode.to_string()));
    if let Some(s) = &a.sort_by {
        q.push(("sort_by", s.clone()));
    }
    if let Some(s) = &a.sort_order {
        q.push(("sort_order", s.clone()));
    }
    client.get(API_PREFIX, &q)
}

fn search_channels(client: &ApiClient, a: &ChannelSearchArgs) -> Result<Value> {
    let mut q: Vec<(&str, String)> = Vec::new();
    q.push(("keyword", a.keyword.clone()));
    if let Some(g) = &a.group {
        q.push(("group", g.clone()));
    }
    if let Some(m) = &a.model {
        q.push(("model", m.clone()));
    }
    if !a.status.is_empty() {
        q.push(("status", a.status.clone()));
    }
    if let Some(t) = a.r#type {
        q.push(("type", t.to_string()));
    }
    q.push(("id_sort", a.id_sort.to_string()));
    q.push(("tag_mode", a.tag_mode.to_string()));
    if let Some(s) = &a.sort_by {
        q.push(("sort_by", s.clone()));
    }
    if let Some(s) = &a.sort_order {
        q.push(("sort_order", s.clone()));
    }
    if let Some(p) = a.p {
        q.push(("p", p.to_string()));
    }
    if let Some(ps) = a.page_size {
        q.push(("page_size", ps.to_string()));
    }
    client.get(&format!("{}/search", API_PREFIX), &q)
}
