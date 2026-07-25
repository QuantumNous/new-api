"""Multi-account Google Calendar: per-account token profiles.

`google_calendar:account:<email>` holds ONE signed-in Google account's tokens
(managed OAuth and manual paste are field-compatible, mirroring the
single-account era). Once accounts exist, `google_calendar:default` carries no
tokens — just the default-account pointer and the enabled flag.

A legacy token-bearing `google_calendar:default` (pre-multi-account) is
migrated lazily into an account profile on first list/tool use — no user
action. Same shape as gmail_accounts, minus the privacy filters (calendar has
no "Never show agents" policy yet).
"""

from __future__ import annotations

from typing import Any, Optional

from ..secrets import SecretStore

PREFIX = "google_calendar:account:"
DEFAULT_KEY = "google_calendar:default"


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def migrate_legacy_default(secrets: SecretStore) -> None:
    """Rewrite a token-bearing `google_calendar:default` as one account profile.
    Idempotent; keyed by the account email captured at connect time ("default"
    if unknown)."""
    default = secrets.get(DEFAULT_KEY) or {}
    if not default.get("access_token"):
        return
    email = _norm(default.get("account")) or "default"
    account = {k: v for k, v in default.items() if k != "default_account"}
    account.setdefault("account", email)
    secrets.put(PREFIX + email, account)
    secrets.put(
        DEFAULT_KEY,
        {
            "type": "oauth",
            "enabled": bool(default.get("enabled", True)),
            "default_account": _norm(default.get("default_account")) or email,
        },
    )


def list_accounts(secrets: SecretStore) -> list[tuple[str, dict[str, Any]]]:
    """(email, profile) for every connected account, migration included."""
    migrate_legacy_default(secrets)
    out = []
    for meta in secrets.status():
        key = meta.get("profile", "")
        if key.startswith(PREFIX):
            out.append((key[len(PREFIX) :], secrets.get(key) or {}))
    return sorted(out, key=lambda t: t[0])


def default_account(secrets: SecretStore) -> str:
    """The default account email: the stored pointer if it still exists, else
    the first connected account, else ""."""
    accounts = dict(list_accounts(secrets))
    pointer = _norm((secrets.get(DEFAULT_KEY) or {}).get("default_account"))
    if pointer in accounts:
        return pointer
    return next(iter(accounts), "")


def resolve(
    secrets: SecretStore, account: str = ""
) -> tuple[str, str, Optional[dict[str, Any]]]:
    """(email, profile_key, profile) for the requested — or default — account.
    Profile is None when nothing matches (not connected / unknown account)."""
    email = _norm(account) or default_account(secrets)
    if not email:
        return "", "", None
    key = PREFIX + email
    return email, key, secrets.get(key)


def managed_connect_account(
    secrets: SecretStore, profile: dict[str, Any]
) -> dict[str, Any]:
    """Store one managed-OAuth account; the first connected account becomes the
    default. Reconnecting an email replaces its tokens in place."""
    migrate_legacy_default(secrets)
    email = _norm(profile.get("account"))
    if not email:
        return {"ok": False, "error": "google account email missing from callback"}
    secrets.put(PREFIX + email, profile)
    pointer = secrets.get(DEFAULT_KEY) or {}
    pointer.setdefault("default_account", email)
    pointer.update({"type": "oauth", "enabled": True})
    secrets.put(DEFAULT_KEY, pointer)
    return {"ok": True, "account": email}


def set_default(secrets: SecretStore, email: str) -> dict[str, Any]:
    email = _norm(email)
    if not secrets.get(PREFIX + email):
        return {"ok": False, "error": "account not connected"}
    pointer = secrets.get(DEFAULT_KEY) or {}
    pointer["default_account"] = email
    pointer.setdefault("type", "oauth")
    pointer.setdefault("enabled", True)
    secrets.put(DEFAULT_KEY, pointer)
    return {"ok": True, "default_account": email}


def disconnect_account(secrets: SecretStore, email: str) -> dict[str, Any]:
    """Drop one account. The default pointer moves to the next account; removing
    the last account removes the pointer profile too (no account-wide policy to
    preserve, unlike gmail's filters)."""
    email = _norm(email)
    if not secrets.get(PREFIX + email):
        return {"ok": False, "error": "account not connected"}
    secrets.delete(PREFIX + email)
    remaining = [e for e, _ in list_accounts(secrets)]
    if remaining:
        pointer = secrets.get(DEFAULT_KEY) or {}
        if _norm(pointer.get("default_account")) == email:
            pointer["default_account"] = remaining[0]
            secrets.put(DEFAULT_KEY, pointer)
    else:
        secrets.delete(DEFAULT_KEY)
    return {"ok": True, "remaining_accounts": len(remaining)}
