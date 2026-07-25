"""Tests for the multi-provider layer: base_url passthrough, ProviderRouter routing/prefix
strip + caching, Ollama capabilities, and manager get/set_provider. SDK-free."""

from __future__ import annotations

from types import SimpleNamespace

from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    OpenAIProvider,
    ProviderClient,
    ProviderRouter,
    StreamChunk,
    capabilities_for,
)
from coworker.providers.registry import _normalize_ollama_url, build_provider_client
from coworker.providers.openai_provider import _salvage_tool_calls_from_text


# -- base_url passthrough -------------------------------------------------------
def test_base_url_passed_to_sdk(monkeypatch):
    captured: dict = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr("openai.OpenAI", FakeOpenAI)
    OpenAIProvider(
        api_key="ollama", base_url="http://localhost:11434/v1"
    )._ensure_client()
    assert captured == {"api_key": "ollama", "base_url": "http://localhost:11434/v1"}


def test_base_url_omitted_when_none(monkeypatch):
    captured: dict = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr("openai.OpenAI", FakeOpenAI)
    OpenAIProvider(api_key="sk-x")._ensure_client()
    assert "base_url" not in captured


# -- ollama URL normalization ---------------------------------------------------
def test_normalize_ollama_url():
    assert _normalize_ollama_url(None) == "http://localhost:11434/v1"
    assert (
        _normalize_ollama_url("http://localhost:11434") == "http://localhost:11434/v1"
    )
    assert _normalize_ollama_url("http://h:1/v1/") == "http://h:1/v1"
    assert _normalize_ollama_url("  ") == "http://localhost:11434/v1"


def test_build_ollama_client_uses_base_url(monkeypatch):
    captured: dict = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr("openai.OpenAI", FakeOpenAI)
    client = build_provider_client(
        "ollama", {"base_url": "http://box:11434"}, secrets=None
    )
    client._ensure_client()  # type: ignore[attr-defined]
    assert captured["base_url"] == "http://box:11434/v1"
    assert captured["api_key"] == "ollama"  # placeholder, Ollama ignores it


# -- router routing -------------------------------------------------------------
class _Recorder(ProviderClient):
    def __init__(self, name: str):
        self.name = name
        self.models: list[str] = []

    def complete(self, *, model, messages, tools=None, **settings):
        self.models.append(model)
        return AssistantTurn(text=self.name)

    def stream(self, *, model, messages, tools=None, **settings):
        self.models.append(model)
        yield StreamChunk(turn=AssistantTurn(text=self.name))

    def capabilities(self, model):
        return ModelCapabilities()


def _patch_build(monkeypatch):
    state: dict = {"created": [], "latest": {}}

    def fake_build(name, profile, secrets):
        rec = _Recorder(name)  # a fresh client each build, so rebuilds are observable
        state["created"].append(rec)
        state["latest"][name] = rec
        return rec

    monkeypatch.setattr("coworker.providers.router.build_provider_client", fake_build)
    return state


def test_router_routes_and_strips_prefix(monkeypatch):
    state = _patch_build(monkeypatch)
    router = ProviderRouter(secrets=None)

    turn = router.complete(model="ollama:llama3.3", messages=[])
    assert turn.text == "ollama"
    assert state["latest"]["ollama"].models == [
        "llama3.3"
    ]  # prefix stripped before delegating

    router.complete(model="gpt-5.5", messages=[])  # bare → default openai
    assert state["latest"]["openai"].models == ["gpt-5.5"]


def test_router_caches_and_invalidates(monkeypatch):
    state = _patch_build(monkeypatch)
    router = ProviderRouter(secrets=None)

    first = router._client_for("ollama:a")
    second = router._client_for("ollama:b")
    assert first is second  # same provider → cached client reused (build called once)
    assert len(state["created"]) == 1

    router.invalidate("ollama")
    third = router._client_for("ollama:c")
    assert third is not first  # rebuilt after invalidation
    assert len(state["created"]) == 2


