"""Phase 3 wiring — self-wake tools registered, scheduler resume hook, wake messages."""

from __future__ import annotations

import asyncio

from coworker.agent import build_engine
from coworker.agents.code import code_agent
from coworker.agents.cowork import cowork_agent
from coworker.automation.scheduler import Scheduler
from coworker.selfwake import Wake, WakeStore
from coworker.server.manager import SessionManager


class _FakeStore:
    def due(self):
        return []


def test_scheduler_runs_extra_tick():
    async def run():
        hits = {"n": 0}

        async def extra():
            hits["n"] += 1

        sched = Scheduler(_FakeStore(), runner=None, extra_tick=extra)
        await sched._tick(trigger="schedule")
        assert hits["n"] == 1

    asyncio.run(run())


def test_wake_messages_by_kind():
    timer = Wake("1", "s1", "timer", note="poll")
    completion = Wake("2", "s1", "completion", job_id="job-9")
    event = Wake("3", "s1", "event", event_key="pr-opened")
    assert "timer" in SessionManager._wake_message(timer)
    assert "poll" in SessionManager._wake_message(timer)
    assert "job-9" in SessionManager._wake_message(completion)
    assert "pr-opened" in SessionManager._wake_message(event)


def test_selfwake_tools_registered_for_knowledge(tmp_path):
    engine = build_engine(
        agent=cowork_agent(),
        workspace=tmp_path,
        wake_store=WakeStore(tmp_path / "wakes.json"),
        session_id="s1",
    )
    names = set(engine.registry.names())
    assert {"sleep_for", "wake_on", "wake_on_event"} <= names


def test_selfwake_tools_absent_for_code(tmp_path):
    engine = build_engine(
        agent=code_agent(),
        workspace=tmp_path,
        wake_store=WakeStore(tmp_path / "wakes.json"),
        session_id="s1",
    )
    assert "sleep_for" not in set(engine.registry.names())
