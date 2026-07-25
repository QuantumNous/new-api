"""Native Anthropic provider — message/tool conversion, complete(), stream(). SDK-free:
the fake client mimics the `anthropic` SDK's `messages.create` surface with SimpleNamespace
objects, the same pattern test_providers.py uses for the OpenAI SDK."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from coworker.providers import AnthropicProvider, capabilities_for
from coworker.providers.anthropic_provider import (
    DEFAULT_MAX_TOKENS,
    convert_messages,
    convert_tools,
)

# -- fakes ------------------------------------------------------------------------


class _FakeClient:
    """Records the kwargs passed to messages.create and returns a canned response
    (or an event iterator when stream=True)."""

    def __init__(self, response=None, events=None):
        self.kwargs: dict = {}

        def create(**kwargs):
            self.kwargs = kwargs
            if kwargs.get("stream"):
                return iter(events or [])
            return response

        self.messages = SimpleNamespace(create=create)
        # Fable/Mythos route through the beta endpoint (server-side refusal fallback).
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=create))


def _text_response(text="hello", stop_reason="end_turn"):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        stop_reason=stop_reason,
    )


# -- message conversion -------------------------------------------------------------


def test_convert_extracts_leading_system():
    system, msgs = convert_messages(
        [
            {"role": "system", "content": "be helpful"},
            {"role": "user", "content": "hi"},
        ]
    )
    assert system == "be helpful"
    assert msgs == [{"role": "user", "content": [{"type": "text", "text": "hi"}]}]


def test_convert_assistant_tool_turn_skips_empty_text():
    # The engine persists pure tool turns with content="" — no empty text block may leak.
    _, msgs = convert_messages(
        [
            {"role": "user", "content": "do it"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "f", "arguments": '{"x": 1}'},
                    }
                ],
            },
        ]
    )
    blocks = msgs[1]["content"]
    assert blocks == [{"type": "tool_use", "id": "c1", "name": "f", "input": {"x": 1}}]


def test_convert_merges_tool_result_run_into_one_user_message():
    # N parallel calls → N consecutive role:"tool" messages → ONE Anthropic user message.
    _, msgs = convert_messages(
        [
            {"role": "user", "content": "go"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "a", "arguments": "{}"},
                    },
                    {
                        "id": "c2",
                        "type": "function",
                        "function": {"name": "b", "arguments": "{}"},
                    },
                ],
            },
            {"role": "tool", "tool_call_id": "c1", "content": "r1"},
            {"role": "tool", "tool_call_id": "c2", "content": "r2"},
        ]
    )
    assert [m["role"] for m in msgs] == ["user", "assistant", "user"]
    results = msgs[2]["content"]
    assert [b["type"] for b in results] == ["tool_result", "tool_result"]
    assert [b["tool_use_id"] for b in results] == ["c1", "c2"]
    assert [b["content"] for b in results] == ["r1", "r2"]


def test_convert_steering_user_message_merges_after_tool_results():
    # Steering appends a user message after tool results; it must land in the SAME user
    # message, after the tool_result blocks.
    _, msgs = convert_messages(
        [
            {"role": "user", "content": "go"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "a", "arguments": "{}"},
                    }
                ],
            },
            {"role": "tool", "tool_call_id": "c1", "content": "r1"},
            {"role": "user", "content": "actually, stop"},
        ]
    )
    blocks = msgs[2]["content"]
    assert [b["type"] for b in blocks] == ["tool_result", "text"]
    assert blocks[1]["text"] == "actually, stop"


def test_convert_image_data_url_to_base64_source():
    _, msgs = convert_messages(
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "what is this"},
                    {
                        "type": "image_url",
                        "image_url": {"url": "data:image/png;base64,iVBORw0KGgo="},
                    },
                ],
            }
        ]
    )
    img = msgs[0]["content"][1]
    assert img == {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/png", "data": "iVBORw0KGgo="},
    }


def test_convert_image_http_url_and_malformed():
    _, msgs = convert_messages(
        [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": "https://x/y.png"}},
                    {"type": "image_url", "image_url": {"url": "not-a-url"}},
                ],
            }
        ]
    )
    blocks = msgs[0]["content"]
    assert blocks[0]["source"] == {"type": "url", "url": "https://x/y.png"}
    assert blocks[1] == {"type": "text", "text": "[unsupported image attachment]"}


def test_convert_drops_empty_assistant_and_guards_first_user():
    _, msgs = convert_messages(
        [
            {"role": "assistant", "content": ""},  # fully empty → dropped
            {"role": "assistant", "content": "hi"},
        ]
    )
    # the surviving assistant message can't be first → "(continued)" user is prepended
    assert msgs[0] == {
        "role": "user",
        "content": [{"type": "text", "text": "(continued)"}],
    }
    assert msgs[1]["role"] == "assistant"


def test_convert_empty_history_raises():
    with pytest.raises(ValueError):
        convert_messages([{"role": "assistant", "content": ""}])


def test_convert_malformed_tool_arguments_fall_back_to_raw():
    _, msgs = convert_messages(
        [
            {"role": "user", "content": "go"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "a", "arguments": "{bad"},
                    }
                ],
            },
        ]
    )
    assert msgs[1]["content"][0]["input"] == {"_raw": "{bad"}


# -- tool schema conversion ----------------------------------------------------------


def test_convert_tools_handles_missing_description_and_parameters():
    tools = convert_tools(
        [
            {"type": "function", "function": {"name": "bare"}},
            {
                "type": "function",
                "function": {
                    "name": "full",
                    "description": "does things",
                    "parameters": {
                        "type": "object",
                        "properties": {"x": {"type": "integer"}},
                    },
                },
            },
        ]
    )
    assert tools[0] == {
        "name": "bare",
        "input_schema": {"type": "object", "properties": {}},
    }
    assert tools[1]["description"] == "does things"
    assert tools[1]["input_schema"]["properties"] == {"x": {"type": "integer"}}


# -- complete() ----------------------------------------------------------------------


def test_complete_text_turn_with_defaults():
    fake = _FakeClient(response=_text_response("hello"))
    provider = AnthropicProvider(client=fake)
    turn = provider.complete(
        model="claude-sonnet-4-6",
        messages=[
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "hi"},
        ],
    )
    assert (
        turn.text == "hello"
        and turn.finish_reason == "stop"
        and not turn.has_tool_calls
    )
    assert fake.kwargs["model"] == "claude-sonnet-4-6"
    assert fake.kwargs["system"] == "sys"
    assert fake.kwargs["max_tokens"] == DEFAULT_MAX_TOKENS  # required param, injected
    assert "tools" not in fake.kwargs


def test_complete_parses_tool_use_blocks():
    response = SimpleNamespace(
        content=[
            SimpleNamespace(type="text", text="on it"),
            SimpleNamespace(
                type="tool_use", id="c1", name="write_file", input={"path": "a.txt"}
            ),
        ],
        stop_reason="tool_use",
    )
    provider = AnthropicProvider(client=_FakeClient(response=response))
    turn = provider.complete(model="m", messages=[{"role": "user", "content": "go"}])
    assert turn.text == "on it"
    assert turn.finish_reason == "tool_calls"
    assert turn.tool_calls[0].id == "c1"
    assert turn.tool_calls[0].name == "write_file"
    assert turn.tool_calls[0].arguments == {"path": "a.txt"}


@pytest.mark.parametrize(
    "stop_reason,expected",
    [
        ("end_turn", "stop"),
        ("tool_use", "tool_calls"),
        ("max_tokens", "length"),
        ("stop_sequence", "stop"),
        # "refusal" no longer maps — it raises (see test_whole_chain_refusal_raises…)
        ("something_new", "something_new"),  # unknown passes through
    ],
)
def test_complete_maps_stop_reasons(stop_reason, expected):
    provider = AnthropicProvider(
        client=_FakeClient(response=_text_response(stop_reason=stop_reason))
    )
    turn = provider.complete(model="m", messages=[{"role": "user", "content": "x"}])
    assert turn.finish_reason == expected


def test_complete_filters_and_aliases_settings():
    fake = _FakeClient(response=_text_response())
    provider = AnthropicProvider(client=fake)
    provider.complete(
        model="m",
        messages=[{"role": "user", "content": "x"}],
        temperature=0.2,
        max_tokens=512,  # explicit beats the default
        stop="END",  # OpenAI alias → stop_sequences
        frequency_penalty=0.5,  # not a Messages API param → dropped
    )
    assert fake.kwargs["temperature"] == 0.2
    assert fake.kwargs["max_tokens"] == 512
    assert fake.kwargs["stop_sequences"] == ["END"]
    assert "frequency_penalty" not in fake.kwargs and "stop" not in fake.kwargs


def test_complete_converts_tools():
    fake = _FakeClient(response=_text_response())
    provider = AnthropicProvider(client=fake)
    provider.complete(
        model="m",
        messages=[{"role": "user", "content": "x"}],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "f",
                    "description": "d",
                    "parameters": {"type": "object"},
                },
            }
        ],
    )
    assert fake.kwargs["tools"] == [
        {"name": "f", "description": "d", "input_schema": {"type": "object"}}
    ]


def test_ensure_client_without_key_raises(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="Anthropic"):
        AnthropicProvider()._ensure_client()


# -- stream() ------------------------------------------------------------------------


def _delta(index, **delta_attrs):
    return SimpleNamespace(
        type="content_block_delta", index=index, delta=SimpleNamespace(**delta_attrs)
    )


def test_stream_yields_text_deltas_then_final_turn():
    events = [
        SimpleNamespace(type="message_start"),
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="text"),
        ),
        _delta(0, type="text_delta", text="hel"),
        _delta(0, type="text_delta", text="lo"),
        SimpleNamespace(type="content_block_stop", index=0),
        SimpleNamespace(
            type="message_delta", delta=SimpleNamespace(stop_reason="end_turn")
        ),
        SimpleNamespace(type="message_stop"),
    ]
    provider = AnthropicProvider(client=_FakeClient(events=events))
    chunks = list(
        provider.stream(model="m", messages=[{"role": "user", "content": "x"}])
    )
    assert [c.text_delta for c in chunks[:-1]] == ["hel", "lo"]
    final = chunks[-1].turn
    assert (
        final.text == "hello"
        and final.finish_reason == "stop"
        and not final.has_tool_calls
    )


def test_stream_accumulates_split_tool_json():
    events = [
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="tool_use", id="c1", name="write_file"),
        ),
        _delta(0, type="input_json_delta", partial_json='{"path": "a'),
        _delta(0, type="input_json_delta", partial_json='.txt", "content": "hi"}'),
        SimpleNamespace(type="content_block_stop", index=0),
        SimpleNamespace(
            type="message_delta", delta=SimpleNamespace(stop_reason="tool_use")
        ),
    ]
    provider = AnthropicProvider(client=_FakeClient(events=events))
    chunks = list(
        provider.stream(model="m", messages=[{"role": "user", "content": "x"}])
    )
    final = chunks[-1].turn
    assert final.finish_reason == "tool_calls"
    assert final.tool_calls[0].id == "c1"
    assert final.tool_calls[0].arguments == {"path": "a.txt", "content": "hi"}


def test_stream_mixed_text_and_tool_blocks():
    events = [
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="text"),
        ),
        _delta(0, type="text_delta", text="working"),
        SimpleNamespace(
            type="content_block_start",
            index=1,
            content_block=SimpleNamespace(type="tool_use", id="c1", name="f"),
        ),
        _delta(1, type="input_json_delta", partial_json=""),  # no-args tool call
        SimpleNamespace(
            type="message_delta", delta=SimpleNamespace(stop_reason="tool_use")
        ),
    ]
    provider = AnthropicProvider(client=_FakeClient(events=events))
    chunks = list(
        provider.stream(model="m", messages=[{"role": "user", "content": "x"}])
    )
    assert chunks[0].text_delta == "working"
    final = chunks[-1].turn
    assert final.text == "working"
    assert final.tool_calls[0].arguments == {}  # empty json → {}


def test_stream_passes_stream_flag():
    fake = _FakeClient(events=[])
    provider = AnthropicProvider(client=fake)
    list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    assert fake.kwargs["stream"] is True
    assert fake.kwargs["max_tokens"] == DEFAULT_MAX_TOKENS


# -- registry / capabilities ----------------------------------------------------------


def test_registry_builds_native_anthropic_provider():
    from coworker.providers.registry import build_provider_client

    provider = build_provider_client("anthropic", {"api_key": "sk-ant-x"}, None)
    assert isinstance(provider, AnthropicProvider)
    assert provider._api_key == "sk-ant-x"
    # no key in the profile is fine at build time — resolution is deferred to first call
    assert isinstance(build_provider_client("anthropic", {}, None), AnthropicProvider)


def test_resolve_api_key_env_then_secrets(monkeypatch):
    from coworker.providers.anthropic_provider import resolve_api_key

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-env")
    assert resolve_api_key() == "sk-ant-env"
    monkeypatch.delenv("ANTHROPIC_API_KEY")

    class _Secrets:
        def get(self, name):
            return (
                {"api_key": "sk-ant-stored"} if name == "provider:anthropic" else None
            )

    assert resolve_api_key(_Secrets()) == "sk-ant-stored"
    assert resolve_api_key(None) is None


def test_anthropic_capabilities_parallel_tool_calls():
    caps = capabilities_for("anthropic:claude-sonnet-4-6")
    assert caps.tools and caps.vision and caps.streaming
    assert caps.parallel_tool_calls is True  # native provider folds results correctly


def test_convert_pdf_file_part_to_document_block():
    _, msgs = convert_messages(
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "summarize"},
                    {
                        "type": "file",
                        "file": {
                            "filename": "report.pdf",
                            "file_data": "data:application/pdf;base64,JVBERi0=",
                        },
                    },
                ],
            }
        ]
    )
    doc = msgs[0]["content"][1]
    assert doc == {
        "type": "document",
        "source": {
            "type": "base64",
            "media_type": "application/pdf",
            "data": "JVBERi0=",
        },
        "title": "report.pdf",
    }


def test_convert_malformed_file_part_becomes_text_note():
    _, msgs = convert_messages(
        [
            {
                "role": "user",
                "content": [{"type": "file", "file": {"file_data": "not-a-url"}}],
            }
        ]
    )
    assert msgs[0]["content"][0] == {
        "type": "text",
        "text": "[unsupported file attachment]",
    }


# -- extended thinking (model-layer roadmap item 4, phase 3) ------------------------


def test_thinking_config_is_model_family_aware():
    """API drift (owner-hit 2026-07-23): budget_tokens 400s on the Claude 5/4.7+ family
    ('use thinking.type.adaptive'); older models still need enabled+budget. display
    must be summarized on the new family or the trace text arrives empty."""
    for model in ("claude-fable-5", "claude-opus-4-8", "claude-sonnet-4-6"):
        client = _FakeClient(response=_text_response())
        AnthropicProvider(client=client, thinking_budget=8192).complete(
            model=model,
            messages=[{"role": "user", "content": "x"}],
            temperature=0.2,
            top_p=0.9,
        )
        assert client.kwargs["thinking"] == {"type": "adaptive", "display": "summarized"}, model
        assert "budget_tokens" not in str(client.kwargs["thinking"]), model
        assert "temperature" not in client.kwargs and "top_p" not in client.kwargs, model

    client = _FakeClient(response=_text_response())
    AnthropicProvider(client=client, thinking_budget=8192).complete(
        model="claude-haiku-4-5",
        messages=[{"role": "user", "content": "x"}],
        temperature=0.2,
    )
    assert client.kwargs["thinking"] == {"type": "enabled", "budget_tokens": 8192}
    assert client.kwargs["max_tokens"] > 8192
    assert "temperature" not in client.kwargs

    # Off (hidden override 0): no thinking param on any family.
    client2 = _FakeClient(response=_text_response())
    AnthropicProvider(client=client2).complete(
        model="claude-fable-5", messages=[{"role": "user", "content": "x"}]
    )
    assert "thinking" not in client2.kwargs


def test_complete_parses_thinking_blocks_into_reasoning_and_sidecar():
    response = SimpleNamespace(
        content=[
            SimpleNamespace(type="thinking", thinking="pondering...", signature="SIG1"),
            SimpleNamespace(type="redacted_thinking", data="OPAQUE"),
            SimpleNamespace(type="text", text="the answer"),
        ],
        stop_reason="end_turn",
    )
    provider = AnthropicProvider(client=_FakeClient(response=response), thinking_budget=4096)
    turn = provider.complete(model="claude-fable-5", messages=[{"role": "user", "content": "x"}])
    assert turn.text == "the answer"
    assert turn.reasoning == "pondering..."  # redacted stays out of the display text
    assert turn.extras["_anthropic"]["blocks"] == [
        {"type": "thinking", "thinking": "pondering...", "signature": "SIG1"},
        {"type": "redacted_thinking", "data": "OPAQUE"},
    ]


def test_stream_accumulates_thinking_and_signature():
    events = [
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="thinking", thinking="", signature=""),
        ),
        _delta(0, type="thinking_delta", thinking="step one. "),
        _delta(0, type="thinking_delta", thinking="step two."),
        _delta(0, type="signature_delta", signature="SIGSTREAM"),
        SimpleNamespace(type="content_block_stop", index=0),
        SimpleNamespace(
            type="content_block_start",
            index=1,
            content_block=SimpleNamespace(type="text"),
        ),
        _delta(1, type="text_delta", text="done"),
        SimpleNamespace(
            type="message_delta", delta=SimpleNamespace(stop_reason="end_turn")
        ),
    ]
    provider = AnthropicProvider(client=_FakeClient(events=events), thinking_budget=4096)
    chunks = list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    assert [c.reasoning_delta for c in chunks if c.reasoning_delta] == ["step one. ", "step two."]
    final = chunks[-1].turn
    assert final.text == "done" and final.reasoning == "step one. step two."
    assert final.extras["_anthropic"]["blocks"] == [
        {"type": "thinking", "thinking": "step one. step two.", "signature": "SIGSTREAM"}
    ]


def test_convert_replays_thinking_blocks_ahead_of_tool_use():
    _, msgs = convert_messages(
        [
            {"role": "user", "content": "go"},
            {
                "role": "assistant",
                "content": "",
                "_anthropic": {
                    "blocks": [
                        {"type": "thinking", "thinking": "plan", "signature": "S"},
                    ]
                },
                "tool_calls": [
                    {"id": "t1", "type": "function", "function": {"name": "a", "arguments": "{}"}},
                ],
            },
            {"role": "tool", "tool_call_id": "t1", "content": "ok"},
        ]
    )
    assistant = msgs[1]["content"]
    assert assistant[0] == {"type": "thinking", "thinking": "plan", "signature": "S"}
    assert assistant[1]["type"] == "tool_use"


def test_thinking_defaults_on_with_hidden_profile_override():
    """No user-facing setting (owner call 2026-07-23): thinking is ON by default; the
    profile's thinking_budget stays a hidden override, 0 = off."""
    from coworker.providers.anthropic_provider import DEFAULT_THINKING_BUDGET
    from coworker.providers.registry import build_provider_client

    assert build_provider_client("anthropic", {}, None).thinking_budget == DEFAULT_THINKING_BUDGET
    assert build_provider_client("anthropic", {"thinking_budget": "2048"}, None).thinking_budget == 2048
    assert build_provider_client("anthropic", {"thinking_budget": "0"}, None).thinking_budget == 0


