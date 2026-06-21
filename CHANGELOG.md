# Changelog

DeepRouter gateway 变更记录。规则见 `AGENTS.md` Rule 10。

## 2026-06-21

- DR-46 (M02) `POST /api/v1/admin/skills`：实现草稿 Skill 创建端点（Super Admin only）。新增 `CreateAdminSkill` handler 及全部辅助函数（`internal/skill/handler/skills.go`），注册 `adminRoute.POST("/skills", ...)` 路由（`router/skill-router.go`），修复 `newSkillTestRouter` 缺失 `platformmodel.DB` 设置导致的路由器 panic（`router/skill-router_test.go`）。Status 强制为 draft、created_by 取自 auth context、slug 唯一性双重校验（COUNT + DB unique constraint → 409）、Free/free-quota 配置缺 `max_input_tokens` → 400 `MAX_INPUT_TOKENS_REQUIRED`；draft 对 marketplace 不可见（DR-46)
- DR-43 review fix — Kids session privacy：`ApplyKidsSessionAnalyticsIdentity` 原本只清空 `user_id`，仍写入 `tenant_id`（V1 两者相等→等同泄露真实 child ID）。现改为同时清空 `user_id` 和 `tenant_id`；`validateSUEKidsSessionPrivacy` 同步添加 `tenant_id IS NULL` 校验；DB CHECK `chk_sue_kids_privacy` 约束表达式更新为同时约束 `user_id IS NULL AND tenant_id IS NULL`；`download_test.go` 中断言 `TenantID != nil` 的旧错误行为已修正为 `assert.Nil`（`internal/skill/model/skill_usage_event.go`, `sue_event_migrate.go`, `skill_usage_event_integration_test.go`, `internal/skill/handler/download_test.go`）
- DR-43 review fix — JSON wrapper rule：`skill_usage_event.go` 将 `encoding/json` 直接调用替换为 `common.Unmarshal`（AGENTS Rule 1）
- DR-43 review fix — DB metadata 约束仅检查顶层 key：新增代码注释（`sueRestrictedMetadataJSONPaths`、`validateSUEEventMetadata`、SQLite DDL）说明 DB CHECK 约束为顶层 only、应用层 `BeforeCreate → jsonContainsRestrictedMetadataKey` 为权威递归守卫；新增 `TestSUEMetadataDBConstraintTopLevelOnly` 测试记录边界行为
- 更新 2026 H1 模型定价目录：修正部分现有模型输入/输出倍率，新增 OpenAI、Anthropic、Gemini、DeepSeek、Qwen、GLM、Kimi、Doubao、MiniMax、Grok 等模型定价与 Quick Import 预设，并补充任务 PRD（`setting/ratio_setting/`, `web/default/src/features/channels/lib/provider-presets.ts`, `web/default/src/features/models/lib/model-presets.ts`, `docs/tasks/pricing-catalog-2026h1-prd.md`）

## 2026-06-20

- 新增 `skill_versions` 表启动迁移接入、MySQL one-active-version 集成测试、SQLite 删除限制测试、DR-41 PRD，并将版本外键更新/删除策略改为 RESTRICT；MySQL 建表路径现在内建 generated column，避免后续 ALTER 触发 FK 重建失败（`model/main.go`, `internal/skill/model/`, `docs/tasks/skill-versions-table-migration-prd.md`）(DR-41)
- 新增 `AGENTS.md` Rule 10（每次改动记 CHANGELOG）+ Rule 11（每个任务开工前先写/更新 `docs/tasks/*-prd.md`，带 spec→ship status）
- 新增 `CHANGELOG.md`：建立变更记录文件
- 新增站内 Docs/集成文档区（`web/default/src/features/docs/` + 路由 `/docs`、`/docs/$slug`）：渲染 `public/docs/integrations/*.md` 的 23 篇工具接入指南（Claude Code、Cursor、Cherry Studio、SDK 等），分类侧边栏 + 索引网格 + 运行时 fetch markdown。首页导航恢复 Docs 入口（`use-top-nav-links.ts`，受 `HeaderNavModules.docs` 控制）。新文件版权头用 `Copyright (C) 2026 DeepRouter`（非上游 QuantumNous——原创文件不挂上游版权；copyright 脚本按第三方版权跳过保留）
- 订正 `CLAUDE.md` §0 的定位描述：支付是**多币种（USD/AUD via Airwallex/CNY 微信支付宝），价格以美金计价（USD-denominated）**——不再误述为"只收/只按人民币"；并明确产品核心是**手把手教小白配置好、用起来 + 讲清每个模型用来干嘛（写作/代码/翻译/图像/语音）**
- DR-55（Download Skill package，R2 模型，建于 DR-81 下载端点之上）：锁定 "download = 启用记录 ≠ 永久执行权" 语义——`internal/skill/handler/download.go` 与 `internal/skill/model/user_enabled_skill.go` 加 necessary-but-not-sufficient 契约注释；新增 `TestDownloadSkillPackage_GrantsNoExecutionRight`（下载侧 negative test：仅写启用记录 + `skill_enabled` 事件，不签发 token/grant/credential/entitlement 类执行权产物）。三处 download 直连文档对齐：`tasks/03 §3` 补 `entry_point=skill_package`、`§8.4` 标注 Enable 由 download 取代、`tasks/04 §3.1` 下载事件名统一为 `skill_enabled`。运行时逐次鉴权（无 runner key + entitlement 即拒）归 DR-64/68/M05，不在本票实现
