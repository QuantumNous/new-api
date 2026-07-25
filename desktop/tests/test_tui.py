"""P7 (lite) gate — TUI smoke tests with a scripted provider (no network)."""

from __future__ import annotations

import pytest

from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    ToolCall,
)
from coworker.tui.app import CoworkerApp


def _text_turn(text):
    return AssistantTurn(text=text, finish_reason="stop")


def _tool_turn(name, args, call_id="call_1"):
    return AssistantTurn(
        tool_calls=[ToolCall(id=call_id, name=name, arguments=args)],
        finish_reason="tool_calls",
    )


class _ScriptedProvider(ProviderClient):
    def __init__(self, turns):
        self._turns = list(turns)

    def complete(self, *, model, messages, tools=None, **settings):
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


async def _submit(pilot, text):
    app = pilot.app
    app.query_one("#prompt").value = text
    await pilot.press("enter")
    await app.workers.wait_for_complete()
    await pilot.pause()


@pytest.mark.asyncio
async def test_tui_boots_and_renders_turn(tmp_path):
    app = CoworkerApp(
        workspace=tmp_path,
        provider=_ScriptedProvider([_text_turn("hi, I am the agent")]),
    )
    async with app.run_test() as pilot:
        await _submit(pilot, "hello")
        assert any("hi, I am the agent" in line for line in app.rendered)


@pytest.mark.asyncio
async def test_tui_approval_then_write(tmp_path):
    app = CoworkerApp(
        workspace=tmp_path,
        provider=_ScriptedProvider(
            [
                _tool_turn("write_file", {"path": "made.py", "content": "print(1)\n"}),
                _text_turn("done, wrote made.py"),
            ]
        ),
    )
    async with app.run_test() as pilot:
        app.query_one("#prompt").value = "create made.py"
        await pilot.press("enter")
        await pilot.pause()
        await pilot.press("y")  # approve the write
        await app.workers.wait_for_complete()
        await pilot.pause()

    assert (tmp_path / "made.py").read_text() == "print(1)\n"
    assert any("done, wrote made.py" in line for line in app.rendered)
