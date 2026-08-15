#!/usr/bin/env python3
"""验证并修复 issue/PR 的 checkbox 和 Fixes 关联。

用法:
    python .githooks/audit.py <owner/repo> [--fix]  # 检查并修复
    python .githooks/audit.py <owner/repo> --issues 139,140,141  # 指定 issue
    python .githooks/audit.py <owner/repo> --recent=1  # 检查最近 N 天创建的（CI 用）
"""
import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = ""

ROOT = Path(__file__).resolve().parent.parent


def _gh(args: list[str]) -> tuple[int, str]:
    proc = subprocess.run(["gh", "api"] + args, capture_output=True, text=True, timeout=30)
    return proc.returncode, proc.stdout.strip()


def _section(body: str, heading: str) -> str:
    m = re.search(rf"^## {re.escape(heading)}\s*$", body, re.MULTILINE)
    if not m:
        return ""
    rest = body[m.end():]
    nxt = re.search(r"^## ", rest, re.MULTILINE)
    return rest[: nxt.start()] if nxt else rest


def check_issue_done_when(num: int) -> list[str]:
    """检查 issue 的 Done when 是否全勾。返回未勾项列表。"""
    _, body = _gh([f"repos/{REPO}/issues/{num}", "--jq", ".body"])
    if not body:
        return []
    sec = _section(body, "Done when")
    unticked: list[str] = []
    for line in sec.splitlines():
        m = re.match(r"^\s*-\s*\[\s\]\s*(.+)", line)
        if m:
            unticked.append(m.group(1).strip())
    return unticked


def check_pr_body(num: int) -> list[str]:
    """检查 PR 的 Construciton plan / Checklist。返回问题列表。"""
    _, body = _gh([f"repos/{REPO}/pulls/{num}", "--jq", ".body"])
    if not body:
        return []
    issues: list[str] = []
    for sec_name in ["Construction plan", "Checklist"]:
        sec = _section(body, sec_name)
        boxes = re.findall(r"^\s*-\s*\[([ xX])\]", sec, re.MULTILINE)
        if len(boxes) < 2:
            issues.append(f"{sec_name} 只有 {len(boxes)} 个 checkbox，需要至少 2 个")
        unticked = re.findall(r"^\s*-\s*\[\s\]\s*(.+)", sec, re.MULTILINE)
        if unticked:
            issues.append(f"{sec_name} 未勾: {unticked}")
    # Fixes 检查
    if "Fixes" not in body and "Closes" not in body and "Resolves" not in body:
        issues.append("无 Fixes 关联")
    return issues


def fix_issue_boxes(num: int, items: list[str]) -> None:
    """把 issue 的 Done when checkbox 全部打钩。"""
    _, body = _gh([f"repos/{REPO}/issues/{num}", "--jq", ".body"])
    if not body:
        return
    new_body = re.sub(r"^(\s*-\s*)\[\s\](\s*.+)$", r"\1[x]\2", body, flags=re.MULTILINE)
    if new_body == body:
        return
    with open("/tmp/audit_body.txt", "w") as f:
        f.write(new_body)
    subprocess.run(["gh", "issue", "edit", str(num), "--body-file", "/tmp/audit_body.txt"],
                   capture_output=True, text=True, timeout=30)
    print(f"  ✓ #{num} Done when 已全部打钩")
def _check_one(num: str, is_pr: str) -> list[str]:
    """检查单个 issue/PR，返回 FAIL 行。"""
    runner = "pull_requests.py" if is_pr == "True" else "issues.py"
    proc = subprocess.run(
        [sys.executable, str(ROOT / "github" / runner), REPO, num],
        capture_output=True, text=True, timeout=60)
    fail_lines = [l for l in proc.stdout.splitlines()
                  if "FAIL" in l or l.startswith("RESULT: FAIL")]
    if fail_lines:
        return [f"#{num} ({'PR' if is_pr == 'True' else 'issue'}):"] + [f"  {l}" for l in fail_lines]
    return []


def scan_recent(days: int, limit: int = 0, workers: int = 5) -> int:
    """检查最近 N 天创建的 issue/PR，跑完整规则（github/*.py），输出 FAIL 清单。

    limit: 最多检查条数（0 = 不限）；workers: 并发数（防 API 限流）。
    """
    since = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
    q = f"search/issues?q=repo:{REPO}+created:>={since}&per_page=100"
    rc, out = _gh([q, "--jq", r'.items[] | "\(.number)\t\(.pull_request != null)"'])
    if rc != 0:
        print(f"search failed: {out or rc}")
        return 2
    items = [line.split("\t") for line in out.splitlines() if "\t" in line]
    if limit > 0:
        items = items[:limit]
    print(f"最近 {days} 天创建的条目: {len(items)} 个（并发 {workers}）\n")

    fails: list[str] = []
    from concurrent.futures import ThreadPoolExecutor, as_completed
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_check_one, num, is_pr): num for num, is_pr in items}
        for f in as_completed(futures):
            fails.extend(f.result())
    if fails:
        print("FAIL 清单:")
        for l in fails:
            print(l)
        return 1


def main() -> int:
    global REPO
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    specific = None
    recent = None
    limit = 0
    workers = 5
    for a in sys.argv[1:]:
        if a.startswith("--issues="):
            specific = [int(x) for x in a.split("=", 1)[1].split(",")]
        elif a.startswith("--recent="):
            recent = int(a.split("=", 1)[1])
        elif a.startswith("--limit="):
            limit = int(a.split("=", 1)[1])
        elif a.startswith("--workers="):
            workers = int(a.split("=", 1)[1])

    if not args:
        print("Usage: python .githooks/dev/audit.py <owner/repo> [--fix] [--issues=N,M] [--recent=N] [--limit=N] [--workers=N]")
        return 1
    REPO = args[0]

    if recent is not None:
        return scan_recent(recent, limit=limit, workers=workers)

    if specific:
        nums = specific
    else:
        _, issues_json = _gh([f"search/issues?q=repo:{REPO}+is:closed&sort=updated&per_page=20", "--jq", ".items[].number"])
        _, prs_json = _gh([f"search/issues?q=repo:{REPO}+is:pr+is:merged&sort=updated&per_page=20", "--jq", ".items[].number"])
        nums = [int(x) for x in issues_json.split() if x.isdigit()]

    print(f"检查 {REPO} 的 issue/PR...\n")
    for num in nums:
        rc, data = _gh([f"repos/{REPO}/issues/{num}", "--jq", "{state, pull_request:.pull_request}"])
        if rc != 0:
            continue
        d = json.loads(data)
        if d.get("pull_request"):
            problems = check_pr_body(num)
            if problems:
                print(f"PR #{num}:")
                for p in problems:
                    print(f"  ⚠ {p}")
        else:
            problems = check_issue_done_when(num)
            if problems:
                print(f"#{num}: Done when 未勾 ({len(problems)} 项):")
                for p in problems:
                    print(f"  - [ ] {p}")
                if fix:
                    fix_issue_boxes(num, problems)
    print("\n检查完成。")
    return 0

if __name__ == "__main__":
    sys.exit(main())