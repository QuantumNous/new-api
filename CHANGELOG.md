# Changelog

DeepRouter gateway 变更记录。规则见 `AGENTS.md` Rule 10。

## 2026-06-21

- DR-62（Skill package runtime client，R2/mock-path implementation）：下载包从 `manifest.json + SKILL.md` 升级为 runnable zip，新增 published `instruction_template.md`、嵌入式 runtime client `runtime/deeprouter_skill_runner.py` 与 `runtime/README.md`，并要求 package builder 仅使用 pinned active `skill_version`；若无 active version 或 `instruction_template` 为空则明确失败，不产出 zip。runtime client 采用 Python 3 standard library only，读取 `DEEPROUTER_API_KEY` 与 `DEEPROUTER_EXECUTION_API_URL`，在 mock transport path 下仅发送 `messages + deeprouter.skill_id + deeprouter.skill_version_id`，不转发 identity/Kids 字段，也不发送 raw `instruction_template`。新增下载链路与解压后 runner 测试，覆盖 zip 内容、package build 失败、missing key、mock success、mock `AUTH_REQUIRED` 错误映射（`internal/skill/handler/download.go`, `internal/skill/handler/download_test.go`, `internal/skill/packageassets/`）(DR-62)
- 更新 2026 H1 模型定价目录：修正部分现有模型输入/输出倍率，新增 OpenAI、Anthropic、Gemini、DeepSeek、Qwen、GLM、Kimi、Doubao、MiniMax、Grok 等模型定价与 Quick Import 预设，并补充任务 PRD（`setting/ratio_setting/`, `web/default/src/features/channels/lib/provider-presets.ts`, `web/default/src/features/models/lib/model-presets.ts`, `docs/tasks/pricing-catalog-2026h1-prd.md`）

## 2026-06-20

- 修复 playground 在分组无权时返回 403 `No permission to access this group`：改为静默回退到用户自有分组，第一方 playground 不再因分组不匹配挡住新用户首次请求（`middleware/distributor.go`）
- 新增 `skill_versions` 表启动迁移接入、MySQL one-active-version 集成测试、SQLite 删除限制测试、DR-41 PRD，并将版本外键更新/删除策略改为 RESTRICT；MySQL 建表路径现在内建 generated column，避免后续 ALTER 触发 FK 重建失败（`model/main.go`, `internal/skill/model/`, `docs/tasks/skill-versions-table-migration-prd.md`）(DR-41)
- 新增 `AGENTS.md` Rule 10（每次改动记 CHANGELOG）+ Rule 11（每个任务开工前先写/更新 `docs/tasks/*-prd.md`，带 spec→ship status）
- 新增 `CHANGELOG.md`：建立变更记录文件
- 新增站内 Docs/集成文档区（`web/default/src/features/docs/` + 路由 `/docs`、`/docs/$slug`）：渲染 `public/docs/integrations/*.md` 的 23 篇工具接入指南（Claude Code、Cursor、Cherry Studio、SDK 等），分类侧边栏 + 索引网格 + 运行时 fetch markdown。首页导航恢复 Docs 入口（`use-top-nav-links.ts`，受 `HeaderNavModules.docs` 控制）。新文件版权头用 `Copyright (C) 2026 DeepRouter`（非上游 QuantumNous——原创文件不挂上游版权；copyright 脚本按第三方版权跳过保留）
- 订正 `CLAUDE.md` §0 的定位描述：支付是**多币种（USD/AUD via Airwallex/CNY 微信支付宝），价格以美金计价（USD-denominated）**——不再误述为"只收/只按人民币"；并明确产品核心是**手把手教小白配置好、用起来 + 讲清每个模型用来干嘛（写作/代码/翻译/图像/语音）**
- DR-55（Download Skill package，R2 模型，建于 DR-81 下载端点之上）：锁定 "download = 启用记录 ≠ 永久执行权" 语义——`internal/skill/handler/download.go` 与 `internal/skill/model/user_enabled_skill.go` 加 necessary-but-not-sufficient 契约注释；新增 `TestDownloadSkillPackage_GrantsNoExecutionRight`（下载侧 negative test：仅写启用记录 + `skill_enabled` 事件，不签发 token/grant/credential/entitlement 类执行权产物）。三处 download 直连文档对齐：`tasks/03 §3` 补 `entry_point=skill_package`、`§8.4` 标注 Enable 由 download 取代、`tasks/04 §3.1` 下载事件名统一为 `skill_enabled`。运行时逐次鉴权（无 runner key + entitlement 即拒）归 DR-64/68/M05，不在本票实现
