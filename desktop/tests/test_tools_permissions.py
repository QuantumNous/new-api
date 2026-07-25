"""P1 gate tests — tool registry + permission engine."""

from __future__ import annotations

from pathlib import Path

import pytest

import aisuite as ai
from coworker.permissions import Decision, Mode, PermissionEngine
from coworker.tools import ToolRegistry


def _registry(root: Path) -> ToolRegistry:
    reg = ToolRegistry()
    reg.register_all(ai.toolkits.files(root=str(root), allow_write=True))
    reg.register_all(ai.toolkits.git(root=str(root)))
    return reg


# -- ToolRegistry ---------------------------------------------------------------


def test_registry_exposes_schemas(tmp_path):
    reg = _registry(tmp_path)
    names = set(reg.names())
    assert {"read_file", "write_file", "list_files", "git_status"} <= names

    schema = reg.get("read_file").schema
    assert schema["type"] == "function"
    assert schema["function"]["name"] == "read_file"
    assert "parameters" in schema["function"]


def test_registry_execute_read_file(tmp_path):
    (tmp_path / "hello.txt").write_text("hi there", encoding="utf-8")
    reg = _registry(tmp_path)
    assert reg.execute("read_file", {"path": "hello.txt"}) == "hi there"


def test_registry_path_traversal_blocked(tmp_path):
    reg = _registry(tmp_path)
    with pytest.raises((PermissionError, ValueError)):
        reg.execute("read_file", {"path": "../../etc/passwd"})


def test_registry_execute_unknown_tool(tmp_path):
    reg = _registry(tmp_path)
    with pytest.raises(KeyError):
        reg.execute("nope", {})


# -- PermissionEngine -----------------------------------------------------------


def _meta(reg: ToolRegistry, name: str):
    return reg.get(name).metadata


def test_read_auto_allowed(tmp_path):
    reg = _registry(tmp_path)
    eng = PermissionEngine(workspace_root=tmp_path)
    d = eng.evaluate("read_file", {"path": "x"}, _meta(reg, "read_file"))
    assert d.allowed and not d.needs_user


def test_write_requires_approval(tmp_path):
    reg = _registry(tmp_path)
    eng = PermissionEngine(workspace_root=tmp_path)
    d = eng.evaluate(
        "write_file", {"path": "x.py", "content": "x"}, _meta(reg, "write_file")
    )
    assert not d.allowed and d.needs_user


def test_write_path_escape_denied(tmp_path):
    reg = _registry(tmp_path)
    eng = PermissionEngine(workspace_root=tmp_path)
    d = eng.evaluate(
        "write_file", {"path": "../escape.py", "content": "x"}, _meta(reg, "write_file")
    )
    assert not d.allowed and not d.needs_user
    assert "escape" in d.reason


def test_plan_mode_blocks_writes(tmp_path):
    reg = _registry(tmp_path)
    eng = PermissionEngine(workspace_root=tmp_path, mode=Mode.PLAN)
    d = eng.evaluate(
        "write_file", {"path": "x.py", "content": "x"}, _meta(reg, "write_file")
    )
    assert not d.allowed and not d.needs_user
    assert "read-only" in d.reason


def test_shell_allowlist(tmp_path):
    eng = PermissionEngine(workspace_root=tmp_path, allowed_commands=["pytest", "ls"])
    allowed = eng.evaluate("run_shell", {"command": "pytest -q"}, None)
    asked = eng.evaluate("run_shell", {"command": "rm -rf /"}, None)
    assert allowed.allowed
    assert not asked.allowed and asked.needs_user


def test_session_allow_tool_sticks(tmp_path):
    reg = _registry(tmp_path)
    eng = PermissionEngine(workspace_root=tmp_path)
    args = {"path": "x.py", "content": "x"}
    assert eng.evaluate("write_file", args, _meta(reg, "write_file")).needs_user
    eng.allow_tool_for_session("write_file")
    d = eng.evaluate("write_file", args, _meta(reg, "write_file"))
    assert d.allowed and not d.needs_user


def test_session_allow_command_sticks(tmp_path):
    eng = PermissionEngine(workspace_root=tmp_path)
    assert eng.evaluate("run_shell", {"command": "make build"}, None).needs_user
    eng.allow_command_for_session("make build")
    assert eng.evaluate("run_shell", {"command": "make build"}, None).allowed


def test_custom_mode_auto_allows_configured_tools(tmp_path):
    reg = _registry(tmp_path)
    eng = PermissionEngine(
        workspace_root=tmp_path, mode=Mode.CUSTOM, auto_allow_tools={"write_file"}
    )
    # configured tool auto-allowed...
    write = eng.evaluate(
        "write_file", {"path": "x.py", "content": "x"}, _meta(reg, "write_file")
    )
    assert write.allowed and not write.needs_user
    # ...but a non-configured high-risk tool still asks
    shell = eng.evaluate("run_shell", {"command": "rm -rf x"}, None)
    assert not shell.allowed and shell.needs_user
    # path scoping still enforced in custom mode
    escape = eng.evaluate(
        "write_file", {"path": "../x.py", "content": "x"}, _meta(reg, "write_file")
    )
    assert not escape.allowed


def test_auto_mode_allows_but_path_scopes(tmp_path):
    reg = _registry(tmp_path)
    eng = PermissionEngine(workspace_root=tmp_path, mode=Mode.AUTO)
    ok = eng.evaluate(
        "write_file", {"path": "x.py", "content": "x"}, _meta(reg, "write_file")
    )
    escape = eng.evaluate(
        "write_file", {"path": "../x.py", "content": "x"}, _meta(reg, "write_file")
    )
    assert ok.allowed
    assert not escape.allowed
