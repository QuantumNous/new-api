# .githooks 规范总览

```
.githooks/
├── hooks/                     # git hooks 入口（core.hooksPath = .githooks/hooks）
│   ├── pre-commit            # git commit 钩子（CM-01/02/03 + workspace + code）
│   ├── pre-push              # git push 钩子（workspace + code）
│   └── merge                 # 合并入口（手动跑：PR + reviews + cleanup + CRG + ocr）
├── lib/                       # 共享模块（PEP 420 命名空间包，无 __init__.py）
│   └── _shared.py            # gh_api / Finding / load_yaml / run_external
├── dev/                       # 开发工具（PEP 420 命名空间包）
│   ├── audit.py              # 批量检查/打钩/并发扫描（--recent=N --limit --workers，供 CI）
│   └── ocr_review.py         # 本地审查：CRG 结构分析 + ocr AI 审查（--post/--post-inline）
├── install_gh_gate.py         # 拦截门安装脚本（部署到 ~/.local/bin/gh）
├── spec/                      # 规则配置（改规则只改这里，不改 .py）
│   ├── dispatch.yaml          # 钩子→主题映射（哪个钩子跑哪些检查）
│   ├── github_issues.yaml     # Issue 规则（IS-* 检查项）
│   ├── github_pull_requests.yaml  # PR 规则（PR-* 检查项）
│   ├── github_reviews.yaml    # Review 评论格式（RV-* 检查项）
│   ├── code_{rust,go,javascript,typescript,python,bash}.yaml  # 六语言 lint
│   ├── workspace_{tree_hygiene,file_placement}.yaml           # 工作区检查
│   ├── cleanup_branch_cleanup.yaml  # 分支清理
│   ├── cleanup_tests_{rust,go,javascript,bash}.yaml           # 测试代码检查
│   └── cleanup_docs_hygiene.yaml    # 文档清洁
├── github/                    # GitHub 校验器（规则实现，含 check_content 供 gh-gate 复用）
│   ├── issues.py            # Issue 校验（IS-01 ~ IS-16）
│   ├── pull_requests.py     # PR 校验（PR-01 ~ PR-12，非 review 部分）
│   └── reviews.py           # Review 校验（RV-01 ~ RV-06）
├── code/lint.py               # 六语言 lint 分发器（读 code_*.yaml）
├── workspace/                 # 工作区检查
│   ├── tree_hygiene.py      # 目录整洁（空目录/深度/单文件/孤儿）
│   └── file_placement.py    # 文件位置合理性（ignore_paths 含 .githooks/）
├── cleanup/                   # 清理检查
│   ├── branch_cleanup.py    # 分支清理（merged/orphan/temp）
│   ├── tests_check.py       # 测试代码检查（命名/断言/helper）
│   └── docs_hygiene.py      # 文档清洁（全角括号/死链/空文件/CRLF）
├── tests/                     # 单元测试（127 个）
├── GITHUB_ISSUE_PR.md         # Issue/PR 创建指南（含关联机制）
├── PR_DEV_WORKFLOW.md         # PR 开发工作流指南（含 CRG + ocr 审查流程）
└── SPEC_OVERVIEW.md           # 本文件（规范总览）

项目根：
├── AGENTS.md                  # Agent 行为规范（创建前读 gh-gate）
├── pytest.ini                 # pytest 配置（禁用缓存）
├── ruff.toml                  # ruff 配置（缓存重定向到 /tmp）
└── .github/workflows/daily_audit.yml  # 每日合规检查（最近 1 天，有 FAIL 自动建 issue）
```

### 外部工具依赖（复用其他项目时需安装）

- `code-review-graph`（CRG）：结构分析/变更影响检测（`detect-changes --brief --base main`）
- `ocr`（OpenCodeReview CLI）：AI 代码审查（`review --format json --audience agent`）
- `gh`（GitHub CLI）：所有 GitHub API 操作入口

## 本文档用途

