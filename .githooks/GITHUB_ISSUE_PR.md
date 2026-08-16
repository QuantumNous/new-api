# GitHub Issue/PR 指南

本指南指导 agent 创建、更新、关联 GitHub issue/PR。
检查由 `.githooks/` 强制（install_gh_gate.py 安装后 ~/.local/bin/gh 自动拦截 + issues.py/pull_requests.py 校验）。
本文件只讲怎么做，规则见 `.githooks/SPEC_OVERVIEW.md`。

## 创建前必读

- `.githooks/install_gh_gate.py --install` — 安装 gh 拦截门（自动创建 `~/.local/bin/gh`）
- 安装后 `gh issue create` / `gh pr create` 自动走校验（禁止绕过）
- `.github/ISSUE_TEMPLATE/` — 选模板：`task.yml` / `feature.yml` / `bug.yml`
- `.github/PULL_REQUEST_TEMPLATE.md` — PR 正文结构
- `gh label list` — 确认 label 真实存在于仓库

## 创建流程

```bash
# 安装拦截门（如有更新）
python .githooks/install_gh_gate.py --install

# 创建 issue（自动走校验，FAIL 拒绝）
gh issue create --title "<中文标题>" --body "<模板正文>" --label <epic|sub|bug|enhancement|chore>

# 创建 PR（自动走校验，FAIL 拒绝）
gh pr create --title "feat(scope): desc" --body "<模板正文>" --head <分支>
```

## PR 与 issue 的关联机制

GitHub 只认两种真实关联（Development 面板显示）：

1. **closing keyword**：PR body 中写 `Fixes #N` / `Closes #N` / `Resolves #N`（N 必须已存在）。**PR body 保存时实时扫描**——创建后编辑 body 重新保存会触发重新扫描建立关联。**只对普通 issue 生效**；parent issue（epic）的 Development 面板不显示 closing keyword 关联。
2. **UI 手动 link**：issue/PR 页面右侧 Development 面板手动关联（唯一能让 epic 侧显示 PR 的方式，产生 connected 事件）。无 API/CLI 替代。

**关联 epic 的正确姿势（层级链）**：

```bash
# PR body 写 Fixes 一个 sub-issue（不要写 Fixes epic）
Fixes #152        # sub-issue
# #152 是 epic #150 的 sub-issue → PR → #152 → #150 链路成立
```

不要直接 `Fixes #150`（epic）：会试图关闭 epic（epic 只能等 sub 全关后关闭），且 epic 侧 Development 面板不显示。`Part of #N` / `Related #N` 只是纯文本，不产生任何 GitHub 关联。

**issue 创建顺序**：issue 先建、PR 后建为标准流程（创建 PR 时 Fixes 立即关联）；PR 先建、issue 后建需编辑一次 PR body 触发重新扫描。

## 创建后校验

```bash
python .githooks/github/issues.py <owner/repo> <#N>
python .githooks/github/pull_requests.py <owner/repo> <#N>
python .githooks/hooks/merge <owner/repo> <#N> --dry-run
```

## 本地审查

```bash
python .githooks/dev/ocr_review.py                     # CRG 结构分析 + ocr AI 审查
python .githooks/dev/ocr_review.py --post-inline       # 审查结果→PR inline review
```

## 参考

- 规则总览：`.githooks/SPEC_OVERVIEW.md`
- 工作流指南：`.githooks/PR_DEV_WORKFLOW.md`
- 钩子配置：`.githooks/spec/dispatch.yaml`