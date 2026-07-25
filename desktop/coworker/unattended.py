"""Unattended mode — a per-session toggle for *where the human is reached*.

It does **not** change the autonomy ceiling (the permission mode does). When a session is
unattended, anything that would prompt inline (approval / question) is routed to the Inbox and
the agent suspends until answered; the composer is disabled. Turning it on is a one-tap confirm
(enforced at the API/GUI layer). This registry just persists the per-session flag.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Optional


class UnattendedRegistry:
    def __init__(self, path: Optional[str | Path] = None) -> None:
        self.path = Path(path) if path else None
        self._lock = threading.Lock()
        self._flags: dict[str, bool] = {}
        if self.path and self.path.is_file():
            self._flags = dict(json.loads(self.path.read_text(encoding="utf-8")))

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self._flags, indent=2), encoding="utf-8")

    def is_unattended(self, session_id: str) -> bool:
        return bool(self._flags.get(session_id, False))

    def set(self, session_id: str, unattended: bool) -> None:
        with self._lock:
            if unattended:
                self._flags[session_id] = True
            else:
                self._flags.pop(session_id, None)
            self._save()

    def sessions(self) -> list[str]:
        return [sid for sid, on in self._flags.items() if on]
