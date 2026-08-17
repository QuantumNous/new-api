# PR 开发工作流指南

本指南指导 agent 开发多步 PR 工作（依赖感知、隔离、委派、验证、审查、清理）。
检查由 `.githooks/hooks` 强制（pre-commit/pre-push/merge + review.py 本地审查）。
规则见 `.githooks/SPEC_OVERVIEW.md`。

## 工作流

```
scope → 隔离 → 实现 → 验证 → 审查 → 合并 → 清理
```

## 阶段 0 — 范围与证据

- 读相关 issue/PR、验收标准、模板
- 拆原子步骤：每步一个输出、明确范围、验证命令
- **进度更新 = 编辑 issue 的 Done when checkbox**，不是本地清单

## 阶段 1 — 隔离

- `git worktree add -b <branch> .wt/<name> <base>` 隔离工作
- 依赖工作用前一分支做 base，或用独立分支
- 记录 workspace、branch、HEAD、base

## 阶段 2 — 实现与委派

- 委派前编译 RTCO 简要：角色/任务/约束/上下文/输出结构
- 每个原子步骤用单独 worker，给明确文件范围 + 验收命令
- 委派后独立审查 diff、文件状态、验证输出
- worker 无产出 → 自己接手

## 阶段 3 — 验证与审查

### 本地审查（CRG + ocr）

```bash
gate review              # 终端输出 CRG 影响 + ocr 发现
gate review --post-inline  # 提交到 PR Files changed
```

### 审查评论格式（spec/github_reviews.yaml）

- CRG Review: `## Agent 🤖 - CRG Review: <英文标题>`（H2），子分类 `###`（H3），正文中文
- Inline Review: `Agent 🤖 - Inline Review P0|P1|P2|P3: <内容>`，锚定 path+line
- Reply: `Agent 🤖 - Fix: <原因>` / `Block:` / `Note:` / `Resolve:` / `Withdraw:` / `Supersede:`
- **禁 checkbox**：review 评论中严禁 `- [x]` / `- [ ]`（P-22）

### 修复回复

每条发现必须在原线程回复。格式：
- `Agent 🤖 - Fix: commit SHA 修复了问题。验证：<证明>`
- `Agent 🤖 - Note: 观察项，不阻塞。<原因>`

**无回复的 thread = unresolved，阻塞合并。**

## 阶段 4 — 创建与等待

- `gh pr create` 自动走拦截门校验（install_gh_gate.py）
- 记录 PR URL、base/head、commit、label、CI 状态
- draft PR 合并前需 `gh pr ready`

## 阶段 5 — 合并（merge 前必查）

```bash
# 合并检查：规则校验 + CRG 影响 + ocr 审查
python .githooks/hooks/merge <owner/repo> <N> --dry-run

# 链式 PR：子 PR 先重设 base
gh pr edit <child> --base main

# 合并
gh pr merge <N> --squash
```

merge 入口自动执行：PR 校验 + reviews + cleanup + CRG 结构分析 + ocr AI 审查。

## 阶段 6 — 清理

```bash
python .githooks/cleanup/branch_cleanup.py --dry-run  # 预览
python .githooks/cleanup/branch_cleanup.py --apply     # 确认后执行
```

保护脏的、未合并的、未知的、明确保留的。

## 审查清单

- [ ] 无密钥、私密端点、真实配置、用户数据、生成文件、无关格式化
- [ ] 每个 inline review 线程有回复（修复 commit 或非阻塞说明）
- [ ] gh 拦截门已安装（install_gh_gate.py --install）
- [ ] merge 前跑过 `python .githooks/hooks/merge --dry-run`（含 review）
- [ ] 审查/CI/merge/issue/清理声明有当前证据