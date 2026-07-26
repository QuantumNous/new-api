"""Skill preferences — the disabled set, persisted at `state_dir()/skills.json`.

Disabling hides a skill from the catalog and from `load_skill` without deleting its
folder; builtin skills can only ever be disabled, not removed.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..secrets import state_dir


def _prefs_path() -> Path:
    return state_dir() / "skills.json"


def _read() -> dict:
    try:
        return json.loads(_prefs_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def load_disabled() -> set[str]:
    disabled = _read().get("disabled")
    if not isinstance(disabled, list):
        return set()
    return {str(name) for name in disabled}


def set_enabled(name: str, enabled: bool) -> None:
    disabled = load_disabled()
    if enabled:
        disabled.discard(name)
    else:
        disabled.add(name)
    path = _prefs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(
        json.dumps({"disabled": sorted(disabled)}, indent=2), encoding="utf-8"
    )
    tmp.replace(path)
