"""Managed GitHub relay, desktop side (github-relay-spec §13 Step 3, MG3a).

Install callback → per-installation profiles (metadata only, NO tokens at
rest), the shared-hub adapter (fan-out by provider tag), the memory-only
installation-token client, and tool auth resolution (minted token for managed,
PAT untouched for manual). Hermetic: fake transports, stubbed broker calls.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from coworker import cloud
from coworker.connectors import github_installs
from coworker.connectors.base import MessageEvent
from coworker.connectors.config import is_authorized, load_settings
from coworker.connectors.github_relay import GitHubRelayAdapter, split_thread
from coworker.connectors.relay_client import RelayHub, SlackRelayAdapter
from coworker.secrets import SecretStore
from coworker.server import SessionManager, create_app


@pytest.fixture(autouse=True)
def _fresh_token_cache():
    cloud._GITHUB_TOKEN_CACHE.clear()
    yield
    cloud._GITHUB_TOKEN_CACHE.clear()


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    manager = SessionManager(workspace=tmp_path)
    app = create_app(manager)
    with TestClient(app) as c:
        c.manager = manager
        yield c


def _install_form(installation_id: str, *, login="octocat", account="acme") -> dict:
    """The broker's loopback POST — deliberately NO token fields (§4)."""
    return {
        "connector": "github",
        "installation_id": installation_id,
        "account_login": account,
        "account_type": "Organization",
        "github_login": login,
        "repo_selection": "selected",
        "connection_id": f"conn_{installation_id}",
    }


