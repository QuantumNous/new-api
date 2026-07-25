"""Per-session event bus: a background turn (channel delivery, self-wake, durable resume) streams
its events to every socket viewing that session — delivery itself stays socket-independent.
"""

import asyncio

from coworker.providers import AssistantTurn, ModelCapabilities, ProviderClient
from coworker.server.manager import SessionManager


class ScriptedProvider(ProviderClient):
    def __init__(self, turns):
        self._turns = list(turns)

    def complete(self, *, model, messages, tools=None, **settings):
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


class RaisingProvider(ProviderClient):
    def complete(self, *, model, messages, tools=None, **settings):
        raise RuntimeError("model is dead (401)")

    def capabilities(self, model):
        return ModelCapabilities()


def _text(text):
    return AssistantTurn(text=text, finish_reason="stop")


def _collector():
    events: list[dict] = []

    async def cb(msg):
        events.append(msg)

    return events, cb


def _types(events):
    return [e["type"] for e in events]


def test_deliver_broadcasts_turn_events(tmp_path):
    mgr = SessionManager(
        workspace=tmp_path, provider=ScriptedProvider([_text("hello")])
    )
    mgr.get_engine("S", agent="chat")  # materialize a durable, workspace-free session
    events, cb = _collector()
    mgr.register_session_client("S", cb)

    asyncio.run(mgr.deliver_to_session("S", "hi"))

    types = _types(events)
    assert types[0] == "turn_start"
    assert (
        events[0]["data"]["input"] == "hi"
    )  # the inbound message surfaces as a user item
    assert "assistant_message" in types
    assert types[-1] == "turn_done"


def test_deliver_broadcasts_to_multiple_clients(tmp_path):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([_text("yo")]))
    mgr.get_engine("S", agent="chat")
    e1, cb1 = _collector()
    e2, cb2 = _collector()
    mgr.register_session_client("S", cb1)
    mgr.register_session_client("S", cb2)

    asyncio.run(mgr.deliver_to_session("S", "hi"))

    assert "turn_done" in _types(e1) and "turn_done" in _types(e2)


def test_unregister_stops_delivery(tmp_path):
    mgr = SessionManager(
        workspace=tmp_path, provider=ScriptedProvider([_text("a"), _text("b")])
    )
    mgr.get_engine("S", agent="chat")
    events, cb = _collector()
    mgr.register_session_client("S", cb)
    asyncio.run(mgr.deliver_to_session("S", "one"))
    assert events  # received the first turn
    events.clear()

    mgr.unregister_session_client("S", cb)
    asyncio.run(mgr.deliver_to_session("S", "two"))
    assert events == []  # nothing after unregister


def test_broadcast_is_scoped_per_session(tmp_path):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([_text("x")]))
    mgr.get_engine("S", agent="chat")
    other, cb = _collector()
    mgr.register_session_client("OTHER", cb)  # a different session's view

    asyncio.run(mgr.deliver_to_session("S", "hi"))
    assert other == []  # OTHER's socket sees nothing


def test_failed_background_turn_is_parked_not_swallowed(tmp_path):
    # A dead model would emit an ERROR event in a background turn (no user to read it) — it must be
    # recorded in the dead-letter store, not vanish.
    mgr = SessionManager(workspace=tmp_path, provider=RaisingProvider())
    mgr.get_engine("S", agent="chat")
    events, cb = _collector()
    mgr.register_session_client("S", cb)

    asyncio.run(mgr.deliver_to_session("S", "do the thing"))  # must not raise

    assert "error" in _types(events)
    parked = mgr.unrouted.list()
    assert len(parked) == 1
    assert parked[0]["source"] == "S"
    assert parked[0]["text"] == "do the thing"
    assert "dead" in parked[0]["reason"] or "401" in parked[0]["reason"]


def test_unrouted_endpoint(tmp_path):
    from fastapi.testclient import TestClient
    from coworker.server import create_app

    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    mgr.unrouted.record("slack:D1", "bob", "hey", reason="no DM session designated")
    client = TestClient(create_app(mgr))
    items = client.get("/v1/unrouted").json()["items"]
    assert len(items) == 1
    assert (
        items[0]["source"] == "slack:D1"
        and items[0]["reason"] == "no DM session designated"
    )
