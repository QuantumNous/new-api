<!--
填写规范：
- PR 标题必须使用 Conventional Commits 格式：`<type>(<scope>): <description>`，例如 `fix(web): correct token refresh flow`。类型与 GitHub 类型/区域 label 对应：`feat`、`fix`、`chore`、`refactor`、`docs`、`test`、`perf`。该标题会作为 squash merge 的 commit message。
- PR 正文结构使用英文 heading，正文内容使用中文。
- 一个 PR 对应一个主要 Issue；使用 `Fixes #N` 关闭主 Issue，使用 `Related #N` 或 `Part of #N` 关联更大的工作。
- 不要直接推送或合并到 `main`。
- diff 必须聚焦，所有变更路径都必须能由主 Issue 解释。
- 不要包含密钥、真实配置、生产环境信息、生成垃圾或无关格式化。
- 只有适用时才复制额外区块，不要发布空的额外标题。
-->

**开始前：** 从当前 `main` 创建分支，搜索已有 Issue 和 PR；每个 PR 只解决一个主要结果；验证步骤必须让评审者可以复现。

## What

<!-- 合并后会发生什么变化？正文请用中文填写。 -->

## Why

<!-- 为什么要做？根因、背景或已经确认的设计决策。正文请用中文填写。 -->

## Issue

<!-- 主 Issue：使用 `Fixes #N`，合并后自动关闭。正文请用中文填写。 -->
Fixes #

<!-- 可选：关联或父 Issue。 -->
Related #

## Construction plan

<!-- 实际完成的最小实现或文档步骤，正文请用中文填写。 -->
- [ ]

## Delivery record

<!-- 完成后填写，正文请用中文填写。 -->
- Delivered:
- Verification:
- Follow-up: none | #

## How to test

<!-- 评审者可以执行的命令或手动步骤，正文请用中文填写。 -->
1.

```text
# commands run, if any
```

## Checklist

- [ ] 已使用 `Fixes #N` 关联一个主 Issue。
- [ ] 已使用正确的英文类型 label：`bug`、`enhancement` 或 `chore`。
- [ ] 已添加适用的英文区域 label：`backend`、`frontend`、`relay`、`database`、`ci` 或 `documentation`。
- [ ] 没有包含密钥、真实配置、生成垃圾或无关变更。
- [ ] diff 只服务于关联的主 Issue。
- [ ] 已执行上面列出的测试或手动验证；如果不适用，已说明原因。
- [ ] Go 改动已覆盖主 module 和 relaykit module 的相关验证。
- [ ] web 改动已覆盖对应前端构建或浏览器工作流。

<!--
===========================================================================
推荐额外区块：只有适用时才复制完整区块。

## Screenshots
适用场景：仅靠 diff 无法验证的 UI/UX 变化。
- Before:
- After:

## Risk
适用场景：迁移、数据结构变化、难以回滚的行为或安全敏感路径。
- Risk: low / medium / high
- Migration or configuration:
- Revert by reverting this PR? yes / no

## Changelog
适用场景：用户可见行为或 API 变化需要写入发布说明。
-

## Notes for reviewers
适用场景：非直观边界、刻意延后的工作或希望评审者重点检查的内容。
-
===========================================================================
-->
