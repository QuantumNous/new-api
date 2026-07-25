"""Plan mode tests — read-only enforcement + the propose_plan approval round-trip."""

from __future__ import annotations

import asyncio

import aisuite as ai
from coworker.engine import TurnEngine
from coworker.events import EventType
from coworker.permissions import Mode, PermissionEngine
from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    ToolCall,
)
from coworker.tools import ToolRegistry
from coworker.tools.plan import propose_plan_tool


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


def _plan_engine(tmp_path, turns, *, plan_approver=None):
    registry = ToolRegistry()
    registry.register_all(ai.toolkits.files(root=str(tmp_path), allow_write=True))
    registry.register(propose_plan_tool())
    permissions = PermissionEngine(workspace_root=tmp_path, mode=Mode.PLAN)
    engine = TurnEngine(
        provider=ScriptedProvider(turns),
        registry=registry,
        permissions=permissions,
        model="gpt-5.5",
        plan_approver=plan_approver,
    )
    return engine, permissions


def _collect(engine, user_input):
    async def _run():
        return [ev async for ev in engine.run(user_input)]

    return asyncio.run(_run())


def test_plan_mode_blocks_writes_without_asking(tmp_path):
    engine, _ = _plan_engine(
        tmp_path,
        [
            _tool_turn("write_file", {"path": "x.py", "content": "x"}),
            _text_turn("understood, planning instead"),
        ],
    )
    events = _collect(engine, "fix the bug")
    types = [e.type for e in events]
    assert EventType.PERMISSION_REQUIRED not in types  # blocked, not escalated
    assert not (tmp_path / "x.py").exists()
    finished = next(e for e in events if e.type == EventType.TOOL_FINISHED)
    assert finished.data["status"] == "denied"
    assert any(
        m.get("role") == "tool" and "plan mode is read-only" in m["content"]
        for m in engine.messages
    )


def test_plan_approval_flips_mode_and_executes(tmp_path):
    seen_plans = []

    async def approve(args, tool_call_id=None):
        seen_plans.append(args.get("plan"))
        return {"approved": True, "mode": "auto"}

    engine, permissions = _plan_engine(
        tmp_path,
        [
            _tool_turn("propose_plan", {"plan": "1. write x.py  2. verify"}),
            _tool_turn("write_file", {"path": "x.py", "content": "done\n"}, "call_2"),
            _text_turn("implemented"),
        ],
        plan_approver=approve,
    )
    events = _collect(engine, "fix the bug")
    types = [e.type for e in events]
    assert EventType.PLAN_PROPOSED in types
    assert seen_plans == ["1. write x.py  2. verify"]
    # same session flipped to auto and executed the write with no approval prompt
    assert permissions.mode is Mode.AUTO
    assert EventType.PERMISSION_REQUIRED not in types
    assert (tmp_path / "x.py").read_text() == "done\n"


def test_plan_rejection_keeps_plan_mode_and_returns_feedback(tmp_path):
    async def reject(args, tool_call_id=None):
        return {"approved": False, "feedback": "don't touch x.py, fix y.py instead"}

    engine, permissions = _plan_engine(
        tmp_path,
        [
            _tool_turn("propose_plan", {"plan": "edit x.py"}),
            _text_turn("revising the plan"),
        ],
        plan_approver=reject,
    )
    events = _collect(engine, "fix the bug")
    assert permissions.mode is Mode.PLAN  # still read-only
    finished = next(e for e in events if e.type == EventType.TOOL_FINISHED)
    assert finished.data["status"] == "denied"
    assert any(
        m.get("role") == "tool" and "fix y.py instead" in m["content"]
        for m in engine.messages
    )


def test_propose_plan_without_approver_noops(tmp_path):
    engine, permissions = _plan_engine(
        tmp_path,
        [_tool_turn("propose_plan", {"plan": "p"}), _text_turn("ok")],
    )
    events = _collect(engine, "go")
    assert EventType.PLAN_PROPOSED not in [e.type for e in events]
    assert permissions.mode is Mode.PLAN
    assert any(
        m.get("role") == "tool" and "isn't available" in m["content"]
        for m in engine.messages
    )


# -- build_engine wiring ----------------------------------------------------------


class _Stub:
    def complete(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def capabilities(self, model):
        return ModelCapabilities()


def test_build_engine_plan_mode_wiring(tmp_path):
    from coworker.agent import build_engine
    from coworker.agents import code_agent

    engine = build_engine(
        agent=code_agent(), workspace=tmp_path, provider=_Stub(), mode=Mode.PLAN
    )
    try:
        assert "propose_plan" in engine.registry.names()
        # the per-turn reminder is live while planning, gone after the flip
        assert "Plan mode is active" in engine.context_provider()
        engine.permissions.mode = Mode.INTERACTIVE
        assert "Plan mode is active" not in engine.context_provider()
    finally:
        engine.executor.close()


def test_build_engine_interactive_registers_tool_without_reminder(tmp_path):
    from coworker.agent import build_engine
    from coworker.agents import code_agent

    # The tool is always registered (the GUI can flip a live session into plan mode via
    # set_mode), but the per-turn reminder only appears while actually planning.
    engine = build_engine(agent=code_agent(), workspace=tmp_path, provider=_Stub())
    try:
        assert "propose_plan" in engine.registry.names()
        assert "Plan mode is active" not in engine.context_provider()
    finally:
        engine.executor.close()


def test_discuss_mode_blocks_writes_without_plan_pressure(tmp_path):
    engine, permissions = _plan_engine(
        tmp_path,
        [
            _tool_turn("write_file", {"path": "x.py", "content": "x"}),
            _text_turn("here's what I'd change instead"),
        ],
    )
    permissions.mode = Mode.DISCUSS
    events = _collect(engine, "tweak x.py")
    assert not (tmp_path / "x.py").exists()
    assert any(
        m.get("role") == "tool" and "discuss mode is read-only" in m["content"]
        for m in engine.messages
    )


def test_propose_plan_in_discuss_mode_says_describe_instead(tmp_path):
    engine, permissions = _plan_engine(
        tmp_path,
        [_tool_turn("propose_plan", {"plan": "p"}), _text_turn("ok, describing")],
    )
    permissions.mode = Mode.DISCUSS
    events = _collect(engine, "go")
    assert EventType.PLAN_PROPOSED not in [e.type for e in events]
    assert any(
        m.get("role") == "tool" and "describe the proposed changes" in m["content"]
        for m in engine.messages
    )


def test_build_engine_discuss_reminder_not_plan_contract(tmp_path):
    from coworker.agent import build_engine
    from coworker.agents import code_agent

    engine = build_engine(
        agent=code_agent(), workspace=tmp_path, provider=_Stub(), mode=Mode.DISCUSS
    )
    try:
        ctx = engine.context_provider()
        assert "Discuss mode is active" in ctx
        assert "propose_plan" not in ctx  # no planning pressure in discuss mode
    finally:
        engine.executor.close()


def test_propose_plan_outside_plan_mode_is_rejected(tmp_path):
    async def approve(args, tool_call_id=None):  # pragma: no cover - must not be called
        raise AssertionError("approver should not run outside plan mode")

    engine, permissions = _plan_engine(
        tmp_path,
        [_tool_turn("propose_plan", {"plan": "p"}), _text_turn("ok, proceeding")],
        plan_approver=approve,
    )
    permissions.mode = Mode.INTERACTIVE  # session was flipped out of plan mode
    events = _collect(engine, "go")
    assert EventType.PLAN_PROPOSED not in [e.type for e in events]
    assert any(
        m.get("role") == "tool" and "not in plan mode" in m["content"]
        for m in engine.messages
    )
