"""AWS Bedrock provider — family dispatch, Converse mapping (plain dicts), registry glue."""

from __future__ import annotations

from typing import Any, Optional

import pytest

from coworker.providers import capabilities_for
from coworker.providers.base import AssistantTurn, ProviderClient, StreamChunk
from coworker.providers.bedrock_provider import (
    BedrockProvider,
    _BedrockConverseClient,
    _session_kwargs,
    convert_messages,
    convert_tools,
)

# -- converters -------------------------------------------------------------------


def test_convert_messages_system_and_folding():
    system, messages = convert_messages(
        [
            {"role": "system", "content": "be terse"},
            {"role": "user", "content": "hi"},
            {
                "role": "assistant",
                "content": "checking",
                "tool_calls": [
                    {
                        "id": "t1",
                        "type": "function",
                        "function": {"name": "ls", "arguments": '{"path": "."}'},
                    },
                    {
                        "id": "t2",
                        "type": "function",
                        "function": {"name": "pwd", "arguments": "{}"},
                    },
                ],
            },
            {"role": "tool", "tool_call_id": "t1", "content": "a.txt"},
            {"role": "tool", "tool_call_id": "t2", "content": "/repo"},
        ]
    )
    assert system == [{"text": "be terse"}]
    assert [m["role"] for m in messages] == ["user", "assistant", "user"]
    assistant = messages[1]["content"]
    assert assistant[0] == {"text": "checking"}
    assert assistant[1]["toolUse"] == {
        "toolUseId": "t1",
        "name": "ls",
        "input": {"path": "."},
    }
    # Both parallel results folded into the single next user message.
    results = messages[2]["content"]
    assert [r["toolResult"]["toolUseId"] for r in results] == ["t1", "t2"]
    assert results[0]["toolResult"]["content"] == [{"text": "a.txt"}]


def test_convert_messages_inserts_leading_user():
    _, messages = convert_messages([{"role": "assistant", "content": "hello"}])
    assert messages[0] == {"role": "user", "content": [{"text": "(continued)"}]}


def test_convert_tools_shape_and_empty():
    config = convert_tools(
        [
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Read a file",
                    "parameters": {
                        "type": "object",
                        "properties": {"path": {"type": "string"}},
                    },
                },
            },
            {"type": "function", "function": {"name": "noargs"}},
        ]
    )
    spec = config["tools"][0]["toolSpec"]
    assert spec["name"] == "read_file"
    assert spec["description"] == "Read a file"
    assert spec["inputSchema"]["json"]["properties"]["path"] == {"type": "string"}
    # Typeless parameters become an empty object schema (Converse requires one).
    empty = config["tools"][1]["toolSpec"]["inputSchema"]["json"]
    assert empty == {"type": "object", "properties": {}}
    assert convert_tools(None) is None
    assert convert_tools([]) is None


# -- Converse client (dict-returning fakes, like boto3) ----------------------------


class _FakeConverse:
    def __init__(self, response: Optional[dict] = None, stream: Optional[list] = None):
        self.response = response
        self.stream_events = stream or []
        self.calls: list[tuple[str, dict]] = []

    def converse(self, **kwargs):
        self.calls.append(("converse", kwargs))
        return self.response

    def converse_stream(self, **kwargs):
        self.calls.append(("converse_stream", kwargs))
        return {"stream": iter(self.stream_events)}


def test_converse_complete_text():
    fake = _FakeConverse(
        response={
            "output": {"message": {"content": [{"text": "hello there"}]}},
            "stopReason": "end_turn",
        }
    )
    client = _BedrockConverseClient(client=fake)
    turn = client.complete(
        model="meta.llama4-maverick-17b-instruct-v1:0",
        messages=[
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "hi"},
        ],
        temperature=0.5,
        frequency_penalty=0.2,  # not a Converse knob — must be dropped
    )
    assert turn.text == "hello there"
    assert turn.finish_reason == "stop"
    method, kwargs = fake.calls[0]
    assert method == "converse"
    assert kwargs["modelId"] == "meta.llama4-maverick-17b-instruct-v1:0"
    assert kwargs["system"] == [{"text": "sys"}]
    assert kwargs["inferenceConfig"]["temperature"] == 0.5
    assert kwargs["inferenceConfig"]["maxTokens"] > 0  # default applied
    assert "frequency_penalty" not in kwargs["inferenceConfig"]
    assert "toolConfig" not in kwargs


