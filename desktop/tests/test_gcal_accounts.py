"""Google Calendar multi-account (gmail-parity, minus filters).

Accounts live at `google_calendar:account:<email>` (managed OAuth and manual
paste are field-compatible); `google_calendar:default` is just the default
pointer. Tools take an `account` param with default fallback and name the
account on every success so approvals/transcripts say whose calendar moved.
"""

from __future__ import annotations

import time

import pytest

from coworker.connectors import gcal_accounts
from coworker.connectors.integration_tools import make_integration_tools
from coworker.connectors.setup import connector_list, disconnect_connector
from coworker.secrets import SecretStore


@pytest.fixture
def secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    return SecretStore()


def _account(email: str, **extra) -> dict:
    return {
        "type": "oauth",
        "enabled": True,
        "managed": True,
        "access_token": f"tok-{email}",
        "account": email,
        **extra,
    }


def _tool(secrets, name: str):
    tools = make_integration_tools(secrets)
    return next(t for t in tools if t.__name__ == name)


def _fake_gcal(monkeypatch, responses: dict[str, dict]):
    """Route _request by URL suffix; records (method, url, bearer, body)."""
    from coworker.connectors import integration_tools

    calls: list[tuple[str, str, str, dict | None]] = []

    def fake_request(method, url, *, headers=None, params=None, json=None, auth=None):
        token = (headers or {}).get("Authorization", "")
        calls.append((method, url, token, json))
        for suffix, resp in responses.items():
            if suffix in url:
                return resp
        return {"error": "HTTP 404", "details": "no fake route"}

    monkeypatch.setattr(integration_tools, "_request", fake_request)
    return calls


# --- accounts: migration / default / disconnect ------------------------------


def test_legacy_default_migrates_to_one_account(secrets):
    secrets.put(
        "google_calendar:default",
        {
            "type": "oauth",
            "enabled": True,
            "access_token": "ya29",
            "account": "Old@X.com",
        },
    )
    accounts = gcal_accounts.list_accounts(secrets)
    assert [e for e, _ in accounts] == ["old@x.com"]
    assert accounts[0][1]["access_token"] == "ya29"
    pointer = secrets.get("google_calendar:default")
    assert pointer["default_account"] == "old@x.com"
    assert "access_token" not in pointer  # tokens moved, not copied
    assert gcal_accounts.default_account(secrets) == "old@x.com"
    # idempotent
    gcal_accounts.migrate_legacy_default(secrets)
    assert len(gcal_accounts.list_accounts(secrets)) == 1


def test_second_account_added_first_stays_default(secrets):
    gcal_accounts.managed_connect_account(secrets, _account("one@x.com"))
    gcal_accounts.managed_connect_account(secrets, _account("two@y.com"))
    assert gcal_accounts.default_account(secrets) == "one@x.com"
    listed = {c["name"]: c for c in connector_list(secrets)}
    emails = [a["email"] for a in listed["google_calendar"]["accounts"]]
    assert emails == ["one@x.com", "two@y.com"]
    assert listed["google_calendar"]["connected"]
    assert listed["google_calendar"]["account"] == "one@x.com"


def test_set_default_and_disconnect_repoints(secrets):
    gcal_accounts.managed_connect_account(secrets, _account("one@x.com"))
    gcal_accounts.managed_connect_account(secrets, _account("two@y.com"))
    assert gcal_accounts.set_default(secrets, "two@y.com")["ok"]
    assert gcal_accounts.default_account(secrets) == "two@y.com"
    # dropping the default moves the pointer to the remaining account
    assert gcal_accounts.disconnect_account(secrets, "two@y.com")["ok"]
    assert gcal_accounts.default_account(secrets) == "one@x.com"


def test_last_disconnect_removes_the_pointer(secrets):
    gcal_accounts.managed_connect_account(secrets, _account("one@x.com"))
    assert gcal_accounts.disconnect_account(secrets, "one@x.com")["ok"]
    listed = {c["name"]: c for c in connector_list(secrets)}
    assert not listed["google_calendar"]["connected"]
    assert secrets.get("google_calendar:default") is None


def test_full_disconnect_drops_every_account(secrets):
    gcal_accounts.managed_connect_account(secrets, _account("one@x.com"))
    gcal_accounts.managed_connect_account(secrets, _account("two@y.com"))
    assert disconnect_connector(secrets, "google_calendar")["ok"]
    assert gcal_accounts.list_accounts(secrets) == []
    assert secrets.get("google_calendar:default") is None


# --- tools: per-account resolution -------------------------------------------


def test_tools_pick_the_requested_account_token(secrets, monkeypatch):
    gcal_accounts.managed_connect_account(secrets, _account("one@x.com"))
    gcal_accounts.managed_connect_account(secrets, _account("two@y.com"))
    calls = _fake_gcal(monkeypatch, {"/events": {"ok": True, "data": {"items": []}}})
    listing = _tool(secrets, "gcal_list_events")

    out = listing()  # default account
    assert out["ok"] and out["account"] == "one@x.com"
    out = listing(account="two@y.com")
    assert out["ok"] and out["account"] == "two@y.com"
    assert [t for _, _, t, _ in calls] == [
        "Bearer tok-one@x.com",
        "Bearer tok-two@y.com",
    ]

    out = listing(account="nobody@z.com")
    assert "no google calendar account" in out["error"]


