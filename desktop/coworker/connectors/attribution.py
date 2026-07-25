"""Sender attribution for outbound Slack posts (P1, 2026-07-14).

Multiple people can run OpenWorker into the same channel, and every one of their
posts arrives as the same @ocw bot. The managed OAuth install already records WHO
connected each workspace — Slack's `authed_user` — so outbound text carries
"[<their name>] " per workspace: the member id rides the install form-POST into the
`slack:team:<id>` profile, and the display name is resolved once via `users.info`
(scope `users:read`, granted since wave 1) and cached on that profile.

Truthfulness rules: manual Socket-Mode installs have no authed_user, so there is
nothing to attribute and their posts stay bare; DMs skip the prefix (a 1:1 with the
bot has no ambiguity); and attribution NEVER blocks a send — any resolution failure
degrades to no prefix. P2 (chat:write.customize) replaces the text prefix with a
native username override.
"""

from __future__ import annotations

import os
from typing import Optional

from ..secrets import SecretStore

_TIMEOUT = 10.0


def _api_base() -> str:
    return os.environ.get("SLACK_API_URL", "https://slack.com/api/")


def _fetch_display_name(token: str, user_id: str) -> Optional[str]:
    """users.info → the human's name (display name, else real name). None on any failure."""
    import httpx

    try:
        resp = httpx.get(
            f"{_api_base()}users.info",
            params={"user": user_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=_TIMEOUT,
        )
        data = resp.json()
    except Exception:
        return None
    if not data.get("ok"):
        return None
    user = data.get("user") or {}
    profile = user.get("profile") or {}
    name = profile.get("display_name") or profile.get("real_name") or user.get("name")
    return str(name).strip() or None if name else None


def sender_prefix(secrets: SecretStore, chat_id: str) -> str:
    """'[Rohit] ' for a Slack chat_id whose workspace install knows its human, else ''."""
    from .slack_addr import split

    team, channel = split(chat_id)
    if channel.startswith("D"):  # DM with the bot — nothing to disambiguate
        return ""
    key = f"slack:team:{team}" if team else "slack:default"
    profile = secrets.get(key) or {}
    name = profile.get("sender_name")
    if not name:
        user_id, token = profile.get("slack_user_id"), profile.get("bot_token")
        if not user_id or not token:
            return ""
        name = _fetch_display_name(str(token), str(user_id))
        if not name:
            return ""
        profile["sender_name"] = name
        secrets.put(key, profile)
    return f"[{name}] "
