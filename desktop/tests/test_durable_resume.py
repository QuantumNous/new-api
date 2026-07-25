"""Durable resume: a prompt pending when the process 'restarts' is answered later and the turn
continues — rebuilt from the persisted thread, with no live await."""

import asyncio

from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    ToolCall,
)
from coworker.server.manager import SessionManager


class ScriptedProvider(ProviderClient):
    def __init__(self, turns):
        self._turns = list(turns)

    def complete(self, *, model, messages, tools=None, **settings):
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


def _tool(name, args, call_id):
    return AssistantTurn(tool_calls=[ToolCall(id=call_id, name=name, arguments=args)])


def _text(text):
    return AssistantTurn(text=text, finish_reason="stop")


async def _run_until_pending(mgr, sid, engine):
    async def first():
        async for _ in engine.run("go"):
            pass

    task = asyncio.create_task(first())
    pend = []
    for _ in range(100):
        await asyncio.sleep(0.02)
        pend = mgr.inbox.pending(sid)
        if pend:
            break
    assert pend, "prompt never became a pending Inbox item"
    # simulate a restart: cancel the suspended turn + drop the live engine
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    mgr._engines.pop(sid, None)
    mgr.mark_idle(sid)
    return pend[0]


def _final_assistant_texts(mgr, sid):
    rec = mgr.session_store.load(sid)
    return [
        m.get("content")
        for m in rec.messages
        if m.get("role") == "assistant" and m.get("content")
    ]


def test_durable_resume_question(tmp_path):
    mgr = SessionManager(
        workspace=tmp_path,
        provider=ScriptedProvider(
            [
                _tool(
                    "ask_user",
                    {
                        "question": "Which region?",
                        "options": ["us-east-1", "us-west-2"],
                    },
                    "call_q",
                ),
                _text("You chose us-west-2."),
            ]
        ),
    )
    sid = "dur-q"

    async def scenario():
        engine = mgr.get_engine(sid, agent="cowork", workspace=str(tmp_path))
        item = await _run_until_pending(mgr, sid, engine)
        assert item.kind == "question" and item.tool_call_id == "call_q"
        await mgr.resolve_inbox(item.id, "us-west-2")  # restart-style resume

    asyncio.run(scenario())
    assert any("us-west-2" in (t or "") for t in _final_assistant_texts(mgr, sid))
    assert mgr.inbox.pending(sid) == []  # nothing left pending


def test_durable_resume_approval_executes_tool(tmp_path):
    # The model wants a write (needs approval); on durable resume "allow" must RE-EXECUTE the tool.
    target = tmp_path / "scratch_marker.txt"
    mgr = SessionManager(
        workspace=tmp_path,
        provider=ScriptedProvider(
            [
                _tool("write_file", {"path": str(target), "content": "ok"}, "call_w"),
                _text("Done — file written."),
            ]
        ),
    )
    sid = "dur-a"

    async def scenario():
        engine = mgr.get_engine(sid, agent="cowork", workspace=str(tmp_path))
        item = await _run_until_pending(mgr, sid, engine)
        assert item.kind == "approval" and item.tool_call_id == "call_w"
        assert not target.exists()  # not executed before approval
        await mgr.resolve_inbox(
            item.id, "allow"
        )  # restart-style resume → re-execute the tool

    asyncio.run(scenario())
    assert (
        target.exists() and target.read_text() == "ok"
    )  # the approved write actually ran
    assert any("Done" in (t or "") for t in _final_assistant_texts(mgr, sid))
