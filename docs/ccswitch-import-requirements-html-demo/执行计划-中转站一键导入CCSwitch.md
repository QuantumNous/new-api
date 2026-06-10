# 中转站一键导入 CC Switch 执行计划

> 依据：`需求文档-中转站一键导入CCSwitch.md`、`ccswitch-import-static-demo.html`、当前项目令牌管理与模型接口实现。
> 目标：在控制台「令牌管理」中，为单条令牌提供「导入到 CC Switch」能力，MVP 默认导入 Codex，保留后续目标扩展点。

## 1. 结论摘要

本功能应按“系统先选好，用户只确认”的交互原则实现。当前项目里已经有一个 `CCSwitchDialog` 草稿，但它和需求存在关键偏差：

- 入口目前在更多菜单中的 `CC Switch` 项，不是令牌行上可见的「导入」入口。
- 当前弹窗默认目标为 Claude，并展示应用、名称、多模型字段，偏向配置生成器。
- 当前前端会先通过 `/api/token/:id/key` 获取完整 key，再在浏览器本地拼 `ccswitch://`，不符合“完整 API Key 仅在立即导入时由后端读取并生成 deep link”的安全要求。
- 当前 deep link 生成逻辑在前端，后端没有导入选项、导入链接、导入日志或用户偏好接口。

建议本次改造以“后端生成 deep link、前端只做确认与唤起”为主线，重写现有 CC Switch 弹窗而不是继续扩展当前多应用配置弹窗。

## 2. 当前项目落点

### 2.1 前端令牌管理

- 页面入口：`web/default/src/routes/_authenticated/keys/index.tsx`
- 功能入口组件：`web/default/src/features/keys/index.tsx`
- 列表列定义：`web/default/src/features/keys/components/api-keys-columns.tsx`
- 行操作：`web/default/src/features/keys/components/data-table-row-actions.tsx`
- 弹窗统一挂载：`web/default/src/features/keys/components/api-keys-dialogs.tsx`
- 状态上下文：`web/default/src/features/keys/components/api-keys-provider.tsx`
- 现有 CC Switch 弹窗：`web/default/src/features/keys/components/dialogs/cc-switch-dialog.tsx`
- API 封装：`web/default/src/features/keys/api.ts`
- 类型：`web/default/src/features/keys/types.ts`

### 2.2 后端令牌接口

- 路由：`router/api-router.go`
- 令牌 Controller：`controller/token.go`
- 令牌 Model：`model/token.go`
- 当前路由组：`/api/token`
- 当前鉴权：`middleware.UserAuth()`
- 现有完整 key 接口：`POST /api/token/:id/key`
- 防缓存中间件：`middleware.DisableCache()`

### 2.3 模型来源

用户控制台已有普通用户可用模型接口：

- 后端：`controller/user.go` 的 `GetUserModels`
- 路由：`GET /api/user/models`
- 前端封装：`web/default/src/lib/api.ts` 的 `getUserModels`
- 当前令牌编辑抽屉和现有 CC Switch 弹窗已经复用该接口。

管理员模型元数据接口 `/api/models/search` 需要管理员权限，不适合作为普通用户令牌导入弹窗的主数据源。

## 3. 目标范围

### 3.1 MVP 必做

- 在每条令牌行操作区新增可见的「导入」入口，tooltip 为「导入到 CC Switch」。
- 点击「导入」后请求后端初始化接口，打开「导入到 CC Switch」弹窗。
- 弹窗展示当前令牌名称、脱敏 key、BaseURL、默认目标、默认模型。
- MVP 默认目标为 Codex，其他目标以禁用态展示「即将支持」。
- 支持更换模型：展开位置在「默认模型」项下方，支持包含匹配和多关键词匹配。
- 点击「立即导入」时请求后端生成 `ccswitch://` deep link，再由前端执行 `window.location.href = url`。
- 不展示 deep link 明文，不提供复制链接按钮，不在前端日志输出 deep link。
- 后端导入链接接口鉴权、校验 token owner、设置 `Cache-Control: no-store`。
- i18n 覆盖新增前端文案。

### 3.2 MVP 暂不做

- 批量导入。
- 同时导入多个目标。
- Provider 高级配置编辑。
- 导入预览。
- 复制 deep link。
- 在弹窗中展示 Windows / macOS 平台说明。

