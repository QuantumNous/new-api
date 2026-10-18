# 设计：隔离的 rc.44 合并

## 边界和来源

- 在本 worktree 从 `origin/feat/partner-oauth` (`a1342d5bb`) 创建 `feat/partner-oauth-audit-rc44`，不切换或修改另一个已经检出 `feat/partner-oauth` 的 worktree。
- 合并 `upstream` tag `v1.0.0-rc.44` (`633b4c5b1`)，保留双亲 merge commit；不合并当前的 `upstream/main`，不推送 `origin/main`。
- 此提交只含上游代码及必要的冲突协调/对应测试修复；授权日志的表、接口、页面必须在后续独立功能提交。

## 冲突处理原则

- 以共同祖先和两侧语义对照，不机械取 ours/theirs；保留 fork 专属认证、返现、计费、推广域名、桌面 API 和部署约束，同时引入 rc.44 兼容更新。
- `AGENTS.md`/`CLAUDE.md` 以 fork 规则为基础合并上游新增约束，保留受保护的 new-api / QuantumNous 引用和署名。
- 数据库、会话、OAuth、计费及翻译是高风险组。每组记录冲突决策与关联测试。涉及计费代码遵守 `.agents/rules/billing.md`；涉及 fork 模块先读对应 spec；前端翻译使用项目 i18n 技能的脚本流程，避免漏语言或带冲突标记。
- 如果上游新增的数据库变更影响模型/迁移，按 SQLite/MySQL/PostgreSQL 真实容器矩阵评估；不得仅凭编译称兼容。

## 交付和回退

- `git merge --no-ff --no-commit v1.0.0-rc.44` 后逐文件消除冲突，审查最终差异/冲突标记；在生成 merge commit 前运行必要验证。
- 合并失败或语义无法证明时保持未提交并报告阻塞，不用 `-X ours` 整体吞掉上游；必要时 `git merge --abort` 回到新分支起点，不丢弃原有未追踪文件。
- 提交需有两个父提交且在授权日志功能提交之前；后续功能提交单独验证/提交。任何提交及推送都遵守工作流的审查门槛。
