<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# controller

## Purpose
controller 层是 new-api 分层架构（Router→Controller→Service→Model）的第二层，负责接收 Gin 路由分发的 HTTP 请求、解析参数、调用 service/model 完成业务逻辑，并将结果以统一格式（`common.ApiSuccess` / `common.ApiError` / `common.ApiErrorI18n`）返回给客户端。该层不直接操作数据库，也不包含核心业务算法，是 HTTP 层与业务层之间的薄胶水层。

## Key Files
| File | Description |
|------|-------------|
| `relay.go` | AI 请求中继核心入口，按 RelayMode 分发到 `relay` 包各 Helper（Text/Image/Audio/Embedding/Responses），同时处理 WebSocket realtime 连接 |
| `channel.go` | 渠道（Channel）管理 CRUD，包含模型列表查询、渠道状态过滤、按类型获取模型映射 |
| `user.go` | 用户注册/登录/登出/信息修改，支持密码登录、2FA、Passkey；错误通过 `i18n` 国际化返回 |
| `token.go` | API Token（令牌）的增删改查，返回前对 key 字段做脱敏处理 |
| `log.go` | 请求日志查询，支持管理员全量查看和普通用户限定范围查看 |
| `billing.go` | 暴露 OpenAI 兼容的 `/v1/dashboard/billing/subscription` 和 `/v1/dashboard/billing/usage` 接口 |
| `option.go` | 系统配置项（SystemOption）的读写，仅管理员可修改 |
| `task.go` | 异步任务（Midjourney/Suno 等）状态查询与管理 |
| `topup.go` | 用户充值入口，对接支付宝（Epay）、Stripe、Creem、Waffo 等支付渠道 |
| `midjourney.go` | Midjourney 代理接口，转发 imagine/upscale/variation 等操作 |
| `model_meta.go` | 模型元数据（ModelMeta）管理，供前端展示模型详情 |
| `channel-billing.go` | 查询并更新上游渠道余额 |
| `passkey.go` | Passkey/WebAuthn 注册与登录流程处理 |
| `pricing.go` | 模型定价信息的查询与同步 |

## For AI Agents

### Working In This Directory
- **Rule 1（JSON）**：禁止直接调用 `encoding/json`，所有 marshal/unmarshal 必须使用 `common.Marshal` / `common.Unmarshal` / `common.DecodeJson` 等 `common/json.go` 中的包装函数。
- **Rule 2（DB 兼容）**：controller 层本身不写 SQL，但若需直接调用 model 函数，须确认该函数已对 SQLite/MySQL/PostgreSQL 三库兼容。
- **Rule 5（保护标识）**：不得修改或删除任何涉及项目名/组织名的注释、包路径、元数据。
- **Rule 6（DTO 指针）**：向上游转发的请求结构体中，可选数值/布尔字段必须使用指针类型加 `omitempty`，不得用非指针值类型。
- 错误响应统一通过 `common.ApiError(c, err)` 或 `common.ApiErrorI18n(c, msgKey)` 返回，不要手写 `c.JSON`（权限/业务错误场景除外）。
- i18n 消息 key 定义在 `i18n/` 包，新增消息需同步添加 en/zh 两份翻译。
- 管理员鉴权通过 middleware 层注入（`middleware.AdminAuth()`），controller 内通过 `c.GetInt("id")` / `c.GetInt("role")` 取当前用户信息，不要重复鉴权。

### Testing Requirements
- 构建验证：`make build`（或 `go build ./...`）
- 单元/集成测试：`go test ./controller/...`
- 测试文件：`channel-test.go`、`model_list_test.go`、`token_test.go`、`payment_webhook_availability_test.go`、`topup_waffo_pancake_test.go`、`channel_test_internal_test.go`

### Common Patterns
- 所有 handler 签名均为 `func Xxx(c *gin.Context)`，通过 `c.GetInt("id")` 获取当前登录用户 ID。
- 分页查询使用 `common.GetPageQuery(c)` 解析请求参数，返回 `pageInfo` 对象（`SetTotal` / `SetItems`）。
- 成功响应：`common.ApiSuccess(c, data)`；错误响应：`common.ApiError(c, err)` 或 `c.JSON(http.StatusXxx, gin.H{...})`。
- 鉴权信息通过 gin Context 传递，key 定义在 `constant/` 包（`ContextKeyXxx`）。
- 中继请求（AI 转发）统一由 `relay.go` 的 `Relay()` / `relayHandler()` 调度，不在其他 controller 文件中直接调用 `relay` 包。

## Dependencies

### Internal
- `service/` — 业务逻辑（计费、渠道选择、token 计数等）
- `model/` — 数据库 CRUD 操作
- `dto/` — 请求/响应数据传输对象
- `common/` — 工具函数（JSON、分页、响应格式化、加密）
- `middleware/` — 鉴权、限流中间件（通过 router 层注入，controller 内直接使用 Context）
- `relay/` — AI 请求中继核心逻辑
- `i18n/` — 国际化消息
- `constant/` — Context key 常量
- `types/` — 错误类型、relay 格式枚举
- `setting/` — 系统配置读取

### External
- `github.com/gin-gonic/gin` — HTTP 框架，Context 是所有 handler 的核心
- `github.com/gin-contrib/sessions` — Session 管理（登录态）
- `github.com/gorilla/websocket` — WebSocket 升级（realtime 路由）
- `github.com/bytedance/gopkg/util/gopool` — 异步任务 goroutine 池

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