本文档是 `.githooks/` 全部检查规则的**唯一总览**，供人/agent 对照审查：

- 列出每个主题（GitHub / Code / Workspace / Cleanup / 拦截门 / 钩子）的全部规则、实现位置、严重度、触发时机
- 规则**只**在 `.githooks/spec/*.yaml`（参数）和对应校验器（逻辑）两处，改规则只改 spec，校验器自动读取
- **新增/修改规则后必须更新本文档**；merge 时校验 spec 与本文档一致性（见文末"更新与校验"）
- 规则编号采用**主题前缀 + 连续编号**（IS/PR/RV/GT/CD/WS/CL/CM），旧编号不再使用
- commit 标题规则 CM-01/02/03 实现在 pre-commit（非 spec），语义与 PR-01/PR-02 对齐

## 主题一：GitHub（github/）

### Issue 规则（IS-01 ~ IS-16）

- IS-01 必填段完整性（Goal/Background/Done when/Suspected areas/Out of scope/How to observe success）— FAIL
- IS-02 Suspected areas 非空 — WARN
- IS-03 body 聚焦（多 H1 提示）— WARN
- IS-04 Done when 必须 checkbox、禁 table — FAIL
- IS-05 标题中文 — FAIL
- IS-06 heading 英文 — FAIL
- IS-07 正文中文 — FAIL
- IS-08 反引号路径存在性 — WARN
- IS-09 sub 禁 cross-reference（Depends on/Blocks/Related #/Parent PR）— FAIL
- IS-10 sub 禁 PR 占位符 — FAIL
- IS-11 parent 禁 Done when — FAIL
- IS-12 parent 必须有 native sub-issues — FAIL
- IS-13 Implementation Order 可选且与 native sub-issues 一致 — FAIL/INFO
- IS-14 label 存在性 + type label — FAIL
- IS-15 关闭时 Done when 全勾（关闭前检查）— FAIL
- IS-16 标题全角括号、禁词、乱码 — FAIL

实现位置：`.githooks/github/issues.py` check_content（纯内容）+ run（API 检查 I-12/I-15 等）

### PR 规则（PR-01 ~ PR-12）

- PR-01 标题英文（禁 CJK）— FAIL
- PR-02 Conventional Commit 格式 — WARN
- PR-03 必填 body 段完整性 — FAIL
- PR-04 heading 英文、What 段中文 — FAIL/WARN
- PR-05 一个 PR 一个主 issue（Fixes 数量）— WARN/FAIL
- PR-06 label 存在性 + type label — FAIL
- PR-07 Construction plan/Checklist 至少 2 个 checkbox — FAIL
- PR-08 分支前缀合法 — FAIL
- PR-09 维护者审查存在 — WARN
- PR-10 关联机制：Part of/Related 是纯文本不产生关联（INFO）；Fixes #N 目标是 parent issue（epic）时提示用 sub-issue 层级链（WARN）— check_content + run
- PR-11 合并前 PR 内 checkbox 全勾（merge 时检查）— FAIL
- PR-12 合并留言理由（merge 时必须 --body）— FAIL

实现位置：`.githooks/github/pull_requests.py` check_content + run

### Review 规则（RV-01 ~ RV-06）

- RV-01 禁 checkbox — FAIL
- RV-02 reply 用词合法（Fix/Block/Resolve/Note/Withdraw/Supersede）— WARN
- RV-03 reply 详细程度 — WARN
- RV-04 CRG/Inline Review 前缀格式 — FAIL
- RV-05 CRG Review 存在 — FAIL
- RV-06 inline findings 有回复 — WARN

实现位置：`.githooks/github/reviews.py`

## 主题二：Code（CD-01 ~ CD-06）

- CD-01 rust：cargo fmt --check（spec/code_rust.yaml）
- CD-02 go：gofmt -l（spec/code_go.yaml）
- CD-03 javascript：eslint（spec/code_javascript.yaml）
- CD-04 typescript：npx tsc --noEmit（spec/code_typescript.yaml）
- CD-05 python：ruff check --no-cache（spec/code_python.yaml）
- CD-06 bash：shellcheck（spec/code_bash.yaml）