def test_fable_requests_carry_server_side_fallback():
    """Fable/Mythos classifiers can decline benign-adjacent requests — every call opts
    into the server-side fallback so Opus 4.8 re-serves declines in the same call."""
    client = _FakeClient(response=_text_response())
    AnthropicProvider(client=client, thinking_budget=8192).complete(
        model="claude-fable-5", messages=[{"role": "user", "content": "x"}]
    )
    assert client.kwargs["betas"] == ["server-side-fallback-2026-06-01"]
    assert client.kwargs["fallbacks"] == [{"model": "claude-opus-4-8"}]

    # Other models stay on the plain endpoint with no fallback params.
    client2 = _FakeClient(response=_text_response())
    AnthropicProvider(client=client2).complete(
        model="claude-opus-4-8", messages=[{"role": "user", "content": "x"}]
    )
    assert "betas" not in client2.kwargs and "fallbacks" not in client2.kwargs


def test_whole_chain_refusal_raises_friendly_error():
    """A refusal that survives the fallback chain must surface as an error (notice +
    Retry in the GUI) — not a silent blank reply (owner-hit 2026-07-23)."""
    refused = SimpleNamespace(
        content=[],
        stop_reason="refusal",
        stop_details=SimpleNamespace(category="cyber", explanation="blocked"),
    )
    provider = AnthropicProvider(client=_FakeClient(response=refused), thinking_budget=8192)
    with pytest.raises(RuntimeError) as err:
        provider.complete(model="claude-fable-5", messages=[{"role": "user", "content": "x"}])
    assert "safety filter" in str(err.value) and "cyber" in str(err.value)
