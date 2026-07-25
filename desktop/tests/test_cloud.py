"""OpenWorker Cloud integration: sign-in, managed connect callback, refresh.

Everything is offline: Auth0 and the cloud broker are stubbed at the httpx
boundary. The invariants under test are the product promises — manual paste
works signed out, managed profiles are field-compatible with manual ones, and
manual profiles are never touched by cloud refresh.
"""

from __future__ import annotations

import time
import urllib.parse

import pytest

from coworker import cloud
from coworker.config import Config
from coworker.connectors.setup import (
    connect_connector,
    connector_list,
    managed_connect_connector,
)
from coworker.secrets import SecretStore


@pytest.fixture
def secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    return SecretStore(path=tmp_path / "state" / "secrets.json")


@pytest.fixture
def config():
    return Config(
        cloud_base_url="https://cloud.test",
        cloud_auth_domain="tenant.auth0.test",
        cloud_client_id="client123",
        port=8765,
    )


class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body or {}

    def json(self):
        return self._body


# --- sign-in -------------------------------------------------------------------


def test_begin_login_builds_pkce_authorize_url(config, monkeypatch):
    monkeypatch.delenv("COWORKER_PORT", raising=False)
    out = cloud.begin_login(config)
    url = out["authorize_url"]
    assert url.startswith("https://tenant.auth0.test/authorize?")
    assert "code_challenge_method=S256" in url
    assert "client_id=client123" in url
    # The redirect is the BROKER's stable callback (Auth0 rejects unregistered
    # loopback ports, and the packaged sidecar binds a random one) …
    assert "cloud.test%2Fv1%2Fauth%2Fcallback" in url
    assert out["state"] in url
    # … and state carries the actual loopback port for the bounce back.
    assert out["state"].endswith(".8765")


def test_begin_login_state_carries_the_actually_bound_port(config, monkeypatch):
    monkeypatch.setenv("COWORKER_PORT", "52341")
    out = cloud.begin_login(config)
    assert out["state"].endswith(".52341")


def test_complete_login_stores_tokens_and_account(secrets, config, monkeypatch):
    begun = cloud.begin_login(config)
    state = begun["state"]
    # The redirect_uri the authorize leg advertised — the exchange MUST send the same one
    # byte-for-byte (RFC 6749 §4.1.3). The 07-09 broker-bounce change updated only the
    # authorize leg and every real sign-in failed at the exchange; this pin would have
    # caught it.
    authorize_redirect = urllib.parse.parse_qs(
        urllib.parse.urlsplit(begun["authorize_url"]).query
    )["redirect_uri"][0]

    def fake_post(url, **kwargs):
        assert url == "https://tenant.auth0.test/oauth/token"
        assert kwargs["data"]["code_verifier"]
        assert kwargs["data"]["redirect_uri"] == authorize_redirect
        return FakeResponse(
            200, {"access_token": "at1", "refresh_token": "rt1", "expires_in": 3600}
        )

    def fake_get(url, **kwargs):
        # Connection restore is NOT part of complete_login (it runs in the
        # background from the /auth/callback route) — only /v1/me is hit here.
        assert url == "https://cloud.test/v1/me"
        return FakeResponse(200, {"user": {"email": "a@b.c", "user_id": "usr_1"}})

    monkeypatch.setattr(cloud.httpx, "post", fake_post)
    monkeypatch.setattr(cloud.httpx, "get", fake_get)

    result = cloud.complete_login(secrets, config, "code1", state)
    assert result["ok"] and result["signed_in"]
    assert result["account"] == "a@b.c"
    profile = secrets.get(cloud.CLOUD_AUTH_PROFILE)
    assert profile["access_token"] == "at1"
    assert profile["refresh_token"] == "rt1"


def test_complete_login_rejects_unknown_state(secrets, config):
    assert not cloud.complete_login(secrets, config, "code", "forged-state")["ok"]


# --- restore-on-sign-in: GET /v1/connections → local github install profiles -----


def _signed_in(secrets):
    secrets.put(
        cloud.CLOUD_AUTH_PROFILE,
        {"type": "oauth", "access_token": "at1", "expires": time.time() + 3600},
    )


