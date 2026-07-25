"""Workspace rosters for the Slack pickers (people + channels).

Backs "find your name in a list" instead of the park→approve-only flow, and
channel-by-name instead of pasted IDs. Pure reads on scopes every install
already granted (`users:read`, `channels:read`, `groups:read`) — no consent
bump, and the roster never leaves this machine (in-memory cache, not the
SecretStore; names/ids are routing metadata, not content).

Slack API notes: `users.list` is Tier-2 (~20 req/min) and Slack's own guidance
is to cache it — one paginated sweep per workspace per TTL, filtered locally.
Private channels only appear where the bot is a MEMBER (API constraint — the
GUI words it honestly); public channels carry `is_member` so the picker can
hint "invite @OpenWorker in Slack" instead of silently failing to listen.
"""

from __future__ import annotations

import os
import time
from typing import Any, Optional

from ..secrets import SecretStore

_TTL = 900.0  # 15 min — rosters drift slowly; a Refresh affordance can force it
# users.list: Slack recommends ≤200/page. conversations.list allows 1000 — use it:
# the cold sweep is user-visible latency (a big workspace took ~11 s at 200/page).
_PAGE_LIMIT = 200
_CHANNEL_PAGE_LIMIT = 999
_MAX_PAGES = 25  # caps both sweeps — beyond that, type more letters

# (team_id, kind) → (fetched_at, rows). Module-level on purpose: survives
# request handlers but not the process — nothing roster-shaped is persisted.
_CACHE: dict[tuple[str, str], tuple[float, list[dict[str, Any]]]] = {}


def _api_base() -> str:
    return os.environ.get("SLACK_API_URL", "https://slack.com/api/")


def _bot_token(secrets: SecretStore, team_id: str) -> str:
    """The workspace's bot token: per-team profile (managed relay) or the flat
    default profile (manual Socket Mode — team_id "default")."""
    if team_id and team_id != "default":
        profile = secrets.get(f"slack:team:{team_id}") or {}
        if profile.get("bot_token"):
            return str(profile["bot_token"])
    return str((secrets.get("slack:default") or {}).get("bot_token") or "")


def _get_pages(
    token: str,
    method: str,
    params: dict[str, Any],
    key: str,
    page_limit: int = _PAGE_LIMIT,
) -> list[dict]:
    """Cursor-paginated GET; raises RuntimeError with Slack's error string."""
    import httpx

    rows: list[dict] = []
    cursor = ""
    for _ in range(_MAX_PAGES):
        q = {**params, "limit": page_limit}
        if cursor:
            q["cursor"] = cursor
        resp = httpx.get(
            _api_base() + method,
            params=q,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30.0,
        )
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(str(data.get("error") or f"{method} failed"))
        rows.extend(data.get(key) or [])
        cursor = (data.get("response_metadata") or {}).get("next_cursor") or ""
        if not cursor:
            break
    return rows


def _cached(team_id: str, kind: str, fetch, refresh: bool) -> list[dict[str, Any]]:
    now = time.time()
    hit = _CACHE.get((team_id, kind))
    if hit and not refresh and now - hit[0] < _TTL:
        return hit[1]
    rows = fetch()
    _CACHE[(team_id, kind)] = (now, rows)
    return rows


def _rank(rows: list[dict], query: str, key: str, limit: int) -> list[dict]:
    """Case-insensitive substring filter; prefix matches first, then alpha."""
    q = query.strip().lower()
    if q:
        rows = [
            r for r in rows if q in r[key].lower() or q in r.get("handle", "").lower()
        ]
    rows = sorted(
        rows, key=lambda r: (not r[key].lower().startswith(q), r[key].lower())
    )
    return rows[: max(1, min(int(limit or 25), 100))]


def list_members(
    secrets: SecretStore,
    team_id: str,
    query: str = "",
    limit: int = 25,
    *,
    refresh: bool = False,
) -> dict[str, Any]:
    """Human members of the workspace: id, display name, @handle, guest flag.
    Bots, deleted users, and Slackbot are filtered — they can't need allowing."""
    token = _bot_token(secrets, team_id)
    if not token:
        return {"ok": False, "error": "workspace not connected"}

    def fetch() -> list[dict[str, Any]]:
        members = _get_pages(token, "users.list", {}, "members")
        out = []
        for m in members:
            if m.get("deleted") or m.get("is_bot") or m.get("id") == "USLACKBOT":
                continue
            profile = m.get("profile") or {}
            name = (
                profile.get("display_name")
                or profile.get("real_name")
                or m.get("name")
                or ""
            )
            out.append(
                {
                    "id": m.get("id", ""),
                    "name": name,
                    "handle": m.get("name") or "",
                    "guest": bool(
                        m.get("is_restricted") or m.get("is_ultra_restricted")
                    ),
                }
            )
        return out

    try:
        rows = _cached(team_id, "members", fetch, refresh)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "members": _rank(rows, query, "name", limit)}


def list_channels(
    secrets: SecretStore,
    team_id: str,
    query: str = "",
    limit: int = 25,
    *,
    refresh: bool = False,
) -> dict[str, Any]:
    """Channels the token can see: all public ones, private only where the bot
    is a member. `is_member` lets the GUI hint "invite @OpenWorker" for the rest."""
    token = _bot_token(secrets, team_id)
    if not token:
        return {"ok": False, "error": "workspace not connected"}

    def fetch() -> list[dict[str, Any]]:
        chans = _get_pages(
            token,
            "conversations.list",
            {"types": "public_channel,private_channel", "exclude_archived": "true"},
            "channels",
            page_limit=_CHANNEL_PAGE_LIMIT,
        )
        return [
            {
                "id": c.get("id", ""),
                "name": c.get("name", ""),
                "is_private": bool(c.get("is_private")),
                "is_member": bool(c.get("is_member")),
            }
            for c in chans
            if c.get("id") and c.get("name")
        ]

    try:
        rows = _cached(team_id, "channels", fetch, refresh)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "channels": _rank(rows, query, "name", limit)}


def clear_cache(team_id: Optional[str] = None) -> None:
    """Drop cached rosters (all teams, or one) — disconnect/reconnect hygiene."""
    if team_id is None:
        _CACHE.clear()
        return
    for key in [k for k in _CACHE if k[0] == team_id]:
        del _CACHE[key]
