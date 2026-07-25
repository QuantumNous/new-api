"""Session environment context — injected into the system prompt at engine build.

Saves the agent 3-4 discovery tool calls every session (pwd, uname, git status, git log)
by telling it up front where it is and what state the workspace is in. The git snapshot is
point-in-time; the prompt labels it as such so the agent re-checks before relying on it.
"""

from __future__ import annotations

import platform as _platform
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Optional


def _git(workspace: Path, *args: str) -> Optional[str]:
    try:
        out = subprocess.run(
            ["git", "-C", str(workspace), *args],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    return out.stdout.strip()


def _git_snapshot(workspace: Path) -> list[str]:
    if _git(workspace, "rev-parse", "--is-inside-work-tree") != "true":
        return ["Git: not a git repository"]

    lines = []
    branch = _git(workspace, "rev-parse", "--abbrev-ref", "HEAD") or "(unknown)"
    lines.append(f"Git branch: {branch}")

    status = _git(workspace, "status", "--porcelain")
    if status is not None:
        changed = status.splitlines()
        if not changed:
            lines.append("Git status: clean")
        else:
            shown = "\n".join(changed[:20])
            more = f"\n… and {len(changed) - 20} more" if len(changed) > 20 else ""
            lines.append(f"Git status ({len(changed)} changed):\n{shown}{more}")

    log = _git(workspace, "log", "-n5", "--pretty=format:%h %s")
    if log:
        lines.append(f"Recent commits:\n{log}")
    return lines


def environment_context(workspace: str | Path) -> str:
    """A system-prompt block describing the session's environment and git state."""
    ws = Path(workspace).expanduser().resolve()
    mac = _platform.mac_ver()[0]
    os_name = f"macOS {mac}" if mac else f"{_platform.system()} {_platform.release()}"
    lines = [
        f"Workspace: {ws}",
        f"Platform: {sys.platform} ({os_name})",
        f"Today's date: {date.today().isoformat()}",
        *_git_snapshot(ws),
    ]
    body = "\n".join(lines)
    return (
        "Environment (snapshot from session start — verify before relying on git "
        f"state):\n<environment>\n{body}\n</environment>\n"
        "Folder scope: work inside the workspace and any folders the user has granted. Do not "
        "read or list other locations (home directory sweeps, ~/Desktop, ~/Downloads, photo "
        "libraries, etc.) — not even via shell commands like find/ls/grep. On macOS every such "
        "touch fires an OS permission prompt the user can't connect to any action they took. "
        "If a task needs files elsewhere, ask first with request_directory."
    )