def test_router_bare_only_strips_known_provider():
    r = ProviderRouter(secrets=None)
    assert (
        r._bare("ollama:qwen2.5-coder:32b") == "qwen2.5-coder:32b"
    )  # strip provider, keep tag
    assert r._bare("gpt-5.5") == "gpt-5.5"
    # a colon that isn't a provider (version tag) must NOT be split — else OpenAI gets "32b"
    assert r._bare("qwen2.5-coder:32b") == "qwen2.5-coder:32b"
    assert r._provider_name("qwen2.5-coder:32b") == "openai"  # unknown prefix → default


def test_router_capabilities_prefix_aware():
    router = ProviderRouter(secrets=None)
    assert router.capabilities("ollama:qwen2.5-coder").tools is True
    assert router.capabilities("ollama:qwen2.5-coder").parallel_tool_calls is False


# -- capabilities ---------------------------------------------------------------
def test_capabilities_ollama():
    caps = capabilities_for("ollama:qwen2.5-coder")
    assert caps.tools is True
    assert caps.parallel_tool_calls is False
    assert caps.vision is False


# -- tool-call salvage (Ollama emits tool calls as text) ------------------------
def test_salvage_bare_json_object():
    calls = _salvage_tool_calls_from_text(
        '{"name": "get_weather", "arguments": {"city": "Paris"}}'
    )
    assert len(calls) == 1
    assert calls[0].name == "get_weather"
    assert calls[0].arguments == {"city": "Paris"}


def test_salvage_tool_call_tags():
    text = '<tool_call>{"name": "a", "arguments": {"x": 1}}</tool_call>'
    calls = _salvage_tool_calls_from_text(text)
    assert [c.name for c in calls] == ["a"]


def test_salvage_multiple_via_array():
    text = '[{"name": "a", "arguments": {}}, {"name": "b", "arguments": {"y": 2}}]'
    calls = _salvage_tool_calls_from_text(text)
    assert [c.name for c in calls] == ["a", "b"]
    assert calls[1].arguments == {"y": 2}


def test_salvage_stringified_arguments():
    calls = _salvage_tool_calls_from_text('{"name": "a", "arguments": "{\\"k\\": 1}"}')
    assert calls[0].arguments == {"k": 1}


def test_salvage_ignores_non_toolcall_json():
    # Valid JSON, but not tool-call shaped → must stay text (no false positives).
    assert _salvage_tool_calls_from_text('{"city": "Paris", "temp": 18}') == []


def test_salvage_ignores_prose():
    assert _salvage_tool_calls_from_text("The weather in Paris is sunny.") == []
    assert _salvage_tool_calls_from_text("") == []


_TODO_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "todo_write",
            "parameters": {
                "type": "object",
                "properties": {"items": {"type": "array"}},
                "required": ["items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "parameters": {
                "type": "object",
                "properties": {"recursive": {"type": "boolean"}},
            },
        },
    },
]


def test_salvage_mixed_prose_and_object():
    # The model wrote prose THEN a bare-JSON tool call in one message.
    text = 'It seems the workspace is empty. {"name": "list_files", "arguments": {"recursive": true}}'
    calls = _salvage_tool_calls_from_text(text, _TODO_TOOLS)
    assert [c.name for c in calls] == ["list_files"]
    assert calls[0].arguments == {"recursive": True}


def test_salvage_toolname_bare_array_shorthand():
    # The exact shape from the user's session: `todo_write [ {…}, {…} ]` (name + bare array).
    text = 'todo_write [{"content": "Understand requirements", "status": "in_progress"}, {"content": "Plan", "status": "pending"}]'
    calls = _salvage_tool_calls_from_text(text, _TODO_TOOLS)
    assert len(calls) == 1 and calls[0].name == "todo_write"
    # bare array mapped onto the tool's sole parameter
    assert calls[0].arguments == {
        "items": [
            {"content": "Understand requirements", "status": "in_progress"},
            {"content": "Plan", "status": "pending"},
        ]
    }


def test_salvage_toolname_object_shorthand():
    calls = _salvage_tool_calls_from_text(
        'list_files {"recursive": false}', _TODO_TOOLS
    )
    assert calls[0].name == "list_files" and calls[0].arguments == {"recursive": False}


