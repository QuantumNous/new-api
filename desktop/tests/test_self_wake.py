"""Phase 2 gate — self-wake: timer + on-completion wake records and the tools."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from coworker.selfwake import WakeStore, selfwake_tools


def _now():
    return datetime.now(timezone.utc)


def test_timer_due_only_after_fire_time(tmp_path):
    store = WakeStore(tmp_path / "wakes.json")
    soon = store.add_timer("s1", _now() + timedelta(seconds=60))
    past = store.add_timer("s1", _now() - timedelta(seconds=1))
    due_ids = {w.id for w in store.due()}
    assert past.id in due_ids and soon.id not in due_ids


def test_completion_due_only_after_job_completes(tmp_path):
    store = WakeStore(tmp_path / "wakes.json")
    w = store.add_completion("s1", job_id="job-42")
    assert w.id not in {x.id for x in store.due()}  # not yet
    marked = store.complete_job("job-42")
    assert [x.id for x in marked] == [w.id]
    assert w.id in {x.id for x in store.due()}  # now due


def test_mark_fired_removes_from_due(tmp_path):
    store = WakeStore(tmp_path / "wakes.json")
    w = store.add_timer("s1", _now() - timedelta(seconds=1))
    store.mark_fired(w.id)
    assert w.id not in {x.id for x in store.due()}
    assert w.id not in {x.id for x in store.pending("s1")}


def test_persistence(tmp_path):
    store = WakeStore(tmp_path / "wakes.json")
    w = store.add_completion("s1", "job-1")
    reloaded = WakeStore(tmp_path / "wakes.json")
    assert any(x.id == w.id for x in reloaded.pending("s1"))


def test_event_due_only_after_event_fires(tmp_path):
    store = WakeStore(tmp_path / "wakes.json")
    w = store.add_event("s1", event_key="pr-opened")
    assert w.id not in {x.id for x in store.due()}
    marked = store.fire_event("pr-opened")
    assert [x.id for x in marked] == [w.id]
    assert w.id in {x.id for x in store.due()}


def test_selfwake_tools(tmp_path):
    store = WakeStore(tmp_path / "wakes.json")
    sleep_for, sleep_until, wake_on, wake_on_event = selfwake_tools(store, "s1")

    assert sleep_for(30)["ok"]
    assert wake_on("job-9")["job_id"] == "job-9"
    assert sleep_until((_now() + timedelta(minutes=5)).isoformat())["fire_at"]
    assert wake_on_event("alert-fired")["event_key"] == "alert-fired"

    pend = store.pending("s1")
    assert len(pend) == 4
    assert {w.kind for w in pend} == {"timer", "completion", "event"}
