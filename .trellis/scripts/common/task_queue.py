#!/usr/bin/env python3
"""
Task queue utility functions.

Provides:
    list_tasks_by_status   - List tasks by status
    list_pending_tasks     - List tasks with pending status
    list_tasks_by_assignee - List tasks by assignee
    list_my_tasks          - List tasks assigned to current developer
    get_task_stats         - Get P0/P1/P2/P3 counts
"""

from __future__ import annotations

from pathlib import Path

from .paths import (
    get_repo_root,
    get_developer,
    get_tasks_dir,
)
from .tasks import iter_active_tasks


# =============================================================================
# Internal helper
# =============================================================================

def _task_to_dict(t) -> dict:
    """Convert TaskInfo to the dict format callers expect."""
    return {
        "priority": t.priority,
        "id": t.raw.get("id", ""),
        "title": t.title,
        "status": t.status,
        "assignee": t.assignee or "-",
        "dir": t.dir_name,
        "children": list(t.children),
        "parent": t.parent,
    }


# =============================================================================
# Public Functions
# =============================================================================

def list_tasks_by_status(
    filter_status: str | None = None,
    repo_root: Path | None = None
) -> list[dict]:
    """List tasks by status.

    Args:
        filter_status: Optional status filter.
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        List of task info dicts with keys: priority, id, title, status, assignee.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    tasks_dir = get_tasks_dir(repo_root)
    results = []

    for t in iter_active_tasks(tasks_dir):
        if filter_status and t.status != filter_status:
            continue
        results.append(_task_to_dict(t))

    return results


def list_pending_tasks(repo_root: Path | None = None) -> list[dict]:
    """List pending tasks.

    Args:
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        List of task info dicts.
    """
    return list_tasks_by_status("planning", repo_root)


def list_tasks_by_assignee(
    assignee: str,
    filter_status: str | None = None,
    repo_root: Path | None = None
) -> list[dict]:
    """List tasks assigned to a specific developer.

    Args:
        assignee: Developer name.
        filter_status: Optional status filter.
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        List of task info dicts.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    tasks_dir = get_tasks_dir(repo_root)
    results = []

    for t in iter_active_tasks(tasks_dir):
        if (t.assignee or "-") != assignee:
            continue
        if filter_status and t.status != filter_status:
            continue
        results.append(_task_to_dict(t))

    return results


def list_my_tasks(
    filter_status: str | None = None,
    repo_root: Path | None = None
) -> list[dict]:
    """List tasks assigned to current developer.

    Args:
        filter_status: Optional status filter.
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        List of task info dicts.

    Raises:
        ValueError: If developer not set.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    developer = get_developer(repo_root)
    if not developer:
        raise ValueError("Developer not set")

    return list_tasks_by_assignee(developer, filter_status, repo_root)


def get_task_stats(repo_root: Path | None = None) -> dict[str, int]:
    """Get task statistics.

    Args:
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        Dict with keys: P0, P1, P2, P3, Total.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    tasks_dir = get_tasks_dir(repo_root)
    stats = {"P0": 0, "P1": 0, "P2": 0, "P3": 0, "Total": 0}

    for t in iter_active_tasks(tasks_dir):
        if t.priority in stats:
            stats[t.priority] += 1
        stats["Total"] += 1

    return stats


def format_task_stats(stats: dict[str, int]) -> str:
    """Format task stats as string.

    Args:
        stats: Stats dict from get_task_stats.

    Returns:
        Formatted string like "P0:0 P1:1 P2:2 P3:0 Total:3".
    """
    return f"P0:{stats['P0']} P1:{stats['P1']} P2:{stats['P2']} P3:{stats['P3']} Total:{stats['Total']}"


# =============================================================================
# Main Entry (for testing)
# =============================================================================

if __name__ == "__main__":
    stats = get_task_stats()
    print(format_task_stats(stats))
    print()
    print("Pending tasks:")
    for task in list_pending_tasks():
        print(f"  {task['priority']}|{task['id']}|{task['title']}|{task['status']}|{task['assignee']}")
