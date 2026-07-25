"""The `ask_user` tool — the agent asks the user a question and waits for the answer.

The general human-in-the-loop Q&A primitive, modelled on Claude Code's own AskUserQuestion: a
question, optional quick-reply `options`, and (by default) an always-available free-text escape —
plus `multi` for choose-several. Like `request_directory`, it's intercepted by the TurnEngine: the
question becomes an Inbox item (answerable inline in the live session, or from the Inbox when the
session runs unattended), the agent suspends until it's resolved, and the answer comes back as the
tool result. The callable here is only a schema carrier + a safe fallback.
"""

from __future__ import annotations

from aisuite.agents import ToolMetadata, tool


def ask_user_tool() -> object:
    def ask_user(
        question: str,
        options: list[str] | None = None,
        allow_text: bool = True,
        multi: bool = False,
        header: str = "",
    ) -> dict:
        """Ask the user a question and wait for their answer — use when you genuinely need a human
        decision or information you can't infer (a preference, a missing fact, a choice between real
        alternatives). Prefer this over guessing or stalling.

        - `question`: the full question, in plain language.
        - `options`: optional quick-reply choices. Offer them when the answer is one of a few
          discrete alternatives; leave empty for an open-ended question.
        - `allow_text`: keep a free-text answer available even when you give options (the default;
          this is the "Other / type your own" escape). Set False only when the options are
          exhaustive and a typed answer would be meaningless.
        - `multi`: allow the user to pick more than one option.
        - `header`: a short (≤ ~12 char) label for the Inbox card chip, e.g. "Region".

        Returns `{"answer": "..."}` — the chosen option(s) or the typed text. Don't ask what you can
        reasonably decide yourself; reserve this for choices that are actually the user's to make.
        """
        # Real handling lives in the engine (it needs the out-of-band Inbox round-trip). This body
        # only runs if no question_asker is wired (e.g. a headless surface).
        return {
            "answer": "",
            "error": "asking the user isn't available in this surface",
        }

    return tool(
        ask_user,
        metadata=ToolMetadata(
            category="interaction",
            risk_level="low",
            capabilities=["ask_user"],
            description=(
                "Ask the user a question (free-text or multiple-choice) and wait for their answer. "
                "Use for decisions or information only the user can provide."
            ),
        ),
    )
