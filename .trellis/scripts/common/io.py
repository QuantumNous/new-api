"""
File I/O utilities.

Provides read_json / write_json as the single source of truth for JSON file
operations, plus write_text_atomic for the Markdown state files (journal,
index.md) that carry durable session state.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path


JSON_READ_MISSING = "missing"
JSON_READ_INVALID = "invalid"
JSON_READ_UNREADABLE = "unreadable"
JSON_READ_NOT_OBJECT = "not-object"
JSON_READ_EMPTY = "empty"
JSON_READ_UNDECODABLE = "undecodable"


def read_json(path: Path) -> dict | None:
    """Read and parse a JSON file.

    Returns None if the file doesn't exist, is invalid JSON, or can't be read.
    Use this for optional reads only — a caller that is about to overwrite the
    file, or that must tell a parse error from a permissions error, wants
    read_json_checked instead.
    """
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError, UnicodeDecodeError):
        # UnicodeDecodeError is not an OSError. Without it here a non-UTF-8
        # session file raises out of a tolerant read, so the hook path fails
        # instead of degrading to "no active task".
        return None


def read_json_checked(path: Path) -> tuple[dict | None, str | None]:
    """Read a JSON object, keeping the ways it can fail distinguishable.

    Returns ``(data, None)`` on success, or ``(None, reason)`` where reason is
    one of the ``JSON_READ_*`` constants. An empty object counts as a failure:
    a state file that parses to ``{}`` carries none of the fields callers read,
    and treating it as success would silently rebuild it from defaults.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None, JSON_READ_MISSING
    except UnicodeDecodeError:
        # Not an OSError, so it escaped both handlers and surfaced as a
        # traceback. The point of this reader is that every failure mode stays
        # nameable, and "not valid UTF-8" is a different repair from
        # "not valid JSON".
        return None, JSON_READ_UNDECODABLE
    except OSError:
        return None, JSON_READ_UNREADABLE

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None, JSON_READ_INVALID

    if not isinstance(data, dict):
        return None, JSON_READ_NOT_OBJECT
    if not data:
        return None, JSON_READ_EMPTY
    return data, None


def describe_json_read_failure(path: Path, reason: str | None) -> tuple[str, str]:
    """Return ``(what happened, what to do)`` for a read_json_checked reason."""
    if reason == JSON_READ_MISSING:
        return (f"{path}: file not found", "Pass an existing task directory, or create the task first.")
    if reason == JSON_READ_UNREADABLE:
        return (
            f"{path}: could not be read (permission denied or I/O error)",
            "Check the file and directory permissions, then retry.",
        )
    if reason == JSON_READ_INVALID:
        return (
            f"{path}: not valid JSON",
            f"Fix the syntax (e.g. `python3 -m json.tool {path}`), then retry.",
        )
    if reason == JSON_READ_NOT_OBJECT:
        return (
            f"{path}: top level is not a JSON object",
            "Restore the file to a JSON object ({ ... }), then retry.",
        )
    if reason == JSON_READ_EMPTY:
        return (
            f"{path}: contains an empty JSON object",
            "Restore the task fields (or recreate the task), then retry.",
        )
    if reason == JSON_READ_UNDECODABLE:
        return (
            f"{path}: not valid UTF-8 text",
            "Re-save the file as UTF-8 (or restore it from git), then retry.",
        )
    return (f"{path}: could not be loaded", "Inspect the file, then retry.")


def write_json(path: Path, data: dict) -> bool:
    """Write dict to JSON file with pretty formatting.

    The write is atomic: content goes to a temp file in the same directory
    and is then renamed over the target. A crash or Ctrl-C mid-write leaves
    the existing file intact rather than truncated, so a corrupted task.json
    can never make a task silently vanish from `task.py list`.

    Returns True on success, False on error.
    """
    return write_text_atomic(path, json.dumps(data, indent=2, ensure_ascii=False))


def write_text_atomic(path: Path, text: str) -> bool:
    """Write text to a file atomically (temp in same dir, then replace).

    The same never-truncate-in-place guarantee as :func:`write_json`, for the
    Markdown state files that hold durable session state (journal files,
    index.md). A crash or Ctrl-C mid-write leaves the previous content intact
    instead of a half-written record that no retry can classify.

    Returns True on success, False on error.
    """
    try:
        fd, tmp = tempfile.mkstemp(
            dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp"
        )
    except OSError:
        return False

    try:
        try:
            f = os.fdopen(fd, "w", encoding="utf-8")
        except OSError:
            # fdopen never took ownership of fd; close it ourselves.
            os.close(fd)
            raise
        with f:
            f.write(text)
        os.replace(tmp, path)
        return True
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        return False
    except BaseException:
        # Ctrl-C mid-write: drop the temp file, then let the interrupt through.
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
