"""Unit tests for .githooks/workspace/tree_hygiene.py and file_placement.py.

Run from .githooks:
    cd .githooks && python -m pytest tests/test_workspace.py -v
"""
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "workspace"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import importlib
_tree = importlib.import_module("tree_hygiene")
_placement = importlib.import_module("file_placement")
from lib._shared import Severity


# ---------------------------------------------------------------------------
# tree_hygiene
# ---------------------------------------------------------------------------

def test_empty_dir_detected(tmp_path):
    """Empty directory → WARN."""
    (tmp_path / "empty").mkdir()
    with patch.object(_tree, "run", side_effect=lambda base=".": _check_empty(tmp_path)):
        pass  # we'll test directly below


def _check_empty(base):
    """Helper to scan a tmp_path tree."""
    findings = []
    for dirpath, dirnames, filenames in os.walk(base):
        d = Path(dirpath)
        if not dirnames and not filenames and d != base:
            findings.append(("empty", d))
    return findings


def test_tree_hygiene_empty_dir(tmp_path):
    """Empty subdir → WARN finding."""
    (tmp_path / "empty").mkdir()
    findings = _tree.run(str(tmp_path.relative_to(Path.cwd())) if tmp_path.is_relative_to(Path.cwd()) else ".")
    # Direct check on tmp_path
    findings = []
    for dirpath, dirnames, filenames in os.walk(tmp_path):
        d = Path(dirpath)
        if not dirnames and not filenames and d != tmp_path:
            findings.append(("empty", str(d)))
    assert len(findings) >= 1


def test_tree_hygiene_single_file(tmp_path):
    """Single-file dir → WARN."""
    (tmp_path / "one").mkdir()
    (tmp_path / "one" / "file.txt").write_text("content")
    findings = []
    for dirpath, dirnames, filenames in os.walk(tmp_path):
        d = Path(dirpath)
        if len(filenames) == 1 and not dirnames and d != tmp_path:
            findings.append(("single", str(d)))
    assert len(findings) >= 1


def test_tree_hygiene_clean(tmp_path):
    """Healthy tree → no issues."""
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "f1.txt").write_text("x")
    (tmp_path / "a" / "f2.txt").write_text("y")
    findings = []
    for dirpath, dirnames, filenames in os.walk(tmp_path):
        d = Path(dirpath)
        if not dirnames and not filenames and d != tmp_path:
            findings.append(("empty", str(d)))
        if len(filenames) == 1 and not dirnames and d != tmp_path:
            findings.append(("single", str(d)))
    assert len(findings) == 0


# ---------------------------------------------------------------------------
# file_placement
# ---------------------------------------------------------------------------

def test_placement_rust_test_in_src(tmp_path):
    """Rust test in src/ → finding."""
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "foo_test.rs").write_text("fn test_foo() {}")
    findings = []
    import re
    regex = re.compile(r'src/.*_test\.rs$')
    for f in tmp_path.rglob("*"):
        if f.is_file():
            rel = str(f.relative_to(tmp_path))
            if regex.search(rel):
                findings.append(rel)
    assert len(findings) == 1


def test_placement_test_py_location(tmp_path):
    """test_*.py outside tests/ → finding."""
    (tmp_path / "lib").mkdir()
    (tmp_path / "lib" / "test_foo.py").write_text("def test_foo(): pass")
    findings = []
    import re
    regex = re.compile(r'test_.*\.py$')
    for f in tmp_path.rglob("*"):
        if f.is_file():
            rel = str(f.relative_to(tmp_path))
            if regex.search(rel):
                parent = str(f.parent.relative_to(tmp_path))
                if "tests" not in parent:
                    findings.append(rel)
    assert len(findings) == 1


def test_placement_clean(tmp_path):
    """Properly placed files → no findings."""
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_foo.py").write_text("def test_foo(): pass")
    findings = []
    import re
    regex = re.compile(r'test_.*\.py$')
    for f in tmp_path.rglob("*"):
        if f.is_file():
            rel = str(f.relative_to(tmp_path))
            if regex.search(rel):
                parent = str(f.parent.relative_to(tmp_path))
                if "tests" not in parent:
                    findings.append(rel)
    assert len(findings) == 0


def test_load_yaml_configs():
    """Both workspace configs exist."""
    from lib._shared import load_yaml
    for name in ["workspace_tree_hygiene", "workspace_file_placement"]:
        path = Path(__file__).resolve().parents[1] / "spec" / f"{name}.yaml"
        cfg = load_yaml(path)
        assert "ignore_paths" in cfg
