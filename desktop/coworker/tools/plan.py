"""The `propose_plan` tool — the agent presents its plan and asks to start executing.

Registered only when the session starts in plan mode. Like `request_directory`, it is
intercepted by the TurnEngine: it emits a PLAN_PROPOSED event and waits for the user's
out-of-band decision. Approval flips the live PermissionEngine out of plan mode (same
session, full exploration context kept); rejection returns the user's feedback so the
agent can revise the plan. The callable here is only a schema carrier + a safe fallback
for surfaces without an approver.
"""

from __future__ import annotations

from aisuite.agents import ToolMetadata, tool


def propose_plan_tool() -> object:
    def propose_plan(plan: str) -> dict:
        """Present your implementation plan to the user for approval. Use this once you
        have explored enough to commit to an approach: summarize what you'll change, in
        which files, and how you'll verify it. If approved, the session switches out of
        read-only plan mode and you implement the plan; if rejected, revise it using the
        feedback in the result. Don't start describing implementation steps as if you
        were doing them — propose first.
        """
        # Real handling lives in the engine (it needs the out-of-band approval round-trip).
        # This body only runs if no approver is wired (e.g. a headless surface).
        return {
            "approved": False,
            "error": "plan approval isn't available in this surface",
        }

    return tool(
        propose_plan,
        metadata=ToolMetadata(
            category="planning",
            risk_level="low",
            capabilities=["plan"],
            description=(
                "Present the implementation plan for user approval; approval exits "
                "read-only plan mode and starts execution."
            ),
        ),
    )
