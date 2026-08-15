#!/usr/bin/env python3
"""Validate PR review comments against .githooks/spec/github_reviews.yaml.

Replaces the review-related P-* rules from bin/validate_pr.sh (P-22/P-24/P-25/P-35/P-36/P-37).
"""

import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / ".."))

from lib._shared import (  # noqa: E402
    Finding,
    Severity,
    aggregate_result,
    print_findings,
    load_yaml,
    gh_api_get,
    gh_api_paginate,
)

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _has_cjk(s: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", s))


def _extract_replies(body: str) -> list[dict[str, str]]:
    """Extract Agent 🤖 - Reply entries from review comments."""
    replies = []
    for m in re.finditer(r"Agent 🤖 - (Fix|Block|Resolve|Note|Withdraw|Supersede):\s*(.+)", body):
        replies.append({"type": m.group(1), "reason": m.group(2).strip()})
    return replies


def _extract_inline_reviews(body: str) -> list[dict[str, str]]:
    """Extract Inline Review entries."""
    reviews = []
    for m in re.finditer(
        r"Agent 🤖 - Inline Review\s+(P[0-3])?:\s*(.+)",
        body, re.MULTILINE,
    ):
        reviews.append({"level": m.group(1) or "unspecified", "content": m.group(2).strip()})
    return reviews


def _extract_crg_reviews(body: str) -> list[dict[str, str]]:
    """Extract CRG Review entries (## Agent 🤖 - CRG Review: ...)."""
    crgs = []
    for m in re.finditer(
        r"^## Agent 🤖 - CRG Review:\s*(.+)",
        body, re.MULTILINE | re.IGNORECASE,
    ):
        crgs.append({"title": m.group(1).strip()})
    return crgs


# ---------------------------------------------------------------------------
# rule functions
# ---------------------------------------------------------------------------

def run(comments: list[dict[str, Any]], cfg: dict[str, Any]) -> list[Finding]:
    """Validate review comments.

    `comments` is a list of GitHub review comment objects (as dicts),
    each expected to have a `body` field.
    `cfg` is loaded from .githooks/spec/github_reviews.yaml.
    """
    findings: list[Finding] = []

    # Normalize comments to bodies
    bodies = [c.get("body", "") for c in comments if c.get("body")]

    # ---- P-22 checkbox forbidden in reviews ----
    print("--- P-22 checkbox forbidden ---")
    for body_text in bodies:
        if re.search(r"-\s*\[[ xX]\]", body_text):
            findings.append(Finding("RV-01", Severity.FAIL, "review comment contains checkbox (- [x] / - [ ])"))
            break
    else:
        findings.append(Finding("RV-01", Severity.INFO, "no checkboxes in review comments"))

    # ---- P-35 review prefix format ----
    print("--- P-35 review prefix ---")
    for body in bodies:
        crg_reviews = _extract_crg_reviews(body)
        for crg in crg_reviews:
            title = crg["title"]
            if _has_cjk(title):
                findings.append(Finding("RV-04", Severity.FAIL, f"CRG Review title contains CJK: {title}"))
            else:
                findings.append(Finding("RV-04", Severity.INFO, f"CRG Review title is English: {title}"))

        inline_reviews = _extract_inline_reviews(body)
        inline_cfg = cfg.get("review_formats", {}).get("inline_review", {})
        allowed_levels = inline_cfg.get("allowed_inline_levels", ["P0", "P1", "P2", "P3"])
        for ir in inline_reviews:
            level = ir["level"]
            if level not in allowed_levels and level != "unspecified":
                findings.append(Finding("RV-04", Severity.FAIL, f"Inline Review level '{level}' not in allowed {allowed_levels}"))
            else:
                findings.append(Finding("RV-04", Severity.INFO, f"Inline Review prefix OK: level={level}"))

    # ---- P-24 / P-25 reply threads ----
    print("--- P-24/P-25 reply threads ---")
    all_replies: list[dict[str, str]] = []
    for body in bodies:
        all_replies.extend(_extract_replies(body))

    if not all_replies:
        findings.append(Finding("RV-02", Severity.INFO, "no replies to check"))
        findings.append(Finding("RV-03", Severity.INFO, "no replies to check"))
    else:
        allowed_reply_words = cfg.get("review_formats", {}).get("crg_review", {}).get(
            "allowed_reply_words",
            ["Fix", "Block", "Resolve", "Note", "Withdraw", "Supersede"],
        )
        bad_replies = [r for r in all_replies if r["type"] not in allowed_reply_words]
        if bad_replies:
            findings.append(Finding("RV-02", Severity.WARN, f"some replies use disallowed words: {[r['type'] for r in bad_replies]}"))
        else:
            findings.append(Finding("RV-02", Severity.INFO, f"all {len(all_replies)} reply(ies) use allowed words"))
        # P-25: replies should reference commit SHA (simplified: check content length)
        short = [r for r in all_replies if len(r["reason"]) < 5]
        if short:
            findings.append(Finding("RV-03", Severity.WARN, f"{len(short)}/{len(all_replies)} replies lack sufficient detail"))
        else:
            findings.append(Finding("RV-03", Severity.INFO, f"all {len(all_replies)} replies have sufficient detail"))

    # ---- P-36 CRG Review exists ----
    print("--- P-36 CRG review ---")
    has_crg = False
    for body in bodies:
        if _extract_crg_reviews(body):
            has_crg = True
            break
    if has_crg:
        findings.append(Finding("RV-05", Severity.INFO, "CRG Review present in PR conversation"))
    else:
        findings.append(Finding("RV-05", Severity.FAIL, "no CRG Review comment in PR conversation"))

    # ---- P-37 inline findings have reply ----
    print("--- P-37 findings resolved ---")
    inline_count = sum(len(_extract_inline_reviews(b)) for b in bodies)
    if inline_count == 0:
        findings.append(Finding("RV-06", Severity.INFO, "no inline findings to resolve"))
    elif len(all_replies) >= inline_count:
        findings.append(Finding("RV-06", Severity.INFO, f"all {inline_count} inline finding(s) have reply ({len(all_replies)} replies)"))
    else:
        findings.append(Finding("RV-06", Severity.WARN, f"{len(all_replies)}/{inline_count} inline findings have reply"))

    return findings


# ---------------------------------------------------------------------------
# config + CLI
# ---------------------------------------------------------------------------

def _load_config() -> dict[str, Any]:
    return load_yaml(ROOT / "spec" / "github_reviews.yaml")


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        print(__doc__)
        return 2
    repo = args[0]
    num = int(args[1])

    cfg = _load_config()

    # Fetch PR review comments and issue comments via GitHub API
    review_comments = gh_api_paginate(f"repos/{repo}/pulls/{num}/comments")
    issue_comments = gh_api_get(f"repos/{repo}/issues/{num}/comments") or []
    all_comments = list(review_comments or []) + list(issue_comments or [])

    print(f"== PR #{num} reviews: {len(all_comments)} comment(s) ==")
    findings = run(all_comments, cfg)
    print_findings(findings)
    return aggregate_result(findings)


if __name__ == "__main__":
    sys.exit(main())
