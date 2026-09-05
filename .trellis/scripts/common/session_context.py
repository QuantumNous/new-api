#!/usr/bin/env python3
"""
Session context generation (default + record modes).

Provides:
    get_context_json          - JSON output for default mode
    get_context_text          - Text output for default mode
    get_context_record_json   - JSON for record mode
    get_context_text_record   - Text for record mode
    output_json               - Print JSON
    output_text               - Print text
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

from .active_task import resolve_context_key
from .config import get_git_packages
from .git import run_git
from .packages_context import get_packages_section
from .tasks import iter_active_tasks, load_task, get_all_statuses, children_progress
from .paths import (
    DIR_SCRIPTS,
    DIR_SPEC,
    DIR_TASKS,
    DIR_WORKFLOW,
    DIR_WORKSPACE,
    count_lines,
    get_active_journal_file,
    get_current_task,
    get_current_task_source,
    get_developer,
    get_repo_root,
    get_tasks_dir,
)


# =============================================================================
# Helpers
# =============================================================================

_PACKAGE_NAME = "@mindfoldhq/trellis"
_UPDATE_CHECK_TIMEOUT_SECONDS = 1.0
_VERSION_RE = re.compile(
    r"^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?\s*$"
)
_VERSION_TOKEN_RE = re.compile(r"\b\d+(?:\.\d+){1,2}(?:-[0-9A-Za-z.-]+)?\b")
_POLYREPO_IGNORED_DIRS = {
    "node_modules",
    "target",
    "dist",
    "build",
    "out",
    "bin",
    "obj",
    "vendor",
    "coverage",
    "tmp",
    "__pycache__",
}
_POLYREPO_SCAN_MAX_DEPTH = 2


def _is_git_worktree(path: Path) -> bool:
    """Return True when path is inside a Git worktree."""
    rc, out, _ = run_git(["rev-parse", "--is-inside-work-tree"], cwd=path)
    return rc == 0 and out.strip().lower() == "true"


def _parse_recent_commits(log_output: str) -> list[dict]:
    """Parse `git log --oneline` output into structured commit entries."""
    commits = []
    for line in log_output.splitlines():
        if not line.strip():
            continue
        parts = line.split(" ", 1)
        if len(parts) >= 2:
            commits.append({"hash": parts[0], "message": parts[1]})
        elif len(parts) == 1:
            commits.append({"hash": parts[0], "message": ""})
    return commits


def _collect_git_repo_info(name: str, rel_path: str, repo_dir: Path) -> dict | None:
    """Collect Git status for one known repository directory."""
    if not (repo_dir / ".git").exists():
        return None

    _, branch_out, _ = run_git(["branch", "--show-current"], cwd=repo_dir)
    branch = branch_out.strip() or "unknown"

    _, status_out, _ = run_git(["status", "--porcelain"], cwd=repo_dir)
    changes = len([l for l in status_out.splitlines() if l.strip()])

    _, log_out, _ = run_git(["log", "--oneline", "-5"], cwd=repo_dir)

    return {
        "name": name,
        "path": rel_path,
        "branch": branch,
        "isClean": changes == 0,
        "uncommittedChanges": changes,
        "recentCommits": _parse_recent_commits(log_out),
    }


def _collect_root_git_info(repo_root: Path) -> dict:
    """Collect root Git info without pretending a non-Git root is clean."""
    if not _is_git_worktree(repo_root):
        return {
            "isRepo": False,
            "branch": "",
            "isClean": False,
            "uncommittedChanges": 0,
            "recentCommits": [],
        }

    _, branch_out, _ = run_git(["branch", "--show-current"], cwd=repo_root)
    branch = branch_out.strip() or "unknown"

    _, status_out, _ = run_git(["status", "--porcelain"], cwd=repo_root)
    status_lines = [line for line in status_out.splitlines() if line.strip()]

    _, short_out, _ = run_git(["status", "--short"], cwd=repo_root)

    _, log_out, _ = run_git(["log", "--oneline", "-5"], cwd=repo_root)

    return {
        "isRepo": True,
        "branch": branch,
        "isClean": len(status_lines) == 0,
        "uncommittedChanges": len(status_lines),
        "statusShort": short_out.splitlines(),
        "recentCommits": _parse_recent_commits(log_out),
    }


def _discover_child_git_repos(repo_root: Path) -> list[tuple[str, str]]:
    """Discover child Git repositories using the init-time polyrepo heuristic."""
    found: list[str] = []

    def is_candidate_dir(path: Path) -> bool:
        name = path.name
        return not name.startswith(".") and name not in _POLYREPO_IGNORED_DIRS

    def scan(rel_dir: Path, depth: int) -> None:
        if depth >= _POLYREPO_SCAN_MAX_DEPTH:
            return
        abs_dir = repo_root / rel_dir
        try:
            children = sorted(abs_dir.iterdir(), key=lambda p: p.name)
        except OSError:
            return

        for child in children:
            if not child.is_dir() or not is_candidate_dir(child):
                continue

            child_rel = (
                rel_dir / child.name if rel_dir != Path(".") else Path(child.name)
            )
            if (child / ".git").exists():
                found.append(child_rel.as_posix())
                continue
            scan(child_rel, depth + 1)

    scan(Path("."), 0)
    if len(found) < 2:
        return []
    return [(path.replace("/", "_"), path) for path in sorted(found)]


def _collect_package_git_info(
    repo_root: Path,
    discover_unconfigured: bool = False,
) -> list[dict]:
    """Collect Git status for independent package repositories.

    Packages marked with ``git: true`` in config.yaml are authoritative.
    When the Trellis root is not a Git repo and no configured package repos are
    available, optionally fall back to the bounded polyrepo child scan.

    Returns:
        List of dicts with keys: name, path, branch, isClean,
        uncommittedChanges, recentCommits.
        Empty list if no git-repo packages are configured.
    """
    git_pkgs = get_git_packages(repo_root)
    result = []
    for pkg_name, pkg_path in git_pkgs.items():
        pkg_dir = repo_root / pkg_path
        info = _collect_git_repo_info(pkg_name, pkg_path, pkg_dir)
        if info is not None:
            result.append(info)

    if result or not discover_unconfigured:
        return result

    discovered = []
    for pkg_name, pkg_path in _discover_child_git_repos(repo_root):
        info = _collect_git_repo_info(pkg_name, pkg_path, repo_root / pkg_path)
        if info is not None:
            discovered.append(info)
    return discovered


def _append_root_git_context(lines: list[str], root_git_info: dict) -> None:
    """Append root Git status without misleading non-Git roots."""
    lines.append("## GIT STATUS")
    if not root_git_info["isRepo"]:
        lines.append("Root is not a Git repository.")
        lines.append("Run Git commands from the package repository paths listed below.")
    else:
        lines.append(f"Branch: {root_git_info['branch']}")
        if root_git_info["isClean"]:
            lines.append("Working directory: Clean")
        else:
            lines.append(
                f"Working directory: {root_git_info['uncommittedChanges']} "
                "uncommitted change(s)"
            )
            lines.append("")
            lines.append("Changes:")
            for line in root_git_info.get("statusShort", [])[:10]:
                lines.append(line)
    lines.append("")

    lines.append("## RECENT COMMITS")
    if not root_git_info["isRepo"]:
        lines.append(
            "Root has no Git commit history because it is not a Git repository."
        )
    elif root_git_info["recentCommits"]:
        for commit in root_git_info["recentCommits"]:
            lines.append(f"{commit['hash']} {commit['message']}")
    else:
        lines.append("(no commits)")
    lines.append("")


def _append_package_git_context(lines: list[str], package_git_info: list[dict]) -> None:
    """Append Git status and recent commits for package repositories."""
    for pkg in package_git_info:
        lines.append(f"## GIT STATUS ({pkg['name']}: {pkg['path']})")
        lines.append(f"Branch: {pkg['branch']}")
        if pkg["isClean"]:
            lines.append("Working directory: Clean")
        else:
            lines.append(
                f"Working directory: {pkg['uncommittedChanges']} uncommitted change(s)"
            )
        lines.append("")
        lines.append(f"## RECENT COMMITS ({pkg['name']}: {pkg['path']})")
        if pkg["recentCommits"]:
            for commit in pkg["recentCommits"]:
                lines.append(f"{commit['hash']} {commit['message']}")
        else:
            lines.append("(no commits)")
        lines.append("")


def _read_project_version(repo_root: Path) -> str | None:
    try:
        version = (repo_root / DIR_WORKFLOW / ".version").read_text(
            encoding="utf-8"
        ).strip()
    except OSError:
        return None
    return version or None


def _fetch_trellis_version_output() -> str | None:
    try:
        result = subprocess.run(
            ["trellis", "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=_UPDATE_CHECK_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.SubprocessError, TimeoutError):
        return None

    if result.returncode != 0:
        return None
    output = f"{result.stdout}\n{result.stderr}".strip()
    return output or None


def _extract_available_update_version(output: str) -> str | None:
    update_match = re.search(
        r"Trellis update available:\s*"
        r"(?P<current>\S+)\s*(?:→|->)\s*(?P<latest>\S+)",
        output,
    )
    if update_match:
        return update_match.group("latest").strip()
    candidates = _VERSION_TOKEN_RE.findall(output)
    return candidates[-1] if candidates else None


def _resolve_available_update_version() -> str | None:
    output = _fetch_trellis_version_output()
    if not output:
        return None
    return _extract_available_update_version(output)


def _parse_version(version: str) -> tuple[tuple[int, int, int], tuple[str, ...] | None] | None:
    match = _VERSION_RE.match(version)
    if not match:
        return None
    major, minor, patch, prerelease = match.groups()
    numbers = (int(major), int(minor or "0"), int(patch or "0"))
    prerelease_parts = tuple(prerelease.split(".")) if prerelease else None
    return numbers, prerelease_parts


def _compare_prerelease(
    left: tuple[str, ...] | None,
    right: tuple[str, ...] | None,
) -> int:
    if left is None and right is None:
        return 0
    if left is None:
        return 1
    if right is None:
        return -1

    for left_part, right_part in zip(left, right):
        if left_part == right_part:
            continue
        left_numeric = left_part.isdigit()
        right_numeric = right_part.isdigit()
        if left_numeric and right_numeric:
            left_int = int(left_part)
            right_int = int(right_part)
            return (left_int > right_int) - (left_int < right_int)
        if left_numeric:
            return -1
        if right_numeric:
            return 1
        return (left_part > right_part) - (left_part < right_part)

    return (len(left) > len(right)) - (len(left) < len(right))


def _compare_versions(left: str, right: str) -> int | None:
    parsed_left = _parse_version(left)
    parsed_right = _parse_version(right)
    if parsed_left is None or parsed_right is None:
        return None

    left_numbers, left_prerelease = parsed_left
    right_numbers, right_prerelease = parsed_right
    if left_numbers != right_numbers:
        return (left_numbers > right_numbers) - (left_numbers < right_numbers)
    return _compare_prerelease(left_prerelease, right_prerelease)


def _update_marker_path(repo_root: Path) -> Path:
    context_key = resolve_context_key()
    if not context_key:
        terminal_key = os.environ.get("TERM_SESSION_ID", "").strip()
        context_key = terminal_key or f"ppid-{os.getppid()}"
    safe_key = re.sub(r"[^A-Za-z0-9._-]+", "_", context_key).strip("._-")
    if not safe_key:
        safe_key = "session"
    return (
        repo_root
        / DIR_WORKFLOW
        / ".runtime"
        / f"update-check-{safe_key[:160]}.marker"
    )


def _mark_update_check_attempted(repo_root: Path) -> bool:
    marker_path = _update_marker_path(repo_root)
    if marker_path.exists():
        return False
    try:
        marker_path.parent.mkdir(parents=True, exist_ok=True)
        marker_path.write_text("checked\n", encoding="utf-8")
    except OSError:
        pass
    return True


def _get_update_hint(repo_root: Path) -> str | None:
    marker_path = _update_marker_path(repo_root)
    if marker_path.exists():
        return None

    current_version = _read_project_version(repo_root)
    if not current_version:
        return None

    latest_version = _resolve_available_update_version()
    if not latest_version:
        return None

    _mark_update_check_attempted(repo_root)
    comparison = _compare_versions(current_version, latest_version)
    if comparison is None or comparison >= 0:
        return None

    return (
        f"Trellis update available: {current_version} -> {latest_version}, "
        "run trellis upgrade"
    )


# =============================================================================
# JSON Output
# =============================================================================

def get_context_json(repo_root: Path | None = None) -> dict:
    """Get context as a dictionary.

    Args:
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        Context dictionary.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    developer = get_developer(repo_root)
    tasks_dir = get_tasks_dir(repo_root)
    journal_file = get_active_journal_file(repo_root)

    journal_lines = 0
    journal_relative = ""
    if journal_file and developer:
        journal_lines = count_lines(journal_file)
        journal_relative = (
            f"{DIR_WORKFLOW}/{DIR_WORKSPACE}/{developer}/{journal_file.name}"
        )

    root_git_info = _collect_root_git_info(repo_root)

    # Tasks
    tasks = [
        {
            "dir": t.dir_name,
            "name": t.name,
            "status": t.status,
            "children": list(t.children),
            "parent": t.parent,
        }
        for t in iter_active_tasks(tasks_dir)
    ]

    # Package git repos (independent sub-repositories)
    pkg_git_info = _collect_package_git_info(
        repo_root,
        discover_unconfigured=not root_git_info["isRepo"],
    )

    result = {
        "developer": developer or "",
        "git": {
            "isRepo": root_git_info["isRepo"],
            "branch": root_git_info["branch"],
            "isClean": root_git_info["isClean"],
            "uncommittedChanges": root_git_info["uncommittedChanges"],
            "recentCommits": root_git_info["recentCommits"],
        },
        "tasks": {
            "active": tasks,
            "directory": f"{DIR_WORKFLOW}/{DIR_TASKS}",
        },
        "journal": {
            "file": journal_relative,
            "lines": journal_lines,
            "nearLimit": journal_lines > 1800,
        },
    }

    if pkg_git_info:
        result["packageGit"] = pkg_git_info

    return result


