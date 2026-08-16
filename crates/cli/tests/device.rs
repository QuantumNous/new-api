//! Integration tests for `device` proxy + instance guards.

use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use newapi_cli_lib::cmd::device::{
    DeviceCommand, InstanceCommand, ProxyBatchCreateArgs, ProxyClearErrorsArgs, ProxyCommand,
    ProxyDeleteArgs,
};
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "t".into()).unwrap()
}

#[test]
fn proxy_list_uses_nodes_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/proxy/nodes");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cli = DeviceCommand::Proxy(ProxyCommand::List);
    let _ = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn proxy_reload_requires_yes() {
    let server = MockServer::start();
    let cli = DeviceCommand::Proxy(ProxyCommand::Reload { yes: false });
    let err = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("--yes"));
}

#[test]
fn proxy_reload_with_yes_hits_endpoint() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST).path("/api/proxy/reload");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = DeviceCommand::Proxy(ProxyCommand::Reload { yes: true });
    let _ = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn proxy_delete_requires_yes() {
    let server = MockServer::start();
    let cli = DeviceCommand::Proxy(ProxyCommand::Delete(ProxyDeleteArgs { id: 9, yes: false }));
    let err = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("--yes"));
}

#[test]
fn proxy_delete_with_yes_hits_endpoint() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/proxy/nodes/9");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = DeviceCommand::Proxy(ProxyCommand::Delete(ProxyDeleteArgs { id: 9, yes: true }));
    let _ = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn proxy_batch_create_requires_yes() {
    let server = MockServer::start();
    let cli = DeviceCommand::Proxy(ProxyCommand::BatchCreate(ProxyBatchCreateArgs {
        json: r#"{"nodes":[]}"#.into(),
        yes: false,
    }));
    let err = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("--yes"));
}

#[test]
fn proxy_clear_errors_requires_yes() {
    let server = MockServer::start();
    let cli = DeviceCommand::Proxy(ProxyCommand::ClearErrors(ProxyClearErrorsArgs {
        json: "{}".into(),
        yes: false,
    }));
    let err = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("--yes"));
}

#[test]
fn instance_list_uses_system_info_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/system-info/instances");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cli = DeviceCommand::Instance(InstanceCommand::List);
    let _ = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn instance_delete_stale_requires_yes() {
    let server = MockServer::start();
    let cli = DeviceCommand::Instance(InstanceCommand::DeleteStale { yes: false });
    let err = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("--yes"));
}

#[test]
fn instance_delete_with_yes_hits_endpoint() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE)
            .path("/api/system-info/instances/node-a");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = DeviceCommand::Instance(InstanceCommand::Delete {
        node_name: "node-a".into(),
        yes: true,
    });
    let _ = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn instance_delete_encodes_node_name() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE)
            .path("/api/system-info/instances/node%2Fa%2Fb");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = DeviceCommand::Instance(InstanceCommand::Delete {
        node_name: "node/a/b".into(),
        yes: true,
    });
    let _ = newapi_cli_lib::cmd::device::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}
