#!/usr/bin/env python3
"""gh gate — 全局 gh wrapper + 创建拦截器。

安装到 ~/.local/bin/gh 后，所有 gh issue create / gh pr create 自动走校验。
规则从项目 .githooks/spec/ + issues.py/pull_requests.py 读取（向上查找 cwd）。

用法:
    python .githooks/install_gh_gate.py --install     # 安装到 ~/.local/bin/gh
    python .githooks/install_gh_gate.py --uninstall   # 卸载
    gh issue create ...                                # 安装后自动拦截
"""
from __future__ import annotations

import datetime
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

INSTALL_DIR = Path.home() / ".local" / "bin"
GATE_NAME = "gh"
LOG_DIR = Path.home() / ".local" / "share" / "gh-gate"
LOG_FILE = LOG_DIR / "gate.log"


def _log(action: str, target: str, result: str, detail: str = "") -> None:
    """记录 gh-gate 操作日志，便于回溯 issue/PR 操作。"""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.datetime.now().isoformat(timespec="seconds")
        with open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(f"{ts} | {action} | {target} | {result} | {detail}\n")
    except Exception:
        pass

# ---------------------------------------------------------------------------
# 安装 / 卸载
# ---------------------------------------------------------------------------

def _install() -> int:
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    # 配置 git hooks 路径
    subprocess.run(["git", "config", "core.hooksPath", ".githooks/hooks"], capture_output=True, timeout=10)
    target = INSTALL_DIR / GATE_NAME
    shutil.copy2(__file__, target)
    target.chmod(0o755)
    print(f"✓ 已安装: {target}")
    print(f"  PATH 前置: export PATH=\"{INSTALL_DIR}:$PATH\"")
    print(f"  验证: hash -r && which gh")
    # 检查 PATH 是否包含 INSTALL_DIR
    if str(INSTALL_DIR) not in os.environ.get("PATH", ""):
        shell = Path.home() / ".zshrc"
        if shell.exists():
            ans = input(f"是否写入 {shell} 的 PATH？[y/N] ")
            if ans.lower().startswith("y"):
                with open(shell, "a") as fh:
                    fh.write(f'\nexport PATH="{INSTALL_DIR}:$PATH"\n')
                print(f"✓ 已写入 {shell}，新终端生效")
    return 0


def _uninstall() -> int:
    target = INSTALL_DIR / GATE_NAME
    if target.exists():
        target.unlink()
        print(f"✓ 已删除: {target}")
    else:
        print(f"未安装: {target}")
    return 0


# ---------------------------------------------------------------------------
# 查找项目 .githooks 和真实 gh
# ---------------------------------------------------------------------------

def _find_project_githooks() -> Path | None:
    """从 cwd 向上查找 .githooks 目录。"""
    d = Path.cwd()
    while True:
        candidate = d / ".githooks"
        if candidate.is_dir():
            return candidate
        parent = d.parent
        if parent == d:
            return None
        d = parent


def _find_real_gh() -> str:
    """找真实 gh 二进制，跳过自身。"""
    self_path = Path(__file__).resolve()
    for p in os.environ.get("PATH", "").split(":"):
        candidate = Path(p) / "gh"
        if candidate.is_file() and candidate.resolve() != self_path:
            try:
                proc = subprocess.run([str(candidate), "--version"],
                                      capture_output=True, text=True, timeout=5)
                if proc.returncode == 0:
                    return str(candidate)
            except Exception:
                continue
    for fallback in ["/usr/bin/gh", "/usr/local/bin/gh", "/bin/gh"]:
        if Path(fallback).is_file():
            return fallback
    return "gh"


# ---------------------------------------------------------------------------
# 拦截逻辑
# ---------------------------------------------------------------------------

def _run_gh(args: list[str]) -> tuple[int, str, str]:
    proc = subprocess.run([_find_real_gh()] + args, capture_output=True, text=True, timeout=60)
    return proc.returncode, proc.stdout, proc.stderr


