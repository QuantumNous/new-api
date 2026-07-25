"""Phase 2 — structured connector inbound messages (UI-REFRESH §3).

A connector message reaches a session as a framed text blob (model-facing `content`) plus a
display-only `MessageSource` sidecar. The sidecar is persisted (so `GET /messages` renders a card)
but stripped before any message reaches a provider. These tests pin that contract.
"""

import asyncio

from fastapi.testclient import TestClient

from coworker.connectors.base import MessageEvent, MessageSource, SessionSource
from coworker.engine import TurnEngine
from coworker.permissions import PermissionEngine
from coworker.providers import AssistantTurn, ModelCapabilities, ProviderClient
from coworker.server import create_app
from coworker.server.manager import SessionManager
from coworker.tools import ToolRegistry


class CapturingProvider(ProviderClient):
    """Returns queued turns and records the messages handed to it on each call — so a test can
    assert exactly what the provider saw (framed text, no `source`)."""

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


def _channel_event(text="deploy failed", chat_id="C1"):
    return MessageEvent(
        text=text,
        source=SessionSource(
            platform="slack",
            chat_id=chat_id,
            user_id="U1",
            user_name="Bob",
            chat_name="#ocw-test",
            chat_type="channel",
        ),
        message_id="1700000001.000001",
    )


def _dm_event(text="ping me", chat_id="D1"):
    return MessageEvent(
        text=text,
        source=SessionSource(
            platform="slack",
            chat_id=chat_id,
            user_id="U2",
            user_name="Sue",
            chat_name="Sue",
            chat_type="dm",
        ),
        message_id="1700000002.000002",
    )


def _connect_slack(mgr):
    """Inbound delivery is gated on the connector being CONNECTED (§4.3). Tests used to pass
    by riding the developer's real Slack profile; with the isolated state dir (conftest) each
    test must connect its own."""
    mgr.secrets.put(
        "slack:default",
        {"bot_token": "xoxb-test", "app_token": "xapp-test", "enabled": True},
    )


def test_inbound_builds_message_source(tmp_path, monkeypatch):
    mgr = SessionManager(workspace=tmp_path, provider=CapturingProvider([]))
    _connect_slack(mgr)
    captured: list[tuple] = []

    async def fake_deliver(session_id, message, *, source=None):
        captured.append((session_id, message, source))

    monkeypatch.setattr(mgr, "deliver_to_session", fake_deliver)
    mgr.subscriptions.subscribe("sA", "slack:C1")

    asyncio.run(mgr._dispatch_inbound(_channel_event()))

    assert len(captured) == 1
    sid, message, source = captured[0]
    assert sid == "sA"
    assert source == {
        "connector": "slack",
        "kind": "channel",
        "channel_id": "C1",
        "channel_name": "#ocw-test",
        "sender_id": "U1",
        "sender_name": "Bob",
        "ts": float("1700000001.000001"),
        "text": "deploy failed",
    }
    # the delivered `message` is the FRAMED (model-facing) text, not the raw message
    assert "subscribed" in message and "deploy failed" in message


def test_message_source_persisted_and_stripped(tmp_path):
    provider = CapturingProvider([_text("ack")])
    mgr = SessionManager(workspace=tmp_path, provider=provider)
    _connect_slack(mgr)
    mgr.get_engine("S", agent="chat")  # durable, workspace-free session
    mgr.subscriptions.subscribe("S", "slack:C1")

    asyncio.run(mgr._dispatch_inbound(_channel_event()))

    client = TestClient(create_app(mgr))
    messages = client.get("/v1/sessions/S/messages").json()["messages"]
    user_msgs = [m for m in messages if m.get("role") == "user"]
    assert user_msgs, messages
    last_user = user_msgs[-1]

    # persisted WITH the display-only source sidecar
    assert last_user["source"]["connector"] == "slack"
    assert last_user["source"]["channel_name"] == "#ocw-test"
    assert last_user["source"]["sender_name"] == "Bob"
    assert last_user["source"]["text"] == "deploy failed"  # raw message on the card
    # the model-facing content stays the FRAMED text (raw message is NOT the content)
    assert "subscribed" in last_user["content"]
    assert last_user["content"] != "deploy failed"

    # the provider was called and saw the framed text with NO source / unknown keys
    assert provider.calls, "provider should have been invoked"
    sent_user = [m for m in provider.calls[0] if m.get("role") == "user"][-1]
    assert "source" not in sent_user
    assert "subscribed" in sent_user["content"]  # framed, not raw
    # NO message handed to ANY provider call carries a source key
    assert all("source" not in m for call in provider.calls for m in call)


