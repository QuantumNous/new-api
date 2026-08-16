"""Unit tests for .githooks/install_gh_gate.py helper functions.

Run from repo root:
    python -m pytest .githooks/tests/test_gh_gate.py -v
"""
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import importlib
import importlib.machinery
import importlib.util
_loader = importlib.machinery.SourceFileLoader("install_gh_gate", str(Path(__file__).resolve().parents[1] / "install_gh_gate.py"))
_spec = importlib.util.spec_from_loader("install_gh_gate", _loader)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
_section = _mod._section
_check_done_when_fully_ticked = _mod._check_done_when_fully_ticked
_extract = _mod._extract
_gh_args = _mod._gh_args
_intercept_issue_create = _mod._intercept_issue_create
_intercept_pr_merge = _mod._intercept_pr_merge

# ---------------------------------------------------------------------------
# _section
# ---------------------------------------------------------------------------

def test_section_extracts_under_heading():
    body = "## Goal\n内容\n\n## Done when\n- [x] 完成\n\n## Background\n背景"
    sec = _section(body, "Done when")
    assert "- [x] 完成" in sec
    assert "## Background" not in sec


def test_section_missing_heading():
    assert _section("## Goal\n内容", "Missing") == ""


# ---------------------------------------------------------------------------
# _check_done_when_fully_ticked
# ---------------------------------------------------------------------------

def test_all_ticked():
    body = "## Done when\n- [x] 完成\n- [x] 验证\n"
    ok, unticked = _check_done_when_fully_ticked(body)
    assert ok is True
    assert len(unticked) == 0


def test_some_unticked():
    body = "## Done when\n- [x] 完成\n- [ ] 待做\n- [x] 验证\n- [ ] 待测\n"
    ok, unticked = _check_done_when_fully_ticked(body)
    assert ok is False
    assert len(unticked) == 2
    assert "待做" in unticked
    assert "待测" in unticked


def test_no_done_when_section():
    body = "## Goal\n内容\n"
    ok, unticked = _check_done_when_fully_ticked(body)
    assert ok is True
    assert len(unticked) == 0


def test_custom_heading():
    plan = "## Construction plan\n- [x] step1\n- [ ] step2\n"
    ok, unticked = _check_done_when_fully_ticked(plan, "Construction plan")
    assert ok is False
    assert len(unticked) == 1


def test_empty_section():
    body = "## Done when\n"
    ok, unticked = _check_done_when_fully_ticked(body)
    assert ok is True
    assert len(unticked) == 0


# ---------------------------------------------------------------------------
# _extract
# ---------------------------------------------------------------------------

def test_extract_title_body_labels():
    args = ["--title", "DEMO test", "--body", "正文内容", "--label", "sub,enhancement", "--label", "bug"]
    title, body, labels, head, parent = _extract(args)
    assert title == "DEMO test"
    assert body == "正文内容"
    assert "sub" in labels
    assert "enhancement" in labels
    assert "bug" in labels
    assert head == ""
    assert parent == ""


def test_extract_head_parent():
    args = ["--title", "feat: test", "--head", "feat/xxx", "--parent", "124"]
    title, body, labels, head, parent = _extract(args)
    assert title == "feat: test"
    assert head == "feat/xxx"
    assert parent == "124"


def test_extract_equals_form():
    args = ["--title=DEMO", "--body=内容", "--label=bug", "--head=feat/x", "--parent=125"]
    title, body, labels, head, parent = _extract(args)
    assert title == "DEMO"
    assert body == "内容"
    assert "bug" in labels
    assert head == "feat/x"
    assert parent == "125"


def test_extract_empty():
    title, body, labels, head, parent = _extract([])
    assert title == ""
    assert body == ""
    assert labels == []
    assert head == ""
    assert parent == ""


# ---------------------------------------------------------------------------
# _gh_args
# ---------------------------------------------------------------------------

def test_gh_args_removes_parent():
    args = ["--title", "x", "--parent", "124", "--body", "y"]
    result = _gh_args(args)
    assert "--parent" not in result
    assert "124" not in result
    assert "--title" in result
    assert "--body" in result


def test_gh_args_keeps_other_args():
    args = ["--title", "x", "--label", "bug,enhancement", "--head", "feat/x"]
    result = _gh_args(args)
    assert result == args


def test_gh_args_equals_parent():
    args = ["--title=x", "--parent=124", "--body=y"]
    result = _gh_args(args)
    assert "--parent=124" not in result
    assert result == ["--title=x", "--body=y"]


# ---------------------------------------------------------------------------
# GT-01 --disable-check 逃生门
# ---------------------------------------------------------------------------


