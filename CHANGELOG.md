# Changelog

## 2026-06-20

- 新增 DR-64 relay entry：接受 `deeprouter.skill_id`，從 auth context 解析用戶身份，返回 `SkillRelayContext` 供下游 DR-67/DR-88 使用 (`internal/skill/relay/`, `relay/compatible_handler.go`, `dto/deeprouter_extension.go`)
- 新增 `enums.EntryPointSkillPackage = "skill_package"` 供 relay 和 download 路徑共用 (`internal/skill/enums/`)
- 新增 `SkillRelayContext.EntryPoint` 字段，relay 入口設置 entry_point 供 DR-88 analytics 使用 (`internal/skill/relay/context.go`)
