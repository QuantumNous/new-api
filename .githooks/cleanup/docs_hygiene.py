#!/usr/bin/env python3
"""Check documentation hygiene: brackets, broken links, stale markers, empty files.

Usage:
    python .githooks/cleanup/docs_hygiene.py [path]
Config: .githooks/spec/cleanup_docs_hygiene.yaml
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

FULLWIDTH_BRACKETS = "（）、「」【】『』《》〈〉﹁﹂"


def check_file(path: Path, cfg: dict[str, Any]) -> list[Finding]:
    """Check a single documentation file."""
    findings: list[Finding] = []
    content = path.read_text(encoding="utf-8", errors="replace")
    raw = path.read_bytes()
    lines = content.splitlines()
    rel = str(path)

    # Fullwidth brackets
    if cfg.get("check_fullwidth", True):
        for i, line in enumerate(lines, 1):
            fb = [c for c in line if c in cfg.get("forbidden_brackets", list(FULLWIDTH_BRACKETS))]
            if fb:
                findings.append(Finding("CL-03", Severity.WARN,
                    f"{rel}:{i}: fullwidth brackets: {set(fb)}"))
                break

    # Broken internal links
    if cfg.get("broken_link_check", True):
        for m in re.finditer(r'\]\((\./[^)]+\.(?:md|txt|rst))\)', content):
            link = m.group(1)
            target = (path.parent / link).resolve()
            if not target.exists():
                findings.append(Finding("CL-03", Severity.WARN,
                    f"{rel}: broken link → {link}"))

    # Stale markers
    for kw in cfg.get("stale_marker_keywords", ["TODO", "FIXME", "XXX"]):
        if kw in content:
            findings.append(Finding("CL-03", Severity.WARN,
                f"{rel}: contains stale marker '{kw}'"))

    # Empty / placeholder files
    min_lines = cfg.get("min_content_lines", 3)
    non_empty = [l for l in lines if l.strip()]
    if len(non_empty) < min_lines:
        findings.append(Finding("CL-03", Severity.WARN,
            f"{rel}: only {len(non_empty)} non-empty line(s), min {min_lines}"))

    # Trailing whitespace / CRLF
    for i, line in enumerate(lines, 1):
        if line.endswith(" ") or line.endswith("\t"):
            findings.append(Finding("CL-03", Severity.INFO,
                f"{rel}:{i}: trailing whitespace"))
            break
    if b"\r\n" in raw or b"\r" in raw:
        findings.append(Finding("CL-03", Severity.WARN,
            f"{rel}: contains CRLF line endings"))

    # Missing trailing newline
    if content and not content.endswith("\n"):
        findings.append(Finding("CL-03", Severity.INFO,
            f"{rel}: missing trailing newline"))

    if not findings:
        findings.append(Finding("docs", Severity.INFO, f"{rel}: clean"))

    return findings


def run(base: str = ".") -> list[Finding]:
    cfg = load_yaml(ROOT / "spec" / "cleanup_docs_hygiene.yaml")
    findings: list[Finding] = []

    base_path = (ROOT.parent / base).resolve()
    extensions = cfg.get("file_extensions", [".md", ".txt", ".rst"])
    ignore = cfg.get("ignore_paths", [".wt/", "node_modules/", "target/"])

    for ext in extensions:
        for f in base_path.rglob(f"*{ext}"):
            rel = str(f.relative_to(base_path))
            if any(ig in rel for ig in ignore):
                continue
            findings.extend(check_file(f, cfg))

    if not findings:
        findings.append(Finding("docs", Severity.INFO, "no documentation files found"))

    return findings


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    base = args[0] if args else "."
    findings = run(base)
    print_findings(findings)
    return aggregate_result(findings)


if __name__ == "__main__":
    sys.exit(main())
