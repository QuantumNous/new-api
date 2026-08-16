#!/usr/bin/env python3
"""Code lint dispatcher: runs external linters per language based on YAML config.

Usage:
    python .githooks/code/lint.py [--lang rust|go|javascript|typescript|python|bash] [path]

If --lang is omitted, runs all enabled languages.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / ".."))

from lib._shared import Finding, Severity, aggregate_result, print_findings, load_yaml, run_external  # noqa: E402

LANGUAGES = ["rust", "go", "javascript", "typescript", "python", "bash"]


def run_lang(lang: str, target: str = ".") -> list[Finding]:
    """Run a single language linter based on its YAML config."""
    cfg_path = ROOT / "spec" / f"code_{lang}.yaml"
    if not cfg_path.exists():
        return [Finding(f"code-{lang}", Severity.WARN, f"config not found: {cfg_path.name}")]

    cfg = load_yaml(cfg_path)
    findings: list[Finding] = []

    if not cfg.get("enabled", True):
        return [Finding(f"code-{lang}", Severity.INFO, f"{lang}: disabled in config")]

    command = cfg.get("command", "")
    args = cfg.get("args", [])
    fail_severity = Severity.FAIL if cfg.get("fail_severity", "FAIL") == "FAIL" else Severity.WARN

    if not command:
        return [Finding(f"code-{lang}", Severity.WARN, f"{lang}: no command configured")]
    includes = cfg.get("paths_include", [])
    excludes = cfg.get("paths_exclude", [])
    if includes:
        pats = [p.removeprefix("**/") for p in includes]
        found = any(
            p.is_file()
            and not (excludes and any(x in str(p) for x in excludes))
            and any(p.match(pat) for pat in pats)
            for p in ROOT.parent.rglob("*")
        )
        if not found:
            return [Finding(f"code-{lang}", Severity.INFO, f"{lang}: no matching files (paths_include: {includes})")]

    cmd = [command] + list(args) + ([] if command == "cargo" else [target])
    try:
        rc, output = run_external(cmd, cwd=ROOT.parent)
    except FileNotFoundError:
        findings.append(Finding(f"code-{lang}", Severity.WARN, f"{lang}: {command} not installed, skipped"))
        return findings
    excludes = cfg.get("paths_exclude", [])
    if excludes and output and rc != 0:
        kept = [ln for ln in output.splitlines() if not any(p in ln for p in excludes)]
        if not kept:
            rc = 0
            output = ""
        else:
            output = "\n".join(kept)


    if rc == 0:
        findings.append(Finding(f"code-{lang}", Severity.INFO, f"{lang}: {command} passed"))
    elif rc == 127 or "not found" in output.lower() or "No such file" in output.lower():
        findings.append(Finding(f"code-{lang}", Severity.WARN, f"{lang}: {command} not installed, skipped"))
    else:
        # Truncate long output
        msg = output[:500] if output else f"{command} exited {rc}"
        findings.append(Finding(f"code-{lang}", fail_severity, f"{lang}: {command} reported issues:\n{msg}"))

    return findings


def run(langs: list[str] | None = None, target: str = ".") -> list[Finding]:
    """Run lint for specified languages (or all)."""
    active = langs if langs else LANGUAGES
    findings: list[Finding] = []
    for lang in active:
        print(f"--- {lang} ---")
        findings.extend(run_lang(lang, target))
    return findings


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
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
