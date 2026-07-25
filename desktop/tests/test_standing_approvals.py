"""Standing scoped approvals (UX-DECISIONS §25) — tool+target+task rules.

Covers the four build gaps: the `permissions` create-field, target-shaped entries matched
in the permission path (lifting the connector exclusion for task rules only), the
task-persistent "Allow every time" on run approvals, and revocation. No network, no LLM.
"""

from __future__ import annotations

import asyncio

import aisuite as ai
import pytest

from coworker.automation import Schedule, ScheduledTask, Scheduler, TaskRun, TaskStore
from coworker.automation.models import grant_entries, rule_entry, rule_parts
from coworker.automation.tools import scheduling_tools
from coworker.engine import ApprovalOutcome, PermissionRequest
from coworker.permissions import Mode, PermissionEngine, standing_rule_candidate


class _Meta:
    """Minimal tool metadata: external risk (requires_approval) + a category."""

    def __init__(self, category="messaging", requires_approval=True):
        self.category = category
        self.requires_approval = requires_approval


def _task(**kw) -> ScheduledTask:
    kw.setdefault("title", "Weekly digest")
    kw.setdefault("instructions", "summarize the week and post it")
    kw.setdefault("schedule", Schedule(kind="cron", cron="0 9 * * 1"))
    kw.setdefault("workspace", "/tmp/cw-standing")
    return ScheduledTask(**kw)


def _provider():
    from coworker.providers import AssistantTurn, ModelCapabilities, ProviderClient

    class _P(ProviderClient):
        def complete(self, *, model, messages, tools=None, **settings):
            return AssistantTurn(text="ok", finish_reason="stop")

        def capabilities(self, model):
            return ModelCapabilities()

    return _P()


# -- rule entries ---------------------------------------------------------------


def test_rule_entry_roundtrip():
    assert rule_entry("send_message", "slack:T1/C1") == "send_message slack:T1/C1"
    assert rule_parts("send_message slack:T1/C1") == ("send_message", "slack:T1/C1")
    assert rule_entry("web_search") == "web_search"
    assert rule_parts("web_search") == ("web_search", None)  # legacy name-only


def test_task_rule_helpers():
    t = _task(always_allowed_tools=["send_message slack:T1/C1", "web_search"])
    assert t.standing_rules() == {"send_message": {"slack:T1/C1"}}
    assert t.name_allowed_tools() == {"web_search"}
    assert t.add_rule("send_message", "slack:T1/C2") is True
    assert t.add_rule("send_message", "slack:T1/C2") is False  # dedupe
    assert t.add_rule("send_message", "") is False
    assert t.revoke_rule("send_message slack:T1/C2") is True
    assert t.revoke_rule("send_message slack:T1/C2") is False
    rules = t.public()["always_allowed"]
    assert {
        "entry": "send_message slack:T1/C1",
        "tool": "send_message",
        "target": "slack:T1/C1",
    } in rules
    assert {"entry": "web_search", "tool": "web_search", "target": None} in rules


def test_grant_entries_validation():
    grants = grant_entries(
        [
            {"tool": "send_message", "target": "slack:T1/C1", "access": "write"},
            {"tool": "send_message", "target": "slack:T1/C1", "access": "write"},  # dup
            {
                "tool": "github_list_commits",
                "target": "r/x",
                "access": "read",
            },  # read = disclosure
            {
                "tool": "run_shell",
                "target": "rm -rf /",
                "access": "write",
            },  # no target arg, exec
            {
                "tool": "github_create_issue",
                "target": "r/x",
                "access": "write",
            },  # no declared target arg
            {"tool": "send_message", "target": "", "access": "write"},  # empty target
            "garbage",
        ]
    )
    assert grants == ["send_message slack:T1/C1"]
    assert grant_entries(None) == []


# -- eligibility + permission-path matching --------------------------------------


def test_standing_rule_candidate():
    assert (
        standing_rule_candidate("send_message", {"target": "slack:C1"}, _Meta())
        == "slack:C1"
    )
    # exec risk is never eligible, even with a hand-crafted arg
    assert standing_rule_candidate("run_shell", {"command": "ls"}, _Meta()) is None
    # no declared target argument → not eligible
    assert (
        standing_rule_candidate(
            "github_create_issue", {"repo": "x"}, _Meta("connector")
        )
        is None
    )
    # eligible tool, but the call names no target
    assert standing_rule_candidate("send_message", {"text": "hi"}, _Meta()) is None
    # local writes are covered by path scoping, not standing rules
    assert standing_rule_candidate("write_file", {"path": "a"}, None) is None


