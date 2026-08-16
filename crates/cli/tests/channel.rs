//! Integration tests for `channel` dispatch against a mock server.
//!
//! Uses `httpmock` to assert URL paths/methods and to feed canned responses.
//! Secret redaction is verified by asserting the request body when the server
//! captures it: the bearer token must be present, but request bodies never
//! echo server-side secrets back.

use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use newapi_cli_lib::cmd::channel::{
    ChannelCommand, ChannelListArgs, ChannelSearchArgs, TagCommand, UpstreamCommand,
};
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "test-token".into()).unwrap()
}

#[test]
fn list_channels_hits_root_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/channel")
            .query_param("status", "enabled");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });

    let cli = ChannelCommand::List(ChannelListArgs {
        p: None,
        page_size: None,
        status: "enabled".into(),
        r#type: None,
        group: None,
        id_sort: false,
        tag_mode: false,
        sort_by: None,
        sort_order: None,
    });
    let out = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    assert_eq!(out["data"], json!([]));
    m.assert();
}

#[test]
fn search_channels_carries_keyword() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/channel/search")
            .query_param("keyword", "openai");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });

    let cli = ChannelCommand::Search(ChannelSearchArgs {
        keyword: "openai".into(),
        group: None,
        model: None,
        status: "".into(),
        r#type: None,
        id_sort: false,
        tag_mode: false,
        sort_by: None,
        sort_order: None,
        p: None,
        page_size: None,
    });
    let _ = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn get_channel_uses_id_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/channel/42");
        then.status(200)
            .json_body(json!({"success": true, "data": {"id": 42, "key": "[REDACTED]"}}));
    });

    let cli = ChannelCommand::Get { id: 42 };
    let out = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    assert_eq!(out["data"]["id"], 42);
    m.assert();
}

#[test]
fn create_channel_preserves_zero_and_false() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/channel")
            .header("content-type", "application/json")
            .json_body(json!({
                "mode": "single",
                "channel": {
                    "name": "openai-zero",
                    "type": 1,
                    "key": "sk-test",
                    "priority": 0,
                    "weight": 0,
                    "auto_ban": 0,
                    "force_format": false,
                    "setting": "{\"force_format\":false}",
                    "settings": "{\"disable_store\":false}"
                }
            }));
        then.status(200)
            .json_body(json!({"success": true, "data": {"id": 7}}));
    });

    let body = json!({
        "mode": "single",
        "channel": {
            "name": "openai-zero",
            "type": 1,
            "key": "sk-test",
            "priority": 0,
            "weight": 0,
            "auto_ban": 0,
            "force_format": false,
            "setting": "{\"force_format\":false}",
            "settings": "{\"disable_store\":false}"
        }
    })
    .to_string();
    let cli = ChannelCommand::Create { json: body };
    let out = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    assert_eq!(out["data"]["id"], 7);
    m.assert();
}

#[test]
fn copy_uses_query_no_body() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/channel/copy/11")
            .query_param("suffix", "v2")
            .query_param("reset_balance", "false");
        then.status(200)
            .json_body(json!({"success": true, "data": {"id": 12}}));
    });

    let cli = ChannelCommand::Copy {
        id: 11,
        suffix: Some("v2".into()),
        reset_balance: false,
    };
    let _ = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn delete_disabled_hits_correct_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/channel/disabled");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = ChannelCommand::DeleteDisabled;
    let _ = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn test_channel_with_id_uses_test_id_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/channel/test/3")
            .query_param("model", "gpt-4o")
            .query_param("stream", "true");
        then.status(200)
            .json_body(json!({"success": true, "data": {"ok": true}}));
    });
    let cli = ChannelCommand::Test {
        id: Some(3),
        model: Some("gpt-4o".into()),
        endpoint_type: None,
        stream: true,
    };
    let _ = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn set_status_hits_id_status_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/channel/5/status")
            .json_body(json!({"status": 2}));
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = ChannelCommand::SetStatus { id: 5, status: 2 };
    let _ = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn tag_enable_hits_tag_enabled() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/channel/tag/enabled")
            .json_body(json!({"tag": "vip"}));
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = ChannelCommand::Tag(TagCommand::Enable { tag: "vip".into() });
    let _ = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn upstream_detect_all_uses_correct_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/channel/upstream_updates/detect_all");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cli = ChannelCommand::Upstream(UpstreamCommand::DetectAll);
    let _ = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn bearer_token_is_attached() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/channel/ops")
            .header("authorization", "Bearer test-token");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    let cli = ChannelCommand::Ops;
    let _ = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn server_envelope_success_false_errors() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/channel/ops");
        then.status(200)
            .json_body(json!({"success": false, "message": "permission denied"}));
    });
    let cli = ChannelCommand::Ops;
    let err = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("permission denied"));
    m.assert();
}

#[test]
fn http_404_surfaces_status_and_message() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/channel/9999");
        then.status(404)
            .json_body(json!({"success": false, "message": "channel not found"}));
    });
    let cli = ChannelCommand::Get { id: 9999 };
    let err = newapi_cli_lib::cmd::channel::dispatch(&client_for(&server), &cli).unwrap_err();
    let msg = err.to_string();
    assert!(msg.contains("404"), "missing 404 in: {msg}");
    assert!(
        msg.contains("channel not found"),
        "missing message in: {msg}"
    );
    m.assert();
}
