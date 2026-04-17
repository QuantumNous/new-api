# CLAUDE.md — Claude 入口适配说明

Claude 在当前仓库中工作时，必须先阅读并严格遵守以下文件：

1. `AGENTS.md`
2. `docs/ai/AI_TASK_TEMPLATE.md`
3. `docs/ai/AI_CHANGE_CHECKLIST.md`
4. `docs/ai/UPSTREAM_SYNC_RULES.md`（仅同步官方更新时）

## Claude 专属约束

- 不要复写或扩展一套与 `AGENTS.md` 平行的规则体系。
- 所有项目规范均以 `AGENTS.md` 为唯一真源。
- 在开始修改前，必须按 `AI_TASK_TEMPLATE.md` 先输出任务摘要。
- 在完成修改后，必须输出原则落地、验证结果、风险与下一步。

这样做符合 `DRY`，直接收益是 Claude 与其他 AI 工具遵循同一套规范，不会出现双份约束和执行偏差。
