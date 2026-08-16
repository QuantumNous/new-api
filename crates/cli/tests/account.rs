//! Integration tests for `account` dispatch against a mock server.
//!
//! Asserts URL paths/methods and the `--yes` guard on destructive
//! account-level operations (delete, 2FA disable, OAuth unlink,
//! affiliate transfer).

use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use newapi_cli_lib::cmd::account::AccountCommand;
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "t".into()).unwrap()
}

fn d(client: &ApiClient, cmd: &AccountCommand) -> serde_json::Value {
    newapi_cli_lib::cmd::account::dispatch(client, cmd).unwrap()
}

#[test]
fn show_hits_user_self() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/user/self");
        then.status(200)
            .json_body(json!({"success": true, "data": {"id": 1}}));
    });
    d(&client_for(&server), &AccountCommand::Show);
    m.assert();
}

#[test]
fn update_uses_put() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(PUT).path("/api/user/self");
        then.status(200).json_body(json!({"success": true}));
    });
    let body = json!({"display_name": "x"}).to_string();
    d(&client_for(&server), &AccountCommand::Update { json: body });
    m.assert();
}

#[test]
fn delete_without_yes_sends_no_http() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/user/self");
        then.status(200).json_body(json!({"success": true}));
    });
    let res = newapi_cli_lib::cmd::account::dispatch(
        &client_for(&server),
        &AccountCommand::Delete { yes: false },
    );
    assert!(res.is_err());
    assert_eq!(m.hits(), 0);
}

#[test]
fn delete_with_yes_hits_endpoint() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/user/self");
        then.status(200).json_body(json!({"success": true}));
    });
    d(&client_for(&server), &AccountCommand::Delete { yes: true });
    m.assert();
}

#[test]
fn groups_hits_self_groups() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/user/self/groups");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    d(&client_for(&server), &AccountCommand::Groups);
    m.assert();
}

#[test]
fn models_hits_user_models() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/user/models");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    d(&client_for(&server), &AccountCommand::Models);
    m.assert();
}

#[test]
fn change_password_hits_change_password_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/user/self/change_password")
            .json_body(json!({"old_password": "a", "new_password": "b"}));
        then.status(200).json_body(json!({"success": true}));
    });
    let body = json!({"old_password": "a", "new_password": "b"}).to_string();
    d(
        &client_for(&server),
        &AccountCommand::ChangePassword { json: body },
    );
    m.assert();
}

#[test]
fn disable_2fa_without_yes_sends_no_http() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/user/self/2fa");
        then.status(200).json_body(json!({"success": true}));
    });
    let res = newapi_cli_lib::cmd::account::dispatch(
        &client_for(&server),
        &AccountCommand::Disable2fa { yes: false },
    );
    assert!(res.is_err());
    assert_eq!(m.hits(), 0);
}

#[test]
fn disable_2fa_with_yes_hits_endpoint() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/user/self/2fa");
        then.status(200).json_body(json!({"success": true}));
    });
    d(
        &client_for(&server),
        &AccountCommand::Disable2fa { yes: true },
    );
    m.assert();
}

#[test]
fn oauth_list_hits_self_oauth() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/user/self/oauth");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    d(&client_for(&server), &AccountCommand::Oauth);
    m.assert();
}

#[test]
fn oauth_unlink_uses_provider_path_and_yes() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/user/self/oauth/wechat");
        then.status(200).json_body(json!({"success": true}));
    });
    d(
        &client_for(&server),
        &AccountCommand::UnlinkOauth {
            provider: "wechat".into(),
            yes: true,
        },
    );
    m.assert();
}

#[test]
fn topup_info_hits_topup_info() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/user/topup/info");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    d(&client_for(&server), &AccountCommand::TopupInfo);
    m.assert();
}

#[test]
fn redeem_posts_to_topup() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/user/topup")
            .json_body(json!({"redemption_code": "ABC"}));
        then.status(200).json_body(json!({"success": true}));
    });
    let body = json!({"redemption_code": "ABC"}).to_string();
    d(&client_for(&server), &AccountCommand::Redeem { json: body });
    m.assert();
}

#[test]
fn topup_history_hits_topup_self() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/user/topup/self");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    d(
        &client_for(&server),
        &AccountCommand::TopupHistory {
            p: None,
            page_size: None,
        },
    );
    m.assert();
}

#[test]
fn topup_posts_to_topup() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/user/topup")
            .json_body(json!({"amount": 100, "payment_method": "card"}));
        then.status(200).json_body(json!({"success": true}));
    });
    let body = json!({"amount": 100, "payment_method": "card"}).to_string();
    d(&client_for(&server), &AccountCommand::Topup { json: body });
    m.assert();
}

#[test]
fn pat_generate_posts_to_user_token() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/user/token")
            .json_body(json!({"name": "pat-1"}));
        then.status(200)
            .json_body(json!({"success": true, "data": {"key": "sk-xxx"}}));
    });
    let body = json!({"name": "pat-1"}).to_string();
    d(
        &client_for(&server),
        &AccountCommand::PatGenerate { json: body },
    );
    m.assert();
}

#[test]
fn affiliate_show_hits_user_aff() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/user/aff");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    d(&client_for(&server), &AccountCommand::AffiliateShow);
    m.assert();
}

#[test]
fn affiliate_transfer_without_yes_sends_no_http() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST).path("/api/user/aff_transfer");
        then.status(200).json_body(json!({"success": true}));
    });
    let body = json!({"to_user_id": 2, "amount": 100}).to_string();
    let res = newapi_cli_lib::cmd::account::dispatch(
        &client_for(&server),
        &AccountCommand::AffiliateTransfer {
            json: body,
            yes: false,
        },
    );
    assert!(res.is_err());
    assert_eq!(m.hits(), 0);
}

#[test]
fn affiliate_transfer_with_yes_hits_endpoint() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/user/aff_transfer")
            .json_body(json!({"to_user_id": 2, "amount": 100}));
        then.status(200).json_body(json!({"success": true}));
    });
    let body = json!({"to_user_id": 2, "amount": 100}).to_string();
    d(
        &client_for(&server),
        &AccountCommand::AffiliateTransfer {
            json: body,
            yes: true,
        },
    );
    m.assert();
}

#[test]
fn account_never_hits_admin_user_root() {
    // No mock on /api/user/1 — if any admin path were reached, dispatch
    // would error and the test would fail.
    let server = MockServer::start();
    let self_m = server.mock(|when, then| {
        when.method(GET).path("/api/user/self");
        then.status(200)
            .json_body(json!({"success": true, "data": {"id": 1}}));
    });
    d(&client_for(&server), &AccountCommand::Show);
    self_m.assert();
}
