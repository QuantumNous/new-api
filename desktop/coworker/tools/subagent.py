"""The `explore` tool — a read-only research subagent with its own context window.

Broad questions ("where is retry logic handled?") burn the main session's context on
dozens of file reads. `explore` spawns a child TurnEngine over the same workspace with
read-only tools and a fresh context; only its final report returns to the caller.

The child runs in plan mode — the PermissionEngine hard-blocks writes/shell no matter
what the child decides — with no approver, so it never needs an approval round-trip.
That's what lets `explore` carry low-risk metadata, which in turn makes several explores
in one assistant turn eligible for the engine's parallel execution. No recursion: the
child registry has no `explore` tool.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Optional

import aisuite as ai

from ..engine import TurnEngine
from ..events import EventType
from ..permissions import Mode, PermissionEngine
from ..tools import ToolRegistry
from .files import file_tools
from .git import git_tools
from .search import search_tools

EXPLORER_INSTRUCTIONS = """You are a read-only code explorer working inside the user's workspace. \
Answer the research task you're given by searching and reading the code (`grep`, `read_file`, \
`list_files`, `git_log`, `git_status`, `git_diff`). You cannot write files or run commands.

Your final message is your report — it goes back to the agent that spawned you, not to the \
user. Make it self-contained: answer the task directly, reference code as path:line, quote the \
key snippets, and note anything surprising you found along the way. If you couldn't find \
something, say what you searched so the caller doesn't repeat the same searches."""

_CHILD_MAX_ITERATIONS = 10


def build_explorer_engine(
    *,
    workspace: str | Path,
    provider: Any,
    model: str,
    model_settings: Optional[dict[str, Any]] = None,
    max_iterations: int = _CHILD_MAX_ITERATIONS,
) -> TurnEngine:
    """A child engine with the Code agent's read-only tools and a fresh context."""
    ws = str(Path(workspace).resolve())
    registry = ToolRegistry()
    # Read-only slice of the Code agent's toolset, with the same toolkit replacements
    # (our grep for search_files, our windowed read_file for read_file/read_file_lines).
    replaced = {"search_files", "read_file", "read_file_lines"}
    registry.register_all(
        [
            t
            for t in ai.toolkits.files(root=ws)  # no allow_write → list/read only
            if getattr(t, "__name__", "") not in replaced
        ]
    )
    registry.register_all(file_tools(ws))
    registry.register_all(ai.toolkits.git(root=ws))  # git_status, git_diff
    registry.register_all(git_tools(ws))  # git_log
    registry.register_all(search_tools(ws))  # grep
    permissions = PermissionEngine(workspace_root=Path(ws), mode=Mode.PLAN)
    return TurnEngine(
        provider=provider,
        registry=registry,
        permissions=permissions,
        model=model,
        instructions=EXPLORER_INSTRUCTIONS,
        max_iterations=max_iterations,
        model_settings=model_settings,
    )


def explorer_tools(
    *,
    workspace: str | Path,
    provider: Any,
    model: str,
    model_settings: Optional[dict[str, Any]] = None,
) -> list:
    def explore(task: str) -> dict:
        """Delegate a broad, read-only research task to a subagent with its own fresh
        context window. It searches and reads the workspace, then returns only its final
        report — the intermediate file reads never touch your context. Use it for
        multi-file questions ("where is X handled?", "how does the Y flow work?"); for a
        single known file, just read it yourself. Independent explore calls run in
        parallel when requested together. State the task precisely and say what the
        report should include.

        Args:
            task (str): The research question, with any constraints and the expected
                shape of the report.
        """
        engine = build_explorer_engine(
            workspace=workspace,
            provider=provider,
            model=model,
            model_settings=model_settings,
        )

        async def _run() -> tuple[str, str]:
            report, status = "", "unknown"
            async for event in engine.run(task):
                if event.type == EventType.ASSISTANT_MESSAGE and event.data.get("text"):
                    report = event.data["text"]
                elif event.type == EventType.TURN_END:
                    status = event.data.get("status", "unknown")
                elif event.type == EventType.ERROR:
                    return report, f"error: {event.data.get('error', '')}"
            return report, status

        # Tools execute in a worker thread (no running loop), so asyncio.run is safe.
        report, status = asyncio.run(_run())
        if not report:
            return {"error": f"explorer produced no report (status: {status})"}
        result: dict[str, Any] = {"report": report}
        if status != "completed":
            result["note"] = (
                f"explorer stopped early ({status}); the report may be partial"
            )
        return result

    return [
        ai.tool(
            explore,
            metadata=ai.ToolMetadata(
                category="search",
                risk_level="low",
                capabilities=["search"],
                requires_approval=False,
            ),
        )
    ]
