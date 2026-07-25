"""Multi-account Gmail: per-mailbox profiles + the "Never show agents" filters.

`gmail:account:<email>` holds ONE signed-in mailbox's tokens (managed OAuth and
manual paste are field-compatible, mirroring the single-account era). Once
accounts exist, `gmail:default` carries no tokens — just the default-account
pointer, the enabled flag, and the privacy filters (which are account-wide).

A legacy token-bearing `gmail:default` (pre-multi-account) is migrated lazily
into an account profile on first list/tool use — no user action.

Filters are enforced in the gmail TOOL layer on this desktop ("cloud knows
routing; the desktop knows content and policy"): matching messages are
silently omitted from agent-visible results — no tombstone the agent could
reason about — while the user sees the hidden count on the tool card and an
audit row (rule + count, never content).
"""

from __future__ import annotations

from typing import Any, Optional

from ..secrets import SecretStore

PREFIX = "gmail:account:"
DEFAULT_KEY = "gmail:default"


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def migrate_legacy_default(secrets: SecretStore) -> None:
    """Rewrite a token-bearing `gmail:default` as one account profile. Idempotent;
    keyed by the account email captured at connect time ("default" if unknown)."""
    default = secrets.get(DEFAULT_KEY) or {}
    if not default.get("access_token"):
        return
    email = _norm(default.get("account")) or "default"
    account = {
        k: v for k, v in default.items() if k not in ("default_account", "filters")
    }
    account.setdefault("account", email)
    secrets.put(PREFIX + email, account)
    pointer: dict[str, Any] = {
        "type": "oauth",
        "enabled": bool(default.get("enabled", True)),
        "default_account": _norm(default.get("default_account")) or email,
    }
    if default.get("filters"):
        pointer["filters"] = default["filters"]
    secrets.put(DEFAULT_KEY, pointer)


def list_accounts(secrets: SecretStore) -> list[tuple[str, dict[str, Any]]]:
    """(email, profile) for every connected mailbox, migration included."""
    migrate_legacy_default(secrets)
    out = []
    for meta in secrets.status():
        key = meta.get("profile", "")
        if key.startswith(PREFIX):
            out.append((key[len(PREFIX) :], secrets.get(key) or {}))
    return sorted(out, key=lambda t: t[0])


def default_account(secrets: SecretStore) -> str:
    """The default mailbox email: the stored pointer if it still exists, else the
    first connected account, else ""."""
    accounts = dict(list_accounts(secrets))
    pointer = _norm((secrets.get(DEFAULT_KEY) or {}).get("default_account"))
    if pointer in accounts:
        return pointer
    return next(iter(accounts), "")


def resolve(
    secrets: SecretStore, account: str = ""
) -> tuple[str, str, Optional[dict[str, Any]]]:
    """(email, profile_key, profile) for the requested — or default — mailbox.
    Profile is None when nothing matches (not connected / unknown account)."""
    email = _norm(account) or default_account(secrets)
    if not email:
        return "", "", None
    key = PREFIX + email
    return email, key, secrets.get(key)


def managed_connect_account(
    secrets: SecretStore, profile: dict[str, Any]
) -> dict[str, Any]:
    """Store one managed-OAuth mailbox; the first connected account becomes the
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
    """Drop one mailbox. The default pointer moves to the next account; removing
    the last account keeps the filters (they're policy, not credentials) unless
    there are none, in which case the pointer profile goes too."""
    email = _norm(email)
    if not secrets.get(PREFIX + email):
        return {"ok": False, "error": "account not connected"}
    secrets.delete(PREFIX + email)
    remaining = [e for e, _ in list_accounts(secrets)]
    pointer = secrets.get(DEFAULT_KEY) or {}
    if _norm(pointer.get("default_account")) == email:
        if remaining:
            pointer["default_account"] = remaining[0]
            secrets.put(DEFAULT_KEY, pointer)
        else:
            pointer.pop("default_account", None)
            pointer.pop("managed", None)
            if pointer.get("filters"):
                secrets.put(DEFAULT_KEY, pointer)
            else:
                secrets.delete(DEFAULT_KEY)
    return {"ok": True, "remaining_accounts": len(remaining)}


# --- "Never show agents" filters ---------------------------------------------


def get_filters(secrets: SecretStore) -> dict[str, list[str]]:
    f = (secrets.get(DEFAULT_KEY) or {}).get("filters") or {}
    return {
        "senders": list(f.get("senders") or []),
        "labels": list(f.get("labels") or []),
    }


def set_filters(
    secrets: SecretStore,
    senders: Optional[list[str]] = None,
    labels: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Replace either list (None = leave unchanged). Senders are `addr@x` or
    `@domain`; labels are Gmail label names (matched case-insensitively)."""
    current = get_filters(secrets)
    if senders is not None:
        current["senders"] = sorted({_norm(s) for s in senders if _norm(s)})
    if labels is not None:
        current["labels"] = sorted({str(l).strip() for l in labels if str(l).strip()})
    pointer = secrets.get(DEFAULT_KEY) or {}
    pointer["filters"] = current
    pointer.setdefault("type", "oauth")
    pointer.setdefault("enabled", True)
    secrets.put(DEFAULT_KEY, pointer)
    return {"ok": True, "filters": current}


def sender_matches(address: str, rules: list[str]) -> bool:
    """`addr@x.com` = exact; `@domain.com` = that domain (suffix on the addr)."""
    address = _norm(address)
    if not address:
        return False
    for rule in rules:
        rule = _norm(rule)
        if not rule:
            continue
        if rule.startswith("@"):
            if address.endswith(rule):
                return True
        elif address == rule:
            return True
    return False
