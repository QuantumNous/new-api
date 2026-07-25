"""Connect / disconnect / list connectors — writes tokens to the SecretStore.

Pure functions over a SecretStore so they're testable without the server. `validate=False`
skips the network check (used by tests). Secrets are never returned — only status + the
public bot identity captured at connect time.
"""

from __future__ import annotations

from typing import Any

from ..secrets import SecretStore
from .catalog_copy import about_for, access_for
from .descriptors import get_descriptor, list_descriptors
from .tool_defs import patch_tool_settings, tool_dicts

_EXPERIMENTAL_KEY = "experimental:settings"


def experimental_enabled(secrets: SecretStore) -> bool:
    """Whether the user has opted in to experimental (use-at-your-own-risk) connectors."""
    return bool((secrets.get(_EXPERIMENTAL_KEY) or {}).get("enabled"))


def set_experimental_enabled(secrets: SecretStore, value: bool) -> dict[str, Any]:
    secrets.put(_EXPERIMENTAL_KEY, {"enabled": bool(value)})
    return {"ok": True, "enabled": bool(value)}


def _profile_connected(descriptor, profile: dict[str, Any]) -> bool:
    if not descriptor.available:
        return False
    if descriptor.auth == "none":
        return True
    # Managed relay (e.g. Slack cloud relay) carries no manual credential in the
    # :default profile — the tokens live per-team (slack:team:*). The relay-mode
    # flag is what marks it connected, so don't require the manual fields.
    if profile.get("mode") == "relay":
        return True
    required = [
        f.key for f in descriptor.fields if f.required and f.key != "allowed_users"
    ]
    return bool(profile) and all(bool(profile.get(k)) for k in required)


def _mcp_tokens_present(secrets: SecretStore, name: str) -> bool:
    # Lazy import: the mcp package pulls in the MCP SDK, which connector listing
    # shouldn't pay for unless an MCP-backed profile actually exists.
    from ..mcp.oauth import has_tokens

    return has_tokens(name, secrets)


