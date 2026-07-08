---
status: current
owner: Dev Team
last-reviewed: 2026-07-07
---

# AI 编码指南

## Before Any Task
1. 读 AGENTS.md 与 docs/README.md。
2. 读 docs/00-context/硬约束.md（硬约束，不可违反）。
3. 改架构前读 docs/20-architecture/架构概览.md。
4. 新建文档前先读目标目录的 README.md，确认放对位置。

## Verification
- 后端改动：跑与改动范围匹配的 Go 测试。
- 前端改动：在 `web/default/` 下优先使用 Bun 运行对应检查。
- 文档改动：跑 `task docs:check`。

## Boundaries
- 只改与任务相关的代码，不顺手重构。
- 不修改受保护的项目身份、组织身份、授权和版权归属信息。
- 不改变 AI 辅助入口文件，除非用户明确要求。
- 重大架构决策必须新增 ADR。
- 编码过程临时问题分析/方案放 `docs/80-dev/`；每日结束前把已确认且具备架构影响的结论抽取更新到 `docs/20-architecture/`。
- `docs/80-dev/` 草稿文件必须以 `YYYY-MM-DD-` 开头；沉淀为长期工程实践才进入 `docs/30-engineering/`。

## Review Checklist（完成任务前自检）
- [ ] 改了架构，是否补了 ADR？
- [ ] 改了硬约束，是否更新 `docs/00-context/硬约束.md`？
- [ ] 新增文档是否放对了目录（对照该目录 README）？
- [ ] 新增 `80-dev/` 草稿是否使用 `YYYY-MM-DD-` 日期前缀？
- [ ] `80-dev/` 中已确认或已实施的架构影响结论，是否已同步到 `20-architecture/`？
- [ ] 跑通必要检查？
