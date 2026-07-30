"""Local sidecar access control.

The sidecar listens on loopback, so any page the user visits could otherwise reach it.
Three contracts hold the boundary: the launch token gates the API, the browser OAuth
callbacks stay reachable without it (the system browser cannot present a header), and
those callback responses are kept out of caches and referrers.
"""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from coworker.server import SessionManager, create_app

TOKEN = "local-test-capability"
AUTH = {"X-OpenWorker-Token": TOKEN}


def test_launch_token_gates_the_api_but_not_the_browser_callback(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_API_TOKEN", TOKEN)
    client = TestClient(create_app(SessionManager(workspace=tmp_path)))

    assert client.get("/v1/agents").status_code == 401
    assert client.get("/v1/agents", headers=AUTH).status_code == 200

    # Health stays reachable for liveness probes, but only an authenticated caller
    # learns the workspace path and model.
    anonymous = client.get("/v1/health")
    assert anonymous.status_code == 200
    assert anonymous.json() == {"status": "ok"}
    assert "default_workspace" in client.get("/v1/health", headers=AUTH).json()

    callback = client.get("/auth/callback", params={"state": "invalid"})
    assert callback.status_code == 400
    assert callback.headers["cache-control"] == "no-store"
    assert callback.headers["referrer-policy"] == "no-referrer"
    assert callback.headers["x-content-type-options"] == "nosniff"


def test_launch_token_gates_the_websocket(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_API_TOKEN", TOKEN)
    client = TestClient(create_app(SessionManager(workspace=tmp_path)))

    with client.websocket_connect(
        "/ws/events", subprotocols=["openworker", TOKEN]
    ) as websocket:
        assert websocket.accepted_subprotocol == "openworker"

    # CORS never gates WebSockets, so the token is the only thing standing between a
    # cross-site page and the event stream.
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/events", subprotocols=["openworker"]):
            pass


def test_tauri_preflight_is_allowed_but_actual_request_requires_the_token(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("COWORKER_API_TOKEN", TOKEN)
    client = TestClient(create_app(SessionManager(workspace=tmp_path)))

    preflight = client.options(
        "/v1/agents",
        headers={
            "Origin": "http://tauri.localhost",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-openworker-token",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://tauri.localhost"
    assert (
        client.get("/v1/agents", headers={"Origin": "http://tauri.localhost"}).status_code
        == 401
    )
