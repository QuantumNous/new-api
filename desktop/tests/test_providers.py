"""P0 gate tests — provider layer. SDK-free (inject a fake OpenAI client)."""

from __future__ import annotations

import json
from types import SimpleNamespace

from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    OpenAIProvider,
    ToolCall,
    capabilities_for,
)


class _FakeCompletions:
    def __init__(self, response):
        self._response = response
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


class _FakeClient:
    def __init__(self, response):
        self.chat = SimpleNamespace(completions=_FakeCompletions(response))


def _response(content=None, tool_calls=None, finish_reason="stop"):
    message = SimpleNamespace(content=content, tool_calls=tool_calls)
    choice = SimpleNamespace(message=message, finish_reason=finish_reason)
    return SimpleNamespace(choices=[choice])


def test_complete_returns_text():
    client = _FakeClient(_response(content="hello there"))
    provider = OpenAIProvider(client=client)

    turn = provider.complete(
        model="gpt-5.5", messages=[{"role": "user", "content": "hi"}]
    )

    assert isinstance(turn, AssistantTurn)
    assert turn.text == "hello there"
    assert turn.tool_calls == []
    assert turn.has_tool_calls is False
    assert turn.finish_reason == "stop"


def test_complete_parses_tool_calls():
    tc = SimpleNamespace(
        id="call_1",
        function=SimpleNamespace(
            name="read_file", arguments=json.dumps({"path": "a.py"})
        ),
    )
    client = _FakeClient(_response(tool_calls=[tc], finish_reason="tool_calls"))
    provider = OpenAIProvider(client=client)

    turn = provider.complete(
        model="gpt-5.5",
        messages=[],
        tools=[{"type": "function", "function": {"name": "read_file"}}],
    )

    assert turn.has_tool_calls
    assert turn.tool_calls[0] == ToolCall(
        id="call_1", name="read_file", arguments={"path": "a.py"}
    )
    # tools forwarded to the API
    assert "tools" in client.chat.completions.calls[0]


def test_complete_tolerates_bad_tool_args():
    tc = SimpleNamespace(
        id="call_2", function=SimpleNamespace(name="x", arguments="{not json")
    )
    client = _FakeClient(_response(tool_calls=[tc]))
    provider = OpenAIProvider(client=client)

    turn = provider.complete(model="gpt-5.5", messages=[])

    assert turn.tool_calls[0].arguments == {"_raw": "{not json"}


def test_tools_omitted_when_none():
    client = _FakeClient(_response(content="x"))
    provider = OpenAIProvider(client=client)

    provider.complete(model="gpt-5.5", messages=[])

    assert "tools" not in client.chat.completions.calls[0]


def test_settings_forwarded():
    client = _FakeClient(_response(content="x"))
    provider = OpenAIProvider(client=client)

    provider.complete(model="gpt-5.5", messages=[], temperature=0.2)

    assert client.chat.completions.calls[0]["temperature"] == 0.2


def test_capabilities_known_models():
    assert capabilities_for("gpt-5.5").tools is True
    assert capabilities_for("openai:gpt-5.5").vision is True  # provider prefix stripped
    assert capabilities_for("o3-mini").parallel_tool_calls is False
    assert capabilities_for("deepseek-chat").tools is True


def test_capabilities_via_provider():
    provider = OpenAIProvider(client=_FakeClient(_response()))
    caps = provider.capabilities("gpt-5.5")
    assert isinstance(caps, ModelCapabilities)
    assert caps.tools is True


# -- GPT-5.6 tools + reasoning_effort on chat/completions (owner repro 2026-07-14) ----
# The API defaults these models to effort "medium" and then rejects function tools:
# "Function tools with reasoning_effort are not supported for gpt-5.6-sol in
# /v1/chat/completions. To use function tools, use /v1/responses or set
# reasoning_effort to 'none'." Until we speak the Responses API, we pin effort none.

_TOOLS = [{"type": "function", "function": {"name": "read_file"}}]
_EFFORT_400 = (
    "Error code: 400 - {'error': {'message': \"Function tools with reasoning_effort "
    "are not supported for %s in /v1/chat/completions. To use function tools, use "
    "/v1/responses or set reasoning_effort to 'none'.\", 'type': "
    "'invalid_request_error', 'param': 'reasoning_effort', 'code': None}}"
)


