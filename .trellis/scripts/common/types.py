"""
Core type definitions for Trellis task data.

Provides:
    TaskData     — TypedDict for task.json shape (read-path type hints only)
    TaskInfo     — Frozen dataclass for loaded task (the public API type)
    AgentRecord  — TypedDict for registry.json agent entries
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict


# =============================================================================
# task.json shape (TypedDict — used only for read-path type hints)
# =============================================================================

class TaskData(TypedDict, total=False):
    """Shape of task.json on disk.

    Used only for type annotations when reading task.json.
    Writes must use the original dict to avoid losing unknown fields.
    """

    id: str
    name: str
    title: str
    description: str
    status: str
    dev_type: str
    scope: str | None
    package: str | None
    priority: str
    creator: str
    assignee: str
    createdAt: str
    completedAt: str | None
    branch: str | None
    base_branch: str | None
    worktree_path: str | None
    commit: str | None
    pr_url: str | None
    subtasks: list[str]
    children: list[str]
    parent: str | None
    relatedFiles: list[str]
    notes: str
    meta: dict


# =============================================================================
# Loaded task object (frozen dataclass — the public API type)
# =============================================================================

@dataclass(frozen=True)
class TaskInfo:
    """Immutable view of a loaded task.

    Created by load_task() / iter_active_tasks().
    Contains the commonly accessed fields; the original dict
    is preserved in `raw` for write-back and uncommon field access.
    """

    dir_name: str
    directory: Path
    title: str
    status: str
    assignee: str
    priority: str
    children: tuple[str, ...]
    parent: str | None
    package: str | None
    raw: dict  # original dict — use for writes and uncommon fields

    @property
    def name(self) -> str:
        """Task name (id or name field)."""
        return self.raw.get("name") or self.raw.get("id") or self.dir_name

    @property
    def description(self) -> str:
        return self.raw.get("description", "")

    @property
    def branch(self) -> str | None:
        return self.raw.get("branch")

    @property
    def meta(self) -> dict:
        return self.raw.get("meta", {})


# =============================================================================
# registry.json agent entry
# =============================================================================

class AgentRecord(TypedDict, total=False):
    """Shape of an agent entry in registry.json."""

    id: str
    pid: int
    task_dir: str
    worktree_path: str
    branch: str
    platform: str
    started_at: str
    status: str
