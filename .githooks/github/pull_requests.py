#!/usr/bin/env python3
"""Validate PR content against .githooks/spec/github_pull_requests.yaml.

Replaces bin/validate_pr.sh (non-review P-* rules).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / ".."))

from lib._shared import (  # noqa: E402
    Finding,
    Severity,
    aggregate_result,
    gh_api_get,
    load_yaml,
    print_findings,
)

CUTOFF = 55

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

CJK_RE = re.compile(r"[\u4e00-\u9fff]")
FULLWIDTH_BRACKETS = "（）「」【】『』《》〈〉《》﹁﹂"
H1_RE = re.compile(r"^# [^#]", re.MULTILINE)
HEADING_RE = re.compile(r"^#{1,6} ", re.MULTILINE)
CHECKBOX_RE = re.compile(r"^\s*-\s*\[([ xX])\]", re.MULTILINE)
TABLE_RE = re.compile(r"^\|[- ]+\|", re.MULTILINE)

TICKED = ("x", "X")


def _has_cjk(s: str) -> bool:
    return bool(CJK_RE.search(s))


def _section(body: str, heading: str) -> str:
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
    cfg = load_yaml(ROOT / "spec" / "github_pull_requests.yaml")
    cfg.setdefault("required_body_headings", ["Issue", "What", "Why"])
    cfg.setdefault("required_title_headings", ["Goal", "Background"])
    cfg.setdefault("forbidden_brackets_in_title", list(FULLWIDTH_BRACKETS))
    cfg.setdefault("forbidden_keywords", [])
    cfg.setdefault("ci_check_mode", "WARN")
    cfg.setdefault("done_when_check_mode", "FAIL")
    cfg.setdefault("keyword_label_suggestions", {})
    return cfg




def _extract_fixes(body: str) -> list[str]:
    """Extract all 'Fixes #N' / 'Closes #N' / 'Resolves #N' lines."""
    return re.findall(r"(?:Fixes|Closes|Resolves)\s+#(\d+)", body)


# ---------------------------------------------------------------------------
# rule functions
# ---------------------------------------------------------------------------

def check_content(
    title: str,
    body: str,
    labels: list[str],
    head_ref: str = "",
    state: str = "open",
    draft: bool = False,
    cfg: Optional[dict[str, Any]] = None,
) -> list[Finding]:
    """纯内容校验（不调 API）。供 gh-gate 创建前拦截 + run() 复用。

    规则全部来自 spec/github_pull_requests.yaml。API 相关检查（P-14/P-20
    repo labels、P-39 closing reference）不在此函数内。
    """
    if cfg is None:
        cfg = _load_config()
    findings: list[Finding] = []

    # P-01 title English / P-02 conventional commit
    if _has_cjk(title):
        findings.append(Finding("PR-01", Severity.FAIL, "title contains CJK (title should be English)"))
    else:
        findings.append(Finding("PR-01", Severity.INFO, "title is English"))
    if re.match(r"^(feat|fix|chore|docs|style|refactor|test|ci|build|perf|revert)(\(.+\))?:\s+", title):
        findings.append(Finding("PR-02", Severity.INFO, "conventional commit title"))
    else:
        findings.append(Finding("PR-02", Severity.WARN, f"title not conventional commit (repo template allows natural English): {title}"))

    # Body structure headings
    body_headings = set(_headings(body))
    for h in cfg.get("required_body_headings", ["What", "Why", "Issue", "Construction plan", "Delivery record", "How to test", "Checklist"]):
        if h in body_headings:
            findings.append(Finding("PR-03", Severity.INFO, f"heading present: {h}"))
        else:
            findings.append(Finding("PR-03", Severity.FAIL, f"missing heading: ## {h}"))

    # Construction plan / Checklist 必须 ≥2 个 checkbox（1 个是错误正文）
    if "Construction plan" in body_headings:
        plan = _section(body, "Construction plan")
        boxes = CHECKBOX_RE.findall(plan)
        if len(boxes) < 2:
            findings.append(Finding("PR-03", Severity.FAIL, f"Construction plan 必须至少 2 个 checkbox，当前 {len(boxes)} 个"))
    if "Checklist" in body_headings:
        checklist = _section(body, "Checklist")
        boxes = CHECKBOX_RE.findall(checklist)
        if len(boxes) < 2:
            findings.append(Finding("PR-03", Severity.FAIL, f"Checklist 必须至少 2 个 checkbox，当前 {len(boxes)} 个"))
    # P-10 heading English / What Chinese
    bad_h = [h for h in _headings(body) if _has_cjk(h)]
    if bad_h:
        findings.append(Finding("PR-04", Severity.FAIL, f"headings contain CJK (headings must be English): {bad_h}"))
    else:
        findings.append(Finding("PR-04", Severity.INFO, "headings are English only"))
    what = _section(body, "What")
    if _has_cjk(what):
        findings.append(Finding("PR-04", Severity.INFO, "What section has Chinese prose"))
    else:
        findings.append(Finding("PR-04", Severity.WARN, "What section has no Chinese prose (template requires Chinese)"))

    # P-14b type label + keyword suggestions
    type_labels_cfg = cfg.get("type_labels_cfg", ["bug", "enhancement", "feature", "documentation", "chore", "refactor", "tests", "epic"])
    if any(l in type_labels_cfg for l in labels):
        findings.append(Finding("PR-06", Severity.INFO, "type label present"))
    else:
        findings.append(Finding("PR-06", Severity.FAIL, "no type label (expected one of the type set)"))
    kw_map = cfg.get("keyword_label_suggestions", {})
    if kw_map:
        haystack = f"{title}\n{body}".lower()
        missing_suggestions: list[str] = []
        for keyword, suggested_label in kw_map.items():
            if keyword.lower() in haystack and suggested_label not in labels:
                missing_suggestions.append(suggested_label)
        if missing_suggestions:
            findings.append(Finding("PR-06", Severity.WARN, f"based on content keywords, consider also labeling: {' '.join(sorted(set(missing_suggestions)))}"))
        else:
            findings.append(Finding("PR-06", Severity.INFO, "content keywords align with assigned labels"))
    else:
        findings.append(Finding("PR-06", Severity.INFO, "no keyword suggestions (or policy not configured)"))

    # P-11/P-12/P-13 issue linkage
    fixes = _extract_fixes(body)
    fixes_unique = sorted(set(fixes), key=int)
    fixes_count = len(fixes_unique)
    if state == "open" and fixes_count > 0:
        findings.append(Finding("PR-05", Severity.WARN, "open PR already uses Fixes # (may close issue prematurely)"))
    else:
        findings.append(Finding("PR-05", Severity.INFO, "no premature Fixes while open (or PR not open)"))
    if fixes_count == 1:
        findings.append(Finding("PR-05", Severity.INFO, "exactly one Fixes #"))
    elif fixes_count == 0:
        if draft:
            findings.append(Finding("PR-05", Severity.INFO, "draft PR, Fixes may appear at merge authorization"))
        else:
            findings.append(Finding("PR-05", Severity.WARN, "no Fixes # yet (needs one primary issue before merge)"))
    else:
        findings.append(Finding("PR-05", Severity.WARN, f"multiple Fixes # ({fixes_count}): one PR should close one issue"))
    if fixes_count <= 1:
        findings.append(Finding("PR-05", Severity.INFO, "one primary issue"))
    else:
        findings.append(Finding("PR-05", Severity.FAIL, "one PR should close one primary issue"))

    # 纯文本关联提示: Part of / Related 不产生 GitHub development 关联
    # (GitHub 只认 Fixes/Closes/Resolves closing keywords; epic 关联走 sub-issue 层级)
    text_links = re.findall(r"(?:Part of|Related)\s+#(\d+)", body)
    if text_links:
        findings.append(Finding(
            "PR-10", Severity.INFO,
            f"Part of/Related #({', '.join(text_links)}) 是纯文本，不产生 GitHub 关联；"
            "epic 关联通过 Fixes 的 sub-issue 层级或 UI development 面板"))
    else:
        findings.append(Finding("PR-10", Severity.INFO, "no plain-text Part of/Related links"))

    # P-21 type label (PR variant)
    if any(l in type_labels_cfg for l in labels):
        findings.append(Finding("PR-06", Severity.INFO, "type label present"))
    else:
        findings.append(Finding("PR-06", Severity.FAIL, "no type label (expected one of the type set)"))
    if kw_map:
        missing_suggestions = []
        haystack = f"{title}\n{body}".lower()
        for keyword, suggested_label in kw_map.items():
            if keyword.lower() in haystack and suggested_label not in labels:
                missing_suggestions.append(suggested_label)
        if missing_suggestions:
            findings.append(Finding("PR-06", Severity.WARN, f"based on content keywords, consider also labeling: {' '.join(sorted(set(missing_suggestions)))}"))
        else:
            findings.append(Finding("PR-06", Severity.INFO, "content keywords align with assigned labels"))
    else:
        findings.append(Finding("PR-06", Severity.INFO, "no keyword suggestions (or policy not configured)"))

    # P-31 branch name — strip fork "user:" prefix before prefix check
    allowed = cfg.get("allowed_branch_prefixes", ["feat/", "fix/", "chore/", "epic/", "main", "master", "release/"])
    branch = head_ref.rsplit(":", 1)[-1] if ":" in head_ref else head_ref
    if not branch or not any(branch.startswith(p) for p in allowed):
        findings.append(Finding("PR-08", Severity.FAIL, f"branch name not allowed: {branch} (allowed prefixes: {allowed})"))
    else:
        findings.append(Finding("PR-08", Severity.INFO, f"branch name OK: {branch} (prefixes: {allowed})"))

    # P-38 maintainer review
    findings.append(Finding("PR-09", Severity.WARN, "no maintainer review (COMMENTED/APPROVED/CHANGES_REQUESTED) — human required"))

    return findings


def run(repo: str, num: int, mode: str = "", strict: bool = False) -> list[Finding]:
    cfg = _load_config()
    findings: list[Finding] = []

    if not strict and num < CUTOFF:
        print(f"== PR #{num}: SKIP (below cutoff {CUTOFF}; legacy exempt.) ==")
        return []

    pr = gh_api_get(f"repos/{repo}/pulls/{num}")
    if not pr:
        findings.append(Finding("PR-00", Severity.FAIL, "PR fetch returned nothing"))
        return findings

    title: str = pr.get("title", "")
    body: str = pr.get("body") or ""
    state: str = pr.get("state", "open").lower()
    labels: list[str] = [l.get("name", "") for l in pr.get("labels", []) or []]
    mergeable: bool = pr.get("mergeable", True)
    head_ref: str = pr.get("head", {}).get("ref", "")
    draft: bool = pr.get("draft", False)

    print(f"== PR #{num}: {title} (state={state}, mergeable={mergeable}) ==")
    findings.extend(check_content(title, body, labels, head_ref=head_ref, state=state, draft=draft, cfg=cfg))

    # API 专属：P-14/P-20 repo labels
    print("--- labels ---")
    all_labels = gh_api_get(f"repos/{repo}/labels")
    valid_names = {l.get("name", "") for l in all_labels or []}
    unknown = [l for l in labels if l and l not in valid_names]
    if unknown:
        findings.append(Finding("PR-06", Severity.FAIL, f"labels not in repo: {unknown}"))
        findings.append(Finding("PR-06", Severity.FAIL, f"labels not in repo: {unknown}"))
    else:
        findings.append(Finding("PR-06", Severity.INFO, "labels all exist in repo"))
        findings.append(Finding("PR-06", Severity.INFO, "labels all exist in repo"))

    # API 专属：closing reference + Fixes 目标是 epic 检查
    print("--- closing reference ---")
    fixes = _extract_fixes(body)
    if fixes:
        for fn in fixes:
            issue = gh_api_get(f"repos/{repo}/issues/{fn}")
            if not issue:
                findings.append(Finding(
                    "PR-10", Severity.WARN,
                    f"Fixes #{fn} 不存在：issue 需先创建（或修正编号）。PR 与 issue 的关联必须双向可查，"
                    "无 issue 时 Fixes 是死引用，不会建立 Development 关联"))
                continue
            subs = gh_api_get(f"repos/{repo}/issues/{fn}/sub_issues")
            if subs:
                findings.append(Finding(
                    "PR-10", Severity.WARN,
                    f"Fixes #{fn} 是 parent issue（{len(subs)} 个 sub-issues）：epic 侧 Development "
                    "面板不显示 closing 关联；合并会尝试关闭 epic。应 Fixes 其 sub-issue 建立层级链"))
            else:
                findings.append(Finding("PR-10", Severity.INFO, f"Fixes #{fn} 是普通 issue，双向关联正常"))
        findings.append(Finding("PR-10", Severity.INFO,
                                f"Fixes # present: #{fixes[0]}; closing reference check requires base branch = default"))

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