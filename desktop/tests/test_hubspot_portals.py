"""HubSpot multi-portal + hidden-fields denylist (M3.6 Step 4).

Portals live at `hubspot:portal:<hub_id>` (managed OAuth and private-app paste
are field-compatible); `hubspot:default` is the default pointer + the
hidden-fields policy. Hidden fields are stripped from every record an agent
reads — model-facing policy (HubSpot permission sets are the human ACL).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from coworker.connectors import hubspot_portals
from coworker.connectors.integration_tools import make_integration_tools
from coworker.connectors.setup import connector_list
from coworker.secrets import SecretStore
from coworker.server import SessionManager, create_app


@pytest.fixture
def secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    return SecretStore()


def _portal(hub_id: str, **extra) -> dict:
    return {
        "type": "oauth",
        "enabled": True,
        "managed": True,
        "access_token": f"tok-{hub_id}",
        "hub_id": hub_id,
        "account": f"acme-{hub_id}",
        "scope": "crm.objects.contacts.read tickets",
        **extra,
    }


def _tool(secrets, name: str):
    tools = make_integration_tools(secrets)
    return next(t for t in tools if t.__name__ == name)


# --- portals: migration / default / listing -----------------------------------


def test_legacy_private_app_default_migrates_to_one_portal(secrets):
    secrets.put(
        "hubspot:default",
        {
            "type": "token",
            "enabled": True,
            "token": "pat-x",
            "account": "portal 424242",
        },
    )
    portals = hubspot_portals.list_portals(secrets)
    assert [h for h, _ in portals] == ["424242"]
    assert portals[0][1]["token"] == "pat-x"
    assert "token" not in (secrets.get("hubspot:default") or {})
    assert hubspot_portals.default_portal(secrets) == "424242"


def test_managed_portals_list_with_access_and_sandbox(secrets):
    hubspot_portals.managed_connect_portal(secrets, _portal("111", sandbox=True))
    hubspot_portals.managed_connect_portal(
        secrets,
        _portal("222", scope="crm.objects.contacts.read crm.objects.deals.write"),
    )
    listed = {c["name"]: c for c in connector_list(secrets)}
    hs = listed["hubspot"]
    assert hs["connected"]
    rows = {p["hub_id"]: p for p in hs["portals"]}
    assert rows["111"]["sandbox"] is True and rows["111"]["access"] == "read"
    assert rows["222"]["access"] == "write"
    assert rows["111"]["default"] is True  # first connected stays default
    assert hs["account"] == "acme-111"


def test_default_repoints_on_disconnect(secrets):
    hubspot_portals.managed_connect_portal(secrets, _portal("111"))
    hubspot_portals.managed_connect_portal(secrets, _portal("222"))
    assert hubspot_portals.set_default(secrets, "222")["ok"]
    assert hubspot_portals.disconnect_portal(secrets, "222")["ok"]
    assert hubspot_portals.default_portal(secrets) == "111"
    # last one out keeps only the hidden-fields policy
    hubspot_portals.set_hidden_fields(secrets, ["salary"])
    hubspot_portals.disconnect_portal(secrets, "111")
    assert hubspot_portals.list_portals(secrets) == []
    assert hubspot_portals.get_hidden_fields(secrets) == ["salary"]


# --- tools: portal selection + hidden fields -----------------------------------


def _fake_hubspot(monkeypatch, responses: dict[str, dict]):
    from coworker.connectors import integration_tools

    calls: list[tuple[str, str, dict]] = []

    def fake_request(method, url, *, headers=None, params=None, json=None, auth=None):
        calls.append((url, (headers or {}).get("Authorization", ""), json or {}))
        for suffix, resp in responses.items():
            if suffix in url:
                return resp
        return {"error": "HTTP 404", "details": "no fake route"}

    monkeypatch.setattr(integration_tools, "_request", fake_request)
    return calls


def test_tools_pick_the_requested_portal_by_id_or_name(secrets, monkeypatch):
    hubspot_portals.managed_connect_portal(secrets, _portal("111"))
    hubspot_portals.managed_connect_portal(secrets, _portal("222"))
    calls = _fake_hubspot(
        monkeypatch, {"/search": {"ok": True, "data": {"results": []}}}
    )
    search = _tool(secrets, "hubspot_search")

    out = search("acme")  # default portal
    assert out["ok"] and out["portal"] == "acme-111"
    out = search("acme", portal="222")
    assert out["portal"] == "acme-222"
    out = search("acme", portal="acme-222")  # by name too
    assert out["portal"] == "acme-222"
    assert [t for _, t, _ in calls] == [
        "Bearer tok-111",
        "Bearer tok-222",
        "Bearer tok-222",
    ]
    out = search("acme", portal="999")
    assert "no hubspot portal" in out["error"]


def test_hidden_fields_stripped_from_search_and_get(secrets, monkeypatch):
    hubspot_portals.managed_connect_portal(secrets, _portal("111"))
    hubspot_portals.set_hidden_fields(secrets, ["salary", "ssn"])
    _fake_hubspot(
        monkeypatch,
        {
            "/search": {
                "ok": True,
                "data": {
                    "results": [
                        {"id": "1", "properties": {"email": "a@b.c", "salary": "90k"}},
                        {"id": "2", "properties": {"SSN": "123", "phone": "5"}},
                    ]
                },
            },
            "/contacts/1": {
                "ok": True,
                "data": {"id": "1", "properties": {"email": "a@b.c", "salary": "90k"}},
            },
        },
    )
    out = _tool(secrets, "hubspot_search")("q")
    props = [r["properties"] for r in out["data"]["results"]]
    assert props == [{"email": "a@b.c"}, {"phone": "5"}]  # case-insensitive strip
    assert out["_display"] == {"hidden_fields": 2, "connector": "hubspot"}

    out = _tool(secrets, "hubspot_get_object")("contacts", "1")
    assert out["data"]["properties"] == {"email": "a@b.c"}
    assert out["_display"]["hidden_fields"] == 1


def test_no_delete_tool_exists(secrets):
    names = {t.__name__ for t in make_integration_tools(secrets)}
    assert not any("delete" in n for n in names if n.startswith("hubspot"))
    # the write surface is exactly: create contact, update, note, task
    assert {
        "hubspot_update_object",
        "hubspot_log_note",
        "hubspot_create_task",
        "hubspot_create_contact",
    } <= names


def test_write_tools_carry_portal_and_no_stripping_needed(secrets, monkeypatch):
    hubspot_portals.managed_connect_portal(secrets, _portal("111"))
    calls = _fake_hubspot(monkeypatch, {"/notes": {"ok": True, "data": {"id": "n1"}}})
    out = _tool(secrets, "hubspot_log_note")("deals", "77", "call went well")
    assert out["ok"] and out["portal"] == "acme-111"
    url, _token, payload = calls[0]
    assert url.endswith("/crm/v3/objects/notes")
    assert payload["properties"]["hs_note_body"] == "call went well"
    assert payload["associations"][0]["to"] == {"id": "77"}


# --- server routes -------------------------------------------------------------


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    manager = SessionManager(workspace=tmp_path)
    app = create_app(manager)
    with TestClient(app) as c:
        c.manager = manager
        yield c


def test_managed_callback_lands_in_portal_profile(client):
    resp = client.post(
        "/oauth/callback",
        data={
            "provider": "hubspot",
            "connector": "hubspot",
            "connection_id": "conn_hs",
            "access_token": "hs-at",
            "refresh_token": "hs-rt",
            "expires_in": "1800",
            "scope": "crm.objects.contacts.read tickets",
            "account": "Acme Inc",
            "hub_id": "424242",
            "sandbox": "1",
            "app_state": "s",
        },
    )
    assert resp.status_code == 200 and "HubSpot connected" in resp.text
    profile = client.manager.secrets.get("hubspot:portal:424242")
    assert profile["access_token"] == "hs-at" and profile["sandbox"] is True
    listed = {c["name"]: c for c in client.manager.list_connectors()}
    row = listed["hubspot"]["portals"][0]
    assert row == {
        "hub_id": "424242",
        "name": "Acme Inc",
        "sandbox": True,
        "default": True,
        "managed": True,
        "access": "read",
    }


def test_portal_routes_default_and_disconnect(client, monkeypatch):
    import coworker.cloud as cloud

    monkeypatch.setattr(cloud, "cloud_disconnect", lambda *a, **k: None)
    for hub in ("111", "222"):
        hubspot_portals.managed_connect_portal(client.manager.secrets, _portal(hub))

    assert client.post("/v1/connectors/hubspot/portals/222/default").json()["ok"]
    r = client.post("/v1/connectors/hubspot/portals/222/disconnect").json()
    assert r["ok"] and r["remaining_portals"] == 1

    r = client.patch(
        "/v1/connectors/hubspot/hidden-fields",
        json={"hidden_fields": ["Salary", "ssn "]},
    ).json()
    assert r["hidden_fields"] == ["salary", "ssn"]  # normalized
