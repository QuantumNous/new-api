//! The seeded payload is a contract with somebody else's config writer, and each client
//! deserializes it into its own typed struct before it reaches a real file on the user's
//! disk. Asserting the JSON shape in a unit test only proves the JSON is what we wrote;
//! these tests prove the writers accept it and that what lands on disk is usable.
//!
//! OpenClaw and Hermes are the two that matter most: they were added after the fork and
//! their shapes differ from the OpenCode arm they are easily mistaken for.

mod support;

use boxai_connect_lib::boxai::provider_seed;
use boxai_connect_lib::{hermes_config, openclaw_config, update_settings, AppSettings, AppType};

fn with_temp_hermes_dir<F: FnOnce(&std::path::Path)>(f: F) {
    let guard = support::test_mutex().lock().expect("test mutex poisoned");
    let home = support::ensure_test_home();
    support::reset_test_fs();

    let hermes_dir = home.join(".hermes-seed");
    let _ = std::fs::remove_dir_all(&hermes_dir);
    std::fs::create_dir_all(&hermes_dir).expect("create temp hermes dir");

    update_settings(AppSettings {
        hermes_config_dir: Some(hermes_dir.to_string_lossy().into_owned()),
        ..AppSettings::default()
    })
    .expect("set hermes_config_dir override");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| f(&hermes_dir)));

    let _ = update_settings(AppSettings::default());
    let _ = std::fs::remove_dir_all(&hermes_dir);
    drop(guard);

    if let Err(err) = result {
        std::panic::resume_unwind(err);
    }
}

#[test]
fn openclaw_seed_survives_its_own_config_writer() {
    let guard = support::test_mutex().lock().expect("test mutex poisoned");
    support::ensure_test_home();
    support::reset_test_fs();

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let id = provider_seed::provider_id(&AppType::OpenClaw);
        let seeded = provider_seed::settings_config(&AppType::OpenClaw, "sk-user", "some-model");

        // The live-config path deserializes settings_config into this struct. A casing
        // mistake here silently drops base_url or apiKey rather than failing loudly.
        let typed: openclaw_config::OpenClawProviderConfig =
            serde_json::from_value(seeded).expect("seeded payload must parse as OpenClaw config");
        assert_eq!(typed.api_key.as_deref(), Some("sk-user"));
        assert_eq!(
            typed.base_url.as_deref(),
            Some("https://you-box.com/v1"),
            "OpenClaw talks to the OpenAI-compatible relay, so it needs the /v1 form"
        );
        assert_eq!(typed.models.len(), 1);
        assert_eq!(typed.models[0].id, "some-model");

        openclaw_config::set_typed_provider(&id, &typed).expect("write OpenClaw provider");

        assert!(
            openclaw_config::get_openclaw_config_path().exists(),
            "seeding must create openclaw.json"
        );
        // Read back through upstream's own reader rather than serde_json: openclaw.json is
        // JSON5, so a strict JSON parse fails on the file the app legitimately writes.
        let entry = openclaw_config::get_provider(&id)
            .expect("read back the seeded provider")
            .expect("seeded provider must be present in models.providers");

        assert_eq!(entry["baseUrl"].as_str(), Some("https://you-box.com/v1"));
        assert_eq!(entry["apiKey"].as_str(), Some("sk-user"));
        assert_eq!(entry["models"][0]["id"].as_str(), Some("some-model"));
    }));

    drop(guard);
    if let Err(err) = result {
        std::panic::resume_unwind(err);
    }
}

#[test]
fn hermes_seed_survives_its_own_config_writer() {
    with_temp_hermes_dir(|dir| {
        let id = provider_seed::provider_id(&AppType::Hermes);
        let seeded = provider_seed::settings_config(&AppType::Hermes, "sk-user", "some-model");

        hermes_config::set_provider(&id, seeded).expect("write Hermes provider");

        let written = std::fs::read_to_string(dir.join("config.yaml"))
            .expect("config.yaml must exist after seeding");
        let parsed: serde_yaml::Value =
            serde_yaml::from_str(&written).expect("config.yaml must stay valid YAML");

        let providers = parsed["custom_providers"]
            .as_sequence()
            .expect("seed must land in custom_providers, never the read-only providers dict");
        let entry = providers
            .iter()
            .find(|p| p["name"].as_str() == Some(id.as_str()))
            .expect("seeded provider must be present by name");

        assert_eq!(entry["base_url"].as_str(), Some("https://you-box.com/v1"));
        assert_eq!(entry["api_key"].as_str(), Some("sk-user"));
        // Without api_mode Hermes cannot tell which wire format to speak upstream.
        assert_eq!(entry["api_mode"].as_str(), Some("chat_completions"));
        // Hermes rejects unknown per-provider fields with a startup warning; `api` is an
        // OpenClaw concept and must not leak across.
        assert!(
            entry["api"].is_null(),
            "OpenClaw's `api` field must not reach Hermes YAML: {written}"
        );
    });
}

/// Claude Desktop has no chat provider to point anywhere, so it must never be seeded —
/// projecting an empty payload into it would rewrite a real profile library with nothing.
#[test]
fn claude_desktop_is_never_part_of_the_seeded_set() {
    assert!(!provider_seed::SUPPORTED_APPS.contains(&AppType::ClaudeDesktop));
    assert_eq!(
        provider_seed::settings_config(&AppType::ClaudeDesktop, "sk-user", "m"),
        serde_json::json!({})
    );
}
