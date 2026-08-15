"""Unit tests for .githooks/code/lint.py.

Run from .githooks:
    cd .githooks && python -m pytest tests/test_code_lint.py -v
"""
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "code"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import importlib
_lint = importlib.import_module("lint")
run_lang = _lint.run_lang
run = _lint.run
from lib._shared import Severity


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def test_load_yaml_configs():
    """All 6 language configs exist and have required fields."""
    from lib._shared import load_yaml
    for lang in ["rust", "go", "javascript", "typescript", "python", "bash"]:
        path = Path(__file__).resolve().parents[1] / "spec" / f"code_{lang}.yaml"
        cfg = load_yaml(path)
        assert "command" in cfg, f"{lang} missing 'command'"
        assert "args" in cfg, f"{lang} missing 'args'"
        assert "fail_severity" in cfg, f"{lang} missing 'fail_severity'"


# ---------------------------------------------------------------------------
# run_lang with mocked run_external
# ---------------------------------------------------------------------------

@patch.object(_lint, "run_external")
def test_tool_passes(mock_run):
    """Lint tool exits 0 → INFO."""
    mock_run.return_value = (0, "")
    findings = run_lang("python", ".")
    assert len(findings) == 1
    assert findings[0].severity.name == "INFO"


@patch.object(_lint, "run_external")
def test_tool_fails(mock_run):
    """Lint tool exits non-zero → FAIL."""
    mock_run.return_value = (1, "E501 line too long")
    findings = run_lang("python", ".")
    assert len(findings) == 1
    assert findings[0].severity.name == "FAIL"
    assert "E501" in findings[0].message


@patch.object(_lint, "run_external")
def test_tool_not_installed(mock_run):
    """Lint tool not found → WARN (graceful degradation)."""
    mock_run.return_value = (127, "No such file or directory")
    findings = run_lang("rust", ".")
    assert len(findings) == 1
    assert findings[0].severity.name == "WARN"
    assert "not installed" in findings[0].message or "skipped" in findings[0].message


@patch.object(_lint, "load_yaml")
def test_fail_severity_warn(mock_load):
    """When fail_severity is WARN, tool failure is WARN not FAIL."""
    mock_load.return_value = {
        "enabled": True,
        "command": "some-tool",
        "args": [],
        "fail_severity": "WARN",
    }
    with patch.object(_lint, "run_external", return_value=(1, "warning: unused variable")):
        findings = run_lang("javascript", ".")
    assert findings[0].severity.name == "WARN"


@patch.object(_lint, "load_yaml")
def test_disabled_lang(mock_load):
    """Disabled language → INFO."""
    mock_load.return_value = {"enabled": False, "command": "tool", "args": []}
    findings = run_lang("go", ".")
    assert findings[0].severity.name == "INFO"


def test_missing_config():
    """Missing config file → WARN."""
    findings = run_lang("nonexistent", ".")
    assert findings[0].severity.name == "WARN"


# ---------------------------------------------------------------------------
# run() dispatcher
# ---------------------------------------------------------------------------

@patch.object(_lint, "run_lang")
def test_run_all_languages(mock_run_lang):
    """run() with no filter runs all 6 languages."""
    mock_run_lang.return_value = []
    run()
    assert mock_run_lang.call_count == 6


@patch.object(_lint, "run_lang")
def test_run_specific_language(mock_run_lang):
    """run() with filter runs only specified languages."""
    mock_run_lang.return_value = []
    run(langs=["python", "bash"])
    assert mock_run_lang.call_count == 2