def _github_connection_row(**meta_extra):
    return {
        "connection_id": "conn_7",
        "connector": "github",
        "provider": "github",
        "status": "connected",
        "tenant_metadata": {
            "installation_id": "101",
            "account_login": "acme",
            "github_login": "octocat",
            "installations": [
                {
                    "installation_id": "101",
                    "account_login": "acme",
                    "account_type": "Organization",
                    "repo_selection": "selected",
                },
                {
                    "installation_id": "202",
                    "account_login": "hooli",
                    "account_type": "User",
                    "repo_selection": "all",
                },
            ],
            **meta_extra,
        },
    }


def test_sync_connections_restores_github_installs(secrets, config, monkeypatch):
    """Gate: a fresh desktop rebuilds EVERY github install profile from the
    broker's metadata after sign-in — routing fields only, tokens mint on demand.
    Other connectors' rows (tokens local-only) and disconnected rows are ignored."""
    _signed_in(secrets)
    rows = [
        _github_connection_row(),
        {
            "connector": "slack",
            "status": "connected",
            "tenant_metadata": {"team_id": "T1"},
        },
        {
            "connector": "github",
            "status": "disconnected",
            "tenant_metadata": {"installation_id": "999", "github_login": "octocat"},
        },
    ]
    monkeypatch.setattr(
        cloud.httpx, "get", lambda url, **k: FakeResponse(200, {"connections": rows})
    )

    out = cloud.sync_connections(secrets, config)
    assert out["ok"] and out["restored"] == ["101", "202"]
    p = secrets.get("github:install:101")
    assert p["managed"] and p["account_login"] == "acme"
    assert p["github_login"] == "octocat" and p["connection_id"] == "conn_7"
    assert secrets.get("github:install:202")["repo_selection"] == "all"
    assert secrets.get("github:install:999") is None
    assert secrets.get("slack:default") is None
    default = secrets.get("github:default")
    assert default["mode"] == "relay" and default["default_install"] == "101"


def test_sync_connections_pre_restore_rows_fall_back_to_primary(
    secrets, config, monkeypatch
):
    """Rows written before the broker stored the installations list carry only
    the primary install in tenant_metadata — restore that one."""
    _signed_in(secrets)
    row = _github_connection_row()
    del row["tenant_metadata"]["installations"]
    monkeypatch.setattr(
        cloud.httpx, "get", lambda url, **k: FakeResponse(200, {"connections": [row]})
    )
    out = cloud.sync_connections(secrets, config)
    assert out["restored"] == ["101"]
    assert secrets.get("github:install:101")["account_login"] == "acme"


def test_sync_connections_requires_sign_in_and_survives_errors(
    secrets, config, monkeypatch
):
    assert not cloud.sync_connections(secrets, config)["ok"]  # signed out
    _signed_in(secrets)
    monkeypatch.setattr(cloud.httpx, "get", lambda url, **k: FakeResponse(503, {}))
    assert not cloud.sync_connections(secrets, config)["ok"]  # broker down → no crash


def test_logout_clears_session(secrets, config):
    secrets.put(cloud.CLOUD_AUTH_PROFILE, {"access_token": "x"})
    cloud.logout(secrets)
    assert cloud.status(secrets) == {"signed_in": False, "account": "", "user_id": ""}


# --- managed connect -------------------------------------------------------------


def test_every_managed_connector_has_a_provider_mapping():
    """A managed=True descriptor without a PROVIDER_FOR_CONNECTOR entry ships a
    dead one-click button ("X has no managed OAuth path") — outlook did exactly
    that. Wire the map in the same change that flips a connector to managed."""
    from coworker.connectors.descriptors import DESCRIPTORS

    managed = {d.name for d in DESCRIPTORS if d.managed}
    unmapped = managed - set(cloud.PROVIDER_FOR_CONNECTOR)
    assert (
        not unmapped
    ), f"managed connectors missing an OAuth provider: {sorted(unmapped)}"


def test_begin_managed_connect_requires_sign_in(secrets, config):
    out = cloud.begin_managed_connect(secrets, config, "gmail")
    assert not out["ok"]
    assert "not signed in" in out["error"]


