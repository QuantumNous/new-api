"""Phase 4 — persona + session connection surfaces (UI-REFRESH §5/§6).

The §5 persona detail / default-connection / enable endpoints and the §6 per-session connections
endpoints, exercised through ``TestClient(create_app(mgr))`` per the verification plan. Connectors
are "connected" by writing their secret profile directly (no network); ``browser`` is always
connected (auth="none"), so effective-set assertions use subsets, not exact equality.
"""

from fastapi.testclient import TestClient

from coworker.providers import ModelCapabilities, ProviderClient
from coworker.server import create_app
from coworker.server.manager import SessionManager
from coworker.sessions import SessionRecord


class ScriptedProvider(ProviderClient):
    def __init__(self, turns=None):
        self._turns = list(turns or [])

    def complete(self, *, model, messages, tools=None, **settings):
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


def _mgr(tmp_path, monkeypatch) -> SessionManager:
    # Isolate the SecretStore (which is otherwise the machine-global state dir) so a connector the
    # developer happens to have connected locally can't leak into "is it connected?" assertions.
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    return SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))


def _connect_github(mgr) -> None:
    mgr.secrets.put("github:default", {"token": "ghp_test", "enabled": True})


def _connect_slack(mgr) -> None:
    mgr.secrets.put(
        "slack:default",
        {"bot_token": "xoxb-test", "app_token": "xapp-test", "enabled": True},
    )


def _ops_session(mgr, session_id: str) -> None:
    mgr.session_store.save(
        SessionRecord(
            session_id=session_id,
            workspace=str(mgr.default_workspace),
            model="gpt-5.5",
            mode="interactive",
            agent="ops",
        )
    )


# -- §5 persona detail ---------------------------------------------------------
def test_persona_detail_endpoint(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path, monkeypatch)
    _connect_github(mgr)  # so a core recommend shows connected
    client = TestClient(create_app(mgr))

    detail = client.get("/v1/personas/ops").json()
    # identity + capabilities (from the manifest/entry)
    assert detail["id"] == "ops"
    assert detail["name"] == "Ops Coworker"
    assert detail["enabled"] is False  # non-default personas ship disabled (opt-in)
    assert (
        detail["workspace"] == "deliverable"
    )  # §16 collapse: ops is a scratch persona now
    assert detail["default_permission_mode"] == "interactive"
    assert "anthropic:claude-opus-4-8" in detail["recommended_models"]
    assert set(detail["tools"]) == {"files", "search", "shell", "todo"}
    assert detail["description"]  # the manifest description is surfaced

    # recommends annotated with `connected` (github connected; slack/datadog not)
    by_ref = {r["ref"]: r for r in detail["recommends"]}
    assert by_ref["github"]["connected"] is True and by_ref["github"]["tier"] == "core"
    assert by_ref["slack"]["connected"] is False
    assert by_ref["filesystem"]["kind"] == "mcp"  # mcp recommend carried through

    # default_connections = the RECOMMENDED connectors: core seed on / optional off, `connected`
    # annotated. datadog is core → seeds True even though it's an unconnected placeholder.
    dc = {d["connector"]: d for d in detail["default_connections"]}
    assert set(dc) == {"github", "slack", "datadog", "pagerduty"}
    assert dc["github"]["enabled"] is True and dc["github"]["connected"] is True
    assert dc["slack"]["enabled"] is True and dc["slack"]["connected"] is False
    assert dc["datadog"]["enabled"] is True
    assert dc["pagerduty"]["enabled"] is False

    # unknown id → the app's error convention
    assert client.get("/v1/personas/nope").json() == {
        "ok": False,
        "error": "unknown persona: nope",
    }


def test_persona_set_default_connection(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path, monkeypatch)
    _connect_github(mgr)
    _connect_slack(mgr)
    client = TestClient(create_app(mgr))

    # github starts on (core default) + connected → effective for a fresh ops session
    assert "github" in mgr.effective_connectors("newsess", "ops")

    resp = client.post(
        "/v1/personas/ops/connections", json={"connector": "github", "enabled": False}
    ).json()
    assert resp["ok"] is True
    flipped = {d["connector"]: d["enabled"] for d in resp["default_connections"]}
    assert flipped["github"] is False
    # the rest of the seeded row is preserved (the edit overlays the seed, not collapses it)
    assert set(flipped) == {"github", "slack", "datadog", "pagerduty"}

    # reflected in the next GET
    detail = client.get("/v1/personas/ops").json()
    assert {d["connector"]: d["enabled"] for d in detail["default_connections"]}[
        "github"
    ] is False

    # ...and in a brand-new session's effective set (github now off by persona default)
    eff = mgr.effective_connectors("brandnew", "ops")
    assert "github" not in eff
    assert "slack" in eff  # slack default unchanged → still effective


