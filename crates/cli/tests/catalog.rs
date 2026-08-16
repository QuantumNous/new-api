//! Integration tests for `catalog` dispatch.

use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use newapi_cli_lib::cmd::catalog::{
    CatalogCommand, ListPageArgs, ModelCommand, ModelSearchArgs, PrefillCommand, SyncCommand,
    VendorCommand,
};
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "t".into()).unwrap()
}

#[test]
fn model_list_uses_models_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/models").query_param("p", "1");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cli = CatalogCommand::Model(ModelCommand::List(ListPageArgs {
        p: Some(1),
        page_size: None,
    }));
    let _ = newapi_cli_lib::cmd::catalog::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn model_search_carries_keyword() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/models/search")
            .query_param("keyword", "gpt");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cli = CatalogCommand::Model(ModelCommand::Search(ModelSearchArgs {
        keyword: "gpt".into(),
        vendor: None,
        status: None,
        sync: None,
        p: None,
        page_size: None,
    }));
    let _ = newapi_cli_lib::cmd::catalog::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn model_missing_uses_correct_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/models/missing");
        then.status(200)
            .json_body(json!({"success": true, "data": ["gpt-x"]}));
    });
    let cli = CatalogCommand::Model(ModelCommand::Missing);
    let out = newapi_cli_lib::cmd::catalog::dispatch(&client_for(&server), &cli).unwrap();
    assert_eq!(out["data"][0], "gpt-x");
    m.assert();
}

#[test]
fn vendor_create_preserves_zero() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/vendors")
            .json_body(json!({"name": "acme", "status": 0}));
        then.status(200)
            .json_body(json!({"success": true, "data": {"id": 5}}));
    });
    let body = json!({"name": "acme", "status": 0}).to_string();
    let cli = CatalogCommand::Vendor(VendorCommand::Create { json: body });
    let _ = newapi_cli_lib::cmd::catalog::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn prefill_create_uses_prefill_group() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/prefill_group")
            .json_body(json!({"name": "pg", "group_type": "model", "items": []}));
        then.status(200)
            .json_body(json!({"success": true, "data": {"id": 2}}));
    });
    let body = json!({"name": "pg", "group_type": "model", "items": []}).to_string();
    let cli = CatalogCommand::Prefill(PrefillCommand::Create { json: body });
    let _ = newapi_cli_lib::cmd::catalog::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn sync_upstream_preview_uses_correct_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/models/sync_upstream/preview");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    let cli = CatalogCommand::Sync(SyncCommand::UpstreamPreview);
    let _ = newapi_cli_lib::cmd::catalog::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn sync_ratio_channels_uses_ratio_sync() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/ratio_sync/channels");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cli = CatalogCommand::Sync(SyncCommand::RatioChannels);
    let _ = newapi_cli_lib::cmd::catalog::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn upstream_apply_asserts_empty_body() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/models/sync_upstream")
            .json_body(json!({}));
        then.status(200)
            .json_body(json!({"success": true, "data": 0}));
    });
    let cli = CatalogCommand::Sync(SyncCommand::UpstreamApply { json: None });
    let _ = newapi_cli_lib::cmd::catalog::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}
