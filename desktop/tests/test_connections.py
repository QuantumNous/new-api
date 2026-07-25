"""Phase 3 — connection hierarchy (UI-REFRESH §4).

Three layers gate a connector for a session: account-connected → persona-default-enabled →
session-override. `effective(connector)` = connected AND (override if present, else persona default,
else inherit-on). These tests pin the stores, the resolver, and the two runtime gating points
(inbound delivery + the engine's connector tools).
"""

import asyncio
from pathlib import Path

import pytest

from coworker.connections import (
    PersonaConnectionStore,
    SessionConnectionStore,
    effective,
)
from coworker.connectors.base import MessageEvent, SessionSource
from coworker.personas import registry as persona_registry
from coworker.personas.manifest import load_manifest_file
from coworker.providers import ModelCapabilities, ProviderClient
from coworker.server.manager import SessionManager
from coworker.sessions import SessionRecord


@pytest.fixture(autouse=True)
def _isolate_state_dir(tmp_path, monkeypatch):
    """Isolate the global state/secret dir for every test here.

    The `SessionManager` tests build a real `SecretStore()`, which defaults to the developer's
    global state dir (`~/.config/coworker`) unless `COWORKER_STATE_DIR` is set — so without this a
    test's `secrets.put("github:default", …)` would write a fake token into the real secret store.
    Pin it at a throwaway dir. (Harmless for the pure store/resolver tests that use explicit paths.)
    """
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))


class ScriptedProvider(ProviderClient):
    def __init__(self, turns=None):
        self._turns = list(turns or [])

    def complete(self, *, model, messages, tools=None, **settings):
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


def _ops_manifest():
    md = Path(persona_registry.__file__).parent / "builtin" / "ops.md"
    return load_manifest_file(md, builtin=True)


def _channel_event(text="deploy failed", chat_id="C1", platform="slack"):
    return MessageEvent(
        text=text,
        source=SessionSource(
            platform=platform, chat_id=chat_id, user_name="bob", chat_type="channel"
        ),
    )


def _dm_event(text="ping", chat_id="D1", platform="slack"):
    return MessageEvent(
        text=text,
        source=SessionSource(
            platform=platform, chat_id=chat_id, user_name="sue", chat_type="dm"
        ),
    )


# -- stores + resolver ---------------------------------------------------------
def test_persona_defaults_seeded_from_manifest(tmp_path):
    p = tmp_path / "persona_connections.json"
    store = PersonaConnectionStore(p)
    manifest = (
        _ops_manifest()
    )  # recommends: github/slack/datadog core, pagerduty optional, +mcp

    # Every CORE connector seeds ON regardless of whether it's connected yet; the optional one
    # (pagerduty) seeds OFF; the mcp recommend is not a connector and is ignored. datadog is core but
    # NOT in the connected set here — it still seeds True (effective() gates connectedness, not the
    # seed), so it self-lights when datadog is later connected instead of being frozen False.
    seeded = store.defaults_for("ops", manifest, connected={"github", "slack"})
    assert seeded == {
        "github": True,
        "slack": True,
        "datadog": True,
        "pagerduty": False,
    }

    # While datadog is disconnected, effective() excludes it (connected-gate) but keeps github/slack.
    assert effective(
        connected={"github", "slack"}, persona_defaults=seeded, session_overrides={}
    ) == {"github": True, "slack": True}
    # Once datadog connects, its True seed now lights up — no re-seed, no manual toggle needed.
    assert effective(
        connected={"github", "slack", "datadog"},
        persona_defaults=seeded,
        session_overrides={},
    ) == {"github": True, "slack": True, "datadog": True}

    # persisted on first read: a fresh store over the same path reads the seeded row back
    assert PersonaConnectionStore(p).get("ops") == seeded
    # ...and a second read does NOT re-seed even if the connected set changed
    assert store.defaults_for("ops", manifest, connected=set()) == seeded


def test_effective_resolution():
    eff = effective(
        connected={"slack", "github"},
        persona_defaults={"slack": True, "github": True, "datadog": False},
        session_overrides={"slack": False},
    )
    # slack muted by the session override; datadog not connected; github inherits the persona on.
    assert eff == {"github": True}