def test_engine_matches_target(tmp_path):
    e = PermissionEngine(
        workspace_root=tmp_path, task_rules={"send_message": {"slack:T1/C1"}}
    )
    d = e.evaluate("send_message", {"target": "slack:T1/C1", "text": "hi"}, _Meta())
    assert d.allowed and d.rule == "send_message → slack:T1/C1"
    miss = e.evaluate("send_message", {"target": "slack:T1/C2", "text": "hi"}, _Meta())
    assert not miss.allowed and miss.needs_user


def test_task_rules_cover_connector_tools(tmp_path):
    # The session allowlist deliberately excludes connector tools; a task rule's exact
    # target binding is what makes lifting that exclusion safe (§25 gap 4).
    e = PermissionEngine(
        workspace_root=tmp_path, task_rules={"discord_send_message": {"C9"}}
    )
    e.allow_tool_for_session(
        "discord_send_message"
    )  # session allow alone must NOT unlock it
    meta = _Meta(category="connector")
    assert not e.evaluate(
        "discord_send_message", {"channel_id": "C8", "content": "x"}, meta
    ).allowed
    hit = e.evaluate("discord_send_message", {"channel_id": "C9", "content": "x"}, meta)
    assert hit.allowed and "standing rule" in hit.reason


def test_read_only_modes_ignore_task_rules(tmp_path):
    # Rules are additive on top of the run's permission mode — never an upgrade.
    e = PermissionEngine(
        workspace_root=tmp_path,
        mode=Mode.PLAN,
        task_rules={"send_message": {"slack:C1"}},
    )
    assert not e.evaluate("send_message", {"target": "slack:C1"}, _Meta()).allowed


# -- creation: the `permissions` field -------------------------------------------


def test_create_tool_stores_write_grants(tmp_path):
    store = TaskStore(tmp_path / "auto.db")
    tools = scheduling_tools(
        store, origin={"workspace": str(tmp_path)}, default_workspace=str(tmp_path)
    )
    create = next(t for t in tools if t.__name__ == "create_scheduled_task")
    # The schema advertises the field to the agent.
    props = create.__coworker_schema__["function"]["parameters"]["properties"]
    assert "permissions" in props
    res = create(
        title="Weekly digest",
        instructions="post it",
        cron="0 9 * * 1",
        permissions=[
            {"tool": "send_message", "target": "slack:T1/C1", "access": "write"},
            {"tool": "github_list_commits", "target": "r/x", "access": "read"},
        ],
    )
    assert res["ok"] and res["always_allowed"] == ["send_message slack:T1/C1"]
    saved = store.get(res["id"])
    assert saved.always_allowed_tools == ["send_message slack:T1/C1"]
    # The agent-facing update tool has no permissions field — rules are human-minted only.
    update = next(t for t in tools if t.__name__ == "update_scheduled_task")
    assert (
        "permissions"
        not in update.__coworker_schema__["function"]["parameters"]["properties"]
    )


# -- store: run-session → owning task --------------------------------------------


def test_task_for_run_session(tmp_path):
    store = TaskStore(tmp_path / "auto.db")
    t = _task()
    store.save(t)
    run = TaskRun(task_id=t.id)
    store.add_run(run)
    owner = store.task_for_run_session(run.session_id)
    assert owner is not None and owner.id == t.id
    assert store.task_for_run_session("session-xyz") is None
    assert store.task_for_run_session("__run__missing") is None


# -- run-time: park in the Inbox, mint on "Allow every time" ----------------------


async def test_scheduled_approver_parks_and_mints(tmp_path, monkeypatch):
    from coworker.server.manager import SessionManager

    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    ws = tmp_path / "ws"
    ws.mkdir()
    manager = SessionManager(data_dir=tmp_path / "data", provider=_provider())
    task = _task(workspace=str(ws), agent="cowork")
    manager.task_store.save(task)
    run = TaskRun(task_id=task.id)
    manager.task_store.add_run(run)

    approver = manager._scheduled_approver(task, run.session_id)
    request = PermissionRequest(
        tool_name="send_message",
        arguments={"target": "slack:T1/C1", "text": "digest"},
        metadata=_Meta(),
        reason="requires approval",
        tool_call_id="tc1",
    )

    async def click_allow_every_time():
        for _ in range(500):
            pending = manager.inbox.pending(run.session_id)
            if pending:
                # The parked item carries the task binding + the exact target — the
                # in-app card's gate for offering "Allow every time".
                assert pending[0].data["task_id"] == task.id
                assert pending[0].data["standing_target"] == "slack:T1/C1"
                await manager.resolve_inbox(pending[0].id, "always_task")
                return
            await asyncio.sleep(0.001)
        raise AssertionError("approval never parked")

    outcome, _ = await asyncio.gather(approver(request), click_allow_every_time())
    assert outcome is ApprovalOutcome.ONCE
    # The rule persisted to the task record…
    assert (
        "send_message slack:T1/C1"
        in manager.task_store.get(task.id).always_allowed_tools
    )
    # …and a rebuilt run engine auto-allows exactly that call, nothing else.
    engine = manager._build_task_engine(
        manager.task_store.get(task.id), session_id=run.session_id
    )
    hit = engine.permissions.evaluate(
        "send_message", {"target": "slack:T1/C1"}, _Meta()
    )
    assert hit.allowed and hit.rule
    assert not engine.permissions.evaluate(
        "send_message", {"target": "slack:T1/C2"}, _Meta()
    ).allowed


