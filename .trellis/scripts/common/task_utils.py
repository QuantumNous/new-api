#!/usr/bin/env python3
"""
Task utility functions.

Provides:
    is_within_tasks_dir - Check a resolved path is a task directly under tasks/
    find_task_by_name   - Find task directory by name
    resolve_task_dir    - Resolve task directory from name, relative, or absolute path
    archive_destination_for - Path a task would be archived to
    archive_task_dir    - Archive task to monthly directory
    run_task_hooks      - Run lifecycle hooks for task events
"""

from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from .paths import get_repo_root, get_tasks_dir

if TYPE_CHECKING:
    import subprocess


# =============================================================================
# Path Safety
# =============================================================================

def is_within_tasks_dir(task_dir_abs: Path, repo_root: Path | None = None) -> bool:
    """Check that a resolved task directory really is a task under the tasks dir.

    A real task lives directly at ``.trellis/tasks/<name>``. This returns True
    only when ``task_dir_abs`` is an immediate child of the tasks directory.

    Narrows ``resolve_task_dir``'s containment for archive: that chokepoint
    accepts anything under the tasks dir, including a task already in
    ``archive/<YYYY-MM>/``. This rejects those, plus the tasks dir itself, so
    ``shutil.move`` never re-archives an archived task into a nested copy.
    """
    if repo_root is None:
        repo_root = get_repo_root()
    try:
        resolved = task_dir_abs.resolve()
        tasks_resolved = get_tasks_dir(repo_root).resolve()
    except (OSError, RuntimeError):
        return False
    if resolved.parent != tasks_resolved:
        return False
    return resolved.name != "archive"


# =============================================================================
# Task Lookup
# =============================================================================

def find_task_by_name(task_name: str, tasks_dir: Path) -> Path | None:
    """Find task directory by name (exact or suffix match).

    A task name is a single directory name under ``tasks_dir``, never a path:
    names carrying a separator or a dot segment are rejected before the join,
    so ``".."`` cannot hand back the tasks dir's own parent.

    An ambiguous suffix (two tasks created on different days with the same
    slug) is a failure, not a coin flip — ``iterdir()`` order is filesystem
    order, so silently picking the first match picks a different task on a
    different machine.

    Args:
        task_name: Task name to find.
        tasks_dir: Tasks directory path.

    Returns:
        Absolute path to task directory, or None if not found or ambiguous.
    """
    if not task_name or not tasks_dir or not tasks_dir.is_dir():
        return None

    if "/" in task_name or "\\" in task_name or task_name in (".", ".."):
        print(f"Error: invalid task name: {task_name}", file=sys.stderr)
        return None

    # Try exact match first
    exact_match = tasks_dir / task_name
    if exact_match.is_dir():
        return exact_match

    # Try suffix match (e.g., "my-task" matches "01-21-my-task")
    matches = sorted(
        d for d in tasks_dir.iterdir()
        if d.is_dir() and d.name.endswith(f"-{task_name}")
    )
    if len(matches) == 1:
        return matches[0]
    if matches:
        print(f"Error: ambiguous task name '{task_name}' matches:", file=sys.stderr)
        for match in matches:
            print(f"  - {match.name}", file=sys.stderr)
        print("Pass the full task directory name.", file=sys.stderr)

    return None


# =============================================================================
# Archive Operations
# =============================================================================

def archive_destination_for(task_dir_abs: Path) -> Path:
    """Path a task would be archived to: <tasks>/archive/<YYYY-MM>/<name>."""
    tasks_dir = task_dir_abs.parent
    year_month = datetime.now().strftime("%Y-%m")
    return tasks_dir / "archive" / year_month / task_dir_abs.name