def test_managed_profile_is_field_compatible_with_manual(secrets):
    form = {
        "provider": "google",
        "connector": "gmail",
        "connection_id": "conn_1",
        "access_token": "ya29.x",
        "refresh_token": "1//r",
        "expires_in": "3599",
        "scope": "gmail.readonly",
        "account": "a@b.c",
    }
    result = managed_connect_connector(
        secrets, "gmail", cloud.managed_profile_from_callback(form)
    )
    assert result["ok"] and result["account"] == "a@b.c"

    listed = {c["name"]: c for c in connector_list(secrets)}
    gmail = listed["gmail"]
    assert gmail["connected"] and gmail["managed"] and gmail["managed_profile"]
    # Multi-account era: listing migrates the tokens into the account profile.
    profile = secrets.get("gmail:account:a@b.c")
    assert profile["access_token"] == "ya29.x"  # same key manual paste writes
    assert profile["connection_id"] == "conn_1"
    assert gmail["accounts"][0]["email"] == "a@b.c" and gmail["accounts"][0]["default"]


def test_managed_connect_rejected_for_unmanaged_connector(secrets):
    # telegram is manual-only (github gained a managed path with the App relay)
    result = managed_connect_connector(secrets, "telegram", {"access_token": "x"})
    assert not result["ok"]


def test_managed_connect_redirect_follows_actual_port(secrets, config, monkeypatch):
    """The loopback redirect must target the sidecar's real bound port
    (COWORKER_PORT), not config.port — the packaged app runs on a random port,
    so an 8765 redirect would hit the wrong (or no) process."""
    secrets.put(cloud.CLOUD_AUTH_PROFILE, {"access_token": "at", "enabled": True})
    monkeypatch.setattr(cloud, "fresh_access_token", lambda *a, **k: "at")
    monkeypatch.setenv("COWORKER_PORT", "52854")  # e.g. what free_port() picked

    seen = {}

    def fake_post(url, **kwargs):
        seen["redirect"] = kwargs["json"]["redirect"]
        return FakeResponse(200, {"authorize_url": "https://slack/authorize?x=1"})

    monkeypatch.setattr(cloud.httpx, "post", fake_post)
    out = cloud.begin_managed_connect(secrets, config, "slack")
    assert out["ok"]
    assert seen["redirect"] == "http://127.0.0.1:52854/oauth/callback"  # not 8765


def test_manual_paste_still_works_and_is_not_managed(secrets):
    result = connect_connector(
        secrets, "gmail", {"access_token": "manual-token"}, validate=False
    )
    assert result["ok"]
    listed = {c["name"]: c for c in connector_list(secrets)}
    assert listed["gmail"]["connected"]
    assert not listed["gmail"]["managed_profile"]  # manual profile, managed capable
    assert listed["gmail"]["managed"]


# --- refresh ---------------------------------------------------------------------


def _signed_in(secrets):
    secrets.put(
        cloud.CLOUD_AUTH_PROFILE,
        {"access_token": "cloud-at", "expires": time.time() + 3600},
    )


def test_refresh_updates_expiring_managed_profile(secrets, config, monkeypatch):
    _signed_in(secrets)
    secrets.put(
        "gmail:default",
        {
            "type": "oauth",
            "managed": True,
            "provider": "google",
            "access_token": "old",
            "refresh_token": "1//r",
            "connection_id": "conn_1",
            "expires": time.time() - 10,
        },
    )

    def fake_post(url, **kwargs):
        assert url == "https://cloud.test/v1/oauth/google/refresh"
        assert kwargs["json"]["connection_id"] == "conn_1"
        return FakeResponse(200, {"access_token": "new", "expires_in": 3600})

    monkeypatch.setattr(cloud.httpx, "post", fake_post)
    cloud.ensure_fresh_connector_token(secrets, config, "gmail")
    assert secrets.get("gmail:default")["access_token"] == "new"


def test_refresh_never_touches_manual_profiles(secrets, config, monkeypatch):
    _signed_in(secrets)
    secrets.put("gmail:default", {"type": "oauth", "access_token": "manual"})

    def boom(url, **kwargs):  # any network call would be a bug
        raise AssertionError("manual profiles must not trigger cloud refresh")

    monkeypatch.setattr(cloud.httpx, "post", boom)
    cloud.ensure_fresh_connector_token(secrets, config, "gmail")
    assert secrets.get("gmail:default")["access_token"] == "manual"