async def test_scheduled_approver_name_allows_and_denies(tmp_path, monkeypatch):
    from coworker.server.manager import SessionManager

    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    ws = tmp_path / "ws"
    ws.mkdir()
    manager = SessionManager(data_dir=tmp_path / "data", provider=_provider())
    task = _task(workspace=str(ws), agent="cowork", always_allowed_tools=["web_search"])
    manager.task_store.save(task)
    run = TaskRun(task_id=task.id)
    manager.task_store.add_run(run)
    approver = manager._scheduled_approver(task, run.session_id)

    # Legacy name-only entry: allowed without parking.
    outcome = await approver(
        PermissionRequest("web_search", {"query": "x"}, _Meta(), "", tool_call_id="tc1")
    )
    assert outcome is ApprovalOutcome.ONCE and not manager.inbox.pending(run.session_id)

    # Ungranted call parks; a Deny resolves it as denied (graceful degradation).
    request = PermissionRequest(
        "send_message", {"target": "slack:T1/C1"}, _Meta(), "", tool_call_id="tc2"
    )

    async def deny():
        for _ in range(500):
            pending = manager.inbox.pending(run.session_id)
            if pending:
                await manager.resolve_inbox(pending[0].id, "deny")
                return
            await asyncio.sleep(0.001)

    outcome, _ = await asyncio.gather(approver(request), deny())
    assert outcome is ApprovalOutcome.DENY
    assert manager.task_store.get(task.id).always_allowed_tools == ["web_search"]


def test_mint_task_rule_validates(tmp_path, monkeypatch):
    from coworker.server.manager import SessionManager

    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    manager = SessionManager(data_dir=tmp_path / "data", provider=_provider())
    task = _task()
    manager.task_store.save(task)
    run = TaskRun(task_id=task.id)
    manager.task_store.add_run(run)

    # Not an automation run session → no rule, ever.
    assert not manager.mint_task_rule(
        "session-1", "send_message", {"target": "slack:C1"}, _Meta()
    )
    # Exec risk → never mintable, even from a run session.
    assert not manager.mint_task_rule(
        run.session_id, "run_shell", {"command": "ls"}, _Meta()
    )
    # No declared target argument → not mintable.
    assert not manager.mint_task_rule(
        run.session_id, "github_create_issue", {"repo": "x"}, _Meta()
    )
    # Eligible call mints exactly one rule.
    assert manager.mint_task_rule(
        run.session_id, "send_message", {"target": "slack:C1"}, _Meta()
    )
    assert manager.task_store.get(task.id).always_allowed_tools == [
        "send_message slack:C1"
    ]


def test_get_engine_seeds_run_session_rules(tmp_path, monkeypatch):
    from coworker.server.manager import SessionManager

    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    ws = tmp_path / "ws"
    ws.mkdir()
    manager = SessionManager(data_dir=tmp_path / "data", provider=_provider())
    task = _task(
        workspace=str(ws),
        agent="cowork",
        always_allowed_tools=["send_message slack:T1/C1"],
    )
    manager.task_store.save(task)
    run = TaskRun(task_id=task.id)
    manager.task_store.add_run(run)
    # Manual "Run now" / durable resume rebuilds via get_engine — rules must ride along.
    engine = manager.get_engine(run.session_id, workspace=str(ws), agent="cowork")
    assert engine.permissions.task_rules == {"send_message": {"slack:T1/C1"}}


# -- REST surface: grants at creation, revoke on the task page --------------------


