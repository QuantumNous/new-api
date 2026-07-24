"""P6 gate tests — server: OpenAI-compatible endpoint, WS session API, REST."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from coworker.providers import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    ToolCall,
)
from coworker.server import SessionManager, create_app
from coworker.sessions import SessionRecord


class ScriptedProvider(ProviderClient):
    """A ProviderClient that returns queued AssistantTurns (streams via base default)."""

    def __init__(self, turns):
        self._turns = list(turns)

    def complete(self, *, model, messages, tools=None, **settings):
        return self._turns.pop(0)

    def capabilities(self, model):
        return ModelCapabilities()


def _text(text):
    return AssistantTurn(text=text, finish_reason="stop")


def _tool(name, args, call_id="call_1"):
    return AssistantTurn(tool_calls=[ToolCall(id=call_id, name=name, arguments=args)])


def _client(tmp_path, turns):
    manager = SessionManager(workspace=tmp_path, provider=ScriptedProvider(turns))
    return TestClient(create_app(manager))


# -- REST -----------------------------------------------------------------------


def test_chat_completions_openai_shape(tmp_path):
    client = _client(tmp_path, [_text("hello world")])
    resp = client.post(
        "/v1/chat/completions",
        json={"model": "gpt-5.5", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["object"] == "chat.completion"
    assert body["choices"][0]["message"]["content"] == "hello world"
    assert body["choices"][0]["finish_reason"] == "stop"


def test_agents_and_memory_rest(tmp_path):
    client = _client(tmp_path, [])
    agents = client.get("/v1/agents").json()["agents"]
    # The picker lists enabled+surfaced personas — a fresh install is cowork-only
    # (non-default personas ship disabled, opt-in from Settings ▸ Personas).
    names = [a["name"] for a in agents]
    assert names == ["cowork"]
    assert "skills" in client.get("/v1/skills").json()  # catalog (may be empty)

    added = client.post("/v1/memory", json={"content": "prefer pathlib"}).json()
    assert added["content"] == "prefer pathlib"
    assert any(
        m["content"] == "prefer pathlib"
        for m in client.get("/v1/memory").json()["memory"]
    )


def test_disable_persona_archives_its_sessions(tmp_path):
    """Disable = "put this coworker and its history away": the persona's real sessions are
    archived atomically server-side (so its sidebar section disappears with it), internal
    __run__ threads and other personas are untouched, and re-enable never unarchives."""
    manager = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    store = manager.session_store

    def mk(sid, agent):
        store.save(
            SessionRecord(
                session_id=sid,
                workspace=str(tmp_path),
                model="m",
                mode="interactive",
                agent=agent,
            )
        )

    mk("chat-a", "chat")
    mk("chat-b", "chat")
    mk("chat-old", "chat")
    store.set_flags(
        "chat-old", archived=True
    )  # already archived — must not be re-counted
    mk("cowork-a", "cowork")
    mk("__run__r1", "chat")  # internal automation thread — never touched

    client = TestClient(create_app(manager))
    body = client.post("/v1/personas/chat", json={"enabled": False}).json()
    assert body["ok"] is True
    assert body["archived_sessions"] == 2
    assert store.load("chat-a").archived and store.load("chat-b").archived
    assert store.load("cowork-a").archived is False
    assert store.load("__run__r1").archived is False

    # Re-enable brings the persona back but never rewrites the user's archive state.
    client.post("/v1/personas/chat", json={"enabled": True})
    assert store.load("chat-a").archived

    # The dedicated §5/§8 enable route shares the same semantic.
    mk("chat-c", "chat")
    client.post("/v1/personas/chat/enable", json={"enabled": False})
    assert store.load("chat-c").archived


def test_connector_tool_settings_and_audit_rest(tmp_path):
    client = _client(tmp_path, [])
    connectors = {
        c["name"]: c for c in client.get("/v1/connectors").json()["connectors"]
    }
    assert any(t["name"] == "browser_open_url" for t in connectors["browser"]["tools"])

    res = client.patch(
        "/v1/connectors/browser/tools", json={"enabled": {"browser_open_url": False}}
    ).json()
    assert res["ok"] is True
    connectors = {
        c["name"]: c for c in client.get("/v1/connectors").json()["connectors"]
    }
    browser_tools = {t["name"]: t for t in connectors["browser"]["tools"]}
    assert browser_tools["browser_open_url"]["enabled"] is False

    assert client.get("/v1/audit", params={"session_id": "none"}).json()["events"] == []
    assert client.get("/v1/browser/state").json()["status"] in {
        "closed",
        "open",
        "error",
    }


def test_artifacts_list_and_read_previewable_files(tmp_path):
    (tmp_path / "brief.md").write_text("# Brief\n\nHello", encoding="utf-8")
    (tmp_path / "page.html").write_text("<h1>Preview</h1>", encoding="utf-8")
    (tmp_path / ".secret.md").write_text("hidden", encoding="utf-8")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "noise.md").write_text("skip", encoding="utf-8")

    client = _client(tmp_path, [])
    artifacts = client.get("/v1/sessions/unknown/artifacts").json()["artifacts"]
    by_path = {a["path"]: a for a in artifacts}

    assert by_path["brief.md"]["kind"] == "markdown"
    assert by_path["page.html"]["kind"] == "html"
    assert ".secret.md" not in by_path
    assert "node_modules/noise.md" not in by_path

    md = client.get(
        "/v1/sessions/unknown/artifacts/read", params={"path": "brief.md"}
    ).json()
    assert md["ok"] is True
    assert md["kind"] == "markdown"
    assert md["content"].startswith("# Brief")

    html = client.get(
        "/v1/sessions/unknown/artifacts/read", params={"path": "page.html"}
    ).json()
    assert html["ok"] is True
    assert html["kind"] == "html"
    assert "<h1>Preview</h1>" in html["content"]


def test_artifact_read_rejects_path_escape(tmp_path):
    client = _client(tmp_path, [])
    escaped = client.get(
        "/v1/sessions/unknown/artifacts/read", params={"path": "../outside.md"}
    ).json()
    assert escaped["ok"] is False
    assert "escapes" in escaped["error"]


def test_sessions_hide_scheduled_internal_runs(tmp_path):
    manager = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    manager.session_store.save(
        SessionRecord(
            session_id="normal",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            messages=[{"role": "user", "content": "normal task"}],
            title="Normal task",
            agent="cowork",
        )
    )
    manager.session_store.save(
        SessionRecord(
            session_id="__run__daily-news-1",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            messages=[{"role": "user", "content": "scheduled run"}],
            title="Daily news briefing",
            agent="cowork",
        )
    )
    manager.session_store.save(
        SessionRecord(
            session_id="__task__daily-news",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            messages=[{"role": "user", "content": "scheduled task"}],
            title="Daily news briefing",
            agent="cowork",
        )
    )
    client = TestClient(create_app(manager))
    session_ids = {
        s["session_id"] for s in client.get("/v1/sessions").json()["sessions"]
    }
    assert "normal" in session_ids
    assert "__run__daily-news-1" not in session_ids
    assert "__task__daily-news" not in session_ids


def test_sessions_can_be_renamed_and_deleted(tmp_path):
    manager = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    manager.session_store.save(
        SessionRecord(
            session_id="rename-me",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            messages=[{"role": "user", "content": "original"}],
            title="Original title",
            agent="cowork",
        )
    )
    client = TestClient(create_app(manager))

    renamed = client.patch(
        "/v1/sessions/rename-me", json={"title": "  Better title  "}
    ).json()
    assert renamed["ok"] is True
    sessions = client.get("/v1/sessions").json()["sessions"]
    assert any(
        s["session_id"] == "rename-me" and s["title"] == "Better title"
        for s in sessions
    )

    deleted = client.delete("/v1/sessions/rename-me").json()
    assert deleted["ok"] is True
    sessions = client.get("/v1/sessions").json()["sessions"]
    assert all(s["session_id"] != "rename-me" for s in sessions)
    assert client.get("/v1/sessions/rename-me/messages").json()["messages"] == []


def test_sessions_can_be_pinned_and_archived(tmp_path):
    manager = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    for sid in ("older", "newer"):
        manager.session_store.save(
            SessionRecord(
                session_id=sid,
                workspace=str(tmp_path),
                model="gpt-5.5",
                mode="interactive",
                messages=[{"role": "user", "content": sid}],
                agent="cowork",
            )
        )
    client = TestClient(create_app(manager))

    assert (
        client.patch("/v1/sessions/older", json={"pinned": True}).json()["ok"] is True
    )
    sessions = client.get("/v1/sessions").json()["sessions"]
    assert sessions[0]["session_id"] == "older" and sessions[0]["pinned"] is True

    assert (
        client.patch("/v1/sessions/newer", json={"archived": True}).json()["ok"] is True
    )
    by_id = {s["session_id"]: s for s in client.get("/v1/sessions").json()["sessions"]}
    assert by_id["newer"]["archived"] is True

    assert (
        client.patch("/v1/sessions/older", json={"pinned": False}).json()["ok"] is True
    )
    assert (
        client.patch("/v1/sessions/newer", json={"archived": False}).json()["ok"]
        is True
    )
    by_id = {s["session_id"]: s for s in client.get("/v1/sessions").json()["sessions"]}
    assert by_id["older"]["pinned"] is False and by_id["newer"]["archived"] is False


# -- WebSocket ------------------------------------------------------------------


def _drain(ws, on_permission=None):
    """Collect event types until turn_done; optionally answer permission_required."""
    types = []
    while True:
        event = ws.receive_json()
        types.append(event["type"])
        if event["type"] == "permission_required" and on_permission:
            ws.send_json({"type": "approval", "decision": on_permission})
        if event["type"] == "turn_done":
            return types


def test_ws_simple_turn(tmp_path):
    client = _client(tmp_path, [_text("done thinking")])
    with client.websocket_connect("/ws/session/s1") as ws:
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "user_message", "text": "hello"})
        types = _drain(ws)
        assert "assistant_message" in types
        assert "turn_end" in types


def test_ws_rejects_oversized_message(tmp_path):
    from coworker.server import app as app_mod

    client = _client(tmp_path, [_text("should not run")])
    with client.websocket_connect("/ws/session/big") as ws:
        assert ws.receive_json()["type"] == "ready"

        # Oversized text → single error frame, no turn runs.
        ws.send_json(
            {"type": "user_message", "text": "x" * (app_mod._MAX_MESSAGE_TEXT_CHARS + 1)}
        )
        evt = ws.receive_json()
        assert evt["type"] == "error" and "too long" in evt["data"]["error"].lower()

        # Too many attachments → error frame.
        ws.send_json(
            {
                "type": "user_message",
                "text": "hi",
                "attachments": ["a"] * (app_mod._MAX_ATTACHMENTS + 1),
            }
        )
        evt = ws.receive_json()
        assert evt["type"] == "error" and "attachment" in evt["data"]["error"].lower()

        # A normal message still works afterwards (the socket wasn't torn down).
        ws.send_json({"type": "user_message", "text": "hello"})
        assert "turn_done" in _drain(ws)


def test_ws_error_persists_notice_and_retry_reruns(tmp_path):
    class FlakyProvider(ProviderClient):
        def __init__(self):
            self.calls = 0

        def complete(self, *, model, messages, tools=None, **settings):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("outage")
            return _text("recovered")

        def capabilities(self, model):
            return ModelCapabilities()

    manager = SessionManager(workspace=tmp_path, provider=FlakyProvider())
    client = TestClient(create_app(manager))
    with client.websocket_connect("/ws/session/flaky") as ws:
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "user_message", "text": "hello"})
        assert "error" in _drain(ws)
        # The error survives as a persisted notice (reload shows what happened)…
        messages = client.get("/v1/sessions/flaky/messages").json()["messages"]
        assert messages[-1]["role"] == "notice" and messages[-1]["kind"] == "error"
        # …and retry re-runs the turn without a new user message.
        ws.send_json({"type": "retry"})
        types = _drain(ws)
        assert "turn_start" in types and "assistant_message" in types
    messages = client.get("/v1/sessions/flaky/messages").json()["messages"]
    assert messages[-1]["role"] == "assistant" and messages[-1]["content"] == "recovered"
    assert sum(1 for m in messages if m["role"] == "user") == 1


# -- origin gate (local-API hardening): a browser page on a foreign origin must not be able to
# read the API cross-origin or open the driving WebSocket. -------------------------------------


def test_cors_rejects_foreign_origin(tmp_path):
    client = _client(tmp_path, [])
    # A random website's origin gets no ACAO header, so the browser blocks the read.
    resp = client.get("/v1/sessions", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in {k.lower() for k in resp.headers}
    # The desktop webview's own origin is allowed.
    ok = client.get("/v1/sessions", headers={"Origin": "tauri://localhost"})
    assert ok.headers.get("access-control-allow-origin") == "tauri://localhost"
    # Localhost dev/browser build is allowed too.
    dev = client.get("/v1/sessions", headers={"Origin": "http://localhost:1420"})
    assert dev.headers.get("access-control-allow-origin") == "http://localhost:1420"


def test_ws_rejects_foreign_origin(tmp_path):
    from starlette.websockets import WebSocketDisconnect as WSD

    client = _client(tmp_path, [_text("hi")])
    with pytest.raises(WSD) as e:
        with client.websocket_connect(
            "/ws/session/x", headers={"Origin": "https://evil.example"}
        ) as ws:
            ws.receive_json()
    assert e.value.code == 1008


def test_ws_allows_webview_origin(tmp_path):
    client = _client(tmp_path, [_text("hi")])
    with client.websocket_connect(
        "/ws/session/x", headers={"Origin": "http://tauri.localhost"}
    ) as ws:
        assert ws.receive_json()["type"] == "ready"


def test_ws_approval_round_trip(tmp_path):
    client = _client(
        tmp_path,
        [
            _tool("write_file", {"path": "made.py", "content": "print(1)\n"}),
            _text("wrote it"),
        ],
    )
    with client.websocket_connect("/ws/session/s2") as ws:
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "user_message", "text": "create made.py"})
        types = _drain(ws, on_permission="once")
        assert "permission_required" in types
        assert "tool_finished" in types
    assert (tmp_path / "made.py").read_text() == "print(1)\n"


def test_ws_session_persisted_while_parked_on_approval(tmp_path):
    """A crash mid-turn must not eat the conversation: by the time the engine parks on an
    approval, the session (user message + assistant tool call) is already on disk."""
    manager = SessionManager(
        workspace=tmp_path,
        provider=ScriptedProvider(
            [_tool("write_file", {"path": "x.py", "content": "1\n"}), _text("done")]
        ),
    )
    client = TestClient(create_app(manager))
    with client.websocket_connect("/ws/session/persist1") as ws:
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "user_message", "text": "make x.py"})
        while ws.receive_json()["type"] != "permission_required":
            pass
        # Parked on the approval — nothing approved, turn far from done. Already saved?
        rec = manager.session_store.load("persist1")
        assert rec is not None
        roles = [m.get("role") for m in rec.messages]
        assert "user" in roles  # turn_start checkpoint
        assert "assistant" in roles  # iteration progress checkpoint
        ws.send_json({"type": "approval", "decision": "deny"})
        while ws.receive_json()["type"] != "turn_done":
            pass


def test_ws_browser_tool_audit_round_trip(tmp_path):
    client = _client(tmp_path, [_tool("browser_close", {}), _text("closed")])
    with client.websocket_connect("/ws/session/browser-audit?agent=cowork") as ws:
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "user_message", "text": "close browser"})
        types = _drain(ws, on_permission="once")
        assert "permission_required" in types
        assert "tool_finished" in types

    rows = client.get(
        "/v1/audit", params={"session_id": "browser-audit", "connector": "browser"}
    ).json()["events"]
    assert any(
        r["tool"] == "browser_close" and r["stage"] == "approval_resolved" for r in rows
    )
    assert any(r["tool"] == "browser_close" and r["stage"] == "finished" for r in rows)


def test_open_and_recent_workspaces(tmp_path):
    proj = tmp_path / "proj"
    proj.mkdir()
    client = _client(tmp_path, [])
    opened = client.post("/v1/workspaces/open", json={"path": str(proj)}).json()
    assert opened["ok"] is True
    recents = client.get("/v1/workspaces/recent").json()["workspaces"]
    assert any(w["path"] == str(proj.resolve()) for w in recents)


def test_recent_workspaces_exclude_scratch_dirs(tmp_path):
    # Scratch dirs get touched like any workspace, but must never show up as
    # "recent projects" in the folder gate (owner call, 2026-07-03).
    from coworker.server.manager import SessionManager

    proj = tmp_path / "real-project"
    proj.mkdir()
    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    mgr._prefs["scratch_base"] = str(tmp_path / "scratch")
    scratch = mgr._provision_scratch("sess-1")
    mgr.session_store.touch_workspace(str(proj.resolve()))
    mgr.session_store.touch_workspace(scratch)
    paths = [w["path"] for w in mgr.recent_workspaces()]
    assert str(proj.resolve()) in paths
    assert scratch not in paths


def test_delete_session_removes_its_scratch_dir_only(tmp_path):
    # Deleting a session also deletes its per-conversation scratch dir (owner call,
    # 2026-07-03) — but NEVER a real project folder the user picked.
    from pathlib import Path

    from coworker.server.manager import SessionManager
    from coworker.sessions import SessionRecord

    mgr = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    mgr._prefs["scratch_base"] = str(tmp_path / "scratch")

    scratch = Path(mgr._provision_scratch("sess-scratch"))
    mgr.session_store.save(
        SessionRecord(
            session_id="sess-scratch",
            workspace=str(scratch),
            model="m",
            mode="interactive",
        )
    )
    assert mgr.delete_session("sess-scratch")["ok"]
    assert not scratch.exists()

    proj = tmp_path / "real-project"
    proj.mkdir()
    mgr.session_store.save(
        SessionRecord(
            session_id="sess-proj", workspace=str(proj), model="m", mode="interactive"
        )
    )
    assert mgr.delete_session("sess-proj")["ok"]
    assert proj.is_dir()  # user folders are sacred


def test_open_invalid_workspace(tmp_path):
    client = _client(tmp_path, [])
    bad = client.post(
        "/v1/workspaces/open", json={"path": str(tmp_path / "nope")}
    ).json()
    assert bad["ok"] is False


def test_open_workspace_create(tmp_path):
    client = _client(tmp_path, [])
    fresh = tmp_path / "fresh-project"
    assert not fresh.exists()
    res = client.post(
        "/v1/workspaces/open", json={"path": str(fresh), "create": True}
    ).json()
    assert res["ok"] is True
    assert fresh.is_dir()


def test_ws_requires_workspace_when_no_default(tmp_path):
    # Manager with no default workspace: a session with no folder is rejected.
    manager = SessionManager(
        workspace=None, data_dir=tmp_path, provider=ScriptedProvider([])
    )
    client = TestClient(create_app(manager))
    with client.websocket_connect("/ws/session/nofolder") as ws:
        first = ws.receive_json()
        assert first["type"] == "error"
        assert "workspace" in first["data"]["error"]


def test_ws_with_workspace_query(tmp_path):
    from urllib.parse import quote

    proj = tmp_path / "proj"
    proj.mkdir()
    manager = SessionManager(
        workspace=None,
        data_dir=tmp_path,
        provider=ScriptedProvider([_text("hi from proj")]),
    )
    client = TestClient(create_app(manager))
    with client.websocket_connect(f"/ws/session/s?workspace={quote(str(proj))}") as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        assert ready["data"]["workspace"] == str(proj.resolve())
        ws.send_json({"type": "user_message", "text": "hello"})
        assert "turn_end" in _drain(ws)


def test_ws_chat_agent_needs_no_workspace(tmp_path):
    manager = SessionManager(
        workspace=None,
        data_dir=tmp_path,
        provider=ScriptedProvider([_text("hi from chat")]),
    )
    client = TestClient(create_app(manager))
    with client.websocket_connect("/ws/session/chat1?agent=chat") as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        assert ready["data"]["agent"] == "chat"
        assert ready["data"]["workspace"] is None
        ws.send_json({"type": "user_message", "text": "hello"})
        assert "turn_end" in _drain(ws)


def test_ws_set_mode_auto_skips_approval(tmp_path):
    from urllib.parse import quote

    proj = tmp_path / "proj"
    proj.mkdir()
    manager = SessionManager(
        workspace=None,
        data_dir=tmp_path,
        provider=ScriptedProvider(
            [_tool("write_file", {"path": "a.py", "content": "x"}), _text("done")]
        ),
    )
    client = TestClient(create_app(manager))
    with client.websocket_connect(f"/ws/session/sm?workspace={quote(str(proj))}") as ws:
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "set_mode", "mode": "auto"})
        ws.send_json({"type": "user_message", "text": "write a.py"})
        types = _drain(ws)  # no approval handler — would hang if it asked
        assert "permission_required" not in types
    assert (proj / "a.py").read_text() == "x"


def test_ws_session_resume_via_store(tmp_path):
    # First connection runs a turn and persists the session.
    client = _client(tmp_path, [_text("first answer")])
    with client.websocket_connect("/ws/session/keep") as ws:
        ws.receive_json()
        ws.send_json({"type": "user_message", "text": "remember this"})
        _drain(ws)
    # The session is now listed via REST.
    sessions = client.get("/v1/sessions").json()["sessions"]
    assert any(s["session_id"] == "keep" and s["messages"] > 0 for s in sessions)


def test_ws_first_message_binds_then_midsession_switch_persists_notice(tmp_path):
    """The FIRST user_message's model binds the session silently (race-proof across
    reconnects — found 2026-07-04). Mid-session rebinds are ALLOWED (roadmap item 3,
    2026-07-22, supersedes the 07-04 lock): the switch lands as a persisted model_switch
    notice and a model_changed broadcast, and the next turn runs on the new model."""
    # 4 turns: 3 user turns + the autotitle's fire-and-forget complete() after turn 1.
    client = _client(
        tmp_path, [_text("ok"), _text("Session title"), _text("ok again"), _text("still ok")]
    )
    with client.websocket_connect("/ws/session/model-per-msg") as ws:
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        ws.send_json({"type": "user_message", "text": "hi", "model": "zai:glm-5.2"})
        assert "model_changed" not in _drain(ws)  # first bind is silent
        # message WITHOUT a model keeps the bound one (no silent reset to default)
        ws.send_json({"type": "user_message", "text": "again"})
        _drain(ws)
        ws.send_json({"type": "set_model", "model": "kimi:kimi-k2.6"})
        changed = ws.receive_json()
        assert changed["type"] == "model_changed"
        assert changed["data"]["model"] == "kimi:kimi-k2.6"
        assert "Kimi" in changed["data"]["text"]
        ws.send_json({"type": "user_message", "text": "switched now"})
        _drain(ws)
    mgr = client.app.state.manager
    engine = mgr._engines["model-per-msg"]
    assert engine.model == "kimi:kimi-k2.6"
    # The marker is persisted between the turns; the provider never sees it.
    messages = client.get("/v1/sessions/model-per-msg/messages").json()["messages"]
    notices = [m for m in messages if m["role"] == "notice"]
    assert [n["kind"] for n in notices] == ["model_switch"]
    assert all(m.get("role") != "notice" for m in engine._outbound_messages())


def test_session_messages_prefers_the_live_engine(tmp_path):
    """Opening a RUNNING session (e.g. a scheduled automation's first turn) must show the live
    conversation: the persisted record may not exist yet mid-turn — reading only the store gave
    a blank transcript on first open (owner report, 2026-07-04)."""
    client = _client(tmp_path, [_text("ok")])
    mgr = client.app.state.manager
    engine = mgr.get_engine("__run__live", agent="chat")
    engine.messages.append({"role": "user", "content": "hi from a running automation"})

    msgs = client.get("/v1/sessions/__run__live/messages").json()["messages"]
    assert any(m.get("content") == "hi from a running automation" for m in msgs)


def test_pick_native_folder_paths(tmp_path, monkeypatch):
    """The sidecar-side folder picker (for browser GUIs): picked path round-trips; cancel and
    missing-picker degrade to ok:False without raising."""
    import subprocess
    from types import SimpleNamespace

    client = _client(tmp_path, [])
    mgr = client.app.state.manager

    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *a, **k: SimpleNamespace(
            returncode=0, stdout="/tmp/picked\n", stderr=""
        ),
    )
    assert client.post("/v1/workspaces/pick").json() == {
        "ok": True,
        "path": "/tmp/picked",
    }

    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *a, **k: SimpleNamespace(
            returncode=1, stdout="", stderr="User canceled."
        ),
    )
    assert client.post("/v1/workspaces/pick").json()["ok"] is False

    def boom(*a, **k):
        raise OSError("no zenity")

    monkeypatch.setattr(subprocess, "run", boom)
    out = mgr.pick_native_folder()
    assert out["ok"] is False and "picker" in out["error"]


def test_provider_set_and_remove_roundtrip(tmp_path):
    """Settings ▸ Models "Remove key": DELETE /v1/providers/{name} forgets the stored
    profile so the provider reads unconfigured again; unknown names are a clean error.
    """
    client = _client(tmp_path, [])
    assert client.post(
        "/v1/providers", json={"name": "zai", "fields": {"api_key": "zk-test"}}
    ).json()["ok"]
    prov = {p["name"]: p for p in client.get("/v1/providers").json()}
    assert prov["zai"]["configured"] and prov["zai"]["key_set_at"]

    assert client.delete("/v1/providers/zai").json()["ok"]
    prov = {p["name"]: p for p in client.get("/v1/providers").json()}
    assert not prov["zai"]["configured"]
    assert not prov["zai"]["key_set_at"]

    assert not client.delete("/v1/providers/nope").json()["ok"]


def test_always_allow_grants_survive_restart(tmp_path):
    """"Always allow" is session-scoped, and the session outlives the process — a restart
    (fresh manager over the same store) must not re-ask for an approved command
    (owner-hit 2026-07-22 on the 0.1.6 walkthrough)."""

    def _shell_turns():
        return ScriptedProvider(
            [
                _tool("run_shell", {"command": "uname -a"}, call_id="c1"),
                _text("done"),
            ]
        )

    def _run_turn(client, expect_prompts):
        with client.websocket_connect("/ws/session/grants1?agent=cowork") as ws:
            assert ws.receive_json()["type"] == "ready"
            ws.send_json({"type": "user_message", "text": "run it"})
            asked = 0
            while True:
                ev = ws.receive_json()
                if ev["type"] == "permission_required":
                    asked += 1
                    ws.send_json({"type": "approval", "decision": "always_command"})
                if ev["type"] == "turn_done":
                    break
            assert asked == expect_prompts

    mgr = SessionManager(workspace=None, provider=_shell_turns())
    _run_turn(TestClient(create_app(mgr)), expect_prompts=1)

    # "Restart": new manager + engine rebuilt from the persisted record.
    mgr2 = SessionManager(workspace=None, provider=_shell_turns())
    _run_turn(TestClient(create_app(mgr2)), expect_prompts=0)


def test_google_one_click_paused_but_manual_alive(tmp_path):
    """CASA verification pending: Gmail/Calendar/Drive expose managed_paused (GUI badges
    "Coming soon"), the managed-connect route refuses, and the manual fields stay."""
    client = _client(tmp_path, [])
    connectors = {c["name"]: c for c in client.get("/v1/connectors").json()["connectors"]}
    for name in ("gmail", "google_calendar", "google_drive"):
        c = connectors[name]
        assert c["managed"] is True and c["managed_paused"] is True
        assert c["fields"], f"{name} lost its manual fields"
    assert connectors["slack"]["managed_paused"] is False  # only Google is paused

    refused = client.post("/v1/connectors/gmail/connect-managed", json={}).json()
    assert refused["ok"] is False and "coming soon" in refused["error"]


def test_set_provider_persists_extra_fields(tmp_path):
    """Non-secret descriptor extras (ollama's endpoint) round-trip: saved into the
    profile, echoed by get_providers for form prefill, cleared by an empty save."""
    manager = SessionManager(workspace=tmp_path, provider=ScriptedProvider([]))
    assert manager.set_provider("ollama", {"base_url": "http://127.0.0.1:9999"})["ok"]
    providers = {p["name"]: p for p in manager.get_providers()}
    assert providers["ollama"]["values"]["base_url"] == "http://127.0.0.1:9999"

    manager.set_provider("ollama", {"base_url": ""})
    providers = {p["name"]: p for p in manager.get_providers()}
    assert "base_url" not in providers["ollama"]["values"]