def _no_cloud(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(
        cloud,
        "github_disconnect_installation",
        lambda s, c, installation_id: calls.append(installation_id),
    )
    return calls


# --- install callback → profiles (mirror of the Slack workspace tests) --------


def test_managed_callback_installs_and_hot_reloads(client, monkeypatch):
    refreshes = []

    async def _refresh():
        refreshes.append(True)
        return []

    monkeypatch.setattr(client.manager, "refresh_gateway", _refresh)
    resp = client.post("/oauth/callback", data=_install_form("101"))
    assert resp.status_code == 200 and "GitHub connected" in resp.text

    profile = client.manager.secrets.get("github:install:101")
    assert profile["account_login"] == "acme"
    assert profile["github_login"] == "octocat"
    assert profile["repo_selection"] == "selected"
    # No token of any shape at rest — installation tokens are minted on demand.
    blob = json.dumps(profile)
    assert "ghs_" not in blob and "ghu_" not in blob and "token" not in blob
    assert client.manager.secrets.get("github:default")["mode"] == "relay"
    assert refreshes  # hot-add, like a Slack workspace

    gh = [
        c
        for c in client.get("/v1/connectors").json()["connectors"]
        if c["name"] == "github"
    ][0]
    assert gh["connected"] is True
    assert [i["installation_id"] for i in gh["installations"]] == ["101"]
    assert gh["installations"][0]["account_login"] == "acme"

    # a second installation lands alongside, not instead
    client.post("/oauth/callback", data=_install_form("202", account="hooli"))
    assert client.manager.secrets.get("github:install:101") is not None
    assert client.manager.secrets.get("github:install:202") is not None


def test_disconnect_one_installation_keeps_the_other(client, monkeypatch):
    cloud_calls = _no_cloud(monkeypatch)
    for iid in ("101", "202"):
        client.post("/oauth/callback", data=_install_form(iid))

    body = client.post("/v1/connectors/github/installations/101/disconnect").json()
    assert body["ok"] is True and body["remaining_installs"] == 1
    assert cloud_calls == ["101"]
    assert client.manager.secrets.get("github:install:101") is None
    assert client.manager.secrets.get("github:install:202") is not None
    gh = next(c for c in client.manager.list_connectors() if c["name"] == "github")
    assert gh["connected"] is True
    assert [i["installation_id"] for i in gh["installations"]] == ["202"]


def test_disconnect_last_installation_never_resurrects_manual_pat(client, monkeypatch):
    _no_cloud(monkeypatch)
    # A manual PAT stored BEFORE the managed install must stay stored but the
    # relay must not survive the last installation's removal.
    client.manager.secrets.put(
        "github:default", {"type": "token", "token": "ghp_manual", "enabled": True}
    )
    client.post("/oauth/callback", data=_install_form("101"))
    body = client.post("/v1/connectors/github/installations/101/disconnect").json()
    assert body["ok"] is True and body["remaining_installs"] == 0

    default = client.manager.secrets.get("github:default")
    assert default["token"] == "ghp_manual"  # kept for a manual re-enable
    assert default["enabled"] is False and "mode" not in default


# --- allow-list: per-installation scope (the per-workspace pattern) -----------


def test_github_settings_carry_per_installation_allowlists(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    secrets = SecretStore()
    github_installs.managed_connect_install(secrets, _install_form("101"))
    secrets.put(
        "github:install:101",
        {**secrets.get("github:install:101"), "allowed_users": ["octocat"]},
    )
    settings = load_settings(secrets)["github"]
    assert settings.enabled is True

    class Src:
        platform = "github"
        team_id = "101"
        user_id = "octocat"

    assert is_authorized(settings, Src()) is True
    Src.user_id = "stranger"
    assert is_authorized(settings, Src()) is False  # parks, not delivered
    Src.team_id = "999"
    assert is_authorized(settings, Src()) is False  # unknown installation


# --- adapter: shared hub fan-out, dispatch, lifecycle frames -------------------


class FakeTransport:
    def __init__(self, frames):
        self._q: asyncio.Queue = asyncio.Queue()
        for f in frames:
            self._q.put_nowait(f)

    async def open(self):
        pass

    async def recv(self):
        if not self._q.empty():
            return self._q.get_nowait()
        await asyncio.Event().wait()

    async def close(self):
        pass


def _gh_frame(**over):
    frame = {
        "provider": "github",
        "installation_id": "101",
        "owner_repo": "acme/site",
        "number": 7,
        "kind": "mention",
        "sender": "octocat",
        "title": "Broken build",
        "body": "@ocw please take a look",
        "url": "https://github.com/acme/site/issues/7",
        "address": "github:acme/site#7",
        "event_id": "d-1",
    }
    frame.update(over)
    return frame


def _slack_frame():
    return {
        "provider": "slack",
        "team_id": "T1",
        "channel": "C1",
        "event_id": "Ev1",
        "event": {"type": "app_mention", "user": "U_A", "channel": "C1", "text": "hi"},
    }


async def test_one_hub_fans_out_to_both_adapters(monkeypatch):
    """THE step-3 invariant: slack + github share one relay socket; frames land
    on their own adapter by provider tag."""
    monkeypatch.setenv("SLACK_API_URL", "http://127.0.0.1:9/")
    hub = RelayHub(
        "wss://relay.test/ws",
        lambda: "jwt",
        transport_factory=lambda: FakeTransport([_gh_frame(), _slack_frame()]),
    )
    slack = SlackRelayAdapter(
        "wss://relay.test/ws",
        lambda: "jwt",
        teams={"T1": {"bot_token": "xoxb-1", "bot_user_id": "UBOT"}},
        hub=hub,
    )
    github = GitHubRelayAdapter(hub, installs={"101": {"account_login": "acme"}})
    slack_events: list[MessageEvent] = []
    github_events: list[MessageEvent] = []

    async def on_slack(e):
        slack_events.append(e)

    async def on_github(e):
        github_events.append(e)

    slack.set_message_handler(on_slack)
    github.set_message_handler(on_github)
    assert await slack.connect() is True
    assert await github.connect() is True  # joins the running socket
    try:
        await hub.wait_dispatched(2)
    finally:
        await github.disconnect()
        await slack.disconnect()

    assert len(slack_events) == 1 and slack_events[0].source.platform == "slack"
    assert len(github_events) == 1
    gh = github_events[0]
    assert gh.source.platform == "github"
    assert gh.source.chat_id == "acme/site#7"
    assert gh.source.target == "github:acme/site#7"  # reply handle roundtrip
    assert gh.source.team_id == "101"  # allow-list scope = installation
    assert gh.source.user_id == "octocat"
    assert "Broken build" in gh.text and "@ocw please take a look" in gh.text


async def test_adapter_missed_and_revoked_frames():
    hub = RelayHub(
        "wss://x",
        lambda: "jwt",
        transport_factory=lambda: FakeTransport(
            [
                {
                    "provider": "github",
                    "kind": "missed",
                    "channel": "acme/site",
                    "count": 3,
                },
                {"provider": "github", "kind": "revoked", "installation_id": "101"},
            ]
        ),
    )
    adapter = GitHubRelayAdapter(hub, installs={"101": {"account_login": "acme"}})
    await adapter.connect()
    try:
        await hub.wait_dispatched(2)
    finally:
        await adapter.disconnect()
    assert adapter.missed == {"acme/site": 3}
    assert adapter.status()["installs"] == {}  # revoked → dropped


def test_addressing_roundtrip():
    assert split_thread("acme/site#7") == ("acme/site", 7)
    assert split_thread("acme/site") == ("acme/site", None)


async def test_send_posts_comment_with_minted_token(monkeypatch):
    """Replies mint the right installation's token and post as the bot."""
    hub = RelayHub(
        "wss://x", lambda: "jwt", transport_factory=lambda: FakeTransport([])
    )
    minted: list[str] = []

    async def token_client(installation_id: str) -> str:
        minted.append(installation_id)
        return "ghs_live-token"

    adapter = GitHubRelayAdapter(
        hub, installs={"101": {"account_login": "acme"}}, token_client=token_client
    )
    adapter._repo_installs["acme/site"] = "101"

    posted = {}

    class FakeResp:
        status_code = 201

        def json(self):
            return {"id": 987}

    class FakeClient:
        def __init__(self, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, **kw):
            posted.update({"url": url, **kw})
            return FakeResp()

    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    result = await adapter.send("acme/site#7", "on it — as ocw[bot]")
    assert result.ok and result.message_id == "987"
    assert minted == ["101"]
    assert posted["url"].endswith("/repos/acme/site/issues/7/comments")
    assert posted["json"] == {"body": "on it — as ocw[bot]"}
    assert posted["headers"]["Authorization"] == "Bearer ghs_live-token"


# --- token client: memory cache + re-mint (fake broker) ------------------------


def _stub_broker_mint(monkeypatch, tokens: list[str]):
    """cloud.github_installation_token's HTTP leg, one token per mint call."""
    calls = []
    it = iter(tokens)

    class Resp:
        status_code = 200

        def json(self):
            return {"token": next(it), "expires_at": "2099-01-01T00:00:00Z"}

    def fake_post(url, **kw):
        calls.append(url)
        assert url.endswith("/v1/github/token")
        return Resp()

    monkeypatch.setattr(cloud.httpx, "post", fake_post)
    monkeypatch.setattr(cloud, "fresh_access_token", lambda s, c: "signin-jwt")
    return calls


def test_token_client_caches_and_force_remints(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.config import load_config

    secrets = SecretStore()
    calls = _stub_broker_mint(monkeypatch, ["ghs_first", "ghs_second"])

    t1 = cloud.github_installation_token(secrets, load_config(), "101")
    t2 = cloud.github_installation_token(secrets, load_config(), "101")
    assert t1 == t2 == "ghs_first"
    assert len(calls) == 1  # cache hit, no second mint

    t3 = cloud.github_installation_token(secrets, load_config(), "101", force=True)
    assert t3 == "ghs_second" and len(calls) == 2

    # NEVER at rest: nothing github-token-shaped in the secret store.
    blob = json.dumps([m for m in secrets.status()])
    assert "ghs_" not in blob


# --- tools: minted token for managed, PAT untouched for manual -----------------


def _capture_requests(monkeypatch):
    from coworker.connectors import integration_tools

    seen: list[dict] = []

    def fake_request(method, url, *, headers=None, params=None, json=None, auth=None):
        seen.append({"method": method, "url": url, "headers": headers or {}})
        return {"ok": True, "data": {"items": []}}

    monkeypatch.setattr(integration_tools, "_request", fake_request)
    return seen


def _tool(secrets, name):
    from coworker.connectors.integration_tools import make_integration_tools

    tools = make_integration_tools(secrets)
    return next(t for t in tools if t.__name__ == name)


def test_manual_pat_path_untouched(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    secrets = SecretStore()
    secrets.put("github:default", {"type": "token", "token": "ghp_manual"})
    seen = _capture_requests(monkeypatch)

    out = _tool(secrets, "github_get_issue")("acme", "site", 7)
    assert out["ok"] is True
    assert seen[0]["headers"]["Authorization"] == "Bearer ghp_manual"


def test_managed_tools_use_minted_token_by_owner(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    secrets = SecretStore()
    github_installs.managed_connect_install(secrets, _install_form("101"))
    github_installs.managed_connect_install(
        secrets, _install_form("202", account="hooli")
    )
    seen = _capture_requests(monkeypatch)
    minted = []

    def fake_mint(s, c, installation_id, *, force=False):
        minted.append((installation_id, force))
        return f"ghs_for-{installation_id}"

    monkeypatch.setattr(cloud, "github_installation_token", fake_mint)

    # The repo owner picks the installation (hooli ≠ the default 101).
    out = _tool(secrets, "github_reply")("hooli", "app", 3, "done")
    assert out["ok"] is True
    assert minted == [("202", False)]
    assert seen[0]["headers"]["Authorization"] == "Bearer ghs_for-202"
    assert seen[0]["url"].endswith("/repos/hooli/app/issues/3/comments")


def test_managed_401_reminted_once(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.connectors import integration_tools

    secrets = SecretStore()
    github_installs.managed_connect_install(secrets, _install_form("101"))
    minted = []
    monkeypatch.setattr(
        cloud,
        "github_installation_token",
        lambda s, c, iid, *, force=False: minted.append(force) or "ghs_x",
    )
    responses = iter([{"error": "HTTP 401"}, {"ok": True, "data": {}}])
    monkeypatch.setattr(integration_tools, "_request", lambda *a, **k: next(responses))

    out = _tool(secrets, "github_review")("acme", "site", 5, "APPROVE")
    assert out["ok"] is True
    assert minted == [False, True]  # expired cache → one forced re-mint


def test_review_event_validated(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    secrets = SecretStore()
    out = _tool(secrets, "github_review")("acme", "site", 5, "MERGE")
    assert "event must be" in out["error"]


# --- commits + clone/pull (activity summaries + local code exploration) --------


def test_list_commits_filters_and_trims(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    from coworker.connectors import integration_tools

    secrets = SecretStore()
    secrets.put("github:default", {"type": "token", "token": "ghp_x"})
    seen = {}

    def fake_request(method, url, *, headers=None, params=None, json=None, auth=None):
        seen.update({"url": url, "params": params})
        return {
            "ok": True,
            "data": [
                {
                    "sha": "a" * 40,
                    "commit": {
                        "author": {"name": "Rohit", "date": "2026-07-08T10:00:00Z"},
                        "message": "Fix the flaky relay test\n\nlong body " * 40,
                    },
                    "author": {"login": "rohit-dev"},
                }
            ],
        }

    monkeypatch.setattr(integration_tools, "_request", fake_request)
    out = _tool(secrets, "github_list_commits")(
        "acme",
        "site",
        since="2026-07-06T00:00:00Z",
        author="rohit-dev",
        max_results=200,
    )
    assert seen["url"].endswith("/repos/acme/site/commits")
    assert seen["params"]["since"] == "2026-07-06T00:00:00Z"
    assert seen["params"]["author"] == "rohit-dev"
    assert seen["params"]["per_page"] == 100  # capped
    (c,) = out["commits"]
    assert c["sha"] == "a" * 12 and c["author"] == "Rohit"
    assert len(c["message"]) <= 500  # trimmed for the model


def _git(args, cwd):
    import subprocess

    return subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@t", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    )


@pytest.fixture
def _origin(tmp_path):
    """A local 'GitHub': a bare repo at <base>/acme/site.git reachable via the
    GITHUB_GIT_URL override, plus a work repo to push new commits from."""
    base = tmp_path / "githost"
    bare = base / "acme" / "site.git"
    bare.mkdir(parents=True)
    _git(["init", "--bare", "--initial-branch=main", str(bare)], cwd=tmp_path)
    work = tmp_path / "work"
    work.mkdir()
    _git(["init", "--initial-branch=main"], cwd=work)
    (work / "README.md").write_text("hello")
    _git(["add", "."], cwd=work)
    _git(["commit", "-m", "first"], cwd=work)
    _git(["remote", "add", "origin", str(bare)], cwd=work)
    _git(["push", "origin", "main"], cwd=work)
    return {"base": base, "work": work}


def _clone_tools(secrets, tmp_path):
    from coworker.connectors.integration_tools import make_integration_tools
    from coworker.roots import RootDir

    granted = tmp_path / "granted"
    granted.mkdir(exist_ok=True)
    tools = make_integration_tools(secrets, roots=[RootDir(granted, writable=True)])
    by_name = {t.__name__: t for t in tools}
    return granted, by_name


def test_clone_pull_roundtrip_and_no_token_at_rest(tmp_path, monkeypatch, _origin):
    """Clone into the granted root, then pull a new upstream commit. The
    minted-token header must never persist anywhere in the clone."""
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("GITHUB_GIT_URL", f"file://{_origin['base']}")
    secrets = SecretStore()
    github_installs.managed_connect_install(secrets, _install_form("101"))
    monkeypatch.setattr(
        cloud, "github_installation_token", lambda s, c, iid, *, force=False: "ghs_live"
    )
    granted, tools = _clone_tools(secrets, tmp_path)

    out = tools["github_clone"]("acme", "site")
    assert out.get("ok") is True, out
    clone = granted / "site"
    assert (clone / "README.md").read_text() == "hello"
    # The no-token-at-rest rule, verified on disk (not just in code review):
    for f in (clone / ".git").rglob("*"):
        if f.is_file() and f.stat().st_size < 100_000:
            blob = f.read_bytes()
            assert b"ghs_" not in blob and b"AUTHORIZATION" not in blob, f

    (_origin["work"] / "next.txt").write_text("more")
    _git(["add", "."], cwd=_origin["work"])
    _git(["commit", "-m", "second"], cwd=_origin["work"])
    _git(["push", "origin", "main"], cwd=_origin["work"])

    out = tools["github_pull"](str(clone))
    assert out.get("ok") is True, out
    assert (clone / "next.txt").read_text() == "more"


def test_clone_refuses_paths_outside_granted_roots(tmp_path, monkeypatch, _origin):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("GITHUB_GIT_URL", f"file://{_origin['base']}")
    secrets = SecretStore()
    _granted, tools = _clone_tools(secrets, tmp_path)

    out = tools["github_clone"]("acme", "site", directory=str(tmp_path / "elsewhere"))
    assert "outside the session's writable directories" in out["error"]
    assert not (tmp_path / "elsewhere").exists()

    # and with no writable root at all → a clear error, no filesystem writes
    from coworker.connectors.integration_tools import make_integration_tools

    bare_tools = {t.__name__: t for t in make_integration_tools(secrets, roots=[])}
    out = bare_tools["github_clone"]("acme", "site")
    assert "no writable session directory" in out["error"]


def test_clone_refuses_non_empty_target(tmp_path, monkeypatch, _origin):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("GITHUB_GIT_URL", f"file://{_origin['base']}")
    secrets = SecretStore()
    granted, tools = _clone_tools(secrets, tmp_path)
    (granted / "site").mkdir()
    (granted / "site" / "keep.txt").write_text("existing work")

    out = tools["github_clone"]("acme", "site")
    assert "not empty" in out["error"]
    assert (granted / "site" / "keep.txt").read_text() == "existing work"