def _extract(args: list[str]) -> tuple[str, str, list[str], str, str]:
    """Extract title, body, labels, head, parent."""
    title = body = head = parent = ""
    labels: list[str] = []
    for i, a in enumerate(args):
        if a in ("--title", "-t") and i + 1 < len(args):
            title = args[i + 1]
        elif a.startswith("--title="):
            title = a.split("=", 1)[1]
        elif a in ("--body", "-b") and i + 1 < len(args):
            body = args[i + 1]
        elif a.startswith("--body="):
            body = a.split("=", 1)[1]
        elif a in ("--label", "-l") and i + 1 < len(args):
            labels.extend(args[i + 1].split(","))
        elif a.startswith("--label="):
            labels.extend(a.split("=", 1)[1].split(","))
        elif a in ("--head", "-H") and i + 1 < len(args):
            head = args[i + 1]
        elif a.startswith("--head="):
            head = a.split("=", 1)[1]
        elif a in ("--parent", "-P") and i + 1 < len(args):
            parent = args[i + 1].lstrip("#")
        elif a.startswith("--parent="):
            parent = a.split("=", 1)[1].lstrip("#")
    return title, body, labels, head, parent


def _gh_args(args: list[str]) -> list[str]:
    """Strip gh-gate-only flags (--parent) from args."""
    out: list[str] = []
    skip = False
    for a in args:
        if skip:
            skip = False
            continue
        if a in ("--parent", "-P") or a.startswith("--parent="):
            skip = a in ("--parent", "-P")
            continue
        out.append(a)
    return out


def _intercept_issue_create(args: list[str]) -> int:
    title, body, labels, _, parent = _extract(args)
    # GT-01 逃生门: --disable-check 显式跳过校验（记日志 + 终端警告，防滥用）
    if "--disable-check" in args:
        _log("ISSUE_CREATE", title[:40], "BYPASS", "--disable-check")
        print("⚠ 闸门: --disable-check 跳过校验（已记入 gate.log；仅本次调用生效）")
        clean = [a for a in args if a != "--disable-check"]
        return _passthrough(["issue", "create"] + clean)
    repo = _derive_repo()
    githooks = _find_project_githooks()
    sys.path.insert(0, str(githooks))
    sys.path.insert(0, str(githooks / "github"))
    import issues as issues_mod

    mode = "parent" if "epic" in [x.lower() for x in labels] else "sub"
    findings = issues_mod.check_content(title, body, labels, mode=mode)
    fails = [f for f in findings if f.severity.name == "FAIL"]
    for f in findings:
        print(f"{f.severity.name}\t{f.message}")
    if fails:
        print("闸门: 校验 FAIL，拒绝创建。修正后重试。")
        _log("ISSUE_CREATE", title[:40], "REJECT", f"FAIL={len(fails)}")
        return 1

    print("闸门: 检查通过，执行 gh ...")
    clean_args = _gh_args(args)
    rc, out, err = _run_gh(["issue", "create"] + clean_args)
    if out: print(out)
    if err: print(err, file=sys.stderr)
    if rc != 0: return rc

    url = out.strip()
    if url.startswith("https://github.com/"):
        num = url.split("/issues/")[1].split("/")[0] if "/issues/" in url else ""
        if num:
            proc = subprocess.run(
                [sys.executable, str(githooks / "github" / "issues.py"), repo, num],
                capture_output=True, text=True, timeout=30,
            )
            if "FAIL" in proc.stdout:
                print(f"FAIL\t#{num} 创建后校验 FAIL，修正后重跑")
                _log("ISSUE_CREATE", f"#{num}", "POST_FAIL", "")
            else:
                print(f"INFO\t#{num} 创建后校验 ALL PASS")
                _log("ISSUE_CREATE", f"#{num}", "CREATED", title[:40])

        if "epic" not in [x.lower() for x in labels] and "/issues/" in url:
            _auto_link_sub(url, repo, githooks, parent)
    return 0


