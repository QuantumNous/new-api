"""Explorer subagent tests — read-only child engine, report return, no recursion."""

from __future__ import annotations

from coworker.permissions import Mode
from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    ToolCall,
)
from coworker.tools import ToolRegistry
from coworker.tools.subagent import build_explorer_engine, explorer_tools


def _text_turn(text):
    return AssistantTurn(text=text, finish_reason="stop")


def _tool_turn(name, args, call_id="call_1"):
    return AssistantTurn(
        tool_calls=[ToolCall(id=call_id, name=name, arguments=args)],
        finish_reason="tool_calls",
    )


class ScriptedProvider(ProviderClient):
    def __init__(self, turns):
        self._turns = list(turns)

    def complete(self, *, model, messages, tools=None, **settings):
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


def test_explorer_engine_is_read_only(tmp_path):
    engine = build_explorer_engine(
        workspace=tmp_path, provider=ScriptedProvider([]), model="gpt-5.5"
    )
    names = set(engine.registry.names())
    assert {
        "grep",
        "read_file",
        "list_files",
        "git_log",
        "git_status",
        "git_diff",
    } <= names
    assert "write_file" not in names and "replace_in_file" not in names
    assert "run_shell" not in names
    assert "explore" not in names  # no recursion
    assert engine.permissions.mode is Mode.PLAN  # writes hard-blocked even if present


def test_explore_returns_final_report(tmp_path):
    (tmp_path / "a.py").write_text("def answer():\n    return 42\n", encoding="utf-8")
    provider = ScriptedProvider(
        [
            _tool_turn("grep", {"pattern": "answer"}),
            _text_turn("Found it: a.py:1 defines answer() returning 42."),
        ]
    )
    reg = ToolRegistry()
    reg.register_all(
        explorer_tools(workspace=tmp_path, provider=provider, model="gpt-5.5")
    )
    spec = reg.get("explore")
    assert spec.metadata.risk_level == "low"  # parallel-safe in the parent engine

    result = reg.execute("explore", {"task": "where is answer defined?"})
    assert result["report"] == "Found it: a.py:1 defines answer() returning 42."
    assert "note" not in result  # completed normally


def test_explore_child_cannot_write(tmp_path):
    provider = ScriptedProvider(
        [
            _tool_turn("write_file", {"path": "evil.py", "content": "x"}),
            _text_turn("I was blocked; reporting findings only."),
        ]
    )
    reg = ToolRegistry()
    reg.register_all(
        explorer_tools(workspace=tmp_path, provider=provider, model="gpt-5.5")
    )
    result = reg.execute("explore", {"task": "look around"})
    assert not (tmp_path / "evil.py").exists()
    assert "report" in result


def test_explore_flags_partial_report_on_iteration_rail(tmp_path):
    # A provider that always asks for another grep: the child hits max_iterations.
    class LoopingProvider(ScriptedProvider):
        def complete(self, **kwargs):
            return _tool_turn("grep", {"pattern": "x"})

    reg = ToolRegistry()
    reg.register_all(
        explorer_tools(
            workspace=tmp_path, provider=LoopingProvider([]), model="gpt-5.5"
        )
    )
    result = reg.execute("explore", {"task": "endless"})
    assert "max_iterations" in result.get(
        "error", ""
    ) or "max_iterations" in result.get("note", "")


def test_code_engine_registers_explore_chat_does_not(tmp_path):
    from coworker.agent import build_engine
    from coworker.agents import code_agent
    from coworker.agents.chat import chat_agent

    class _Stub:
        def complete(self, **kwargs):  # pragma: no cover
            raise NotImplementedError

        def capabilities(self, model):
            return ModelCapabilities()

    engine = build_engine(agent=code_agent(), workspace=tmp_path, provider=_Stub())
    try:
        assert "explore" in engine.registry.names()
    finally:
        engine.executor.close()

    chat = build_engine(agent=chat_agent(), provider=_Stub())
    assert "explore" not in chat.registry.names()
