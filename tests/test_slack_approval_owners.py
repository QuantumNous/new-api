"""Slack approval ownership is distinct from ordinary inbound access."""

from __future__ import annotations

import asyncio

import httpx
from fastapi.testclient import TestClient

from coworker.connectors import ConnectorSettings, Gateway, TeamAuth
from coworker.connectors.base import InteractionEvent, MessageEvent, SessionSource
from coworker.interactions import encode
from coworker.providers import ModelCapabilities, ProviderClient
from coworker.server import create_app
from coworker.server.manager import SessionManager


class NoTurnsProvider(ProviderClient):
    def complete(self, *, model, messages, tools=None, **settings):
        raise AssertionError("no model turns expected")

    def capabilities(self, model):
        return ModelCapabilities()


def _manager(tmp_path) -> SessionManager:
    return SessionManager(data_dir=tmp_path / "data", provider=NoTurnsProvider())


def _manual_profile(manager: SessionManager, **extra) -> None:
    manager.secrets.put(
        "slack:default",
        {
            "bot_token": "xoxb-test",
            "app_token": "xapp-test",
            "enabled": True,
            **extra,
        },
    )


def test_manual_owner_is_required_for_binding_and_implies_allowed(tmp_path):
    manager = _manager(tmp_path)
    _manual_profile(manager)

    denied = manager.set_inbox_binding(
        "default", channel="slack", target="C_APPROVALS"
    )
    assert denied["ok"] is False

    added = manager.set_slack_approval_owner(
        "U_OWNER", add=True, display_name="Owner"
    )
    assert added["ok"] is True
    profile = manager.secrets.get("slack:default")
    assert profile["approval_owner_ids"] == ["U_OWNER"]
    assert profile["allowed_users"] == ["U_OWNER"]

    bound = manager.set_inbox_binding(
        "default", channel="slack", target="C_APPROVALS"
    )
    assert bound["ok"] is True
    assert manager.disallow_user("slack", "U_OWNER")["ok"] is False
    assert manager.set_slack_approval_owner("U_OWNER", add=False)["ok"] is False

    manager.set_slack_approval_owner("U_SECOND", add=True)
    assert manager.set_slack_approval_owner("U_OWNER", add=False)["ok"] is True
    assert manager.slack_approval_owner_ids() == {"U_SECOND"}


def test_manual_owner_rest_flow_surfaces_identity_and_binding(tmp_path):
    manager = _manager(tmp_path)
    _manual_profile(manager)
    client = TestClient(create_app(manager))

    added = client.post(
        "/v1/connectors/slack/approval-owners/add",
        json={"user_id": "U_OWNER", "name": "Ada"},
    ).json()
    assert added["ok"] is True

    slack = next(
        row
        for row in client.get("/v1/connectors").json()["connectors"]
        if row["name"] == "slack"
    )
    assert slack["approval_owner_ids"] == ["U_OWNER"]
    assert slack["approval_owner_names"] == {"U_OWNER": "Ada"}

    bound = client.post(
        "/v1/inbox/routing/binding",
        json={"name": "default", "channel": "slack", "target": "C_APPROVALS"},
    ).json()
    assert bound["ok"] is True


def test_relay_binding_uses_installer_identity(tmp_path):
    manager = _manager(tmp_path)
    manager.secrets.put(
        "slack:default", {"mode": "relay", "enabled": True, "managed": True}
    )
    manager.secrets.put(
        "slack:team:T1",
        {
            "bot_token": "xoxb-team",
            "managed": True,
            "slack_user_id": "U_INSTALLER",
            "allowed_users": ["U_INSTALLER"],
        },
    )
    assert manager.set_inbox_binding(
        "default", channel="slack", target="T1/C_APPROVALS"
    )["ok"]

    manager.secrets.put(
        "slack:team:T2",
        {"bot_token": "xoxb-team-2", "managed": True},
    )
    assert not manager.set_inbox_binding(
        "default", channel="slack", target="T2/C_APPROVALS"
    )["ok"]


def test_relay_does_not_reuse_dormant_manual_owners_for_bare_target(tmp_path):
    manager = _manager(tmp_path)
    manager.secrets.put(
        "slack:default",
        {
            "mode": "relay",
            "enabled": True,
            "managed": True,
            "bot_token": "xoxb-dormant",
            "app_token": "xapp-dormant",
            "approval_owner_ids": ["U_OLD_MANUAL_OWNER"],
        },
    )
    assert manager.slack_approval_owner_ids() == set()
    assert not manager.set_inbox_binding(
        "default", channel="slack", target="C_AMBIGUOUS"
    )["ok"]