def _intercept_pr_create(args: list[str]) -> int:
    title, body, labels, head, _ = _extract(args)
    repo = _derive_repo()
    githooks = _find_project_githooks()
    if githooks is None:
        return _passthrough(["pr", "create"] + args)

    sys.path.insert(0, str(githooks))
    sys.path.insert(0, str(githooks / "github"))
    import pull_requests as pr_mod

    findings = pr_mod.check_content(title, body, labels, head_ref=head, state="open", draft=False)
    fails = [f for f in findings if f.severity.name == "FAIL"]
    for f in findings:
        print(f"{f.severity.name}\t{f.message}")
    if fails:
        print("闸门: 校验 FAIL，拒绝创建。修正后重试。")
        _log("PR_CREATE", title[:40], "REJECT", f"FAIL={len(fails)}")
        return 1

    print("闸门: 检查通过，执行 gh ...")
    rc, out, err = _run_gh(["pr", "create"] + args)
    if out: print(out)
    if err: print(err, file=sys.stderr)
    if rc != 0: return rc

    url = out.strip()
    if url.startswith("https://github.com/") and "/pull/" in url:
        num = url.split("/pull/")[1].split("/")[0]
        if num and repo:
            proc = subprocess.run(
                [sys.executable, str(githooks / "github" / "pull_requests.py"), repo, num],
                capture_output=True, text=True, timeout=30,
            )
            if "FAIL" in proc.stdout:
                print(f"FAIL\tPR #{num} 创建后校验 FAIL，修正后重跑")
                _log("PR_CREATE", f"PR #{num}", "POST_FAIL", "")
            else:
                print(f"INFO\tPR #{num} 创建后校验 ALL PASS")
                _log("PR_CREATE", f"PR #{num}", "CREATED", title[:40])
    return 0


def _auto_link_sub(url: str, repo: str, githooks: Path, parent_arg: str) -> None:
    """创建后自动挂载 sub-issue 到 parent。"""
    from lib._shared import load_yaml
    cfg = load_yaml(githooks / "spec" / "github_issues.yaml")
    if not cfg.get("sub_issue_must_link_parent", False):
        return
    parent = parent_arg or str(cfg.get("default_parent_issue", 0))
    if not parent or parent == "0":
        return
    sub_num = url.split("/issues/")[1].split("/")[0]
    try:
        _, sub_id_raw, _ = _run_gh(["api", f"repos/{repo}/issues/{sub_num}", "--jq", ".id"])
        sub_id = json.loads(sub_id_raw)
        rc2, out2, _ = _run_gh(["api", f"repos/{repo}/issues/{parent}/sub_issues",
                                 "-X", "POST", "-F", f"sub_issue_id={sub_id}"])
        if rc2 == 0:
            print(f"INFO\t#{sub_num} 已挂载到 parent #{parent}")
        else:
            print(f"WARN\t挂载 #{sub_num} → parent #{parent}: {out2.strip()}")
    except Exception as e:
        print(f"WARN\t挂载失败: {e}")


def _derive_repo() -> str:
    try:
        out = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
        for prefix in ("https://github.com/", "git@github.com:", "ssh://git@github.com/"):
            if out.startswith(prefix):
                return out[len(prefix):].removesuffix(".git")
    except Exception:
        pass
    return ""


def _passthrough(args: list[str]) -> int:
    """透传所有参数到真实 gh。"""
    rc, out, err = _run_gh(args)
    if out: sys.stdout.write(out + "\n")
    if err: sys.stderr.write(err + "\n")
    return rc


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _section(body: str, heading: str) -> str:
    """Extract body text under a ## heading."""
    m = re.search(rf"^## {re.escape(heading)}\s*$", body, re.MULTILINE)
    if not m:
        return ""
    rest = body[m.end():]
    nxt = re.search(r"^## ", rest, re.MULTILINE)
    return rest[: nxt.start()] if nxt else rest


def _check_done_when_fully_ticked(body: str, heading: str = "Done when") -> tuple[bool, list[str]]:
    """检查 Done when 段是否全部勾选。返回 (是否全部勾选, 未勾选的项列表)。"""
    sec = _section(body, heading)
    unticked: list[str] = []
    for line in sec.splitlines():
        m = re.match(r"^\s*-\s*\[\s\]\s*(.+)", line)
        if m:
            unticked.append(m.group(1).strip())
    return len(unticked) == 0, unticked


