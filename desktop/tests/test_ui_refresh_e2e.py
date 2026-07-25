"""UI-Refresh cross-cutting acceptance — the merge gate (UI-REFRESH-VERIFICATION
"Cross-cutting acceptance, end-to-end, via FakeSlack").

One scripted scenario that exercises Phases 1-4 together against the **real** SlackAdapter /
slack_bolt stack driven by FakeSlack (no network, no tokens, no Slack app console):

1. Connect Slack against FakeSlack through the manager's gateway; allow a user; subscribe an
   Ops "incident" session to a channel.
2. Post a channel message -> it reaches the session as a structured connector message: the
   persisted user message carries a `source` with **resolved** channel/sender names (Phase 2),
   the live turn_start carries that same source, and the provider gets framed text WITHOUT
   `source`.
3. The agent proposes a tool needing approval; the (Unattended) session routes approvals to the
   channel -> FakeSlack receives a Block Kit card; injecting the Approve button click resumes the
   turn and a reply posts back to the origin channel.
4. Mute Slack for the session -> a further channel post does NOT wake it (but is still buffered).
5. `GET /v1/sessions/{id}/connections` `attention` == the persona's unconnected recommends count.

State is fully isolated: `COWORKER_STATE_DIR` redirects the SecretStore and the manager's data
dir lives under `tmp_path`, so the machine-global secrets/config are never touched.
"""

from __future__ import annotations

import asyncio
import time

from fastapi.testclient import TestClient

from coworker.interactions import decode
from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    ToolCall,
)
from coworker.server import create_app
from coworker.server.manager import SessionManager
from coworker.sessions import SessionRecord

SID = "incident"
CHANNEL = "C_OPS"
CHANNEL_NAME = "ops-incidents"
USER = "U1"
SENDER_DISPLAY = "Alice Display"
ALERT = "\U0001f6a8 deploy to prod failed at 14:03"
REPLY = "Acknowledged - investigating the deploy now."


class E2EProvider(ProviderClient):
    """Returns queued turns and records the messages handed to it on each call, so the test can
    assert exactly what the provider saw (framed text, never a `source` sidecar)."""

    def __init__(self, turns):
        self._turns = list(turns)
        self.calls: list[list[dict]] = []

    def complete(self, *, model, messages, tools=None, **settings):
        self.calls.append([dict(m) for m in messages])
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


def _tool(name, args, call_id):
    return AssistantTurn(tool_calls=[ToolCall(id=call_id, name=name, arguments=args)])


def _text(text):
    return AssistantTurn(text=text, finish_reason="stop")


async def _wait_until(predicate, *, timeout: float = 8.0, interval: float = 0.02):
    """Poll `predicate` until it returns truthy (or the timeout elapses); return the last value."""
    deadline = time.monotonic() + timeout
    val = predicate()
    while not val and time.monotonic() < deadline:
        await asyncio.sleep(interval)
        val = predicate()
    return val


def _find_card(outbound):
    """The mirrored approval card = a chat.postMessage carrying Block Kit blocks."""
    for o in outbound:
        if o["method"] == "chat.postMessage" and o.get("blocks"):
            return o
    return None


def _approve_button(card):
    """The first action button (`ocw_0` = Approve) of a mirrored approval card."""
    for block in card.get("blocks") or []:
        if block.get("type") == "actions":
            for el in block.get("elements") or []:
                if el.get("action_id") == "ocw_0":
                    return el
    return None


def _find_reply(outbound, channel, text):
    """A plain (no-blocks) chat.postMessage = the agent's send_message reply."""
    return [
        o
        for o in outbound
        if o["method"] == "chat.postMessage"
        and not o.get("blocks")
        and o["channel"] == channel
        and o["text"] == text
    ]


