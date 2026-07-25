"""FakeSlack acceptance tests — the real SlackAdapter / slack_bolt stack driven against the
in-process fake (no network). Mirrors the acceptance list in `platform/docs/FAKE-SLACK-SPEC.md`.

These are hermetic (no real Slack) and run in CI — not marked `integration`. The `fake_slack`
fixture (see conftest.py) starts the server and sets `SLACK_API_URL`.
"""

from __future__ import annotations

import asyncio
import re

import httpx

from coworker.connectors.adapters import SlackAdapter
from coworker.connectors.base import InteractionEvent, MessageEvent
from coworker.connectors.config import ConnectorSettings
from coworker.connectors.gateway import Gateway
from coworker.interactions import Button


def _allow_all() -> dict[str, ConnectorSettings]:
    return {"slack": ConnectorSettings(platform="slack", enabled=True, allow_all=True)}


async def _send_offloop(coro):
    """Run an adapter send. The stateless senders are blocking httpx (they run in a worker
    thread in production); calling them on the loop that hosts the in-process fake would starve
    it, so push the whole call to a thread with its own loop — exactly the engine's contract.
    """
    return await asyncio.to_thread(asyncio.run, coro)


# 1. connect() → bot id resolved via auth.test, Socket Mode hello received.
async def test_connect_resolves_bot_and_receives_hello(fake_slack):
    adapter = SlackAdapter("xoxb-test", "xapp-test")
    ok = await adapter.connect()
    # Register the hello capture immediately (no await before this) so it is in place before the
    # background socket task processes the greeting.
    hello: list = []
    got_hello = asyncio.Event()

    async def _cap(client, message, raw):
        if message.get("type") == "hello":
            hello.append(message)
            got_hello.set()

    adapter._socket.client.message_listeners.append(_cap)
    try:
        assert ok is True
        assert (
            adapter._bot_user_id == "U_BOT"
        )  # resolved via auth.test against the fake
        await fake_slack.wait_socket()
        await asyncio.wait_for(got_hello.wait(), timeout=5)
        assert hello[0]["type"] == "hello"
    finally:
        await adapter.disconnect()


# 2. Inbound message → gateway handler fires with a MessageEvent whose user_name is resolved
#    from the registered user table (exercises users.info caching). Plus a direct assertion that
#    conversations.info serves the registered channel (Phase 1 builds _channel_name on this).
async def test_inbound_resolves_user_name_and_serves_channel(fake_slack):
    fake_slack.add_user(
        "U1", "alice", real_name="Alice Real", display_name="Alice Display"
    )
    fake_slack.add_channel("C1", "general", is_im=False)

    got: list[MessageEvent] = []
    delivered = asyncio.Event()

    async def _handler(ev: MessageEvent):
        got.append(ev)
        delivered.set()

    gw = Gateway(settings=_allow_all(), handler=_handler)
    adapter = SlackAdapter("xoxb-test", "xapp-test")
    gw.register(adapter)
    await adapter.connect()
    try:
        await fake_slack.wait_socket()
        await fake_slack.inbound(channel="C1", user="U1", text="hello team")
        await asyncio.wait_for(delivered.wait(), timeout=5)

        ev = got[0]
        assert ev.text == "hello team"
        assert ev.source.chat_id == "C1"
        assert ev.source.chat_type == "channel"
        assert ev.source.user_name == "Alice Display"  # resolved via users.info

        # A second message from the same user must be served from the adapter's name cache:
        # exactly one users.info round-trip total.
        delivered.clear()
        got.clear()
        await fake_slack.inbound(channel="C1", user="U1", text="again")
        await asyncio.wait_for(delivered.wait(), timeout=5)
        assert got[0].source.user_name == "Alice Display"
        assert fake_slack.api_calls.count("users.info") == 1

        # Phase 1 (not this deliverable) adds _channel_name resolution; assert the fake already
        # serves conversations.info so it can build on it.
        info = await adapter._app.client.conversations_info(channel="C1")
        assert info["channel"]["name"] == "general"
        assert info["channel"]["is_im"] is False
    finally:
        await adapter.disconnect()