def connector_list(secrets: SecretStore) -> list[dict[str, Any]]:
    show_experimental = experimental_enabled(secrets)
    out: list[dict[str, Any]] = []
    for d in list_descriptors():
        # Experimental connectors are invisible (not just disabled) until the user opts in;
        # hiding them here also drops their tools from engine builds via
        # _enabled_connector_tools, so flipping the setting off cuts access immediately.
        if d.experimental and not show_experimental:
            continue
        profile = secrets.get(f"{d.name}:default") or {}
        if d.mcp_url and profile.get("mode") == "mcp":
            # MCP-backed connect: the profile is just a marker — connected-ness
            # lives with the OAuth tokens (mcp-oauth:<name> in the SecretStore).
            connected = _mcp_tokens_present(secrets, d.name)
        else:
            connected = _profile_connected(d, profile)
        entry = {
            "name": d.name,
            "title": d.title,
            "icon": d.icon,
            "blurb": d.blurb,
            # Pre-connect detail page copy (UX-DECISIONS §38): About paragraph
            # (may be empty → GUI omits the group) + honest Access bullets.
            "about": about_for(d.name),
            "access": access_for(d.name),
            "auth": d.auth,
            "two_way": d.two_way,
            "channels": d.channels,
            "available": d.available,
            "brand_color": d.brand_color,
            "logo": d.logo,
            "aliases": list(d.aliases),
            # MCP-backed one-click (vendor-hosted MCP server + local OAuth) —
            # distinct from `managed` (broker OAuth): no cloud sign-in needed.
            "mcp": bool(d.mcp_url),
            "fields": [f.to_dict() for f in d.fields],
            "instructions": d.instructions,
            "connected": connected,
            "account": profile.get("account"),
            "enabled": bool(profile.get("enabled", True)) and connected,
            # The actual allow-list (the GUI manages it inline); was a bare count.
            "allowed_users": list(profile.get("allowed_users") or []),
            "tools": tool_dicts(secrets, d.name),
            "experimental": d.experimental,
            "risk_notice": d.risk_notice,
            "managed": d.managed,
            "managed_paused": d.managed_paused,
            # Whether THIS profile came from managed OAuth (vs manual paste).
            "managed_profile": bool(profile.get("managed")),
            # "relay" for the managed cloud path; empty for manual/token connect.
            "mode": profile.get("mode") or "",
        }
        if d.name == "slack":
            # Managed relay is multi-workspace: each `slack:team:*` profile is one
            # connected workspace with its OWN allow-list (ids are workspace-scoped).
            entry["workspaces"] = _slack_workspaces(secrets)
        if d.name == "gmail":
            # Multi-account: each `gmail:account:*` profile is one mailbox; the
            # :default profile is just the default pointer + privacy filters.
            from . import gmail_accounts

            accounts = _gmail_account_list(secrets)
            default_email = gmail_accounts.default_account(secrets)
            entry["accounts"] = accounts
            entry["connected"] = bool(accounts)
            entry["enabled"] = bool(profile.get("enabled", True)) and bool(accounts)
            entry["account"] = default_email or None
            entry["managed_profile"] = any(
                a["email"] == default_email and a["managed"] for a in accounts
            )
            entry["filters"] = gmail_accounts.get_filters(secrets)
        if d.name == "google_calendar":
            # Multi-account, same shape as gmail: each `google_calendar:account:*`
            # profile is one Google account; :default is just the default pointer.
            from . import gcal_accounts

            accounts = _gcal_account_list(secrets)
            default_email = gcal_accounts.default_account(secrets)
            entry["accounts"] = accounts
            entry["connected"] = bool(accounts)
            entry["enabled"] = bool(profile.get("enabled", True)) and bool(accounts)
            entry["account"] = default_email or None
            entry["managed_profile"] = any(
                a["email"] == default_email and a["managed"] for a in accounts
            )
        if d.name == "github":
            # Managed relay is multi-installation: each `github:install:*`
            # profile is one App installation with its OWN allow-list of
            # sender logins. The manual PAT path stays on the default profile.
            entry["installations"] = _github_installations(secrets)
            if entry["installations"] and profile.get("mode") == "relay":
                first = entry["installations"][0]
                entry["account"] = entry["account"] or first["account_login"]
        if d.account_field:
            # Generic multi-account (batch-2 connectors): each
            # `<name>:account:*` profile is one account; :default is pointer-only.
            from . import accounts as _accounts

            rows = _accounts.account_rows(secrets, d.name)
            default_id = _accounts.default_account(secrets, d.name)
            entry["accounts"] = rows
            entry["connected"] = bool(rows)
            entry["enabled"] = bool(profile.get("enabled", True)) and bool(rows)
            default_row = next((r for r in rows if r["account_id"] == default_id), None)
            entry["account"] = (default_row or {}).get("name") or None
            entry["managed_profile"] = bool((default_row or {}).get("managed"))
        if d.name == "hubspot":
            # Multi-portal: each `hubspot:portal:*` profile is one portal; the
            # :default profile is the default pointer + hidden-fields policy.
            from . import hubspot_portals

            portals = _hubspot_portal_list(secrets)
            default_hub = hubspot_portals.default_portal(secrets)
            entry["portals"] = portals
            entry["connected"] = bool(portals)
            entry["enabled"] = bool(profile.get("enabled", True)) and bool(portals)
            default_row = next((p for p in portals if p["hub_id"] == default_hub), None)
            entry["account"] = (default_row or {}).get("name") or None
            entry["managed_profile"] = bool((default_row or {}).get("managed"))
            entry["hidden_fields"] = hubspot_portals.get_hidden_fields(secrets)
        out.append(entry)
    return out


