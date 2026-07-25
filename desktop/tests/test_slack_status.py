"""Slack connection health (M3.6 Step 2) — three honest layers: the
desktop↔relay socket, the cloud sign-in, and per-workspace bot tokens.
The endpoint aggregates what the adapter observed; it never invents a
Slack↔cloud claim (that leg is invisible from the desktop).
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from coworker.connectors.base import SendResult
from coworker.connectors.relay_client import SlackRelayAdapter
from coworker.server import SessionManager, create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    manager = SessionManager(workspace=tmp_path)
    app = create_app(manager)
    with TestClient(app) as c:
        c.manager = manager
        yield c


class _StubAdapter:
    """Quacks like SlackRelayAdapter.status() without a socket."""

    def __init__(self, state="live", teams=None):
        self._state = state
        self._teams = teams or {}

    def status(self):
        return {
            "state": self._state,
            "reconnects": 2,
            "last_event_at": 1751970000.0,
            "last_error": "" if self._state == "live" else "boom",
            "teams": self._teams,
        }


async def _noop_stop():
    return None


def _gateway_with(adapter) -> SimpleNamespace:
    # `stop` because app shutdown tears the gateway down.
    return SimpleNamespace(
        _adapters={"slack": adapter} if adapter else {}, stop=_noop_stop
    )


# --- endpoint aggregation ----------------------------------------------------


def test_status_live_relay_with_teams(client):
    client.manager.secrets.put("slack:default", {"mode": "relay", "enabled": True})
    client.manager.secrets.put(
        "cloud:auth", {"access_token": "jwt", "account": "rohit@x.com"}
    )
    client.manager.gateway = _gateway_with(
        _StubAdapter("live", {"T1": {"token_ok": True}, "T2": {"token_ok": False}})
    )
    data = client.get("/v1/connectors/slack/status").json()
    assert data["mode"] == "relay"
    assert data["signed_in"] is True
    assert data["relay"]["state"] == "live"
    assert data["relay"]["last_event_at"] == 1751970000.0
    assert data["teams"]["T1"]["token_ok"] is True
    assert data["teams"]["T2"]["token_ok"] is False
    assert "teams" not in data["relay"]  # folded up, not duplicated


def test_status_reconnecting_carries_last_error(client):
    client.manager.secrets.put("slack:default", {"mode": "relay", "enabled": True})
    client.manager.gateway = _gateway_with(_StubAdapter("reconnecting"))
    data = client.get("/v1/connectors/slack/status").json()
    assert data["relay"]["state"] == "reconnecting"
    assert data["relay"]["last_error"] == "boom"
    assert data["signed_in"] is False


def test_status_offline_when_no_adapter(client):
    # Relay mode configured but the gateway has no slack adapter (e.g. signed
    # out at startup so it never built) → offline, not a crash.
    client.manager.secrets.put("slack:default", {"mode": "relay", "enabled": True})
    client.manager.gateway = _gateway_with(None)
    data = client.get("/v1/connectors/slack/status").json()
    assert data["relay"]["state"] == "offline"
    assert data["teams"] == {}


def test_status_manual_socket_mode_has_no_relay_layer(client):
    # Socket-Mode adapters expose no status(); the endpoint still answers.
    client.manager.secrets.put("slack:default", {"bot_token": "xoxb", "enabled": True})
    client.manager.gateway = None
    data = client.get("/v1/connectors/slack/status").json()
    assert data["mode"] == ""  # not relay
    assert data["relay"]["state"] == "offline"


# --- adapter state tracking --------------------------------------------------


def _adapter(**kw) -> SlackRelayAdapter:
    return SlackRelayAdapter(
        "wss://relay.test/ws",
        token_provider=lambda: "jwt",
        teams={"T1": {"bot_token": "xoxb-1", "bot_user_id": "UBOT"}},
        reconnect_delay=0.0,
        **kw,
    )


def test_adapter_status_offline_before_connect():
    st = _adapter().status()
    assert st["state"] == "offline"
    assert st["last_event_at"] is None
    assert st["teams"] == {"T1": {"token_ok": True}}  # unknown ⇒ assumed good


async def test_adapter_stamps_last_event_and_reports_live():
    class _Blocking:
        async def open(self):
            pass

        async def recv(self):
            await asyncio.Event().wait()

        async def close(self):
            pass

    adapter = _adapter(transport_factory=lambda: _Blocking())
    assert await adapter.connect() is True
    try:
        assert adapter.status()["state"] == "live"
        assert adapter.status()["last_event_at"] is None
        await adapter._dispatch_slack_event(
            "T1",
            {
                "type": "app_mention",
                "user": "U1",
                "channel": "C1",
                "text": "x",
                "ts": "1",
            },
        )
        assert adapter.status()["last_event_at"] is not None
    finally:
        await adapter.disconnect()
    assert adapter.status()["state"] == "offline"


async def test_adapter_connect_failure_records_last_error():
    class _Broken:
        async def open(self):
            raise OSError("relay unreachable")

        async def recv(self):
            return None

        async def close(self):
            pass

    adapter = _adapter(transport_factory=lambda: _Broken())
    assert await adapter.connect() is False
    assert "relay unreachable" in adapter.status()["last_error"]


async def test_send_error_marks_token_dead_and_recovers(monkeypatch):
    from coworker.connectors import relay_client

    results = iter(
        [SendResult(False, error="invalid_auth"), SendResult(True, message_id="ts")]
    )
    monkeypatch.setattr(relay_client, "_send_slack", lambda *a, **k: next(results))
    adapter = _adapter()

    await adapter.send("T1/C1", "hi")
    assert adapter.status()["teams"]["T1"]["token_ok"] is False
    await adapter.send("T1/C1", "hi again")
    assert adapter.status()["teams"]["T1"]["token_ok"] is True


async def test_non_token_send_error_does_not_flag_token(monkeypatch):
    from coworker.connectors import relay_client

    monkeypatch.setattr(
        relay_client,
        "_send_slack",
        lambda *a, **k: SendResult(False, error="channel_not_found"),
    )
    adapter = _adapter()
    await adapter.send("T1/C1", "hi")
    assert adapter.status()["teams"]["T1"]["token_ok"] is True


async def test_slack_get_token_error_marks_team(monkeypatch):
    adapter = _adapter()

    class _Resp:
        def json(self):
            return {"ok": False, "error": "account_inactive"}

    class _Http:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return _Resp()

    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", _Http)
    assert await adapter._slack_get("T1", "users.info", {"user": "U1"}) is None
    assert adapter.status()["teams"]["T1"]["token_ok"] is False
