//! Integration tests for the JSON-first HTTP client (envelope/error path).

use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "secret-token".into()).unwrap()
}

#[test]
fn bearer_token_attached_for_every_method() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET)
            .path("/api/x")
            .header("authorization", "Bearer secret-token");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    let out = client_for(&server).get("/api/x", &[]).unwrap();
    assert!(out["data"].is_object());
    m.assert();
}

#[test]
fn success_envelope_data_passes_through() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/api/x");
        then.status(200)
            .json_body(json!({"success": true, "data": {"v": 1}}));
    });
    let out = client_for(&server).get("/api/x", &[]).unwrap();
    assert_eq!(out["data"]["v"], 1);
}

#[test]
fn success_false_envelope_returns_error() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/api/x");
        then.status(200)
            .json_body(json!({"success": false, "message": "nope"}));
    });
    let err = client_for(&server).get("/api/x", &[]).unwrap_err();
    assert!(err.to_string().contains("nope"));
}

#[test]
fn non_json_body_is_an_error() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/api/x");
        then.status(200).body("<html>oops</html>");
    });
    let err = client_for(&server).get("/api/x", &[]).unwrap_err();
    assert!(err.to_string().contains("non-JSON"));
}
