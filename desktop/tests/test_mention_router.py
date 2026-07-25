"""The Slack mention router (UX-DECISIONS §31).

@ocw tagged in a channel is the PRIMARY entry point: with no subscribed session, a
per-thread coworker session spawns (visible in the sidebar, thread-scoped standing
send_message grant); follow-up tags in the same thread steer the same session. A
channel with a user-connected (subscribed) coworker overrides the router — it must
answer tags itself. Untagged channel traffic stays judgement-only (silence default).
"""

import asyncio
import sqlite3

from coworker.connectors.adapters import slack_event_to_event
from coworker.connectors.base import MessageEvent, SessionSource
from coworker.conversations import ConversationStore
from coworker.providers import AssistantTurn, ModelCapabilities, ProviderClient
from coworker.server.manager import SessionManager
from coworker.sessions import SessionRecord


class CapturingProvider(ProviderClient):
    def __init__(self, turns=()):
        self._turns = list(turns)
        self.calls: list[list[dict]] = []

    def complete(self, *, model, messages, tools=None, **settings):
        self.calls.append([dict(m) for m in messages])
        return (
            self._turns.pop(0)
            if self._turns
            else AssistantTurn(text="ok", finish_reason="stop")
        )

    def capabilities(self, model):
        return ModelCapabilities()


def _connect_slack(mgr):
    mgr.secrets.put(
        "slack:default",
        {"bot_token": "xoxb-test", "app_token": "xapp-test", "enabled": True},
    )


def _mention_event(
    text="<@UBOT> check the deploy?",
    *,
    chat_id="C1",
    ts="1700000010.000100",
    thread_ts=None,
    team_id=None
):
    return MessageEvent(
        text=text,
        source=SessionSource(
            platform="slack",
            chat_id=chat_id,
            user_id="U1",
            user_name="Bob",
            chat_name="general",
            chat_type="channel",
            thread_id=thread_ts,
            team_id=team_id,
        ),
        message_id=ts,
        mentions_me=True,
    )


def _plain_event(text="lunch anyone?", *, chat_id="C1", ts="1700000011.000200"):
    ev = _mention_event(text, chat_id=chat_id, ts=ts)
    ev.mentions_me = False
    return ev


def _mgr(tmp_path):
    mgr = SessionManager(workspace=tmp_path, provider=CapturingProvider())
    _connect_slack(mgr)
    return mgr


def _capture_deliveries(mgr, monkeypatch):
    captured: list[tuple] = []

    async def fake_deliver(session_id, message, *, source=None):
        captured.append((session_id, message, source))

    monkeypatch.setattr(mgr, "deliver_to_session", fake_deliver)
    return captured


# -- mentions_me computation (raw Slack text, pre-rewrite) --------------------------


def test_slack_mapper_computes_mentions_me():
    base = {"channel": "C1", "user": "U1", "ts": "1.2", "channel_type": "channel"}
    assert slack_event_to_event({**base, "text": "<@UBOT> hi"}, "UBOT").mentions_me
    assert slack_event_to_event(
        {**base, "text": "hey <@UBOT|ocw> hi"}, "UBOT"
    ).mentions_me
    assert not slack_event_to_event(
        {**base, "text": "<@UOTHER> hi"}, "UBOT"
    ).mentions_me
    # No bot id known (misconfigured) → never flags.
    assert not slack_event_to_event({**base, "text": "<@UBOT> hi"}, None).mentions_me


# -- the router ---------------------------------------------------------------------


def test_mention_spawns_visible_session_with_thread_grant(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path)
    captured = _capture_deliveries(mgr, monkeypatch)

    asyncio.run(mgr._dispatch_inbound(_mention_event()))

    # One visible session, origin-tagged. Title = the ASK first (mention token stripped —
    # it's noise), channel as the truncatable tail (owner call 2026-07-14).
    listed = [s for s in mgr.list_sessions() if s["origin"] == "slack"]
    assert len(listed) == 1
    row = listed[0]
    assert row["origin_label"] == "#general"
    assert row["title"] == "check the deploy? — #general"
    sid = row["session_id"]

    # A top-level tag threads on its OWN ts — mapping + grant use that target verbatim.
    target = "slack:C1:1700000010.000100"
    assert mgr.mention_sessions.get(target) == sid
    assert target in mgr._engines[sid].permissions.task_rules["send_message"]

    # The opening turn carries the reply contract and went to the new session.
    got_sid, opening, source = captured[-1]
    assert got_sid == sid
    assert target in opening and "pre-approved" in opening
    assert source["connector"] == "slack" and source["kind"] == "channel"


def test_followup_tag_steers_same_session(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path)
    captured = _capture_deliveries(mgr, monkeypatch)

    asyncio.run(mgr._dispatch_inbound(_mention_event()))
    sid = mgr.list_sessions()[0]["session_id"]
    # The follow-up arrives IN the thread (thread_ts = the first message's ts).
    asyncio.run(
        mgr._dispatch_inbound(
            _mention_event(
                "<@UBOT> and staging too",
                ts="1700000012.000300",
                thread_ts="1700000010.000100",
            )
        )
    )

    assert len(mgr.list_sessions()) == 1  # no second spawn
    got_sid, message, _ = captured[-1]
    assert got_sid == sid
    assert "Follow-up" in message and "and staging too" in message


