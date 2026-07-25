"""Automation data model — a scheduled task is its own persistent entity (see
docs/AUTOMATION-SCHEDULING.md). Each fire is a fresh Run of the task's instructions, recorded
in the task's own thread + working folder.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

_DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _now() -> float:
    return time.time()


# -- standing scoped approvals (UX-DECISIONS §25) --------------------------------
# An `always_allowed_tools` entry is either a bare tool name (legacy, allows the tool
# against any argument) or "tool target" — one space, tool names never contain spaces —
# binding the allowance to one exact target (channel address, recipient, …). Rules live
# on the task record so revocation is per-automation and deletion takes them along.


def rule_entry(tool: str, target: Optional[str] = None) -> str:
    return f"{tool} {target}" if target else tool


def rule_parts(entry: str) -> tuple[str, Optional[str]]:
    tool, _, target = entry.strip().partition(" ")
    return tool, (target.strip() or None)


def grant_entries(permissions: Any) -> list[str]:
    """Validate a proposed `permissions` list (from the create-tool schema or the GUI
    create payload) down to the entries actually grantable. Only `access: "write"` items
    become grants; the tool must declare a target argument (which excludes exec/destructive
    tools by construction) and the target must be non-empty. Reads are disclosure-only —
    rendered on the consent card, never stored. Anything else is dropped, fail-closed.
    """
    from ..connectors.tool_defs import target_arg_for

    entries: list[str] = []
    for item in permissions or []:
        if not isinstance(item, dict):
            continue
        if str(item.get("access", "")).lower() != "write":
            continue
        tool = str(item.get("tool", "")).strip()
        target = str(item.get("target", "")).strip()
        if not tool or not target or target_arg_for(tool) is None:
            continue
        entry = rule_entry(tool, target)
        if entry not in entries:
            entries.append(entry)
    return entries


def _human_time(hour: int, minute: int) -> str:
    ampm = "AM" if hour < 12 else "PM"
    h12 = hour % 12 or 12
    return f"{h12}:{minute:02d} {ampm}"


@dataclass
class Schedule:
    kind: str  # "cron" | "once"
    cron: Optional[str] = None
    fire_at: Optional[str] = None  # ISO datetime for one-time
    timezone: str = (
        "local"  # 'local' = the machine's clock (a local-first tool default)
    )

    def human(self) -> str:
        """Best-effort human label ('Every day at ~7:10 PM'); falls back to the raw cron."""
        if self.kind == "once":
            return f"Once at {self.fire_at}"
        parts = (self.cron or "").split()
        if len(parts) != 5:
            return self.cron or "?"
        minute, hour, dom, month, dow = parts
        try:
            t = _human_time(int(hour), int(minute))
        except ValueError:
            return self.cron  # non-trivial cron (ranges/steps) — show as-is
        if dom == "*" and dow == "*":
            return f"Every day at ~{t}"
        if dom == "*" and dow.isdigit():
            return f"Every {_DOW[int(dow) % 7]} at ~{t}"
        if dom.isdigit() and dow == "*":
            return f"Monthly on day {dom} at ~{t}"
        return self.cron

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "cron": self.cron,
            "fire_at": self.fire_at,
            "timezone": self.timezone,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Schedule":
        return cls(
            kind=d.get("kind", "cron"),
            cron=d.get("cron"),
            fire_at=d.get("fire_at"),
            timezone=d.get("timezone", "local"),
        )


@dataclass
class ScheduledTask:
    title: str
    instructions: str
    schedule: Schedule
    workspace: str
    origin_surface: str = "cowork"  # where it was launched from (a reference)
    origin_session_id: str = ""
    agent: str = "cowork"
    id: str = field(default_factory=lambda: "task-" + uuid.uuid4().hex[:10])
    task_session_id: str = ""  # the task's OWN thread (set to f"__task__{id}")
    model: Optional[str] = None
    notify_on_completion: bool = True
    notify_target: Optional[str] = None  # extra messaging target ("telegram:123")
    always_allowed_tools: list[str] = field(default_factory=list)
    always_allowed_commands: list[str] = field(default_factory=list)
    enabled: bool = True
    created_at: float = field(default_factory=_now)
    updated_at: float = field(default_factory=_now)
    next_run: Optional[float] = None  # epoch seconds; computed by the store
    last_run: Optional[float] = None
    last_status: Optional[str] = None
    run_count: int = 0
    max_runs: Optional[int] = None
    # Sidebar unread tracking (UX-023): runs started after this mark count as
    # "unseen"; opening the automation's detail advances it. 0.0 = never opened.
    seen_runs_at: float = 0.0

    def __post_init__(self) -> None:
        if not self.task_session_id:
            self.task_session_id = f"__task__{self.id}"

    def to_dict(self) -> dict:
        d = self.__dict__.copy()
        d["schedule"] = self.schedule.to_dict()
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "ScheduledTask":
        d = dict(d)
        d["schedule"] = Schedule.from_dict(d.get("schedule") or {})
        return cls(**d)

    # -- standing rules (§25) --------------------------------------------------
    def standing_rules(self) -> dict[str, set[str]]:
        """Target-bound entries as {tool: {targets}} — the shape the permission engine
        matches against the declared target argument."""
        out: dict[str, set[str]] = {}
        for entry in self.always_allowed_tools:
            tool, target = rule_parts(entry)
            if tool and target:
                out.setdefault(tool, set()).add(target)
        return out

    def name_allowed_tools(self) -> set[str]:
        """Legacy name-only entries (no target binding) — back-compatible behavior."""
        return {
            tool
            for tool, target in map(rule_parts, self.always_allowed_tools)
            if tool and target is None
        }

    def add_rule(self, tool: str, target: str) -> bool:
        entry = rule_entry(tool, target)
        if not tool or not target or entry in self.always_allowed_tools:
            return False
        self.always_allowed_tools.append(entry)
        return True

    def revoke_rule(self, entry: str) -> bool:
        if entry in self.always_allowed_tools:
            self.always_allowed_tools.remove(entry)
            return True
        return False

    def public(self) -> dict[str, Any]:
        """Status shape for the API/UI (no instructions truncation; never any secret)."""
        return {
            "id": self.id,
            "title": self.title,
            "instructions": self.instructions,
            "schedule": self.schedule.human(),
            "schedule_raw": self.schedule.to_dict(),
            "workspace": self.workspace,
            "agent": self.agent,
            "enabled": self.enabled,
            "next_run": self.next_run,
            "last_run": self.last_run,
            "last_status": self.last_status,
            "run_count": self.run_count,
            "notify_on_completion": self.notify_on_completion,
            # UX-023: lets the detail freeze the pre-open mark for its "new" pills.
            "seen_runs_at": self.seen_runs_at,
            # Structured for the task page's revoke list; `entry` is the revoke handle.
            "always_allowed": [
                {"entry": e, "tool": t, "target": tg}
                for e, (t, tg) in (
                    (e, rule_parts(e)) for e in sorted(set(self.always_allowed_tools))
                )
            ],
        }


@dataclass
class TaskRun:
    task_id: str
    run_id: str = field(default_factory=lambda: "run-" + uuid.uuid4().hex[:10])
    started_at: float = field(default_factory=_now)
    finished_at: Optional[float] = None
    status: str = "running"  # running | ok | error | skipped
    result_text: Optional[str] = None
    artifacts: list[str] = field(default_factory=list)
    error: Optional[str] = None
    trigger: str = "schedule"  # schedule | manual | catchup
    session_id: str = ""  # the run's own conversation thread — persisted + continuable

    def __post_init__(self) -> None:
        if not self.session_id:
            self.session_id = f"__run__{self.run_id}"

    def to_dict(self) -> dict:
        return self.__dict__.copy()

    @classmethod
    def from_dict(cls, d: dict) -> "TaskRun":
        return cls(**d)
