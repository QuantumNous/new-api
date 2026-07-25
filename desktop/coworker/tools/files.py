"""Line-numbered file reading (`read_file`) — replaces the aisuite toolkit's reader.

The toolkit's `read_file` returns raw text (the agent can't cite path:line without
counting) and raises outright on large files (the agent errors and guesses). This one
returns `cat -n`-style numbered lines, windows big files instead of failing, and tells
the agent how to continue reading. Read-only, workspace-scoped.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import aisuite as ai

_DEFAULT_MAX_LINES = 2000
_MAX_LINE_CHARS = 500

_SCHEMA = {
    "type": "function",
    "function": {
        "name": "read_file",
        "description": (
            "Read a text file, returning numbered lines ('   12\\ttext') so code can be "
            "referenced as path:line. Large files are windowed: pass start_line to continue "
            "where the previous read stopped. Read-only."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path, relative to the workspace.",
                },
                "start_line": {
                    "type": "integer",
                    "description": "First line to read, 1-based (default 1).",
                },
                "max_lines": {
                    "type": "integer",
                    "description": f"How many lines (default {_DEFAULT_MAX_LINES}).",
                },
            },
            "required": ["path"],
        },
    },
}


def file_tools(workspace: str) -> list:
    root = Path(workspace).resolve()

    def read_file(
        path: str,
        start_line: int = 1,
        max_lines: int = _DEFAULT_MAX_LINES,
    ) -> dict[str, Any]:
        start = start_line if isinstance(start_line, int) and start_line > 0 else 1
        n = (
            max_lines
            if isinstance(max_lines, int) and max_lines > 0
            else _DEFAULT_MAX_LINES
        )
        n = min(n, _DEFAULT_MAX_LINES)
        target = (root / path).resolve()
        try:
            target.relative_to(root)  # keep reads inside the workspace
        except ValueError:
            return {"error": "path escapes the workspace"}
        if not target.is_file():
            return {"error": f"not a file: {path}"}

        selected: list[str] = []
        total = 0
        try:
            with open(target, "r", encoding="utf-8", errors="replace") as fh:
                for i, line in enumerate(fh, 1):
                    total = i
                    if i < start or len(selected) >= n:
                        continue
                    text = line.rstrip("\n")
                    if len(text) > _MAX_LINE_CHARS:
                        text = text[:_MAX_LINE_CHARS] + "… (line truncated)"
                    selected.append(f"{i:>6}\t{text}")
        except OSError as exc:
            return {"error": f"read failed: {exc}"}

        end = start + len(selected) - 1 if selected else start - 1
        result: dict[str, Any] = {
            "path": str(target.relative_to(root)),
            "start_line": start,
            "end_line": end,
            "total_lines": total,
            "content": "\n".join(selected),
        }
        if end < total:
            result["note"] = (
                f"showing lines {start}-{end} of {total}; "
                f"call again with start_line={end + 1} to continue"
            )
        return result

    read_file.__name__ = "read_file"
    read_file.__doc__ = _SCHEMA["function"]["description"]
    read_file.__aisuite_tool_metadata__ = ai.ToolMetadata(
        name="read_file",
        category="filesystem",
        risk_level="low",
        capabilities=["read"],
        requires_approval=False,
    )
    read_file.__coworker_schema__ = _SCHEMA
    return [read_file]