def test_converse_complete_tool_use_and_reasoning():
    fake = _FakeConverse(
        response={
            "output": {
                "message": {
                    "content": [
                        {"reasoningContent": {"reasoningText": {"text": "hmm"}}},
                        {"text": "let me check"},
                        {
                            "toolUse": {
                                "toolUseId": "call-1",
                                "name": "ls",
                                "input": {"path": "."},
                            }
                        },
                    ]
                }
            },
            "stopReason": "tool_use",
        }
    )
    client = _BedrockConverseClient(client=fake)
    turn = client.complete(
        model="amazon.nova-2-pro-v1:0",
        messages=[{"role": "user", "content": "list files"}],
        tools=[{"type": "function", "function": {"name": "ls", "parameters": {}}}],
    )
    assert turn.finish_reason == "tool_calls"
    assert turn.reasoning == "hmm"
    assert turn.text == "let me check"
    (call,) = turn.tool_calls
    assert (call.id, call.name, call.arguments) == ("call-1", "ls", {"path": "."})
    _, kwargs = fake.calls[0]
    assert kwargs["toolConfig"]["tools"][0]["toolSpec"]["name"] == "ls"


def test_converse_stream_accumulates_text_and_tool():
    fake = _FakeConverse(
        stream=[
            {"messageStart": {"role": "assistant"}},
            {"contentBlockDelta": {"delta": {"text": "hel"}, "contentBlockIndex": 0}},
            {"contentBlockDelta": {"delta": {"text": "lo"}, "contentBlockIndex": 0}},
            {
                "contentBlockStart": {
                    "start": {"toolUse": {"toolUseId": "c1", "name": "ls"}},
                    "contentBlockIndex": 1,
                }
            },
            {
                "contentBlockDelta": {
                    "delta": {"toolUse": {"input": '{"path"'}},
                    "contentBlockIndex": 1,
                }
            },
            {
                "contentBlockDelta": {
                    "delta": {"toolUse": {"input": ': "."}'}},
                    "contentBlockIndex": 1,
                }
            },
            {"contentBlockStop": {"contentBlockIndex": 1}},
            {"messageStop": {"stopReason": "tool_use"}},
        ]
    )
    client = _BedrockConverseClient(client=fake)
    chunks = list(
        client.stream(
            model="mistral.mistral-large-3-v1:0",
            messages=[{"role": "user", "content": "go"}],
        )
    )
    assert [c.text_delta for c in chunks if c.text_delta] == ["hel", "lo"]
    final = chunks[-1].turn
    assert final.text == "hello"
    assert final.finish_reason == "tool_calls"
    (call,) = final.tool_calls
    assert (call.id, call.name, call.arguments) == ("c1", "ls", {"path": "."})


def test_no_credentials_error_becomes_friendly():
    from botocore.exceptions import NoCredentialsError

    class _Raises:
        def converse(self, **kwargs):
            raise NoCredentialsError()

    client = _BedrockConverseClient(client=_Raises())
    with pytest.raises(RuntimeError, match="Settings"):
        client.complete(model="m", messages=[{"role": "user", "content": "x"}])


# -- credential resolution ----------------------------------------------------------


def test_session_kwargs_resolution_order():
    explicit = _session_kwargs("work", "AKIA1", "secret", "token")
    assert explicit == {
        "aws_access_key_id": "AKIA1",
        "aws_secret_access_key": "secret",
        "aws_session_token": "token",
    }
    assert _session_kwargs("work", None, None, None) == {"profile_name": "work"}
    assert _session_kwargs(None, None, None, None) == {}  # ambient chain