def archive_task_dir(task_dir_abs: Path, repo_root: Path | None = None) -> Path | None:
    """Archive a task directory to archive/{YYYY-MM}/.

    Args:
        task_dir_abs: Absolute path to task directory.
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        Path to archived directory, or None on error.
    """
    if not task_dir_abs.is_dir():
        print(f"Error: task directory not found: {task_dir_abs}", file=sys.stderr)
        return None

    dest = archive_destination_for(task_dir_abs)
    month_dir = dest.parent

    # Create archive directory
    try:
        month_dir.mkdir(parents=True, exist_ok=True)
    except (OSError, IOError) as e:
        print(f"Error: Failed to create archive directory: {e}", file=sys.stderr)
        return None

    # shutil.move into an existing directory moves the source *inside* it,
    # producing archive/<month>/<task>/<task>/ and returning a path that is not
    # where the task actually landed. That wrong path then flows into the
    # printed result, the after_archive hook's TASK_JSON_PATH, and auto-commit
    # staging, so refuse before the move instead.
    if dest.exists():
        print(
            f"Error: refusing to archive {task_dir_abs}: "
            f"archive destination already exists: {dest}",
            file=sys.stderr,
        )
        print(
            "Move or rename the existing archived task, then retry.",
            file=sys.stderr,
        )
        return None

    try:
        shutil.move(str(task_dir_abs), str(dest))
    except (OSError, IOError, shutil.Error) as e:
        print(f"Error: Failed to move task to archive: {e}", file=sys.stderr)
        return None

    return dest


def archive_task_complete(
    task_dir_abs: Path,
    repo_root: Path | None = None
) -> dict[str, str]:
    """Complete archive workflow: archive directory.

    Args:
        task_dir_abs: Absolute path to task directory.
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        Dict with archive result info.
    """
    if not task_dir_abs.is_dir():
        print(f"Error: task directory not found: {task_dir_abs}", file=sys.stderr)
        return {}

    archive_dest = archive_task_dir(task_dir_abs, repo_root)
    if archive_dest:
        return {"archived_to": str(archive_dest)}

    return {}


# =============================================================================
# Task Directory Resolution
# =============================================================================

def resolve_task_dir(target_dir: str, repo_root: Path) -> Path | None:
    """Resolve task directory to an absolute path inside the tasks directory.

    Supports:
    - Absolute path: /path/to/task
    - Relative path: .trellis/tasks/01-31-my-task
    - Task name: my-task (uses find_task_by_name for lookup)

    This is the containment chokepoint for every command that accepts a task
    directory argument. The candidate is resolved (following symlinks) and must
    land strictly under ``.trellis/tasks/``; archived tasks under
    ``archive/<YYYY-MM>/`` qualify. Traversal (``../victim``), absolute paths
    outside the repo, a task dir symlinked out of the tasks tree, and the
    tasks directory itself are all rejected here so no caller has to re-check.
    The containment base is the tasks dir's own real location, so a
    ``.trellis`` that is itself a symlink into a shared store (#567) works.

    Args:
        target_dir: Task directory specification.
        repo_root: Repository root path.

    Returns:
        Absolute path spelled through the repo's own tasks dir (in-repo
        lexical form), or None when it is not a location inside the tasks
        directory (an error naming the path is printed to stderr).
    """
    if not target_dir:
        print("Error: task directory is required", file=sys.stderr)
        return None

    normalized = target_dir.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]

    tasks_dir = get_tasks_dir(repo_root)

    if Path(target_dir).is_absolute():
        candidate = Path(target_dir)
    elif "/" in normalized or normalized.startswith(".trellis"):
        # Relative path (contains path separator or starts with .trellis)
        candidate = repo_root / Path(normalized)
    else:
        # Task name - must resolve inside the tasks directory. The historical
        # fallback to repo_root/<name> only ever produced a path the check
        # below rejects, so a miss ends here instead.
        candidate = find_task_by_name(target_dir, tasks_dir)
        if candidate is None:
            # find_task_by_name reports invalid names and ambiguity itself.
            print(
                f"Error: could not resolve task '{target_dir}' under {tasks_dir}",
                file=sys.stderr,
            )
            return None

    try:
        resolved = candidate.resolve()
        tasks_lexical = get_tasks_dir(repo_root.resolve())
        tasks_resolved = tasks_lexical.resolve()
    except (OSError, RuntimeError) as e:
        print(f"Error: could not resolve task directory '{target_dir}': {e}", file=sys.stderr)
        return None

    if resolved == tasks_resolved:
        print(
            f"Error: refusing to use '{target_dir}': {tasks_resolved} is the tasks "
            "directory itself, not a task",
            file=sys.stderr,
        )
        return None

    if tasks_resolved not in resolved.parents:
        print(
            f"Error: refusing to use '{target_dir}': {resolved} is outside {tasks_resolved}",
            file=sys.stderr,
        )
        return None

    # Hand back the path spelled through the repo's own tasks dir rather than
    # `resolved`: `.trellis` may be a symlink into a store outside the repo
    # (#567), in which case `resolved` sits outside the repo even though the
    # task is legitimate, and callers converting to a repo-relative ref for
    # storage would refuse it.
    return tasks_lexical / resolved.relative_to(tasks_resolved)