async def test_ui_refresh_cross_cutting_e2e(fake_slack, tmp_path, monkeypatch):
    # Isolate the SecretStore (machine-global otherwise) so "is slack connected?" is decided only
    # by what this test writes; the manager's own data dir lives under tmp_path/.coworker.
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))

    ws = tmp_path / "ops_ws"
    ws.mkdir()

    provider = E2EProvider(
        [
            # turn 1: a write needing approval -> mirrored to the channel as a Block Kit card.
            _tool(
                "write_file",
                {"path": str(ws / "incident-note.txt"), "content": "ok"},
                "call_w",
            ),
            # turn 2: reply to the origin channel (pre-allowed so it doesn't ask a second time).
            _tool(
                "send_message", {"target": f"slack:{CHANNEL}", "text": REPLY}, "call_s"
            ),
            # turn 3: wrap up.
            _text("Posted the acknowledgement to the channel."),
        ]
    )

    mgr = SessionManager(workspace=tmp_path, provider=provider)
    try:
        # -- Step 1: connect Slack (real adapter -> FakeSlack via the manager's gateway) ----------
        mgr.secrets.put(
            "slack:default",
            {"bot_token": "xoxb-test", "app_token": "xapp-test", "enabled": True},
        )
        live = (
            await mgr.start_gateway()
        )  # builds the gateway + connects the SlackAdapter
        assert "slack" in live
        await fake_slack.wait_socket()

        # register the user + channel in FakeSlack so users.info / conversations.info resolve names
        fake_slack.add_user(USER, "alice", display_name=SENDER_DISPLAY)
        fake_slack.add_channel(CHANNEL, CHANNEL_NAME)
        # allow-list: the inbound gate drops unknown senders unless allowed
        assert mgr.allow_user("slack", USER)["ok"] is True

        # an Ops "incident" session subscribed to the channel, Unattended, approvals -> the channel
        mgr.session_store.save(
            SessionRecord(
                session_id=SID,
                workspace=str(ws),
                model="gpt-5.5",
                mode="interactive",
                agent="ops",
            )
        )
        mgr.subscriptions.subscribe(SID, f"slack:{CHANNEL}")
        mgr.inbox_routing.set_binding("ops-incidents", channel="slack", target=CHANNEL)
        mgr.inbox_routing.set_session_override(SID, "ops-incidents")
        mgr.unattended.set(SID, True)

        # pre-build the engine + pre-allow the reply tool so the reply (step 3) doesn't itself ask.
        engine = mgr.get_engine(SID)
        assert engine is not None
        engine.permissions.allow_tool_for_session("send_message")

        # observe the live turn stream for this session (the "card shows live" assertion).
        ws_events: list[dict] = []

        async def _client_cb(msg):
            ws_events.append(msg)

        mgr.register_session_client(SID, _client_cb)

        client = TestClient(
            create_app(mgr)
        )  # not entered as a CM -> no second gateway start

        # -- Step 2 + 3a: post a channel message; it becomes a structured connector message and the
        #    agent's approval is mirrored as a Block Kit card --------------------------------------
        await fake_slack.inbound(channel=CHANNEL, user=USER, text=ALERT)
        card = await _wait_until(lambda: _find_card(fake_slack.outbound()))
        assert (
            card is not None
        ), f"approval card never mirrored: {fake_slack.outbound()}"

        # (Step 2) persisted user message carries the structured, RESOLVED source sidecar.
        msgs = client.get(f"/v1/sessions/{SID}/messages").json()["messages"]
        user_msgs = [m for m in msgs if m.get("role") == "user"]
        assert user_msgs, msgs
        last = user_msgs[-1]
        src = last["source"]
        assert src["connector"] == "slack"
        assert src["kind"] == "channel"
        assert src["channel_id"] == CHANNEL
        assert (
            src["channel_name"] == CHANNEL_NAME
        )  # resolved via conversations.info (Phase 2)
        assert src["sender_id"] == USER
        assert src["sender_name"] == SENDER_DISPLAY  # resolved via users.info (Phase 2)
        assert src["text"] == ALERT  # the RAW message (what the card renders)
        # the model-facing content is the FRAMED text, not the raw message
        assert "subscribed" in last["content"] and last["content"] != ALERT

        # (Step 2) the provider saw the framed text and NO source / unknown keys, on every call.
        assert provider.calls, "provider was never invoked"
        first_users = [m for m in provider.calls[0] if m.get("role") == "user"]
        assert first_users
        sent = first_users[-1]
        assert "source" not in sent
        assert "subscribed" in sent["content"]
        assert all("source" not in m for call in provider.calls for m in call)

        # (Step 2) the live turn_start carried the same resolved source (card shows live).
        starts = [e for e in ws_events if e.get("type") == "turn_start"]
        assert starts, ws_events
        live_src = starts[0]["data"]["source"]
        assert live_src["channel_name"] == CHANNEL_NAME
        assert live_src["sender_name"] == SENDER_DISPLAY
        assert live_src["text"] == ALERT

        # (Step 3a) the card is a real Block Kit approval, posted to the origin channel.
        assert card["channel"] == CHANNEL
        assert "write_file" in (card["text"] or "")
        button = _approve_button(card)
        assert button is not None and button["value"]
        item_id, resolution = decode(button["value"])
        assert resolution == "allow"
        item = mgr.inbox.get(item_id)
        assert item is not None and item.kind == "approval" and item.state == "pending"

        # -- Step 3b: inject the Approve click -> turn resumes, reply posts to the origin channel --
        await fake_slack.interaction(
            channel=CHANNEL,
            user=USER,
            username="alice",
            message_ts=card["ts"],
            action_id=button["action_id"],
            value=button["value"],
        )
        replies = await _wait_until(
            lambda: _find_reply(fake_slack.outbound(), CHANNEL, REPLY)
        )
        assert replies, f"reply never posted back: {fake_slack.outbound()}"
        assert await _wait_until(lambda: not mgr.is_running(SID))
        assert mgr.inbox.get(item_id).state == "resolved"

        # -- Step 4: mute Slack for the session -> a further post does NOT wake it, still buffered -
        msgcount_before = len(mgr.session_messages(SID))
        calls_before = len(provider.calls)
        resp = client.post(
            f"/v1/sessions/{SID}/connections",
            json={"connector": "slack", "enabled": False},
        ).json()
        assert resp["ok"] is True
        assert "slack" not in mgr.effective_connectors(SID, "ops")

        muted_text = "second alert while muted"
        await fake_slack.inbound(channel=CHANNEL, user=USER, text=muted_text)
        # the message is buffered for catch-up even though it's not delivered.
        assert await _wait_until(
            lambda: any(
                m["text"] == muted_text
                for m in mgr.channel_buffer.recent(f"slack:{CHANNEL}")
            )
        ), "muted message was not buffered"
        # the skip-delivery decision is synchronous with the buffering above (no await between);
        # a short settle guards against any stray scheduled delivery, then assert nothing woke.
        await asyncio.sleep(0.1)
        assert len(mgr.session_messages(SID)) == msgcount_before  # no new turn/message
        assert len(provider.calls) == calls_before  # provider not re-invoked
        assert not mgr.is_running(SID)

        # -- Step 5: attention == the persona's account-unconnected connector recommends ----------
        detail = client.get("/v1/personas/ops").json()
        unconnected = [
            r
            for r in detail["recommends"]
            if r["kind"] == "connector" and not r["connected"]
        ]
        view = client.get(f"/v1/sessions/{SID}/connections").json()
        assert view["attention"] == len(unconnected)
        # only slack is account-connected here -> github/datadog/pagerduty remain
        assert view["attention"] == 3
        assert {r["connector"] for r in view["recommended"]} == {
            "github",
            "datadog",
            "pagerduty",
        }
    finally:
        await mgr.aclose()

    # State-dir isolation held: the SecretStore resolved to the tmp_path-scoped path, never the
    # machine-global ~/.config/coworker (so this run cannot mutate the real secrets hash).
    assert str(tmp_path) in str(mgr.secrets.path)
