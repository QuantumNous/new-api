//! `pricing` command — model and group rate management via the option API.
//!
//! Every map write is read-modify-write: read the current full option
//! `value` (a JSON string), mutate only the targeted entry, and PUT the
//! entire map back. Other entries are never overwritten.
//!
//! Server stores each option value as a JSON string; we parse on read and
//! serialize on write to avoid silently dropping siblings.

use anyhow::{anyhow, bail, Context, Result};
use clap::{Args, Subcommand};
use serde_json::{json, Map, Value};

use crate::client::ApiClient;
use crate::json_input::read_json_arg;
use crate::output::print_json;

const OPTION: &str = "/api/option";

const K_MODEL_RATIO: &str = "ModelRatio";
const K_MODEL_PRICE: &str = "ModelPrice";
const K_COMPLETION_RATIO: &str = "CompletionRatio";
const K_CACHE_RATIO: &str = "CacheRatio";
const K_CREATE_CACHE_RATIO: &str = "CreateCacheRatio";
const K_IMAGE_RATIO: &str = "ImageRatio";
const K_AUDIO_RATIO: &str = "AudioRatio";
const K_AUDIO_COMPLETION_RATIO: &str = "AudioCompletionRatio";
const K_GROUP_RATIO: &str = "GroupRatio";
const K_GROUP_GROUP_RATIO: &str = "GroupGroupRatio";
const K_TOPUP_GROUP_RATIO: &str = "TopupGroupRatio";
const K_PRICE: &str = "Price";
const K_USD_RATE: &str = "USDExchangeRate";
const K_QUOTA_PER_UNIT: &str = "QuotaPerUnit";

const MODEL_MAP_KEYS: [&str; 8] = [
    K_MODEL_RATIO,
    K_MODEL_PRICE,
    K_COMPLETION_RATIO,
    K_CACHE_RATIO,
    K_CREATE_CACHE_RATIO,
    K_IMAGE_RATIO,
    K_AUDIO_RATIO,
    K_AUDIO_COMPLETION_RATIO,
];

/// Read the full option map from the server and return the parsed JSON
/// value of `key`. If the key is missing or its value is empty, return
/// an empty object so callers can `insert`/mutate.
fn load_map(client: &ApiClient, key: &str) -> Result<Map<String, Value>> {
    let resp = client.get(OPTION, &[])?;
    let raw = resp.get(key).and_then(|v| v.as_str()).unwrap_or("");
    if raw.is_empty() {
        return Ok(Map::new());
    }
    let v: Value = serde_json::from_str(raw)
        .with_context(|| format!("option {key} is not a JSON object string"))?;
    match v {
        Value::Object(m) => Ok(m),
        other => bail!("option {key} expected JSON object, got {other}"),
    }
}

/// Serialize a map to its JSON-string representation for option storage.
/// Avoids deep-cloning by reusing the same `Map` via `into()`.
fn store_map(map: &Map<String, Value>) -> Result<String> {
    serde_json::to_string(&Value::Object(map.clone())).context("serializing pricing map")
}

/// Read-modify-write a single map option, preserving siblings.
fn write_map_entry(
    client: &ApiClient,
    key: &str,
    entry_key: &str,
    entry_value: Option<f64>,
) -> Result<Value> {
    let mut map = load_map(client, key)?;
    match entry_value {
        Some(v) => {
            if !v.is_finite() {
                bail!("ratio/price must be finite (got {v} for {entry_key})");
            }
            map.insert(entry_key.to_string(), json!(v));
        }
        None => {
            map.remove(entry_key);
        }
    }
    let serialized = store_map(&map)?;
    client.put_json(OPTION, &json!({ "key": key, "value": serialized }))
}

/// Look up `key` in an options response, returning the parsed JSON value
/// (object/string/number) or a sensible default if the key is absent.
fn lookup(opts: &Value, key: &str) -> Value {
    let raw = opts.get(key).and_then(|v| v.as_str()).unwrap_or("");
    if raw.is_empty() {
        return match key {
            K_GROUP_GROUP_RATIO | K_TOPUP_GROUP_RATIO => Value::Null,
            _ => Value::Object(Map::new()),
        };
    }
    serde_json::from_str(raw).unwrap_or(Value::Null)
}

#[derive(Args)]
pub struct BaseSetArgs {
    #[arg(long)]
    pub price: Option<f64>,
    #[arg(long)]
    pub usd_exchange_rate: Option<f64>,
    #[arg(long)]
    pub quota_per_unit: Option<f64>,
}

#[derive(Subcommand)]
pub enum ModelPricingCommand {
    /// Get all model rates (ModelRatio, ModelPrice, CompletionRatio, CacheRatio, ImageRatio, AudioRatio)
    Get { model: String },
    /// Set ModelRatio for a model
    SetRatio { model: String, ratio: f64 },
    /// Set ModelPrice for a model
    SetPrice { model: String, price: f64 },
    /// Set CompletionRatio for a model
    SetCompletionRatio { model: String, ratio: f64 },
    /// Set CacheRatio for a model
    SetCacheRatio { model: String, ratio: f64 },
    /// Set CreateCacheRatio for a model
    SetCreateCacheRatio { model: String, ratio: f64 },
    /// Set ImageRatio for a model
    SetImageRatio { model: String, ratio: f64 },
    /// Set AudioRatio for a model
    SetAudioRatio { model: String, ratio: f64 },
    /// Set AudioCompletionRatio for a model
    SetAudioCompletionRatio { model: String, ratio: f64 },
    /// Remove a model from all pricing maps
    Remove { model: String },
}

