use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Fixture {
    version: u32,
    cases: Vec<AuthCase>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AuthCase {
    case_id: String,
    synthetic_credential: String,
    expected: Expected,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Expected {
    decision: String,
    http_status: u16,
    error_class: String,
    identity: serde_json::Value,
}

#[test]
fn auth_fixture_has_versioned_sanitized_cases() {
    let path = format!(
        "{}/../../testdata/gateway/auth/v1.json",
        env!("CARGO_MANIFEST_DIR")
    );
    let fixture: Fixture = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    assert_eq!(fixture.version, 1);
    assert_eq!(fixture.cases.len(), 11);
    for case in fixture.cases {
        assert!(!case.case_id.is_empty());
        assert!(case.synthetic_credential.starts_with("synthetic-"));
        assert!(matches!(case.expected.decision.as_str(), "allow" | "deny"));
        assert!(case.expected.http_status > 0);
        assert!(!case.expected.error_class.contains("secret"));
        assert!(case.expected.identity.is_object() || case.expected.identity == "absent");
    }
}

#[test]
fn auth_fixture_rejects_secret_shaped_fields() {
    let result = serde_json::from_str::<AuthCase>(
        r#"{"case_id":"x","synthetic_credential":"synthetic-x","token":"secret","expected":{"decision":"deny","http_status":401,"error_class":"token_invalid","identity":"absent"}}"#,
    );
    assert!(result.is_err());
}
