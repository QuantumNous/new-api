"""Add/remove workspace for the managed Slack relay (M3.5 Step 2).

Add = the managed OAuth callback writes `slack:team:<id>` and hot-reloads the
gateway (no app restart). Remove = per-workspace disconnect: cloud routing row
deleted best-effort, local token dropped, gateway reloaded; the LAST removal
flips the connector off without resurrecting any stored manual creds.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from coworker.server import SessionManager, create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    manager = SessionManager(workspace=tmp_path)
    app = create_app(manager)
    with TestClient(app) as c:
        c.manager = manager
        yield c


def _install_form(team_id: str) -> dict:
    return {
        "connector": "slack",
        "team_id": team_id,
        "access_token": f"xoxb-{team_id}",
        "bot_user_id": "B1",
        "account": f"Workspace {team_id}",
        "team_domain": f"dom-{team_id.lower()}",
        "connection_id": f"conn_{team_id}",
    }


def _no_cloud(monkeypatch):
    """The cloud row delete is best-effort HTTP; record instead of calling out."""
    import coworker.cloud as cloud

    calls: list[str] = []
    monkeypatch.setattr(
        cloud, "slack_disconnect_workspace", lambda s, c, team_id: calls.append(team_id)
    )
    return calls


def test_managed_callback_installs_and_hot_reloads(client, monkeypatch):
    refreshes = []

    async def _refresh():
        refreshes.append(True)
        return []

    monkeypatch.setattr(client.manager, "refresh_gateway", _refresh)
    resp = client.post("/oauth/callback", data=_install_form("T1"))
    assert resp.status_code == 200 and "Slack connected" in resp.text
    assert client.manager.secrets.get("slack:team:T1")["bot_token"] == "xoxb-T1"
    # The broker-resolved workspace domain persists (names collide; domains don't)
    # and rides the workspaces list for the GUI's group headers.
    assert client.manager.secrets.get("slack:team:T1")["domain"] == "dom-t1"
    slack = [
        c
        for c in client.get("/v1/connectors").json()["connectors"]
        if c["name"] == "slack"
    ][0]
    assert [w["domain"] for w in slack["workspaces"]] == ["dom-t1"]
    assert client.manager.secrets.get("slack:default")["mode"] == "relay"
    assert refreshes  # new workspace's token loads without an app restart

    # a second workspace instals alongside, not instead
    client.post("/oauth/callback", data=_install_form("T2"))
    assert client.manager.secrets.get("slack:team:T1") is not None
    assert client.manager.secrets.get("slack:team:T2") is not None


def test_disconnect_one_workspace_keeps_the_other(client, monkeypatch):
    cloud_calls = _no_cloud(monkeypatch)
    for t in ("T1", "T2"):
        client.post("/oauth/callback", data=_install_form(t))

    body = client.post("/v1/connectors/slack/workspaces/T1/disconnect").json()
    assert body["ok"] is True and body["remaining_workspaces"] == 1
    assert cloud_calls == ["T1"]
    assert client.manager.secrets.get("slack:team:T1") is None
    assert client.manager.secrets.get("slack:team:T2") is not None
    # connector still connected in relay mode for the surviving workspace
    slack = next(c for c in client.manager.list_connectors() if c["name"] == "slack")
    assert slack["connected"] is True
    assert [w["team_id"] for w in slack["workspaces"]] == ["T2"]


def test_disconnect_last_workspace_flips_connector_off(client, monkeypatch):
    _no_cloud(monkeypatch)
    client.post("/oauth/callback", data=_install_form("T1"))

    body = client.post("/v1/connectors/slack/workspaces/T1/disconnect").json()
    assert body["ok"] is True and body["remaining_workspaces"] == 0
    assert client.manager.secrets.get("slack:default") is None
    slack = next(c for c in client.manager.list_connectors() if c["name"] == "slack")
    assert slack["connected"] is False


def test_last_disconnect_never_resurrects_manual_creds(client, monkeypatch):
    # Manual Socket Mode tokens stored BEFORE the relay switch must stay stored
    # but disabled — removing the last workspace must not start listening on them.
    _no_cloud(monkeypatch)
    client.manager.secrets.put(
        "slack:default",
        {"type": "token", "bot_token": "xoxb-manual", "app_token": "xapp-manual"},
    )
    client.post("/oauth/callback", data=_install_form("T1"))
    client.post("/v1/connectors/slack/workspaces/T1/disconnect")

    default = client.manager.secrets.get("slack:default")
    assert default["bot_token"] == "xoxb-manual"  # creds kept for a manual re-enable
    assert default["enabled"] is False and "mode" not in default
    from coworker.connectors import load_settings

    assert load_settings(client.manager.secrets)["slack"].enabled is False


def test_disconnect_unknown_workspace_errors(client, monkeypatch):
    _no_cloud(monkeypatch)
    body = client.post("/v1/connectors/slack/workspaces/T_NOPE/disconnect").json()
    assert body["ok"] is False