def test_create_automation_grants_and_revoke(tmp_path, monkeypatch):
    from coworker.server.manager import SessionManager

    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    manager = SessionManager(data_dir=tmp_path / "data", provider=_provider())
    res = manager.create_automation(
        {
            "title": "Weekly digest",
            "instructions": "post it",
            "cron": "0 9 * * 1",
            "permissions": [
                {"tool": "send_message", "target": "slack:T1/C1", "access": "write"},
                {"tool": "github_list_commits", "target": "r/x", "access": "read"},
            ],
        }
    )
    assert res["ok"]
    rules = res["task"]["always_allowed"]
    assert rules == [
        {
            "entry": "send_message slack:T1/C1",
            "tool": "send_message",
            "target": "slack:T1/C1",
        }
    ]
    out = manager.update_automation(
        res["task"]["id"], {"revoke": "send_message slack:T1/C1"}
    )
    assert out["ok"] and out["task"]["always_allowed"] == []
    assert manager.task_store.get(res["task"]["id"]).always_allowed_tools == []


# -- scheduler: a suspended run must not stall the loop ---------------------------


async def test_blocked_run_does_not_stall_other_tasks(tmp_path):
    store = TaskStore(tmp_path / "auto.db")
    blocked = _task(title="blocked")
    quick = _task(title="quick")
    for t in (blocked, quick):
        store.save(t)
        store._conn.execute(
            "UPDATE scheduled_tasks SET next_run=1.0 WHERE id=?", (t.id,)
        )
    store._conn.commit()

    gate = asyncio.Event()

    async def runner(task, trigger):
        if task.id == blocked.id:
            await gate.wait()  # parked approval: suspended until a human answers
        return TaskRun(task_id=task.id, status="ok", trigger=trigger)

    sched = Scheduler(store, runner, tick_seconds=0.05)
    sched.start()
    await asyncio.sleep(0.2)
    # The quick task completed while the blocked one is still suspended.
    assert store.get(quick.id).run_count == 1
    assert store.get(blocked.id).run_count == 0
    gate.set()
    await asyncio.sleep(0.1)
    assert store.get(blocked.id).run_count == 1
    await sched.stop()


# -- engine events: standing_target on the card, the note on the tool card --------


def test_engine_events_carry_standing_context(tmp_path):
    from coworker.events import EventType
    from coworker.providers import (
        AssistantTurn,
        ModelCapabilities,
        ProviderClient,
        ToolCall,
    )
    from coworker.engine import TurnEngine
    from coworker.tools import ToolRegistry

    def send_message(target: str, text: str):
        return {"ok": True}

    send_message.__aisuite_tool_metadata__ = ai.ToolMetadata(
        name="send_message",
        category="messaging",
        risk_level="medium",
        capabilities=["messaging"],
        requires_approval=True,
    )
    send_message.__coworker_schema__ = {
        "type": "function",
        "function": {
            "name": "send_message",
            "description": "send",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    class _P(ProviderClient):
        def __init__(self):
            self._turns = [
                AssistantTurn(
                    tool_calls=[
                        ToolCall(
                            id="c1",
                            name="send_message",
                            arguments={"target": "slack:T1/C1", "text": "hi"},
                        )
                    ],
                    finish_reason="tool_calls",
                ),
                AssistantTurn(text="sent", finish_reason="stop"),
            ]

        def complete(self, *, model, messages, tools=None, **settings):
            return self._turns.pop(0)

        def capabilities(self, model):
            return ModelCapabilities()

    registry = ToolRegistry()
    registry.register_all([send_message])

    async def approve_once(_req):
        return ApprovalOutcome.ONCE

    # Ungranted: the approval event names the exact pinnable target.
    engine = TurnEngine(
        provider=_P(),
        registry=registry,
        permissions=PermissionEngine(workspace_root=tmp_path),
        model="gpt-5.5",
        approver=approve_once,
    )

    async def run():
        return [ev async for ev in engine.run("post it")]

    events = asyncio.run(run())
    perm = next(e for e in events if e.type == EventType.PERMISSION_REQUIRED)
    assert perm.data["standing_target"] == "slack:T1/C1"

    # Granted: no prompt, and the tool card cites the rule.
    audit: list[dict] = []
    engine2 = TurnEngine(
        provider=_P(),
        registry=registry,
        permissions=PermissionEngine(
            workspace_root=tmp_path, task_rules={"send_message": {"slack:T1/C1"}}
        ),
        model="gpt-5.5",
        audit_sink=audit.append,
    )

    async def run2():
        return [ev async for ev in engine2.run("post it")]

    events2 = asyncio.run(run2())
    assert not any(e.type == EventType.PERMISSION_REQUIRED for e in events2)
    finished = next(e for e in events2 if e.type == EventType.TOOL_FINISHED)
    assert finished.data["standing_rule"] == "send_message → slack:T1/C1"
    # §25 invariant: every auto-allowed call writes an audit entry citing the rule.
    cited = [a for a in audit if a.get("stage") == "auto_allowed"]
    assert cited and "send_message → slack:T1/C1" in cited[0]["reason"]