def test_fresh_profile_not_refreshed(secrets, config, monkeypatch):
    _signed_in(secrets)
    secrets.put(
        "gmail:default",
        {
            "managed": True,
            "provider": "google",
            "access_token": "current",
            "refresh_token": "1//r",
            "expires": time.time() + 3600,
        },
    )
    monkeypatch.setattr(
        cloud.httpx, "post", lambda *a, **k: (_ for _ in ()).throw(AssertionError())
    )
    cloud.ensure_fresh_connector_token(secrets, config, "gmail")
    assert secrets.get("gmail:default")["access_token"] == "current"


# --- telemetry (Phase 5) ------------------------------------------------------


def test_install_id_stable_across_calls(secrets):
    first = cloud.install_id(secrets)
    assert first.startswith("ins_")
    assert cloud.install_id(secrets) == first


def test_emit_sends_nothing_signed_out(secrets, config, monkeypatch):
    def boom(*a, **k):  # any network call would violate the local-only promise
        raise AssertionError("signed-out users must send no telemetry")

    monkeypatch.setattr(cloud.httpx, "post", boom)
    assert (
        cloud.emit_session_created(
            secrets,
            config,
            session_id="s1",
            persona_id="sales",
            persona_family="knowledge",
            workspace_kind="deliverable",
        )
        is False
    )


def test_emit_sends_nothing_when_opted_out(secrets, config, monkeypatch):
    _signed_in(secrets)
    cloud.set_telemetry_enabled(secrets, False)
    monkeypatch.setattr(
        cloud.httpx, "post", lambda *a, **k: (_ for _ in ()).throw(AssertionError())
    )
    assert not cloud.emit_session_created(
        secrets,
        config,
        session_id="s1",
        persona_id="sales",
        persona_family="knowledge",
        workspace_kind="deliverable",
    )


def test_emit_is_content_free_and_hashes_session_id(secrets, config, monkeypatch):
    _signed_in(secrets)
    sent = {}

    def fake_post(url, **kwargs):
        sent["url"] = url
        sent["body"] = kwargs["json"]
        return FakeResponse(200, {"ok": True})

    monkeypatch.setattr(cloud.httpx, "post", fake_post)
    ok = cloud.emit_session_created(
        secrets,
        config,
        session_id="sess-secret-id",
        persona_id="sales",
        persona_family="knowledge",
        workspace_kind="deliverable",
    )
    assert ok
    assert sent["url"] == "https://cloud.test/v1/telemetry/events"
    body = sent["body"]
    assert body["event"] == "coworker_session_created"
    assert body["install_id"].startswith("ins_")
    assert "sess-secret-id" not in str(body)  # raw id never leaves the device
    assert body["session"]["session_id_hash"].startswith("sha256:")
    assert set(body["session"]) == {
        "session_id_hash",
        "persona_id",
        "persona_family",
        "workspace_kind",
    }


# --- gallery solo page ------------------------------------------------------


def test_gallery_detail_derives_capabilities_locally(secrets, config, monkeypatch):
    manifest_md = """---
id: sales
name: Sales Coworker
tools: [files, search, todo]
messaging: true
connectors: true
default_permission_mode: interactive
recommends:
  - connector: hubspot
    reason: read deals
    tier: core
---
You are the Sales Coworker."""

    def fake_get(s, c, path):
        if path.endswith("/manifest"):
            return {
                "slug": "sales",
                "manifest_markdown": manifest_md,
                "manifest_hash": "",
            }
        return {
            "slug": "sales",
            "name": "Sales Coworker",
            "pitch_markdown": "**pitch**",
        }

    monkeypatch.setattr(cloud, "_gallery_get", fake_get)
    out = cloud.gallery_detail(secrets, config, "sales")
    assert out["ok"]
    assert out["card"]["pitch_markdown"] == "**pitch**"
    caps = out["capabilities"]
    assert caps["tools"] == ["files", "search", "todo"]
    assert caps["messaging"] is True
    assert out["recommends"] == [
        {"kind": "connector", "ref": "hubspot", "reason": "read deals", "tier": "core"}
    ]


def test_gallery_detail_rejects_malformed_manifest(secrets, config, monkeypatch):
    def fake_get(s, c, path):
        if path.endswith("/manifest"):
            return {"slug": "bad", "manifest_markdown": "no frontmatter here"}
        return {"slug": "bad"}

    monkeypatch.setattr(cloud, "_gallery_get", fake_get)
    out = cloud.gallery_detail(secrets, config, "bad")
    assert not out["ok"]
    assert "validation" in out["error"]