def _slack_workspaces(secrets: SecretStore) -> list[dict[str, Any]]:
    from .config import _slack_team_profiles

    return [
        {
            "team_id": team_id,
            "account": profile.get("account") or team_id,
            "domain": profile.get("domain") or "",
            "allowed_users": list(profile.get("allowed_users") or []),
            "allow_all": bool(profile.get("allow_all")),
            # Who installed (authed_user) — the GUI marks their chip "you" and
            # keys the post-connect card's "your mentions get through" line.
            "installer_user_id": profile.get("slack_user_id") or "",
            "installer_name": profile.get("sender_name") or "",
        }
        for team_id, profile in sorted(
            _slack_team_profiles(secrets), key=lambda t: t[0]
        )
    ]


def _github_installations(secrets: SecretStore) -> list[dict[str, Any]]:
    from .github_installs import list_installs

    return [
        {
            "installation_id": installation_id,
            "account_login": profile.get("account_login") or installation_id,
            "account_type": profile.get("account_type") or "",
            "repo_selection": profile.get("repo_selection") or "",
            "github_login": profile.get("github_login") or "",
            "allowed_users": list(profile.get("allowed_users") or []),
            "allow_all": bool(profile.get("allow_all")),
        }
        for installation_id, profile in list_installs(secrets)
    ]


def _gmail_account_list(secrets: SecretStore) -> list[dict[str, Any]]:
    from time import time

    from . import gmail_accounts

    default = gmail_accounts.default_account(secrets)
    out = []
    for email, profile in gmail_accounts.list_accounts(secrets):
        expires = float(profile.get("expires") or 0)
        out.append(
            {
                "email": email,
                "default": email == default,
                "managed": bool(profile.get("managed")),
                "scopes": profile.get("scope") or "",
                # Expired with no way to renew silently → the GUI offers Reauthorize.
                "needs_reauth": bool(
                    expires and expires < time() and not profile.get("refresh_token")
                ),
            }
        )
    return out


def _gcal_account_list(secrets: SecretStore) -> list[dict[str, Any]]:
    from time import time

    from . import gcal_accounts

    default = gcal_accounts.default_account(secrets)
    out = []
    for email, profile in gcal_accounts.list_accounts(secrets):
        expires = float(profile.get("expires") or 0)
        out.append(
            {
                "email": email,
                "default": email == default,
                "managed": bool(profile.get("managed")),
                "scopes": profile.get("scope") or "",
                # Expired with no way to renew silently → the GUI offers Reauthorize.
                "needs_reauth": bool(
                    expires and expires < time() and not profile.get("refresh_token")
                ),
            }
        )
    return out


def _hubspot_portal_list(secrets: SecretStore) -> list[dict[str, Any]]:
    from . import hubspot_portals

    default = hubspot_portals.default_portal(secrets)
    out = []
    for hub_id, profile in hubspot_portals.list_portals(secrets):
        scope = str(profile.get("scope") or "")
        out.append(
            {
                "hub_id": hub_id,
                "name": profile.get("account") or f"portal {hub_id}",
                "sandbox": bool(profile.get("sandbox")),
                "default": hub_id == default,
                "managed": bool(profile.get("managed")),
                # Consent tier granted at connect: managed profiles reveal it in
                # their scope grant; a manual private-app token doesn't say.
                "access": (".write" in scope and "write") or (scope and "read") or "",
            }
        )
    return out


def update_connector_tools(
    secrets: SecretStore, name: str, enabled: dict[str, Any]
) -> dict[str, Any]:
    if get_descriptor(name) is None:
        return {"ok": False, "error": "unknown connector"}
    return patch_tool_settings(secrets, name, enabled)


