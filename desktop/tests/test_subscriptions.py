"""Channel subscriptions: the store, the agent tools, and the gateway fan-out dispatch."""

import asyncio

import pytest

from coworker.connectors.base import MessageEvent, SessionSource
from coworker.subscriptions import (
    ChannelBuffer,
    SubscriptionStore,
    resolve_channel,
    subscription_tools,
)
from coworker.providers import ModelCapabilities, ProviderClient
from coworker.server.manager import SessionManager


class ScriptedProvider(ProviderClient):
    def __init__(self, turns):
        self._turns = list(turns)

    def complete(self, *, model, messages, tools=None, **settings):
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


def test_resolve_channel():
    assert resolve_channel("<#C0123|alerts>") == "slack:C0123"  # Slack #mention token
    assert resolve_channel("slack:C0999") == "slack:C0999"  # already an address
    assert resolve_channel("C0777") == "slack:C0777"  # bare id → default platform
    assert resolve_channel("") == ""
    # Slack "Copy link" URL → the id in the path (case-normalized), query/anchor tolerated.
    assert (
        resolve_channel("https://acme.slack.com/archives/C0123ABC") == "slack:C0123ABC"
    )
    assert (
        resolve_channel("https://acme.slack.com/archives/c0123abc?foo=1")
        == "slack:C0123ABC"
    )
    # A bare #name can't be looked up locally — resolving it literally would create a
    # subscription that never matches inbound `slack:C…` traffic, so it must fail.
    assert resolve_channel("#general") == ""


def test_subscribe_rejects_bare_channel_names(tmp_path):
    from fastapi.testclient import TestClient
    from coworker.server import create_app

    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    client = TestClient(create_app(mgr))
    r = client.post(
        "/v1/subscriptions", json={"session_id": "sN", "channel": "#general"}
    ).json()
    assert r["ok"] is False and "channel ID" in r["error"]
    assert mgr.subscriptions.for_session("sN") == []


def test_channel_buffer_persists_across_restarts(tmp_path):
    path = tmp_path / "channels.json"
    buf = ChannelBuffer(state_path=path)
    buf.record("slack:C9", "bob", "deploy failed", name="ops-alerts")
    buf.record("slack:C7", "amy", "standup at 10")

    # A fresh instance over the same file sees the channels, names, AND catch-up messages.
    reloaded = ChannelBuffer(state_path=path)
    by_chan = {c["channel"]: c for c in reloaded.channels()}
    assert set(by_chan) == {"slack:C9", "slack:C7"}
    assert by_chan["slack:C9"]["name"] == "ops-alerts"  # display name survives
    assert by_chan["slack:C7"]["name"] is None
    assert reloaded.recent("slack:C9") == [{"from": "bob", "text": "deploy failed"}]

    # The first shipped format was the bare messages dict — still loads.
    import json as _json

    path.write_text(_json.dumps({"slack:C1": [{"from": "z", "text": "old format"}]}))
    legacy = ChannelBuffer(state_path=path)
    assert legacy.recent("slack:C1") == [{"from": "z", "text": "old format"}]

    # A corrupt file must never block startup — it just starts empty.
    path.write_text("{not json")
    assert ChannelBuffer(state_path=path).channels() == []


def test_store_crud_and_persistence(tmp_path):
    p = tmp_path / "subs.json"
    st = SubscriptionStore(p)
    st.subscribe("s1", "slack:C1")
    st.subscribe("s2", "slack:C1")
    st.subscribe("s1", "slack:C2")
    assert {s.session_id for s in st.for_channel("slack:C1")} == {"s1", "s2"}
    assert {s.channel for s in st.for_session("s1")} == {"slack:C1", "slack:C2"}
    # idempotent subscribe (no duplicate)
    st.subscribe("s1", "slack:C1")
    assert len(st.for_channel("slack:C1")) == 2
    # persistence round-trip
    assert {(s.session_id, s.channel) for s in SubscriptionStore(p).all()} == {
        ("s1", "slack:C1"),
        ("s2", "slack:C1"),
        ("s1", "slack:C2"),
    }
    # explicit unsubscribe + session removal (the only implicit teardown)
    assert st.unsubscribe("s2", "slack:C1") is True
    assert st.unsubscribe("s2", "slack:C1") is False
    st.remove_session("s1")
    assert st.all() == []