def output_json(repo_root: Path | None = None) -> None:
    """Output context in JSON format.

    Args:
        repo_root: Repository root path. Defaults to auto-detected.
    """
    context = get_context_json(repo_root)
    print(json.dumps(context, indent=2, ensure_ascii=False))


# =============================================================================
# Text Output
# =============================================================================

def get_context_text(repo_root: Path | None = None) -> str:
    """Get context as formatted text.

    Args:
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        Formatted text output.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    lines = []
    lines.append("========================================")
    lines.append("SESSION CONTEXT")
    lines.append("========================================")
    lines.append("")

    developer = get_developer(repo_root)

    # Developer section
    lines.append("## DEVELOPER")
    if not developer:
        lines.append(
            f"ERROR: Not initialized. Run: python3 ./{DIR_WORKFLOW}/{DIR_SCRIPTS}/init_developer.py <name>"
        )
        return "\n".join(lines)

    lines.append(f"Name: {developer}")
    lines.append("")

    root_git_info = _collect_root_git_info(repo_root)
    _append_root_git_context(lines, root_git_info)

    # Package git repos — independent sub-repositories
    _append_package_git_context(
        lines,
        _collect_package_git_info(
            repo_root,
            discover_unconfigured=not root_git_info["isRepo"],
        ),
    )

    # Current task
    lines.append("## CURRENT TASK")
    current_task = get_current_task(repo_root)
    if current_task:
        current_task_dir = repo_root / current_task
        source_type, context_key, _ = get_current_task_source(repo_root)
        lines.append(f"Path: {current_task}")
        lines.append(
            f"Source: {source_type}" + (f":{context_key}" if context_key else "")
        )

        ct = load_task(current_task_dir)
        if ct:
            lines.append(f"Name: {ct.name}")
            lines.append(f"Status: {ct.status}")
            lines.append(f"Created: {ct.raw.get('createdAt', 'unknown')}")
            if ct.description:
                lines.append(f"Description: {ct.description}")

        # Check for prd.md
        prd_file = current_task_dir / "prd.md"
        if prd_file.is_file():
            lines.append("")
            lines.append("[!] This task has prd.md - read it for task details")
    else:
        lines.append("(none)")
    lines.append("")

    # Active tasks
    lines.append("## ACTIVE TASKS")
    tasks_dir = get_tasks_dir(repo_root)
    task_count = 0

    # Collect all task data for hierarchy display
    all_tasks = {t.dir_name: t for t in iter_active_tasks(tasks_dir)}
    all_statuses = {name: t.status for name, t in all_tasks.items()}

    def _print_task_tree(name: str, indent: int = 0) -> None:
        nonlocal task_count
        t = all_tasks[name]
        progress = children_progress(t.children, all_statuses)
        prefix = "  " * indent
        lines.append(f"{prefix}- {name}/ ({t.status}){progress} @{t.assignee or '-'}")
        task_count += 1
        for child in t.children:
            if child in all_tasks:
                _print_task_tree(child, indent + 1)

    for dir_name in sorted(all_tasks.keys()):
        if not all_tasks[dir_name].parent:
            _print_task_tree(dir_name)

    if task_count == 0:
        lines.append("(no active tasks)")
    lines.append(f"Total: {task_count} active task(s)")
    lines.append("")

    # My tasks
    lines.append("## MY TASKS (Assigned to me)")
    my_task_count = 0

    for t in all_tasks.values():
        if t.assignee == developer and t.status != "done":
            progress = children_progress(t.children, all_statuses)
            lines.append(f"- [{t.priority}] {t.title} ({t.status}){progress}")
            my_task_count += 1

    if my_task_count == 0:
        lines.append("(no tasks assigned to you)")
    lines.append("")

    # Journal file
    lines.append("## JOURNAL FILE")
    journal_file = get_active_journal_file(repo_root)
    if journal_file:
        journal_lines = count_lines(journal_file)
        relative = f"{DIR_WORKFLOW}/{DIR_WORKSPACE}/{developer}/{journal_file.name}"
        lines.append(f"Active file: {relative}")
        lines.append(f"Line count: {journal_lines} / 2000")
        if journal_lines > 1800:
            lines.append("[!] WARNING: Approaching 2000 line limit!")
    else:
        lines.append("No journal file found")
    lines.append("")

    # Packages
    packages_text = get_packages_section(repo_root)
    if packages_text:
        lines.append(packages_text)
        lines.append("")

    # Paths
    lines.append("## PATHS")
    lines.append(f"Workspace: {DIR_WORKFLOW}/{DIR_WORKSPACE}/{developer}/")
    lines.append(f"Tasks: {DIR_WORKFLOW}/{DIR_TASKS}/")
    lines.append(f"Spec: {DIR_WORKFLOW}/{DIR_SPEC}/")
    lines.append("")

    lines.append("========================================")

    return "\n".join(lines)


# =============================================================================
# Record Mode
# =============================================================================

def get_context_record_json(repo_root: Path | None = None) -> dict:
    """Get record-mode context as a dictionary.

    Focused on: my active tasks, git status, current task.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    developer = get_developer(repo_root)
    tasks_dir = get_tasks_dir(repo_root)

    root_git_info = _collect_root_git_info(repo_root)

    # My tasks (single pass — collect statuses and filter by assignee)
    all_tasks_list = list(iter_active_tasks(tasks_dir))
    all_statuses = {t.dir_name: t.status for t in all_tasks_list}

    my_tasks = []
    for t in all_tasks_list:
        if t.assignee == developer:
            done = sum(
                1 for c in t.children
                if all_statuses.get(c) in ("completed", "done")
            )
            my_tasks.append({
                "dir": t.dir_name,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "children": list(t.children),
                "childrenDone": done,
                "parent": t.parent,
                "meta": t.meta,
            })

    # Current task
    current_task_info = None
    current_task = get_current_task(repo_root)
    if current_task:
        source_type, context_key, _ = get_current_task_source(repo_root)
        ct = load_task(repo_root / current_task)
        if ct:
            current_task_info = {
                "path": current_task,
                "name": ct.name,
                "status": ct.status,
                "source": source_type,
                "contextKey": context_key,
            }

    # Package git repos
    pkg_git_info = _collect_package_git_info(
        repo_root,
        discover_unconfigured=not root_git_info["isRepo"],
    )

    result = {
        "developer": developer or "",
        "git": {
            "isRepo": root_git_info["isRepo"],
            "branch": root_git_info["branch"],
            "isClean": root_git_info["isClean"],
            "uncommittedChanges": root_git_info["uncommittedChanges"],
            "recentCommits": root_git_info["recentCommits"],
        },
        "myTasks": my_tasks,
        "currentTask": current_task_info,
    }

    if pkg_git_info:
        result["packageGit"] = pkg_git_info

    return result