# -- family dispatch ----------------------------------------------------------------


class _Recorder(ProviderClient):
    def __init__(self):
        self.seen: list[str] = []

    def complete(self, *, model, messages, tools=None, **settings):
        self.seen.append(model)
        return AssistantTurn(text="ok")

    def stream(self, *, model, messages, tools=None, **settings):
        self.seen.append(model)
        yield StreamChunk(turn=AssistantTurn(text="ok"))

    def capabilities(self, model):
        return capabilities_for(model)


def test_family_dispatch():
    claude, converse = _Recorder(), _Recorder()
    p = BedrockProvider(
        region="us-east-1", claude_client=claude, converse_client=converse
    )
    p.complete(
        model="claude/anthropic.claude-sonnet-4-6-v1:0",
        messages=[{"role": "user", "content": "x"}],
    )
    p.complete(
        model="other/amazon.nova-2-pro-v1:0",
        messages=[{"role": "user", "content": "x"}],
    )
    # A raw Bedrock id with no family segment still works — Converse serves everything.
    p.complete(
        model="meta.llama4-maverick-17b-instruct-v1:0",
        messages=[{"role": "user", "content": "x"}],
    )
    assert claude.seen == ["anthropic.claude-sonnet-4-6-v1:0"]
    assert converse.seen == [
        "amazon.nova-2-pro-v1:0",
        "meta.llama4-maverick-17b-instruct-v1:0",
    ]


def test_claude_family_builds_native_anthropic_over_bedrock(monkeypatch):
    from anthropic import AnthropicBedrock

    from coworker.providers import AnthropicProvider

    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    p = BedrockProvider(region="us-east-1", profile_name="work")
    sub = p._family_client("claude")
    assert isinstance(sub, AnthropicProvider)
    assert isinstance(sub._client, AnthropicBedrock)


def test_claude_family_prefers_bedrock_api_key_over_sigv4(monkeypatch):
    """A Bedrock API key must take the bearer path WITHOUT the SigV4 params —
    AnthropicBedrock raises outright when both are passed."""
    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    p = BedrockProvider(
        region="us-east-1", bedrock_api_key="ABSKtest", profile_name="work"
    )
    sub = p._family_client("claude")
    assert sub._client.api_key == "ABSKtest"
    assert sub._client.aws_profile is None


def test_auth_method_narrows_out_other_methods_fields(monkeypatch):
    """Stale values stored under a previously-selected method must never leak into a
    different auth path — the selected method drops everything else at construction."""
    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    p = BedrockProvider(
        region="us-east-1",
        auth_method="profile",
        bedrock_api_key="ABSKstale",
        profile_name="work",
        access_key_id="AKIAstale",
        secret_access_key="stale",
    )
    assert p._bedrock_api_key is None
    assert p._access_key_id is None
    sub = p._family_client("claude")
    assert sub._client.api_key is None
    assert sub._client.aws_profile == "work"

    p2 = BedrockProvider(
        region="us-east-1", auth_method="api_key", bedrock_api_key="ABSKlive",
        profile_name="stale",
    )
    assert p2._profile_name is None
    assert p2._family_client("claude")._client.api_key == "ABSKlive"


def test_converse_client_publishes_api_key_as_bearer_env(monkeypatch):
    import os

    import boto3

    from coworker.providers.bedrock_provider import _BedrockConverseClient

    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)

    class _FakeSession:
        def __init__(self, **kwargs):
            pass

        def client(self, service, **kwargs):
            return object()

    monkeypatch.setattr(boto3.session, "Session", _FakeSession)
    client = _BedrockConverseClient(region="us-east-1", bedrock_api_key="ABSKtest")
    client._ensure_client()
    assert os.environ["AWS_BEARER_TOKEN_BEDROCK"] == "ABSKtest"


# -- capabilities / matrix ------------------------------------------------------------


