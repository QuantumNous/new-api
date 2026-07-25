"""Slice B — multi-root file toolkit + permission scoping + the context injector.

Orphan Cowork sessions own a primary writable scratch dir and may gain additional folders,
each read-only or read-write. These cover the three layers that share the roots list.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

import aisuite as ai
from coworker.engine import TurnEngine
from coworker.events import EventType
from coworker.permissions import Decision, Mode, PermissionEngine
from coworker.providers import AssistantTurn, ToolCall
from coworker.roots import RootDir, normalize_roots, render_context
from coworker.tools import ToolRegistry


def _bare_engine(**kw):
    return TurnEngine(
        provider=object(),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root="/tmp"),
        model="x",
        **kw,
    )


async def _collect(aiter):
    return [e async for e in aiter]


def _roots(tmp_path):
    scratch = tmp_path / "scratch"
    ro = tmp_path / "ro"
    rw = tmp_path / "rw"
    for d in (scratch, ro, rw):
        d.mkdir()
    (ro / "data.txt").write_text("secret", encoding="utf-8")
    return scratch, ro, rw


# -- file toolkit ---------------------------------------------------------------


def test_toolkit_reads_any_root_writes_only_writable(tmp_path):
    scratch, ro, rw = _roots(tmp_path)
    roots = [
        {"path": str(scratch), "writable": True},
        {"path": str(ro), "writable": False},
        {"path": str(rw), "writable": True},
    ]
    tools = {f.__name__: f for f in ai.toolkits.files(roots=roots)}

    # relative path resolves against the primary (scratch)
    assert tools["write_file"]("note.txt", "hi") == "note.txt"
    assert (scratch / "note.txt").read_text() == "hi"
    # read from a read-only root via absolute path
    assert tools["read_file"](str(ro / "data.txt")) == "secret"
    # write into a writable non-primary root via absolute path
    tools["write_file"](str(rw / "added.txt"), "x")
    assert (rw / "added.txt").read_text() == "x"
    # write into a read-only root is refused
    with pytest.raises(PermissionError):
        tools["write_file"](str(ro / "nope.txt"), "x")
    # escaping every root is refused
    with pytest.raises(PermissionError):
        tools["read_file"]("/etc/hosts")


def test_toolkit_runtime_added_root_is_seen_live(tmp_path):
    scratch, ro, rw = _roots(tmp_path)
    shared = normalize_roots([RootDir(path=scratch, writable=True)])
    tools = {f.__name__: f for f in ai.toolkits.files(roots=shared)}
    # initially the ro dir is out of bounds
    with pytest.raises(PermissionError):
        tools["read_file"](str(ro / "data.txt"))
    # add it at runtime by mutating the shared list in place
    shared.append(RootDir(path=ro, writable=False))
    assert tools["read_file"](str(ro / "data.txt")) == "secret"


# -- permission engine ----------------------------------------------------------


def _meta(reg, name):
    return reg.get(name).metadata


def test_permissions_write_blocked_in_readonly_root(tmp_path):
    scratch, ro, rw = _roots(tmp_path)
    reg = ToolRegistry()
    reg.register_all(
        ai.toolkits.files(roots=[{"path": str(scratch), "writable": True}])
    )
    eng = PermissionEngine(
        workspace_root=scratch,
        roots=[
            {"path": str(scratch), "writable": True},
            {"path": str(ro), "writable": False},
        ],
    )
    # write to the read-only root -> denied outright (not even an approval prompt)
    d = eng.evaluate(
        "write_file",
        {"path": str(ro / "x.txt"), "content": "x"},
        _meta(reg, "write_file"),
    )
    assert not d.allowed and not d.needs_user
    # write to the writable scratch -> needs approval (interactive), not denied
    d = eng.evaluate(
        "write_file", {"path": "x.txt", "content": "x"}, _meta(reg, "write_file")
    )
    assert not d.allowed and d.needs_user


# -- context injector -----------------------------------------------------------


def test_render_context_marks_primary_and_access(tmp_path):
    scratch, ro, _ = _roots(tmp_path)
    text = render_context(
        normalize_roots(
            [
                RootDir(path=scratch, writable=True),
                RootDir(path=ro, writable=False),
            ]
        )
    )
    assert "read-write" in text and "read-only" in text
    assert "primary" in text.lower()
    assert str(scratch.resolve()) in text


def test_outbound_messages_appends_context_to_last_user_message():
    eng = TurnEngine(
        provider=object(),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root="/tmp"),
        model="x",
        messages=[
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
            {"role": "user", "content": "do it"},
        ],
        context_provider=lambda: "DIRS",
    )
    out = eng._outbound_messages()
    # ephemeral: the persisted history is untouched
    assert eng.messages[-1]["content"] == "do it"
    # only the LAST user message carries the block
    assert out[-1]["content"] == "do it\n\n<system-context>\nDIRS\n</system-context>"
    assert out[1]["content"] == "hello"


def test_outbound_messages_noop_without_provider():
    eng = TurnEngine(
        provider=object(),
        registry=ToolRegistry(),
        permissions=PermissionEngine(workspace_root="/tmp"),
        model="x",
        messages=[{"role": "user", "content": "hello"}],
    )
    # No context provider → no `<system-context>` block appended (content unchanged). The list is
    # now always a fresh copy (the `source` strip is unconditional), so compare by value not identity.
    out = eng._outbound_messages()
    assert out == eng.messages
    assert out[-1]["content"] == "hello"


# -- Slice C: add/remove session folders (RO/RW) + persistence ------------------


def _cowork_manager(tmp_path):
    from coworker.providers import ModelCapabilities, ProviderClient
    from coworker.server import SessionManager

    class _Provider(ProviderClient):
        def complete(self, *, model, messages, tools=None, **s):
            return AssistantTurn(text="", finish_reason="stop")

        def capabilities(self, model):
            return ModelCapabilities()

    mgr = SessionManager(data_dir=tmp_path / "data", provider=_Provider())
    mgr._prefs["scratch_base"] = str(tmp_path / "scratchbase")
    return mgr


def test_add_and_remove_roots_live_and_persisted(tmp_path):
    mgr = _cowork_manager(tmp_path)
    ro = tmp_path / "shared_ro"
    rw = tmp_path / "shared_rw"
    ro.mkdir()
    rw.mkdir()
    sid = "sessC"
    engine = mgr.get_engine(sid, agent="cowork")
    assert engine is not None

    # only the primary scratch to start
    roots = mgr.get_roots(sid)
    assert len(roots) == 1 and roots[0]["primary"] and roots[0]["writable"]

    # add a read-only and a read-write folder; the live engine sees them immediately
    mgr.add_root(sid, str(ro), writable=False)
    mgr.add_root(sid, str(rw), writable=True)
    assert {r.path for r in engine.roots} == {
        Path(roots[0]["path"]).resolve(),
        ro.resolve(),
        rw.resolve(),
    }
    by_path = {r["path"]: r for r in mgr.get_roots(sid)}
    assert by_path[str(ro.resolve())]["writable"] is False
    assert by_path[str(rw.resolve())]["writable"] is True

    # the permission engine now allows writes into the rw folder but not the ro folder
    assert mgr.get_engine(sid).permissions._under_writable_root(str(rw / "x.txt"))
    assert not mgr.get_engine(sid).permissions._under_writable_root(str(ro / "x.txt"))

    # cannot remove the primary scratch
    assert not mgr.remove_root(sid, roots[0]["path"])["ok"]
    # remove the read-only folder
    mgr.remove_root(sid, str(ro))
    assert ro.resolve() not in {r.path for r in engine.roots}

    # persist (as a turn would) and reload in a fresh manager → the rw folder survives
    mgr.save(sid, engine)
    mgr2 = _cowork_manager(tmp_path)
    persisted = {r["path"]: r for r in mgr2.get_roots(sid)}
    assert (
        str(rw.resolve()) in persisted
        and persisted[str(rw.resolve())]["writable"] is True
    )
    assert str(ro.resolve()) not in persisted


def test_add_root_before_first_turn_persists(tmp_path):
    """Adding a folder on a brand-new conversation (no record, no engine yet) must survive:
    the manager creates a minimal cowork record so the grant isn't lost (GUI start panel).
    """
    mgr = _cowork_manager(tmp_path)
    shared = tmp_path / "shared"
    shared.mkdir()
    sid = "fresh-session"
    assert mgr.session_store.load(sid) is None  # nothing saved yet

    res = mgr.add_root(sid, str(shared), writable=False)
    assert res["ok"] is True
    paths = {r["path"] for r in res["roots"]}
    assert str(shared.resolve()) in paths

    # the grant survived: a fresh manager (no engines) still sees it, under the cowork agent
    mgr2 = _cowork_manager(tmp_path)
    persisted = {r["path"]: r for r in mgr2.get_roots(sid)}
    assert str(shared.resolve()) in persisted
    record = mgr2.session_store.load(sid)
    assert record is not None and record.agent == "cowork"


# -- Slice D: request_directory (interactive grant) ----------------------------


def test_request_directory_emits_prompt_and_returns_grant():
    captured = {}

    async def requester(args, tool_call_id=None):
        captured.update(args)
        return {"granted": True, "path": "/tmp/granted", "writable": True}

    eng = _bare_engine(directory_requester=requester)
    tc = ToolCall(
        id="c1",
        name="request_directory",
        arguments={
            "reason": "need the report",
            "path": "/tmp/granted",
            "writable": True,
        },
    )
    events = asyncio.run(_collect(eng._handle_directory_request(tc)))

    kinds = [e.type for e in events]
    assert EventType.DIRECTORY_REQUESTED in kinds
    prompt = next(e for e in events if e.type == EventType.DIRECTORY_REQUESTED)
    assert (
        prompt.data["reason"] == "need the report" and prompt.data["writable"] is True
    )
    finished = next(e for e in events if e.type == EventType.TOOL_FINISHED)
    assert finished.data["status"] == "ok"
    assert captured["reason"] == "need the report"  # the requester saw the agent's args
    # the tool result the model sees reflects the grant
    assert '"granted": true' in eng.messages[-1]["content"]


def test_request_directory_denied_returns_denied_status():
    async def requester(_args, tool_call_id=None):
        return {"granted": False, "reason": "user declined"}

    eng = _bare_engine(directory_requester=requester)
    tc = ToolCall(id="c1", name="request_directory", arguments={"reason": "x"})
    events = asyncio.run(_collect(eng._handle_directory_request(tc)))
    assert (
        next(e for e in events if e.type == EventType.TOOL_FINISHED).data["status"]
        == "denied"
    )


def test_request_directory_without_requester_is_safe_noop():
    eng = _bare_engine()  # no requester (e.g. headless)
    tc = ToolCall(id="c1", name="request_directory", arguments={"reason": "x"})
    events = asyncio.run(_collect(eng._handle_directory_request(tc)))
    # no prompt is emitted, and the tool reports it isn't available
    assert EventType.DIRECTORY_REQUESTED not in [e.type for e in events]
    assert (
        next(e for e in events if e.type == EventType.TOOL_FINISHED).data["status"]
        == "denied"
    )