#[derive(Subcommand)]
pub enum GroupPricingCommand {
    /// Get GroupRatio entry for a group
    Get { group: String },
    /// Set GroupRatio for a group
    SetRatio { group: String, ratio: f64 },
    /// Remove a group from GroupRatio
    Remove { group: String },
}

#[derive(Subcommand)]
pub enum BasePricingCommand {
    /// Get Price / USDExchangeRate / QuotaPerUnit
    Get,
    /// Set any subset of Price / USDExchangeRate / QuotaPerUnit
    Set(BaseSetArgs),
}

#[derive(Subcommand)]
pub enum PricingCommand {
    /// Show the full pricing snapshot (all model/group maps + base scalars)
    Show,
    /// Export the pricing snapshot as a single JSON object
    Export,
    /// Import a partial snapshot (only specified keys are written)
    Import { json: String },
    /// Model-scoped pricing actions
    #[command(subcommand)]
    Model(ModelPricingCommand),
    /// Group-scoped pricing actions (GroupRatio only)
    #[command(subcommand)]
    Group(GroupPricingCommand),
    /// Base scalars (Price / USDExchangeRate / QuotaPerUnit)
    #[command(subcommand)]
    Base(BasePricingCommand),
    /// Reset ModelRatio via the dedicated endpoint
    ResetModelRatio,
}

pub fn run(client: &ApiClient, cmd: &PricingCommand) -> Result<()> {
    let result = dispatch(client, cmd)?;
    print_json(&result)?;
    Ok(())
}

pub fn dispatch(client: &ApiClient, cmd: &PricingCommand) -> Result<Value> {
    match cmd {
        PricingCommand::Show => show(client),
        PricingCommand::Export => show(client),
        PricingCommand::Import { json } => import(client, json),
        PricingCommand::Model(m) => dispatch_model(client, m),
        PricingCommand::Group(g) => dispatch_group(client, g),
        PricingCommand::Base(b) => dispatch_base(client, b),
        PricingCommand::ResetModelRatio => client.post_json(
            &format!("{}/rest_model_ratio", OPTION),
            &Value::Object(Default::default()),
        ),
    }
}

fn show(client: &ApiClient) -> Result<Value> {
    let opts = client.get(OPTION, &[])?;
    let mut out = Map::new();
    for k in MODEL_MAP_KEYS.iter() {
        out.insert((*k).to_string(), lookup(&opts, k));
    }
    out.insert(K_GROUP_RATIO.to_string(), lookup(&opts, K_GROUP_RATIO));
    out.insert(
        K_GROUP_GROUP_RATIO.to_string(),
        lookup(&opts, K_GROUP_GROUP_RATIO),
    );
    out.insert(
        K_TOPUP_GROUP_RATIO.to_string(),
        lookup(&opts, K_TOPUP_GROUP_RATIO),
    );
    out.insert(
        K_PRICE.to_string(),
        Value::String(
            opts.get(K_PRICE)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        ),
    );
    out.insert(
        K_USD_RATE.to_string(),
        Value::String(
            opts.get(K_USD_RATE)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        ),
    );
    out.insert(
        K_QUOTA_PER_UNIT.to_string(),
        Value::String(
            opts.get(K_QUOTA_PER_UNIT)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        ),
    );
    Ok(Value::Object(out))
}

fn import(client: &ApiClient, raw: &str) -> Result<Value> {
    let body: Value = read_json_arg(raw)?;
    let obj = body
        .as_object()
        .ok_or_else(|| anyhow!("import body must be a JSON object"))?;
    for (key, value) in obj {
        match key.as_str() {
            K_MODEL_RATIO
            | K_MODEL_PRICE
            | K_COMPLETION_RATIO
            | K_CACHE_RATIO
            | K_CREATE_CACHE_RATIO
            | K_IMAGE_RATIO
            | K_AUDIO_RATIO
            | K_AUDIO_COMPLETION_RATIO
            | K_GROUP_RATIO => {
                let map = value
                    .as_object()
                    .ok_or_else(|| anyhow!("{key} must be a JSON object"))?;
                let serialized = store_map(map)?;
                client.put_json(OPTION, &json!({ "key": key, "value": serialized }))?;
            }
            K_PRICE | K_USD_RATE | K_QUOTA_PER_UNIT => {
                let v = value
                    .as_f64()
                    .ok_or_else(|| anyhow!("{key} must be a number"))?;
                if !v.is_finite() {
                    bail!("{key} must be finite");
                }
                client.put_json(OPTION, &json!({ "key": key, "value": v.to_string() }))?;
            }
            _ => {
                // Ignore unknown keys so export-then-edit round-trips cleanly.
            }
        }
    }
    show(client)
}

