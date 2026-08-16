//! Integration tests for `usage` dispatch against a mock server.
//!
//! Asserts URL paths/methods/query and that the command only hits
//! self-scoped log / data / drawing / task endpoints. Forbidden filters
//! are rejected before any HTTP call.

use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use newapi_cli_lib::cmd::usage::UsageCommand;
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "t".into()).unwrap()
}

fn d(client: &ApiClient, cmd: &UsageCommand) -> serde_json::Value {
    newapi_cli_lib::cmd::usage::dispatch(client, cmd).unwrap()
}

#[test]
fn log_list_forwards_filters() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/log/self")
            .query_param("p", "1")
            .query_param("page_size", "10")
            .query_param("start_timestamp", "100")
            .query_param("end_timestamp", "200")
            .query_param("model_name", "gpt-4o");
        then.status(200)
            .json_body(json!({"success": true, "data": {"items": []}}));
    });
    d(
        &client_for(&server),
        &UsageCommand::LogList {
            p: Some(1),
            page_size: Some(10),
            start_timestamp: Some(100),
            end_timestamp: Some(200),
            model_name: Some("gpt-4o".into()),
            r#type: None,
            token_name: None,
            request_id: None,
            upstream_request_id: None,
        },
    );
    m.assert();
}

#[test]
fn log_list_omits_unset() {
    let server = MockServer::start();
    let _m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/log/self")
            .matches(|req| req.query_params.as_ref().is_none_or(Vec::is_empty));
        then.status(200)
            .json_body(json!({"success": true, "data": {"items": []}}));
    });
    d(
        &client_for(&server),
        &UsageCommand::LogList {
            p: None,
            page_size: None,
            start_timestamp: None,
            end_timestamp: None,
            model_name: None,
            r#type: None,
            token_name: None,
            request_id: None,
            upstream_request_id: None,
        },
    );
    _m.assert();
}

#[test]
fn log_search_hits_self_search() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/log/self/search")
            .query_param("keyword", "foo");
        then.status(200)
            .json_body(json!({"success": true, "data": {"items": []}}));
    });
    d(
        &client_for(&server),
        &UsageCommand::LogSearch {
            keyword: "foo".into(),
            p: None,
            page_size: None,
        },
    );
    m.assert();
}

#[test]
fn log_stat_hits_self_stat() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/log/self/stat");
        then.status(200)
            .json_body(json!({"success": true, "data": {"quota": 0}}));
    });
    d(
        &client_for(&server),
        &UsageCommand::LogStat {
            start_timestamp: None,
            end_timestamp: None,
            model_name: None,
            token_name: None,
        },
    );
    m.assert();
}

#[test]
fn drawing_list_hits_mj_self() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/mj/self");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    d(
        &client_for(&server),
        &UsageCommand::DrawingList {
            p: None,
            page_size: None,
        },
    );
    m.assert();
}

#[test]
fn task_list_hits_task_self() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/task/self");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    d(
        &client_for(&server),
        &UsageCommand::TaskList {
            p: None,
            page_size: None,
        },
    );
    m.assert();
}

#[test]
fn quota_dates_hits_data_self() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/data/self")
            .query_param("start_timestamp", "100")
            .query_param("end_timestamp", "200");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    d(
        &client_for(&server),
        &UsageCommand::QuotaDates {
            start_timestamp: Some(100),
            end_timestamp: Some(200),
        },
    );
    m.assert();
}

#[test]
fn flow_dates_hits_data_flow_self() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/data/flow/self");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    d(
        &client_for(&server),
        &UsageCommand::FlowDates {
            start_timestamp: None,
            end_timestamp: None,
        },
    );
    m.assert();
}

#[test]
fn usage_never_hits_admin_log_root() {
    // Only /api/log/self* paths are configured; if any other /api/log
    // path were ever hit, dispatch would error and the test would fail.
    let server = MockServer::start();
    let self_m = server.mock(|when, then| {
        when.method(GET).path("/api/log/self");
        then.status(200)
            .json_body(json!({"success": true, "data": {"items": []}}));
    });
    d(
        &client_for(&server),
        &UsageCommand::LogList {
            p: None,
            page_size: None,
            start_timestamp: None,
            end_timestamp: None,
            model_name: None,
            r#type: None,
            token_name: None,
            request_id: None,
            upstream_request_id: None,
        },
    );
    self_m.assert();
}