def test_buffer_and_tools(tmp_path):
    st = SubscriptionStore(tmp_path / "subs.json")
    buf = ChannelBuffer()
    sub, unsub, lst, getmsgs = subscription_tools(
        st, "sess", buf, routing_targets=["slack:CINBOX"]
    )

    assert sub("<#C0123|alerts>")["subscribed"] == "slack:C0123"
    assert lst()["channels"] == ["slack:C0123"]
    # subscribing the channel the Inbox routes to warns (inbound vs outbound hygiene)
    assert "warning" in sub("slack:CINBOX")

    buf.record("slack:C0123", "bob", "deploy failed")
    buf.record("slack:C0123", "sue", "rolling back")
    msgs = getmsgs("slack:C0123", 5)["messages"]
    assert [m["text"] for m in msgs] == ["deploy failed", "rolling back"]

    assert unsub("slack:C0123")["was_subscribed"] is True
    assert "slack:C0123" not in lst()["channels"]


def _event(text, *, chat_type, chat_id="C1", user="bob"):
    return MessageEvent(
        text=text,
        source=SessionSource(
            platform="slack", chat_id=chat_id, user_name=user, chat_type=chat_type
        ),
    )


def _connect_slack(mgr):
    """Inbound delivery is gated on the connector being CONNECTED (§4.3). Tests used to pass
    by riding the developer's real Slack profile; with the isolated state dir (conftest) each
    test must connect its own."""
    mgr.secrets.put(
        "slack:default",
        {"bot_token": "xoxb-test", "app_token": "xapp-test", "enabled": True},
    )


def test_dispatch_fans_out_to_subscribers(tmp_path, monkeypatch):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    _connect_slack(mgr)
    delivered: list[tuple[str, str]] = []

    async def fake_deliver(session_id, message, *, source=None):
        delivered.append((session_id, message))

    monkeypatch.setattr(mgr, "deliver_to_session", fake_deliver)

    mgr.subscriptions.subscribe("sA", "slack:C1")
    mgr.subscriptions.subscribe("sB", "slack:C1")

    # a CHANNEL message → fan out to both subscribers, buffered
    asyncio.run(mgr._dispatch_inbound(_event("deploy failed", chat_type="channel")))
    assert {sid for sid, _ in delivered} == {"sA", "sB"}
    assert mgr.channel_buffer.recent("slack:C1")[-1]["text"] == "deploy failed"

    # a CHANNEL with no subscribers → buffered, nobody delivered
    delivered.clear()
    asyncio.run(
        mgr._dispatch_inbound(_event("noise", chat_type="channel", chat_id="C2"))
    )
    assert delivered == []
    assert mgr.channel_buffer.recent("slack:C2")[-1]["text"] == "noise"

    # a DM with no designated session → parked as unrouted, nobody delivered
    asyncio.run(mgr._dispatch_inbound(_event("hi there", chat_type="dm", chat_id="D1")))
    assert delivered == []
    assert mgr.unrouted.list()[0]["reason"] == "no DM session designated"

    # a DM with a designated session → delivered to it
    mgr.set_dm_session("sDM")
    asyncio.run(mgr._dispatch_inbound(_event("hello", chat_type="dm", chat_id="D1")))
    assert delivered[-1][0] == "sDM"


def test_subscriptions_endpoint_and_collision(tmp_path):
    from fastapi.testclient import TestClient
    from coworker.server import create_app

    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    mgr.subscriptions.subscribe("s1", "slack:C1")
    mgr.channel_buffer.record("slack:C1", "bob", "hello", name="ops-alerts")
    client = TestClient(create_app(mgr))
    subs = client.get("/v1/subscriptions").json()["subscriptions"]
    assert len(subs) == 1
    row = subs[0]
    assert row["session_id"] == "s1" and row["channel"] == "slack:C1"
    assert row["channel_name"] == "ops-alerts"  # display name from the buffer
    assert row["collision"] is False  # no Inbox routing bound → no collision
    # the per-session list field is present too
    sessions = client.get("/v1/sessions").json()["sessions"]
    assert all("subscriptions" in s for s in sessions)


def test_subscribe_unsubscribe_and_recent_endpoints(tmp_path):
    from fastapi.testclient import TestClient
    from coworker.server import create_app

    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    mgr.channel_buffer.record("slack:C9", "bob", "deploy failed")  # seeds the picker
    client = TestClient(create_app(mgr))

    assert [
        c["channel"] for c in client.get("/v1/channels/recent").json()["channels"]
    ] == ["slack:C9"]

    # subscribe via a Slack #mention token → resolved to the id
    r = client.post(
        "/v1/subscriptions", json={"session_id": "sZ", "channel": "<#C9|alerts>"}
    ).json()
    assert r["ok"] and r["channel"] == "slack:C9"
    assert [s.channel for s in mgr.subscriptions.for_session("sZ")] == ["slack:C9"]

    # unsubscribe
    r = client.post(
        "/v1/subscriptions/remove", json={"session_id": "sZ", "channel": "slack:C9"}
    ).json()
    assert r["ok"] and r["removed"] is True
    assert mgr.subscriptions.for_session("sZ") == []


