//! Integration tests for `system` dispatch against a mock server.
//!
//! Asserts URL paths/methods/query for every mapped endpoint, the `--yes` guard
//! (no HTTP when `--yes` is absent on destructive ops), and that the `log`
//! subcommand only ever hits admin paths (never `/self`).

use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use newapi_cli_lib::cmd::system::{
    LogCommand, LogListArgs, LogStatArgs, PerformanceCommand, SystemCommand, TaskCommand,
};
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "test-token".into()).unwrap()
}

fn d(client: &ApiClient, cmd: &SystemCommand) -> serde_json::Value {
    newapi_cli_lib::cmd::system::dispatch(client, cmd).unwrap()
}

// ---- performance read ----

#[test]
fn performance_stats_hits_stats() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/performance/stats");
        then.status(200)
            .json_body(json!({"success": true, "data": {"memory": {}}}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::Stats);
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn performance_log_files_hits_logs() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/performance/logs");
        then.status(200)
            .json_body(json!({"success": true, "data": {"enabled": false}}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::LogFiles);
    d(&client_for(&server), &cmd);
    m.assert();
}

// ---- performance destructive + --yes guard ----

#[test]
fn disk_cache_clear_without_yes_sends_no_http() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/performance/disk_cache");
        then.status(200).json_body(json!({"success": true}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::DiskCacheClear { yes: false });
    let res = newapi_cli_lib::cmd::system::dispatch(&client_for(&server), &cmd);
    assert!(res.is_err(), "must refuse without --yes");
    assert_eq!(m.hits(), 0, "no HTTP must be sent without --yes");
}

#[test]
fn disk_cache_clear_with_yes_deletes_disk_cache() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/performance/disk_cache");
        then.status(200)
            .json_body(json!({"success": true, "message": "ok"}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::DiskCacheClear { yes: true });
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn stats_reset_with_yes_posts_reset_stats() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST).path("/api/performance/reset_stats");
        then.status(200).json_body(json!({"success": true}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::StatsReset { yes: true });
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn gc_with_yes_posts_gc() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST).path("/api/performance/gc");
        then.status(200).json_body(json!({"success": true}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::Gc { yes: true });
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn log_files_cleanup_without_yes_sends_no_http() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/performance/logs");
        then.status(200).json_body(json!({"success": true}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::LogFilesCleanup {
        mode: "by_count".into(),
        value: 2,
        yes: false,
    });
    let res = newapi_cli_lib::cmd::system::dispatch(&client_for(&server), &cmd);
    assert!(res.is_err());
    assert_eq!(m.hits(), 0);
}

#[test]
fn log_files_cleanup_bad_mode_sends_no_http() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/performance/logs");
        then.status(200).json_body(json!({"success": true}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::LogFilesCleanup {
        mode: "nope".into(),
        value: 2,
        yes: true,
    });
    let res = newapi_cli_lib::cmd::system::dispatch(&client_for(&server), &cmd);
    assert!(
        res.is_err(),
        "invalid mode must be rejected even with --yes"
    );
    assert_eq!(m.hits(), 0);
}

#[test]
fn log_files_cleanup_with_yes_by_count() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE)
            .path("/api/performance/logs")
            .query_param("mode", "by_count")
            .query_param("value", "3");
        then.status(200)
            .json_body(json!({"success": true, "data": {"deleted_count": 3}}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::LogFilesCleanup {
        mode: "by_count".into(),
        value: 3,
        yes: true,
    });
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn log_files_cleanup_with_yes_by_days() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE)
            .path("/api/performance/logs")
            .query_param("mode", "by_days")
            .query_param("value", "7");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    let cmd = SystemCommand::Performance(PerformanceCommand::LogFilesCleanup {
        mode: "by_days".into(),
        value: 7,
        yes: true,
    });
    d(&client_for(&server), &cmd);
    m.assert();
}

// ---- task ----

#[test]
fn task_list_with_limit() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/system-task/list")
            .query_param("limit", "10");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cmd = SystemCommand::Task(TaskCommand::List { limit: Some(10) });
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn task_current_default_type() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/system-task/current")
            .query_param("type", "log_cleanup");
        then.status(200)
            .json_body(json!({"success": true, "data": null}));
    });
    let cmd = SystemCommand::Task(TaskCommand::Current {
        r#type: "log_cleanup".into(),
    });
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn task_get_by_id() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/system-task/abc-123");
        then.status(200)
            .json_body(json!({"success": true, "data": {"task_id": "abc-123"}}));
    });
    let cmd = SystemCommand::Task(TaskCommand::Get {
        task_id: "abc-123".into(),
    });
    let out = d(&client_for(&server), &cmd);
    assert_eq!(out["data"]["task_id"], json!("abc-123"));
    m.assert();
}

#[test]
fn task_log_cleanup_without_yes_sends_no_http() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST).path("/api/system-task/log-cleanup");
        then.status(200).json_body(json!({"success": true}));
    });
    let cmd = SystemCommand::Task(TaskCommand::LogCleanup {
        target_timestamp: 1000,
        yes: false,
    });
    let res = newapi_cli_lib::cmd::system::dispatch(&client_for(&server), &cmd);
    assert!(res.is_err());
    assert_eq!(m.hits(), 0);
}

