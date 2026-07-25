"""The `request_directory` tool — the agent asks the user to grant access to a folder.

Unlike ordinary tools, this one is intercepted by the TurnEngine: it emits a DIRECTORY_REQUESTED
event and waits for the user to pick/approve a folder out-of-band (the GUI surfaces a prompt),
then the live session gains that root and the tool result tells the agent the outcome. The
callable here is only a schema carrier + a safe fallback for surfaces without a requester.
"""

from __future__ import annotations

from aisuite.agents import ToolMetadata, tool


def request_directory_tool() -> object:
    def request_directory(reason: str, path: str = "", writable: bool = False) -> dict:
        """Ask the user for access to a directory when the task needs files outside the current
        ones (e.g. to read a project the user mentioned, or to save a deliverable somewhere
        specific). Explain why in `reason`; optionally suggest a `path` and whether you need
        `writable` access. The user picks/approves the folder; the result says whether it was
        granted. Do not use this to escape sandboxing — only to serve the user's request.
        """
        # Real handling lives in the engine (it needs the out-of-band GUI round-trip). This body
        # only runs if no requester is wired (e.g. a headless surface).
        return {
            "granted": False,
            "error": "directory requests aren't available in this surface",
        }

    return tool(
        request_directory,
        metadata=ToolMetadata(
            category="filesystem",
            risk_level="low",
            capabilities=["request_directory"],
            description=(
                "Ask the user to grant access to a directory (read-only or read-write) when the "
                "task needs files outside the directories you already have."
            ),
        ),
    )