def test_unauthorized_messages_park_and_resolve(tmp_path, monkeypatch):
    """§19: an allow-list drop PARKS the message; resolving it can dismiss, allow the sender,
    or allow AND deliver the original message through the normal inbound path (no re-send).
    """
    from coworker.connectors import Gateway

    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    _connect_slack(mgr)
    delivered: list[tuple[str, str]] = []

    async def fake_deliver(session_id, message, *, source=None):
        delivered.append((session_id, message))

    monkeypatch.setattr(mgr, "deliver_to_session", fake_deliver)
    mgr.subscriptions.subscribe("sA", "slack:C1")

    # A gateway with an empty allow-list drops the message — into the parked store.
    from coworker.connectors.config import ConnectorSettings

    gw = Gateway(
        secrets=mgr.secrets,
        settings={"slack": ConnectorSettings(platform="slack", enabled=True)},
        handler=mgr._dispatch_inbound,
        on_unauthorized=mgr._park_unauthorized,
    )
    ev = MessageEvent(
        text="deploy failed",
        source=SessionSource(
            platform="slack",
            chat_id="C1",
            user_id="U9",
            user_name="bob",
            chat_type="channel",
        ),
    )
    asyncio.run(gw._on_inbound(ev))
    assert delivered == []  # dropped, not delivered
    items = mgr.parked.list("slack")
    assert len(items) == 1 and items[0]["text"] == "deploy failed"
    assert items[0]["user_id"] == "U9" and items[0]["chat_id"] == "C1"

    # dismiss: gone, nothing else happens
    asyncio.run(gw._on_inbound(ev))  # park a second copy to dismiss
    two = mgr.parked.list("slack")
    r = asyncio.run(mgr.resolve_unauthorized("slack", two[0]["id"], "dismiss"))
    assert r["ok"] and len(mgr.parked.list("slack")) == 1

    # allow_deliver: sender allow-listed AND the parked message reaches the subscriber + buffer
    r = asyncio.run(
        mgr.resolve_unauthorized(
            "slack", mgr.parked.list("slack")[0]["id"], "allow_deliver"
        )
    )
    assert r["ok"]
    profile = mgr.secrets.get("slack:default")
    assert "U9" in profile["allowed_users"]
    assert [sid for sid, _ in delivered] == ["sA"]
    assert mgr.channel_buffer.recent("slack:C1")[-1]["text"] == "deploy failed"
    assert mgr.parked.list("slack") == []
    # The people directory captured the sender, so the allow-list chip can show a NAME.
    slack = next(c for c in mgr.list_connectors() if c["name"] == "slack")
    assert slack["allowed_user_names"] == {"U9": "bob"}

    # unknown item / wrong platform → error
    assert (
        asyncio.run(mgr.resolve_unauthorized("slack", "nope", "dismiss"))["ok"] is False
    )


def test_parked_store_persists_and_caps(tmp_path):
    from coworker.connectors.parked import ParkedStore

    path = tmp_path / "parked.json"
    store = ParkedStore(path, cap=2)
    store.park(platform="slack", chat_id="C1", user_id="U1", text="one")
    store.park(platform="slack", chat_id="C1", user_id="U1", text="two")
    store.park(
        platform="slack", chat_id="C1", user_id="U1", text="three"
    )  # evicts "one"
    assert [i["text"] for i in store.list("slack")] == ["three", "two"]  # newest first

    reloaded = ParkedStore(path, cap=2)
    assert [i["text"] for i in reloaded.list()] == ["three", "two"]
    popped = reloaded.pop(reloaded.list()[0]["id"])
    assert popped is not None and popped.text == "three"
    assert ParkedStore(path, cap=2).list() == [{**i} for i in reloaded.list()]


def test_refresh_gateway_replaces_listeners(tmp_path):
    """Pasting new tokens must take effect without a sidecar restart: refresh_gateway swaps
    the Gateway (and its adapters) in-process."""
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    asyncio.run(mgr.start_gateway())
    first = mgr.gateway
    assert first is not None
    asyncio.run(mgr.refresh_gateway())
    assert mgr.gateway is not None and mgr.gateway is not first
    asyncio.run(mgr.aclose())
