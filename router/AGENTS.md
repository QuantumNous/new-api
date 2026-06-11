<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-10 -->

# router

## Purpose
router 层是 new-api 分层架构（Router→Controller→Service→Model）的入口层，负责将 URL 路由规则与 Gin Engine 绑定，按功能域拆分为多个子路由组（API 管理、Dashboard、Relay 中继、视频代理、对账、Web 前端），并在路由组级别挂载对应的 middleware 链（鉴权、限流、压缩、标签等）。该层不包含任何业务逻辑，仅做路由注册与 middleware 组合。

## Key Files
| File | Description |
|------|-------------|
| `main.go` | 根路由注册入口：`SetRouter()` 依次调用各子路由注册函数，并处理 `FRONTEND_BASE_URL` 环境变量（主节点忽略，slave 节点重定向到外部前端） |
| `api-router.go` | `/api` 路由组：用户认证（注册/登录/OAuth/Passkey/2FA）、令牌管理、系统配置、日志查询、充值/订阅/支付 Webhook、渠道管理（管理员）、供应商/模型/部署管理、对账 token 用量、签到、排行榜、预填组、Codex OAuth/用量、性能/Perf-Metrics 等全部管理 API；新增博客路由组（`/api/blog/list`、`/api/blog/detail/:slug`，匿名可访问）；新增发票资料路由（用户自助 `/user/invoice-profile`、补开发票 `/user/topup/:trade_no/invoice`、管理员 `/user/:id/invoice-profile`）；`/api/oauth/:provider` 统一路由支持 Google 等新增 OAuth 提供商 |
| `relay-router.go` | `/v1`、`/v1beta` 路由组：AI 中继请求（chat completions、embeddings、images、audio、responses、realtime WebSocket、rerank），Gemini 原生格式（`/v1beta/models`），Claude 原生 `/v1/messages`，Playground（`/pg`） |
| `dashboard.go` | `/dashboard` 路由组：OpenAI 兼容的 billing/subscription 接口，供第三方客户端查询余额 |
| `video-router.go` | 视频相关路由：`/v1/videos/:task_id/content`（匿名视频代理，IP 限流）、`/v1/video/generations`（视频生成，需 TokenAuth+Distribute）、视频任务 fetch、Midjourney、任务查询等 |
| `usage_reconciliation.go` | `/usage` 路由组：`SetUsageReconciliationRouter()` 挂载在根 Engine（非 `/api` 下），使用 `GlobalAPIRateLimit` + `UsageReconAuth` 静态 token 鉴权，暴露 `/usage/summary`、`/usage/transactions`、`/usage/validation`（新增：按模型+渠道交叉验证）、`/usage/models`（新增：返回所有启用模型的 BlockRun 定价信息） |
| `web-router.go` | 静态前端文件服务（SPA），处理所有未匹配路由的 `NoRoute` 回退 |

## For AI Agents

### Working In This Directory
- 新增路由时，必须将对应的 middleware 挂载在正确的路由组层级（例如，relay 路由需挂载 `middleware.TokenAuth()` 和 `middleware.Distribute()`）。
- 路由组使用 `middleware.RouteTag("xxx")` 打标，用于日志和性能统计区分，新增路由组需加对应 tag。
- 鉴权 middleware 的选择规则：
  - root/超级管理员接口：`middleware.RootAuth()`
  - 管理员接口：`middleware.AdminAuth()`
  - 普通用户接口：`middleware.UserAuth()`
  - 只读 Token 接口：`middleware.TokenAuthReadOnly()`
  - API Token 接口（中继）：`middleware.TokenAuth()`
  - 混合场景（HeaderNav 模块）：`middleware.HeaderNavModuleAuth("module_name")` 或 `middleware.HeaderNavModulePublicOrUserAuth("module_name")`
  - 静态 token 场景（对账）：`middleware.UsageReconAuth()`
- 限流 middleware 按业务敏感度区分：注册/登录等敏感接口用 `middleware.CriticalRateLimit()`，全局 API 用 `middleware.GlobalAPIRateLimit()`，模型级别用 `middleware.ModelRequestRateLimit()`，视频代理下载用 `middleware.DownloadRateLimit()`，邮件验证用 `middleware.EmailVerificationRateLimit()`。
- 不要在 router 层编写任何业务判断逻辑，条件路由（如按 Header 区分 OpenAI/Claude/Gemini 格式）是唯一允许的例外，且应保持简洁。
- `usage_reconciliation.go` 中的 `/usage` 路由组挂载在根 Engine 而非 `/api` 下，是刻意设计——路径需精确为 `/usage/summary`、`/usage/transactions`、`/usage/validation`、`/usage/models`，不要将其移入 `/api`。
- 博客路由组（`/api/blog/list`、`/api/blog/detail/:slug`）位于匿名区（无鉴权），允许公开访问；新增博客接口时应保持匿名，不要误加 `UserAuth()`。
- 注册新 OAuth 提供商时只需在 `oauth/` 包的 `init()` 中注册，路由层无需改动；`/oauth/:provider` 通配符路由统一分发到 `controller.HandleOAuth`，但 WeChat/Telegram 因协议差异保留独立路由（必须注册在通配符路由之前）。

### Testing Requirements
- 构建验证：`go build ./...`
- 路由注册正确性通过运行服务后的集成测试或 E2E 测试验证。
- 测试文件：`usage_reconciliation_test.go`（对账路由鉴权测试）

### Common Patterns
- 路由组使用 `router.Group("/prefix")` 创建，然后 `.Use(middleware...)` 挂载中间件链。
- 子路由组嵌套（`selfRoute := userRoute.Group("/")`）用于在同一路径前缀下区分不同鉴权级别。
- WebSocket 路由通过普通 `GET` 注册，由 controller 层负责协议升级。
- `oauth` 相关路由：具体路径（`/oauth/wechat`）必须注册在通配符路由（`/oauth/:provider`）之前，防止被提前匹配。
- relay 路由链：`SystemPerformanceCheck()` → `TokenAuth()` → `ModelRequestRateLimit()` → `Distribute()`，顺序固定，不得调换。

## Dependencies

### Internal
- `controller/` — 所有 HTTP handler 函数
- `middleware/` — 所有中间件（鉴权、限流、压缩、分发、日志等）
- `common/` — `IsMasterNode` 等运行时标志
- `relay/` — 部分路由直接引用 relay 包的 handler

### External
- `github.com/gin-gonic/gin` — HTTP 路由框架
- `github.com/gin-contrib/gzip` — Gzip 压缩中间件

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