工具缺失 → WARN 跳过（优雅降级）。公共字段：enabled/command/args/fail_severity/paths_include/paths_exclude。

实现位置：`.githooks/code/lint.py`

## 主题三：Workspace（WS-01 ~ WS-02）

- WS-01 tree_hygiene：空目录、单文件目录、深度 > max_depth、孤儿目录（spec/workspace_tree_hygiene.yaml）— WARN
- WS-02 file_placement：forbidden_patterns（src/*_test.rs 等）、expected_locations（test_*.py → tests/、*.sh → bin/）（spec/workspace_file_placement.yaml）— WARN

实现位置：`.githooks/workspace/tree_hygiene.py` + `file_placement.py`

## 主题四：Cleanup（CL-01 ~ CL-03）

- CL-01 branch_cleanup：merged/orphan/temp 分支清理，dry-run 默认（spec/cleanup_branch_cleanup.yaml）— WARN
- CL-02 tests_check：四语言测试命名/断言/helper（spec/cleanup_tests_*.yaml）— WARN
- CL-03 docs_hygiene：全角括号/死链/遗留标记/空文件/CRLF（spec/cleanup_docs_hygiene.yaml）— WARN

实现位置：`.githooks/cleanup/`

## 主题五：拦截门（GT-01 ~ GT-07）

- GT-01 issue create 前校验（调 IS-*，FAIL 拒）；支持 `--disable-check` 逃生门（跳过校验但记 BYPASS 日志 + 终端警告，防滥用）— 触发：gh issue create
- GT-02 pr create 前校验（调 PR-*，FAIL 拒）— 触发：gh pr create
- GT-03 sub 自动挂载 parent（spec.sub_issue_must_link_parent）— 触发：gh issue create
- GT-04 issue close 前 Done when 全勾 + 必须 --comment 理由 — 触发：gh issue close
- GT-04b issue close 前必须有 PR 关联（timeline cross-referenced 事件检查 PR，无则 REJECT + 日志 "no linked PR"）— 触发：gh issue close
- GT-05 pr merge 前 PR checkbox 全勾 + 关联 Fixes issue 的 checkbox 全勾 + 必须 --body 理由 + **squash 标题（--title 或 PR 标题）必须符合 CM-01/CM-02** — 触发：gh pr merge
- GT-06 epic close 前所有 sub-issues 已关闭 — 触发：gh issue close（epic）
- GT-07 merge 后自动在 PR 留言（含理由）+ **自动删除本地 head 分支（git branch -d 安全模式），远程删除仅提示需用户确认** — 触发：gh pr merge
- RV-07 有文件改动的 PR merge 前必须 CRG + ocr 审查（失败 FAIL 阻塞）；无文件改动跳过并说明 — 触发：hooks/merge

实现位置：`.githooks/install_gh_gate.py`（安装到 ~/.local/bin/gh；改动后需重跑 --install）

## 主题六：钩子调度（spec/dispatch.yaml）

- pre-commit `git commit` — CM-01/CM-02/CM-03（commit 标题格式/CJK/与关联 PR type 一致）+ workspace（WS-*）+ code（CD-*）
- pre-push `git push` — workspace + code（cargo 不传 target、ruff 排除 .githooks、file_placement 忽略 .githooks/）
- merge 手动 `python .githooks/hooks/merge` — 全量（PR + reviews + cleanup + CRG + ocr）

### Commit 标题规则（CM-01 ~ CM-03）

- CM-01 commit 标题必须 conventional commit 格式（feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert）— FAIL
- CM-02 commit 标题禁 CJK（应为英文，同 PR-01）— FAIL
- CM-03 分支有关联 open PR 时，commit 标题 type 必须与 PR 标题 type 一致（gh api 获取 PR 标题，失败/无 PR 跳过不阻塞）— FAIL

实现位置：`.githooks/hooks/pre-commit`（非 spec；CM-03 调 gh api REST + 短超时）

## 主题七：每日合规检查（GitHub Actions）

- `.github/workflows/daily_audit.yml`：每天 UTC 0:30 自动跑 `audit.py --recent=1`（检查最近 1 天创建的 issue/PR，逐个跑 issues.py/pull_requests.py 完整规则）
- 有 FAIL → 自动创建 issue 记录（标题带日期、body 列违规清单、label chore）；全部 PASS → 无动作
- 支持 workflow_dispatch 手动触发

实现位置：`.githooks/dev/audit.py` scan_recent + `.github/workflows/daily_audit.yml`

## 主题八：本地审查（CRG + ocr）

`dev/ocr_review.py` 整合 CRG 结构分析 + ocr AI 审查，以 ocr 为主。

### CRG 结构分析（`code-review-graph detect-changes --brief --base main`）

```json
{
  "summary": "Analyzed N changed file(s): …",
  "risk_score": 0.0,
  "review_priorities": ["path/to/file.py"],  // 高优先级文件（ocr 重点审查）
  "changed_functions": [{"name": "fn", "file": "path"}],
  "affected_flows": [{"name": "flow", "risk": "high"}],
  "test_gaps": []
}
```

- `risk_score`：0.0（低）~ 1.0（高）— 整体变更风险
- `review_priorities`：重点审查文件列表（CRG 建议 ocr 优先关注的）

### ocr AI 审查（`ocr review --format json --audience agent`）

```json
{
  "comments": [
    {"path": "file.py", "start_line": 42, "severity": "warning",
     "category": "bug", "content": "审查意见"}
  ]
}
```

- `severity`：`critical` / `blocker` / `warning` / `info`
- `category`：`bug` / `security` / `performance` / `style` / `best_practice`

### 审查流程（merge 自动执行 + 手动触发）

1. hooks/merge 自动执行：检测 PR 文件改动数（`repos/{repo}/pulls/{n}/files`）
   - 有改动：必须 CRG 结构分析 + ocr AI 审查（RV-07，失败 FAIL 阻塞 merge）
   - 无改动：跳过审查，输出"无需审查"
2. 审查顺序：CRG 摘要 → ocr 详细发现 → 汇总报告
3. 手动：`python .githooks/dev/ocr_review.py [--post|--post-inline] [--pr N]`
4. 输出：终端（默认）/ PR conversation（--post）/ Files changed inline（--post-inline）

实现位置：`.githooks/dev/ocr_review.py`（依赖外部工具 `code-review-graph` + `ocr`）


## 触发式（lazy）规则映射

只在使用特定 gh 命令 / git 操作时检查对应规则，不全量扫描：

- gh issue create → IS-01~16、GT-01（含 --disable-check 逃生门）、GT-03
- gh issue close → GT-04、GT-04b、GT-06（epic）
- gh pr create → PR-01~10、GT-02
- gh pr merge → PR-11、PR-12、GT-05（含 squash 标题 CM-01/CM-02）、GT-07（含分支清理）、RV-01~06
- gh pr comment → RV-01~06
- git commit → CM-01、CM-02、CM-03、WS-01、WS-02、CD-01~06
- git push → WS-01、WS-02、CD-01~06
- merge 手动 → 全量
- CI 每日（daily_audit.yml）→ 最近 1 天创建的 issue/PR 全规则

## 更新与校验

- 新增/修改规则：只改 `.githooks/spec/*.yaml` 参数 + 对应校验器逻辑，更新本文档
- merge 时校验：spec 规则与本文档一致性（通过 `python .githooks/dev/audit.py` 或校验器检测）
- 触发式按上表 lazy 执行，不全局扫描
- 拦截门（install_gh_gate.py）改动后必须 `python .githooks/install_gh_gate.py --install` 重新部署
