"""Unrouted / dead-letter store — a durable record of inbound messages that had nowhere to go and
of background turns that failed, so neither vanishes silently.

Two producers:
  - a DM (or any non-channel) inbound message with no designated session to handle it;
  - a background turn (channel delivery, self-wake) that errored on an ERROR engine event.

JSON-backed and capped (newest kept), mirroring SubscriptionStore's persistence. This is a
visibility/debugging surface, not a queue — entries are read in the GUI, not redelivered.
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class UnroutedItem:
    source: str  # message origin / session id (e.g. "slack:D123" or a session id)
    sender: str  # who sent it ("-" when not applicable, e.g. a turn failure)
    text: str  # the message (or the failing instruction)
    reason: str  # why it landed here ("no DM session designated", an error string, …)
    ts: float = field(default_factory=time.time)


class UnroutedStore:
    def __init__(self, path: Optional[str | Path] = None, *, cap: int = 200) -> None:
        self.path = Path(path) if path else None
        self._cap = cap
        self._lock = threading.Lock()
        self._items: list[UnroutedItem] = []
        self._load()

    def _load(self) -> None:
        if self.path and self.path.is_file():
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self._items = [UnroutedItem(**raw) for raw in data.get("items", [])]

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"items": [asdict(i) for i in self._items]}, indent=2),
            encoding="utf-8",
        )

    def record(self, source: str, sender: str, text: str, reason: str) -> UnroutedItem:
        item = UnroutedItem(
            source=source or "?", sender=sender or "-", text=text or "", reason=reason
        )
        with self._lock:
            self._items.append(item)
            if len(self._items) > self._cap:
                self._items = self._items[-self._cap :]
            self._save()
        return item

    def list(self, n: int = 100) -> list[dict]:
        """Most-recent-first, for the GUI panel."""
        items = list(reversed(self._items))[: max(1, n)]
        return [asdict(i) for i in items]
