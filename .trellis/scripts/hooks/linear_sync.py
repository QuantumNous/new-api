#!/usr/bin/env python3
"""Linear sync hook for Trellis task lifecycle.

Syncs task events to Linear via the `linearis` CLI.

Usage (called automatically by task.py hooks):
    python3 .trellis/scripts/hooks/linear_sync.py create
    python3 .trellis/scripts/hooks/linear_sync.py start
    python3 .trellis/scripts/hooks/linear_sync.py archive

Manual usage:
    TASK_JSON_PATH=.trellis/tasks/<name>/task.json python3 .trellis/scripts/hooks/linear_sync.py sync

Environment:
    TASK_JSON_PATH  - Absolute path to task.json (set by task.py)

Configuration:
    .trellis/hooks.local.json  - Local config (gitignored), example:
    {
      "linear": {
        "team": "TEAM_KEY",
        "project": "Project Name",
        "assignees": {
          "dev-name": "linear-user-id"
        }
      }
    }
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────

# Trellis priority → Linear priority (1=Urgent, 2=High, 3=Medium, 4=Low)
PRIORITY_MAP = {"P0": 1, "P1": 2, "P2": 3, "P3": 4}

# Linear status names (must match your team's workflow)
STATUS_IN_PROGRESS = "In Progress"
STATUS_DONE = "Done"


def _load_config() -> dict:
    """Load local hook config from .trellis/hooks.local.json."""
    task_json_path = os.environ.get("TASK_JSON_PATH", "")
    if task_json_path:
        # Walk up from task.json to find .trellis/
        trellis_dir = Path(task_json_path).parent.parent.parent
    else:
        trellis_dir = Path(".trellis")

    config_path = trellis_dir / "hooks.local.json"
    try:
        with open(config_path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


CONFIG = _load_config()
LINEAR_CFG = CONFIG.get("linear", {})

TEAM = LINEAR_CFG.get("team", "")
PROJECT = LINEAR_CFG.get("project", "")
ASSIGNEE_MAP = LINEAR_CFG.get("assignees", {})

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _read_task() -> tuple[dict, str]:
    path = os.environ.get("TASK_JSON_PATH", "")
    if not path:
        print("TASK_JSON_PATH not set", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        return json.load(f), path


def _write_task(data: dict, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _linearis(*args: str) -> dict | None:
    result = subprocess.run(
        ["linearis", *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        print(f"linearis error: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    stdout = result.stdout.strip()
    if stdout:
        return json.loads(stdout)
    return None


def _get_linear_issue(task: dict) -> str | None:
    meta = task.get("meta")
    if isinstance(meta, dict):
        return meta.get("linear_issue")
    return None


# ─── Actions ──────────────────────────────────────────────────────────────────


def cmd_create() -> None:
    if not TEAM:
        print("No linear.team configured in hooks.local.json", file=sys.stderr)
        sys.exit(1)

    task, path = _read_task()

    # Skip if already linked
    if _get_linear_issue(task):
        print(f"Already linked: {_get_linear_issue(task)}")
        return

    title = task.get("title") or task.get("name") or "Untitled"
    args = ["issues", "create", title, "--team", TEAM]

    # Map priority
    priority = PRIORITY_MAP.get(task.get("priority", ""), 0)
    if priority:
        args.extend(["-p", str(priority)])

    # Set project
    if PROJECT:
        args.extend(["--project", PROJECT])

    # Assign to Linear user
    assignee = task.get("assignee", "")
    linear_user_id = ASSIGNEE_MAP.get(assignee)
    if linear_user_id:
        args.extend(["--assignee", linear_user_id])

    # Link to parent's Linear issue if available
    parent_issue = _resolve_parent_linear_issue(task)
    if parent_issue:
        args.extend(["--parent-ticket", parent_issue])

    result = _linearis(*args)
    if result and "identifier" in result:
        if not isinstance(task.get("meta"), dict):
            task["meta"] = {}
        task["meta"]["linear_issue"] = result["identifier"]
        _write_task(task, path)
        print(f"Created Linear issue: {result['identifier']}")


def cmd_start() -> None:
    task, _ = _read_task()
    issue = _get_linear_issue(task)
    if not issue:
        return
    _linearis("issues", "update", issue, "-s", STATUS_IN_PROGRESS)
    print(f"Updated {issue} -> {STATUS_IN_PROGRESS}")
    cmd_sync()


def cmd_archive() -> None:
    task, _ = _read_task()
    issue = _get_linear_issue(task)
    if not issue:
        return
    _linearis("issues", "update", issue, "-s", STATUS_DONE)
    print(f"Updated {issue} -> {STATUS_DONE}")


def cmd_sync() -> None:
    """Sync prd.md content to Linear issue description."""
    task, _ = _read_task()
    issue = _get_linear_issue(task)
    if not issue:
        print("No linear_issue in meta, run create first", file=sys.stderr)
        sys.exit(1)

    # Find prd.md next to task.json
    task_json_path = os.environ.get("TASK_JSON_PATH", "")
    prd_path = Path(task_json_path).parent / "prd.md"
    if not prd_path.is_file():
        print(f"No prd.md found at {prd_path}", file=sys.stderr)
        sys.exit(1)

    description = prd_path.read_text(encoding="utf-8").strip()
    _linearis("issues", "update", issue, "-d", description)
    print(f"Synced prd.md to {issue} description")


# ─── Parent Issue Resolution ─────────────────────────────────────────────────


def _resolve_parent_linear_issue(task: dict) -> str | None:
    """Find parent task's Linear issue identifier."""
    parent_name = task.get("parent")
    if not parent_name:
        return None

    task_json_path = os.environ.get("TASK_JSON_PATH", "")
    if not task_json_path:
        return None

    current_task_dir = Path(task_json_path).parent
    tasks_dir = current_task_dir.parent
    parent_json = tasks_dir / parent_name / "task.json"

    if parent_json.exists():
        try:
            with open(parent_json, encoding="utf-8") as f:
                parent_task = json.load(f)
            return _get_linear_issue(parent_task)
        except (json.JSONDecodeError, OSError):
            pass
    return None


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    actions = {
        "create": cmd_create,
        "start": cmd_start,
        "archive": cmd_archive,
        "sync": cmd_sync,
    }
    fn = actions.get(action)
    if fn:
        fn()
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        print(f"Valid actions: {', '.join(actions)}", file=sys.stderr)
        sys.exit(1)
