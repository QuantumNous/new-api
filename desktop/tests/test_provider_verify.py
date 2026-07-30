"""Provider detection internals and the authenticated BoxAI-only verification contract."""

from __future__ import annotations

import pytest

from coworker.providers import detect_provider


@pytest.mark.parametrize(
    "key,expected",
    [
        ("sk-ant-api03-abc", "anthropic"),
        ("sk-or-v1-abc", "openrouter"),
        ("AIzaSyAbc123", "gemini"),
        ("sk-proj-abc", "openai"),
        ("sk_live_abc", "openai"),
        ("", None),
        ("   ", None),
        ("nonsense", None),
    ],
)
def test_detect_provider(key, expected):
    assert detect_provider(key) == expected


@pytest.mark.parametrize("name", ["openai", "anthropic", "gemini", "ollama", "zai"])
def test_third_party_provider_verification_is_unavailable(tmp_path, name):
    from coworker.server.manager import SessionManager

    manager = SessionManager(data_dir=tmp_path)
    result = manager.verify_provider(name, {"api_key": "not-saved"})
    assert result["ok"] is False
    assert "BoxAI" in result["error"]
    assert manager.secrets.get(f"provider:{name}") is None


def test_unsigned_boxai_verification_requires_login(tmp_path):
    from coworker.server.manager import SessionManager

    result = SessionManager(data_dir=tmp_path).verify_provider("boxai", {})
    assert result == {
        "ok": False,
        "error": "Only signed-in BoxAI model access is supported.",
    }