# =============================================================================
# Lifecycle Hooks
# =============================================================================

HOOK_TIMEOUT_SECONDS = 60
HOOK_KILL_GRACE_SECONDS = 5
HOOK_OUTPUT_LIMIT = 2000


def _kill_hook_tree(proc: subprocess.Popen[str]) -> None:
    """Kill a timed-out hook's whole process tree, not just the shell.

    With ``shell=True`` the direct child is the shell; the actual work runs in
    its children. Killing only the shell leaves grandchildren alive holding the
    inherited stdout/stderr pipes, and collecting output afterwards then blocks
    until those orphans exit — the exact "command that never returns" the
    timeout exists to prevent.

    POSIX: the hook is started with ``start_new_session=True``, so the shell and
    every descendant share one fresh process group; SIGKILL the group.
    Windows: ``taskkill /F /T`` walks the tree (best effort).
    Either way ``proc.kill()`` is the fallback.

    Limitation: a hook that calls ``setsid`` itself leaves the group and
    survives this. Accepted and out of scope — a hook is arbitrary code, and the
    timeout is a liveness guarantee, not a containment boundary.
    """
    import os
    import signal
    import subprocess

    if os.name == "posix":
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            return
        except (ProcessLookupError, PermissionError, OSError):
            pass
    else:
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True,
            )
        except (OSError, ValueError):
            pass

    try:
        proc.kill()
    except OSError:
        pass


def _release_hook_process(proc: subprocess.Popen[str]) -> None:
    """Close our pipe ends and reap a finished hook under a bound.

    ``Popen`` used as a context manager calls ``wait()`` with no timeout when
    the block exits. That is the one place the liveness guarantee could still
    be lost: if ``_kill_hook_tree`` failed outright — both the process-group
    kill and the direct kill raising — the lifecycle command would block there
    forever, which is the exact hang the timeout exists to prevent.
    """
    import subprocess

    for stream in (proc.stdout, proc.stderr, proc.stdin):
        if stream is not None:
            try:
                stream.close()
            except OSError:
                pass
    try:
        proc.wait(timeout=HOOK_KILL_GRACE_SECONDS)
    except (subprocess.TimeoutExpired, OSError, ValueError):
        # Leaves a zombie until this process exits. Fail-open and bounded beats
        # a task command that never returns.
        pass


def _decode_hook_output(raw: object) -> str:
    """TimeoutExpired carries bytes or str depending on the platform."""
    if raw is None:
        return ""
    if isinstance(raw, bytes):
        return raw.decode("utf-8", errors="replace")
    return str(raw)


def _print_hook_stream(name: str, text: str) -> None:
    """Print a captured hook stream to stderr, truncated."""
    text = text.strip()
    if not text:
        return
    if len(text) > HOOK_OUTPUT_LIMIT:
        text = (
            text[:HOOK_OUTPUT_LIMIT]
            + f"\n… ({len(text) - HOOK_OUTPUT_LIMIT} more characters truncated)"
        )
    print(f"  {name}:", file=sys.stderr)
    for line in text.splitlines():
        print(f"    {line}", file=sys.stderr)