# 3. send / send_interactive through the adapter → recorded under the fake's outbound log.
async def test_send_and_send_interactive_recorded(fake_slack):
    fake_slack.add_channel("C1", "general")
    adapter = SlackAdapter("xoxb-test", "xapp-test")

    r1 = await _send_offloop(
        adapter.send("C1", "outbound text", thread_id="1700000000.000100")
    )
    assert r1.ok is True and r1.message_id

    r2 = await _send_offloop(
        adapter.send_interactive(
            "C1", "approve?", [Button("Approve", "v1"), Button("Deny", "v2")]
        )
    )
    assert r2.ok is True and r2.message_id

    ob = fake_slack.outbound()
    assert [o["method"] for o in ob] == ["chat.postMessage", "chat.postMessage"]

    plain = ob[0]
    assert plain["channel"] == "C1"
    assert plain["text"] == "outbound text"
    assert plain["thread_ts"] == "1700000000.000100"
    assert not plain["blocks"]

    interactive = ob[1]
    assert interactive["channel"] == "C1"
    assert interactive["text"] == "approve?"
    blocks = interactive["blocks"]
    assert blocks[0]["type"] == "section"
    elements = blocks[1]["elements"]
    assert [e["value"] for e in elements] == ["v1", "v2"]
    assert [e["action_id"] for e in elements] == ["ocw_0", "ocw_1"]


# 4. An `ocw_*` button click → adapter action handler → gateway interaction handler
#    (Gateway._on_interaction).
async def test_interaction_reaches_gateway_handler(fake_slack):
    fake_slack.add_channel("C1", "general")

    seen: list[InteractionEvent] = []
    fired = asyncio.Event()

    async def _on_interaction(ev: InteractionEvent):
        seen.append(ev)
        fired.set()

    gw = Gateway(settings=_allow_all(), interaction_handler=_on_interaction)
    adapter = SlackAdapter("xoxb-test", "xapp-test")
    gw.register(adapter)
    await adapter.connect()
    try:
        await fake_slack.wait_socket()
        await fake_slack.interaction(
            channel="C1",
            user="U1",
            username="alice",
            message_ts="1700000001.000001",
            action_id="ocw_0",
            value="item-id|allow",
        )
        await asyncio.wait_for(fired.wait(), timeout=5)

        ie = seen[0]
        assert ie.platform == "slack"
        assert ie.value == "item-id|allow"
        assert ie.user_name == "alice"
        assert ie.chat_id == "C1"
        assert ie.message_id == "1700000001.000001"
    finally:
        await adapter.disconnect()


# 5. POST /control/reset returns a clean slate (exercises the HTTP control surface).
async def test_control_reset_clears_state(fake_slack):
    base = fake_slack.control_url
    async with httpx.AsyncClient() as client:
        assert (await client.get(f"{base}/health")).json()["ok"] is True

        await client.post(f"{base}/users", json={"id": "U1", "name": "alice"})
        await client.post(f"{base}/channels", json={"id": "C1", "name": "general"})
        assert fake_slack.users and fake_slack.channels

        adapter = SlackAdapter("xoxb-test", "xapp-test")
        assert (await _send_offloop(adapter.send("C1", "hi"))).ok is True
        assert len((await client.get(f"{base}/outbound")).json()["outbound"]) == 1

        assert (await client.post(f"{base}/reset")).json()["ok"] is True

        assert (await client.get(f"{base}/outbound")).json()["outbound"] == []
        assert fake_slack.users == {}
        assert fake_slack.channels == {}
        # conversations.info no longer resolves the (now-cleared) channel
        info = await client.get(
            f"{base.replace('/control', '/api')}/conversations.info?channel=C1"
        )
        assert info.json() == {"ok": False, "error": "channel_not_found"}


# 6. Guard: the REAL slack_bolt AsyncSocketModeHandler dispatches a fake-sent events_api
#    envelope AND an interactive envelope (protects against envelope-shape drift).
async def test_real_bolt_dispatches_both_envelope_shapes(fake_slack):
    from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
    from slack_bolt.async_app import AsyncApp
    from slack_sdk.web.async_client import AsyncWebClient

    fake_slack.add_channel("C1", "general")

    client = AsyncWebClient(token="xoxb-test", base_url=fake_slack.api_url)
    app = AsyncApp(client=client)

    seen: dict = {}
    event_fired = asyncio.Event()
    action_fired = asyncio.Event()

    @app.event("message")
    async def _on_event(event, say):  # noqa: ANN001
        seen["event"] = event
        event_fired.set()

    @app.action(re.compile(r"^ocw_"))
    async def _on_action(ack, body):  # noqa: ANN001
        await ack()
        seen["action"] = body
        action_fired.set()

    handler = AsyncSocketModeHandler(app, "xapp-test")
    task = asyncio.create_task(handler.start_async())
    try:
        await fake_slack.wait_socket()

        # events_api envelope
        await fake_slack.inbound(channel="C1", user="U1", text="guard event")
        await asyncio.wait_for(event_fired.wait(), timeout=5)
        assert seen["event"]["type"] == "message"
        assert seen["event"]["text"] == "guard event"
        assert seen["event"]["channel"] == "C1"

        # interactive (block_actions) envelope
        await fake_slack.interaction(
            channel="C1",
            user="U1",
            username="alice",
            message_ts="1700000001.000001",
            action_id="ocw_0",
            value="guard-value",
        )
        await asyncio.wait_for(action_fired.wait(), timeout=5)
        assert seen["action"]["type"] == "block_actions"
        assert seen["action"]["actions"][0]["action_id"] == "ocw_0"
        assert seen["action"]["actions"][0]["value"] == "guard-value"
    finally:
        await handler.close_async()
        task.cancel()


