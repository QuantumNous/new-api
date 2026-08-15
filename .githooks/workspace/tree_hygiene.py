#!/usr/bin/env python3
"""Check directory tree hygiene: empty dirs, single-file dirs, deep nesting, orphans.

Usage:
    python .githooks/workspace/tree_hygiene.py [path]
Config: .githooks/spec/workspace_tree_hygiene.yaml
"""
from __future__ import annotations
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / ".."))

from lib._shared import Finding, Severity, aggregate_result, print_findings, load_yaml  # noqa: E402


def run(base: str = ".") -> list[Finding]:
    cfg = load_yaml(ROOT / "spec" / "workspace_tree_hygiene.yaml")
    findings: list[Finding] = []
    max_depth = cfg.get("max_depth", 5)
    ignore = cfg.get("ignore_paths", [".wt/", "node_modules/", "target/", "__pycache__/"])

    base_path = (ROOT.parent / base).resolve()

    def _ignored(p: Path) -> bool:
        return any(part in ig.rstrip("/") for ig in ignore for part in [p.name] if p.name)

    for dirpath, dirnames, filenames in __walk(base_path, ignore):
        d = Path(dirpath)

        # Empty directory
        if not dirnames and not filenames:
            findings.append(Finding("WS-01", Severity.WARN, f"empty directory: {d}"))
            continue

        # Single file (could merge)
        if len(filenames) == 1 and not dirnames:
            if filenames[0] != ".gitkeep":
                findings.append(Finding("WS-01", Severity.WARN,
                    f"single-file dir (consider merging): {d}/{filenames[0]}"))

        # Deep nesting
        try:
            depth = len(d.relative_to(base_path).parts)
        except ValueError:
            depth = 0
        if depth > max_depth:
            findings.append(Finding("WS-01", Severity.WARN,
                f"deep nesting ({depth} > {max_depth}): {d}"))

    # Orphan dirs (.wt without worktree, tmp/, __pycache__)
    for orphan_pat in cfg.get("orphan_patterns", [".wt/*/", "tmp/", "__pycache__/"]):
        for m in base_path.glob(orphan_pat.rstrip("/")):
            if m.is_dir():
                findings.append(Finding("WS-01", Severity.WARN,
                    f"potential orphan/residue: {m}"))

    if not findings:
        findings.append(Finding("tree", Severity.INFO, "tree hygiene OK"))

    return findings


def __walk(base: Path, ignore: list[str]):
    """Walk directory tree, skipping ignored dirs."""
    import os
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if not any(
            d == ig.rstrip("/") for ig in ignore
        )]
        yield dirpath, dirnames, filenames


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    base = args[0] if args else "."
    findings = run(base)
    print_findings(findings)
    return aggregate_result(findings)


if __name__ == "__main__":
    sys.exit(main())