fn dispatch_model(client: &ApiClient, m: &ModelPricingCommand) -> Result<Value> {
    match m {
        ModelPricingCommand::Get { model } => show_model(client, model),
        ModelPricingCommand::SetRatio { model, ratio } => {
            write_map_entry(client, K_MODEL_RATIO, model, Some(*ratio))
        }
        ModelPricingCommand::SetPrice { model, price } => {
            write_map_entry(client, K_MODEL_PRICE, model, Some(*price))
        }
        ModelPricingCommand::SetCompletionRatio { model, ratio } => {
            write_map_entry(client, K_COMPLETION_RATIO, model, Some(*ratio))
        }
        ModelPricingCommand::SetCacheRatio { model, ratio } => {
            write_map_entry(client, K_CACHE_RATIO, model, Some(*ratio))
        }
        ModelPricingCommand::SetCreateCacheRatio { model, ratio } => {
            write_map_entry(client, K_CREATE_CACHE_RATIO, model, Some(*ratio))
        }
        ModelPricingCommand::SetImageRatio { model, ratio } => {
            write_map_entry(client, K_IMAGE_RATIO, model, Some(*ratio))
        }
        ModelPricingCommand::SetAudioRatio { model, ratio } => {
            write_map_entry(client, K_AUDIO_RATIO, model, Some(*ratio))
        }
        ModelPricingCommand::SetAudioCompletionRatio { model, ratio } => {
            write_map_entry(client, K_AUDIO_COMPLETION_RATIO, model, Some(*ratio))
        }
        ModelPricingCommand::Remove { model } => remove_model(client, model),
    }
}

fn dispatch_group(client: &ApiClient, g: &GroupPricingCommand) -> Result<Value> {
    match g {
        GroupPricingCommand::Get { group } => {
            let map = load_map(client, K_GROUP_RATIO)?;
            Ok(Value::Object({
                let mut m = Map::new();
                if let Some(v) = map.get(group) {
                    m.insert(group.clone(), v.clone());
                }
                m
            }))
        }
        GroupPricingCommand::SetRatio { group, ratio } => {
            write_map_entry(client, K_GROUP_RATIO, group, Some(*ratio))
        }
        GroupPricingCommand::Remove { group } => {
            write_map_entry(client, K_GROUP_RATIO, group, None)
        }
    }
}

fn dispatch_base(client: &ApiClient, b: &BasePricingCommand) -> Result<Value> {
    match b {
        BasePricingCommand::Get => {
            let opts = client.get(OPTION, &[])?;
            Ok(json!({
                K_PRICE: opts.get(K_PRICE).and_then(|v| v.as_str()).unwrap_or(""),
                K_USD_RATE: opts.get(K_USD_RATE).and_then(|v| v.as_str()).unwrap_or(""),
                K_QUOTA_PER_UNIT: opts.get(K_QUOTA_PER_UNIT).and_then(|v| v.as_str()).unwrap_or(""),
            }))
        }
        BasePricingCommand::Set(args) => {
            if let Some(v) = args.price {
                if !v.is_finite() {
                    bail!("price must be finite");
                }
                client.put_json(OPTION, &json!({ "key": K_PRICE, "value": v.to_string() }))?;
            }
            if let Some(v) = args.usd_exchange_rate {
                if !v.is_finite() {
                    bail!("usd_exchange_rate must be finite");
                }
                client.put_json(
                    OPTION,
                    &json!({ "key": K_USD_RATE, "value": v.to_string() }),
                )?;
            }
            if let Some(v) = args.quota_per_unit {
                if !v.is_finite() {
                    bail!("quota_per_unit must be finite");
                }
                client.put_json(
                    OPTION,
                    &json!({ "key": K_QUOTA_PER_UNIT, "value": v.to_string() }),
                )?;
            }
            let opts = client.get(OPTION, &[])?;
            Ok(json!({
                K_PRICE: opts.get(K_PRICE).and_then(|v| v.as_str()).unwrap_or(""),
                K_USD_RATE: opts.get(K_USD_RATE).and_then(|v| v.as_str()).unwrap_or(""),
                K_QUOTA_PER_UNIT: opts.get(K_QUOTA_PER_UNIT).and_then(|v| v.as_str()).unwrap_or(""),
            }))
        }
    }
}

fn show_model(client: &ApiClient, model: &str) -> Result<Value> {
    let opts = client.get(OPTION, &[])?;
    let mut out = Map::new();
    for k in MODEL_MAP_KEYS.iter() {
        let map = lookup(&opts, k);
        if let Some(v) = map.get(model) {
            out.insert((*k).to_string(), v.clone());
        }
    }
    Ok(Value::Object(out))
}

fn remove_model(client: &ApiClient, model: &str) -> Result<Value> {
    for k in MODEL_MAP_KEYS.iter() {
        write_map_entry(client, k, model, None)?;
    }
    Ok(Value::Object(Map::new()))
}
