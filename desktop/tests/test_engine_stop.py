"""Stop-button semantics: interrupt must bite in EVERY engine state, not just the
between-iterations checkpoint (v0.1.4 shipped with that as the only one — ledgered
2026-07-21). History invariant throughout: every tool_call gets a tool result, since
hosted chat templates reject orphans and durable-resume re-prompts them."""

from __future__ import annotations

import asyncio
import time

from coworker.engine import ApprovalOutcome, TurnEngine
from coworker.events import EventType
from coworker.permissions import PermissionEngine
from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    StreamChunk,
    ToolCall,
)
from coworker.tools import ToolRegistry


class EndlessStreamProvider(ProviderClient):
    """Streams deltas ~forever (bounded so a regression fails instead of hanging)."""

    def __init__(self):
        self.chunks_produced = 0

    def complete(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def capabilities(self, model):
        return ModelCapabilities()

    def stream(self, *, model, messages, tools=None, **settings):
        for i in range(200):
            self.chunks_produced += 1
            yield StreamChunk(text_delta=f"w{i} ")
            time.sleep(0.01)
        yield StreamChunk(turn=AssistantTurn(text="full", finish_reason="stop"))


def _tool_turn(calls):
    return AssistantTurn(
        tool_calls=[ToolCall(id=f"c{i}", name=n, arguments=a) for i, (n, a) in enumerate(calls)],
        finish_reason="tool_calls",
    )


class OneTurnProvider(ProviderClient):
    def __init__(self, turn):
        self._turn = turn
        self.calls = 0

    def complete(self, **kwargs):
        self.calls += 1
        return self._turn

    def capabilities(self, model):
        return ModelCapabilities()


def _tool_results(engine):
    return [m for m in engine.messages if m.get("role") == "tool"]


def test_stop_mid_stream_keeps_partial_text(tmp_path):
    provider = EndlessStreamProvider()
    engine = TurnEngine(
        provider=provider,
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
    )

    async def run():
        events = []
        async for ev in engine.run("go"):
            events.append(ev)
            if ev.type == EventType.ASSISTANT_DELTA and len(events) > 3:
                engine.request_interrupt()
        return events

    events = asyncio.run(run())
    assert events[-1].type == EventType.INTERRUPTED
    # Far fewer than the full 200 chunks were consumed…
    assert provider.chunks_produced < 100
    # …and the partial text the user watched is persisted, with no tool calls,
    # capped by the interrupted marker (display-only notice role).
    assert engine.messages[-1] == {
        "role": "notice",
        "kind": "interrupted",
        "ts": engine.messages[-1]["ts"],
    }
    partial = engine.messages[-2]
    assert partial["role"] == "assistant" and partial["content"].startswith("w0 ")
    assert "tool_calls" not in partial
    # The notice never reaches a provider.
    assert all(m.get("role") != "notice" for m in engine._outbound_messages())


class FailingStreamProvider(ProviderClient):
    """Streams a few deltas, then dies — a provider outage mid-answer."""

    def complete(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def capabilities(self, model):
        return ModelCapabilities()

    def stream(self, *, model, messages, tools=None, **settings):
        yield StreamChunk(text_delta="partial ")
        yield StreamChunk(text_delta="answer")
        raise RuntimeError("provider went away")


def test_provider_error_mid_stream_keeps_partial_text(tmp_path):
    engine = TurnEngine(
        provider=FailingStreamProvider(),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
    )

    async def run():
        return [ev async for ev in engine.run("go")]

    events = asyncio.run(run())
    assert events[-1].type == EventType.ERROR
    notice = engine.messages[-1]
    assert notice["role"] == "notice" and notice["kind"] == "error"
    assert "provider went away" in notice["text"]
    partial = engine.messages[-2]
    assert partial["role"] == "assistant" and partial["content"] == "partial answer"
    assert "tool_calls" not in partial


class FlakyProvider(ProviderClient):
    """Fails the first N stream calls, then answers — a provider outage that recovers."""

    def __init__(self, failures=1):
        self._failures = failures
        self.calls = 0

    def complete(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def capabilities(self, model):
        return ModelCapabilities()

    def stream(self, *, model, messages, tools=None, **settings):
        self.calls += 1
        if self.calls <= self._failures:
            raise RuntimeError("outage")
        yield StreamChunk(turn=AssistantTurn(text="recovered", finish_reason="stop"))


def test_retry_reruns_failed_turn_without_new_user_message(tmp_path):
    provider = FlakyProvider(failures=1)
    engine = TurnEngine(
        provider=provider,
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
    )

    async def scenario():
        first = [ev async for ev in engine.run("hello")]
        second = [ev async for ev in engine.retry()]
        return first, second

    first, second = asyncio.run(scenario())
    assert first[-1].type == EventType.ERROR
    assert second[-1].type == EventType.TURN_END
    # Exactly one user message — retry re-runs, it doesn't re-ask.
    assert sum(1 for m in engine.messages if m.get("role") == "user") == 1
    assert engine.messages[-1]["content"] == "recovered"


def test_retry_is_noop_unless_tail_is_error_notice(tmp_path):
    engine = TurnEngine(
        provider=OneTurnProvider(AssistantTurn(text="done", finish_reason="stop")),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
    )

    async def scenario():
        async for _ in engine.run("hello"):
            pass
        return [ev async for ev in engine.retry()]

    # A completed session must not grow a second answer from a stray retry frame.
    assert asyncio.run(scenario()) == []
    assert engine.messages[-1]["content"] == "done"


def test_stop_while_awaiting_approval(tmp_path):
    async def never_answers(_req):
        await asyncio.Event().wait()  # a pending approval card nobody answers

    registry = ToolRegistry()

    def write_file(path: str, content: str):  # pragma: no cover — never approved
        raise AssertionError("executed while awaiting approval")

    registry.register(write_file)
    engine = TurnEngine(
        provider=OneTurnProvider(_tool_turn([("write_file", {"path": "x", "content": "y"})])),
        registry=registry,
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
        approver=never_answers,
    )

    async def run():
        events = []
        async for ev in engine.run("go"):
            events.append(ev)
            if ev.type == EventType.PERMISSION_REQUIRED:
                engine.request_interrupt()
        return events

    events = asyncio.run(run())
    assert events[-1].type == EventType.INTERRUPTED
    (result,) = _tool_results(engine)
    assert "interrupted by user" in result["content"]


def test_stop_skips_remaining_tool_calls(tmp_path):
    registry = ToolRegistry()
    holder = {}

    def first_tool():
        """Runs, then the user hits Stop while it holds the turn."""
        holder["engine"].request_interrupt()
        return {"ok": True}

    def second_tool():  # pragma: no cover — must never run
        raise AssertionError("second tool executed after stop")

    registry.register(first_tool)
    registry.register(second_tool)

    async def approve(_req):
        return ApprovalOutcome.ONCE

    engine = TurnEngine(
        provider=OneTurnProvider(_tool_turn([("first_tool", {}), ("second_tool", {})])),
        registry=registry,
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
        approver=approve,
    )
    holder["engine"] = engine

    async def run():
        return [ev async for ev in engine.run("go")]

    events = asyncio.run(run())
    assert events[-1].type == EventType.INTERRUPTED
    results = _tool_results(engine)
    assert len(results) == 2  # both calls answered — no orphans
    assert "interrupted by user" in results[1]["content"]


def test_interrupt_hook_fires(tmp_path):
    fired = []
    engine = TurnEngine(
        provider=OneTurnProvider(AssistantTurn(text="hi", finish_reason="stop")),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
        interrupt_hooks=[lambda: fired.append(True)],
    )
    engine.request_interrupt()
    assert fired == [True]


class ReasoningStreamProvider(ProviderClient):
    """Streams thinking deltas, then answer text — a DeepSeek-style reasoning model."""

    def complete(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def capabilities(self, model):
        return ModelCapabilities()

    def stream(self, *, model, messages, tools=None, **settings):
        yield StreamChunk(reasoning_delta="hmm, ")
        yield StreamChunk(reasoning_delta="let me think")
        yield StreamChunk(text_delta="the answer")
        yield StreamChunk(
            turn=AssistantTurn(
                text="the answer", finish_reason="stop", reasoning="hmm, let me think"
            )
        )


def test_reasoning_streams_persists_and_never_reaches_providers(tmp_path):
    engine = TurnEngine(
        provider=ReasoningStreamProvider(),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="deepseek:deepseek-v4-pro",
    )

    async def run():
        return [ev async for ev in engine.run("go")]

    events = asyncio.run(run())
    deltas = [ev.data["text"] for ev in events if ev.type == EventType.REASONING_DELTA]
    assert deltas == ["hmm, ", "let me think"]
    final = next(ev for ev in events if ev.type == EventType.ASSISTANT_MESSAGE)
    assert final.data["reasoning"] == "hmm, let me think"
    persisted = engine.messages[-1]
    assert persisted["reasoning"] == "hmm, let me think"
    # Display-only: stripped from every provider feed.
    assert all("reasoning" not in m for m in engine._outbound_messages())


def test_stop_during_thinking_keeps_partial_reasoning(tmp_path):
    class EndlessThinkingProvider(ProviderClient):
        def complete(self, **kwargs):  # pragma: no cover
            raise NotImplementedError

        def capabilities(self, model):
            return ModelCapabilities()

        def stream(self, *, model, messages, tools=None, **settings):
            for i in range(200):
                yield StreamChunk(reasoning_delta=f"t{i} ")
                time.sleep(0.01)
            yield StreamChunk(turn=AssistantTurn(text="done", finish_reason="stop"))

    engine = TurnEngine(
        provider=EndlessThinkingProvider(),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
    )

    async def run():
        events = []
        async for ev in engine.run("go"):
            events.append(ev)
            if ev.type == EventType.REASONING_DELTA and len(events) > 3:
                engine.request_interrupt()
        return events

    events = asyncio.run(run())
    assert events[-1].type == EventType.INTERRUPTED
    partial = engine.messages[-2]  # [-1] is the interrupted notice
    assert partial["role"] == "assistant" and partial["reasoning"].startswith("t0 ")


def test_retry_survives_model_switches(tmp_path):
    """Error → switch models (one or more times) → Retry must still re-run, on the NEW
    model (owner-hit 2026-07-23: the switch notices consumed the retry guard)."""
    provider = FlakyProvider(failures=1)
    engine = TurnEngine(
        provider=provider,
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gemini:gemini-3.6-flash",
    )

    async def scenario():
        first = [ev async for ev in engine.run("hello")]
        assert engine.switch_model("gemini:gemini-3.1-pro-preview") is not None
        assert engine.switch_model("gpt-5.6-sol") is not None
        second = [ev async for ev in engine.retry()]
        return first, second

    first, second = asyncio.run(scenario())
    assert first[-1].type == EventType.ERROR
    assert second[-1].type == EventType.TURN_END
    assert engine.model == "gpt-5.6-sol"
    assert engine.messages[-1]["content"] == "recovered"
    # Still exactly one user message; and a completed session stays retry-proof.
    assert sum(1 for m in engine.messages if m.get("role") == "user") == 1
    assert asyncio.run(_drain_retry(engine)) == []


async def _drain_retry(engine):
    return [ev async for ev in engine.retry()]
