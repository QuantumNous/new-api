"""Unit tests for .githooks/cleanup/docs_hygiene.py.

Run from .githooks:
    cd .githooks && python -m pytest tests/test_cleanup_docs.py -v
"""
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cleanup"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import importlib
_mod = importlib.import_module("docs_hygiene")
check_file = _mod.check_file
from lib._shared import Severity

CFG = {
    "check_fullwidth": True,
    "forbidden_brackets": list("（）「」【】『』《》〈〉"),
    "broken_link_check": True,
    "stale_marker_keywords": ["TODO", "FIXME", "XXX"],
    "min_content_lines": 3,
}


def test_clean_file(tmp_path):
    """Clean doc → INFO only."""
    f = tmp_path / "good.md"
    f.write_text("# Title\n\nSome content here.\nMore content.\n")
    findings = check_file(f, CFG)
    assert all(fnd.severity.name == "INFO" for fnd in findings)


def test_fullwidth_brackets(tmp_path):
    """Fullwidth brackets → WARN."""
    f = tmp_path / "bad.md"
    f.write_text("# Title\n\n内容（括号）test\nMore line.\n")
    findings = check_file(f, CFG)
    assert any(fnd.rule_id == "CL-03" for fnd in findings)


def test_broken_link(tmp_path):
    """Broken internal link → WARN."""
    f = tmp_path / "link.md"
    f.write_text("# Title\n\nSee [other](./nonexist.md).\nMore.\n")
    findings = check_file(f, CFG)
    assert any(fnd.rule_id == "CL-03" for fnd in findings)


def test_stale_marker(tmp_path):
    """TODO/FIXME markers → WARN."""
    f = tmp_path / "stale.md"
    f.write_text("# Title\n\nTODO: fix this later.\nMore content.\n")
    findings = check_file(f, CFG)
    assert any(fnd.rule_id == "CL-03" for fnd in findings)


def test_empty_file(tmp_path):
    """Near-empty file → WARN."""
    f = tmp_path / "empty.md"
    f.write_text("# Only\n")
    findings = check_file(f, CFG)
    assert any(fnd.rule_id == "CL-03" for fnd in findings)


def test_crlf(tmp_path):
    """CRLF endings → WARN."""
    f = tmp_path / "crlf.md"
    f.write_text("# Title\r\n\r\nContent here.\r\nMore.\r\n")
    findings = check_file(f, CFG)
    assert any(fnd.rule_id == "CL-03" for fnd in findings)


def test_missing_newline(tmp_path):
    """No trailing newline → INFO."""
    f = tmp_path / "nonewline.md"
    f.write_text("# Title\n\nContent.\nMore stuff.")
    findings = check_file(f, CFG)
    assert any(fnd.rule_id == "CL-03" for fnd in findings)


def test_load_yaml_config():
    from lib._shared import load_yaml
    cfg = load_yaml(Path(__file__).resolve().parents[1] / "spec" / "cleanup_docs_hygiene.yaml")
    assert ".md" in cfg["file_extensions"]
    assert "TODO" in cfg["stale_marker_keywords"]
    assert cfg["broken_link_check"] is True
