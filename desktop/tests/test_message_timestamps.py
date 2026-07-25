"""FB-005 (server half) — canonical messages carry a `ts` sidecar.

`ts` (unix seconds) is stamped when a message is appended to the canonical history,
persisted, and served raw by `GET /v1/sessions/{id}/messages` — but, like `source` and
`_display`, it must NEVER reach a provider payload."""

from __future__ import annotations

import asyncio
import time

import aisuite as ai
from fastapi.testclient import TestClient

from coworker.engine import TurnEngine
from coworker.permissions import PermissionEngine
from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    ToolCall,
)
from coworker.server import SessionManager, create_app
from coworker.tools import ToolRegistry


class CapturingProvider(ProviderClient):
    """Queued turns + a record of every message list the provider was handed."""

    def __init__(self, turns):
        self._turns = list(turns)
        self.calls: list[list[dict]] = []

    def complete(self, *, model, messages, tools=None, **settings):
        self.calls.append([dict(m) for m in messages])
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


def _text(text):
    return AssistantTurn(text=text, finish_reason="stop")


def _tool(name, args, call_id="call_1"):
    return AssistantTurn(
        tool_calls=[ToolCall(id=call_id, name=name, arguments=args)],
        finish_reason="tool_calls",
    )


def _engine(tmp_path, turns):
    provider = CapturingProvider(turns)
    registry = ToolRegistry()
    registry.register_all(ai.toolkits.files(root=str(tmp_path), allow_write=True))
    engine = TurnEngine(
        provider=provider,
        registry=registry,
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
    )
    return engine, provider


def _run(engine, text):
    async def _go():
        return [ev async for ev in engine.run(text)]

    return asyncio.run(_go())


def test_appended_messages_carry_ts(tmp_path):
    (tmp_path / "a.txt").write_text("hello", encoding="utf-8")
    engine, _ = _engine(
        tmp_path,
        [_tool("read_file", {"path": "a.txt"}), _text("it says hello")],
    )
    before = time.time()
    _run(engine, "read a.txt")
    after = time.time()
    assert [m["role"] for m in engine.messages] == [
        "user",
        "assistant",
        "tool",
        "assistant",
    ]
    for m in engine.messages:  # user, assistant, AND tool messages are stamped
        assert isinstance(m["ts"], float)
        assert before <= m["ts"] <= after


def test_provider_payload_never_carries_ts(tmp_path):
    (tmp_path / "a.txt").write_text("hello", encoding="utf-8")
    engine, provider = _engine(
        tmp_path,
        [_tool("read_file", {"path": "a.txt"}), _text("done")],
    )
    _run(engine, "read a.txt")
    assert provider.calls, "provider should have been invoked"
    assert all("ts" not in m for call in provider.calls for m in call)
    # the strip is a copy — the canonical history keeps its timestamps
    assert all("ts" in m for m in engine.messages)


def test_outbound_strip_is_unconditional(tmp_path):
    # Direct check on the single provider feed, no-context early-return path included.
    engine, _ = _engine(tmp_path, [])
    engine.messages.append({"role": "user", "content": "hi", "ts": 1700000000.0})
    out = engine._outbound_messages()
    assert all("ts" not in m for m in out)
    assert engine.messages[-1]["ts"] == 1700000000.0  # original untouched


def _no_ts_keys(value) -> bool:
    if isinstance(value, dict):
        return all(k != "ts" and _no_ts_keys(v) for k, v in value.items())
    if isinstance(value, list):
        return all(_no_ts_keys(v) for v in value)
    return True


def test_provider_adapters_drop_ts():
    """Defense in depth: the native Anthropic/Gemini payload builders rebuild messages
    from role/content, so a `ts` that somehow slipped past the engine strip still never
    reaches the wire."""
    from coworker.providers.anthropic_provider import convert_messages as to_anthropic
    from coworker.providers.gemini_provider import convert_messages as to_gemini

    history = [
        {"role": "system", "content": "be brief"},
        {"role": "user", "content": "hi", "ts": 1700000000.0},
        {"role": "assistant", "content": "hello", "ts": 1700000001.0},
    ]
    for convert in (to_anthropic, to_gemini):
        _system, payload = convert(history)
        assert _no_ts_keys(payload)


def test_messages_endpoint_returns_ts(tmp_path):
    manager = SessionManager(
        workspace=tmp_path, provider=CapturingProvider([_text("hi there")])
    )
    client = TestClient(create_app(manager))
    with client.websocket_connect("/ws/session/ts1") as ws:
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "user_message", "text": "hello world"})
        while ws.receive_json()["type"] != "turn_done":
            pass
    msgs = client.get("/v1/sessions/ts1/messages").json()["messages"]
    stamped = [m for m in msgs if m.get("role") in ("user", "assistant")]
    assert stamped and all(isinstance(m.get("ts"), float) for m in stamped)
