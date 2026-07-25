"""Per-workspace allow-list (managed Slack relay, M3.5).

Slack user ids are workspace-scoped, so each connected workspace (`slack:team:*`)
carries its OWN allow-list; a relay event is authorized against ITS team's list alone.
Team-less sources (manual Socket Mode) keep the flat `slack:default` list — these tests
guard both paths so neither regresses the other.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from coworker.connectors import (
    ConnectorSettings,
    Gateway,
    MessageEvent,
    SessionSource,
    TeamAuth,
    load_settings,
)
from coworker.connectors.config import is_authorized
from coworker.providers import ModelCapabilities, ProviderClient
from coworker.secrets import SecretStore
from coworker.server import create_app
from coworker.server.manager import SessionManager


class ScriptedProvider(ProviderClient):
    def complete(self, *, model, messages, tools=None, **settings):
        raise AssertionError("no turns expected")

    def capabilities(self, model):
        return ModelCapabilities()


def _relay_manager(tmp_path, *, teams=("T1",)) -> SessionManager:
    m = SessionManager(data_dir=tmp_path / "data", provider=ScriptedProvider())
    for t in teams:
        m.secrets.put(
            f"slack:team:{t}",
            {"type": "oauth", "managed": True, "bot_token": f"xoxb-{t}", "team_id": t},
        )
    m.secrets.put(
        "slack:default",
        {"type": "oauth", "managed": True, "mode": "relay", "enabled": True},
    )
    return m


# -- is_authorized ---------------------------------------------------------------
def test_is_authorized_team_scoped():
    s = ConnectorSettings(
        platform="slack",
        allowed_users={"U_FLAT"},
        teams={"T1": TeamAuth(allowed_users={"U_OK"}), "T2": TeamAuth()},
    )
    # authorized only via the event's OWN team's list
    assert is_authorized(s, SessionSource("slack", "C1", user_id="U_OK", team_id="T1"))
    assert not is_authorized(
        s, SessionSource("slack", "C1", user_id="U_OK", team_id="T2")
    )
    # the flat list never authorizes a team-scoped event
    assert not is_authorized(
        s, SessionSource("slack", "C1", user_id="U_FLAT", team_id="T1")
    )
    # unknown team = no install we know of → deny
    assert not is_authorized(
        s, SessionSource("slack", "C1", user_id="U_OK", team_id="T_UNKNOWN")
    )
    # per-team allow_all opens only that team
    s.teams["T2"].allow_all = True
    assert is_authorized(s, SessionSource("slack", "C1", user_id="U_X", team_id="T2"))
    assert not is_authorized(
        s, SessionSource("slack", "C1", user_id="U_X", team_id="T1")
    )


def test_is_authorized_flat_path_unchanged():
    # Manual Socket Mode sources carry no team_id → the flat list, exactly as before,
    # even when team lists exist alongside.
    s = ConnectorSettings(
        platform="slack",
        allowed_users={"U_FLAT"},
        teams={"T1": TeamAuth(allowed_users={"U_OK"}, allow_all=True)},
    )
    assert is_authorized(s, SessionSource("slack", "C1", user_id="U_FLAT"))
    assert not is_authorized(s, SessionSource("slack", "C1", user_id="U_OK"))
    s2 = ConnectorSettings(platform="slack", allow_all=True)
    assert is_authorized(s2, SessionSource("slack", "C1", user_id="anyone"))


# -- load_settings ---------------------------------------------------------------
def test_load_settings_populates_teams(tmp_path):
    secrets = SecretStore(tmp_path / "secrets.json")
    secrets.put("slack:default", {"type": "oauth", "mode": "relay", "enabled": True})
    secrets.put(
        "slack:team:T1",
        {"bot_token": "xoxb-1", "allowed_users": ["U_A", "U_B"]},
    )
    secrets.put("slack:team:T2", {"bot_token": "xoxb-2", "allow_all": True})
    settings = load_settings(secrets)
    slack = settings["slack"]
    assert slack.enabled is True
    assert slack.teams["T1"].allowed_users == {"U_A", "U_B"}
    assert slack.teams["T1"].allow_all is False
    assert slack.teams["T2"].allow_all is True


# -- manager write path ----------------------------------------------------------
def test_set_allowed_with_team_writes_team_profile(tmp_path):
    m = _relay_manager(tmp_path, teams=("T1", "T2"))
    m.gateway = Gateway(
        secrets=m.secrets, settings={"slack": load_settings(m.secrets)["slack"]}
    )

    out = m.allow_user("slack", "U_NEW", team_id="T1")
    assert out["ok"] is True and out["team_id"] == "T1"
    assert m.secrets.get("slack:team:T1")["allowed_users"] == ["U_NEW"]
    # the sibling team and the flat list are untouched
    assert not m.secrets.get("slack:team:T2").get("allowed_users")
    assert not m.secrets.get("slack:default").get("allowed_users")
    # live gateway reflects it without a restart
    assert m.gateway.settings["slack"].teams["T1"].allowed_users == {"U_NEW"}

    m.disallow_user("slack", "U_NEW", team_id="T1")
    assert m.secrets.get("slack:team:T1")["allowed_users"] == []
    assert m.gateway.settings["slack"].teams["T1"].allowed_users == set()

    # unknown workspace → error, nothing written
    assert m.allow_user("slack", "U_X", team_id="T_NOPE")["ok"] is False


def test_set_allowed_without_team_keeps_flat_behavior(tmp_path):
    m = _relay_manager(tmp_path)
    assert m.allow_user("slack", "U_FLAT")["allowed_users"] == ["U_FLAT"]
    assert m.secrets.get("slack:default")["allowed_users"] == ["U_FLAT"]
    assert not m.secrets.get("slack:team:T1").get("allowed_users")


# -- park + resolve --------------------------------------------------------------
async def test_park_carries_team_and_resolve_allows_into_team(tmp_path):
    m = _relay_manager(tmp_path, teams=("T1",))
    delivered: list[MessageEvent] = []

    async def _capture(event: MessageEvent) -> None:
        delivered.append(event)

    m._dispatch_inbound = _capture

    event = MessageEvent(
        text="hello from T1",
        source=SessionSource(
            "slack", "C9", user_id="U_STRANGER", user_name="Zed", team_id="T1"
        ),
    )
    await m._park_unauthorized(event)
    items = m.parked.list("slack")
    assert items[0]["team_id"] == "T1"

    out = await m.resolve_unauthorized("slack", items[0]["id"], "allow_deliver")
    assert out["ok"] is True
    # the allow landed on the WORKSPACE list, not the flat one
    assert m.secrets.get("slack:team:T1")["allowed_users"] == ["U_STRANGER"]
    assert not m.secrets.get("slack:default").get("allowed_users")
    # the replayed event keeps its workspace, so per-team auth re-checks correctly
    assert len(delivered) == 1
    assert delivered[0].source.team_id == "T1"
    assert delivered[0].text == "hello from T1"


async def test_resolve_teamless_parked_uses_flat_list(tmp_path):
    # Manual-mode parked items (no team_id) keep resolving into slack:default.
    m = _relay_manager(tmp_path)

    async def _noop(event) -> None:
        pass

    m._dispatch_inbound = _noop
    await m._park_unauthorized(
        MessageEvent(
            text="hi",
            source=SessionSource("slack", "D1", user_id="U_M", chat_type="dm"),
        )
    )
    item = m.parked.list("slack")[0]
    assert item["team_id"] is None
    assert (await m.resolve_unauthorized("slack", item["id"], "allow"))["ok"] is True
    assert m.secrets.get("slack:default")["allowed_users"] == ["U_M"]
    assert not m.secrets.get("slack:team:T1").get("allowed_users")


# -- REST + connector_list surface ------------------------------------------------
def test_rest_allow_with_team_and_workspaces_field(tmp_path):
    m = _relay_manager(tmp_path, teams=("T1", "T2"))
    client = TestClient(create_app(m))

    r = client.post(
        "/v1/connectors/slack/allow", json={"user_id": "U_W", "team_id": "T1"}
    )
    assert r.json()["ok"] is True
    slack = next(
        c
        for c in client.get("/v1/connectors").json()["connectors"]
        if c["name"] == "slack"
    )
    assert slack["connected"] is True and slack["mode"] == "relay"
    ws = {w["team_id"]: w for w in slack["workspaces"]}
    assert ws["T1"]["allowed_users"] == ["U_W"]
    assert ws["T2"]["allowed_users"] == []

    r = client.post(
        "/v1/connectors/slack/disallow", json={"user_id": "U_W", "team_id": "T1"}
    )
    assert r.json()["allowed_users"] == []


# -- installer pre-add on managed install (UX-027) --------------------------------
def test_managed_install_preadds_the_installer(tmp_path):
    from coworker.connectors.setup import managed_connect_slack_install

    s = SecretStore(tmp_path / "secrets.json")
    managed_connect_slack_install(
        s, {"team_id": "T1", "access_token": "xoxb-t1", "slack_user_id": "U_ME"}
    )
    assert s.get("slack:team:T1")["allowed_users"] == ["U_ME"]
    src = SessionSource("slack", "T1/C1", user_id="U_ME", team_id="T1")
    assert is_authorized(load_settings(s)["slack"], src) is True


def test_reinstall_preserves_the_existing_allow_list(tmp_path):
    from coworker.connectors.setup import managed_connect_slack_install

    s = SecretStore(tmp_path / "secrets.json")
    s.put(
        "slack:team:T1",
        {
            "bot_token": "xoxb-old",
            "allowed_users": ["U_ANNA", "U_ME"],
            "sender_name": "Rohit",
        },
    )
    managed_connect_slack_install(
        s, {"team_id": "T1", "access_token": "xoxb-new", "slack_user_id": "U_ME"}
    )
    profile = s.get("slack:team:T1")
    assert profile["allowed_users"] == ["U_ANNA", "U_ME"]
    assert profile["bot_token"] == "xoxb-new"
    assert profile["sender_name"] == "Rohit"


def test_workspace_listing_carries_installer_identity(tmp_path):
    from coworker.connectors.setup import (
        _slack_workspaces,
        managed_connect_slack_install,
    )

    s = SecretStore(tmp_path / "secrets.json")
    managed_connect_slack_install(
        s, {"team_id": "T1", "access_token": "xoxb-t1", "slack_user_id": "U_ME"}
    )
    (w,) = _slack_workspaces(s)
    assert w["installer_user_id"] == "U_ME"
    assert w["installer_name"] == ""