def test_bedrock_capabilities_from_matrix_and_fallback():
    curated = capabilities_for("bedrock:claude/anthropic.claude-sonnet-4-6-v1:0")
    assert curated.vision and curated.pdf and curated.parallel_tool_calls
    assert capabilities_for("bedrock:other/amazon.nova-2-pro-v1:0").tools
    # Custom ids fall back on the family segment: Claude keeps native caps,
    # unknown Converse models stay conservative.
    custom_claude = capabilities_for("bedrock:claude/us.anthropic.claude-opus-4-8-v1:0")
    assert custom_claude.vision and custom_claude.parallel_tool_calls
    custom_other = capabilities_for("bedrock:other/cohere.command-b-v1:0")
    assert custom_other.tools and not custom_other.parallel_tool_calls


def test_router_prefix_survives_bedrock_version_colons():
    from coworker.providers.router import ProviderRouter

    router = ProviderRouter.__new__(ProviderRouter)
    model = "bedrock:claude/anthropic.claude-sonnet-4-6-v1:0"
    assert router._provider_name(model) == "bedrock"
    assert ProviderRouter._bare(model) == "claude/anthropic.claude-sonnet-4-6-v1:0"


# -- registry / manager glue -----------------------------------------------------------


def test_bedrock_descriptor_and_builder():
    from coworker.providers.registry import build_provider_client, get_descriptor

    d = get_descriptor("bedrock")
    assert d is not None and d.needs_key
    keys = [f.key for f in d.fields]
    assert keys == [
        "region",
        "auth_method",
        "bedrock_api_key",
        "aws_profile",
        "aws_access_key_id",
        "aws_secret_access_key",
        "aws_session_token",
    ]
    assert [f.key for f in d.fields if f.required] == ["region"]
    secret = {f.key for f in d.fields if f.secret}
    assert secret == {"bedrock_api_key", "aws_secret_access_key", "aws_session_token"}
    # One auth method at a time: a defaulted segmented choice drives per-method fields.
    method = next(f for f in d.fields if f.key == "auth_method")
    assert method.default == "api_key"
    assert [c["value"] for c in method.choices] == ["api_key", "profile", "iam"]
    by_key = {f.key: f for f in d.fields}
    assert by_key["bedrock_api_key"].show_when == {"auth_method": "api_key"}
    assert by_key["aws_profile"].show_when == {"auth_method": "profile"}
    assert by_key["aws_secret_access_key"].show_when == {"auth_method": "iam"}
    assert by_key["region"].show_when is None
    assert by_key["region"].to_dict()["choices"] == []
    # Recommended model is curated in the matrix (set_provider's auto-add depends on it).
    from coworker.providers.matrix import models_for_provider

    assert d.recommended_model in models_for_provider("bedrock")

    p = build_provider_client(
        "bedrock", {"region": "eu-west-1", "aws_profile": "work"}, None
    )
    assert isinstance(p, BedrockProvider)
    assert p._region == "eu-west-1" and p._profile_name == "work"


def test_bedrock_configured_needs_region_only():
    from coworker.providers.registry import descriptor_configured, get_descriptor

    d = get_descriptor("bedrock")
    assert not descriptor_configured(d, {})
    assert not descriptor_configured(d, {"aws_profile": "work"})
    assert descriptor_configured(d, {"region": "us-east-1"})


def test_single_key_providers_keep_api_key_configured_semantics(monkeypatch):
    from coworker.providers.registry import descriptor_configured, get_descriptor

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    d = get_descriptor("anthropic")
    assert not descriptor_configured(d, {})
    assert descriptor_configured(d, {"api_key": "sk-ant-x"})
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-env")
    assert descriptor_configured(d, {})


# -- verify ---------------------------------------------------------------------------


class _FakeBedrockControl:
    def __init__(self, exc: Optional[Exception] = None):
        self.exc = exc

    def list_foundation_models(self):
        if self.exc:
            raise self.exc
        return {"modelSummaries": []}


