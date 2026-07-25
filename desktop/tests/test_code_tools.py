"""Tests for the Code agent's new tools: grep (ripgrep/python), git_log, web_fetch.

No network: web_fetch is exercised via its URL guard + the HTML→text helper. grep/git_log run
against temp dirs (git_log needs a real `git`, which the dev box has).
"""

from __future__ import annotations

import subprocess
from types import SimpleNamespace

import pytest

from coworker.tools.files import file_tools
from coworker.tools.git import git_tools
from coworker.tools.search import _py_grep, search_tools
from coworker.web.fetch import _html_to_text, make_web_fetch_tool


# -- grep ----------------------------------------------------------------------
def _seed(tmp_path):
    (tmp_path / "a.py").write_text("def hello():\n    return 42\n", encoding="utf-8")
    (tmp_path / "b.txt").write_text("hello world\nbye\n", encoding="utf-8")
    nm = tmp_path / "node_modules" / "pkg"
    nm.mkdir(parents=True)
    (nm / "junk.py").write_text("hello from deps\n", encoding="utf-8")


def test_grep_finds_matches_and_respects_glob(tmp_path):
    _seed(tmp_path)
    grep = search_tools(str(tmp_path))[0]
    out = grep(pattern="hello")
    files = {m["file"] for m in out["matches"]}
    assert "a.py" in files and "b.txt" in files
    # node_modules is ignored by both engines
    assert not any("node_modules" in f for f in files)
    # glob filter restricts to python files
    only_py = grep(pattern="hello", glob="*.py")
    assert all(m["file"].endswith(".py") for m in only_py["matches"])
    assert not any("node_modules" in m["file"] for m in only_py["matches"])
    assert only_py["matches"][0]["line"] == 1


def test_ripgrep_uses_the_same_ignored_dirs_as_the_python_fallback(tmp_path, monkeypatch):
    import coworker.tools.search as search

    commands = []
    monkeypatch.setattr(search.shutil, "which", lambda name: "rg")
    monkeypatch.setattr(
        search.subprocess,
        "run",
        lambda cmd, **kwargs: commands.append(cmd)
        or SimpleNamespace(returncode=0, stdout="", stderr=""),
    )

    search_tools(str(tmp_path))[0](pattern="hello", glob="*.py")

    assert commands
    user_glob = commands[0].index("*.py")
    for ignored in search._IGNORE_DIRS:
        assert commands[0].index(f"!**/{ignored}/**") > user_glob


def test_grep_rejects_path_escape(tmp_path):
    grep = search_tools(str(tmp_path))[0]
    assert "escapes" in grep(pattern="x", path="../..")["error"]


def test_py_grep_fallback_skips_ignored_dirs(tmp_path):
    _seed(tmp_path)
    res = _py_grep(tmp_path.resolve(), tmp_path.resolve(), "hello", None, 100)
    assert res["count"] == 2  # a.py + b.txt, NOT node_modules
    assert all("node_modules" not in m["file"] for m in res["matches"])


# -- git_log -------------------------------------------------------------------
def test_git_log_lists_commits(tmp_path):
    ws = tmp_path / "repo"
    ws.mkdir()
    run = lambda *a: subprocess.run(
        ["git", "-C", str(ws), *a], capture_output=True, check=True
    )
    run("init", "-q")
    run("config", "user.email", "t@t.io")
    run("config", "user.name", "T")
    (ws / "f.txt").write_text("1", encoding="utf-8")
    run("add", "-A")
    run("commit", "-qm", "first")
    (ws / "f.txt").write_text("2", encoding="utf-8")
    run("add", "-A")
    run("commit", "-qm", "second")

    git_log = git_tools(str(ws))[0]
    out = git_log(max_count=10)
    assert out["count"] == 2
    assert out["commits"][0]["subject"] == "second"  # newest first
    assert set(out["commits"][0]) == {"hash", "author", "date", "subject"}


def test_git_log_errors_outside_repo(tmp_path):
    git_log = git_tools(str(tmp_path))[0]
    assert "error" in git_log()


# -- read_file -----------------------------------------------------------------
def test_read_file_numbers_lines(tmp_path):
    (tmp_path / "a.py").write_text("one\ntwo\nthree\n", encoding="utf-8")
    read_file = file_tools(str(tmp_path))[0]
    out = read_file(path="a.py")
    assert out["total_lines"] == 3
    assert out["start_line"] == 1 and out["end_line"] == 3
    assert out["content"].splitlines()[0].endswith("1\tone")
    assert "note" not in out  # nothing left to read


def test_read_file_windows_and_tells_how_to_continue(tmp_path):
    (tmp_path / "big.txt").write_text(
        "\n".join(f"line{i}" for i in range(1, 51)) + "\n", encoding="utf-8"
    )
    read_file = file_tools(str(tmp_path))[0]
    out = read_file(path="big.txt", start_line=5, max_lines=10)
    assert out["start_line"] == 5 and out["end_line"] == 14
    assert out["total_lines"] == 50
    assert "line5" in out["content"] and "line15" not in out["content"]
    assert "start_line=15" in out["note"]


def test_read_file_truncates_long_lines(tmp_path):
    (tmp_path / "wide.txt").write_text("x" * 2000 + "\n", encoding="utf-8")
    read_file = file_tools(str(tmp_path))[0]
    out = read_file(path="wide.txt")
    assert "(line truncated)" in out["content"]
    assert len(out["content"]) < 1000


def test_read_file_rejects_escape_and_non_files(tmp_path):
    read_file = file_tools(str(tmp_path))[0]
    assert "escapes" in read_file(path="../secret.txt")["error"]
    assert "not a file" in read_file(path="missing.txt")["error"]


# -- web_fetch -----------------------------------------------------------------
def test_web_fetch_rejects_non_http():
    web_fetch = make_web_fetch_tool()
    assert "http" in web_fetch("file:///etc/passwd")["error"]
    assert "http" in web_fetch("javascript:alert(1)")["error"]


def test_html_to_text_strips_scripts_and_tags():
    html = "<html><head><style>x{}</style></head><body><h1>Hi</h1><script>bad()</script><p>Body text</p></body></html>"
    text = _html_to_text(html)
    assert "Hi" in text and "Body text" in text
    assert "bad()" not in text and "x{}" not in text


# -- Code agent wiring ---------------------------------------------------------
def test_code_agent_has_grep_and_git_log_not_search_files(tmp_path):
    from coworker.agents.base import AgentContext
    from coworker.agents.code import code_agent

    ctx = AgentContext(workspace=tmp_path, executor=None, todo=None)
    names = {getattr(t, "__name__", "") for t in code_agent().build_tools(ctx)}
    assert "grep" in names and "git_log" in names
    assert "search_files" not in names  # replaced by grep
    assert "read_file_lines" not in names  # folded into our windowed read_file
    assert {"read_file", "write_file", "git_status", "git_diff"} <= names


def test_cowork_has_grep_not_search_files(tmp_path):
    from coworker.agents.base import AgentContext
    from coworker.agents.cowork import cowork_tool_factory

    names = {
        getattr(t, "__name__", "")
        for t in cowork_tool_factory(AgentContext(workspace=tmp_path))
    }
    assert "grep" in names and "search_files" not in names
    assert "git_log" not in names  # git history isn't useful for Cowork
