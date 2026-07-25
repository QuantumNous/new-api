"""Generic multi-account profiles — one layer for every new connector.

Slack, Gmail, Calendar, and HubSpot each grew a bespoke accounts module;
this is the same proven shape (per-account token profiles at
`<connector>:account:<id>`, a token-free `<connector>:default` holding only
the default-account pointer + connector-wide flags, lazy migration of a
legacy token-bearing default) parameterized by connector so batch-2
connectors (notion, attio, posthog, …) — and eventually the bespoke four —
share one implementation.

A connector opts in by setting `account_field` on its descriptor: the creds
field that names an account (e.g. "project_id"), or the sentinel
`"@identity"` = the identity string its validator returned (e.g. the account
email). Everything downstream (connect path, connector_list, generic
account routes, the accounts GUI) keys off that.
"""

from __future__ import annotations

from typing import Any, Optional

from ..secrets import SecretStore
from .descriptors import ConnectorDescriptor, get_descriptor

IDENTITY = "@identity"


def prefix(connector: str) -> str:
    return f"{connector}:account:"


def default_key(connector: str) -> str:
    return f"{connector}:default"


def _norm(value: Any) -> str:
    # Emails want case-folding; UUIDs/numeric ids are unaffected by it.
    return str(value or "").strip().lower()


def is_account_connector(name: str) -> bool:
    d = get_descriptor(name)
    return bool(d and d.account_field)


def derive_account_id(d: ConnectorDescriptor, profile: dict[str, Any]) -> str:
    """The stable id naming this account: the designated creds field, or the
    validator identity (stored as `account` at connect time). "default" only
    when neither exists — never fails, so migration can't strand a profile."""
    if d.account_field and d.account_field != IDENTITY:
        return (
            _norm(profile.get(d.account_field))
            or _norm(profile.get("account"))
            or "default"
        )
    return _norm(profile.get("account")) or "default"


def migrate_legacy_default(secrets: SecretStore, connector: str) -> None:
    """Rewrite a credential-bearing `<connector>:default` (from a build predating
    the account layer) as one account profile. Idempotent."""
    d = get_descriptor(connector)
    if d is None:
        return
    default = secrets.get(default_key(connector)) or {}
    cred_keys = [f.key for f in d.fields if f.key != "allowed_users"]
    if not any(default.get(k) for k in cred_keys):
        return
    account_id = derive_account_id(d, default)
    account = {k: v for k, v in default.items() if k != "default_account"}
    account.setdefault("account", account_id)
    secrets.put(prefix(connector) + account_id, account)
    secrets.put(
        default_key(connector),
        {
            "type": default.get("type") or "token",
            "enabled": bool(default.get("enabled", True)),
            "default_account": _norm(default.get("default_account")) or account_id,
        },
    )


def list_accounts(
    secrets: SecretStore, connector: str
) -> list[tuple[str, dict[str, Any]]]:
    """(account_id, profile) for every connected account, migration included."""
    migrate_legacy_default(secrets, connector)
    pre = prefix(connector)
    out = []
    for meta in secrets.status():
        key = meta.get("profile", "")
        if key.startswith(pre):
            out.append((key[len(pre) :], secrets.get(key) or {}))
    return sorted(out, key=lambda t: t[0])


def default_account(secrets: SecretStore, connector: str) -> str:
    """The default account id: the stored pointer if it still exists, else the
    first connected account, else ""."""
    accounts = dict(list_accounts(secrets, connector))
    pointer = _norm((secrets.get(default_key(connector)) or {}).get("default_account"))
    if pointer in accounts:
        return pointer
    return next(iter(accounts), "")


def resolve(
    secrets: SecretStore, connector: str, account: str = ""
) -> tuple[str, str, Optional[dict[str, Any]]]:
    """(account_id, profile_key, profile) for the requested — or default —
    account. Profile is None when nothing matches."""
    account_id = _norm(account) or default_account(secrets, connector)
    if not account_id:
        return "", "", None
    key = prefix(connector) + account_id
    return account_id, key, secrets.get(key)


def add_account(
    secrets: SecretStore, connector: str, account_id: str, profile: dict[str, Any]
) -> dict[str, Any]:
    """Store one account (manual connect and managed OAuth both land here); the
    first connected account becomes the default. Re-adding an id replaces its
    credentials in place."""
    migrate_legacy_default(secrets, connector)
    account_id = _norm(account_id)
    if not account_id:
        return {"ok": False, "error": "account id missing"}
    secrets.put(prefix(connector) + account_id, profile)
    pointer = secrets.get(default_key(connector)) or {}
    pointer.setdefault("default_account", account_id)
    pointer.setdefault("type", profile.get("type") or "token")
    pointer["enabled"] = bool(pointer.get("enabled", True))
    secrets.put(default_key(connector), pointer)
    return {"ok": True, "account": account_id}


def set_default(
    secrets: SecretStore, connector: str, account_id: str
) -> dict[str, Any]:
    account_id = _norm(account_id)
    if not secrets.get(prefix(connector) + account_id):
        return {"ok": False, "error": "account not connected"}
    pointer = secrets.get(default_key(connector)) or {}
    pointer["default_account"] = account_id
    pointer.setdefault("type", "token")
    pointer.setdefault("enabled", True)
    secrets.put(default_key(connector), pointer)
    return {"ok": True, "default_account": account_id}


def disconnect_account(
    secrets: SecretStore, connector: str, account_id: str
) -> dict[str, Any]:
    """Drop one account. The default pointer moves to the next account; removing
    the last account removes the pointer profile too."""
    account_id = _norm(account_id)
    if not secrets.get(prefix(connector) + account_id):
        return {"ok": False, "error": "account not connected"}
    secrets.delete(prefix(connector) + account_id)
    remaining = [a for a, _ in list_accounts(secrets, connector)]
    if remaining:
        pointer = secrets.get(default_key(connector)) or {}
        if _norm(pointer.get("default_account")) == account_id:
            pointer["default_account"] = remaining[0]
            secrets.put(default_key(connector), pointer)
    else:
        secrets.delete(default_key(connector))
    return {"ok": True, "remaining_accounts": len(remaining)}


def account_rows(secrets: SecretStore, connector: str) -> list[dict[str, Any]]:
    """connector_list's `accounts` field: id, display name, default/managed
    flags. Display name = the identity captured at connect (else the id)."""
    default = default_account(secrets, connector)
    return [
        {
            "account_id": account_id,
            "name": str(profile.get("account") or account_id),
            "default": account_id == default,
            "managed": bool(profile.get("managed")),
        }
        for account_id, profile in list_accounts(secrets, connector)
    ]
