#!/usr/bin/env python3
"""Test code checker: validates test files for naming, assertions, cleanup patterns.

Usage:
    python .githooks/cleanup/tests_check.py [--lang rust|go|javascript|bash] [path]

Checks test naming conventions, minimum assertions, required helpers.
Config-driven from .githooks/spec/cleanup_tests_<lang>.yaml.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / ".."))

from lib._shared import Finding, Severity, aggregate_result, print_findings, load_yaml  # noqa: E402

LANGUAGES = ["rust", "go", "javascript", "bash"]


def check_file(path: Path, lang: str, cfg: dict[str, Any]) -> list[Finding]:
    """Check a single test file against its language config."""
    findings: list[Finding] = []
    content = path.read_text(encoding="utf-8", errors="replace")
    rid = "CL-02"

    naming = cfg.get("naming_pattern", "")
    if naming:
        names = re.findall(naming, content)
        if not names:
            findings.append(Finding(rid, Severity.WARN,
                f"{path.name}: no functions matching naming pattern '{naming}'"))

    min_asserts = cfg.get("min_assertions_per_test", 1)
    assert_patterns = cfg.get("assert_patterns", [])
    if assert_patterns:
        assert_count = sum(len(re.findall(p, content)) for p in assert_patterns)
        if assert_count < min_asserts:
            findings.append(Finding(rid, Severity.WARN,
                f"{path.name}: only {assert_count} assertion(s), minimum {min_asserts}"))

    for helper in cfg.get("required_helpers", []):
        if helper and helper not in content:
            findings.append(Finding(rid, Severity.WARN,
                f"{path.name}: missing required helper '{helper}'"))

    if not findings:
        findings.append(Finding(rid, Severity.INFO, f"{path.name}: checks passed"))

    return findings


def run_lang(lang: str, base: str = ".") -> list[Finding]:
    """Check all test files for a language."""
    cfg_path = ROOT / "spec" / f"cleanup_tests_{lang}.yaml"
    if not cfg_path.exists():
        return [Finding("CL-02", Severity.WARN, f"config not found: {cfg_path.name}")]

    cfg = load_yaml(cfg_path)
    if not cfg.get("enabled", True):
        return [Finding("CL-02", Severity.INFO, f"{lang}: disabled in config")]

    findings: list[Finding] = []
    includes = cfg.get("paths_include", [])
    excludes = cfg.get("paths_exclude", [])

    base_path = ROOT.parent / base
    for include_pat in includes:
        for f in base_path.glob(include_pat):
            if any(f.match(ex) for ex in excludes):
                continue
            if f.is_file():
                findings.extend(check_file(f, lang, cfg))

    if not findings:
        findings.append(Finding("CL-02", Severity.INFO,
            f"{lang}: no test files found matching {includes}"))

    return findings


def run(langs: list[str] | None = None, base: str = ".") -> list[Finding]:
    active = langs if langs else LANGUAGES
    findings: list[Finding] = []
    for lang in active:
        print(f"--- tests-{lang} ---")
        findings.extend(run_lang(lang, base))
    return findings


def main() -> int:
    langs_filter = []
    target = "."
    for a in sys.argv[1:]:
        if a.startswith("--lang="):
            langs_filter = a.split("=", 1)[1].split(",")
        elif not a.startswith("--"):
            target = a

    findings = run(langs_filter or None, target)
    print_findings(findings)
    return aggregate_result(findings)


if __name__ == "__main__":
    sys.exit(main())