def test_gpt56_tools_pin_reasoning_effort_none():
    client = _FakeClient(_response(content="x"))
    provider = OpenAIProvider(client=client)
    calls = client.chat.completions.calls

    for model in ("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"):
        provider.complete(model=model, messages=[], tools=_TOOLS)
    assert [c["reasoning_effort"] for c in calls] == ["none"] * 3

    # an explicit caller choice is respected on the first attempt
    provider.complete(
        model="gpt-5.6-sol", messages=[], tools=_TOOLS, reasoning_effort="low"
    )
    assert calls[3]["reasoning_effort"] == "low"

    # no tools, or another model → the request is untouched
    provider.complete(model="gpt-5.6-sol", messages=[])
    provider.complete(model="gpt-5.5", messages=[], tools=_TOOLS)
    assert "reasoning_effort" not in calls[4] and "reasoning_effort" not in calls[5]


class _EffortRejectingCompletions:
    """Behaves like the live API: tools + any effort other than 'none' → the 400."""

    def __init__(self, response):
        self._response = response
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs.get("tools") and kwargs.get("reasoning_effort") != "none":
            raise RuntimeError(_EFFORT_400 % kwargs["model"])
        if kwargs.get("stream"):
            return iter([_chunk(content="ok"), _chunk(finish="stop")])
        return self._response


def test_effort_400_from_an_unpinned_model_retries_once_at_none():
    # a hypothetical next generation we haven't listed yet — proactive pin misses it
    client = _FakeClient(_response(content="x"))
    client.chat.completions = _EffortRejectingCompletions(_response(content="x"))
    provider = OpenAIProvider(client=client)

    turn = provider.complete(model="gpt-5.7-sol", messages=[], tools=_TOOLS)
    calls = client.chat.completions.calls
    assert turn.text == "x" and len(calls) == 2
    assert "reasoning_effort" not in calls[0] and calls[1]["reasoning_effort"] == "none"

    # streaming path retries the same way
    out = list(provider.stream(model="gpt-5.7-sol", messages=[], tools=_TOOLS))
    assert out[-1].turn.text == "ok" and len(client.chat.completions.calls) == 4


def test_max_tokens_rejection_retries_as_max_completion_tokens():
    """Reasoning-routed models 400 on max_tokens (want max_completion_tokens); compat
    servers know only max_tokens — so the swap happens on rejection, never up front.
    (Owner-hit 2026-07-20: the auto-title call silently no-oped on gpt-5.6-sol.)"""

    class _MaxTokensRejecting:
        def __init__(self, response):
            self._response = response
            self.calls: list[dict] = []

        def create(self, **kwargs):
            self.calls.append(kwargs)
            if "max_tokens" in kwargs:
                raise RuntimeError(
                    "Error code: 400 - Unsupported parameter: 'max_tokens' is not "
                    "supported with this model. Use 'max_completion_tokens' instead."
                )
            return self._response

    client = _FakeClient(_response(content="Jira vs Linear"))
    client.chat.completions = _MaxTokensRejecting(_response(content="Jira vs Linear"))
    provider = OpenAIProvider(client=client)

    turn = provider.complete(model="gpt-5.6-sol", messages=[], max_tokens=64)
    calls = client.chat.completions.calls
    assert turn.text == "Jira vs Linear" and len(calls) == 2
    assert calls[0]["max_tokens"] == 64
    assert "max_tokens" not in calls[1] and calls[1]["max_completion_tokens"] == 64


def test_unrelated_400s_are_not_retried():
    class _AlwaysRejects:
        calls: list = []

        def create(self, **kwargs):
            self.calls.append(kwargs)
            raise RuntimeError("Error code: 400 - context_length_exceeded")

    client = _FakeClient(_response(content="x"))
    client.chat.completions = _AlwaysRejects()
    provider = OpenAIProvider(client=client)
    try:
        provider.complete(model="gpt-5.5", messages=[], tools=_TOOLS)
        raise AssertionError("should have raised")
    except RuntimeError:
        pass
    assert len(client.chat.completions.calls) == 1  # no blind second attempt


# -- streaming ------------------------------------------------------------------


def _chunk(content=None, tool_call=None, finish=None):
    delta = SimpleNamespace(
        content=content, tool_calls=[tool_call] if tool_call else None
    )
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta, finish_reason=finish)])


class _StreamClient:
    def __init__(self, chunks):
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=lambda **kwargs: iter(chunks))
        )


