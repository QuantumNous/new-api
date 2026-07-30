"""User-owned trust decisions for repository-provided command allowances.

A repository may declare command prefixes in `.coworker/config.toml`, but those grants
take effect only after the user trusts that exact canonical workspace root. Trust follows
the path rather than a snapshot of the config: future changes at a trusted path are
accepted until the user revokes trust.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from .secrets import state_dir


class WorkspaceTrustStore:
    def __init__(self, path: Optional[str | Path] = None) -> None:
        self.path = (
            Path(path) if path is not None else state_dir() / "workspace_trust.json"
        )

    @staticmethod
    def canonical(path: str | Path) -> str:
        return str(Path(path).expanduser().resolve())

    def _load(self) -> set[str]:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return set()
        if not isinstance(data, dict):
            return set()
        values = data.get("trusted_workspaces", [])
        if not isinstance(values, list):
            return set()
        return {str(v) for v in values if isinstance(v, str) and v}

    def is_trusted(self, workspace: str | Path) -> bool:
        return self.canonical(workspace) in self._load()

    def list(self) -> list[str]:
        return sorted(self._load())

    def set_trusted(self, workspace: str | Path, trusted: bool) -> str:
        canonical = self.canonical(workspace)
        values = self._load()
        if trusted:
            values.add(canonical)
        else:
            values.discard(canonical)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_name(f".{self.path.name}.{os.getpid()}.tmp")
        tmp.write_text(
            json.dumps({"trusted_workspaces": sorted(values)}, indent=2) + "\n",
            encoding="utf-8",
        )
        os.chmod(tmp, 0o600)
        tmp.replace(self.path)
        return canonical