def _patch_session(monkeypatch, control: Any, captured: dict):
    import boto3

    class _FakeSession:
        def __init__(self, **kwargs):
            captured["session"] = kwargs

        def client(self, service, **kwargs):
            captured["service"] = service
            captured["client"] = kwargs
            return control

    monkeypatch.setattr(boto3.session, "Session", _FakeSession)


def test_verify_bedrock_ok(monkeypatch):
    from coworker.providers.registry import verify_provider_key

    captured: dict = {}
    _patch_session(monkeypatch, _FakeBedrockControl(), captured)
    out = verify_provider_key(
        "bedrock",
        fields={"region": "us-east-1", "auth_method": "profile", "aws_profile": "work"},
    )
    assert out == {"ok": True}
    assert captured["service"] == "bedrock"
    assert captured["session"] == {"profile_name": "work"}
    assert captured["client"]["region_name"] == "us-east-1"


def test_verify_bedrock_per_method_required_fields(monkeypatch):
    from coworker.providers.registry import verify_provider_key

    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    out = verify_provider_key(
        "bedrock", fields={"region": "us-east-1", "auth_method": "api_key"}
    )
    assert not out["ok"] and "Bedrock API key" in out["error"]
    out = verify_provider_key(
        "bedrock",
        fields={"region": "us-east-1", "auth_method": "iam", "aws_access_key_id": "AKIA"},
    )
    assert not out["ok"] and "secret access key" in out["error"]
    # Blank profile is fine — it means the default credential chain.
    captured: dict = {}
    _patch_session(monkeypatch, _FakeBedrockControl(), captured)
    out = verify_provider_key(
        "bedrock", fields={"region": "us-east-1", "auth_method": "profile"}
    )
    assert out == {"ok": True}
    assert captured["session"] == {}


def test_verify_bedrock_ignores_other_methods_stale_fields(monkeypatch):
    from coworker.providers.registry import verify_provider_key

    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    captured: dict = {}
    _patch_session(monkeypatch, _FakeBedrockControl(), captured)
    out = verify_provider_key(
        "bedrock",
        fields={
            "region": "us-east-1",
            "auth_method": "iam",
            "aws_access_key_id": "AKIA1",
            "aws_secret_access_key": "sec",
            "aws_profile": "stale",  # other method's leftover — must not be used
        },
    )
    assert out == {"ok": True}
    assert captured["session"] == {
        "aws_access_key_id": "AKIA1",
        "aws_secret_access_key": "sec",
    }


def test_verify_bedrock_api_key_rides_the_bearer_env(monkeypatch):
    import os

    from coworker.providers.registry import verify_provider_key

    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    captured: dict = {}
    _patch_session(monkeypatch, _FakeBedrockControl(), captured)
    out = verify_provider_key(
        "bedrock", fields={"region": "us-east-1", "bedrock_api_key": "ABSKtest"}
    )
    assert out == {"ok": True}
    assert captured["session"] == {}  # bearer only — no SigV4 session kwargs
    assert os.environ["AWS_BEARER_TOKEN_BEDROCK"] == "ABSKtest"


def test_verify_bedrock_maps_client_errors(monkeypatch):
    from botocore.exceptions import ClientError

    from coworker.providers.registry import verify_provider_key

    denied = ClientError(
        {"Error": {"Code": "AccessDeniedException", "Message": "no"}},
        "ListFoundationModels",
    )
    _patch_session(monkeypatch, _FakeBedrockControl(exc=denied), {})
    out = verify_provider_key(
        "bedrock", fields={"region": "us-east-1", "auth_method": "profile"}
    )
    assert not out["ok"] and "Bedrock access" in out["error"]

    bad_key = ClientError(
        {"Error": {"Code": "UnrecognizedClientException", "Message": "no"}},
        "ListFoundationModels",
    )
    _patch_session(monkeypatch, _FakeBedrockControl(exc=bad_key), {})
    out = verify_provider_key(
        "bedrock", fields={"region": "us-east-1", "auth_method": "profile"}
    )
    assert not out["ok"] and "rejected" in out["error"]
