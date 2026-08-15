"""Unit tests for .githooks/cleanup/tests_check.py.

Run from .githooks:
    cd .githooks && python -m pytest tests/test_cleanup_tests.py -v
"""
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cleanup"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import importlib
_mod = importlib.import_module("tests_check")
check_file = _mod.check_file
run_lang = _mod.run_lang
from lib._shared import Severity


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def test_load_yaml_configs():
    """All 4 language configs exist and have required fields."""
    from lib._shared import load_yaml
    for lang in ["rust", "go", "javascript", "bash"]:
        path = Path(__file__).resolve().parents[1] / "spec" / f"cleanup_tests_{lang}.yaml"
        cfg = load_yaml(path)
        assert "naming_pattern" in cfg, f"{lang} missing 'naming_pattern'"
        assert "min_assertions_per_test" in cfg, f"{lang} missing 'min_assertions_per_test'"


# ---------------------------------------------------------------------------
# check_file
# ---------------------------------------------------------------------------

def test_rust_good_test():
    """Rust test with proper naming + assertion → INFO."""
    cfg = {"naming_pattern": r"fn (test_|it_)", "min_assertions_per_test": 1,
           "assert_patterns": [r"assert!", r"assert_eq!"], "required_helpers": []}
    with tempfile.NamedTemporaryFile(suffix=".rs", mode="w", delete=False) as f:
        f.write("#[test]\nfn test_add() {\n    assert_eq!(1+1, 2);\n}\n")
        f.flush()
        findings = check_file(Path(f.name), "rust", cfg)
    assert all(fnd.severity.name == "INFO" for fnd in findings)


def test_rust_no_assertion():
    """Rust test without assertion → WARN."""
    cfg = {"naming_pattern": r"fn (test_|it_)", "min_assertions_per_test": 1,
           "assert_patterns": [r"assert!", r"assert_eq!"], "required_helpers": []}
    with tempfile.NamedTemporaryFile(suffix=".rs", mode="w", delete=False) as f:
        f.write("#[test]\nfn test_empty() {\n    let x = 1;\n}\n")
        f.flush()
        findings = check_file(Path(f.name), "rust", cfg)
    assert any(fnd.severity.name == "WARN" and "assertion" in fnd.message for fnd in findings)


def test_js_missing_helper():
    """JS test missing required helper → WARN."""
    cfg = {"naming_pattern": r"(it|test)\(", "min_assertions_per_test": 1,
           "assert_patterns": [r"expect\("], "required_helpers": ["afterEach", "describe"]}
    with tempfile.NamedTemporaryFile(suffix=".test.js", mode="w", delete=False) as f:
        f.write("it('test', () => { expect(1).toBe(1); });\n")
        f.flush()
        findings = check_file(Path(f.name), "javascript", cfg)
    assert any("afterEach" in fnd.message for fnd in findings)


def test_js_good_test():
    """JS test with all required helpers → INFO."""
    cfg = {"naming_pattern": r"(it|test)\(", "min_assertions_per_test": 1,
           "assert_patterns": [r"expect\("], "required_helpers": ["afterEach"]}
    with tempfile.NamedTemporaryFile(suffix=".test.js", mode="w", delete=False) as f:
        f.write("describe('x', () => { afterEach(() => {}); it('works', () => { expect(1).toBe(1); }); });\n")
        f.flush()
        findings = check_file(Path(f.name), "javascript", cfg)
    assert all(fnd.severity.name == "INFO" for fnd in findings)


def test_bad_naming():
    """Test file with no matching naming pattern → WARN."""
    cfg = {"naming_pattern": r"@test", "min_assertions_per_test": 1,
           "assert_patterns": [r"\[ "], "required_helpers": []}
    with tempfile.NamedTemporaryFile(suffix=".bats", mode="w", delete=False) as f:
        f.write("function some_func() { echo hi; }\n")
        f.flush()
        findings = check_file(Path(f.name), "bash", cfg)
    assert any("naming pattern" in fnd.message for fnd in findings)


# ---------------------------------------------------------------------------
# run_lang / run
# ---------------------------------------------------------------------------

def test_missing_config():
    """Missing config → WARN."""
    findings = run_lang("nonexistent")
    assert findings[0].severity.name == "WARN"


@patch.object(_mod, "run_lang")
def test_run_all_languages(mock_run_lang):
    """run() with no filter runs all 4 languages."""
    mock_run_lang.return_value = []
    _mod.run()
    assert mock_run_lang.call_count == 4


@patch.object(_mod, "run_lang")
def test_run_specific_language(mock_run_lang):
    """run() with filter runs only specified."""
    mock_run_lang.return_value = []
    _mod.run(langs=["rust", "go"])
    assert mock_run_lang.call_count == 2
