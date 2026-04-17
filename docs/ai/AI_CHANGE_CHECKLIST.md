# AI 提交前检查清单

> 每次准备提交或创建 PR 前，AI 与人工都必须按本清单逐项确认。

这样做符合 `DRY`，直接收益是把分散在提示词、规范和 PR 模板里的要求收敛成统一核对清单，减少漏项。

## 通用检查

- [ ] 已阅读并遵守 `AGENTS.md`
- [ ] 已按 `AI_TASK_TEMPLATE.md` 给出任务目标、范围、不做什么和验证方式
- [ ] 本次改动聚焦当前任务，没有夹带无关修改
- [ ] 所有新增 / 修改文件均为 UTF-8（无 BOM）
- [ ] 提交说明为人工整理后的中文摘要，而不是原样粘贴 AI 输出

## 后端检查

- [ ] 未在业务代码中直接使用 `encoding/json`
- [ ] `go test` 至少覆盖被改包
- [ ] 若涉及分层边界，未把逻辑错误地下沉 / 上浮到不合适层次

## 数据库 / DTO 检查

- [ ] 数据库相关改动已考虑 SQLite / MySQL / PostgreSQL 兼容
- [ ] 原始 SQL 已检查方言差异和保留字差异
- [ ] Relay / DTO 可选标量字段使用指针以保留显式零值

## 前端检查

- [ ] `web/` 相关命令统一使用 `bun`
- [ ] 已运行 `bun run lint`
- [ ] 已运行 `bun run eslint`
- [ ] 已运行 `bun run build`

## i18n 检查

- [ ] 若涉及用户可见文案，已确认是否需要更新 locale 文件
- [ ] 已运行 `bun run i18n:lint`

## Docker / Compose 检查

- [ ] 若改动 `docker-compose.yml`，已验证配置合法
- [ ] 若改动 `Dockerfile`，已验证构建配置没有被破坏
- [ ] 若改动 `.env.example`，示例格式和变量说明仍然有效

## Upstream 同步检查

- [ ] 同步官方更新的改动与业务功能改动已分离
- [ ] 已遵守 `docs/ai/UPSTREAM_SYNC_RULES.md`
