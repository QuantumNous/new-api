"""Allow-list surfacing on the Connectors tab: GET /v1/connectors carries the allow-list as a list
plus the gateway's recently-seen senders (each flagged authorized), and allow/disallow mutate it.
"""

from fastapi.testclient import TestClient

from coworker.providers import ModelCapabilities, ProviderClient
from coworker.server import create_app
from coworker.server.manager import SessionManager


class ScriptedProvider(ProviderClient):
    def complete(self, *, model, messages, tools=None, **settings):
        raise AssertionError("no turns expected")

    def capabilities(self, model):
        return ModelCapabilities()


class _Gateway:
    """Minimal gateway stub exposing the recent-senders surface the manager enriches with."""

    def __init__(self, recent):
        self._recent = recent
        self.settings = {}

    def recent_senders(self, name):
        return [dict(r) for r in self._recent] if name == "slack" else []


def _connected_slack(mgr, allowed=()):
    mgr.secrets.put(
        "slack:default",
        {
            "type": "token",
            "bot_token": "xoxb-1",
            "app_token": "xapp-1",
            "allowed_users": list(allowed),
        },
    )


def _slack(connectors):
    return next(c for c in connectors if c["name"] == "slack")


def test_connectors_carry_allowlist_and_recent(tmp_path):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider())
    _connected_slack(mgr, allowed=["U_OK"])
    mgr.gateway = _Gateway(
        recent=[
            {
                "user_id": "U_OK",
                "user_name": "Ann",
                "chat_id": "D1",
                "chat_type": "dm",
                "target": "slack:D1",
            },
            {
                "user_id": "U_NEW",
                "user_name": "Bob",
                "chat_id": "D2",
                "chat_type": "dm",
                "target": "slack:D2",
            },
        ]
    )
    client = TestClient(create_app(mgr))

    slack = _slack(client.get("/v1/connectors").json()["connectors"])
    assert slack["connected"] is True
    assert slack["allowed_users"] == ["U_OK"]  # a list, not a count
    by_id = {r["user_id"]: r for r in slack["recent"]}
    assert by_id["U_OK"]["authorized"] is True
    assert by_id["U_NEW"]["authorized"] is False


def test_allow_then_disallow_mutates_list(tmp_path):
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider())
    _connected_slack(mgr)
    mgr.gateway = _Gateway(recent=[])
    client = TestClient(create_app(mgr))

    client.post("/v1/connectors/slack/allow", json={"user_id": "U_NEW"})
    assert _slack(client.get("/v1/connectors").json()["connectors"])[
        "allowed_users"
    ] == ["U_NEW"]

    client.post("/v1/connectors/slack/disallow", json={"user_id": "U_NEW"})
    assert (
        _slack(client.get("/v1/connectors").json()["connectors"])["allowed_users"] == []
    )


def test_recent_absent_when_no_gateway(tmp_path):
    # No gateway running (server started without messaging) → no recent senders, still no crash.
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider())
    _connected_slack(mgr)
    mgr.gateway = None
    client = TestClient(create_app(mgr))

    slack = _slack(client.get("/v1/connectors").json()["connectors"])
    assert slack["recent"] == []
