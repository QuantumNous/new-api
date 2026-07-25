"""Slack team-qualified addressing for managed relay (slack-relay-spec §8/§9).

A single owner can be in several Slack workspaces at once, so a bare channel id
(`C…`) is ambiguous — a `U…`/`C…` only means something inside its `team_id`.
Managed-relay targets therefore carry the team: the reply handle's chat_id is
`"{team_id}/{channel}"`.

Encoding note: the reply-target grammar is colon-delimited
(`platform:chat_id[:thread]`, see base.parse_target), so we join team+channel
with `/` — colon-free — to stay inside that grammar unchanged. `slack:T012345/C0123`
is the wire form of the spec's conceptual `slack:T012345:C0123`. Manual
Socket-Mode targets (single workspace) keep the bare `slack:C0123` form.
"""

from __future__ import annotations

from typing import Optional


def qualify(team_id: Optional[str], channel: str) -> str:
    """Build a team-qualified chat_id, or the bare channel when no team."""
    return f"{team_id}/{channel}" if team_id else channel


def split(chat_id: str) -> tuple[Optional[str], str]:
    """`'T…/C…' -> ('T…', 'C…')`; a bare `'C…' -> (None, 'C…')`.

    Only the first `/` splits (channel ids never contain one), so this is
    lossless both ways.
    """
    if chat_id and "/" in chat_id:
        team, _, channel = chat_id.partition("/")
        return (team or None), channel
    return None, chat_id