def test_distinct_thread_spawns_distinct_session(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path)
    _capture_deliveries(mgr, monkeypatch)

    asyncio.run(mgr._dispatch_inbound(_mention_event()))
    asyncio.run(
        mgr._dispatch_inbound(
            _mention_event("<@UBOT> other thing", ts="1700000099.000900")
        )
    )

    sids = {t.session_id for t in mgr.mention_sessions.all()}
    assert len(sids) == 2
    assert len(mgr.list_sessions()) == 2


def test_subscribed_coworker_overrides_router(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path)
    captured = _capture_deliveries(mgr, monkeypatch)
    mgr.subscriptions.subscribe("sA", "slack:C1")

    asyncio.run(mgr._dispatch_inbound(_mention_event()))

    # Delivered to the connected coworker with must-respond framing + the thread target…
    assert len(captured) == 1
    sid, message, _ = captured[0]
    assert sid == "sA"
    assert "must" in message and "respond" in message
    assert "slack:C1:1700000010.000100" in message
    # …and the router spawned nothing.
    assert mgr.mention_sessions.all() == []
    assert mgr.list_sessions() == []


def test_grant_reseeds_on_engine_rebuild(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path)
    _capture_deliveries(mgr, monkeypatch)
    asyncio.run(mgr._dispatch_inbound(_mention_event()))
    sid = mgr.list_sessions()[0]["session_id"]
    target = "slack:C1:1700000010.000100"

    mgr._engines.pop(sid)  # simulate restart/rebuild
    engine = mgr.get_engine(sid)
    assert target in engine.permissions.task_rules["send_message"]


def test_deleted_session_releases_thread_and_respawns(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path)
    _capture_deliveries(mgr, monkeypatch)
    asyncio.run(mgr._dispatch_inbound(_mention_event()))
    sid = mgr.list_sessions()[0]["session_id"]

    mgr.delete_session(sid)
    assert mgr.mention_sessions.all() == []

    asyncio.run(mgr._dispatch_inbound(_mention_event(thread_ts="1700000010.000100")))
    fresh = mgr.list_sessions()
    assert len(fresh) == 1 and fresh[0]["session_id"] != sid


def test_relay_team_qualified_target(tmp_path, monkeypatch):
    """Managed relay chat_ids are 'T…/C…' — the '/' rides inside the ':'-delimited target."""
    mgr = _mgr(tmp_path)
    _capture_deliveries(mgr, monkeypatch)
    asyncio.run(
        mgr._dispatch_inbound(
            _mention_event(chat_id="T0AB/C9", ts="1700000050.000500", team_id="T0AB")
        )
    )
    target = "slack:T0AB/C9:1700000050.000500"
    listed = mgr.list_sessions()[0]
    assert mgr.mention_sessions.get(target) == listed["session_id"]
    assert listed["origin_label"] == "#general · T0AB"


def test_untagged_channel_traffic_stays_judgement_only(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path)
    captured = _capture_deliveries(mgr, monkeypatch)
    mgr.subscriptions.subscribe("sA", "slack:C1")

    asyncio.run(mgr._dispatch_inbound(_plain_event()))

    _, message, _ = captured[0]
    assert "subscribed" in message and "stay silent" in message
    # …and with NO subscriber, an untagged message never spawns anything (buffered only).
    captured.clear()
    mgr.subscriptions.unsubscribe("sA", "slack:C1")
    asyncio.run(mgr._dispatch_inbound(_plain_event(ts="1700000013.000400")))
    assert captured == [] and mgr.list_sessions() == []


# -- origin persistence ---------------------------------------------------------------


def test_set_origin_round_trips_and_survives_saves(tmp_path):
    store = ConversationStore(tmp_path)
    rec = SessionRecord(
        session_id="s1", workspace=str(tmp_path), model="m", mode="interactive"
    )
    store.save(rec)
    assert store.set_origin("s1", "slack", "#general · T1")
    loaded = store.load("s1")
    assert loaded.origin == "slack" and loaded.origin_label == "#general · T1"
    store.save(rec)  # a later turn save must not clobber the origin columns
    assert store.load("s1").origin == "slack"
    listed = {r.session_id: r for r in store.list()}
    assert listed["s1"].origin_label == "#general · T1"


def test_origin_columns_migrate_on_old_db(tmp_path):
    """A pre-§31 database (no origin columns) upgrades in place on open."""
    db = tmp_path / "coworker.db"
    conn = sqlite3.connect(db)
    conn.execute(
        "CREATE TABLE sessions (session_id TEXT PRIMARY KEY, workspace TEXT, model TEXT, "
        "mode TEXT, title TEXT, agent TEXT DEFAULT 'code', n_msgs INTEGER DEFAULT 0, "
        "messages TEXT, extra_roots TEXT, pinned INTEGER DEFAULT 0, archived INTEGER DEFAULT 0, "
        "updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    conn.execute(
        "INSERT INTO sessions (session_id, workspace, model, mode) VALUES ('old', 'w', 'm', 'i')"
    )
    conn.commit()
    conn.close()

    store = ConversationStore(tmp_path)
    old = store.load("old")
    assert old is not None and old.origin is None
    assert store.set_origin("old", "slack", "#x")
    assert store.load("old").origin == "slack"
