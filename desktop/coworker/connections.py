"""Connection hierarchy (UI-REFRESH §4) — the per-persona + per-session connector layers.

Three layers gate whether a connector is *effective* for a session:

1. **account-connected** — a connector profile with valid creds exists (``connector_list[].connected``).
   Owned by the SecretStore; not stored here.
2. **persona-default-enabled** — per persona, which connected connectors are on by default for its
   sessions (``PersonaConnectionStore``). Seeded from the persona manifest's ``recommends`` and then
   user-editable.
3. **session-override** — per session, an explicit on/off that overrides the persona default
   (``SessionConnectionStore``). Absence of an override means *inherit the persona default*.

``effective(connector)`` = **connected** AND (``session_override`` if present, else the persona
default if present, else inherit-on). A connector that is not connected is never effective. A
connector with no persona opinion and no session override inherits *on* — the persona's
``recommends`` curates what to *suggest*/seed-on, it is not an exhaustive allow-list, so a connected
connector the persona never mentions stays available unless something explicitly turns it off.

Both stores are tiny JSON files mirroring ``SubscriptionStore`` (optional path, ``_load``/``_save``,
``indent=2``); the manager owns one of each and resolves via :func:`effective`.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Optional


class PersonaConnectionStore:
    """``{persona_id: {connector: bool}}`` — the per-persona default on/off for each connector."""

    def __init__(self, path: Optional[str | Path] = None) -> None:
        self.path = Path(path) if path else None
        self._lock = threading.Lock()
        self._rows: dict[str, dict[str, bool]] = {}
        self._load()

    def _load(self) -> None:
        if self.path and self.path.is_file():
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self._rows = {
                pid: {str(c): bool(v) for c, v in (row or {}).items()}
                for pid, row in data.get("personas", {}).items()
            }

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"personas": self._rows}, indent=2),
            encoding="utf-8",
        )

    # -- queries ----------------------------------------------------------------
    def get(self, persona_id: str) -> dict[str, bool]:
        """The persona's stored row (a copy). Empty dict if it was never seeded/edited — this does
        NOT seed; use :meth:`defaults_for` to seed from a manifest."""
        return dict(self._rows.get(persona_id, {}))

    def defaults_for(
        self, persona_id: str, manifest, *, connected: set[str]
    ) -> dict[str, bool]:
        """The persona's default connector map, seeding it from the manifest on first read.

        Seeding rule: a ``recommends`` item of kind ``connector`` with ``tier == "core"`` defaults
        **True**; every other recommended connector (optional) defaults **False**. (mcp recommends
        and non-connector kinds are ignored.) The seeded row is persisted on first read so the seed
        is stable thereafter — a later edit/toggle persists over it. A persona with no manifest
        (e.g. a builtin) seeds an empty row.

        NOTE: this intentionally deviates from §4.2's literal "whose connector is connected" wording
        to honor its intent. A core connector seeds True even when not connected yet:
        :func:`effective` already gates on ``connected``, so it stays filtered out while
        disconnected and **self-lights when it later connects** — rather than being frozen False
        forever (a stale seed that would break the "connect a core connector → on by default"
        flow). ``connected`` is kept in the signature for back-compat but is no longer read here,
        leaving :func:`effective`'s connected-gate the single source of truth for connectedness.
        """
        with self._lock:
            if persona_id in self._rows:
                return dict(self._rows[persona_id])
            seeded: dict[str, bool] = {}
            recommends = list(getattr(manifest, "recommends", None) or [])
            for rec in recommends:
                if getattr(rec, "kind", None) != "connector":
                    continue
                # core → on by default (connectedness is enforced later by effective()).
                seeded[rec.ref] = getattr(rec, "tier", "") == "core"
            self._rows[persona_id] = seeded
            self._save()
            return dict(seeded)

    # -- mutations --------------------------------------------------------------
    def set(self, persona_id: str, connector: str, enabled: bool) -> None:
        with self._lock:
            self._rows.setdefault(persona_id, {})[connector] = bool(enabled)
            self._save()


class SessionConnectionStore:
    """``{session_id: {connector: bool}}`` — per-session overrides only; an absent entry means the
    session inherits the persona default."""

    def __init__(self, path: Optional[str | Path] = None) -> None:
        self.path = Path(path) if path else None
        self._lock = threading.Lock()
        self._rows: dict[str, dict[str, bool]] = {}
        self._load()

    def _load(self) -> None:
        if self.path and self.path.is_file():
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self._rows = {
                sid: {str(c): bool(v) for c, v in (row or {}).items()}
                for sid, row in data.get("sessions", {}).items()
            }

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"sessions": self._rows}, indent=2),
            encoding="utf-8",
        )

    # -- queries ----------------------------------------------------------------
    def get(self, session_id: str) -> dict[str, bool]:
        return dict(self._rows.get(session_id, {}))

    # -- mutations --------------------------------------------------------------
    def set(self, session_id: str, connector: str, enabled: bool) -> None:
        with self._lock:
            self._rows.setdefault(session_id, {})[connector] = bool(enabled)
            self._save()

    def clear(self, session_id: str, connector: str) -> None:
        """Drop a single override so the session inherits the persona default again."""
        with self._lock:
            row = self._rows.get(session_id)
            if row and connector in row:
                del row[connector]
                if not row:
                    del self._rows[session_id]
                self._save()

    def remove_session(self, session_id: str) -> None:
        """Drop all of a session's overrides (called when the session is deleted)."""
        with self._lock:
            if session_id in self._rows:
                del self._rows[session_id]
                self._save()


def effective(
    *,
    connected: set[str],
    persona_defaults: dict[str, bool],
    session_overrides: dict[str, bool],
) -> dict[str, bool]:
    """Resolve the effective-enabled connectors for a session — the §4 invariant.

    For each **connected** connector: a session override (if present) wins; otherwise the persona
    default (if present) applies; otherwise it inherits *on*. Not-connected connectors are never
    effective. Returns only the effective-**enabled** connectors, each mapped to ``True`` (muted /
    off connectors are omitted), so the result reads as the session's live connector set.
    """
    out: dict[str, bool] = {}
    for connector in connected:
        if connector in session_overrides:
            enabled = session_overrides[connector]
        elif connector in persona_defaults:
            enabled = persona_defaults[connector]
        else:
            enabled = True  # connected, no opinion → inherit on
        if enabled:
            out[connector] = True
    return out
