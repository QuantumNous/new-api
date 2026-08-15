"""Unit tests for .githooks/cleanup/branch_cleanup.py.

Run from .githooks:
    cd .githooks && python -m pytest tests/test_cleanup_branch.py -v
"""
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cleanup"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import importlib
_mod = importlib.import_module("branch_cleanup")
run = _mod.run
from lib._shared import Severity


def test_load_yaml_config():
    from lib._shared import load_yaml
    cfg = load_yaml(Path(__file__).resolve().parents[1] / "spec" / "cleanup_branch_cleanup.yaml")
    assert "main" in cfg["protected_branches"]
    assert cfg["local_merged"]["action"] == "WARN"
    assert "tmp/" in cfg["temp_branch_prefixes"]


@patch.object(_mod, "_git")
def test_no_stale_branches(mock_git):
    """No stale branches → INFO."""
    mock_git.side_effect = [
        (0, "main"),                    # branch --show-current
        (0, ""),                        # branch --merged main
        (0, "main\nfeat/test"),         # branch --format
        (0, ""),                        # branch -r --merged
        (0, "* main [origin/main] ..."),  # branch -vv
    ]
    findings = run()
    assert any(f.rule_id == "cleanup" and f.severity.name == "INFO" for f in findings)


@patch.object(_mod, "_git")
def test_merged_local_branch(mock_git):
    """Merged local branch → WARN."""
    mock_git.side_effect = [
        (0, "main"),                    # current branch
        (0, "  fix/old-branch"),        # merged
        (0, "main\nfix/old-branch"),    # all branches
        (0, ""),                        # remote merged
        (0, "* main [origin/main]\n  fix/old-branch [origin/fix/old-branch]"),  # vv
    ]
    findings = run()
    merged = [f for f in findings if f.rule_id == "CL-01"]
    assert len(merged) >= 1
    assert merged[0].severity.name == "WARN"
    assert "fix/old-branch" in merged[0].message


@patch.object(_mod, "_git")
def test_protected_branch_not_flagged(mock_git):
    """Protected branches are never flagged."""
    mock_git.side_effect = [
        (0, "main"),
        (0, "  dev\n  main"),           # dev is merged but protected
        (0, "main\ndev"),
        (0, ""),
        (0, "* main [origin/main]"),
    ]
    findings = run()
    merged = [f for f in findings if "dev" in f.message and f.severity.name == "WARN"]
    assert len(merged) == 0


@patch.object(_mod, "_git")
def test_temp_branch_flagged(mock_git):
    """Temp branches matching prefix → WARN."""
    mock_git.side_effect = [
        (0, "main"),
        (0, ""),
        (0, "main\ntmp/scratch"),
        (0, ""),
        (0, "* main [origin/main]\n  tmp/scratch"),
    ]
    findings = run()
    temp = [f for f in findings if f.rule_id == "CL-01"]
    assert len(temp) >= 1
    assert "tmp/scratch" in temp[0].message


@patch.object(_mod, "_git")
def test_orphan_branch_flagged(mock_git):
    """Local branch without remote tracking → WARN."""
    mock_git.side_effect = [
        (0, "main"),
        (0, ""),
        (0, "main\nfeat/orphan"),
        (0, ""),
        (0, "* main [origin/main]\n  feat/orphan"),  # no [origin/...] for orphan
    ]
    findings = run()
    orphan = [f for f in findings if f.rule_id == "CL-01"]
    assert len(orphan) >= 1
    assert "feat/orphan" in orphan[0].message


@patch.object(_mod, "_git")
def test_current_branch_protected(mock_git):
    """Current branch is never flagged even if it would match."""
    mock_git.side_effect = [
        (0, "tmp/working"),
        (0, "  main"),                  # main merged
        (0, "main\ntmp/working"),
        (0, ""),
        (0, "* tmp/working\n  main [origin/main]"),
    ]
    findings = run()
    # tmp/working is current → not flagged as temp
    temp = [f for f in findings if "tmp/working" in f.message and f.rule_id == "CL-01"]
    assert len(temp) == 0