def test_session_override_clear_inherits(tmp_path):
    sstore = SessionConnectionStore(tmp_path / "session_connections.json")
    defaults = {"slack": True}

    sstore.set("s1", "slack", False)
    assert sstore.get("s1") == {"slack": False}
    # the override mutes slack despite the persona default being on
    assert (
        effective(
            connected={"slack"},
            persona_defaults=defaults,
            session_overrides=sstore.get("s1"),
        )
        == {}
    )

    # clearing the override → the session inherits the persona default again (on)
    sstore.clear("s1", "slack")
    assert sstore.get("s1") == {}
    assert effective(
        connected={"slack"},
        persona_defaults=defaults,
        session_overrides=sstore.get("s1"),
    ) == {"slack": True}


def test_remove_session_clears_overrides(tmp_path):
    p = tmp_path / "session_connections.json"
    sstore = SessionConnectionStore(p)
    sstore.set("s1", "slack", False)
    sstore.set("s2", "github", False)

    sstore.remove_session("s1")
    assert sstore.get("s1") == {}
    assert sstore.get("s2") == {"github": False}  # other sessions untouched
    # persisted
    assert SessionConnectionStore(p).get("s1") == {}


def test_delete_session_clears_overrides(tmp_path):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider())
    mgr.session_store.save(
        SessionRecord(
            session_id="sX",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            agent="cowork",
        )
    )
    mgr.session_connections.set("sX", "slack", False)
    mgr.delete_session("sX")
    assert mgr.session_connections.get("sX") == {}


# -- runtime gating: inbound ---------------------------------------------------
def test_muted_connector_not_delivered(tmp_path, monkeypatch):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider())
    delivered: list[str] = []

    async def fake_deliver(session_id, message, *, source=None):
        delivered.append(session_id)

    monkeypatch.setattr(mgr, "deliver_to_session", fake_deliver)

    # Slack is account-connected (an inbound message implies it is); the inbound gate resolves
    # against the effective set, which is connected AND not session-muted.
    mgr.secrets.put(
        "slack:default",
        {"bot_token": "xoxb-test", "app_token": "xapp-test", "enabled": True},
    )
    # two sessions subscribe to the same Slack channel; one has muted Slack for itself
    mgr.subscriptions.subscribe("sListen", "slack:C1")
    mgr.subscriptions.subscribe("sMute", "slack:C1")
    mgr.session_connections.set("sMute", "slack", False)

    asyncio.run(mgr._dispatch_inbound(_channel_event()))

    assert "sListen" in delivered  # not muted → delivered
    assert "sMute" not in delivered  # muted → skipped
    # ...but the message is still buffered for catch-up, even for the muted session
    assert mgr.channel_buffer.recent("slack:C1")[-1]["text"] == "deploy failed"


def test_dm_muted_session_not_delivered(tmp_path, monkeypatch):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider())
    delivered: list[str] = []

    async def fake_deliver(session_id, message, *, source=None):
        delivered.append(session_id)

    monkeypatch.setattr(mgr, "deliver_to_session", fake_deliver)

    mgr.set_dm_session("sDM")
    mgr.session_connections.set("sDM", "slack", False)  # mute slack for the DM session

    asyncio.run(mgr._dispatch_inbound(_dm_event()))

    assert delivered == []  # parked, not delivered
    parked = mgr.unrouted.list()
    assert parked and parked[0]["reason"] == "connector muted for DM session"


# -- runtime gating: outbound / tools ------------------------------------------
def test_muted_connector_tools_absent(tmp_path):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider())
    # github connected so its tools would otherwise be exposed to a connectors persona (cowork)
    mgr.secrets.put("github:default", {"token": "ghp_test", "enabled": True})

    for sid in ("sOn", "sOff"):
        mgr.session_store.save(
            SessionRecord(
                session_id=sid,
                workspace=str(tmp_path),
                model="gpt-5.5",
                mode="interactive",
                agent="cowork",
            )
        )
    mgr.session_connections.set("sOff", "github", False)  # mute github for sOff only

    on_engine = mgr.get_engine("sOn")
    off_engine = mgr.get_engine("sOff")

    # the un-muted session still has github tools; the muted session's engine omits them
    assert "github_search" in on_engine.registry.names()
    assert "github_search" not in off_engine.registry.names()