def run_task_hooks(event: str, task_json_path: Path, repo_root: Path) -> None:
    """Run lifecycle hooks for a task event.

    Hooks are shell commands read from ``.trellis/config.yaml`` and executed
    with ``shell=True`` from the repo root — see the trust boundary note in
    ``.trellis/spec/cli/backend/script-conventions.md``.

    Fail-open by design: a broken hook warns and the lifecycle command
    continues. The warning names the event, command, exit status, and both
    captured streams, because a hook whose only symptom is "nothing happened"
    is undebuggable. A hook that hangs is bounded by
    ``HOOK_TIMEOUT_SECONDS``; output is captured, so without the timeout the
    user sees a task command that never returns and prints nothing. On timeout
    the hook's entire process tree is killed (see ``_kill_hook_tree``) and
    output is collected under a bounded grace, so a surviving grandchild
    holding the pipes cannot re-create that same hang. Cleanup is bounded for
    the same reason — see ``_release_hook_process``.

    Args:
        event: Event name (e.g. "after_create").
        task_json_path: Absolute path to the task's task.json.
        repo_root: Repository root for cwd and config lookup.
    """
    import os
    import subprocess

    from .config import get_hooks
    from .log import Colors, colored

    commands = get_hooks(event, repo_root)
    if not commands:
        return

    env = {**os.environ, "TASK_JSON_PATH": str(task_json_path)}

    # POSIX only: a fresh session puts the shell and every descendant in one
    # process group, which is what makes the timeout kill the whole tree.
    popen_kwargs: dict = {}
    if os.name == "posix":
        popen_kwargs["start_new_session"] = True

    for cmd in commands:
        proc = None
        try:
            proc = subprocess.Popen(
                cmd,
                shell=True,
                cwd=repo_root,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                **popen_kwargs,
            )
            try:
                stdout, stderr = proc.communicate(timeout=HOOK_TIMEOUT_SECONDS)
            except subprocess.TimeoutExpired as e:
                _kill_hook_tree(proc)
                stdout = _decode_hook_output(e.stdout)
                stderr = _decode_hook_output(e.stderr)
                try:
                    # Bounded: an orphan that escaped the kill still holds
                    # the pipes, and waiting on it forever here would be
                    # the very hang the timeout prevents.
                    rest_out, rest_err = proc.communicate(
                        timeout=HOOK_KILL_GRACE_SECONDS
                    )
                    stdout = rest_out or stdout
                    stderr = rest_err or stderr
                except (subprocess.TimeoutExpired, OSError, ValueError):
                    pass
                print(
                    colored(
                        f"[WARN] Hook timed out ({event}) after "
                        f"{HOOK_TIMEOUT_SECONDS}s: {cmd}",
                        Colors.YELLOW,
                    ),
                    file=sys.stderr,
                )
                print(f"  cwd: {repo_root}", file=sys.stderr)
                _print_hook_stream("stdout", stdout)
                _print_hook_stream("stderr", stderr)
                continue

            if proc.returncode != 0:
                print(
                    colored(
                        f"[WARN] Hook failed ({event}): exit {proc.returncode}: {cmd}",
                        Colors.YELLOW,
                    ),
                    file=sys.stderr,
                )
                print(f"  cwd: {repo_root}", file=sys.stderr)
                _print_hook_stream("stdout", stdout or "")
                _print_hook_stream("stderr", stderr or "")
        except Exception as e:
            print(
                colored(
                    f"[WARN] Hook error ({event}): {cmd} — {type(e).__name__}: {e}",
                    Colors.YELLOW,
                ),
                file=sys.stderr,
            )


# =============================================================================
# Main Entry (for testing)
# =============================================================================

if __name__ == "__main__":
    repo = get_repo_root()
    tasks = get_tasks_dir(repo)

    print(f"Tasks dir: {tasks}")
    print(f"resolve_task_dir('.trellis/tasks/test'): {resolve_task_dir('.trellis/tasks/test', repo)}")
    print(f"resolve_task_dir('../test'): {resolve_task_dir('../test', repo)}")
