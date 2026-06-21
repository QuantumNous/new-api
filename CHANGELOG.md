# Changelog

DeepRouter gateway 变更记录。规则见 `AGENTS.md` Rule 10。

## 2026-06-21

- DR-64 安全修复：`internal/skill/relay/resolver.go` 在 DB 查询後立即驗證 `skill.Status == Published`，並檢查 `ActiveVersionID != nil`——草稿/已封存/已棄用的 skill 和無可執行版本的 published skill 均回傳 `SKILL_NOT_PUBLISHED`（HTTP 403），防止未發布 skill 進入 relay 路徑 (DR-88 nil deref 提前擋住)
- DR-64 relay 入口修復：`relay/compatible_handler.go` 中 `request.Deeprouter = nil`（vendor extension 清除）移到 `SkillID` 檢查外層，確保所有帶 `deeprouter` 字段的請求（含 `skill_id` 為空的情況）在轉發上游前都會清除 vendor extension，避免 provider 端拒絕識別 unknown field
- 補充測試：`resolver_test.go` 新增 Draft / Archived / Deprecated / NilActiveVersionID 四個 negative test；`compatible_handler_skill_test.go` 所有 skill 測試 fixture 加上 `ActiveVersionID`

## 2026-06-20

- 新增 `skill_versions` 表启动迁移接入、MySQL one-active-version 集成测试、SQLite 删除限制测试、DR-41 PRD，并将版本外键更新/删除策略改为 RESTRICT；MySQL 建表路径现在内建 generated column，避免后续 ALTER 触发 FK 重建失败（`model/main.go`, `internal/skill/model/`, `docs/tasks/skill-versions-table-migration-prd.md`）(DR-41)
- 新增 `AGENTS.md` Rule 10（每次改动记 CHANGELOG）+ Rule 11（每个任务开工前先写/更新 `docs/tasks/*-prd.md`，带 spec→ship status）
- 新增 `CHANGELOG.md`：建立变更记录文件
- 新增站内 Docs/集成文档区（`web/default/src/features/docs/` + 路由 `/docs`、`/docs/$slug`）：渲染 `public/docs/integrations/*.md` 的 23 篇工具接入指南（Claude Code、Cursor、Cherry Studio、SDK 等），分类侧边栏 + 索引网格 + 运行时 fetch markdown。首页导航恢复 Docs 入口（`use-top-nav-links.ts`，受 `HeaderNavModules.docs` 控制）。新文件版权头用 `Copyright (C) 2026 DeepRouter`（非上游 QuantumNous——原创文件不挂上游版权；copyright 脚本按第三方版权跳过保留）
- 订正 `CLAUDE.md` §0 的定位描述：支付是**多币种（USD/AUD via Airwallex/CNY 微信支付宝），价格以美金计价（USD-denominated）**——不再误述为"只收/只按人民币"；并明确产品核心是**手把手教小白配置好、用起来 + 讲清每个模型用来干嘛（写作/代码/翻译/图像/语音）**
- DR-55（Download Skill package，R2 模型，建于 DR-81 下载端点之上）：锁定 "download = 启用记录 ≠ 永久执行权" 语义——`internal/skill/handler/download.go` 与 `internal/skill/model/user_enabled_skill.go` 加 necessary-but-not-sufficient 契约注释；新增 `TestDownloadSkillPackage_GrantsNoExecutionRight`（下载侧 negative test：仅写启用记录 + `skill_enabled` 事件，不签发 token/grant/credential/entitlement 类执行权产物）。三处 download 直连文档对齐：`tasks/03 §3` 补 `entry_point=skill_package`、`§8.4` 标注 Enable 由 download 取代、`tasks/04 §3.1` 下载事件名统一为 `skill_enabled`。运行时逐次鉴权（无 runner key + entitlement 即拒）归 DR-64/68/M05，不在本票实现