def get_context_text_record(repo_root: Path | None = None) -> str:
    """Get context as formatted text for record-session mode.

    Focused output: MY ACTIVE TASKS first (with [!!!] emphasis),
    then GIT STATUS, RECENT COMMITS, CURRENT TASK.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    lines: list[str] = []
    lines.append("========================================")
    lines.append("SESSION CONTEXT (RECORD MODE)")
    lines.append("========================================")
    lines.append("")

    developer = get_developer(repo_root)
    if not developer:
        lines.append(
            f"ERROR: Not initialized. Run: python3 ./{DIR_WORKFLOW}/{DIR_SCRIPTS}/init_developer.py <name>"
        )
        return "\n".join(lines)

    # MY ACTIVE TASKS — first and prominent
    lines.append(f"## [!!!] MY ACTIVE TASKS (Assigned to {developer})")
    lines.append("[!] Review whether any should be archived before recording this session.")
    lines.append("")

    tasks_dir = get_tasks_dir(repo_root)
    my_task_count = 0

    # Single pass — collect all tasks and filter by assignee
    all_statuses = get_all_statuses(tasks_dir)

    for t in iter_active_tasks(tasks_dir):
        if t.assignee == developer:
            progress = children_progress(t.children, all_statuses)
            lines.append(f"- [{t.priority}] {t.title} ({t.status}){progress} — {t.dir_name}")
            my_task_count += 1

    if my_task_count == 0:
        lines.append("(no active tasks assigned to you)")
    lines.append("")

    root_git_info = _collect_root_git_info(repo_root)
    _append_root_git_context(lines, root_git_info)

    # Package git repos — independent sub-repositories
    _append_package_git_context(
        lines,
        _collect_package_git_info(
            repo_root,
            discover_unconfigured=not root_git_info["isRepo"],
        ),
    )

    # CURRENT TASK
    lines.append("## CURRENT TASK")
    current_task = get_current_task(repo_root)
    if current_task:
        source_type, context_key, _ = get_current_task_source(repo_root)
        lines.append(f"Path: {current_task}")
        lines.append(
            f"Source: {source_type}" + (f":{context_key}" if context_key else "")
        )
        ct = load_task(repo_root / current_task)
        if ct:
            lines.append(f"Name: {ct.name}")
            lines.append(f"Status: {ct.status}")
    else:
        lines.append("(none)")
    lines.append("")

    lines.append("========================================")

    return "\n".join(lines)


def output_text(repo_root: Path | None = None) -> None:
    """Output context in text format.

    Args:
        repo_root: Repository root path. Defaults to auto-detected.
    """
    if repo_root is None:
        repo_root = get_repo_root()
    update_hint = _get_update_hint(repo_root)
    if update_hint:
        print(update_hint)
        print("")
    print(get_context_text(repo_root))