def test_stream_text_deltas():
    chunks = [_chunk(content="Hel"), _chunk(content="lo"), _chunk(finish="stop")]
    provider = OpenAIProvider(client=_StreamClient(chunks))
    out = list(provider.stream(model="gpt-5.5", messages=[]))
    assert [c.text_delta for c in out if c.text_delta] == ["Hel", "lo"]
    assert out[-1].turn.text == "Hello"
    assert out[-1].turn.finish_reason == "stop"


def test_stream_accumulates_tool_calls():
    tc1 = SimpleNamespace(
        index=0,
        id="call_1",
        function=SimpleNamespace(name="read_file", arguments='{"pa'),
    )
    tc2 = SimpleNamespace(
        index=0, id=None, function=SimpleNamespace(name=None, arguments='th": "a.py"}')
    )
    chunks = [_chunk(tool_call=tc1), _chunk(tool_call=tc2), _chunk(finish="tool_calls")]
    provider = OpenAIProvider(client=_StreamClient(chunks))
    turn = list(provider.stream(model="gpt-5.5", messages=[]))[-1].turn
    assert turn.tool_calls[0] == ToolCall(
        id="call_1", name="read_file", arguments={"path": "a.py"}
    )


# -- OpenAI-compatible vendor providers (Z AI, DeepSeek, Kimi, MiniMax, Qwen, xAI, Mistral) ------

COMPAT_VENDORS = {
    "zai": "https://api.z.ai/api/paas/v4",
    "deepseek": "https://api.deepseek.com",
    "kimi": "https://api.moonshot.ai/v1",
    "minimax": "https://api.minimax.io/v1",
    "qwen": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "xai": "https://api.x.ai/v1",
    "mistral": "https://api.mistral.ai/v1",
}


def test_compat_vendor_descriptors_ship_prefilled_endpoints():
    from coworker.providers.registry import get_descriptor

    for name, endpoint in COMPAT_VENDORS.items():
        d = get_descriptor(name)
        assert d is not None and d.needs_key, name
        base = next(f for f in d.fields if f.key == "base_url")
        assert base.default == endpoint  # prefilled, editable
        assert not base.required  # blank falls back to the default in the builder
        assert "OpenAI-compatible" in d.blurb
        assert d.env_key and d.recommended_model


def test_compat_builder_defaults_and_profile_override(monkeypatch):
    from coworker.providers.registry import build_provider_client

    p = build_provider_client("zai", {"api_key": "zk"}, None)
    assert p._base_url == COMPAT_VENDORS["zai"]
    assert p._api_key == "zk"

    override = "https://open.bigmodel.cn/api/paas/v4"
    p2 = build_provider_client("zai", {"api_key": "zk", "base_url": override}, None)
    assert p2._base_url == override


def test_compat_builder_env_key_fallback(monkeypatch):
    from coworker.providers.registry import build_provider_client

    monkeypatch.setenv("DEEPSEEK_API_KEY", "ds-key")
    p = build_provider_client("deepseek", {}, None)
    assert p._api_key == "ds-key"
    assert p._base_url == COMPAT_VENDORS["deepseek"]