#[test]
fn task_log_cleanup_with_yes_posts_query() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/system-task/log-cleanup")
            .query_param("target_timestamp", "1700000000");
        then.status(200)
            .json_body(json!({"success": true, "data": {"task_id": "t1"}}));
    });
    let cmd = SystemCommand::Task(TaskCommand::LogCleanup {
        target_timestamp: 1700000000,
        yes: true,
    });
    d(&client_for(&server), &cmd);
    m.assert();
}

// ---- log (admin only) ----

#[test]
fn log_list_admin_path_with_filters() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/log")
            .query_param("p", "1")
            .query_param("page_size", "5")
            .query_param("type", "0")
            .query_param("username", "alice")
            .query_param("channel", "3")
            .query_param("group", "default")
            .query_param("model_name", "gpt-4o")
            .query_param("token_name", "tok")
            .query_param("start_timestamp", "100")
            .query_param("end_timestamp", "200")
            .query_param("request_id", "req")
            .query_param("upstream_request_id", "ureq");
        then.status(200)
            .json_body(json!({"success": true, "data": {"items": [], "total": 0}}));
    });
    let cmd = SystemCommand::Log(LogCommand::List(LogListArgs {
        p: Some(1),
        page_size: Some(5),
        r#type: Some(0),
        username: Some("alice".into()),
        token_name: Some("tok".into()),
        model_name: Some("gpt-4o".into()),
        start_timestamp: Some(100),
        end_timestamp: Some(200),
        channel: Some(3),
        group: Some("default".into()),
        request_id: Some("req".into()),
        upstream_request_id: Some("ureq".into()),
    }));
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn log_list_omits_unset_filters() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/log").matches(|req| {
            // only path, no query params at all
            req.query_params.as_ref().is_none_or(Vec::is_empty)
        });
        then.status(200)
            .json_body(json!({"success": true, "data": {"items": [], "total": 0}}));
    });
    let cmd = SystemCommand::Log(LogCommand::List(LogListArgs {
        p: None,
        page_size: None,
        r#type: None,
        username: None,
        token_name: None,
        model_name: None,
        start_timestamp: None,
        end_timestamp: None,
        channel: None,
        group: None,
        request_id: None,
        upstream_request_id: None,
    }));
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn log_stat_admin_path_with_filters() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/log/stat")
            .query_param("type", "1")
            .query_param("username", "alice")
            .query_param("channel", "3");
        then.status(200)
            .json_body(json!({"success": true, "data": {"quota": 0, "rpm": 0, "tpm": 0}}));
    });
    let cmd = SystemCommand::Log(LogCommand::Stat(LogStatArgs {
        r#type: Some(1),
        username: Some("alice".into()),
        token_name: None,
        model_name: None,
        start_timestamp: None,
        end_timestamp: None,
        channel: Some(3),
        group: None,
    }));
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn log_search_admin_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/log/search");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cmd = SystemCommand::Log(LogCommand::Search);
    d(&client_for(&server), &cmd);
    m.assert();
}

#[test]
fn log_never_hits_self_path() {
    // Any mock on /api/log/self would be a bug: guard that the admin list path
    // is exactly /api/log and never /api/log/self. httpmock fails if a declared
    // mock is hit; here we assert the expected path is hit (confirmed by the
    // other tests above) — this is a guard test: no /self mock is configured, so
    // if the client ever strays there the request itself errors out.
    let server = MockServer::start();
    let admin = server.mock(|when, then| {
        when.method(GET).path("/api/log");
        then.status(200)
            .json_body(json!({"success": true, "data": {"items": [], "total": 0}}));
    });
    let self_m = server.mock(|when, then| {
        when.method(GET).path("/api/log/self");
        then.status(403)
            .json_body(json!({"success": false, "message": "must not hit self"}));
    });
    let cmd = SystemCommand::Log(LogCommand::List(LogListArgs {
        p: None,
        page_size: None,
        r#type: None,
        username: None,
        token_name: None,
        model_name: None,
        start_timestamp: None,
        end_timestamp: None,
        channel: None,
        group: None,
        request_id: None,
        upstream_request_id: None,
    }));
    d(&client_for(&server), &cmd);
    admin.assert();
    assert_eq!(self_m.hits(), 0, "system log must never hit /api/log/self");
}

#[test]
fn log_403_preserves_server_message() {
    let server = MockServer::start();
    let _ = server.mock(|when, then| {
        when.method(GET).path("/api/log");
        then.status(403)
            .json_body(json!({"success": false, "message": "no admin permission"}));
    });
    let cmd = SystemCommand::Log(LogCommand::List(LogListArgs {
        p: None,
        page_size: None,
        r#type: None,
        username: None,
        token_name: None,
        model_name: None,
        start_timestamp: None,
        end_timestamp: None,
        channel: None,
        group: None,
        request_id: None,
        upstream_request_id: None,
    }));
    let res = newapi_cli_lib::cmd::system::dispatch(&client_for(&server), &cmd);
    let err = res.unwrap_err().to_string();
    assert!(
        err.contains("no admin permission"),
        "403 server message must be surfaced: got {err}"
    );
}
