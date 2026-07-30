from __future__ import annotations

import pytest

from coworker.providers import ProviderRouter, provider_names
from coworker.providers.registry import build_provider_client, get_descriptor
from coworker.secrets import SecretStore


def test_registry_exposes_only_boxai_and_rejects_unknown_provider(tmp_path):
    secrets = SecretStore(path=tmp_path / "secrets.json")
    assert provider_names() == ["boxai"]
    with pytest.raises(RuntimeError, match="Unsupported model provider"):
        build_provider_client("ollama", {}, secrets)


# Upstream keeps adding first-class providers (Bedrock and Vertex arrived with the
# 2026-07 sync). Their modules ride along in the tree, but reaching one would route a
# request around BoxAI account auth, billing, and revocation — so the registry must keep
# refusing every one of them by name, no matter what upstream registers.
@pytest.mark.parametrize(
    "name",
    ["openai", "anthropic", "gemini", "bedrock", "vertex", "openrouter", "meta", "ollama"],
)
def test_upstream_third_party_providers_are_not_reachable(tmp_path, name):
    secrets = SecretStore(path=tmp_path / "secrets.json")
    assert get_descriptor(name) is None
    with pytest.raises(RuntimeError, match="Unsupported model provider"):
        build_provider_client(name, {}, secrets)


def test_boxai_client_ignores_environment_and_legacy_provider_profiles(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("OPENAI_API_KEY", "third-party-env-key")
    secrets = SecretStore(path=tmp_path / "secrets.json")
    secrets.put(
        "provider:openai",
        {"api_key": "third-party-store-key", "base_url": "https://example.test/v1"},
    )
    with pytest.raises(RuntimeError, match="Sign in to BoxAI"):
        ProviderRouter(secrets).complete(model="ollama:local", messages=[])


def test_boxai_router_uses_only_cloud_auth_and_cannot_prefix_route(monkeypatch, tmp_path):
    secrets = SecretStore(path=tmp_path / "secrets.json")
    secrets.put(
        "cloud:auth",
        {
            "access_token": "session",
            "api_key": "boxai-key",
            "base_url": "https://you-box.com/v1",
        },
    )
    captured = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr("openai.OpenAI", FakeOpenAI)
    router = ProviderRouter(secrets)
    client = router._client_for("anthropic:claude")
    client._ensure_client()
    assert router._provider_name("ollama:local") == "boxai"
    assert captured == {
        "api_key": "boxai-key",
        "base_url": "https://you-box.com/v1",
    }