def test_salvage_filters_unknown_tool_name():
    # A {name,arguments} object whose name isn't an offered tool must NOT be salvaged.
    text = '{"name": "rm_rf", "arguments": {"path": "/"}}'
    assert _salvage_tool_calls_from_text(text, _TODO_TOOLS) == []


def test_salvage_nested_braces_in_tag():
    text = '<tool_call>{"name": "todo_write", "arguments": {"items": [{"content": "a", "status": "pending"}]}}</tool_call>'
    calls = _salvage_tool_calls_from_text(text, _TODO_TOOLS)
    assert calls[0].name == "todo_write"
    assert calls[0].arguments == {"items": [{"content": "a", "status": "pending"}]}


class _FakeOAClient:
    def __init__(self, *, content=None, tool_calls=None):
        msg = SimpleNamespace(content=content, tool_calls=tool_calls)
        resp = SimpleNamespace(
            choices=[SimpleNamespace(message=msg, finish_reason="stop")]
        )
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=lambda **k: resp)
        )


def test_complete_salvages_only_when_tools_requested():
    blob = '{"name": "get_weather", "arguments": {"city": "Paris"}}'
    tools = [{"type": "function", "function": {"name": "get_weather"}}]

    # tools requested + no structured calls → salvage, clear text
    p = OpenAIProvider(client=_FakeOAClient(content=blob))
    turn = p.complete(model="ollama:x", messages=[], tools=tools)
    assert turn.has_tool_calls and turn.tool_calls[0].name == "get_weather"
    assert turn.text is None

    # no tools requested → identical content stays plain text (gate holds)
    p2 = OpenAIProvider(client=_FakeOAClient(content=blob))
    turn2 = p2.complete(model="ollama:x", messages=[])
    assert not turn2.has_tool_calls
    assert turn2.text == blob