def connect_connector(
    secrets: SecretStore,
    name: str,
    fields: dict[str, Any],
    *,
    validate: bool = True,
    acknowledged: bool = False,
) -> dict[str, Any]:
    d = get_descriptor(name)
    if d is None or not d.available:
        return {"ok": False, "error": "unknown or unavailable connector"}
    if d.experimental:
        if not experimental_enabled(secrets):
            return {"ok": False, "error": "experimental connectors are disabled"}
        if not acknowledged:
            return {
                "ok": False,
                "error": "risk acknowledgment required",
                "risk_notice": d.risk_notice,
            }

    # Reconnect-safe: never let a re-submit clobber a stored secret. The GUI masks a connected
    # connector's secret fields (it shows the placeholder, e.g. `xoxb-…`), so a blank — or
    # mask-equal — submission means "keep what's stored", not "overwrite with the mask". (This is
    # the bug that reset a real token down to its 6-char placeholder.)
    existing = secrets.get(f"{name}:default") or {}

    def _resolved(f) -> str:
        v = str(fields.get(f.key) or "").strip()
        if f.key == "allowed_users":
            return v  # a list in storage / CSV in the form — handled separately below
        if not v or (f.secret and v == (f.placeholder or "").strip()):
            return str(existing.get(f.key) or "").strip()
        return v

    raw = {f.key: _resolved(f) for f in d.fields}
    missing = [f.label for f in d.fields if f.required and not raw.get(f.key)]
    if missing:
        return {"ok": False, "error": "missing: " + ", ".join(missing)}

    allowed = sorted(
        {u.strip() for u in raw.get("allowed_users", "").split(",") if u.strip()}
    )
    if not allowed and existing.get("allowed_users"):
        allowed = list(
            existing["allowed_users"]
        )  # don't wipe the live allow-list on reconnect
    token_creds = {k: v for k, v in raw.items() if k != "allowed_users" and v}

    identity = None
    if validate and d.validate is not None:
        result = d.validate(token_creds)
        if not result.ok:
            return {"ok": False, "error": result.error or "validation failed"}
        identity = result.identity

    profile_type = (
        "oauth" if d.auth == "oauth" else "none" if d.auth == "none" else "token"
    )
    profile: dict[str, Any] = {"type": profile_type, "enabled": True, **token_creds}
    if any(f.key == "allowed_users" for f in d.fields):
        profile["allowed_users"] = allowed
    if identity:
        profile["account"] = identity
    if d.account_field:
        # Account-patterned connector: connecting ADDS an account (a second
        # submit with different creds is a second account, not an overwrite).
        from . import accounts as _accounts

        account_id = _accounts.derive_account_id(d, profile)
        result = _accounts.add_account(secrets, name, account_id, profile)
        if not result.get("ok"):
            return result
        return {"ok": True, "account": identity or account_id, "account_id": account_id}
    secrets.put(f"{name}:default", profile)
    return {"ok": True, "account": identity}


def managed_connect_connector(
    secrets: SecretStore, name: str, profile: dict[str, Any]
) -> dict[str, Any]:
    """Store a profile produced by managed OAuth (cloud.managed_profile_from_callback).

    Field-compatible with a manual connect for the same connector, so tools and
    session gating can't tell the paths apart; preserves an existing allow-list
    on reconnect just like the manual path does.
    """
    d = get_descriptor(name)
    if d is None or not d.available:
        return {"ok": False, "error": "unknown or unavailable connector"}
    if not d.managed:
        return {"ok": False, "error": f"{name} does not support managed connect"}
    if d.account_field:
        from . import accounts as _accounts

        account_id = _accounts.derive_account_id(d, profile)
        result = _accounts.add_account(secrets, name, account_id, profile)
        if not result.get("ok"):
            return result
        return {
            "ok": True,
            "account": profile.get("account") or account_id,
            "account_id": account_id,
        }
    existing = secrets.get(f"{name}:default") or {}
    if existing.get("allowed_users"):
        profile = {**profile, "allowed_users": list(existing["allowed_users"])}
    secrets.put(f"{name}:default", profile)
    return {"ok": True, "account": profile.get("account") or None}


