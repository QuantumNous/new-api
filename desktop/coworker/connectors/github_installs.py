"""Managed GitHub App installations: per-installation profiles + allow-lists.

`github:install:<installation_id>` holds ONE installation's routing metadata —
account_login (org/user the App is installed on), the connecting user's own
github_login, repo_selection, and that installation's inbound allow-list.
There is deliberately NO token field: API access runs on short-lived
installation tokens minted from the broker and cached in memory only
(github-relay-spec §4); the manual PAT path keeps living in `github:default`.

`github:default` doubles as the manual connector profile (token=PAT) and the
managed-relay switch (`mode="relay"`), exactly like Slack's default profile
carries Socket-Mode creds alongside the relay flag.
"""

from __future__ import annotations

from typing import Any

from ..secrets import SecretStore

PREFIX = "github:install:"
DEFAULT_KEY = "github:default"


def _norm(value: Any) -> str:
    return str(value or "").strip()


def list_installs(secrets: SecretStore) -> list[tuple[str, dict[str, Any]]]:
    """(installation_id, profile) for every connected installation."""
    out = []
    for meta in secrets.status():
        key = meta.get("profile", "")
        if key.startswith(PREFIX):
            out.append((key[len(PREFIX) :], secrets.get(key) or {}))
    return sorted(out, key=lambda t: t[0])


def default_install(secrets: SecretStore) -> str:
    installs = dict(list_installs(secrets))
    pointer = _norm((secrets.get(DEFAULT_KEY) or {}).get("default_install"))
    if pointer in installs:
        return pointer
    return next(iter(installs), "")


def resolve(
    secrets: SecretStore, install: str = ""
) -> tuple[str, dict[str, Any] | None]:
    """(installation_id, profile) for the requested — or default — installation.
    Accepts the id or the account login (what agents see in results)."""
    installs = list_installs(secrets)
    wanted = _norm(install) or default_install(secrets)
    for installation_id, profile in installs:
        if wanted and (
            installation_id == wanted or _norm(profile.get("account_login")) == wanted
        ):
            return installation_id, profile
    return "", None


def managed_connect_install(
    secrets: SecretStore, form: dict[str, Any]
) -> dict[str, Any]:
    """Store a managed GitHub App install from the broker's form-POST.

    Writes `github:install:<id>` (metadata only — the loopback POST carries no
    token by design) and flips `github:default` to relay mode so the gateway
    builds the GitHubRelayAdapter. A manual PAT in the default profile stays
    untouched. Re-install refreshes metadata, keeps the allow-list.
    """
    installation_id = _norm(form.get("installation_id"))
    if not installation_id:
        return {"ok": False, "error": "installation_id missing from callback"}
    existing = secrets.get(PREFIX + installation_id) or {}
    profile = {
        "type": "oauth",
        "managed": True,
        "installation_id": installation_id,
        "account_login": form.get("account_login", ""),
        "account_type": form.get("account_type", ""),
        "github_login": form.get("github_login", ""),
        "repo_selection": form.get("repo_selection", ""),
        "connection_id": form.get("connection_id", ""),
    }
    if existing.get("allowed_users"):
        profile["allowed_users"] = list(existing["allowed_users"])
    if existing.get("allow_all"):
        profile["allow_all"] = True
    secrets.put(PREFIX + installation_id, profile)
    default = secrets.get(DEFAULT_KEY) or {}
    default.update({"type": "oauth", "managed": True, "mode": "relay", "enabled": True})
    default.setdefault("default_install", installation_id)
    secrets.put(DEFAULT_KEY, default)
    return {
        "ok": True,
        "account": form.get("account_login") or installation_id,
        "installation_id": installation_id,
    }


def disconnect_install(secrets: SecretStore, installation_id: str) -> dict[str, Any]:
    """Drop one installation. The LAST removal turns relay mode off without
    resurrecting a stored manual PAT (the Slack last-workspace rule)."""
    installation_id = _norm(installation_id)
    if not secrets.get(PREFIX + installation_id):
        return {"ok": False, "error": "installation not connected"}
    secrets.delete(PREFIX + installation_id)
    remaining = [i for i, _ in list_installs(secrets)]
    default = secrets.get(DEFAULT_KEY) or {}
    if _norm(default.get("default_install")) == installation_id:
        default.pop("default_install", None)
        if remaining:
            default["default_install"] = remaining[0]
    if not remaining:
        # Relay off; a manual PAT (token) stays stored but disabled — the user
        # re-enables it explicitly, it never starts listening on its own.
        default.pop("mode", None)
        default["enabled"] = False
        if not any(default.get(k) for k in ("token", "access_token")):
            secrets.delete(DEFAULT_KEY)
            return {"ok": True, "remaining_installs": 0}
    secrets.put(DEFAULT_KEY, default)
    return {"ok": True, "remaining_installs": len(remaining)}
