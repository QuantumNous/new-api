"""Slack rosters for the pickers: people (users.list) + channels
(conversations.list), cached per workspace, filtered and ranked locally.
No new scopes — every install already granted users:read/channels:read/
groups:read — and nothing roster-shaped is persisted."""

from __future__ import annotations

import pytest

from coworker.connectors import slack_directory
from coworker.secrets import SecretStore


@pytest.fixture
def secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    store = SecretStore()
    store.put("slack:team:T1", {"bot_token": "xoxb-t1", "team_id": "T1"})
    store.put("slack:default", {"bot_token": "xoxb-manual"})
    return store


@pytest.fixture(autouse=True)
def _fresh_cache():
    slack_directory.clear_cache()
    yield
    slack_directory.clear_cache()


def _member(uid, display, handle, **extra):
    return {"id": uid, "name": handle, "profile": {"display_name": display}, **extra}


def _fake_pages(monkeypatch, pages_by_method: dict[str, list[dict]]):
    """Stub the paginated fetch; records (method, token) per call."""
    calls: list[tuple[str, str]] = []

    def fake(token, method, params, key, page_limit=200):
        calls.append((method, token))
        return pages_by_method[method]

    monkeypatch.setattr(slack_directory, "_get_pages", fake)
    return calls


MEMBERS = [
    _member("U1", "Maya Chen", "maya"),
    _member("U2", "Rohit Prasad", "rohit"),
    _member("U3", "", "zed"),  # falls back to the handle
    _member("U4", "Contractor Cal", "cal", is_restricted=True),
    _member("UB", "Beep", "beep-bot", is_bot=True),
    _member("UG", "Gone", "gone", deleted=True),
    {"id": "USLACKBOT", "name": "slackbot", "profile": {"display_name": "Slackbot"}},
]


def test_members_filtered_ranked_and_guest_tagged(secrets, monkeypatch):
    _fake_pages(monkeypatch, {"users.list": MEMBERS})
    out = slack_directory.list_members(secrets, "T1")
    assert out["ok"]
    ids = [m["id"] for m in out["members"]]
    assert ids == ["U4", "U1", "U2", "U3"]  # alpha by display name; no bots/deleted
    by_id = {m["id"]: m for m in out["members"]}
    assert by_id["U4"]["guest"] and not by_id["U2"]["guest"]
    assert by_id["U3"]["name"] == "zed"  # display-name fallback

    out = slack_directory.list_members(secrets, "T1", query="ro")
    assert [m["id"] for m in out["members"]] == ["U2"]  # prefix beats substring
    out = slack_directory.list_members(
        secrets, "T1", query="maya"
    )  # handle matches too
    assert [m["id"] for m in out["members"]] == ["U1"]


def test_roster_is_cached_per_workspace(secrets, monkeypatch):
    calls = _fake_pages(monkeypatch, {"users.list": MEMBERS})
    slack_directory.list_members(secrets, "T1")
    slack_directory.list_members(secrets, "T1", query="ro")  # filter runs on the cache
    assert len(calls) == 1
    slack_directory.list_members(secrets, "default")  # other workspace = own fetch
    assert len(calls) == 2
    assert calls[0][1] == "xoxb-t1" and calls[1][1] == "xoxb-manual"


def test_channels_carry_privacy_and_membership(secrets, monkeypatch):
    _fake_pages(
        monkeypatch,
        {
            "conversations.list": [
                {"id": "C1", "name": "general", "is_private": False, "is_member": True},
                {
                    "id": "C2",
                    "name": "launch-team",
                    "is_private": False,
                    "is_member": False,
                },
                {"id": "C3", "name": "leads", "is_private": True, "is_member": True},
            ]
        },
    )
    out = slack_directory.list_channels(secrets, "T1", query="l")
    assert out["ok"]
    assert [c["name"] for c in out["channels"]] == ["launch-team", "leads", "general"]
    by_name = {c["name"]: c for c in out["channels"]}
    assert by_name["leads"]["is_private"] and by_name["leads"]["is_member"]
    assert not by_name["launch-team"]["is_member"]  # → GUI shows the invite hint


def test_unconnected_workspace_and_api_error(secrets, monkeypatch):
    empty = SecretStore()
    assert not slack_directory.list_members(empty, "T9")["ok"]

    def boom(token, method, params, key):
        raise RuntimeError("ratelimited")

    monkeypatch.setattr(slack_directory, "_get_pages", boom)
    out = slack_directory.list_members(secrets, "T1")
    assert out == {"ok": False, "error": "ratelimited"}


def test_allow_with_name_seeds_people_directory(tmp_path, monkeypatch):
    """A directory pick lands on the allow-list AND the chip shows the display
    name immediately — no first message needed."""
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.providers import ModelCapabilities, ProviderClient
    from coworker.server.manager import SessionManager

    class _Provider(ProviderClient):
        def complete(self, *, model, messages, tools=None, **settings):
            raise AssertionError("no turns expected")

        def capabilities(self, model):
            return ModelCapabilities()

    manager = SessionManager(workspace=tmp_path, provider=_Provider())
    manager.secrets.put(
        "slack:team:T1", {"bot_token": "xoxb", "team_id": "T1", "allowed_users": []}
    )
    out = manager.allow_user("slack", "U2", "T1", display_name="Rohit Prasad")
    assert out["ok"]
    assert manager.secrets.get("slack:team:T1")["allowed_users"] == ["U2"]
    assert manager._people.get("slack:U2") == "Rohit Prasad"
