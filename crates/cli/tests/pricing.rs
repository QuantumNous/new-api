//! Integration tests for `pricing` read-modify-write semantics.

use httpmock::prelude::HttpMockRequest;
use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use newapi_cli_lib::cmd::pricing::{
    BasePricingCommand, BaseSetArgs, GroupPricingCommand, ModelPricingCommand, PricingCommand,
};
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "t".into()).unwrap()
}

fn options_with_model_ratio(ratio: &str) -> serde_json::Value {
    json!({
        "ModelRatio": ratio,
        "ModelPrice": "{}",
        "CompletionRatio": "{}",
        "CacheRatio": "{}",
        "CreateCacheRatio": "{}",
        "ImageRatio": "{}",
        "AudioRatio": "{}",
        "AudioCompletionRatio": "{}",
        "GroupRatio": "{}",
        "GroupGroupRatio": "{}",
        "TopupGroupRatio": "{}",
        "Price": "1.0",
        "USDExchangeRate": "7.0",
        "QuotaPerUnit": "500000"
    })
}

fn key_value_ok(req: &HttpMockRequest, expected_key: &str, expected_value: &str) -> bool {
    let body = match req.body.as_deref() {
        Some(b) => b,
        None => return false,
    };
    let v: serde_json::Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return false,
    };
    v.get("key").and_then(|k| k.as_str()) == Some(expected_key)
        && v.get("value").and_then(|x| x.as_str()) == Some(expected_value)
}

#[test]
fn set_ratio_preserves_siblings() {
    let server = MockServer::start();
    let get = server.mock(|when, then| {
        when.method(GET).path("/api/option");
        then.status(200)
            .json_body(options_with_model_ratio(r#"{"gpt-4o":2.5,"claude":1.5}"#));
    });
    let put = server.mock(|when, then| {
        when.method(PUT)
            .path("/api/option")
            .matches(|req| key_value_ok(req, "ModelRatio", r#"{"claude":1.5,"gpt-4o":3.0}"#));
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = PricingCommand::Model(ModelPricingCommand::SetRatio {
        model: "gpt-4o".into(),
        ratio: 3.0,
    });
    let _ = newapi_cli_lib::cmd::pricing::dispatch(&client_for(&server), &cli).unwrap();
    get.assert();
    put.assert();
}

#[test]
fn set_ratio_rejects_non_finite() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/api/option");
        then.status(200).json_body(options_with_model_ratio("{}"));
    });
    let cli = PricingCommand::Model(ModelPricingCommand::SetRatio {
        model: "gpt-4o".into(),
        ratio: f64::NAN,
    });
    let err = newapi_cli_lib::cmd::pricing::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("finite"));
}

#[test]
fn remove_model_omits_it_from_each_map() {
    let server = MockServer::start();
    let get = server.mock(|when, then| {
        when.method(GET).path("/api/option");
        then.status(200)
            .json_body(options_with_model_ratio(r#"{"gpt-4o":2.5,"claude":1.5}"#));
    });
    let put = server.mock(|when, then| {
        when.method(PUT).path("/api/option");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = PricingCommand::Model(ModelPricingCommand::Remove {
        model: "gpt-4o".into(),
    });
    let _ = newapi_cli_lib::cmd::pricing::dispatch(&client_for(&server), &cli).unwrap();
    get.assert_hits(8);
    put.assert_hits(8);
}

#[test]
fn set_group_ratio_targets_group_ratio_key() {
    let server = MockServer::start();
    let get = server.mock(|when, then| {
        when.method(GET).path("/api/option");
        then.status(200)
            .json_body(options_with_model_ratio(r#"{}"#));
    });
    let put = server.mock(|when, then| {
        when.method(PUT)
            .path("/api/option")
            .matches(|req| key_value_ok(req, "GroupRatio", r#"{"vip":0.8}"#));
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = PricingCommand::Group(GroupPricingCommand::SetRatio {
        group: "vip".into(),
        ratio: 0.8,
    });
    let _ = newapi_cli_lib::cmd::pricing::dispatch(&client_for(&server), &cli).unwrap();
    get.assert();
    put.assert();
}

#[test]
fn base_set_uses_correct_keys() {
    let server = MockServer::start();
    let get = server.mock(|when, then| {
        when.method(GET).path("/api/option");
        then.status(200).json_body(options_with_model_ratio("{}"));
    });
    let put_price = server.mock(|when, then| {
        when.method(PUT)
            .path("/api/option")
            .json_body(json!({"key": "Price", "value": "1.5"}));
        then.status(200).json_body(json!({"success": true}));
    });
    let put_usd = server.mock(|when, then| {
        when.method(PUT)
            .path("/api/option")
            .json_body(json!({"key": "USDExchangeRate", "value": "7.2"}));
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = PricingCommand::Base(BasePricingCommand::Set(BaseSetArgs {
        price: Some(1.5),
        usd_exchange_rate: Some(7.2),
        quota_per_unit: None,
    }));
    let _ = newapi_cli_lib::cmd::pricing::dispatch(&client_for(&server), &cli).unwrap();
    get.assert();
    put_price.assert();
    put_usd.assert();
}

#[test]
fn reset_model_ratio_uses_dedicated_endpoint() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST).path("/api/option/rest_model_ratio");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = PricingCommand::ResetModelRatio;
    let _ = newapi_cli_lib::cmd::pricing::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn malformed_option_value_errors() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/api/option");
        then.status(200)
            .json_body(options_with_model_ratio("not json"));
    });
    let cli = PricingCommand::Model(ModelPricingCommand::SetRatio {
        model: "gpt-4o".into(),
        ratio: 1.0,
    });
    let err = newapi_cli_lib::cmd::pricing::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("not a JSON object"));
}

#[test]
fn show_returns_parsed_maps() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/api/option");
        then.status(200)
            .json_body(options_with_model_ratio(r#"{"gpt-4o":2.5}"#));
    });
    let cli = PricingCommand::Show;
    let out = newapi_cli_lib::cmd::pricing::dispatch(&client_for(&server), &cli).unwrap();
    assert_eq!(out["ModelRatio"]["gpt-4o"], 2.5);
    assert_eq!(out["Price"], "1.0");
}
