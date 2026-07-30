"""OpenWorker Cloud client: sign-in and managed one-click connectors.

Everything here is OPTIONAL. The app is fully functional signed out — manual
token paste stays available for every connector (and remains available after
sign-in too). Cloud sign-in only unlocks the one-click managed OAuth path and
the metadata conveniences that come with it.

Flows (ported from the proven `ocw_cli` reference in opencoworker-cloud):

- Sign-in: BoxAI Authorization Code + PKCE. The sidecar registers the PKCE
  challenge, the browser signs in, and BoxAI redirects to the sidecar's loopback
  `GET /auth/callback`, and the code is exchanged here. Cloud session tokens
  live in the SecretStore under `cloud:auth`.
- Managed connect: authenticated `POST /v1/oauth/{provider}/start` returns the
  provider authorize URL; the broker's callback page form-POSTs the token
  payload to the sidecar's loopback `POST /oauth/callback`; the profile is
  written locally. Connector tokens never touch cloud storage.
- Refresh: managed profiles (they have refresh_token + connection_id) renew
  through the broker just before expiry; manual profiles are never touched.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets as _secrets
import threading
import time
import urllib.parse
from typing import Any, Optional

import httpx

from .config import Config
from .secrets import SecretStore

CLOUD_AUTH_PROFILE = "cloud:auth"
LOGIN_SCOPES = "openid profile email offline_access"
DESKTOP_CLIENT_ID = "boxai-desktop"

from . import __version__ as APP_VERSION  # noqa: E402

# connector id (canonical, = descriptor name) -> broker provider key
PROVIDER_FOR_CONNECTOR = {
    "gmail": "google",
    "google_calendar": "google",
    "google_drive": "google",
    "slack": "slack",
    "notion": "notion",
    "attio": "attio",
    "hubspot": "hubspot",
    "github": "github",
    "outlook": "microsoft",
}

# Pending PKCE verifiers keyed by OAuth state; in-process only. A login that
# outlives the sidecar process simply has to be restarted.
_pending_logins: dict[str, dict[str, float | str]] = {}
_PENDING_TTL = 600
_pending_managed_states: dict[str, float] = {}
_MANAGED_STATE_TTL = 600
_refresh_lock = threading.Lock()


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _now() -> float:
    return time.time()


# --- sign-in -----------------------------------------------------------------


def begin_login(config: Config) -> dict[str, Any]:
    """Create a PKCE login and return the browser URL. The sidecar's
    GET /auth/callback completes it.

    BoxAI records the exact random-port loopback redirect in the short-lived
    authorization request. State is independent random data and never carries
    routing information.
    """
    verifier = _b64url(_secrets.token_bytes(48))
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    port = os.environ.get("COWORKER_PORT") or config.port
    state = _secrets.token_urlsafe(32)
    redirect_uri = f"http://127.0.0.1:{port}/auth/callback"

    for key, pending in list(_pending_logins.items()):  # expire stale attempts
        if float(pending["created"]) < _now() - _PENDING_TTL:
            _pending_logins.pop(key, None)
    _pending_logins[state] = {
        "verifier": verifier, "redirect_uri": redirect_uri,
        "state": state, "created": _now(),
    }
    resp = httpx.post(
        config.boxai_base_url.rstrip("/") + "/api/desktop/authorization-requests",
        json={"client_id": DESKTOP_CLIENT_ID, "redirect_uri": redirect_uri,
              "code_challenge": challenge, "code_challenge_method": "S256",
              "state": state, "client_name": "BoxAI Desktop"}, timeout=15,
    )
    resp.raise_for_status()
    request_id = str(resp.json().get("id") or "")
    if not request_id or len(request_id) > 256:
        _pending_logins.pop(state, None)
        raise ValueError("invalid authorization request response")
    authorize_url = (
        config.boxai_web_base_url.rstrip("/")
        + "/desktop/authorize?request="
        + urllib.parse.quote(request_id, safe="")
    )
    return {"authorize_url": authorize_url, "state": state}


def complete_login(
    secrets: SecretStore, config: Config, code: str, state: str
) -> dict[str, Any]:
    if not code or len(code) > 4096 or not state or len(state) > 256:
        return {"ok": False, "error": "invalid sign-in callback"}
    pending = _pending_logins.pop(state, None)
    if pending is None or float(pending["created"]) < _now() - _PENDING_TTL:
        return {"ok": False, "error": "unknown or expired sign-in attempt"}

    resp = httpx.post(
        config.boxai_base_url.rstrip("/") + "/api/desktop/token",
        json={
            "grant_type": "authorization_code",
            "client_id": DESKTOP_CLIENT_ID,
            "code": code,
            "code_verifier": pending["verifier"],
            "redirect_uri": pending["redirect_uri"],
        },
        timeout=15,
    )
    if resp.status_code != 200:
        return {"ok": False, "error": "token exchange failed"}
    _store_cloud_tokens(secrets, resp.json())

    # Connection restore (sync_connections) deliberately does NOT run here: it is
    # best-effort metadata work, and doing it inline held the browser's "Signed in"
    # page + the GUI's signed-in flip hostage to an extra broker round trip (slow
    # sign-in complaint, 2026-07-16). The /auth/callback route kicks it off in the
    # background after responding.
    return {"ok": True, **status(secrets)}


def consume_login_error(state: str) -> bool:
    """Validate and consume an authorization error callback."""
    if not state or len(state) > 256:
        return False
    pending = _pending_logins.pop(state, None)
    return pending is not None and float(pending["created"]) >= _now() - _PENDING_TTL


def sync_connections(secrets: SecretStore, config: Config) -> dict[str, Any]:
    """Rebuild local managed-connection state from the broker's metadata rows
    (GET /v1/connections) after a cloud sign-in.

    Only GitHub restores fully on a fresh install: its rows are routing metadata
    (installation ids + logins) and installation tokens mint on demand — nothing
    secret ever needs to live here. Every other connector's tokens are local-only
    by design, so those need a one-click re-consent instead."""
    token = fresh_access_token(secrets, config)
    if not token:
        return {"ok": False, "error": "not signed in"}
    try:
        resp = httpx.get(
            config.cloud_base_url.rstrip("/") + "/v1/connections",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
    except httpx.HTTPError:
        return {"ok": False, "error": "cloud unreachable"}
    if resp.status_code != 200:
        return {"ok": False, "error": f"connections fetch failed ({resp.status_code})"}

    from .connectors.github_installs import managed_connect_install

    restored: list[str] = []
    for row in resp.json().get("connections", []):
        if row.get("connector") != "github" or row.get("status") != "connected":
            continue
        meta = row.get("tenant_metadata") or {}
        installs = meta.get("installations") or []
        if not installs and meta.get("installation_id"):
            installs = [meta]  # pre-restore-era rows carry only the primary install
        for inst in installs:
            out = managed_connect_install(
                secrets,
                {
                    "installation_id": str(inst.get("installation_id") or ""),
                    "account_login": inst.get("account_login", ""),
                    "account_type": inst.get("account_type", ""),
                    "repo_selection": inst.get("repo_selection", ""),
                    "github_login": meta.get("github_login", ""),
                    "connection_id": row.get("connection_id", ""),
                },
            )
            if out.get("ok"):
                restored.append(out["installation_id"])
    return {"ok": True, "restored": restored}


def _store_cloud_tokens(secrets: SecretStore, token: dict) -> None:
    profile = secrets.get(CLOUD_AUTH_PROFILE) or {"type": "oauth", "enabled": True}
    profile["access_token"] = token.get("access_token", "")
    profile["api_key"] = token.get("api_key", profile.get("api_key", ""))
    profile["base_url"] = token.get("base_url", profile.get("base_url", ""))
    if token.get("refresh_token"):  # rotating refresh tokens: keep the newest
        profile["refresh_token"] = token["refresh_token"]
    profile["expires"] = _now() + int(token.get("expires_in") or 3600) - 60
    # JWT claims are display hints only; signature validation remains the server's job.
    try:
        payload = str(profile["access_token"]).split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        profile["account"] = str(claims.get("email") or claims.get("preferred_username") or "")[:320]
        profile["user_id"] = str(claims.get("sub") or "")[:256]
    except (ValueError, KeyError, json.JSONDecodeError):
        pass
    secrets.put(CLOUD_AUTH_PROFILE, profile)


def status(secrets: SecretStore) -> dict[str, Any]:
    profile = secrets.get(CLOUD_AUTH_PROFILE) or {}
    return {
        "signed_in": bool(profile.get("access_token")),
        "account": profile.get("account") or "",
        "user_id": profile.get("user_id") or "",
    }


def logout(secrets: SecretStore, config: Optional[Config] = None) -> dict[str, Any]:
    with _refresh_lock:
        profile = secrets.get(CLOUD_AUTH_PROFILE) or {}
        if config and profile.get("refresh_token"):
            try:
                response = httpx.post(
                    config.boxai_base_url.rstrip("/") + "/api/desktop/revoke",
                    json={"refresh_token": profile["refresh_token"], "client_id": DESKTOP_CLIENT_ID},
                    timeout=10,
                )
            except httpx.HTTPError as exc:
                return {"ok": False, "signed_in": True, "error": f"sign-out failed: {type(exc).__name__}"}
            if not 200 <= response.status_code < 300:
                return {"ok": False, "signed_in": True, "error": f"sign-out failed ({response.status_code})"}
        secrets.delete(CLOUD_AUTH_PROFILE)
        return {"ok": True, "signed_in": False}


def fresh_access_token(secrets: SecretStore, config: Config) -> Optional[str]:
    """Valid cloud session token, silently refreshed near expiry; None when
    signed out or the session can't be renewed (GUI shows "sign in again")."""
    profile = secrets.get(CLOUD_AUTH_PROFILE) or {}
    if not profile.get("access_token"):
        return None
    if float(profile.get("expires") or 0) > _now():
        return profile["access_token"]
    with _refresh_lock:
        # Another request may have completed rotation while this one waited.
        profile = secrets.get(CLOUD_AUTH_PROFILE) or {}
        if not profile.get("access_token"):
            return None
        if float(profile.get("expires") or 0) > _now():
            return profile["access_token"]
        if not profile.get("refresh_token"):
            return None
        resp = httpx.post(
            config.boxai_base_url.rstrip("/") + "/api/desktop/refresh",
            json={
                "grant_type": "refresh_token",
                "client_id": DESKTOP_CLIENT_ID,
                "refresh_token": profile["refresh_token"],
            },
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        _store_cloud_tokens(secrets, resp.json())
        return (secrets.get(CLOUD_AUTH_PROFILE) or {}).get("access_token")


def fetch_me(secrets: SecretStore, config: Config) -> Optional[dict]:
    """Compatibility accessor for callers that still expect a cloud profile response."""
    profile = secrets.get(CLOUD_AUTH_PROFILE) or {}
    if not fresh_access_token(secrets, config):
        return None
    return {"user": {"email": profile.get("account", ""), "user_id": profile.get("user_id", "")}}


# --- telemetry (Phase 5) ---------------------------------------------------------
# One sentence: which coworker type was started and when — nothing else. Signed-in
# users only, default-on with an opt-out; signed out (or opted out) sends NOTHING.
# Never sent: titles, prompts, outputs, tool args, file paths, connector content.

TELEMETRY_PROFILE = "cloud:telemetry"


def install_id(secrets: SecretStore) -> str:
    """Stable random per-install id, minted on first use (spec Phase 5)."""
    profile = secrets.get(TELEMETRY_PROFILE) or {}
    if not profile.get("install_id"):
        profile["install_id"] = "ins_" + _secrets.token_hex(12)
        secrets.put(TELEMETRY_PROFILE, profile)
    return profile["install_id"]


def telemetry_enabled(secrets: SecretStore) -> bool:
    profile = secrets.get(TELEMETRY_PROFILE) or {}
    return bool(profile.get("enabled", True))  # default-on (only matters signed in)


def set_telemetry_enabled(secrets: SecretStore, enabled: bool) -> dict[str, Any]:
    profile = secrets.get(TELEMETRY_PROFILE) or {}
    profile["enabled"] = bool(enabled)
    secrets.put(TELEMETRY_PROFILE, profile)
    return {"ok": True, "telemetry_enabled": bool(enabled)}


def emit_session_created(
    secrets: SecretStore,
    config: Config,
    *,
    session_id: str,
    persona_id: str,
    persona_family: str,
    workspace_kind: str,
) -> bool:
    """Best-effort, content-free session event. Hard no-op unless signed in AND
    the toggle is on; failures are swallowed (telemetry must never break a session)."""
    import platform as _platform
    import sys

    if not telemetry_enabled(secrets):
        return False
    token = fresh_access_token(secrets, config)
    if not token:
        return False  # signed out: local-only users send nothing, by design
    body = {
        "event": "coworker_session_created",
        "install_id": install_id(secrets),
        "app_version": APP_VERSION,
        "platform": {"darwin": "macos", "win32": "windows"}.get(
            sys.platform, _platform.system().lower() or "unknown"
        ),
        "session": {
            "session_id_hash": "sha256:"
            + hashlib.sha256(session_id.encode()).hexdigest(),
            "persona_id": persona_id,
            "persona_family": persona_family,
            "workspace_kind": workspace_kind,
        },
    }
    try:
        resp = httpx.post(
            config.cloud_base_url.rstrip("/") + "/v1/telemetry/events",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        return resp.status_code == 200
    except httpx.HTTPError:
        return False


# --- managed connectors --------------------------------------------------------


def begin_managed_connect(
    secrets: SecretStore,
    config: Config,
    connector: str,
    *,
    access: str = "",
    flow: str = "",
) -> dict[str, Any]:
    """Authenticated start: returns the provider consent URL for the browser.
    Requires sign-in — the manual token path stays available regardless.
    `access` names a broker-defined consent tier (hubspot read | write); the
    desktop never sends scopes. `flow` is GitHub-only: "" = the App install
    page; "authorize" links a teammate to an existing installation."""
    provider = PROVIDER_FOR_CONNECTOR.get(connector)
    if provider is None:
        return {"ok": False, "error": f"{connector} has no managed OAuth path"}
    token = fresh_access_token(secrets, config)
    if not token:
        return {"ok": False, "error": "not signed in", "signed_in": False}

    app_state = _secrets.token_urlsafe(16)
    # The broker form-POSTs the tokens back to THIS process's loopback. Use the
    # actually-bound port (published by run.py), falling back to config.port —
    # the packaged app runs the sidecar on a random port, not 8765.
    port = os.environ.get("COWORKER_PORT") or config.port
    try:
        resp = httpx.post(
            config.cloud_base_url.rstrip("/") + f"/v1/oauth/{provider}/start",
            json={
                "connector": connector,
                "redirect": f"http://127.0.0.1:{port}/oauth/callback",
                "app_state": app_state,
                **({"access": access} if access else {}),
                **({"flow": flow} if flow else {}),
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
    except httpx.HTTPError as exc:
        return {"ok": False, "error": f"cloud unreachable: {type(exc).__name__}"}
    if resp.status_code != 200:
        return {"ok": False, "error": f"start failed ({resp.status_code})"}
    _pending_managed_states[app_state] = _now()
    return {
        "ok": True,
        "authorize_url": resp.json()["authorize_url"],
        "app_state": app_state,
    }


def consume_managed_state(state: str) -> bool:
    """Consume one recent managed-OAuth callback state exactly once."""
    if not state:
        return False
    created = _pending_managed_states.pop(state, None)
    return created is not None and created >= _now() - _MANAGED_STATE_TTL


def managed_profile_from_callback(form: dict[str, str]) -> dict[str, Any]:
    """Local connector profile from the broker's form-POST payload.

    Field-compatible with a manual paste (`access_token` etc.) so tools and
    gating treat both paths identically; the managed extras (refresh_token,
    connection_id) are what enable broker refresh and cloud disconnect.
    """
    profile = {
        "type": "oauth",
        "enabled": True,
        "managed": True,
        "access_token": form.get("access_token", ""),
        "refresh_token": form.get("refresh_token", ""),
        "scope": form.get("scope", ""),
        "connection_id": form.get("connection_id", ""),
        "provider": form.get("provider", ""),
        "account": form.get("account", ""),
    }
    if form.get("account_id"):
        # The stable id behind the display name (workspace/portal id) — what
        # the generic accounts layer keys multi-account profiles by.
        profile["account_id"] = form["account_id"]
    if form.get("expires_in"):  # absent ⇒ non-expiring token (e.g. Slack bot tokens)
        profile["expires"] = _now() + int(form["expires_in"]) - 60
    return profile


def refresh_managed_token(
    secrets: SecretStore,
    config: Config,
    connector: str,
    *,
    profile_key: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Renew a managed connector token through the broker. Returns the updated
    profile, or None if this profile can't be (or doesn't need to be) renewed
    that way. Manual profiles are never touched. `profile_key` targets an
    account-keyed profile (`gmail:account:<email>`); default = `<name>:default`."""
    key = profile_key or f"{connector}:default"
    profile = secrets.get(key) or {}
    if not (profile.get("managed") and profile.get("refresh_token")):
        return None
    provider = profile.get("provider") or PROVIDER_FOR_CONNECTOR.get(connector)
    token = fresh_access_token(secrets, config)
    if not provider or not token:
        return None
    try:
        resp = httpx.post(
            config.cloud_base_url.rstrip("/") + f"/v1/oauth/{provider}/refresh",
            json={
                "refresh_token": profile["refresh_token"],
                "connection_id": profile.get("connection_id", ""),
                "connector": connector,
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    fresh = resp.json()
    profile["access_token"] = fresh.get("access_token", "")
    if fresh.get("refresh_token"):
        profile["refresh_token"] = fresh["refresh_token"]
    profile["expires"] = _now() + int(fresh.get("expires_in") or 3600) - 60
    secrets.put(key, profile)
    return profile


def ensure_fresh_connector_token(
    secrets: SecretStore,
    config: Config,
    connector: str,
    *,
    profile_key: Optional[str] = None,
    leeway: int = 120,
) -> None:
    """Refresh-on-expiry hook for connector tools: if this is a managed profile
    about to expire, renew it in place. No-op for manual profiles."""
    key = profile_key or f"{connector}:default"
    profile = secrets.get(key) or {}
    if not profile.get("managed"):
        return
    expires = float(profile.get("expires") or 0)
    if expires and expires > _now() + leeway:
        return
    refresh_managed_token(secrets, config, connector, profile_key=profile_key)


def cloud_disconnect(
    secrets: SecretStore,
    config: Config,
    connector: str,
    *,
    profile_key: Optional[str] = None,
) -> None:
    """Best-effort: tell the cloud a managed connection is gone so its metadata
    flips to disconnected. Local deletion always proceeds regardless."""
    profile = secrets.get(profile_key or f"{connector}:default") or {}
    connection_id = profile.get("connection_id")
    if not (profile.get("managed") and connection_id):
        return
    token = fresh_access_token(secrets, config)
    if not token:
        return
    try:
        httpx.post(
            config.cloud_base_url.rstrip("/")
            + f"/v1/connections/{connection_id}/disconnect",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.HTTPError:
        pass


# installation_id -> (token, expires_epoch). MEMORY ONLY by design: GitHub
# installation tokens live ~1 h and are re-minted from the broker; they must
# never touch the secret store (github-relay-spec §4).
_GITHUB_TOKEN_CACHE: dict[str, tuple[str, float]] = {}
_GITHUB_TOKEN_LEEWAY = 600  # re-mint when < 10 min of life remains


def github_installation_token(
    secrets: SecretStore, config: Config, installation_id: str, *, force: bool = False
) -> str:
    """A live installation access token for GitHub API calls, minted via the
    authenticated broker route and cached in memory (~50 min). `force` skips
    the cache — the 401 retry path. Empty string when unavailable (signed
    out / revoked installation / cloud unreachable)."""
    installation_id = str(installation_id or "").strip()
    if not installation_id:
        return ""
    if not force:
        cached = _GITHUB_TOKEN_CACHE.get(installation_id)
        if cached and cached[1] > _now() + _GITHUB_TOKEN_LEEWAY:
            return cached[0]
    token = fresh_access_token(secrets, config)
    if not token:
        return ""
    try:
        resp = httpx.post(
            config.cloud_base_url.rstrip("/") + "/v1/github/token",
            json={"installation_id": installation_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
    except httpx.HTTPError:
        return ""
    if resp.status_code != 200:
        return ""
    body = resp.json()
    minted = body.get("token", "")
    # expires_at is ISO-8601 from GitHub; parse defensively, default 1 h.
    expires = _now() + 3600
    try:
        from datetime import datetime

        raw = str(body.get("expires_at", ""))
        if raw:
            expires = datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
    except ValueError:
        pass
    if minted:
        _GITHUB_TOKEN_CACHE[installation_id] = (minted, expires)
    return minted


def clear_github_token(installation_id: str) -> None:
    """Drop a cached installation token (disconnect / revocation)."""
    _GITHUB_TOKEN_CACHE.pop(str(installation_id or "").strip(), None)


def github_disconnect_installation(
    secrets: SecretStore, config: Config, installation_id: str
) -> None:
    """Best-effort: delete this user's relay routing rows for one installation
    so the cloud stops pushing its events. Local profile deletion always
    proceeds regardless (the row only routes)."""
    clear_github_token(installation_id)
    token = fresh_access_token(secrets, config)
    if not token:
        return
    try:
        httpx.post(
            config.cloud_base_url.rstrip("/") + "/v1/relay/github/disconnect",
            json={"installation_id": installation_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.HTTPError:
        pass


def slack_disconnect_workspace(
    secrets: SecretStore, config: Config, team_id: str
) -> None:
    """Best-effort: delete this user's relay routing row for one workspace so the
    cloud stops pushing its events. Local token deletion always proceeds regardless
    (the row only routes; without the desktop token nothing can be sent anyway)."""
    token = fresh_access_token(secrets, config)
    if not token:
        return
    try:
        httpx.post(
            config.cloud_base_url.rstrip("/") + "/v1/relay/slack/uninstall",
            json={"team_id": team_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.HTTPError:
        pass


# --- persona gallery -----------------------------------------------------------


def _gallery_get(secrets: SecretStore, config: Config, path: str) -> Optional[dict]:
    token = fresh_access_token(secrets, config)
    if not token:
        return None
    try:
        resp = httpx.get(
            config.cloud_base_url.rstrip("/") + path,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
    except httpx.HTTPError:
        return None
    return resp.json() if resp.status_code == 200 else None


def gallery_list(secrets: SecretStore, config: Config) -> Optional[dict]:
    """Curated persona cards visible to this user's tenant; None when signed
    out or the cloud is unreachable (gallery requires sign-in by design)."""
    return _gallery_get(secrets, config, "/v1/personas/gallery")


def gallery_manifest(secrets: SecretStore, config: Config, slug: str) -> Optional[dict]:
    return _gallery_get(secrets, config, f"/v1/personas/gallery/{slug}/manifest")


def gallery_install_event(secrets: SecretStore, config: Config, slug: str) -> None:
    """Best-effort product telemetry (slug/version only, no content)."""
    token = fresh_access_token(secrets, config)
    if not token:
        return
    try:
        httpx.post(
            config.cloud_base_url.rstrip("/")
            + f"/v1/personas/gallery/{slug}/install-events",
            json={"platform": __import__("sys").platform},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.HTTPError:
        pass


def gallery_detail(secrets: SecretStore, config: Config, slug: str) -> Optional[dict]:
    """Solo-page payload: the cloud card + publisher pitch, with capability
    facts derived LOCALLY from the manifest via the desktop's own strict
    parser — the pitch can never advertise what install-time consent wouldn't
    show, because both views come from the same parsed manifest."""
    card = _gallery_get(secrets, config, f"/v1/personas/gallery/{slug}")
    manifest = gallery_manifest(secrets, config, slug)
    if card is None or manifest is None:
        return None
    try:
        from .personas.loading import consent_summary
        from .personas.manifest import parse_manifest

        m = parse_manifest(manifest.get("manifest_markdown", ""), fallback_id=slug)
        capabilities = consent_summary(m)
        recommends = [
            {"kind": r.kind, "ref": r.ref, "reason": r.reason, "tier": r.tier}
            for r in m.recommends
        ]
    except Exception as exc:  # malformed manifest: surface, don't crash
        return {"ok": False, "error": f"manifest failed local validation: {exc}"}
    return {
        "ok": True,
        "card": card,
        "capabilities": capabilities,
        "recommends": recommends,
    }
