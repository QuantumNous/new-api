"""
Git command execution utility.

Single source of truth for running git commands across all Trellis scripts.
"""

from __future__ import annotations

import subprocess
from pathlib import Path


def run_git(args: list[str], cwd: Path | None = None) -> tuple[int, str, str]:
    """Run a git command and return (returncode, stdout, stderr).

    Uses UTF-8 encoding with -c i18n.logOutputEncoding=UTF-8 to ensure
    consistent output across all platforms (Windows, macOS, Linux).
    """
    try:
        git_args = ["git", "-c", "i18n.logOutputEncoding=UTF-8"] + args
        result = subprocess.run(
            git_args,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)
