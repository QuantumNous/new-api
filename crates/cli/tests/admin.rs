//! Integration tests for `admin` user, redemption, subscription, and setting.

use httpmock::prelude::*;
use newapi_cli_lib::client::ApiClient;
use newapi_cli_lib::cmd::admin::{
    AdminCommand, RedemptionCommand, SettingCommand, SubPlanCommand, SubUserCommand,
    SubscriptionCommand, UserCommand, UserDeleteArgs, UserListArgs,
};
use serde_json::json;

fn client_for(server: &MockServer) -> ApiClient {
    ApiClient::new(server.base_url(), "t".into()).unwrap()
}

#[test]
fn user_list_uses_user_root() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/user");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cli = AdminCommand::User(UserCommand::List(UserListArgs {
        p: None,
        page_size: None,
    }));
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn user_delete_requires_yes() {
    let server = MockServer::start();
    let cli = AdminCommand::User(UserCommand::Delete(UserDeleteArgs { id: 1, yes: false }));
    let err = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("--yes"));
}

#[test]
fn user_delete_with_yes_hits_endpoint() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/user/1");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = AdminCommand::User(UserCommand::Delete(UserDeleteArgs { id: 1, yes: true }));
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn user_manage_preserves_mode_and_value() {
    let server = MockServer::start();
    let _m = server.mock(|when, then| {
        when.method(POST).path("/api/user/manage").json_body(json!({
            "id": 1,
            "action": "add_quota",
            "mode": "subtract",
            "value": -500
        }));
        then.status(200).json_body(json!({"success": true}));
    });
    let body =
        json!({"id": 1, "action": "add_quota", "mode": "subtract", "value": -500}).to_string();
    let cli = AdminCommand::User(UserCommand::Manage {
        json: body,
        yes: true,
    });
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
}

#[test]
fn redemption_delete_invalid_hits_invalid_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(DELETE).path("/api/redemption/invalid");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = AdminCommand::Redemption(RedemptionCommand::DeleteInvalid { yes: true });
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn subscription_plan_set_status_uses_patch() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(httpmock::Method::PATCH)
            .path("/api/subscription/admin/plans/3")
            .json_body(json!({"status": 2}));
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = AdminCommand::Subscription(SubscriptionCommand::Plan(SubPlanCommand::SetStatus {
        id: 3,
        status: 2,
    }));
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn subscription_user_invalidate_hits_user_subscriptions_path() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(POST)
            .path("/api/subscription/admin/user_subscriptions/9/invalidate");
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = AdminCommand::Subscription(SubscriptionCommand::User(SubUserCommand::Invalidate {
        id: 9,
        yes: true,
    }));
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn group_list_uses_group_root() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/group");
        then.status(200)
            .json_body(json!({"success": true, "data": []}));
    });
    let cli = AdminCommand::Group;
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn permission_catalog_uses_authz_catalog() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/authz/catalog");
        then.status(200)
            .json_body(json!({"success": true, "data": {}}));
    });
    let cli = AdminCommand::PermissionCatalog;
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}

#[test]
fn setting_get_refuses_pricing_key() {
    let server = MockServer::start();
    let cli = AdminCommand::Setting(SettingCommand::Get {
        key: "ModelRatio".into(),
    });
    let err = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("pricing"));
}

#[test]
fn setting_get_returns_non_pricing_value() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(GET).path("/api/option");
        then.status(200).json_body(json!({
            "ModelRatio": "{}",
            "SMTPServer": "smtp.example.com"
        }));
    });
    let cli = AdminCommand::Setting(SettingCommand::Get {
        key: "SMTPServer".into(),
    });
    let out = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    assert_eq!(out, "smtp.example.com");
    m.assert();
}

#[test]
fn setting_set_refuses_pricing_key() {
    let server = MockServer::start();
    let cli = AdminCommand::Setting(SettingCommand::Set {
        key: "Price".into(),
        json: "1.5".into(),
    });
    let err = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap_err();
    assert!(err.to_string().contains("pricing"));
}

#[test]
fn setting_set_passes_through_secret() {
    let server = MockServer::start();
    let m = server.mock(|when, then| {
        when.method(PUT)
            .path("/api/option")
            .json_body(json!({"key": "SMTPPassword", "value": "s3cret"}));
        then.status(200).json_body(json!({"success": true}));
    });
    let cli = AdminCommand::Setting(SettingCommand::Set {
        key: "SMTPPassword".into(),
        json: "s3cret".into(),
    });
    let _ = newapi_cli_lib::cmd::admin::dispatch(&client_for(&server), &cli).unwrap();
    m.assert();
}
