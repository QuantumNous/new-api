"""Mention-thread → session map for the Slack mention router (UX-DECISIONS §31).

When @OpenWorker is tagged in a channel with no subscribed session, the router spawns a
coworker session that OWNS that thread and replies into it. This store is the
dedupe map: one durable record per thread, keyed by the thread target string
(``"slack:C0123:1700….000100"``; relay: ``"slack:T…/C…:ts"``) — byte-identical to
what the session passes to ``send_message`` and to the standing-grant target, so
one string serves lookup, delivery, and permission.

The store is the durable source of truth for the thread grant: ``get_engine``
re-derives ``permissions.task_rules`` from it on every engine rebuild, so the
pre-approved in-thread reply survives server restarts. Deleting the session
clears its records (same contract as subscriptions).
"""

from __future__ import annotations

import json
import threading
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional


@dataclass
class MentionThread:
    thread_target: str  # "platform:chat_id:thread_ts" — the reply/grant target
    session_id: str
    channel: str  # thread-agnostic "platform:chat_id" (debugging/cleanup)


class MentionSessionStore:
    def __init__(self, path: Optional[str | Path] = None) -> None:
        self.path = Path(path) if path else None
        self._lock = threading.Lock()
        self._threads: list[MentionThread] = []
        self._load()

    def _load(self) -> None:
        if self.path and self.path.is_file():
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self._threads = [MentionThread(**raw) for raw in data.get("threads", [])]

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"threads": [asdict(t) for t in self._threads]}, indent=2),
            encoding="utf-8",
        )

    # -- mutations --------------------------------------------------------------
    def set(self, thread_target: str, session_id: str, channel: str) -> MentionThread:
        """Upsert — a respawn over a deleted session overwrites the old mapping."""
        with self._lock:
            for t in self._threads:
                if t.thread_target == thread_target:
                    t.session_id = session_id
                    t.channel = channel
                    self._save()
                    return t
            rec = MentionThread(
                thread_target=thread_target, session_id=session_id, channel=channel
            )
            self._threads.append(rec)
            self._save()
            return rec

    def remove_session(self, session_id: str) -> None:
        """Drop all of a session's thread mappings (called when it is deleted)."""
        with self._lock:
            before = len(self._threads)
            self._threads = [t for t in self._threads if t.session_id != session_id]
            if len(self._threads) != before:
                self._save()

    # -- queries ----------------------------------------------------------------
    def get(self, thread_target: str) -> Optional[str]:
        for t in self._threads:
            if t.thread_target == thread_target:
                return t.session_id
        return None

    def targets_for(self, session_id: str) -> list[str]:
        """Every thread this session owns — the grant re-seed set."""
        return [t.thread_target for t in self._threads if t.session_id == session_id]

    def all(self) -> list[MentionThread]:
        return list(self._threads)
