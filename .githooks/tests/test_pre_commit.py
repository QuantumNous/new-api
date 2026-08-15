"""Unit tests for .githooks/hooks/pre-commit CM-03 (commit title vs PR title consistency).

Run from repo root:
    python -m pytest .githooks/tests/test_pre_commit.py -v
"""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import importlib.machinery
import importlib.util

_loader = importlib.machinery.SourceFileLoader(
    "pre_commit_hook", str(Path(__file__).resolve().parents[1] / "hooks" / "pre-commit"))
_spec = importlib.util.spec_from_loader("pre_commit_hook", _loader)
pc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pc)  # type: ignore[union-attr]
from lib._shared import Severity  # noqa: E402


def _setup(repo: Path, commit_title: str, branch: str = "feat/foo") -> str:
    """创建 tmp 仓库结构 + 写 COMMIT_EDITMSG。"""
    gitdir = repo / ".git"
    gitdir.mkdir()
    (gitdir / "COMMIT_EDITMSG").write_text(commit_title + "\n\nbody\n", encoding="utf-8")
    return branch


@pytest.fixture
def env(tmp_path):
    """patch ROOT 指向 tmp_path/.githooks（ROOT.parent 即仓库根，含 .git/）。"""
    githooks = tmp_path / ".githooks"
    githooks.mkdir()
    with patch.object(pc, "ROOT", githooks):
        yield tmp_path


def test_no_pr_skips_check(env):
    _setup(env, "feat: some work", "feat/foo")
    with patch.object(pc, "_derive_repo", return_value=("owner", "repo")), \
         patch.object(pc, "_gh_api", return_value=(0, "[]")), \
         patch.object(pc.subprocess, "run",
               return_value=MagicMock(stdout="feat/foo\n")):
        findings = pc._check_commit_pr_consistency()
    assert not any(f.rule_id == "CM-03" for f in findings)


def test_matching_type_passes(env):
    _setup(env, "feat: some work", "feat/foo")
    pr = {"number": 158, "title": "feat: add widget"}
    with patch.object(pc, "_derive_repo", return_value=("owner", "repo")), \
         patch.object(pc, "_gh_api", return_value=(0, json.dumps([pr]))), \
         patch.object(pc.subprocess, "run",
               return_value=MagicMock(stdout="feat/foo\n")):
        findings = pc._check_commit_pr_consistency()
    assert not any(f.rule_id == "CM-03" for f in findings)


def test_mismatched_type_fails(env):
    _setup(env, "fix: correct the bug", "feat/foo")
    pr = {"number": 158, "title": "feat: add widget"}
    with patch.object(pc, "_derive_repo", return_value=("owner", "repo")), \
         patch.object(pc, "_gh_api", return_value=(0, json.dumps([pr]))), \
         patch.object(pc.subprocess, "run",
               return_value=MagicMock(stdout="feat/foo\n")):
        findings = pc._check_commit_pr_consistency()
    cm03 = [f for f in findings if f.rule_id == "CM-03"]
    assert len(cm03) == 1
    assert cm03[0].severity == Severity.FAIL
    assert "fix" in cm03[0].message and "feat" in cm03[0].message


def test_api_failure_skips(env):
    _setup(env, "fix: correct the bug", "feat/foo")
    with patch.object(pc, "_derive_repo", return_value=("owner", "repo")), \
         patch.object(pc, "_gh_api", return_value=(-1, "")), \
         patch.object(pc.subprocess, "run",
               return_value=MagicMock(stdout="feat/foo\n")):
        findings = pc._check_commit_pr_consistency()
    assert not any(f.rule_id == "CM-03" for f in findings)


def test_main_branch_skips(env):
    _setup(env, "feat: some work", "main")
    with patch.object(pc, "_derive_repo", return_value=("owner", "repo")), \
         patch.object(pc, "_gh_api", return_value=(0, "[]")):
        findings = pc._check_commit_pr_consistency()
    assert not any(f.rule_id == "CM-03" for f in findings)


def test_non_conventional_pr_title_skips(env):
    _setup(env, "feat: some work", "feat/foo")
    pr = {"number": 158, "title": "add widget directly"}
    with patch.object(pc, "_derive_repo", return_value=("owner", "repo")), \
         patch.object(pc, "_gh_api", return_value=(0, json.dumps([pr]))), \
         patch.object(pc.subprocess, "run",
               return_value=MagicMock(stdout="feat/foo\n")):
        findings = pc._check_commit_pr_consistency()
    assert not any(f.rule_id == "CM-03" for f in findings)
