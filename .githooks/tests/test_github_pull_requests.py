"""Unit tests for .githooks/github/pull_requests.py.

Run from .githooks:
    cd .githooks && python -m pytest tests/test_github_pull_requests.py -v
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from lib._shared import aggregate_result, Severity
from github.pull_requests import run


# ---------------------------------------------------------------------------
# Mock helper
# ---------------------------------------------------------------------------

class MockGhApi:
    def __init__(self, scripted):
        self.scripted = list(scripted)
        self.calls = []

    def gh_api_get(self, path, params=None):
        rc, out = self.scripted.pop(0)
        self.calls.append(("gh_api_get", path, params, rc, out))
        if rc:
            return None
        return out


def _patch_and_run(scripted, repo="hathawayANdRX105/omenic", num=95, mode="", strict=False):
    """Patch gh_api_get and run, restoring after."""
    import github.pull_requests as mod
    mock = MockGhApi(scripted)
    orig = mod.gh_api_get
    mod.gh_api_get = mock.gh_api_get
    try:
        findings = run(repo, num, mode=mode, strict=strict)
    finally:
        mod.gh_api_get = orig
    return findings


def _good_pr_body():
    return (
        "## Issue\nFixes #100\n\n"
        "## What\n这是一个修复。\n\n"
        "## Why\n原因如下。\n\n"
        "## Construction plan\n- [x] step1\n- [x] step2\n\n"
        "## Delivery record\n完成。\n\n"
        "## How to test\n运行测试。\n\n"
        "## Checklist\n- [x] done\n- [x] reviewed\n"
    )


def _pr_scripted(title="feat: 测试PR", body=None, state="closed", labels=None,
                 head_ref="feat/test", draft=False, repo_labels=None):
    """Build a complete scripted sequence for pull_requests.run()."""
    body = body or _good_pr_body()
    labels = labels or [{"name": "enhancement"}]
    repo_labels = repo_labels or [{"name": "enhancement"}, {"name": "bug"}]
    return [
        (0, {
            "title": title,
            "body": body,
            "state": state,
            "labels": labels,
            "head": {"ref": head_ref},
            "draft": draft,
        }),
        (0, repo_labels),
        (0, repo_labels),
        # repos/{repo}/issues/{fn} — PR-10 epic 检查（body 有 Fixes #N 时消耗）
        (0, {"number": 100, "title": "dummy issue"}),
        # repos/{repo}/issues/{fn}/sub_issues — 空列表（普通 issue，非 parent）
        (0, []),
    ]


# ---------------------------------------------------------------------------
# CLI / config
# ---------------------------------------------------------------------------

def test_load_yaml_config():
    from lib._shared import load_yaml
    cfg = load_yaml(Path(__file__).resolve().parents[1] / "spec" / "github_pull_requests.yaml")
    assert "Issue" in cfg["required_body_headings"]
    assert "What" in cfg["required_body_headings"]
    assert "feat/" in cfg["allowed_branch_prefixes"]


# ---------------------------------------------------------------------------
# Title checks
# ---------------------------------------------------------------------------

def test_p01_title_english():
    """P-01: title with CJK → FAIL."""
    scripted = _pr_scripted(title="中文标题", head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p01 = [f for f in findings if f.rule_id == "PR-01"]
    assert len(p01) == 1
    assert p01[0].severity.name == "FAIL"


def test_p02_conventional_commit():
    """P-02: conventional commit title → INFO."""
    scripted = _pr_scripted(title="feat(scope): add feature", head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p02 = [f for f in findings if f.rule_id == "PR-02"]
    assert len(p02) == 1
    assert p02[0].severity.name == "INFO"


def test_p02_non_conventional():
    """P-02: non-conventional title → WARN."""
    scripted = _pr_scripted(title="just a description", head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p02 = [f for f in findings if f.rule_id == "PR-02"]
    assert len(p02) == 1
    assert p02[0].severity.name == "WARN"


# ---------------------------------------------------------------------------
# Body structure
# ---------------------------------------------------------------------------

def test_missing_body_heading():
    """Missing required body heading → FAIL."""
    body = "## Issue\nFixes #100\n\n## What\n内容。\n"
    scripted = _pr_scripted(body=body, head_ref="feat/test")
    findings = _patch_and_run(scripted)
    failures = [f for f in findings if f.rule_id == "PR-03" and f.severity.name == "FAIL"]
    assert len(failures) > 0
    assert any("Construction plan" in f.message for f in failures)


def test_all_body_headings_present():
    """All required body headings present → no P-xx FAIL."""
    scripted = _pr_scripted(head_ref="feat/test")
    findings = _patch_and_run(scripted)
    fails = [f for f in findings if f.rule_id == "PR-03" and f.severity.name == "FAIL"]
    assert len(fails) == 0


# ---------------------------------------------------------------------------
# Issue linkage
# ---------------------------------------------------------------------------

def test_p11_premature_fixes():
    """P-11: open PR with Fixes → WARN."""
    body = "## Issue\nFixes #100\n\n## What\n内容\n"
    scripted = _pr_scripted(body=body, state="open", head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p11 = [f for f in findings if f.rule_id == "PR-05"]
    assert any(f.severity.name == "WARN" for f in p11)


def test_p12_no_fixes():
    """P-12: no Fixes and not draft → WARN."""
    # P-11/P-12/P-13 merged to PR-05, so count may be 2+
    body = "## What\n内容\n"
    scripted = _pr_scripted(body=body, state="open", head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p12 = [f for f in findings if f.rule_id == "PR-05"]
    assert any(f.severity.name == "WARN" for f in p12)


def test_p12_one_fixes():
    """P-12: exactly one Fixes → INFO."""
    scripted = _pr_scripted(head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p12 = [f for f in findings if f.rule_id == "PR-05"]
    assert len(p12) >= 1
    assert p12[0].severity.name == "INFO"


def test_p13_multiple_fixes():
    """P-13: multiple Fixes → FAIL."""
    body = "## Issue\nFixes #100 Fixes #101\n\n## What\n内容\n"
    scripted = _pr_scripted(body=body, head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p13 = [f for f in findings if f.rule_id == "PR-05"]
    assert len(p13) >= 1
    assert any(f.severity.name == "FAIL" for f in p13)


# ---------------------------------------------------------------------------
# Branch name
# ---------------------------------------------------------------------------

def test_p31_valid_branch():
    """P-31: valid branch prefix → INFO."""
    scripted = _pr_scripted(head_ref="feat/issue-100")
    findings = _patch_and_run(scripted)
    p31 = [f for f in findings if f.rule_id == "PR-08"]
    assert len(p31) == 1
    assert p31[0].severity.name == "INFO"


def test_p31_invalid_branch():
    """P-31: invalid branch prefix → FAIL."""
    scripted = _pr_scripted(head_ref="random/branch")
    findings = _patch_and_run(scripted)
    p31 = [f for f in findings if f.rule_id == "PR-08"]
    assert len(p31) == 1
    assert p31[0].severity.name == "FAIL"


# ---------------------------------------------------------------------------
# Language
# ---------------------------------------------------------------------------

def test_p10_headings_english():
    """P-10: English headings → INFO."""
    scripted = _pr_scripted(head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p10 = [f for f in findings if f.rule_id == "PR-04"]
    assert all(f.severity.name != "FAIL" for f in p10)


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

def test_p14_unknown_label():
    """P-14: label not in repo → FAIL."""
    scripted = _pr_scripted(labels=[{"name": "nonexistent"}], head_ref="feat/test")
    findings = _patch_and_run(scripted)
    p14 = [f for f in findings if f.rule_id == "PR-06"]
    assert any(f.severity.name == "FAIL" for f in p14)


def test_p14b_no_type_label():
    """P-14b: no type label → FAIL."""
    scripted = _pr_scripted(
        labels=[{"name": "wontfix"}],
        repo_labels=[{"name": "wontfix"}, {"name": "enhancement"}],
        head_ref="feat/test",
    )
    findings = _patch_and_run(scripted)
    p14b_fail = [f for f in findings if f.rule_id == "PR-06" and f.severity.name == "FAIL"]
    assert len(p14b_fail) >= 1
