#!/usr/bin/env python3
"""review — 本地审查工具，整合 CRG（结构分析）+ ocr（AI 审查）。

用法:
    python .githooks/review.py                 # 审查当前变更（终端输出）
    python .githooks/review.py --post           # 审查后留言到 PR conversation
    python .githooks/review.py --post-inline    # 审查后 inline review 留言
    python .githooks/review.py --pr 123         # 审查指定 PR
"""
from __future__ import annotations
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / ".."))

from lib._shared import Finding, Severity, aggregate_result, print_findings, gh_api_get  # noqa: E402


CRG_BIN = subprocess.run(["which", "code-review-graph"], capture_output=True, text=True).stdout.strip() or "/home/hathaway/.local/bin/code-review-graph"
OCR_BIN = "/usr/bin/ocr"
REPO = ""


def _derive_repo() -> str:
    try:
        out = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True, timeout=5).stdout.strip()
        for prefix in ("https://github.com/", "git@github.com:", "ssh://git@github.com/"):
            if out.startswith(prefix):
                return out[len(prefix):].removesuffix(".git")
    except Exception:
        pass
    return ""


def _current_branch() -> str:
    return subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True).stdout.strip()


def _find_pr(repo: str, branch: str) -> int | None:
    try:
        import json as j
        prs = json.loads(gh_api_get(f"repos/{repo}/pulls?head={repo.split('/')[0]}:{branch}&state=open") or "[]")
        if isinstance(prs, list) and prs:
            return prs[0]["number"]
    except Exception:
        pass
    return None


def _run_crg() -> str:
    """Run CRG change detection, return summary."""
    try:
        rc = subprocess.run([CRG_BIN, "detect-changes", "--brief", "--base", "main"],
                          capture_output=True, text=True, timeout=120)
        if rc.returncode == 0:
            return rc.stdout.strip()
        return f"[CRG] {rc.stderr.strip()}"
    except Exception as e:
        return f"[CRG] 出错: {e}"


def _run_ocr() -> str:
    """Run ocr review, return JSON results."""
    try:
        # 确保 ocr 配置指向 wildtoken
        env = os.environ.copy()
        rc = subprocess.run([OCR_BIN, "review", "--format", "json", "--audience", "agent"],
                          capture_output=True, text=True, timeout=600, env=env)
        if rc.returncode == 0 or rc.stdout.strip():
            return rc.stdout.strip()
        return f"[ocr] {rc.stderr.strip()}"
    except subprocess.TimeoutExpired:
        return "[ocr] 超时（LLM 响应慢）"
    except Exception as e:
        return f"[ocr] 出错: {e}"


def _format_ocr_results(raw: str) -> str:
    """Parse ocr JSON output into readable text."""
    try:
        data = json.loads(raw)
        comments = data.get("comments", [])
        if not comments:
            return "无审查发现"
        lines: list[str] = []
        cur_path = None
        for c in comments:
            path = c.get("path", "?")
            if path != cur_path:
                lines.append(f"\n## {path}")
                cur_path = path
            sev = c.get("severity", "info")
            cat = c.get("category", "")
            content = c.get("content", "")
            start = c.get("start_line", 0)
            loc = f" L{start}" if start else ""
            lines.append(f"- [{cat}/{sev}]{loc} {content}")
        return "\n".join(lines) if lines else "无审查发现"
    except json.JSONDecodeError:
        return raw[:2000] if raw else "无结果"


def _parse_ocr_comments(raw: str) -> list[dict[str, Any]]:
    """Extract structured comments for inline posting."""
    try:
        data = json.loads(raw)
        return data.get("comments", [])
    except json.JSONDecodeError:
        return []


def _post_pr_comment(repo: str, pr_num: int, body: str) -> None:
    """Post a PR conversation comment."""
    data = json.dumps({"body": body}).encode()
    url = f"https://api.github.com/repos/{repo}/issues/{pr_num}/comments"
    req = urllib.request.Request(url, data=data, method="POST")
    token = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True).stdout.strip()
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=30)
    except Exception as e:
        print(f"留言失败: {e}")


def _post_inline_review(repo: str, pr_num: int, comments: list[dict[str, Any]]) -> None:
    """Post inline review comments on the PR diff (Files changed page)."""
    if not comments:
        return
    payload: dict[str, Any] = {"event": "COMMENT", "body": "Agent 🤖 - CRG + ocr 自动审查", "comments": []}
    for c in comments:
        path = c.get("path", "")
        line = c.get("start_line") or c.get("end_line") or 1
        content = c.get("content", "")
        sev = c.get("severity", "info")
        cat = c.get("category", "")
        payload["comments"].append({
            "path": path,
            "line": int(line),
            "body": f"Agent 🤖 - [{cat}/{sev}] {content}",
        })
    data = json.dumps(payload).encode()
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_num}/reviews"
    req = urllib.request.Request(url, data=data, method="POST")
    token = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True).stdout.strip()
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=30)
        print(f"已提交 {len(payload['comments'])} 条 inline review 到 PR #{pr_num}")
    except Exception as e:
        print(f"inline review 失败: {e}")


def main() -> int:
    global REPO
    REPO = _derive_repo()
    branch = _current_branch()
    pr_num = _find_pr(REPO, branch)
    post_mode = "--post" in sys.argv
    post_inline = "--post-inline" in sys.argv
    if "--pr" in sys.argv:
        idx = sys.argv.index("--pr")
        if idx + 1 < len(sys.argv):
            pr_num = int(sys.argv[idx + 1])

    print(f"=== 审查: {REPO} ({branch}) ===\n")

    # 1. CRG 结构分析
    print("--- CRG 变更影响分析 ---")
    crg_out = _run_crg()
    print(crg_out[:2000] if crg_out else "（无 CRG 输出）")
    print()

    # 2. ocr AI 审查
    print("--- ocr AI 审查 ---")
    print("（正在运行，LLM 可能需要几十秒...）")
    sys.stdout.flush()
    ocr_raw = _run_ocr()
    ocr_text = _format_ocr_results(ocr_raw)
    print(ocr_text)
    print()

    # 3. 汇总 + 留言
    print("=== 审查完成 ===")
    has_findings = ocr_text and ocr_text != "无审查发现"

    if (post_mode or post_inline) and pr_num and REPO:
        comments = _parse_ocr_comments(ocr_raw)
        if post_inline and comments:
            # inline review：逐条锚定到 diff 行号
            _post_inline_review(REPO, pr_num, comments)
        else:
            # conversation 留言：汇总报告
            body = f"## 审查报告\n\n### CRG 变更影响\n\n```\n{crg_out[:1200]}\n```\n\n### ocr 审查发现\n\n{ocr_text}"
            _post_pr_comment(REPO, pr_num, body)
            print(f"已留言到 PR #{pr_num}")

    return 0  # review 结果仅供参考，不阻塞合并


if __name__ == "__main__":
    sys.exit(main())