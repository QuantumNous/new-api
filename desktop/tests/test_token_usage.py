"""Token-usage metering — provider capture, normalization, engine plumbing.

Fakes follow the provider test convention: SimpleNamespace objects mimicking each
SDK's response surface, dict events for Bedrock's Converse stream.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import aisuite as ai
from coworker.engine import TurnEngine
from coworker.events import EventType
from coworker.permissions import PermissionEngine
from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
)
from coworker.providers.anthropic_provider import AnthropicProvider
from coworker.providers.base import TokenUsage
from coworker.providers.bedrock_provider import _BedrockConverseClient
from coworker.providers.gemini_provider import GeminiProvider
from coworker.providers.matrix import model_context_windows
from coworker.providers.openai_provider import OpenAIProvider
from coworker.tools import ToolRegistry


def _final_turn(chunks):
    return chunks[-1].turn


# -- TokenUsage ---------------------------------------------------------------------


def test_context_tokens_is_prompt_side_total():
    usage = TokenUsage(input=100, output=50, cache_read=300, cache_write=20)
    assert usage.context_tokens == 420
    assert usage.as_dict() == {
        "input": 100,
        "output": 50,
        "cache_read": 300,
        "cache_write": 20,
    }


# -- Anthropic ----------------------------------------------------------------------


class _FakeAnthropicClient:
    def __init__(self, events):
        def create(**kwargs):
            self.kwargs = kwargs
            return events

        self.messages = SimpleNamespace(create=create)
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=create))


def test_anthropic_stream_captures_usage():
    events = [
        SimpleNamespace(
            type="message_start",
            message=SimpleNamespace(
                usage=SimpleNamespace(
                    input_tokens=7,
                    output_tokens=1,
                    cache_read_input_tokens=100,
                    cache_creation_input_tokens=25,
                )
            ),
        ),
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="text"),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="text_delta", text="hi"),
        ),
        SimpleNamespace(
            type="message_delta",
            delta=SimpleNamespace(stop_reason="end_turn"),
            usage=SimpleNamespace(output_tokens=42),
        ),
        SimpleNamespace(type="message_stop"),
    ]
    provider = AnthropicProvider(client=_FakeAnthropicClient(events))
    turn = _final_turn(
        list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    )
    assert turn.usage == TokenUsage(input=7, output=42, cache_read=100, cache_write=25)


def test_anthropic_complete_captures_usage():
    response = SimpleNamespace(
        content=[SimpleNamespace(type="text", text="hi")],
        stop_reason="end_turn",
        usage=SimpleNamespace(
            input_tokens=10,
            output_tokens=5,
            cache_read_input_tokens=0,
            cache_creation_input_tokens=0,
        ),
    )
    provider = AnthropicProvider(client=_FakeAnthropicClient(response))
    turn = provider.complete(model="m", messages=[{"role": "user", "content": "x"}])
    assert turn.usage == TokenUsage(input=10, output=5)


def test_anthropic_stream_without_usage_leaves_none():
    events = [
        SimpleNamespace(type="message_start"),  # no message/usage attrs
        SimpleNamespace(
            type="message_delta", delta=SimpleNamespace(stop_reason="end_turn")
        ),
    ]
    provider = AnthropicProvider(client=_FakeAnthropicClient(events))
    turn = _final_turn(
        list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    )
    assert turn.usage is None


# -- OpenAI-compat ------------------------------------------------------------------


class _FakeOpenAIClient:
    def __init__(self, chunks, *, reject_stream_options=False):
        self.calls = []

        def create(**kwargs):
            self.calls.append(kwargs)
            if reject_stream_options and "stream_options" in kwargs:
                raise RuntimeError("unknown parameter: 'stream_options'")
            return chunks

        self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))


def _openai_chunks():
    return [
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(content="hi", tool_calls=None),
                    finish_reason="stop",
                )
            ],
            usage=None,
        ),
        # Usage arrives on a final empty-choices chunk (include_usage contract).
        SimpleNamespace(
            choices=[],
            usage=SimpleNamespace(
                prompt_tokens=140,
                completion_tokens=9,
                prompt_tokens_details=SimpleNamespace(cached_tokens=40),
            ),
        ),
    ]


def test_openai_stream_requests_and_captures_usage():
    fake = _FakeOpenAIClient(_openai_chunks())
    provider = OpenAIProvider(client=fake)
    turn = _final_turn(
        list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    )
    assert fake.calls[0]["stream_options"] == {"include_usage": True}
    # Cached share is carved out of prompt_tokens into cache_read.
    assert turn.usage == TokenUsage(input=100, output=9, cache_read=40)


def test_openai_stream_retries_without_stream_options_when_rejected():
    fake = _FakeOpenAIClient(_openai_chunks(), reject_stream_options=True)
    provider = OpenAIProvider(client=fake)
    turn = _final_turn(
        list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    )
    assert "stream_options" not in fake.calls[-1]
    assert turn.text == "hi"  # the turn still completes; only metering is lost


def test_openai_complete_captures_usage_without_cache_details():
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content="hi", tool_calls=None),
                finish_reason="stop",
            )
        ],
        usage=SimpleNamespace(
            prompt_tokens=30, completion_tokens=4, prompt_tokens_details=None
        ),
    )
    fake = _FakeOpenAIClient(response)
    provider = OpenAIProvider(client=fake)
    turn = provider.complete(model="m", messages=[{"role": "user", "content": "x"}])
    assert turn.usage == TokenUsage(input=30, output=4)


# -- Gemini -------------------------------------------------------------------------


class _FakeGeminiClient:
    def __init__(self, responses):
        def generate_content_stream(**kwargs):
            self.kwargs = kwargs
            return iter(responses)

        def generate_content(**kwargs):
            self.kwargs = kwargs
            return responses[0]

        self.models = SimpleNamespace(
            generate_content=generate_content,
            generate_content_stream=generate_content_stream,
        )


def _gemini_response(text, usage_metadata=None):
    return SimpleNamespace(
        candidates=[
            SimpleNamespace(
                content=SimpleNamespace(
                    parts=[SimpleNamespace(text=text, function_call=None)]
                ),
                finish_reason=SimpleNamespace(name="STOP"),
            )
        ],
        usage_metadata=usage_metadata,
    )


def test_gemini_stream_keeps_last_usage_metadata():
    responses = [
        _gemini_response(
            "he",
            SimpleNamespace(
                prompt_token_count=90,
                candidates_token_count=1,
                cached_content_token_count=50,
                thoughts_token_count=0,
            ),
        ),
        _gemini_response(
            "y",
            # Cumulative — the last chunk carries the final totals.
            SimpleNamespace(
                prompt_token_count=90,
                candidates_token_count=12,
                cached_content_token_count=50,
                thoughts_token_count=6,
            ),
        ),
    ]
    provider = GeminiProvider(client=_FakeGeminiClient(responses))
    turn = _final_turn(
        list(provider.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    )
    # input = prompt minus cached; thinking tokens fold into output.
    assert turn.usage == TokenUsage(input=40, output=18, cache_read=50)


# -- Bedrock (Converse) -------------------------------------------------------------


def test_bedrock_converse_stream_captures_metadata_usage():
    fake = SimpleNamespace(
        converse_stream=lambda **kwargs: {
            "stream": [
                {"contentBlockDelta": {"delta": {"text": "hi"}, "contentBlockIndex": 0}},
                {"messageStop": {"stopReason": "end_turn"}},
                {
                    "metadata": {
                        "usage": {
                            "inputTokens": 11,
                            "outputTokens": 3,
                            "cacheReadInputTokens": 8,
                            "cacheWriteInputTokens": 2,
                        }
                    }
                },
            ]
        }
    )
    client = _BedrockConverseClient(client=fake)
    turn = _final_turn(
        list(client.stream(model="m", messages=[{"role": "user", "content": "x"}]))
    )
    assert turn.usage == TokenUsage(input=11, output=3, cache_read=8, cache_write=2)


# -- engine plumbing ----------------------------------------------------------------


class _UsageProvider(ProviderClient):
    def complete(self, *, model, messages, tools=None, **settings):
        return AssistantTurn(
            text="done",
            finish_reason="stop",
            usage=TokenUsage(input=100, output=20, cache_read=5),
        )

    def capabilities(self, model):
        return ModelCapabilities()


def _run_engine(tmp_path):
    registry = ToolRegistry()
    registry.register_all(ai.toolkits.files(root=str(tmp_path), allow_write=True))
    engine = TurnEngine(
        provider=_UsageProvider(),
        registry=registry,
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
    )

    async def _collect():
        return [ev async for ev in engine.run("hello")]

    return engine, asyncio.run(_collect())


def test_engine_attaches_usage_to_event_and_message(tmp_path):
    engine, events = _run_engine(tmp_path)
    assistant = next(ev for ev in events if ev.type == EventType.ASSISTANT_MESSAGE)
    expected = {
        "model": "gpt-5.5",
        "input": 100,
        "output": 20,
        "cache_read": 5,
        "cache_write": 0,
    }
    assert assistant.data["usage"] == expected
    persisted = next(m for m in engine.messages if m.get("role") == "assistant")
    assert persisted["usage"] == expected


def test_outbound_messages_strip_usage_sidecar(tmp_path):
    engine, _ = _run_engine(tmp_path)
    assert all("usage" not in m for m in engine._outbound_messages())


# -- matrix -------------------------------------------------------------------------


def test_model_context_windows_covers_verified_entries_only():
    windows = model_context_windows()
    assert windows["anthropic:claude-fable-5"] == 1_000_000
    assert "together:thinkingmachines/Inkling" not in windows  # unverified stays absent
    assert all(isinstance(v, int) and v > 0 for v in windows.values())
