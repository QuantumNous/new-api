"""MCP OAuth (browser sign-in for remote servers, mcp/oauth.py): config parsing, token
persistence in the SecretStore, callback plumbing, status surfacing, and the loopback
route. No live OAuth server — the SDK's flow itself is upstream-tested; these guard OUR
integration points."""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken

from coworker.mcp import oauth as mcp_oauth
from coworker.mcp.config import load_mcp_servers
from coworker.secrets import SecretStore
from coworker.server.app import create_app
from coworker.server.manager import SessionManager

GRANOLA = {"type": "http", "url": "https://mcp.granola.ai/mcp", "auth": "oauth"}


def _state(tmp_path, monkeypatch, servers=None):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    path = tmp_path / "state" / "mcp.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"mcpServers": servers or {}}), encoding="utf-8")


@pytest.fixture(autouse=True)
def _no_pending():
    mcp_oauth._pending = None
    yield
    mcp_oauth._pending = None


# -- config --------------------------------------------------------------------


def test_config_parses_auth_field(tmp_path, monkeypatch):
    _state(
        tmp_path, monkeypatch, {"granola": GRANOLA, "plain": {"url": "https://x/mcp"}}
    )
    servers = {s.name: s for s in load_mcp_servers()}
    assert servers["granola"].auth == "oauth"
    assert servers["granola"].transport == "http"
    assert servers["plain"].auth is None


# -- token storage ---------------------------------------------------------------


def test_token_storage_roundtrip(tmp_path, monkeypatch):
    _state(tmp_path, monkeypatch)
    secrets = SecretStore()
    storage = mcp_oauth.SecretStoreTokenStorage("granola", secrets)

    async def run():
        assert await storage.get_tokens() is None
        await storage.set_tokens(
            OAuthToken.model_validate(
                {"access_token": "at", "token_type": "Bearer", "refresh_token": "rt"}
            )
        )
        await storage.set_client_info(
            OAuthClientInformationFull.model_validate(
                {
                    "client_id": "dcr-123",
                    "redirect_uris": ["http://127.0.0.1:8765/mcp/oauth/callback"],
                }
            )
        )
        tokens = await storage.get_tokens()
        info = await storage.get_client_info()
        return tokens, info

    tokens, info = asyncio.run(run())
    assert tokens.access_token == "at" and tokens.refresh_token == "rt"
    assert info.client_id == "dcr-123"  # DCR registration survives restarts
    assert mcp_oauth.has_tokens("granola", secrets)
    assert mcp_oauth.sign_out("granola", secrets)
    assert not mcp_oauth.has_tokens("granola", secrets)


# -- callback plumbing -----------------------------------------------------------


def test_deliver_without_waiter_is_rejected():
    assert mcp_oauth.deliver_callback("code", "state") is False


def test_wait_then_deliver_resolves():
    async def run():
        task = asyncio.create_task(mcp_oauth._wait_for_callback())
        await asyncio.sleep(0)  # let the waiter install its future
        assert mcp_oauth.deliver_callback("c0de", "st4te") is True
        return await task

    assert asyncio.run(run()) == ("c0de", "st4te")


# -- status surfacing over REST ---------------------------------------------------


def test_list_mcp_oauth_statuses(tmp_path, monkeypatch):
    _state(tmp_path, monkeypatch, {"granola": GRANOLA})
    manager = SessionManager(data_dir=tmp_path / "data")
    client = TestClient(create_app(manager))

    row = client.get("/v1/mcp").json()["servers"][0]
    assert row["auth"] == "oauth" and row["status"] == "needs_auth"

    manager._mcp_authorizing.add("granola")
    assert client.get("/v1/mcp").json()["servers"][0]["status"] == "authorizing"
    manager._mcp_authorizing.discard("granola")

    manager._mcp_errors["granola"] = "sign-in timed out"
    row = client.get("/v1/mcp").json()["servers"][0]
    assert row["last_error"] == "sign-in timed out"

    manager.secrets.put("mcp-oauth:granola", {"tokens": {"access_token": "at"}})
    assert client.get("/v1/mcp").json()["servers"][0]["status"] == "configured"

    assert client.post("/v1/mcp/granola/signout").json()["ok"] is True
    assert not mcp_oauth.has_tokens("granola", manager.secrets)
    assert client.get("/v1/mcp").json()["servers"][0]["status"] == "needs_auth"


def test_connect_endpoint_starts_background_flow(tmp_path, monkeypatch):
    _state(tmp_path, monkeypatch, {"granola": GRANOLA})
    manager = SessionManager(data_dir=tmp_path / "data")

    seen = {}

    async def fake_connect(name):
        seen["name"] = name
        return {"ok": True}

    monkeypatch.setattr(manager, "connect_mcp", fake_connect)
    client = TestClient(create_app(manager))
    assert client.post("/v1/mcp/granola/connect").json() == {
        "ok": True,
        "started": True,
    }
    assert seen["name"] == "granola"


# -- loopback route ----------------------------------------------------------------


def test_callback_route(tmp_path, monkeypatch):
    _state(tmp_path, monkeypatch)
    manager = SessionManager(data_dir=tmp_path / "data")
    client = TestClient(create_app(manager))

    # Provider error → failure page.
    r = client.get("/mcp/oauth/callback", params={"error": "access_denied"})
    assert r.status_code == 400 and "failed" in r.text.lower()

    # No flow waiting → stale-tab page.
    r = client.get("/mcp/oauth/callback", params={"code": "x"})
    assert r.status_code == 400 and "waiting" in r.text.lower()

    # A waiting flow gets the code and the browser sees the success page.
    loop = asyncio.new_event_loop()
    try:
        future = loop.create_future()
        mcp_oauth._pending = future
        r = client.get("/mcp/oauth/callback", params={"code": "c1", "state": "s1"})
        assert r.status_code == 200 and "close this tab" in r.text.lower()
        assert future.result() == ("c1", "s1")
    finally:
        loop.close()
