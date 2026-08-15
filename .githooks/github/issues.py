#!/usr/bin/env python3
"""Validate GitHub issue / sub-issue content against .githooks/spec/github_issues.yaml.

Replaces bin/validate_issue.sh (I-01 .. I-22b) as a YAML-driven Python port.

Usage:
    python3 .githooks/github/issues.py <owner/repo> <issue_number> [parent|sub] [--strict]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / ".."))  # for running from repo root

from lib._shared import (  # noqa: E402
    Finding,
    Severity,
    aggregate_result,
    gh_api_get,
    load_yaml,
    print_findings,
)

CUTOFF = 55  # legacy issues below this are exempt unless --strict

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

CJK_RE = re.compile(r"[\u4e00-\u9fff]")
FULLWIDTH_BRACKETS = "（）、「」【】『』《》〈〉《》﹁﹂"
H1_RE = re.compile(r"^# [^#]", re.MULTILINE)
HEADING_RE = re.compile(r"^#{1,6} ", re.MULTILINE)
CHECKBOX_RE = re.compile(r"^\s*-\s*\[([ xX])\]", re.MULTILINE)
TABLE_RE = re.compile(r"^\|[- ]+\|", re.MULTILINE)
TICKED = ("x", "X")


def _has_cjk(s: str) -> bool:
    return bool(CJK_RE.search(s))


def _section(body: str, heading: str) -> str:
    """Extract the body under a `## heading`, stopping at the next heading."""
    m = re.search(rf"^## {re.escape(heading)}\s*$", body, re.MULTILINE)
    if not m:
        return ""
    rest = body[m.end():]
    nxt = re.search(r"^## ", rest, re.MULTILINE)
    return rest[: nxt.start()] if nxt else rest


def _headings(body: str) -> list[str]:
    return [
        line.strip().lstrip("#").strip()
        for line in body.splitlines()
        if HEADING_RE.match(line)
    ]


def _explicit_bool(v: Any, default: bool) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes")
    return default


# ---------------------------------------------------------------------------
# rule registry
# ---------------------------------------------------------------------------

def _load_config() -> dict[str, Any]:
    cfg = load_yaml(ROOT / "spec" / "github_issues.yaml")
    cfg.setdefault("required_headings", ["Goal", "Done when"])
    cfg.setdefault("forbidden_brackets_in_title", list(FULLWIDTH_BRACKETS))
    cfg.setdefault("forbidden_keywords", [])
    return cfg


def check_content(
    title: str,
    body: str,
    labels: list[str],
    mode: str = "sub",
    cfg: Optional[dict[str, Any]] = None,
    state: str = "open",
) -> list[Finding]:
    """纯内容校验（不调 API）。供 gh-gate 创建前拦截 + run() 复用。

    规则全部来自 spec/github_issues.yaml。API 相关检查（I-18 sub-issues、
    I-20 repo labels、creation suggestion）不在此函数内。
    """
    if cfg is None:
        cfg = _load_config()
    findings: list[Finding] = []

    # 乱码检查（spec.garbled_content_check → I-30）
    if cfg.get("garbled_content_check", True):
        if "\\n" in body or "\\r" in body:
            findings.append(Finding("IS-16", Severity.FAIL, "正文含字面 \\n/\\r，应为真实换行符（用 heredoc 而非 --body 传多行）"))
        if "\ufffd" in body:
            findings.append(Finding("IS-16", Severity.FAIL, "正文含 U+FFFD 替换符，编码错误"))
        if "\\n" in title or "\\r" in title:
            findings.append(Finding("IS-16", Severity.FAIL, "标题含字面 \\n/\\r"))

    # 标题禁用前缀（spec.title_forbidden_prefixes）
    for p in cfg.get("title_forbidden_prefixes", []):
        if title.lower().startswith(p.lower()):
            findings.append(Finding("IS-00", Severity.FAIL, f"标题禁用前缀 '{p}'，关系用 label 表达"))

    # 正文禁 Labels 段（spec.labels_section_forbidden）
    if cfg.get("labels_section_forbidden", True) and "## Labels" in body:
        findings.append(Finding("IS-00", Severity.FAIL, "正文禁止 Labels 段，用 gh label 操作"))

    # I-01/I-02 template structure
    if mode == "parent":
        findings.append(Finding("IS-01", Severity.INFO, "parent mode: template structure n/a (Implementation Order instead)"))
    else:
        required = cfg["required_headings"]
        body_headings = set(_headings(body))
        missing = [h for h in required if h not in body_headings]
        if missing:
            findings.append(Finding("IS-01", Severity.FAIL, f"missing required template headings: {', '.join(missing)}"))
        else:
            findings.append(Finding("IS-01", Severity.INFO, "all template headings present"))

    # I-03 focus
    n_h1 = len(H1_RE.findall(body))
    if mode != "parent" and n_h1 > 1:
        findings.append(Finding("IS-03", Severity.WARN, f"multiple H1 titles ({n_h1}); body should focus one outcome"))
    else:
        findings.append(Finding("IS-03", Severity.INFO, "body focused (or parent mode)"))

    # I-04 acceptance checkboxes
    if mode == "parent":
        findings.append(Finding("IS-04", Severity.INFO, "parent mode: Done when n/a"))
    else:
        done = _section(body, cfg["heading_names"]["done_when"])
        boxes = CHECKBOX_RE.findall(done)
        if boxes:
            findings.append(Finding("IS-04", Severity.INFO, "Done when uses checkboxes"))
        else:
            findings.append(Finding("IS-04", Severity.FAIL, "Done when section lacks checkbox items"))
        if TABLE_RE.search(done):
            findings.append(Finding("IS-04", Severity.FAIL, "Done when uses a table (checkboxes required)"))
        else:
            findings.append(Finding("IS-04", Severity.INFO, "Done when has no table"))

    # I-02b suspected areas
    if mode != "parent":
        suspected = _section(body, cfg["heading_names"]["suspected_areas"])
        if not suspected.strip():
            findings.append(Finding("IS-02", Severity.WARN, "Suspected areas empty; describe affected files/modules and what is not touched"))
        else:
            findings.append(Finding("IS-02", Severity.INFO, "Suspected areas populated"))

    # I-05/I-06/I-07 language
    if _has_cjk(title):
        findings.append(Finding("IS-05", Severity.INFO, "title is Chinese"))
    else:
        findings.append(Finding("IS-05", Severity.FAIL, "title lacks Chinese (repo convention)"))
    bad_h = [h for h in _headings(body) if _has_cjk(h)]
    if bad_h:
        findings.append(Finding("IS-06", Severity.FAIL, f"headings contain CJK (headings must be English): {bad_h}"))
    else:
        findings.append(Finding("IS-06", Severity.INFO, "headings are English only"))
    if _has_cjk(body):
        findings.append(Finding("IS-07", Severity.INFO, "body prose is Chinese"))
    else:
        findings.append(Finding("IS-07", Severity.FAIL, "body lacks Chinese prose"))


    # I-xx forbidden keywords
    for kw in cfg["forbidden_keywords"]:
        if kw in body:
            findings.append(Finding("IS-16", Severity.FAIL, f"body contains forbidden keyword: {kw}"))

    # I-xx 全角括号：只检查标题（规范 spec.forbidden_brackets_in_title），正文禁 Labels 段已单独检查
    fb_title = [c for c in title if c in cfg.get("forbidden_brackets_in_title", list(FULLWIDTH_BRACKETS))]
    if fb_title:
        findings.append(Finding("IS-16", Severity.FAIL, f"title contains fullwidth brackets: {set(fb_title)}"))
    else:
        findings.append(Finding("IS-16", Severity.INFO, "no fullwidth brackets in title"))
    # I-11/13/14, I-12 sub self-contained
    if mode == "sub":
        cross = re.findall(
            r"^(Depends on\s*[:：]|\*\*Depends.*[:：]|Blocks\s+[:：]|依赖[:：]|Related\s*#|Parent PR\s*[:：])",
            body, re.MULTILINE)
        if cross:
            findings.append(Finding("IS-09", Severity.FAIL, f"forbidden cross-references: {cross}"))
        else:
            findings.append(Finding("IS-09", Severity.INFO, "no parent/dep/sibling references"))
        pr_placeholder = re.findall(r"(待补\s*PR|TODO.*PR|需\s*PR|PR 关联[:：])", body)
        if pr_placeholder:
            findings.append(Finding("IS-10", Severity.FAIL, f"sub-issue has PR placeholders/declarations: {pr_placeholder}"))
        else:
            findings.append(Finding("IS-10", Severity.INFO, "no PR placeholders"))

    # I-16 parent no Done when, I-17 Implementation Order
    elif mode == "parent":
        if "## Done when" in body:
            findings.append(Finding("IS-11", Severity.FAIL, "parent must NOT have Done when section"))
        else:
            findings.append(Finding("IS-11", Severity.INFO, "parent has no Done when"))
        if "## Implementation Order" in body:
            findings.append(Finding("IS-13", Severity.INFO, "Implementation Order present (optional)"))
        else:
            findings.append(Finding("IS-13", Severity.INFO, "no Implementation Order section (optional)"))

    # I-21 type label, I-21b keyword suggestions
    type_labels = {"bug", "enhancement", "feature", "documentation", "chore", "refactor", "tests", "epic"}
    if any(l in type_labels for l in [x.lower() for x in labels]):
        findings.append(Finding("IS-14", Severity.INFO, "type label present"))
    else:
        findings.append(Finding("IS-14", Severity.FAIL, "no type label (expected one of the type set)"))
    kw_map = cfg.get("keyword_label_suggestions", {})
    if kw_map:
        haystack = f"{title}\n{body}".lower()
        missing_suggestions: list[str] = []
        for keyword, suggested_label in kw_map.items():
            if keyword.lower() in haystack and suggested_label not in labels:
                missing_suggestions.append(suggested_label)
        if missing_suggestions:
            findings.append(Finding("IS-14", Severity.WARN, f"based on content keywords, consider also labeling: {' '.join(sorted(set(missing_suggestions)))}"))
        else:
            findings.append(Finding("IS-14", Severity.INFO, "content keywords align with assigned labels"))
    else:
        findings.append(Finding("IS-14", Severity.INFO, "no keyword suggestions (or policy not configured)"))

    # I-22/I-22b closure
    if state == "closed":
        findings.append(Finding("IS-15", Severity.INFO, "issue closed with explicit closed event"))
        if mode == "sub":
            done = _section(body, cfg["heading_names"]["done_when"])
            boxes = CHECKBOX_RE.findall(done)
            total = len(boxes)
            checked = sum(1 for b in boxes if b in TICKED)
            if total == 0:
                findings.append(Finding("IS-15", Severity.WARN, "sub-issue closed but has no Done when boxes"))
            elif total == checked:
                findings.append(Finding("IS-15", Severity.INFO, f"sub-issue Done when all checked on close ({checked}/{total})"))
            else:
                findings.append(Finding("IS-15", Severity.FAIL, f"sub-issue closed with Done when unchecked ({checked}/{total}) — must tick all boxes before close"))
    else:
        findings.append(Finding("IS-15", Severity.INFO, "issue open; closure rule n/a"))

    return findings

def run(repo: str, num: int, mode: str = "", strict: bool = False) -> list[Finding]:
    cfg = _load_config()
    findings: list[Finding] = []

    if not strict and num < CUTOFF:
        print(f"== Issue #{num}: SKIP (below cutoff {CUTOFF}; legacy exempt. Use --strict to force.) ==")
        return []

    issue = gh_api_get(f"repos/{repo}/issues/{num}")
    if not issue:
        findings.append(Finding("IS-00", Severity.FAIL, "issue fetch returned nothing"))
        return findings

    title: str = issue.get("title", "")
    body: str = issue.get("body") or ""
    state: str = issue.get("state", "").lower()
    labels: list[str] = [l.get("name", "") for l in issue.get("labels", []) or []]

    # mode auto-detect: epic label 或存在 native sub-issues → parent
    subs = []
    if not mode:
        subs = gh_api_get(f"repos/{repo}/issues/{num}/sub_issues")
        is_epic_label = "epic" in [x.lower() for x in labels]
        mode = "parent" if (subs or is_epic_label) else "sub"

    print(f"== Issue #{num} ({mode}): {title} ==")
    findings.extend(check_content(title, body, labels, mode=mode, cfg=cfg, state=state))

    # API 专属：I-18/I-19 parent sub-issues 一致性
    if mode == "parent":
        print("--- parent format ---")
        if not subs:
            subs = gh_api_get(f"repos/{repo}/issues/{num}/sub_issues")
        nums = sorted(s.get("number", 0) for s in subs or [])
        if nums:
            findings.append(Finding("IS-12", Severity.INFO, f"parent has native sub-issues ({nums})"))
        else:
            findings.append(Finding("IS-12", Severity.FAIL, "parent has no native sub-issues (use GitHub sub-issue feature)"))
        if "## Implementation Order" in body:
            io_nums = sorted(int(x) for x in re.findall(r"\(#(\d+)\)", _section(body, "Implementation Order")))
            if io_nums and io_nums != nums:
                findings.append(Finding("IS-13", Severity.FAIL, f"Implementation Order ({io_nums}) != native sub-issues ({nums})"))

    # API 专属：I-20 repo labels
    print("--- labels ---")
    all_labels = gh_api_get(f"repos/{repo}/labels")
    valid_names = {l.get("name", "") for l in all_labels or []}
    unknown = [l for l in labels if l and l not in valid_names]
    if unknown:
        findings.append(Finding("IS-14", Severity.FAIL, f"labels not in repo: {unknown}"))
    else:
        findings.append(Finding("IS-14", Severity.INFO, "labels all exist in repo"))

    # API 专属：creation suggestion
    sug = cfg.get("creation_suggestion", {})
    if sug.get("enabled"):
        created = issue.get("created_at", "")
        if created:
            from datetime import datetime, timezone
            try:
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                age = (datetime.now(timezone.utc) - created_dt).total_seconds() / 60
            except (ValueError, TypeError):
                age = float("inf")
            if age < float(sug.get("grace", cfg.get("creation_grace_minutes", 5))):
                missing = [h for h in cfg["required_headings"] if h not in _headings(body)]
                if missing:
                    sev = Severity.FAIL if sug.get("severity") == "FAIL" else Severity.WARN
                    findings.append(Finding("IS-00", sev, f"new issue missing required sections: {missing}"))

    return findings



def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    strict = "--strict" in sys.argv
    if len(args) < 2:
        print(__doc__)
        return 2
    repo = args[0]
    num = int(args[1])
    mode = args[2] if len(args) > 2 else ""
    findings = run(repo, num, mode, strict=strict)
    print_findings(findings)
    return aggregate_result(findings)


if __name__ == "__main__":
    sys.exit(main())