def _intercept_issue_close(args: list[str]) -> int:
    """拦截 issue close：--comment 理由 + Done when 全勾 + epic 检查 sub 全关。"""
    has_comment = any(a.startswith("--comment") or a == "-c" for a in args)
    if not has_comment:
        print("闸门: gh issue close 必须带 --comment 说明关闭原因，例如：")
        print('  gh issue close <N> --comment "Agent 🤖 - Note: 原因说明"')
        _log("ISSUE_CLOSE", "?", "REJECT", "missing --comment")
        return 1

    issue_num = issue_repo = None
    for a in args:
        if a.isdigit():
            issue_num = a
            break
    repo = _derive_repo()
    if issue_num and repo:
        # 获取 issue 详情（含 labels 和 body）
        rc, data, _ = _run_gh(["api", f"repos/{repo}/issues/{issue_num}", "--jq", "{body, labels: [.labels[].name], state}"])
        if rc == 0 and data:
            import json as j
            d = j.loads(data)
            body = d.get("body", "")
            labels = d.get("labels", [])

            # GT-06: epic 关闭前检查所有 sub-issues 已关闭
            if "epic" in labels:
                rc2, subs_json, _ = _run_gh(["api", f"repos/{repo}/issues/{issue_num}/sub_issues", "--jq", ".[].number"])
                if rc2 == 0 and subs_json.strip():
                    open_subs = []
                    for sn in subs_json.strip().split():
                        if sn.isdigit():
                            rc3, st, _ = _run_gh(["api", f"repos/{repo}/issues/{sn}", "--jq", ".state"])
                            if rc3 == 0 and st.strip() == "open":
                                open_subs.append(sn)
                    if open_subs:
                        print(f"闸门: #{issue_num} 是 epic，但有 sub-issue 未关闭: #{', #'.join(open_subs)}")
                        print("必须全部 sub-issue 关闭后才能关闭 epic。")
                        _log("ISSUE_CLOSE", f"#{issue_num}", "REJECT", f"epic with open subs: {open_subs}")
                        return 1

            # GT-04: Done when 全勾检查
            all_ticked, unticked = _check_done_when_fully_ticked(body)
            if not all_ticked:
                print(f"闸门: #{issue_num} Done when 未全部勾选，未勾 {len(unticked)} 项：")
                for item in unticked[:5]:
                    print(f"  - [ ] {item}")
                print("必须验证全部完成后打钩，再关闭。")
                _log("ISSUE_CLOSE", f"#{issue_num}", "REJECT", f"Done when {len(unticked)} unticked")
                return 1

    rc, out, err = _run_gh(["issue", "close"] + args)
    if out: print(out)
    if err: print(err, file=sys.stderr)
    if rc == 0:
        _log("ISSUE_CLOSE", f"#{issue_num}", "CLOSED", "")
    return rc