def test_nonowner_cannot_resolve_approval_but_can_answer_question(tmp_path):
    manager = _manager(tmp_path)
    _manual_profile(
        manager,
        allowed_users=["U_OWNER", "U_MEMBER"],
        approval_owner_ids=["U_OWNER"],
    )

    class GatewayStub:
        def __init__(self):
            self.rejections = []
            self.updates = []

        async def reject_interaction(self, event, text=""):
            self.rejections.append(event.user_id)

        async def update_message(self, *args):
            self.updates.append(args)

    gateway = GatewayStub()
    manager.gateway = gateway
    approval = manager.inbox.add_approval("s1", "Run it?")
    question = manager.inbox.add_question("s1", "Which one?", options=["A", "B"])

    async def scenario():
        await manager._on_interaction(
            InteractionEvent(
                platform="slack",
                chat_id="C1",
                message_id="1",
                value=encode(approval.id, "allow"),
                user_id="U_MEMBER",
                user_name="Member",
            )
        )
        await manager._on_interaction(
            InteractionEvent(
                platform="slack",
                chat_id="C1",
                message_id="2",
                value=encode(question.id, "A"),
                user_id="U_MEMBER",
                user_name="Member",
            )
        )

    asyncio.run(scenario())
    assert manager.inbox.get(approval.id).state == "pending"
    assert manager.inbox.get(question.id).resolution == "A"
    assert gateway.rejections == ["U_MEMBER"]
    assert len(gateway.updates) == 1


def test_owner_click_from_a_different_bound_channel_is_rejected(tmp_path):
    manager = _manager(tmp_path)
    _manual_profile(
        manager,
        allowed_users=["U_OWNER"],
        approval_owner_ids=["U_OWNER"],
    )
    assert manager.set_inbox_binding(
        "default", channel="slack", target="C_EXPECTED"
    )["ok"]
    item = manager.inbox.add_approval("s1", "Run it?")

    class GatewayStub:
        def __init__(self):
            self.rejections = []

        async def reject_interaction(self, event, text=""):
            self.rejections.append(event.chat_id)

    gateway = GatewayStub()
    manager.gateway = gateway
    asyncio.run(
        manager._on_interaction(
            InteractionEvent(
                platform="slack",
                chat_id="C_OTHER",
                message_id="1",
                value=encode(item.id, "allow"),
                user_id="U_OWNER",
            )
        )
    )
    assert manager.inbox.get(item.id).state == "pending"
    assert gateway.rejections == ["C_OTHER"]


def test_gateway_rejects_interaction_from_unallowed_actor():
    handled = []

    async def handler(event):
        handled.append(event)

    gateway = Gateway(
        settings={
            "slack": ConnectorSettings(
                platform="slack",
                enabled=True,
                teams={"T1": TeamAuth(allowed_users={"U_ALLOWED"})},
            )
        },
        interaction_handler=handler,
    )

    async def scenario():
        await gateway._on_interaction(
            InteractionEvent(
                platform="slack",
                chat_id="T1/C1",
                message_id="1",
                value="ignored",
                user_id="U_OTHER",
                team_id="T1",
            )
        )

    asyncio.run(scenario())
    assert handled == []


def test_rejected_click_uses_only_slacks_ephemeral_response_url(monkeypatch):
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))

    monkeypatch.setattr(httpx, "post", fake_post)
    gateway = Gateway(settings={})

    async def scenario():
        await gateway.reject_interaction(
            InteractionEvent(
                platform="slack",
                chat_id="C1",
                message_id="1",
                value="ignored",
                response_url="https://hooks.slack.com/actions/abc",
            )
        )
        await gateway.reject_interaction(
            InteractionEvent(
                platform="slack",
                chat_id="C1",
                message_id="1",
                value="ignored",
                response_url="https://hooks.slack.com.evil.example/actions/abc",
            )
        )

    asyncio.run(scenario())
    assert len(calls) == 1
    assert calls[0][0] == "https://hooks.slack.com/actions/abc"
    assert calls[0][1]["json"]["response_type"] == "ephemeral"
    assert "approval owner" in calls[0][1]["json"]["text"]


def test_slack_reply_token_is_owner_only_for_approvals(tmp_path):
    manager = _manager(tmp_path)
    _manual_profile(
        manager,
        allowed_users=["U_OWNER", "U_MEMBER"],
        approval_owner_ids=["U_OWNER"],
    )
    item = manager.inbox.add_approval("s1", "Run it?")

    unauthorized = MessageEvent(
        text=f"approve [ow:{item.id}]",
        source=SessionSource("slack", "C1", user_id="U_MEMBER"),
    )
    assert manager._resolve_inbox_reply(unauthorized) is True
    assert manager.inbox.get(item.id).state == "pending"

    owner = MessageEvent(
        text=f"approve [ow:{item.id}]",
        source=SessionSource("slack", "C1", user_id="U_OWNER"),
    )
    assert manager._resolve_inbox_reply(owner) is True
    assert manager.inbox.get(item.id).resolution == "allow"


def test_ownerless_legacy_binding_does_not_mirror(tmp_path):
    manager = _manager(tmp_path)
    _manual_profile(manager, allowed_users=["U_MEMBER"])
    manager.inbox_routing.set_binding(
        "default", channel="slack", target="C_APPROVALS"
    )
    item = manager.inbox.add_approval("s1", "Run it?")

    class GatewayStub:
        def __init__(self):
            self.deliveries = []

        async def deliver_interactive(self, *args):
            self.deliveries.append(args)

    gateway = GatewayStub()
    manager.gateway = gateway
    asyncio.run(manager.mirror_inbox_item(item))
    assert gateway.deliveries == []