def test_compat_builder_never_leaks_the_openai_key(monkeypatch):
    """A configured OPENAI_API_KEY must never be sent to a different vendor's endpoint —
    a missing vendor key fails fast with a vendor-named error instead."""
    import pytest

    from coworker.providers.registry import build_provider_client

    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai-real")
    monkeypatch.delenv("MOONSHOT_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="Kimi"):
        build_provider_client("kimi", {}, None)


def test_compat_models_route_and_get_tool_capabilities():
    from coworker.providers.router import ProviderRouter

    router = ProviderRouter.__new__(
        ProviderRouter
    )  # only using _provider_name (stateless)
    for model in (
        "zai:glm-5.2",
        "deepseek:deepseek-v4-flash",
        "kimi:kimi-k2.6",
        "minimax:MiniMax-M2.5",
        "qwen:qwen3-max",
        "xai:grok-4.3",
        "mistral:mistral-large-latest",
    ):
        prefix = model.split(":", 1)[0]
        assert router._provider_name(model) == prefix
        assert ProviderRouter._bare(model) == model.split(":", 1)[1]
        caps = capabilities_for(model)
        assert caps.tools and caps.streaming


def test_compat_recommended_models_are_in_the_suggested_lists():
    """set_provider only auto-adds the recommended model if it's in _suggested_models —
    keep the registry and the manager's COMPAT_MODELS table in lockstep."""
    from coworker.providers.registry import get_descriptor
    from coworker.server.manager import SessionManager

    for name in COMPAT_VENDORS:
        d = get_descriptor(name)
        assert d.recommended_model in SessionManager.COMPAT_MODELS[name], name


# -- curated model matrix (labels + capabilities by full routed id) -----------------


def test_matrix_answers_capabilities_for_reseller_ids():
    """Reseller ids ('together:zai-org/GLM-5.2') defeat the name-prefix heuristics — the
    matrix must answer them exactly, with tool calling on."""
    for mid in (
        "together:zai-org/GLM-5.2",
        "together:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
        "fireworks:accounts/fireworks/models/kimi-k2p6",
    ):
        caps = capabilities_for(mid)
        assert caps.tools and caps.parallel_tool_calls and caps.streaming


def test_matrix_labels_and_custom_model_fallback():
    from coworker.providers.matrix import MATRIX, model_labels

    labels = model_labels()
    assert labels["together:zai-org/GLM-5.2"] == "GLM-5.2 · via Together"
    assert labels["zai:glm-5.2"] == "GLM-5.2 · Z AI"
    # Deliberately small: agent-capable current models only (owner call, 2026-07-04).
    assert len(MATRIX) < 40
    assert all(e.caps.tools for e in MATRIX.values())
    # A custom (unlisted) reseller model falls back to the conservative default — usable,
    # but at the user's own risk (no parallel tool calls assumed).
    caps = capabilities_for("together:some-org/Brand-New-Model")
    assert caps.tools and not caps.parallel_tool_calls


def test_reseller_descriptors_and_matrix_stay_in_lockstep():
    """Together/Fireworks suggested models derive from the matrix, and each descriptor's
    recommended model must be one of them (set_provider's auto-add depends on it)."""
    from coworker.providers.matrix import models_for_provider
    from coworker.providers.registry import get_descriptor

    for name in ("together", "fireworks"):
        d = get_descriptor(name)
        assert d is not None and d.needs_key
        curated = models_for_provider(name)
        assert curated and d.recommended_model in curated
        # full ids in the matrix must round-trip: prefix + bare == matrix key
        base = next(f for f in d.fields if f.key == "base_url")
        assert base.default.startswith("https://")


def test_foreign_sidecars_stripped_from_outbound_messages():
    """Provider-private sidecars (`_gemini` thought signatures et al) must never reach the
    OpenAI wire — it and its compat servers reject unknown message fields."""
    client = _FakeClient(_response(content="ok"))
    provider = OpenAIProvider(client=client)
    provider.complete(
        model="gpt-5.5",
        messages=[
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "prev", "_gemini": {"call_sigs": ["x"]}},
        ],
    )
    sent = client.chat.completions.calls[0]["messages"]
    assert sent[1] == {"role": "assistant", "content": "prev"}


def test_stream_reasoning_content_deltas():
    """DeepSeek-style thinking: reasoning_content deltas surface as reasoning chunks and
    land on the final turn — never mixed into the answer text."""
    def rchunk(text):
        delta = SimpleNamespace(content=None, tool_calls=None, reasoning_content=text)
        return SimpleNamespace(choices=[SimpleNamespace(delta=delta, finish_reason=None)])

    chunks = [rchunk("hmm "), rchunk("okay."), _chunk(content="Answer"), _chunk(finish="stop")]
    provider = OpenAIProvider(client=_StreamClient(chunks))
    out = list(provider.stream(model="deepseek-v4-pro", messages=[]))
    assert [c.reasoning_delta for c in out if c.reasoning_delta] == ["hmm ", "okay."]
    final = out[-1].turn
    assert final.text == "Answer" and final.reasoning == "hmm okay."


def test_complete_picks_up_reasoning_content():
    message = SimpleNamespace(content="Answer", tool_calls=None, reasoning_content="deep thought")
    choice = SimpleNamespace(message=message, finish_reason="stop")
    provider = OpenAIProvider(client=_FakeClient(SimpleNamespace(choices=[choice])))
    turn = provider.complete(model="deepseek-v4-pro", messages=[{"role": "user", "content": "x"}])
    assert turn.text == "Answer" and turn.reasoning == "deep thought"