### 3.3 可选增强

- 记录导入日志。
- 记录用户上次选择的 target/model，作为下次默认值。
- 后端提供模型搜索接口，避免一次性返回大量模型。

## 4. 后端执行计划

### 4.1 新增 DTO

建议新增 `dto/ccswitch.go`：

- `CCSwitchImportTokenDTO`
- `CCSwitchImportTargetDTO`
- `CCSwitchImportOptionsResponse`
- `CCSwitchImportLinkRequest`
- `CCSwitchImportLinkResponse`

字段建议：

```go
type CCSwitchImportLinkRequest struct {
    Target string `json:"target"`
    Model  string `json:"model"`
}
```

如果后续出现可选标量字段，必须使用 pointer + `omitempty`，避免显式零值被丢弃。

### 4.2 新增 Service

建议新增 `service/ccswitch_import.go`，承载业务逻辑：

- 目标注册表：Codex 启用，Claude Code / Hermes / OpenClaw / OpenCode 禁用。
- 默认目标选择：MVP 固定 Codex。
- 默认模型选择：
  1. 用户偏好表中的 `last_model`，如果本期实现偏好。
  2. 令牌 `model_limits` 中第一个可用模型，前提是 `model_limits_enabled=true`。
  3. 用户可用模型中优先匹配 `codex` 的模型。
  4. 用户可用模型第一个。
  5. 仍无模型时返回空，由前端禁用「立即导入」并提示选择模型。
- BaseURL 选择：优先使用 `setting/system_setting.ServerAddress`，Codex endpoint 统一追加 `/v1`。
- API Key 规范化：沿用当前前端行为，如果数据库 token key 不含 `sk-` 前缀，生成 deep link 时补上 `sk-`。
- deep link 编码：使用 `net/url.Values`，禁止手工拼接未编码参数。
- 禁止在日志中记录完整 API Key 或完整 deep link。

Deep link 参数：

```text
resource=provider
app=codex
name=<token.Name>
endpoint=<server_address>/v1
apiKey=<sk-...>
model=<selectedModel>
enabled=true
```

### 4.3 新增 Controller

建议新增 `controller/ccswitch_import.go` 或 `controller/token_ccswitch.go`：

- `GetTokenCCSwitchImportOptions(c *gin.Context)`
- `CreateTokenCCSwitchImportLink(c *gin.Context)`

Controller 只负责：

- 解析 `tokenId`。
- 解析请求 JSON。
- 从 `c.GetInt("id")` 获取当前用户。
- 调用 service。
- 返回 `common.ApiSuccess` / `common.ApiError`。

请求 JSON 解析可继续使用 Gin 的 `ShouldBindJSON`；如果自行解析 reader，必须使用 `common.DecodeJson`。

### 4.4 路由

在现有 `/api/token` 组内新增，保持项目单数路由风格：

```go
tokenRoute.GET("/:id/ccswitch/import-options", middleware.DisableCache(), controller.GetTokenCCSwitchImportOptions)
tokenRoute.POST("/:id/ccswitch/import-link", middleware.CriticalRateLimit(), middleware.DisableCache(), controller.CreateTokenCCSwitchImportLink)
```

不建议新增 `/api/tokens/...` 复数路由，以免和现有前端 API 风格不一致。

### 4.5 数据库存储

如果本期需要落地导入日志和偏好，建议新增 GORM 模型：

- `model.CCSwitchImportLog`
- `model.UserCCSwitchPreference`

加入 `model/main.go` 的 `AutoMigrate` 和 `migrateDBFast` 列表。字段使用普通 `string/int/int64`，避免数据库专有类型，兼容 SQLite / MySQL / PostgreSQL。

推荐结构：

```go
type CCSwitchImportLog struct {
    Id        int    `json:"id"`
    UserId    int    `json:"user_id" gorm:"index"`
    TokenId   int    `json:"token_id" gorm:"index"`
    Target    string `json:"target" gorm:"type:varchar(64)"`
    Model     string `json:"model" gorm:"type:varchar(255)"`
    CreatedAt int64  `json:"created_at" gorm:"bigint;index"`
    Ip        string `json:"ip" gorm:"type:varchar(64)"`
    UserAgent string `json:"user_agent" gorm:"type:varchar(512)"`
}

type UserCCSwitchPreference struct {
    Id         int    `json:"id"`
    UserId     int    `json:"user_id" gorm:"uniqueIndex"`
    LastTarget string `json:"last_target" gorm:"type:varchar(64)"`
    LastModel  string `json:"last_model" gorm:"type:varchar(255)"`
    UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
}
```

