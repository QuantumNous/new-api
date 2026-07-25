"""Memory tools — the agent's explicit write paths into memory.

`remember` saves a new fact; `memory_update` / `memory_forget` revise or retire one by
the [#id] shown in the known-memories block, so corrections replace stale facts instead
of piling up next to them.
"""

from __future__ import annotations

from typing import Optional

import aisuite as ai

from .base import MemoryStore, Scope

_SCOPES = {s.value for s in Scope}

_META = dict(category="memory", risk_level="low", capabilities=["remember"])


def memory_tools(store: MemoryStore, *, workspace: Optional[str]) -> list:
    def remember(content: str, scope: str = "workspace") -> dict:
        """Save a durable memory (a fact or preference) to recall in future sessions.
        Check the known-memories list first: if one already covers this, use
        memory_update instead of saving a near-duplicate.

        Args:
            content (str): The thing to remember.
            scope (str): "workspace" (this project) or "global" (everywhere).
        """
        chosen = Scope(scope) if scope in _SCOPES else Scope.WORKSPACE
        item = store.add(
            content,
            scope=chosen,
            workspace=workspace if chosen is Scope.WORKSPACE else None,
        )
        return {"id": item.id, "scope": item.scope.value, "saved": True}

    def memory_update(memory_id: int, content: str) -> dict:
        """Rewrite an existing memory with corrected or refined content.

        Args:
            memory_id (int): The memory's id, from the [#id] in the known-memories list.
            content (str): The full corrected memory text (replaces the old text).
        """
        item = store.update(memory_id, content)
        if item is None:
            return {"updated": False, "error": f"no memory with id {memory_id}"}
        return {"updated": True, "id": item.id}

    def memory_forget(memory_id: int) -> dict:
        """Delete a memory that turned out to be wrong or is no longer true.

        Args:
            memory_id (int): The memory's id, from the [#id] in the known-memories list.
        """
        if store.delete(memory_id):
            return {"deleted": True, "id": memory_id}
        return {"deleted": False, "error": f"no memory with id {memory_id}"}

    return [
        ai.tool(fn, metadata=ai.ToolMetadata(**_META))
        for fn in (remember, memory_update, memory_forget)
    ]
