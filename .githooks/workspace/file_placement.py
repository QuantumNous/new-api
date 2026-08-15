#!/usr/bin/env python3
"""Check file placement: are files in the right directories?

Usage:
    python .githooks/workspace/file_placement.py [path]
Config: .githooks/spec/workspace_file_placement.yaml
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


def run(base: str = ".") -> list[Finding]:
    cfg = load_yaml(ROOT / "spec" / "workspace_file_placement.yaml")
    findings: list[Finding] = []
    ignore = cfg.get("ignore_paths", [".wt/", "node_modules/", "target/"])

    base_path = (ROOT.parent / base).resolve()

    # Check forbidden patterns
    for rule in cfg.get("forbidden_patterns", []):
        pattern = rule.get("path_regex", "")
        reason = rule.get("reason", "file placement violation")
        suggestion = rule.get("suggestion", "")
        regex = re.compile(pattern)

        for f in base_path.rglob("*"):
            if f.is_file():
                rel = str(f.relative_to(base_path))
                if any(ig in rel for ig in ignore):
                    continue
                if regex.search(rel):
                    msg = f"{reason}: {rel}"
                    if suggestion:
                        msg += f" → {suggestion}"
                    findings.append(Finding("WS-02",
                        Severity.FAIL if rule.get("severity") == "FAIL" else Severity.WARN,
                        msg))

    # Check expected locations
    for rule in cfg.get("expected_locations", []):
        pattern = rule.get("file_pattern", "")
        expected_dir = rule.get("expected_dir", "")
        regex = re.compile(pattern)

        for f in base_path.rglob("*"):
            if f.is_file():
                rel = str(f.relative_to(base_path))
                if any(ig in rel for ig in ignore):
                    continue
                if regex.search(rel):
                    parent = str(f.parent.relative_to(base_path))
                    if expected_dir not in parent and expected_dir != ".":
                        findings.append(Finding("WS-02",
                            Severity.WARN,
                            f"{rel} should be in {expected_dir}, found in {parent}"))

    if not findings:
        findings.append(Finding("placement", Severity.INFO, "file placement OK"))

    return findings


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    base = args[0] if args else "."
    findings = run(base)
    print_findings(findings)
    return aggregate_result(findings)


if __name__ == "__main__":
    sys.exit(main())