如果希望减少表数量，也可以先用现有 `model.RecordLog` 记录 `LogTypeManage`，但这不满足需求文档中的独立导入日志表建议。

## 5. 前端执行计划

### 5.1 API 和类型

在 `web/default/src/features/keys/api.ts` 新增：

- `getCCSwitchImportOptions(id: number)`
- `createCCSwitchImportLink(id: number, data: { target: string; model: string })`

在 `web/default/src/features/keys/types.ts` 新增对应类型：

- `CCSwitchImportToken`
- `CCSwitchImportTarget`
- `CCSwitchImportOptions`
- `CCSwitchImportLinkRequest`

### 5.2 Provider 状态

当前 `ApiKeysProvider` 中的 `resolvedKey` 是为了现有前端拼 deep link 使用。改造后：

- `CCSwitchDialog` 不再接收 `tokenKey`。
- `ApiKeysDialogs` 将 `currentRow?.id` 或 `currentRow` 传给 `CCSwitchDialog`。
- 打开导入弹窗时不调用 `resolveRealKey`。
- 现有复制 key、复制连接信息、聊天预设如果仍需要完整 key，可保留当前 `resolveRealKey` 逻辑，但不能被导入流程依赖。

### 5.3 行操作入口

建议在 `data-table-row-actions.tsx` 增加一个直接可见的导入图标按钮，使用现有 `ArrowRightLeft` 图标：

- `aria-label={t('Import to CC Switch')}`
- tooltip：`t('Import to CC Switch')`
- 点击时 `setCurrentRow(apiKey)` 并 `setOpen('cc-switch')`

现有 dropdown 中的 `CC Switch` 项可改名为 `Import to CC Switch` 或移除，避免同一功能两个入口。

如果严格按需求的文字顺序展示行操作，需要进一步调整当前“状态图标 + 更多菜单”的紧凑设计，这一点见文末待确认问题。

### 5.4 弹窗重写

重写 `web/default/src/features/keys/components/dialogs/cc-switch-dialog.tsx`，保留文件名和挂载关系，避免扩大改动面。

弹窗状态：

- `selectedTarget`
- `selectedModel`
- `targetExpanded`
- `modelExpanded`
- `modelKeyword`
- `showLaunchHelp`

数据来源：

- 打开弹窗时调用 `getCCSwitchImportOptions(tokenId)`。
- 模型列表复用 `getUserModels()`，前端做包含匹配和多关键词匹配。
- 如果后端 options 返回 `default_model`，前端优先选中它。

交互要求：

- 默认状态只展示当前令牌、导入目标、默认模型、取消、立即导入。
- 目标选择展开在「导入目标」下方。
- 模型搜索展开在「默认模型」下方。
- 选择模型后收起模型列表。
- 未选择模型时禁用「立即导入」或 toast 提示。
- 点击「立即导入」时调用 `createCCSwitchImportLink`，成功后 `window.location.href = url`。
- 点击后立即 toast：`正在打开 CC Switch...`
- 1.5 秒后在弹窗内或 toast 展示辅助提示：`如果没有打开 CC Switch，请确认已安装并完成协议注册。`

禁止事项：

- 不展示完整 API Key。
- 不展示 `ccswitch://` 明文。
- 不提供复制链接。
- 不使用 `console.log(url)`。
- 不从 `localStorage.status.server_address` 本地拼 endpoint。

### 5.5 i18n

新增用户可见文案必须使用 `useTranslation()` 与 `t()`。

需要补充：

- `web/default/src/i18n/static-keys.ts`
- `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json`

建议文案 key 直接使用英文句子，符合当前项目用法。

## 6. 测试计划

### 6.1 后端测试

建议新增或补充 `controller/token_test.go`：

