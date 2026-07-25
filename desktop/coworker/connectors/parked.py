"""Parked unauthorized messages — what an unallowed sender said, kept instead of lost.

The gateway drops inbound messages from senders not on the allow-list (closed by default).
Dropping silently made the first-contact flow clumsy: the sender had to message once just to
appear under "Recent senders", get allowed, then message AGAIN. Parking the dropped message
lets the owner see it on the connector page and resolve it in one step — dismiss it, allow
the sender, or allow AND deliver the original message (no re-send needed).

JSON-backed and capped like UnroutedStore. This IS a queue (unlike Unrouted): allow-and-deliver
re-injects the parked message through the normal inbound path.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ParkedMessage:
    platform: str  # "slack" | "telegram" | …
    chat_id: str  # channel/DM id, e.g. "C0BD7KZ1AH5"
    user_id: str  # sender id, e.g. "U07JK68S4BH"
    text: str
    chat_name: Optional[str] = None  # resolved display name (falls back to chat_id)
    user_name: Optional[str] = None  # resolved display name (falls back to user_id)
    chat_type: str = "channel"  # "channel" | "group" | "dm"
    thread_id: Optional[str] = None
    team_id: Optional[str] = None  # workspace id (managed relay); None for socket mode
    ts: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])


class ParkedStore:
    def __init__(self, path: Optional[str | Path] = None, *, cap: int = 100) -> None:
        self.path = Path(path) if path else None
        self._cap = cap
        self._lock = threading.Lock()
        self._items: list[ParkedMessage] = []
        self._load()

    def _load(self) -> None:
        if self.path and self.path.is_file():
            try:
                data = json.loads(self.path.read_text(encoding="utf-8"))
                self._items = [ParkedMessage(**raw) for raw in data.get("items", [])]
            except (OSError, ValueError, TypeError):
                self._items = []  # a corrupt file must never block startup

    def _save(self) -> None:
        if not self.path:
            return
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(
                json.dumps({"items": [asdict(i) for i in self._items]}, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass  # persistence is best-effort; memory stays authoritative

    def park(self, **fields) -> ParkedMessage:
        item = ParkedMessage(**fields)
        with self._lock:
            self._items.append(item)
            if len(self._items) > self._cap:
                self._items = self._items[-self._cap :]
            self._save()
        return item

    def list(self, platform: Optional[str] = None) -> list[dict]:
        with self._lock:
            return [
                asdict(i)
                for i in reversed(self._items)  # newest first
                if platform is None or i.platform == platform
            ]

    def pop(self, item_id: str) -> Optional[ParkedMessage]:
        with self._lock:
            for i, item in enumerate(self._items):
                if item.id == item_id:
                    del self._items[i]
                    self._save()
                    return item
        return None
