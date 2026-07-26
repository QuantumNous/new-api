from fastapi.testclient import TestClient

from coworker.server import SessionManager, create_app


def test_local_capability_protects_health_but_not_browser_callback(tmp_path, monkeypatch):
    monkeypatch.setenv("BOXAI_LOCAL_TOKEN", "local-test-capability")
    client = TestClient(create_app(SessionManager(workspace=tmp_path)))

    assert client.get("/v1/health").status_code == 401
    assert client.get(
        "/v1/health",
        headers={"Authorization": "Bearer local-test-capability"},
    ).status_code == 200

    callback = client.get("/auth/callback", params={"state": "invalid"})
    assert callback.status_code == 400
    assert callback.headers["cache-control"] == "no-store"
    assert callback.headers["referrer-policy"] == "no-referrer"


def test_local_capability_protects_websocket(tmp_path, monkeypatch):
    monkeypatch.setenv("BOXAI_LOCAL_TOKEN", "local-test-capability")
    client = TestClient(create_app(SessionManager(workspace=tmp_path)))

    with client.websocket_connect(
        "/ws/events",
        subprotocols=["boxai-local-v1", "local-test-capability"],
    ) as websocket:
        assert websocket.accepted_subprotocol == "boxai-local-v1"


def test_tauri_preflight_is_allowed_but_actual_request_requires_capability(tmp_path, monkeypatch):
    monkeypatch.setenv("BOXAI_LOCAL_TOKEN", "local-test-capability")
    client = TestClient(create_app(SessionManager(workspace=tmp_path)))

    preflight = client.options(
        "/v1/health",
        headers={
            "Origin": "http://tauri.localhost",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://tauri.localhost"
    assert client.get("/v1/health", headers={"Origin": "http://tauri.localhost"}).status_code == 401