- `GET /api/token/:id/ccswitch/import-options` 只返回脱敏 key，不包含原始 token key。
- 其他用户的 token id 无法获取 options。
- `POST /api/token/:id/ccswitch/import-link` 只允许 token owner。
- `import-link` 响应头包含 `Cache-Control: no-store`。
- 生成的 deep link 参数通过 `url.Parse` 和 `Query()` 验证，不靠字符串包含。
- token name、endpoint、model 包含中文、空格、`/`, `:`, `?`, `=`, `&` 时编码正确。
- 禁用 target 返回错误。
- 未传 model 返回错误。
- key 前缀规范化符合预期。

如果实现偏好表：

- 成功生成导入链接后 upsert 用户偏好。
- 下次 options 使用上次 target/model 作为默认值。

如果实现导入日志：

- 只记录 userId、tokenId、target、model、时间、ip、userAgent。
- 日志中不包含完整 API Key 或 deep link。

### 6.2 前端测试与检查

前端改动后至少执行：

```powershell
cd web/default
bun run typecheck
bun run lint
bun run build:check
bun run i18n:sync
```

用户可见交互需要用 Codex 桌面端应用内浏览器验证：

- 令牌行可见「导入」入口。
- 打开弹窗默认显示 Codex 和默认模型。
- 展开目标与模型的位置符合 demo。
- 搜索 `codex` 能匹配包含 codex 的模型。
- 选择模型后自动收起。
- 弹窗不显示 deep link、复制链接、平台说明。
- 点击立即导入后尝试唤起 `ccswitch://`。

### 6.3 后端命令

后端改动后执行：

```powershell
gofmt -w controller/ccswitch_import.go service/ccswitch_import.go dto/ccswitch.go model/ccswitch_import.go
go test ./controller
go test ./model
go test ./service
go test ./...
```

如果只改 Controller 且没有新增 Model，可先跑受影响包，再视影响范围扩大到 `go test ./...`。

## 7. 推荐实施顺序

1. 后端 DTO + Service 目标注册表 + deep link 生成单元测试。
2. 后端 Controller + 路由 + owner 鉴权 + no-store 测试。
3. 前端 API/types 接入。
4. 重写 CC Switch 弹窗静态结构，先用 mock/options 数据跑通 UI。
5. 接入 options 与 import-link，移除导入流程对 `resolveRealKey` 的依赖。
6. 添加行操作可见入口，处理 tooltip、loading、禁用态。
7. 补齐 i18n。
8. 补后端/前端验证，最后用浏览器手测。

## 8. 风险与注意事项

- 浏览器无法可靠判断 deep link 是否成功打开，只能做延迟提示。
- 如果系统 `ServerAddress` 未配置或配置错误，CC Switch 导入的 endpoint 会错误；后端需要明确 fallback 或返回可理解错误。
- `ccswitch://` URL 本身包含 API Key，虽然不展示，但前端仍会短暂持有返回 URL；不要日志打印，不要缓存，不要复制。
- 当前行操作菜单打开时会预取完整 key，这与导入流程无关但容易误触发。若入口仍放在 dropdown 内，应调整打开菜单即预取 key 的行为。
- 当前项目 token 只有 `model_limits`，没有单独“默认模型”字段；默认模型规则需要确认。
- 新增数据库表必须通过 GORM AutoMigrate，避免 MySQL-only / PostgreSQL-only / SQLite-only SQL。

## 9. 待确认问题

1. 行操作入口是否必须严格展示为文字顺序 `聊天 / 导入 / 禁用 / 编辑 / 删除`，还是可以沿用当前紧凑表格风格，新增一个可见的导入图标按钮并保留更多菜单？
2. 令牌的“默认模型”在当前项目里应如何定义：使用 `model_limits` 的第一个模型，还是需要新增真正的 token 默认模型字段？
3. 本期是否必须新增导入日志表和用户偏好表？如果只做 MVP，可以先固定 Codex，并用当前可用模型规则选择默认模型；如果需要“上次导入优先”，就必须落地用户偏好。
4. CC Switch 是否要求 `apiKey` 参数一定带 `sk-` 前缀？当前项目数据库 token key 通常不含 `sk-`，现有前端导入逻辑会补前缀。
5. 当 `ServerAddress` 为空时，是否允许后端使用当前请求的 scheme/host 作为 fallback，还是应返回错误提示管理员配置服务地址？