def test_disable_check_bypasses_validation(monkeypatch):
    """--disable-check 跳过校验，走 _passthrough 透传。"""
    called_log = []
    monkeypatch.setattr(_mod, "_log", lambda *a: called_log.append(a))
    monkeypatch.setattr(_mod, "_derive_repo", lambda: "owner/repo")
    monkeypatch.setattr(_mod, "_find_project_githooks", lambda: None)
    monkeypatch.setattr(_mod, "_run_gh",
                        lambda *a, **kw: (0, "https://github.com/owner/repo/issues/999", ""))
    rc = _intercept_issue_create(["--disable-check", "--title", "test", "--body", "body"])
    assert rc == 0
    assert any("BYPASS" in str(c) for c in called_log), "日志应记录 BYPASS"

def test_disable_check_not_in_passthrough_args(monkeypatch):
    """--disable-check 不应出现在传给 gh 的参数中。"""
    captured = []
    monkeypatch.setattr(_mod, "_log", lambda *a: None)
    monkeypatch.setattr(_mod, "_derive_repo", lambda: "owner/repo")
    monkeypatch.setattr(_mod, "_find_project_githooks", lambda: None)
    original_passthrough = _mod._passthrough
    def tracking_passthrough(args):
        captured.append(args)
        return original_passthrough(args)
    monkeypatch.setattr(_mod, "_passthrough", tracking_passthrough)
    monkeypatch.setattr(_mod, "_run_gh", lambda *a, **kw: (0, "https://github.com/owner/repo/issues/999", ""))
    _intercept_issue_create(["--disable-check", "--title", "x", "--body", "y"])
    assert captured, "应调用 _passthrough"
    passthrough_args = captured[0]
    assert "--disable-check" not in passthrough_args
    assert "issue" in passthrough_args
    assert "create" in passthrough_args


# ---------------------------------------------------------------------------
# #154 merge squash 标题 CS 校验
# ---------------------------------------------------------------------------


def _ok_body() -> str:
    return ("## Construction plan\n- [x] step\n"
            "## Checklist\n- [x] 已使用 Fixes #N\n")


def test_pr_merge_rejects_non_cc_title(monkeypatch):
    """PR 标题非 conventional commit → merge 拦截。"""
    log = []
    monkeypatch.setattr(_mod, "_log", lambda *a: log.append(a))
    monkeypatch.setattr(_mod, "_derive_repo", lambda: "owner/repo")
    def fake_gh(args):
        if "--jq" in args:
            jq = args[args.index("--jq") + 1]
            if jq == ".body":
                return 0, _ok_body(), ""
            if jq == ".title":
                return 0, "add widget without prefix", ""
        return 0, "", ""
    monkeypatch.setattr(_mod, "_run_gh", fake_gh)
    rc = _intercept_pr_merge(["158", "--squash", "--body", "reason"])
    assert rc == 1
    assert any("title not CC" in str(c) for c in log)


def test_pr_merge_accepts_cc_title(monkeypatch):
    """PR 标题 conventional commit → merge 放行。"""
    monkeypatch.setattr(_mod, "_derive_repo", lambda: "owner/repo")
    def fake_gh(args):
        if "--jq" in args:
            jq = args[args.index("--jq") + 1]
            if jq == ".body":
                return 0, _ok_body(), ""
            if jq == ".title":
                return 0, "feat: add widget", ""
        if args[:2] == ["pr", "merge"]:
            return 0, "", ""
        if args[:2] == ["pr", "comment"]:
            return 0, "", ""
        return 0, "", ""
    monkeypatch.setattr(_mod, "_run_gh", fake_gh)
    rc = _intercept_pr_merge(["158", "--squash", "--body", "reason"])
    assert rc == 0

def test_pr_merge_cleans_local_branch(monkeypatch):
    """merge 成功后自动删除本地 head 分支。"""
    monkeypatch.setattr(_mod, "_derive_repo", lambda: "owner/repo")
    fake_subprocess = MagicMock()
    monkeypatch.setattr(_mod, "subprocess", fake_subprocess)
    def fake_gh(args):
        if "--jq" in args:
            jq = args[args.index("--jq") + 1]
            if jq == ".body":
                return 0, ("## Construction plan\n- [x] step\n"
                           "## Checklist\n- [x] 已使用 Fixes #N\n"), ""
            if jq == ".title":
                return 0, "feat: add widget", ""
            if jq == ".head.ref":
                return 0, "feat/foo", ""
        if args[:2] == ["pr", "merge"]:
            return 0, "", ""
        if args[:2] == ["pr", "comment"]:
            return 0, "", ""
        return 0, "", ""
    monkeypatch.setattr(_mod, "_run_gh", fake_gh)
    monkeypatch.setattr(_mod, "_log", lambda *a, **kw: None)
    rc = _intercept_pr_merge(["158", "--squash", "--body", "reason"])
    assert rc == 0
    calls = [str(c) for c in fake_subprocess.run.call_args_list]
    assert any("-d" in c and "feat/foo" in c for c in calls), "应调用 git branch -d feat/foo"