# -- manager get/set_provider ---------------------------------------------------
def test_manager_provider_config(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    assert isinstance(mgr.provider, ProviderRouter)

    res = mgr.set_provider("ollama", {"base_url": "http://localhost:9999"})
    assert res["ok"] is True

    provs = {p["name"]: p for p in mgr.get_providers()}
    assert provs["ollama"]["configured"] is True  # keyless → usable
    assert provs["ollama"]["values"]["base_url"] == "http://localhost:9999"
    assert provs["openai"]["needs_key"] is True
    # never leak secret values
    assert "api_key" not in provs["openai"].get("values", {})

    assert mgr.set_provider("nope", {})["ok"] is False  # unknown provider rejected


def test_manager_curated_models(tmp_path, monkeypatch):
    """No seed list: the picker is the curated matrix filtered to key-holding providers,
    plus user-added custom ids. A fresh install shows only the (not-yet-usable) default.
    """
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.providers.registry import provider_descriptors

    for d in provider_descriptors():  # ambient dev-shell keys must not leak in
        if d.env_key:
            monkeypatch.delenv(d.env_key, raising=False)
    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    # no provider keys → nothing but the always-selectable default
    assert mgr.get_settings()["models"] == [mgr.model]

    # a provider key unlocks exactly that provider's matrix models
    mgr.set_provider("anthropic", {"api_key": "sk-ant-test"})
    models = mgr.get_settings()["models"]
    assert "anthropic:claude-opus-4-8" in models
    assert "gpt-4o" not in models  # no OpenAI seed anywhere

    added = mgr.add_model("ollama:qwen2.5-coder:32b")  # keyless provider → selectable
    assert added["ok"] and "ollama:qwen2.5-coder:32b" in added["models"]

    n = len(mgr.get_settings()["models"])
    mgr.add_model("ollama:qwen2.5-coder:32b")  # idempotent
    assert len(mgr.get_settings()["models"]) == n

    # removing a matrix model hides it persistently; re-adding unhides it
    removed = mgr.remove_model("anthropic:claude-haiku-4-5")
    assert "anthropic:claude-haiku-4-5" not in removed["models"]
    mgr2 = SessionManager(data_dir=tmp_path)  # survives a restart
    assert "anthropic:claude-haiku-4-5" not in mgr2.get_settings()["models"]
    mgr.add_model("anthropic:claude-haiku-4-5")
    assert "anthropic:claude-haiku-4-5" in mgr.get_settings()["models"]

    # removing a custom id drops it
    mgr.remove_model("ollama:qwen2.5-coder:32b")
    assert "ollama:qwen2.5-coder:32b" not in mgr.get_settings()["models"]

    # the active default stays selectable even if removed from the curated list
    mgr.remove_model(mgr.model)
    assert mgr.model in mgr.get_settings()["models"]

    assert mgr.add_model("  ")["ok"] is False  # empty rejected


def test_set_provider_auto_adds_recommended_when_pulled(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    monkeypatch.setattr(  # pretend the recommended model is pulled
        mgr,
        "_suggested_models",
        lambda name: ["qwen3-coder:30b"] if name == "ollama" else [],
    )
    res = mgr.set_provider("ollama", {"base_url": "http://localhost:11434"})
    assert res["recommended_model"] == "qwen3-coder:30b"
    assert "ollama:qwen3-coder:30b" in mgr.get_settings()["models"]


def test_set_provider_skips_recommended_when_not_pulled(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    monkeypatch.setattr(mgr, "_suggested_models", lambda name: [])  # nothing pulled
    mgr.set_provider("ollama", {"base_url": "http://localhost:11434"})
    assert "ollama:qwen3-coder:30b" not in mgr.get_settings()["models"]


def test_provider_builders(monkeypatch):
    import pytest

    from coworker.providers import AnthropicProvider, GeminiProvider
    from coworker.providers.registry import build_provider_client

    # anthropic and gemini are native: key resolution deferred to first call
    p = build_provider_client("anthropic", {"api_key": "sk-ant-x"}, None)
    assert isinstance(p, AnthropicProvider) and p._api_key == "sk-ant-x"
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="Anthropic"):
        build_provider_client("anthropic", {}, None)._ensure_client()

    g = build_provider_client("gemini", {"api_key": "AIza-x"}, None)
    assert isinstance(g, GeminiProvider) and g._api_key == "AIza-x"
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="Gemini"):
        build_provider_client("gemini", {}, None)._ensure_client()

    # OpenAI custom endpoint (Azure /openai/v1, OpenRouter, vLLM, …) passes through
    o = build_provider_client(
        "openai", {"base_url": "https://my.azure.example/openai/v1"}, None
    )
    assert o._base_url == "https://my.azure.example/openai/v1"
    assert build_provider_client("openai", {}, None)._base_url is None


def test_anthropic_gemini_capabilities():
    for m in ("anthropic:claude-sonnet-4-6", "gemini:gemini-2.5-flash"):
        caps = capabilities_for(m)
        assert caps.tools is True and caps.vision is True and caps.streaming is True
        assert caps.parallel_tool_calls is True  # both native: results fold correctly


def test_anthropic_gemini_provider_config(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    provs = {p["name"]: p for p in mgr.get_providers()}
    assert provs["anthropic"]["configured"] is False
    assert provs["gemini"]["needs_key"] is True
    assert "claude-sonnet-4-6" in provs["anthropic"]["suggested_models"]
    assert "gemini-2.5-flash" in provs["gemini"]["suggested_models"]

    res = mgr.set_provider("anthropic", {"api_key": "sk-ant-test"})
    assert res["ok"] is True and res["recommended_model"] == "claude-fable-5"
    provs = {p["name"]: p for p in mgr.get_providers()}
    assert provs["anthropic"]["configured"] is True
    assert "api_key" not in provs["anthropic"].get("values", {})  # secrets never leak
    # the recommended model is auto-added to the curated list with its provider prefix
    assert "anthropic:claude-fable-5" in mgr.get_settings()["models"]

    # env var alone marks a provider configured
    monkeypatch.setenv("GEMINI_API_KEY", "AIza-env")
    provs = {p["name"]: p for p in mgr.get_providers()}
    assert provs["gemini"]["configured"] is True


def test_first_configured_provider_wins_default(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    for var in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.delenv(var, raising=False)
    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    assert (
        mgr.model == "gpt-5.6-sol"
    )  # fresh install: built-in default, openai unconfigured

    # the first provider that gets a key takes over the default
    mgr.set_provider("anthropic", {"api_key": "sk-ant-x"})
    assert mgr.model == "anthropic:claude-fable-5"

    # but a default that already works is never stolen by the next provider
    mgr.set_provider("gemini", {"api_key": "AIza-x"})
    assert mgr.model == "anthropic:claude-fable-5"


def test_surface_visibility(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    # default: Cowork only
    s = mgr.get_settings()["surfaces"]
    assert s == {"cowork": True, "chat": False, "code": False}

    mgr.set_surfaces(chat=True)
    assert mgr.get_settings()["surfaces"]["chat"] is True
    assert mgr.get_settings()["surfaces"]["code"] is False  # untouched

    mgr.set_surfaces(code=True)
    assert mgr.get_settings()["surfaces"] == {
        "cowork": True,
        "chat": True,
        "code": True,
    }

    mgr.set_surfaces(chat=False)
    assert mgr.get_settings()["surfaces"]["chat"] is False
    # cowork is always on regardless
    assert mgr.get_settings()["surfaces"]["cowork"] is True


def test_provider_suggested_models(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    provs = {p["name"]: p for p in mgr.get_providers()}
    assert "gpt-5.5" in provs["openai"]["suggested_models"]
    # ollama suggestions are bare names (no `ollama:` prefix); empty when unconfigured
    sugg = provs["ollama"]["suggested_models"]
    assert isinstance(sugg, list)
    assert all(not m.startswith("ollama:") for m in sugg)


# -- last-used tracking (router on_use hook + manager persistence) ----------------


def test_router_on_use_fires_with_provider_name():
    seen: list[str] = []
    router = ProviderRouter(on_use=seen.append)
    router._clients["openai"] = OpenAIProvider(client=_FakeOAClient(content="hi"))
    router._clients["zai"] = OpenAIProvider(client=_FakeOAClient(content="hi"))

    router.complete(model="gpt-5.5", messages=[])
    router.complete(model="zai:glm-5.2", messages=[])
    assert seen == ["openai", "zai"]


def test_router_on_use_failures_never_break_the_call():
    def boom(_name):
        raise RuntimeError("telemetry down")

    router = ProviderRouter(on_use=boom)
    router._clients["openai"] = OpenAIProvider(client=_FakeOAClient(content="ok"))
    assert router.complete(model="gpt-5.5", messages=[]).text == "ok"


def test_manager_key_hygiene_stamps(tmp_path, monkeypatch):
    """set_provider stamps key_set_at; _note_provider_use records (throttled) last_used_at;
    get_providers exposes both for the Settings pane."""
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from datetime import date

    from coworker.server.manager import SessionManager

    mgr = SessionManager(data_dir=tmp_path)
    mgr.set_provider("deepseek", {"api_key": "ds-key"})
    provs = {p["name"]: p for p in mgr.get_providers()}
    assert provs["deepseek"]["configured"] is True
    assert provs["deepseek"]["key_set_at"] == date.today().isoformat()
    assert provs["deepseek"]["last_used_at"] is None  # configured but never used

    # Endpoint-only re-save keeps the original stamp (the key wasn't touched).
    mgr.set_provider("deepseek", {"base_url": "https://api.deepseek.com/v1"})
    provs = {p["name"]: p for p in mgr.get_providers()}
    assert provs["deepseek"]["key_set_at"] == date.today().isoformat()

    mgr._note_provider_use("deepseek")
    first = mgr._prefs["provider_last_used"]["deepseek"]
    mgr._note_provider_use("deepseek")  # within the 60s throttle window → unchanged
    assert mgr._prefs["provider_last_used"]["deepseek"] == first
    provs = {p["name"]: p for p in mgr.get_providers()}
    assert provs["deepseek"]["last_used_at"] == first
    # and it survives a reload (persisted to prefs.json)
    mgr2 = SessionManager(data_dir=tmp_path)
    provs2 = {p["name"]: p for p in mgr2.get_providers()}
    assert provs2["deepseek"]["last_used_at"] == first