def test_persona_enable_toggle(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path, monkeypatch)
    client = TestClient(create_app(mgr))

    before = {p["id"]: p for p in client.get("/v1/personas").json()["personas"]}
    assert before["ops"]["enabled"] is False  # ships disabled; only cowork starts on
    assert before["cowork"]["enabled"] is True

    resp = client.post("/v1/personas/ops/enable", json={"enabled": True}).json()
    assert resp["ok"] is True
    after = {p["id"]: p for p in resp["personas"]}
    assert after["ops"]["enabled"] is True
    # a fresh GET agrees
    assert {p["id"]: p for p in client.get("/v1/personas").json()["personas"]}["ops"][
        "enabled"
    ] is True

    # disabling flips it back off; list_all keeps the row (the picker filters on `enabled`)
    assert client.post("/v1/personas/ops/enable", json={"enabled": False}).json()["ok"]
    assert {p["id"]: p for p in client.get("/v1/personas").json()["personas"]}["ops"][
        "enabled"
    ] is False

    # unknown id → error
    assert (
        client.post("/v1/personas/nope/enable", json={"enabled": False}).json()["ok"]
        is False
    )


# -- §6 per-session connections ------------------------------------------------
def test_session_connections_endpoint(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path, monkeypatch)
    _connect_github(mgr)
    _connect_slack(mgr)
    _ops_session(mgr, "incident")
    mgr.subscriptions.subscribe("incident", "slack:C123")  # drives the detail string
    client = TestClient(create_app(mgr))

    view = client.get("/v1/sessions/incident/connections").json()
    conn = {c["connector"]: c for c in view["connected"]}
    # github + slack connected and on by the ops core defaults → effective-enabled
    assert {"github", "slack"} <= set(conn)
    assert conn["github"]["enabled"] is True
    # slack's detail surfaces the subscribed channel id
    assert "C123" in conn["slack"]["detail"]

    # recommended = connector recommends not yet account-connected (datadog/pagerduty placeholders)
    rec = {r["connector"]: r for r in view["recommended"]}
    assert set(rec) == {"datadog", "pagerduty"}
    assert all(r["connected"] is False for r in view["recommended"])
    assert rec["datadog"]["tier"] == "core" and rec["pagerduty"]["tier"] == "optional"
    # attention = count of not-yet-connected recommends
    assert view["attention"] == 2


def test_fresh_session_view_uses_persona_hint(tmp_path, monkeypatch):
    # A brand-new session has no SessionRecord until its first turn persists. Without the
    # GUI's persona hint the view resolved to the DEFAULT persona (cowork) — the owner's
    # 2026-07-03 finding: a fresh session showed the wrong defaults and no recommends.
    mgr = _mgr(tmp_path, monkeypatch)
    _connect_slack(mgr)
    # ops persona default: slack OFF (user's "New sessions get by default" choice)
    mgr.persona_connections.defaults_for(
        "ops", mgr.personas.get("ops").manifest, connected={"slack"}
    )
    mgr.persona_connections.set("ops", "slack", False)
    client = TestClient(create_app(mgr))

    view = client.get("/v1/sessions/brand-new/connections?persona=ops").json()
    conn = {c["connector"]: c for c in view["connected"]}
    assert conn["slack"]["enabled"] is False  # persona default honored pre-persist
    assert view["recommended"], "ops recommends must show for a fresh ops session"

    # without the hint the same fresh session would fall back to the default persona
    fallback = client.get("/v1/sessions/brand-new/connections").json()
    assert {c["connector"]: c for c in fallback["connected"]}["slack"][
        "enabled"
    ] is True


def test_session_set_override(tmp_path, monkeypatch):
    mgr = _mgr(tmp_path, monkeypatch)
    _connect_slack(mgr)
    _connect_github(mgr)
    _ops_session(mgr, "s1")
    client = TestClient(create_app(mgr))

    # slack starts effective (connected + ops core default on)
    assert "slack" in mgr.effective_connectors("s1", "ops")
    before = {
        c["connector"]
        for c in client.get("/v1/sessions/s1/connections").json()["connected"]
    }
    assert "slack" in before

    # mute slack for this session
    resp = client.post(
        "/v1/sessions/s1/connections", json={"connector": "slack", "enabled": False}
    ).json()
    assert resp["ok"] is True
    assert mgr.session_connections.get("s1") == {"slack": False}
    assert "slack" not in mgr.effective_connectors("s1", "ops")
    # a muted connector stays VISIBLE in the drawer as toggled-off (owner finding
    # 2026-07-03: "where did Slack go?") — both in the returned view and a fresh GET
    view_conn = {c["connector"]: c for c in resp["connections"]["connected"]}
    assert view_conn["slack"]["enabled"] is False
    fresh = {
        c["connector"]: c
        for c in client.get("/v1/sessions/s1/connections").json()["connected"]
    }
    assert fresh["slack"]["enabled"] is False

    # clear → revert to the persona default (slack on again)
    resp2 = client.post(
        "/v1/sessions/s1/connections", json={"connector": "slack", "clear": True}
    ).json()
    assert resp2["ok"] is True
    assert mgr.session_connections.get("s1") == {}
    assert "slack" in mgr.effective_connectors("s1", "ops")
    assert "slack" in {c["connector"] for c in resp2["connections"]["connected"]}