def test_outbound_strips_source_with_and_without_context(tmp_path):
    """Direct engine check that the `source` strip is UNCONDITIONAL — it happens on the
    no-context early-return path too, not only when a `<system-context>` block is added.
    """
    registry = ToolRegistry()
    permissions = PermissionEngine(workspace_root=tmp_path)
    src = {"connector": "slack", "kind": "channel", "text": "raw"}

    # no context provider → the early-return path must still strip `source`
    engine = TurnEngine(
        provider=CapturingProvider([]),
        registry=registry,
        permissions=permissions,
        model="gpt-5.5",
    )
    engine.messages.append({"role": "user", "content": "framed", "source": src})
    out = engine._outbound_messages()
    assert all("source" not in m for m in out)
    # self.messages is never mutated — the sidecar is preserved for persistence
    assert engine.messages[-1]["source"] == src

    # with a context provider the strip still holds, plus the block is appended
    engine2 = TurnEngine(
        provider=CapturingProvider([]),
        registry=registry,
        permissions=permissions,
        model="gpt-5.5",
        context_provider=lambda: "live ctx",
    )
    engine2.messages.append({"role": "user", "content": "framed", "source": src})
    out2 = engine2._outbound_messages()
    assert all("source" not in m for m in out2)
    assert "<system-context>" in out2[-1]["content"]
    assert engine2.messages[-1]["source"] == src  # original untouched


def test_tool_display_sidecar_is_agent_invisible(tmp_path):
    """`_display` on a tool result (e.g. gmail filter-hidden counts) mirrors the
    `source` contract: lifted onto the message for the GUI, audited as a rule+count
    row, and stripped from every provider feed — the agent sees no tombstone."""
    from coworker.providers.base import ToolCall

    audits: list[dict] = []
    engine = TurnEngine(
        provider=CapturingProvider([]),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
        audit_sink=audits.append,
    )
    tc = ToolCall(id="t1", name="gmail_search_messages", arguments={"query": "q"})
    engine._record_result(
        tc,
        {
            "ok": True,
            "data": {"messages": [{"id": "m2"}]},
            "_display": {"hidden_by_filters": 2, "connector": "gmail"},
        },
        "ok",
    )

    msg = engine.messages[-1]
    assert msg["_display"] == {"hidden_by_filters": 2, "connector": "gmail"}
    assert "_display" not in msg["content"] and "hidden" not in msg["content"]

    out = engine._outbound_messages()
    assert all("_display" not in m for m in out)
    assert engine.messages[-1]["_display"]  # persisted for the tool card

    filtered = [a for a in audits if a.get("stage") == "filtered"]
    assert len(filtered) == 1
    assert "2 result(s) hidden" in filtered[0]["reason"]


def test_turn_start_carries_source(tmp_path):
    mgr = SessionManager(workspace=tmp_path, provider=CapturingProvider([_text("ok")]))
    _connect_slack(mgr)
    mgr.get_engine("S", agent="chat")
    mgr.subscriptions.subscribe("S", "slack:C1")

    events: list[dict] = []

    async def cb(msg):
        events.append(msg)

    mgr.register_session_client("S", cb)

    asyncio.run(mgr._dispatch_inbound(_channel_event()))

    starts = [e for e in events if e["type"] == "turn_start"]
    assert starts, events
    source = starts[0]["data"]["source"]
    assert source["connector"] == "slack"
    assert source["kind"] == "channel"
    assert source["channel_name"] == "#ocw-test"
    assert source["text"] == "deploy failed"


def test_dm_message_source_kind_dm(tmp_path, monkeypatch):
    mgr = SessionManager(workspace=tmp_path, provider=CapturingProvider([]))
    _connect_slack(mgr)
    captured: list[tuple] = []

    async def fake_deliver(session_id, message, *, source=None):
        captured.append((session_id, message, source))

    monkeypatch.setattr(mgr, "deliver_to_session", fake_deliver)
    mgr.set_dm_session("sDM")

    asyncio.run(mgr._dispatch_inbound(_dm_event()))

    assert len(captured) == 1
    sid, message, source = captured[0]
    assert sid == "sDM"
    assert source["kind"] == "dm"
    assert source["connector"] == "slack"
    assert source["channel_id"] == "D1"
    assert source["sender_name"] == "Sue"
    assert source["text"] == "ping me"
