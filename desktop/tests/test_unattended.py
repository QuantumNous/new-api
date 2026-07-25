"""Phase 2 gate — the Unattended per-session toggle + routing approvals to the Inbox."""

from __future__ import annotations

import asyncio

from coworker.inbox import InboxStore, inbox_approver
from coworker.unattended import UnattendedRegistry


def test_toggle_and_persist(tmp_path):
    reg = UnattendedRegistry(tmp_path / "unattended.json")
    assert reg.is_unattended("s1") is False
    reg.set("s1", True)
    assert reg.is_unattended("s1") is True and reg.sessions() == ["s1"]
    # Persisted across instances.
    assert UnattendedRegistry(tmp_path / "unattended.json").is_unattended("s1") is True
    reg.set("s1", False)
    assert reg.is_unattended("s1") is False and reg.sessions() == []


def test_unattended_session_routes_to_inbox(tmp_path):
    # Routing rule: an unattended session uses the inbox approver, so consequential actions
    # park in the Inbox instead of prompting inline.
    async def run():
        unattended = UnattendedRegistry(tmp_path / "unattended.json")
        inbox = InboxStore(tmp_path / "inbox.json")
        unattended.set("s1", True)
        assert unattended.is_unattended("s1")

        from coworker.engine import ApprovalOutcome, PermissionRequest

        approver = inbox_approver(inbox, "s1")

        async def answer():
            for _ in range(200):
                if inbox.pending("s1"):
                    inbox.resolve(inbox.pending("s1")[0].id, "allow")
                    return
                await asyncio.sleep(0.001)

        outcome, _ = await asyncio.gather(
            approver(PermissionRequest("write_file", {}, None, "")), answer()
        )
        assert outcome is ApprovalOutcome.ONCE
        assert len(inbox.list(session_id="s1")) == 1

    asyncio.run(run())