def test_legacy_single_account_still_works_via_tools(secrets, monkeypatch):
    # Pre-migration store: tokens on google_calendar:default (manual paste era).
    secrets.put(
        "google_calendar:default", {"access_token": "legacy-tok", "account": "me@x.com"}
    )
    calls = _fake_gcal(monkeypatch, {"/events": {"ok": True, "data": {"items": []}}})
    out = _tool(secrets, "gcal_list_events")()
    assert out["ok"] and out["account"] == "me@x.com"
    assert calls[0][2] == "Bearer legacy-tok"


# --- the new tools: update / delete / free-busy --------------------------------


def test_update_event_patches_only_provided_fields(secrets, monkeypatch):
    gcal_accounts.managed_connect_account(secrets, _account("me@x.com"))
    calls = _fake_gcal(
        monkeypatch, {"/events/ev1": {"ok": True, "data": {"id": "ev1"}}}
    )
    out = _tool(secrets, "gcal_update_event")(
        "ev1", summary="Moved", start="2026-07-10T10:00:00Z"
    )
    assert out["ok"] and out["account"] == "me@x.com"
    method, url, _, body = calls[0]
    assert method == "PATCH" and url.endswith("/calendars/primary/events/ev1")
    assert body == {
        "summary": "Moved",
        "start": {"dateTime": "2026-07-10T10:00:00Z", "timeZone": "UTC"},
    }


def test_update_event_with_nothing_to_change_refuses(secrets, monkeypatch):
    gcal_accounts.managed_connect_account(secrets, _account("me@x.com"))
    _fake_gcal(monkeypatch, {})
    out = _tool(secrets, "gcal_update_event")("ev1")
    assert "nothing to update" in out["error"]


def test_delete_event_targets_the_calendar(secrets, monkeypatch):
    gcal_accounts.managed_connect_account(secrets, _account("me@x.com"))
    calls = _fake_gcal(monkeypatch, {"/events/ev9": {"ok": True, "data": ""}})
    out = _tool(secrets, "gcal_delete_event")(
        "ev9", calendar_id="team@group.calendar.google.com"
    )
    assert out["ok"]
    method, url, _, _ = calls[0]
    assert method == "DELETE"
    assert url.endswith("/calendars/team@group.calendar.google.com/events/ev9")


def test_free_busy_queries_each_listed_calendar(secrets, monkeypatch):
    gcal_accounts.managed_connect_account(secrets, _account("me@x.com"))
    calls = _fake_gcal(
        monkeypatch, {"/freeBusy": {"ok": True, "data": {"calendars": {}}}}
    )
    out = _tool(secrets, "gcal_free_busy")(
        "2026-07-10T00:00:00Z", "2026-07-11T00:00:00Z", calendars="primary, team@x.com"
    )
    assert out["ok"] and out["account"] == "me@x.com"
    _, _, _, body = calls[0]
    assert body["items"] == [{"id": "primary"}, {"id": "team@x.com"}]
    assert body["timeMin"] == "2026-07-10T00:00:00Z"


def test_write_tools_require_approval(secrets):
    # Connector-wide stance: approval by default (reads included) — the writes
    # are what must NEVER lose the gate, so pin them explicitly.
    tools = {t.__name__: t for t in make_integration_tools(secrets)}

    def needs_approval(name: str) -> bool:
        return tools[name].__aisuite_tool_metadata__.requires_approval

    assert needs_approval("gcal_create_event")
    assert needs_approval("gcal_update_event")
    assert needs_approval("gcal_delete_event")


# --- managed refresh targets the account profile ------------------------------


def test_account_profile_refreshes_in_place(secrets, monkeypatch):
    from coworker import cloud

    secrets.put(
        cloud.CLOUD_AUTH_PROFILE, {"access_token": "jwt", "expires": time.time() + 3600}
    )
    gcal_accounts.managed_connect_account(
        secrets,
        _account(
            "me@x.com",
            provider="google",
            refresh_token="1//r",
            connection_id="conn_7",
            expires=time.time() - 10,
        ),
    )

    class _Resp:
        status_code = 200

        def json(self):
            return {"access_token": "fresh", "expires_in": 3600}

    monkeypatch.setattr(cloud.httpx, "post", lambda *a, **k: _Resp())
    _fake_gcal(monkeypatch, {"/events": {"ok": True, "data": {"items": []}}})
    out = _tool(secrets, "gcal_list_events")()
    assert out["ok"]
    assert secrets.get("google_calendar:account:me@x.com")["access_token"] == "fresh"
    assert not (secrets.get("google_calendar:default") or {}).get("access_token")
