# 中转站一键导入 CC Switch 执行计划

> 依据：需求文档、静态 demo、当前项目令牌管理实现，以及已确认的补充信息。
> 状态：已按本计划进入实现，本文同步记录最终落地点、验证范围和后续维护入口。

## 1. 已确认结论

- 控制台「令牌管理」行操作顺序为：`聊天 / 导入 / 禁用或启用 / 编辑 / 删除`。
- 「导入」是行内可见按钮，不再藏在更多菜单中。
- 默认导入目标为 Codex，其他目标保留展示但禁用，显示「即将支持」。
- 默认模型固定为 `gpt-5.5`，用户上次导入选择会作为下次默认模型。
- BaseURL 使用后台系统设置 `ServerAddress` 原值，例如 `https://api.xistree.hk/`，不自动追加 `/v1`。
- `ServerAddress` 为空时，后端阻断导入并返回错误，不使用请求 Host 兜底。
- 前端只展示脱敏 key；完整 API Key 只能由后端在生成 deep link 时读取。
- 本期新增独立导入日志表和用户偏好表。

## 2. 后端实现计划

### 2.1 DTO

新增 `dto/ccswitch.go`：

- `CCSwitchImportToken`
- `CCSwitchImportTarget`
- `CCSwitchImportOptionsResponse`
- `CCSwitchImportLinkRequest`
- `CCSwitchImportLinkResponse`

请求体保持最小字段：

```go
type CCSwitchImportLinkRequest struct {
    Target string `json:"target"`
    Model  string `json:"model"`
}
```

### 2.2 Service

新增 `service/ccswitch_import.go`：

- 目标注册表：Codex 启用，Claude Code / Hermes / OpenClaw / OpenCode 禁用。
- 默认目标：`codex`。
- 默认模型：优先用户上次偏好，否则 `gpt-5.5`。
- 使用 `system_setting.ServerAddress` 原值作为 endpoint。
- `ServerAddress` 为空时直接返回业务错误。
- 使用 token owner 的完整 key 生成导入链接。
- 如果数据库 token key 不含 `sk-` 前缀，生成 deep link 时补齐。
- 使用 `net/url.Values` 编码 deep link 参数，禁止手工拼接未编码参数。
- 日志中只记录 userId、tokenId、target、model、时间、IP、User-Agent，不记录完整 key 或 deep link。

deep link 参数：

```text
resource=provider
app=codex
name=<token name>
endpoint=<ServerAddress 原值>
apiKey=<完整 sk-... key>
model=<selected model>
enabled=true
model_reasoning_effort=high
disable_response_storage=true
wire_api=responses
requires_openai_auth=true
```

如果 CC Switch provider 协议暂不消费 Codex 扩展字段，MVP 仍按 provider 参数导入；这些字段作为 Codex 目标配置语义保留。

### 2.3 Controller 与路由

新增 `controller/ccswitch_import.go`：

- `GetTokenCCSwitchImportOptions`
- `CreateTokenCCSwitchImportLink`

在现有 `/api/token` 单数路由组内新增：

```go
tokenRoute.GET("/:id/ccswitch/import-options", middleware.DisableCache(), controller.GetTokenCCSwitchImportOptions)
tokenRoute.POST("/:id/ccswitch/import-link", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.CreateTokenCCSwitchImportLink)
```

### 2.4 数据库

新增 GORM 模型 `model/ccswitch_import.go`：

- `CCSwitchImportLog`，表名 `ccswitch_import_logs`
- `UserCCSwitchPreference`，表名 `user_ccswitch_preferences`

加入 `model/main.go` 的正常 `AutoMigrate` 和 `migrateDBFast` 列表，保持 SQLite / MySQL / PostgreSQL 兼容。

## 3. 前端实现计划

### 3.1 API 与类型

更新 `web/default/src/features/keys/api.ts`：

- `getCCSwitchImportOptions(id)`
- `createCCSwitchImportLink(id, data)`

更新 `web/default/src/features/keys/types.ts`：

- `CCSwitchImportToken`
- `CCSwitchImportTarget`
- `CCSwitchImportOptions`
- `CCSwitchImportLinkRequest`
- `CCSwitchImportLinkResponse`

### 3.2 行操作

更新 `web/default/src/features/keys/components/data-table-row-actions.tsx`：

- 行内新增「导入」按钮。
- 打开导入弹窗时只传 token id，不提前获取完整 key。
- 移除导入流程对前端完整 key 的依赖。
- 行操作顺序保持 `聊天 / 导入 / 禁用或启用 / 编辑 / 删除`。

### 3.3 CC Switch 弹窗

重写 `web/default/src/features/keys/components/dialogs/cc-switch-dialog.tsx`：

- 打开弹窗时请求 `import-options`。
- 弹窗只展示当前令牌、导入目标、默认模型和底部按钮。
- 目标和模型选择在对应项下方展开。
- 模型列表复用 `getUserModels()`，支持包含匹配和多关键词匹配。
- 选择模型后收起列表。
- 点击「立即导入」后调用 `import-link`，成功后执行 `window.location.href = url`。
- 不展示 `ccswitch://`，不复制链接，不打印 deep link。

### 3.4 i18n

更新：

- `web/default/src/i18n/static-keys.ts`
- `web/default/src/i18n/locales/en.json`
- `web/default/src/i18n/locales/zh.json`
- `web/default/src/i18n/locales/fr.json`
- `web/default/src/i18n/locales/ja.json`
- `web/default/src/i18n/locales/ru.json`
- `web/default/src/i18n/locales/vi.json`

新增文案包括「导入」「导入到 CC Switch」「正在打开 CC Switch...」「当前令牌」「导入目标」「默认模型」「即将支持」等。

## 4. 测试计划

后端重点：

- options 接口只返回脱敏 key。
- 非 owner token 无法获取 options 或 import link。
- import-link 响应头包含 `Cache-Control: no-store`。
- `ServerAddress` 为空时报错。
- endpoint 保持 `https://api.xistree.hk/` 原值，不追加 `/v1`。
- URL 参数可正确编码空格、`/`、`?`、`&`、`=`。
- 成功生成链接后写入导入日志和用户偏好。
- 日志不包含完整 API Key 或 deep link。

前端重点：

- 令牌行操作顺序为 `聊天 / 导入 / 禁用或启用 / 编辑 / 删除`。
- 默认弹窗显示 Codex + `gpt-5.5`。
- 搜索模型、选择模型后收起列表。
- 弹窗中不出现 deep link、复制链接、平台说明。
- 点击立即导入后显示打开提示，并尝试唤起 CC Switch。

验证命令：

```powershell
go test ./controller
go test ./model
go test ./service
go test ./...

cd web/default
bun run typecheck
bun run lint
bun run build:check
bun run i18n:sync
```

当前本地环境未安装或未暴露 `go`、`gofmt`、`bun` 到 PATH，因此这些命令需要在具备项目工具链的环境中复跑。

## 5. 表结构交付

本功能需要打包以下表结构与索引说明：

- 新增表：`ccswitch_import_logs`
- 新增表：`user_ccswitch_preferences`
- 业务依赖表：`tokens`

交付物包含 SQLite / MySQL / PostgreSQL 三套参考 SQL，以及说明文档和索引/迁移说明。
