"""Todo / plan tool — a structured task list the agent maintains and the UI renders.

Most of the "organized agent" feel in interactive work. Low risk, auto-approved. The list
is held in a `TodoList` the surface can read; `todo_write` replaces it.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import aisuite as ai

_STATUSES = {"pending", "in_progress", "done"}

# Explicit schema — the array-of-objects shape can't be auto-generated reliably, and
# providers reject a bare `list` annotation. Registered via `__coworker_schema__`.
#
# The parameter is `todos`, NOT `items`: a top-level argument key named "items" shadows
# minijinja's `.items()` map method in at least one hosted chat template (Together's
# GLM-5.2, 2026-07-21 — "object is not callable"), 400-ing every request that replays
# the call. Any key name that isn't a minijinja map method is safe; never rename back.
_TODO_SCHEMA = {
    "type": "function",
    "function": {
        "name": "todo_write",
        "description": "Replace the task list. Provide the full list of todos each call.",
        "parameters": {
            "type": "object",
            "properties": {
                "todos": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "content": {"type": "string"},
                            "status": {
                                "type": "string",
                                "enum": ["pending", "in_progress", "done"],
                            },
                        },
                        "required": ["content", "status"],
                    },
                }
            },
            "required": ["todos"],
        },
    },
}


@dataclass
class TodoList:
    items: list[dict] = field(default_factory=list)


def todo_tools(todo: TodoList) -> list:
    def todo_write(todos: list = None, items: list = None) -> dict:
        """Replace the task list. Each todo is an object with `content` and a `status`
        of pending, in_progress, or done."""
        # `items` stays accepted (models that free-style the old name; queued replays).
        normalized = []
        for entry in (todos if todos is not None else items) or []:
            if isinstance(entry, dict):
                status = entry.get("status", "pending")
                if status == "completed":  # common model alias for our "done"
                    status = "done"
                normalized.append(
                    {
                        "content": str(entry.get("content", "")),
                        "status": status if status in _STATUSES else "pending",
                    }
                )
            else:
                normalized.append({"content": str(entry), "status": "pending"})
        todo.items = normalized
        return {"count": len(normalized), "todos": normalized}

    wrapped = ai.tool(
        todo_write,
        metadata=ai.ToolMetadata(
            category="planning",
            risk_level="low",
            capabilities=["todo"],
        ),
    )
    wrapped.__coworker_schema__ = _TODO_SCHEMA
    return [wrapped]
