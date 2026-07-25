"""Session record — the metadata + messages for one conversation.

Storage lives in `coworker.conversations.ConversationStore`: a SQLite index keyed by
project, with each conversation's messages in an append-only `.jsonl` file.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class SessionRecord:
    session_id: str
    workspace: str
    model: str
    mode: str
    messages: list[dict[str, Any]] = field(default_factory=list)
    title: Optional[str] = None
    agent: str = "code"
    message_count: int = 0
    updated_at: Optional[str] = None
    # Folders added to the session beyond its primary scratch dir, each {path, writable, label}.
    # The primary scratch is re-provisioned at engine build, so only these extras are persisted.
    extra_roots: list[dict[str, Any]] = field(default_factory=list)
    # "Always allow" approvals granted in this session ({tools: [...], commands: [...]}) —
    # session-scoped by design, but the session outlives the process, so they must too
    # (owner-hit 2026-07-22: grants forgotten on every restart).
    grants: dict[str, Any] = field(default_factory=dict)
    pinned: bool = False
    archived: bool = False
    # Where the session came from, when not user-started (§31): machine key + display label
    # (e.g. origin="slack", origin_label="#general · T0ABCD"). Set once at spawn.
    origin: Optional[str] = None
    origin_label: Optional[str] = None