def managed_connect_slack_install(
    secrets: SecretStore, form: dict[str, Any]
) -> dict[str, Any]:
    """Store a managed Slack install (relay mode) from the broker's form-POST.

    Slack managed install is multi-workspace and inbound-via-relay, so unlike a
    single-token connector it writes:
    - `slack:team:<team_id>` — that workspace's bot token + bot_user_id (used for
      replies and to ignore the bot's own posts);
    - `slack:default` flipped to `mode="relay"` so the gateway builds the
      `SlackRelayAdapter` (Socket Mode's manual bot_token/app_token untouched if
      the user later switches back). Existing allow-list preserved.
    """
    team_id = form.get("team_id", "")
    bot_token = form.get("access_token", "")
    if not team_id or not bot_token:
        return {"ok": False, "error": "missing team_id or bot token"}
    # A reinstall replaces the token but must not reset authorization state.
    existing = secrets.get(f"slack:team:{team_id}") or {}
    allowed = set(existing.get("allowed_users") or [])
    installer = form.get("slack_user_id", "")
    if installer:
        # Pre-add the installer (UX-027): connecting the workspace is consent to
        # talk to your own bot — without this, the connector's very first mention
        # comes from the installer and parks.
        allowed.add(installer)
    secrets.put(
        f"slack:team:{team_id}",
        {
            "type": "oauth",
            "managed": True,
            "bot_token": bot_token,
            "bot_user_id": form.get("bot_user_id", ""),
            # The INSTALLER's Slack member id (authed_user) — who this workspace's
            # outbound posts speak for (attribution.py resolves + caches the name).
            "slack_user_id": installer,
            "team_id": team_id,
            "account": form.get("account", ""),
            # The workspace's slack.com subdomain (broker resolves it via auth.test)
            # — the unique human handle when two workspaces share a display name.
            "domain": form.get("team_domain", ""),
            "scope": form.get("scope", ""),
            "connection_id": form.get("connection_id", ""),
            "allowed_users": sorted(allowed),
            "allow_all": bool(existing.get("allow_all")),
            "sender_name": existing.get("sender_name", ""),
        },
    )
    default = secrets.get("slack:default") or {}
    default.update({"type": "oauth", "managed": True, "mode": "relay", "enabled": True})
    secrets.put("slack:default", default)
    return {"ok": True, "account": form.get("account") or team_id}


def disconnect_connector(secrets: SecretStore, name: str) -> dict[str, Any]:
    dropped_accounts = False
    from . import accounts as _accounts

    if _accounts.is_account_connector(name):
        for account_id, _profile in _accounts.list_accounts(secrets, name):
            dropped_accounts = (
                secrets.delete(_accounts.prefix(name) + account_id) or dropped_accounts
            )
    if name == "gmail":
        # Whole-connector disconnect drops every mailbox (per-account removal
        # lives on the Gmail page); filters go too — an explicit full reset.
        from . import gmail_accounts

        for email, _profile in gmail_accounts.list_accounts(secrets):
            dropped_accounts = (
                secrets.delete(gmail_accounts.PREFIX + email) or dropped_accounts
            )
    if name == "google_calendar":
        from . import gcal_accounts

        for email, _profile in gcal_accounts.list_accounts(secrets):
            dropped_accounts = (
                secrets.delete(gcal_accounts.PREFIX + email) or dropped_accounts
            )
    if name == "hubspot":
        from . import hubspot_portals

        for hub_id, _profile in hubspot_portals.list_portals(secrets):
            dropped_accounts = (
                secrets.delete(hubspot_portals.PREFIX + hub_id) or dropped_accounts
            )
    if name == "github":
        from . import github_installs

        for installation_id, _profile in github_installs.list_installs(secrets):
            dropped_accounts = (
                secrets.delete(github_installs.PREFIX + installation_id)
                or dropped_accounts
            )
    profile = secrets.get(f"{name}:default") or {}
    if profile.get("mode") == "mcp":
        # MCP-backed connect: forget the OAuth tokens + DCR registration and remove
        # the seeded server entry, so a reconnect runs a fresh flow.
        from ..mcp import config as mcp_config
        from ..mcp import oauth as mcp_oauth

        dropped_accounts = mcp_oauth.sign_out(name, secrets) or dropped_accounts
        mcp_config.delete_global_server(name)
    return {"ok": secrets.delete(f"{name}:default") or dropped_accounts}
