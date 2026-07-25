"""Multi-portal HubSpot: per-portal profiles + the hidden-fields denylist.

`hubspot:portal:<hub_id>` holds ONE portal's credentials — managed OAuth and a
manual private-app token are field-compatible (both carry `token`). Once
portals exist, `hubspot:default` carries no tokens: just the default-portal
pointer, the enabled flag, and `hidden_fields` (portal-wide policy).

A legacy token-bearing `hubspot:default` (single-portal era) is migrated
lazily; its hub_id is parsed from the "portal <id>" identity captured at
connect time.

Hidden fields are enforced in the hubspot TOOL layer on this desktop: the
named properties are stripped from every record an agent reads. This hides
data from the MODEL — it is not an ACL against humans (HubSpot permission
sets are; UX-DECISIONS §21). Stripped-field counts go to the audit log.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from ..secrets import SecretStore

PREFIX = "hubspot:portal:"
DEFAULT_KEY = "hubspot:default"


def _norm(value: Any) -> str:
    return str(value or "").strip()


def migrate_legacy_default(secrets: SecretStore) -> None:
    """Rewrite a token-bearing `hubspot:default` as one portal profile.
    Idempotent; keyed by the hub id when the stored identity reveals it."""
    default = secrets.get(DEFAULT_KEY) or {}
    if not (default.get("token") or default.get("access_token")):
        return
    match = re.search(r"\d+", str(default.get("account") or ""))
    hub_id = match.group(0) if match else "default"
    portal = {
        k: v for k, v in default.items() if k not in ("default_portal", "hidden_fields")
    }
    portal.setdefault("hub_id", hub_id)
    secrets.put(PREFIX + hub_id, portal)
    pointer: dict[str, Any] = {
        "type": "oauth",
        "enabled": bool(default.get("enabled", True)),
        "default_portal": _norm(default.get("default_portal")) or hub_id,
    }
    if default.get("hidden_fields"):
        pointer["hidden_fields"] = default["hidden_fields"]
    secrets.put(DEFAULT_KEY, pointer)


def list_portals(secrets: SecretStore) -> list[tuple[str, dict[str, Any]]]:
    """(hub_id, profile) for every connected portal, migration included."""
    migrate_legacy_default(secrets)
    out = []
    for meta in secrets.status():
        key = meta.get("profile", "")
        if key.startswith(PREFIX):
            out.append((key[len(PREFIX) :], secrets.get(key) or {}))
    return sorted(out, key=lambda t: t[0])


def default_portal(secrets: SecretStore) -> str:
    portals = dict(list_portals(secrets))
    pointer = _norm((secrets.get(DEFAULT_KEY) or {}).get("default_portal"))
    if pointer in portals:
        return pointer
    return next(iter(portals), "")


def resolve(
    secrets: SecretStore, portal: str = ""
) -> tuple[str, str, Optional[dict[str, Any]]]:
    """(hub_id, profile_key, profile) for the requested — or default — portal.
    `portal` may be a hub id or a portal name (account) — names are what agents
    see in results, so accept both."""
    portals = list_portals(secrets)
    wanted = _norm(portal)
    if not wanted:
        wanted = default_portal(secrets)
    for hub_id, profile in portals:
        if wanted and (hub_id == wanted or _norm(profile.get("account")) == wanted):
            return hub_id, PREFIX + hub_id, profile
    return "", "", None


def managed_connect_portal(
    secrets: SecretStore, profile: dict[str, Any]
) -> dict[str, Any]:
    """Store one managed-OAuth portal; the first becomes the default.
    Reconnecting the same hub_id replaces its tokens (e.g. a read → write
    re-consent lands in place)."""
    migrate_legacy_default(secrets)
    hub_id = _norm(profile.get("hub_id"))
    if not hub_id:
        return {"ok": False, "error": "hub_id missing from callback"}
    secrets.put(PREFIX + hub_id, profile)
    pointer = secrets.get(DEFAULT_KEY) or {}
    pointer.setdefault("default_portal", hub_id)
    pointer.update({"type": "oauth", "enabled": True})
    secrets.put(DEFAULT_KEY, pointer)
    return {"ok": True, "account": profile.get("account") or hub_id, "hub_id": hub_id}


def set_default(secrets: SecretStore, hub_id: str) -> dict[str, Any]:
    hub_id = _norm(hub_id)
    if not secrets.get(PREFIX + hub_id):
        return {"ok": False, "error": "portal not connected"}
    pointer = secrets.get(DEFAULT_KEY) or {}
    pointer["default_portal"] = hub_id
    pointer.setdefault("type", "oauth")
    pointer.setdefault("enabled", True)
    secrets.put(DEFAULT_KEY, pointer)
    return {"ok": True, "default_portal": hub_id}


def disconnect_portal(secrets: SecretStore, hub_id: str) -> dict[str, Any]:
    """Drop one portal; the default pointer moves on. Removing the last portal
    keeps hidden_fields (policy, not credentials) unless there are none."""
    hub_id = _norm(hub_id)
    if not secrets.get(PREFIX + hub_id):
        return {"ok": False, "error": "portal not connected"}
    secrets.delete(PREFIX + hub_id)
    remaining = [h for h, _ in list_portals(secrets)]
    pointer = secrets.get(DEFAULT_KEY) or {}
    if _norm(pointer.get("default_portal")) == hub_id:
        if remaining:
            pointer["default_portal"] = remaining[0]
            secrets.put(DEFAULT_KEY, pointer)
        else:
            pointer.pop("default_portal", None)
            if pointer.get("hidden_fields"):
                secrets.put(DEFAULT_KEY, pointer)
            else:
                secrets.delete(DEFAULT_KEY)
    return {"ok": True, "remaining_portals": len(remaining)}


# --- hidden fields (model-facing denylist, not a human ACL) --------------------


def get_hidden_fields(secrets: SecretStore) -> list[str]:
    return list((secrets.get(DEFAULT_KEY) or {}).get("hidden_fields") or [])


def set_hidden_fields(secrets: SecretStore, fields: list[str]) -> dict[str, Any]:
    cleaned = sorted({str(f).strip().lower() for f in fields if str(f).strip()})
    pointer = secrets.get(DEFAULT_KEY) or {}
    pointer["hidden_fields"] = cleaned
    pointer.setdefault("type", "oauth")
    pointer.setdefault("enabled", True)
    secrets.put(DEFAULT_KEY, pointer)
    return {"ok": True, "hidden_fields": cleaned}


def strip_hidden(record: Any, hidden: list[str]) -> tuple[Any, int]:
    """Remove denylisted property keys from a CRM record (or a search page of
    records), case-insensitively. Returns (cleaned, number of values removed)."""
    if not hidden:
        return record, 0
    wanted = {h.lower() for h in hidden}
    removed = 0

    def _clean_obj(obj: dict[str, Any]) -> dict[str, Any]:
        nonlocal removed
        out = dict(obj)
        props = out.get("properties")
        if isinstance(props, dict):
            kept = {}
            for k, v in props.items():
                if k.lower() in wanted:
                    removed += 1
                else:
                    kept[k] = v
            out["properties"] = kept
        return out

    if isinstance(record, dict):
        if isinstance(record.get("results"), list):  # a search page
            out = dict(record)
            out["results"] = [
                _clean_obj(r) if isinstance(r, dict) else r for r in record["results"]
            ]
            return out, removed
        return _clean_obj(record), removed
    return record, 0