def _intercept_pr_merge(args: list[str]) -> int:
    """拦截 pr merge：--body 理由 + checkbox 全勾 + Fixes issue 的 Done when 全勾。"""
    has_body = any(a.startswith("--body") or a == "-b" for a in args)
    if not has_body:
        print("闸门: gh pr merge 必须带 --body 说明合并原因，例如：")
        print('  gh pr merge <N> --squash --body "Agent 🤖 - Merge: 原因说明"')
        _log("PR_MERGE", "?", "REJECT", "missing --body")
        return 1

    pr_num = None
    for a in args:
        if a.isdigit():
            pr_num = a
            break
    repo = _derive_repo()
    if pr_num and repo:
        rc, body, _ = _run_gh(["api", f"repos/{repo}/pulls/{pr_num}", "--jq", ".body"])
        if rc == 0 and body.strip():
            # 检查 PR 内 checkbox 全勾
            for section_name in ["Construction plan", "Checklist"]:
                all_ticked, unticked = _check_done_when_fully_ticked(body.strip(), section_name)
                if not all_ticked:
                    print(f"闸门: PR #{pr_num} {section_name} 未全部勾选，未勾 {len(unticked)} 项：")
                    for item in unticked[:5]:
                        print(f"  - [ ] {item}")
                    print("必须全部完成打钩后，再合并。")
                    _log("PR_MERGE", f"PR #{pr_num}", "REJECT", f"{section_name} {len(unticked)} unticked")
                    return 1

            # 检查 Fixes 关联 issue 的 Done when（merge 会连带关闭 issue）
            import re as _re
            fixes = _re.findall(r"(?:Fixes|Closes|Resolves)\s+#(\d+)", body.strip())
            for fn in fixes:
                rc2, issue_body, _ = _run_gh(["api", f"repos/{repo}/issues/{fn}", "--jq", ".body"])
                if rc2 == 0 and issue_body.strip():
                    all_ticked, unticked = _check_done_when_fully_ticked(issue_body.strip())
                    if not all_ticked:
                        print(f"闸门: PR #{pr_num} 关联 issue #{fn} 的 Done when 未全部勾选，未勾 {len(unticked)} 项：")
                        for item in unticked[:5]:
                            print(f"  - [ ] {item}")
                        print("合并 PR 会连带关闭 issue，必须先完成 issue 的 Done when 再合并。")
                        _log("PR_MERGE", f"PR #{pr_num}", "REJECT", f"issue #{fn} Done when {len(unticked)} unticked")
                        return 1

    # GT 增强: squash 标题（--title 或 PR 标题）必须符合 conventional commit（CM-01/CM-02 同款）
    import re as _re
    merge_title = ""
    for i, a in enumerate(args):
        if a == "--title" and i + 1 < len(args):
            merge_title = args[i + 1]
            break
        if a.startswith("--title="):
            merge_title = a.split("=", 1)[1]
            break
    if not merge_title and pr_num and repo:
        rc3, pr_title, _ = _run_gh(["api", f"repos/{repo}/pulls/{pr_num}", "--jq", ".title"])
        if rc3 == 0:
            merge_title = pr_title.strip()
    if merge_title:
        if not _re.match(r"^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:\s+\S+", merge_title):
            print(f"闸门: merge 标题非 conventional commit 格式: '{merge_title}'")
            print("  示例: feat: add widget / fix(scope): correct bug")
            _log("PR_MERGE", f"PR #{pr_num}", "REJECT", f"title not CC: {merge_title[:60]}")
            return 1
        if _re.search(r"[\u4e00-\u9fff]", merge_title):
            print(f"闸门: merge 标题含 CJK（应为英文）: '{merge_title}'")
            _log("PR_MERGE", f"PR #{pr_num}", "REJECT", f"title CJK: {merge_title[:60]}")
            return 1

    # 提取合并理由
    merge_reason = ""
    for i, a in enumerate(args):
        if a in ("--body", "-b") and i + 1 < len(args):
            merge_reason = args[i + 1]
            break
        if a.startswith("--body="):
            merge_reason = a.split("=", 1)[1]
            break

    rc, out, err = _run_gh(["pr", "merge"] + args)
    if out: print(out)
    if err: print(err, file=sys.stderr)
    if rc != 0:
        _log("PR_MERGE", f"PR #{pr_num}", "FAIL", err.strip() or "")
        return rc

    # 清理本地分支（merge 成功后；远程删除仅提示需用户确认）
    if pr_num and repo:
        rc4, head_ref, _ = _run_gh(["api", f"repos/{repo}/pulls/{pr_num}", "--jq", ".head.ref"])
        if rc4 == 0:
            head = head_ref.strip()
            if head and head not in ("main", "master", "develop"):
                subprocess.run(["git", "branch", "-d", head],
                               capture_output=True, timeout=10)
                print(f"提示: 本地分支 '{head}' 已删除。远程删除执行:")
                print(f"  git push origin --delete {head}")

    # 合并后 PR conversation 留言 + 日志
    if pr_num and merge_reason:
        rc2, out2, err2 = _run_gh(["pr", "comment", pr_num, "--body", merge_reason])
        if rc2 == 0:
            print(f"INFO\tPR #{pr_num} 合并留言已发布")
        else:
            print(f"WARN\tPR #{pr_num} 合并留言失败: {err2.strip() or out2.strip()}")
    _log("PR_MERGE", f"PR #{pr_num}", "MERGED", merge_reason[:80])
    return rc


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "--install":
        return _install()
    if len(sys.argv) >= 2 and sys.argv[1] == "--uninstall":
        return _uninstall()

    if len(sys.argv) >= 3:
        cmd = sys.argv[1:3]
        rest = sys.argv[3:]
        if cmd == ["issue", "create"]:
            return _intercept_issue_create(rest)
        if cmd == ["issue", "close"]:
            return _intercept_issue_close(rest)
        if cmd == ["pr", "create"]:
            return _intercept_pr_create(rest)
        if cmd == ["pr", "merge"]:
            return _intercept_pr_merge(rest)

    return _passthrough(sys.argv[1:])

if __name__ == "__main__":
    sys.exit(main())