# 7. Mention tokens in the text are rewritten to @display-name at ingestion (`<@U…>` is how
#    Slack encodes "@ocw hi"), so parked cards / transcripts never show raw ids. Unresolvable
#    ids keep their token (best-effort).
async def test_inbound_rewrites_mention_tokens(fake_slack):
    fake_slack.add_user("U1", "alice", display_name="Alice Display")
    fake_slack.add_user("UOCW99", "ocw", display_name="ocw")
    fake_slack.add_channel("C1", "general", is_im=False)

    got: list[MessageEvent] = []
    delivered = asyncio.Event()

    async def _handler(ev: MessageEvent):
        got.append(ev)
        delivered.set()

    gw = Gateway(settings=_allow_all(), handler=_handler)
    adapter = SlackAdapter("xoxb-test", "xapp-test")
    gw.register(adapter)
    await adapter.connect()
    try:
        await fake_slack.wait_socket()
        await fake_slack.inbound(
            channel="C1", user="U1", text="<@UOCW99> hi — ask <@UGHOST99> too"
        )
        await asyncio.wait_for(delivered.wait(), timeout=5)
        # The known mention resolves; the unknown id keeps its token.
        assert got[0].text == "@ocw hi — ask <@UGHOST99> too"
    finally:
        await adapter.disconnect()


# 7. Socket Mode watchdog: a SILENTLY-DEAD connection is revived and message flow resumes.
#    Regression for the multi-hour stall — start_async() sleeps forever, so a socket that dies
#    while the client stops recovering it (is_connected() reports down and stays down) looked alive
#    and nothing brought it back. The watchdog polls is_connected() and forces a fresh endpoint.
#    (slack_sdk recovers a clean server-close on its own, so we simulate the harder case it gives
#    up on: is_connected() stuck False.)
async def test_watchdog_revives_silently_dead_socket(fake_slack):
    fake_slack.add_user("U1", "alice", display_name="Alice")
    fake_slack.add_channel("C1", "general", is_im=False)

    got: list[MessageEvent] = []
    delivered = asyncio.Event()

    async def _handler(ev: MessageEvent):
        got.append(ev)
        delivered.set()

    gw = Gateway(settings=_allow_all(), handler=_handler)
    adapter = SlackAdapter("xoxb-test", "xapp-test", watchdog_interval=0.2)
    gw.register(adapter)
    await adapter.connect()
    try:
        await fake_slack.wait_socket()
        await fake_slack.inbound(channel="C1", user="U1", text="before")
        await asyncio.wait_for(delivered.wait(), timeout=5)
        assert got[-1].text == "before"
        assert fake_slack.socket_connections == 1

        # Simulate the silent stall: the connection reports down and the client isn't reviving it.
        client = adapter._socket.client
        original = client.is_connected
        client.is_connected = lambda: False

        # The watchdog must notice and re-open a fresh endpoint.
        for _ in range(100):
            if adapter._reconnects >= 1:
                break
            await asyncio.sleep(0.05)
        client.is_connected = original  # end the simulated outage
        assert adapter._reconnects >= 1, "watchdog did not reconnect a down socket"
        assert fake_slack.socket_connections >= 2

        # Message flow resumes on the revived connection.
        delivered.clear()
        got.clear()
        await fake_slack.inbound(channel="C1", user="U1", text="after")
        await asyncio.wait_for(delivered.wait(), timeout=5)
        assert got[-1].text == "after"
    finally:
        await adapter.disconnect()
