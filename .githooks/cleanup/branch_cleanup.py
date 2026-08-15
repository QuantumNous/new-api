#!/usr/bin/env python3
"""Check and optionally clean up stale local + remote branches.

Usage:
    python .githooks/cleanup/branch_cleanup.py [--apply]

Default is dry-run (report only). --apply deletes branches.
Config: .githooks/spec/cleanup_branch_cleanup.yaml
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


def _git(args: list[str]) -> tuple[int, str]:
    """Run a git command in repo root, return (rc, output)."""
    return run_external(["git"] + args, cwd=ROOT.parent)


def _load_config() -> dict[str, Any]:
    return load_yaml(ROOT / "spec" / "cleanup_branch_cleanup.yaml")


def run(apply: bool = False) -> list[Finding]:
    cfg = _load_config()
    findings: list[Finding] = []
    deleted: list[str] = []

    # Protected branches
    protected = set(cfg.get("protected_branches", ["main", "master", "dev"]))
    current_branch = ""
    rc, out = _git(["branch", "--show-current"])
    if rc == 0:
        current_branch = out.strip()

    # Get merged local branches
    rc, merged_out = _git(["branch", "--merged", "main"])
    merged_branches = []
    if rc == 0:
        for line in merged_out.splitlines():
            b = line.strip().lstrip("*").strip()
            if b and b not in protected and b != current_branch:
                merged_branches.append(b)

    # Get all local branches
    rc, all_out = _git(["branch", "--format=%(refname:short)"])
    all_branches = all_out.splitlines() if rc == 0 else []

    # local_merged check
    local_cfg = cfg.get("local_merged", {})
    local_action = local_cfg.get("action", "WARN")
    for b in merged_branches:
        findings.append(Finding(
            "CL-01",
            Severity.WARN,
            f"local branch '{b}' is merged into main",
        ))
        if apply and local_action == "DELETE":
            _git(["branch", "-d", b])
            deleted.append(b)

    # remote_merged check
    remote_cfg = cfg.get("remote_merged", {})
    remote_action = remote_cfg.get("action", "WARN")
    rc, remote_out = _git(["branch", "-r", "--merged", "origin/main"])
    if rc == 0:
        for line in remote_out.splitlines():
            ref = line.strip()
            if "->" in ref or not ref:
                continue
            branch_name = ref.split("/", 1)[1] if "/" in ref else ref
            if branch_name in protected or branch_name == current_branch:
                continue
            findings.append(Finding(
                "CL-01",
                Severity.WARN,
                f"remote branch '{ref}' is merged into origin/main",
            ))
            if apply and remote_action == "DELETE":
                _git(["push", "origin", "--delete", branch_name])
                deleted.append(f"remote:{branch_name}")

    # orphan local branches (no remote tracking)
    orphan_cfg = cfg.get("orphan_local", {})
    orphan_action = orphan_cfg.get("action", "WARN")
    rc, vv_out = _git(["branch", "-vv"])
    if rc == 0:
        for line in vv_out.splitlines():
            b = line.strip().lstrip("*").strip()
            if not b:
                continue
            name = b.split()[0]
            if name in protected or name == current_branch:
                continue
            if "[" not in b and name in all_branches:
                findings.append(Finding(
                    "CL-01",
                    Severity.WARN,
                    f"local branch '{name}' has no remote tracking",
                ))
                if apply and orphan_action == "DELETE":
                    _git(["branch", "-D", name])
                    deleted.append(name)

    # temp branches
    temp_prefixes = cfg.get("temp_branch_prefixes", ["tmp/", "wip/", "test/"])
    for b in all_branches:
        if b == current_branch or b in protected:
            continue
        if any(b.startswith(p) for p in temp_prefixes):
            findings.append(Finding(
                "CL-01",
                Severity.WARN,
                f"temp branch '{b}' matches temp prefix",
            ))
            if apply:
                _git(["branch", "-D", b])
                deleted.append(b)

    if deleted:
        findings.append(Finding(
            "CL-01",
            Severity.INFO,
            f"deleted {len(deleted)} branch(es): {deleted}",
        ))
    elif not findings:
        findings.append(Finding("cleanup", Severity.INFO, "no stale branches found"))

    return findings


def main() -> int:
    apply = "--apply" in sys.argv
    mode = "APPLY" if apply else "DRY-RUN"
    print(f"== branch cleanup ({mode}) ==")
    findings = run(apply=apply)
    print_findings(findings)
    return aggregate_result(findings)


if __name__ == "__main__":
    sys.exit(main())
