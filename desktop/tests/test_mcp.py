"""Tests for MCP (C1): config loading/merge, tool wrapping + bridge, and REST.

No live MCP subprocess is needed — the connection layer is exercised by stubbing the call
coroutine; a live-server smoke test is documented in the plan instead.
"""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from coworker.mcp import build_callables, load_mcp_servers, tool_name
from coworker.mcp.config import MCPServerDef
from coworker.secrets import SecretStore
from coworker.server.app import create_app
from coworker.server.manager import SessionManager


def _write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def _fake_tool(name, schema=None, description="desc"):
    return SimpleNamespace(
        name=name,
        description=description,
        inputSchema=schema
        or {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    )


# -- config --------------------------------------------------------------------
def test_load_merges_global_and_workspace(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    _write_json(
        tmp_path / "state" / "mcp.json",
        {
            "mcpServers": {
                "fs": {"command": "echo", "args": ["global"], "enabled": True},
                "docs": {"type": "http", "url": "https://x/mcp", "enabled": False},
            }
        },
    )
    ws = tmp_path / "ws"
    _write_json(
        ws / ".coworker" / "mcp.json",
        {
            "mcpServers": {
                "fs": {
                    "command": "echo",
                    "args": ["workspace-wins"],
                },  # overrides global
            }
        },
    )

    servers = {s.name: s for s in load_mcp_servers(ws, secrets=SecretStore())}
    assert servers["fs"].args == ["workspace-wins"]
    assert servers["fs"].transport == "stdio"
    assert servers["docs"].transport == "http" and servers["docs"].enabled is False
    assert servers["docs"].requires_approval is True  # default


def test_var_resolution(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("DOCS_TOKEN", "sekret")
    _write_json(
        tmp_path / "state" / "mcp.json",
        {
            "mcpServers": {
                "docs": {
                    "type": "http",
                    "url": "https://x/mcp",
                    "headers": {"Authorization": "Bearer ${DOCS_TOKEN}"},
                },
            }
        },
    )
    docs = load_mcp_servers(None, secrets=SecretStore())[0]
    assert docs.headers["Authorization"] == "Bearer sekret"


# -- tool wrapping + bridge ----------------------------------------------------
def test_tool_name_sanitizes():
    assert tool_name("fs", "read_file") == "mcp__fs__read_file"
    assert "." not in tool_name("a.b", "c.d")


def test_schema_and_metadata():
    server = MCPServerDef(name="fs", transport="stdio", requires_approval=True)
    fns = build_callables(
        server, [_fake_tool("read_file")], lambda t, a: None, asyncio.new_event_loop()
    )
    fn = fns[0]
    assert fn.__name__ == "mcp__fs__read_file"
    meta = fn.__aisuite_tool_metadata__
    assert meta.category == "mcp" and meta.requires_approval is True
    schema = fn.__coworker_schema__["function"]
    assert schema["name"] == "mcp__fs__read_file"
    assert schema["parameters"]["required"] == ["path"]


def test_include_exclude_filter():
    server = MCPServerDef(name="fs", transport="stdio", include_tools=["read_file"])
    fns = build_callables(
        server,
        [_fake_tool("read_file"), _fake_tool("delete_file")],
        lambda t, a: None,
        asyncio.new_event_loop(),
    )
    assert [f.__name__ for f in fns] == ["mcp__fs__read_file"]


async def test_bridge_invokes_session_on_loop():
    loop = asyncio.get_running_loop()
    seen = []

    async def call_async(tool, args):
        seen.append((tool, args))
        return {"echo": args}

    server = MCPServerDef(name="fs", transport="stdio")
    fn = build_callables(server, [_fake_tool("read_file")], call_async, loop)[0]
    # The engine runs tools via to_thread; the wrapper bridges back to this loop.
    result = await asyncio.to_thread(fn, path="a.txt")
    assert result == {"echo": {"path": "a.txt"}}
    assert seen == [("read_file", {"path": "a.txt"})]


# -- REST ----------------------------------------------------------------------
def test_rest_crud(tmp_path, monkeypatch):
    monkeypatch.setenv("COWORKER_STATE_DIR", str(tmp_path / "state"))
    manager = SessionManager(data_dir=tmp_path / "data")
    client = TestClient(create_app(manager))

    assert client.get("/v1/mcp").json()["servers"] == []

    r = client.post(
        "/v1/mcp",
        json={
            "name": "fs",
            "config": {"command": "echo", "args": ["x"], "env": {"SECRET": "shh"}},
        },
    )
    assert r.json()["ok"] is True

    servers = client.get("/v1/mcp").json()["servers"]
    assert servers[0]["name"] == "fs" and servers[0]["status"] == "configured"
    assert servers[0]["config"]["env"]["SECRET"] == "***"  # redacted

    assert client.patch("/v1/mcp/fs", json={"enabled": False}).json()["ok"] is True
    assert client.get("/v1/mcp").json()["servers"][0]["enabled"] is False

    assert client.delete("/v1/mcp/fs").json()["ok"] is True
    assert client.get("/v1/mcp").json()["servers"] == []
    assert client.delete("/v1/mcp/fs").json()["ok"] is False
