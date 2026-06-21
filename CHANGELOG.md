# Changelog

DeepRouter gateway 变更记录。规则见 `AGENTS.md` Rule 10。

## 2026-06-21

- DR-64 修復 pass-through 洩漏：`relay/compatible_handler.go` 的 pass-through 守衛從「僅攔截已 resolve 的 skill 請求」擴展為「攔截任何帶 deeprouter 擴展的請求（含無 skill_id 的 partial extension）」，防止 `deeprouter` vendor extension 透過 raw BodyStorage 路徑洩漏給上游 provider；新增 `TestTextHelper_SkillRelay_PartialExtension_PassThrough_Rejected` 覆蓋此路徑
- feat(R2/D-09): 新增 package-facing public routing API `/v1/routing/chat/completions`，复用 runner key 的 `TokenAuth` 身份解析，要求 `deeprouter.skill_id`，并强制 `entry_point=skill_package`；包内提供的 identity / entry point 不被信任 (`router/relay-router.go`, `relay/compatible_handler.go`)
- DR-64 安全修復：`internal/skill/relay/resolver.go` 在 DB 查詢後立即驗證 `skill.Status == Published`，並檢查 `ActiveVersionID != nil`——草稿/已封存/已棄用的 skill 和無可執行版本的 published skill 均回傳 `SKILL_NOT_PUBLISHED`（HTTP 403），防止未發布 skill 進入 relay 路徑 (DR-88 nil deref 提前擋住)
- DR-64 relay 入口修復：`relay/compatible_handler.go` 中 `request.Deeprouter = nil`（vendor extension 清除）移到 `SkillID` 檢查外層，確保所有帶 `deeprouter` 字段的請求（含 `skill_id` 為空的情況）在轉發上游前都會清除 vendor extension，避免 provider 端拒絕識別 unknown field
- 補充測試：`resolver_test.go` 新增 Draft / Archived / Deprecated / NilActiveVersionID 四個 negative test；`compatible_handler_skill_test.go` 所有 skill 測試 fixture 加上 `ActiveVersionID`
- 更新 2026 H1 模型定价目录：修正部分现有模型输入/输出倍率，新增 OpenAI、Anthropic、Gemini、DeepSeek、Qwen、GLM、Kimi、Doubao、MiniMax、Grok 等模型定价与 Quick Import 预设，并补充任务 PRD（`setting/ratio_setting/`, `web/default/src/features/channels/lib/provider-presets.ts`, `web/default/src/features/models/lib/model-presets.ts`, `docs/tasks/pricing-catalog-2026h1-prd.md`）

## 2026-06-20

- 重做 `/welcome` 为「目标导向」单屏：H1 从 persona 提问改为结果「你的账号已经开好了」，展示免费额度 + 密钥（可复制 / 无 handoff 时退化为去密钥页），给出「3 步用起来」+ 主 CTA「确认能用」(→ `/keys/test` 自检) 与次 CTA「充值」(→ `/wallet`)，persona 降级为底部可选项不再阻塞。所有 CTA 离开前都先保存 persona，避免被 `PersonaPickerHost` 弹回 /welcome 死循环。casual 文案零开发者术语 + 中英 i18n 落齐（`features/welcome/index.tsx`、`routes/welcome.tsx`、`i18n/locales/{en,zh}.json`）。PRD：`docs/tasks/welcome-goal-first-prd.md`
- 新增 `AGENTS.md` Rule 10（每次改动记 CHANGELOG）+ Rule 11（每个任务开工前先写/更新 `docs/tasks/*-prd.md`，带 spec→ship status）
- 新增 `CHANGELOG.md`：建立变更记录文件
- 新增站内 Docs/集成文档区（`web/default/src/features/docs/` + 路由 `/docs`、`/docs/$slug`）：渲染 `public/docs/integrations/*.md` 的 23 篇工具接入指南（Claude Code、Cursor、Cherry Studio、SDK 等），分类侧边栏 + 索引网格 + 运行时 fetch markdown。首页导航恢复 Docs 入口（`use-top-nav-links.ts`，受 `HeaderNavModules.docs` 控制）。新文件版权头用 `Copyright (C) 2026 DeepRouter`（非上游 QuantumNous——原创文件不挂上游版权；copyright 脚本按第三方版权跳过保留）
- 订正 `CLAUDE.md` §0 的定位描述：支付是**多币种（USD/AUD via Airwallex/CNY 微信支付宝），价格以美金计价（USD-denominated）**——不再误述为"只收/只按人民币"；并明确产品核心是**手把手教小白配置好、用起来 + 讲清每个模型用来干嘛（写作/代码/翻译/图像/语音）**
- DR-55（Download Skill package，R2 模型，建于 DR-81 下载端点之上）：锁定 "download = 启用记录 ≠ 永久执行权" 语义——`internal/skill/handler/download.go` 与 `internal/skill/model/user_enabled_skill.go` 加 necessary-but-not-sufficient 契约注释；新增 `TestDownloadSkillPackage_GrantsNoExecutionRight`（下载侧 negative test：仅写启用记录 + `skill_enabled` 事件，不签发 token/grant/credential/entitlement 类执行权产物）。三处 download 直连文档对齐：`tasks/03 §3` 补 `entry_point=skill_package`、`§8.4` 标注 Enable 由 download 取代、`tasks/04 §3.1` 下载事件名统一为 `skill_enabled`。运行时逐次鉴权（无 runner key + entitlement 即拒）归 DR-64/68/M05，不在本票实现
