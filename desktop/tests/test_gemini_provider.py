"""Native Gemini provider — message/tool conversion, complete(), stream(). SDK-free:
the fake client mimics the `google-genai` SDK's `models.generate_content[_stream]` surface
with SimpleNamespace objects, the same pattern the Anthropic provider tests use."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from coworker.providers import GeminiProvider, capabilities_for
from coworker.providers.gemini_provider import (
    _sanitize_schema,
    convert_messages,
    convert_tools,
)

# -- fakes ------------------------------------------------------------------------


class _FakeClient:
    """Records the kwargs passed to generate_content / generate_content_stream and returns a
    canned response (or chunk iterator)."""

    def __init__(self, response=None, chunks=None):
        self.kwargs: dict = {}

        def generate_content(**kwargs):
            self.kwargs = kwargs
            return response

        def generate_content_stream(**kwargs):
            self.kwargs = kwargs
            return iter(chunks or [])

        self.models = SimpleNamespace(
            generate_content=generate_content,
            generate_content_stream=generate_content_stream,
        )


def _response(parts, finish_reason="STOP"):
    return SimpleNamespace(
        candidates=[
            SimpleNamespace(
                content=SimpleNamespace(parts=parts),
                finish_reason=finish_reason,
            )
        ]
    )


def _text_part(text):
    return SimpleNamespace(text=text, function_call=None)


def _call_part(name, args):
    return SimpleNamespace(
        text=None, function_call=SimpleNamespace(name=name, args=args)
    )


# -- message conversion -------------------------------------------------------------


def test_convert_extracts_leading_system():
    system, contents = convert_messages(
        [
            {"role": "system", "content": "be helpful"},
            {"role": "user", "content": "hi"},
        ]
    )
    assert system == "be helpful"
    assert contents == [{"role": "user", "parts": [{"text": "hi"}]}]


def test_convert_assistant_tool_turn_maps_role_model():
    # Pure tool turns (content="") must not leak an empty text part; role becomes "model".
    _, contents = convert_messages(
        [
            {"role": "user", "content": "do it"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_0",
                        "type": "function",
                        "function": {"name": "f", "arguments": '{"x": 1}'},
                    }
                ],
            },
        ]
    )
    assert contents[1]["role"] == "model"
    assert contents[1]["parts"] == [{"function_call": {"name": "f", "args": {"x": 1}}}]


def test_convert_tool_results_map_id_to_name_and_merge():
    # Function calls have no wire ids: results must map back to the function NAME, and a run
    # of parallel results must fold into ONE user message.
    _, contents = convert_messages(
        [
            {"role": "user", "content": "go"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_0",
                        "type": "function",
                        "function": {"name": "a", "arguments": "{}"},
                    },
                    {
                        "id": "call_1",
                        "type": "function",
                        "function": {"name": "b", "arguments": "{}"},
                    },
                ],
            },
            {"role": "tool", "tool_call_id": "call_0", "content": '{"ok": true}'},
            {"role": "tool", "tool_call_id": "call_1", "content": "plain text"},
        ]
    )
    assert [c["role"] for c in contents] == ["user", "model", "user"]
    responses = [p["function_response"] for p in contents[2]["parts"]]
    assert responses[0] == {
        "name": "a",
        "response": {"ok": True},
    }  # JSON result passes through
    assert responses[1] == {
        "name": "b",
        "response": {"result": "plain text"},
    }  # string wrapped


def test_convert_repeated_ids_resolve_to_latest_turn():
    # Synthesized ids restart at call_0 each turn; a result always follows its own assistant
    # turn, so the forward-walking map must resolve to the LATEST name for a reused id.
    _, contents = convert_messages(
        [
            {"role": "user", "content": "go"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {"id": "call_0", "function": {"name": "first", "arguments": "{}"}}
                ],
            },
            {"role": "tool", "tool_call_id": "call_0", "content": "r1"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {"id": "call_0", "function": {"name": "second", "arguments": "{}"}}
                ],
            },
            {"role": "tool", "tool_call_id": "call_0", "content": "r2"},
        ]
    )
    names = [
        p["function_response"]["name"]
        for c in contents
        for p in c["parts"]
        if "function_response" in p
    ]
    assert names == ["first", "second"]


def test_convert_steering_user_message_merges_after_tool_results():
    _, contents = convert_messages(
        [
            {"role": "user", "content": "go"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {"id": "c1", "function": {"name": "a", "arguments": "{}"}}
                ],
            },
            {"role": "tool", "tool_call_id": "c1", "content": "r1"},
            {"role": "user", "content": "actually, stop"},
        ]
    )
    parts = contents[2]["parts"]
    assert "function_response" in parts[0]
    assert parts[1] == {"text": "actually, stop"}


def test_convert_image_data_url_to_inline_data():
    _, contents = convert_messages(
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
    assert contents[0]["parts"][1] == {
        "inline_data": {"mime_type": "image/png", "data": "iVBORw0KGgo="}
    }


def test_convert_non_data_image_url_becomes_placeholder():
    _, contents = convert_messages(
        [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": "https://x/y.png"}}
                ],
            }
        ]
    )
    assert contents[0]["parts"] == [{"text": "[unsupported image attachment]"}]


def test_convert_guards_first_user_and_empty_history():
    _, contents = convert_messages([{"role": "assistant", "content": "hi"}])
    assert contents[0] == {"role": "user", "parts": [{"text": "(continued)"}]}
    with pytest.raises(ValueError):
        convert_messages([{"role": "assistant", "content": ""}])


# -- tool schema conversion ----------------------------------------------------------


def test_convert_tools_wraps_function_declarations():
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
    assert len(tools) == 1
    declarations = tools[0]["function_declarations"]
    assert declarations[0] == {
        "name": "bare"
    }  # parameter-less: no `parameters` key at all
    assert declarations[1]["description"] == "does things"
    assert declarations[1]["parameters"]["properties"] == {"x": {"type": "integer"}}
    assert convert_tools(None) == []


def test_sanitize_schema_strips_unsupported_keys():
    schema = {
        "type": "object",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "additionalProperties": False,
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": True,
                    "properties": {"x": {"type": "string", "examples": ["a"]}},
                },
            }
        },
        "required": ["items"],
    }
    cleaned = _sanitize_schema(schema)
    assert "$schema" not in cleaned and "additionalProperties" not in cleaned
    inner = cleaned["properties"]["items"]["items"]
    assert "additionalProperties" not in inner
    assert "examples" not in inner["properties"]["x"]
    assert cleaned["required"] == ["items"]


# -- complete() ----------------------------------------------------------------------


def test_complete_text_turn():
    fake = _FakeClient(response=_response([_text_part("hello")]))
    provider = GeminiProvider(client=fake)
    turn = provider.complete(
        model="gemini-2.5-flash",
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
    assert fake.kwargs["model"] == "gemini-2.5-flash"
    assert fake.kwargs["config"]["system_instruction"] == "sys"
    assert "tools" not in fake.kwargs["config"]


def test_complete_parses_function_calls_with_synthesized_ids():
    fake = _FakeClient(
        response=_response(
            [
                _text_part("on it"),
                _call_part("write_file", {"path": "a.txt"}),
                _call_part("read_file", {"path": "b"}),
            ]
        )
    )
    provider = GeminiProvider(client=fake)
    turn = provider.complete(model="m", messages=[{"role": "user", "content": "go"}])
    assert turn.text == "on it"
    assert turn.finish_reason == "tool_calls"  # STOP + function calls → tool_calls
    assert [(c.id, c.name) for c in turn.tool_calls] == [
        ("call_0", "write_file"),
        ("call_1", "read_file"),
    ]
    assert turn.tool_calls[0].arguments == {"path": "a.txt"}


@pytest.mark.parametrize(
    "finish,expected",
    [
        ("STOP", "stop"),
        ("MAX_TOKENS", "length"),
        ("SAFETY", "stop"),
        ("WEIRD_NEW", "weird_new"),
    ],
)
def test_complete_maps_finish_reasons(finish, expected):
    provider = GeminiProvider(
        client=_FakeClient(response=_response([_text_part("x")], finish_reason=finish))
    )
    turn = provider.complete(model="m", messages=[{"role": "user", "content": "x"}])
    assert turn.finish_reason == expected


def test_complete_filters_and_aliases_settings():
    fake = _FakeClient(response=_response([_text_part("x")]))
    provider = GeminiProvider(client=fake)
    provider.complete(
        model="m",
        messages=[{"role": "user", "content": "x"}],
        temperature=0.2,
        max_tokens=512,  # OpenAI alias → max_output_tokens
        stop="END",  # OpenAI alias → stop_sequences
        frequency_penalty=0.5,  # not a Gemini param → dropped
    )
    config = fake.kwargs["config"]
    assert config["temperature"] == 0.2
    assert config["max_output_tokens"] == 512
    assert config["stop_sequences"] == ["END"]
    assert (
        "frequency_penalty" not in config
        and "stop" not in config
        and "max_tokens" not in config
    )


def test_complete_passes_converted_tools_in_config():
    fake = _FakeClient(response=_response([_text_part("x")]))
    provider = GeminiProvider(client=fake)
    provider.complete(
        model="m",
        messages=[{"role": "user", "content": "x"}],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "f",
                    "parameters": {
                        "type": "object",
                        "properties": {"a": {"type": "string"}},
                    },
                },
            }
        ],
    )
    declarations = fake.kwargs["config"]["tools"][0]["function_declarations"]
    assert declarations[0]["name"] == "f"


def test_ensure_client_without_key_raises(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="Gemini"):
        GeminiProvider()._ensure_client()


# -- stream() ------------------------------------------------------------------------


def test_stream_yields_text_deltas_then_final_turn():
    chunks = [
        _response([_text_part("hel")], finish_reason=None),
        _response([_text_part("lo")], finish_reason="STOP"),
    ]
    provider = GeminiProvider(client=_FakeClient(chunks=chunks))
    out = list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    assert [c.text_delta for c in out[:-1]] == ["hel", "lo"]
    final = out[-1].turn
    assert (
        final.text == "hello"
        and final.finish_reason == "stop"
        and not final.has_tool_calls
    )


def test_stream_collects_function_calls_across_chunks():
    chunks = [
        _response([_text_part("working")], finish_reason=None),
        _response([_call_part("f", {"x": 1})], finish_reason=None),
        _response([_call_part("g", {})], finish_reason="STOP"),
    ]
    provider = GeminiProvider(client=_FakeClient(chunks=chunks))
    out = list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    final = out[-1].turn
    assert final.finish_reason == "tool_calls"
    assert [(c.id, c.name) for c in final.tool_calls] == [
        ("call_0", "f"),
        ("call_1", "g"),
    ]
    assert final.tool_calls[0].arguments == {"x": 1}


def test_stream_handles_enum_like_finish_reason():
    # the SDK's finish_reason is an enum with a .name; fakes may pass a plain string
    chunks = [
        _response([_text_part("x")], finish_reason=SimpleNamespace(name="MAX_TOKENS"))
    ]
    provider = GeminiProvider(client=_FakeClient(chunks=chunks))
    final = list(
        provider.stream(model="m", messages=[{"role": "user", "content": "x"}])
    )[-1].turn
    assert final.finish_reason == "length"


# -- registry / capabilities ----------------------------------------------------------


def test_registry_builds_native_gemini_provider():
    from coworker.providers.registry import build_provider_client

    provider = build_provider_client("gemini", {"api_key": "AIza-x"}, None)
    assert isinstance(provider, GeminiProvider)
    assert provider._api_key == "AIza-x"
    # no key in the profile is fine at build time — resolution is deferred to first call
    assert isinstance(build_provider_client("gemini", {}, None), GeminiProvider)


def test_resolve_api_key_env_then_secrets(monkeypatch):
    from coworker.providers.gemini_provider import resolve_api_key

    monkeypatch.setenv("GEMINI_API_KEY", "AIza-env")
    assert resolve_api_key() == "AIza-env"
    monkeypatch.delenv("GEMINI_API_KEY")
    monkeypatch.setenv("GOOGLE_API_KEY", "AIza-google")  # the SDK's own env convention
    assert resolve_api_key() == "AIza-google"
    monkeypatch.delenv("GOOGLE_API_KEY")

    class _Secrets:
        def get(self, name):
            return {"api_key": "AIza-stored"} if name == "provider:gemini" else None

    assert resolve_api_key(_Secrets()) == "AIza-stored"
    assert resolve_api_key(None) is None


def test_gemini_capabilities_parallel_tool_calls():
    caps = capabilities_for("gemini:gemini-2.5-flash")
    assert caps.tools and caps.vision and caps.streaming
    assert caps.parallel_tool_calls is True  # native provider folds results correctly


def test_convert_pdf_file_part_to_inline_data():
    from coworker.providers.gemini_provider import _user_parts

    parts = _user_parts(
        [
            {"type": "text", "text": "summarize"},
            {
                "type": "file",
                "file": {
                    "filename": "report.pdf",
                    "file_data": "data:application/pdf;base64,JVBERi0=",
                },
            },
            {"type": "file", "file": {"file_data": "not-a-url"}},
        ]
    )
    assert parts[1] == {
        "inline_data": {"mime_type": "application/pdf", "data": "JVBERi0="}
    }
    assert parts[2] == {"text": "[unsupported file attachment]"}

# -- Gemini 3 thought signatures (2026-07 roadmap item 2) ---------------------------


def _sig_call_part(name, args, sig):
    return SimpleNamespace(
        text=None,
        function_call=SimpleNamespace(name=name, args=args),
        thought_signature=sig,
    )


def _thought_part(text, sig=None):
    return SimpleNamespace(
        text=text, function_call=None, thought=True, thought_signature=sig
    )


def test_complete_captures_signatures_and_filters_thought_parts():
    response = _response(
        [
            _thought_part("secret reasoning", sig=b"tsig"),
            SimpleNamespace(text="the answer", function_call=None, thought_signature=None),
            _sig_call_part("run_shell", {"command": "ls"}, b"csig"),
        ]
    )
    provider = GeminiProvider(client=_FakeClient(response=response))
    turn = provider.complete(model="m", messages=[{"role": "user", "content": "x"}])

    assert turn.text == "the answer"  # thought text never leaks into the answer
    assert turn.tool_calls[0].name == "run_shell"
    import base64

    sidecar = turn.extras["_gemini"]
    assert sidecar["text_sig"] == base64.b64encode(b"tsig").decode()
    assert sidecar["call_sigs"] == [base64.b64encode(b"csig").decode()]


def test_complete_without_signatures_has_no_extras():
    response = _response([_text_part("plain")])
    provider = GeminiProvider(client=_FakeClient(response=response))
    turn = provider.complete(model="m", messages=[{"role": "user", "content": "x"}])
    assert turn.extras == {}


def test_stream_accumulates_signatures_across_chunks():
    chunks = [
        _response([_text_part("hi ")], finish_reason=None),
        _response([_sig_call_part("t1", {}, b"s1")], finish_reason=None),
        _response([_sig_call_part("t2", {}, None)], finish_reason="STOP"),
    ]
    provider = GeminiProvider(client=_FakeClient(chunks=chunks))
    final = list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))[-1].turn
    import base64

    assert [c.name for c in final.tool_calls] == ["t1", "t2"]
    assert final.extras["_gemini"]["call_sigs"] == [
        base64.b64encode(b"s1").decode(),
        None,
    ]


def test_convert_reattaches_signatures_to_parts():
    system, contents = convert_messages(
        [
            {"role": "user", "content": "do it"},
            {
                "role": "assistant",
                "content": "on it",
                "_gemini": {"text_sig": "dHNpZw==", "call_sigs": [None, "Y3NpZw=="]},
                "tool_calls": [
                    {"id": "call_0", "type": "function", "function": {"name": "a", "arguments": "{}"}},
                    {"id": "call_1", "type": "function", "function": {"name": "b", "arguments": "{}"}},
                ],
            },
        ]
    )
    parts = contents[-1]["parts"]
    assert parts[0] == {"text": "on it", "thought_signature": "dHNpZw=="}
    assert "thought_signature" not in parts[1]  # first call had no signature
    assert parts[2]["function_call"]["name"] == "b"
    assert parts[2]["thought_signature"] == "Y3NpZw=="


def test_convert_signature_parts_validate_as_sdk_types():
    """The dict parts we emit (base64-string signatures) must round-trip through the real
    SDK Part model — its base64 bytes-validation is what decodes them on send."""
    types_mod = pytest.importorskip("google.genai.types")
    _, contents = convert_messages(
        [
            {"role": "user", "content": "go"},
            {
                "role": "assistant",
                "content": "",
                "_gemini": {"text_sig": None, "call_sigs": ["c2ln"]},
                "tool_calls": [
                    {"id": "call_0", "type": "function", "function": {"name": "a", "arguments": "{}"}},
                ],
            },
        ]
    )
    part = types_mod.Part.model_validate(contents[-1]["parts"][0])
    assert part.thought_signature == b"sig"


def test_thought_summaries_requested_and_surfaced_as_reasoning():
    response = _response(
        [
            _thought_part("plotting a plan", sig=None),
            SimpleNamespace(text="the answer", function_call=None, thought_signature=None),
        ]
    )
    client = _FakeClient(response=response)
    provider = GeminiProvider(client=client)
    turn = provider.complete(model="gemini-3.6-flash", messages=[{"role": "user", "content": "x"}])

    # We ask for summaries on every gemini-* model…
    assert client.kwargs["config"]["thinking_config"] == {"include_thoughts": True}
    # …and thought parts land as reasoning, never as answer text.
    assert turn.text == "the answer" and turn.reasoning == "plotting a plan"


def test_stream_yields_reasoning_deltas_for_thought_parts():
    chunks = [
        _response([_thought_part("mull ")], finish_reason=None),
        _response([_thought_part("it over")], finish_reason=None),
        _response([_text_part("done")], finish_reason="STOP"),
    ]
    provider = GeminiProvider(client=_FakeClient(chunks=chunks))
    out = list(provider.stream(model="gemini-3.6-flash", messages=[{"role": "user", "content": "x"}]))
    assert [c.reasoning_delta for c in out if c.reasoning_delta] == ["mull ", "it over"]
    final = out[-1].turn
    assert final.text == "done" and final.reasoning == "mull it over"


def test_sanitize_coerces_union_types():
    """Vendor MCP schemas use JSON-Schema union types (owner-hit 2026-07-23: monday's
    compareValue `type: ['string','number']` 400'd every Gemini turn). Nullable unions
    become `nullable`, multi-type unions become anyOf."""
    cleaned = _sanitize_schema(
        {
            "type": "object",
            "properties": {
                "compareValue": {
                    "anyOf": [
                        {"type": "string"},
                        {"type": "array", "items": {"type": ["string", "number"]}},
                    ]
                },
                "maybe": {"type": ["string", "null"]},
                "nothing": {"type": ["null"]},
            },
        }
    )
    items = cleaned["properties"]["compareValue"]["anyOf"][1]["items"]
    assert items == {"anyOf": [{"type": "string"}, {"type": "number"}]}
    assert cleaned["properties"]["maybe"] == {"type": "string", "nullable": True}
    assert cleaned["properties"]["nothing"] == {"nullable": True}


def test_union_type_schema_validates_as_sdk_config():
    """The exact failing shape must pass the SDK's GenerateContentConfig validation."""
    types_mod = pytest.importorskip("google.genai.types")
    tools = convert_tools(
        [
            {
                "type": "function",
                "function": {
                    "name": "mcp__monday__search",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "filters": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "compareValue": {
                                            "anyOf": [
                                                {"type": "string"},
                                                {"type": "number"},
                                                {"type": "array", "items": {"type": "string"}},
                                                {"type": "array", "items": {"type": ["string", "number"]}},
                                            ]
                                        }
                                    },
                                },
                            }
                        },
                    },
                },
            }
        ]
    )
    config = types_mod.GenerateContentConfig.model_validate({"tools": tools})
    assert config.tools
