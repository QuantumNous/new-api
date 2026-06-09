<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# controller

## Purpose
controller 层是 new-api 分层架构（Router→Controller→Service→Model）的第二层，负责接收 Gin 路由分发的 HTTP 请求、解析参数、调用 service/model 完成业务逻辑，并将结果以统一格式（`common.ApiSuccess` / `common.ApiError` / `common.ApiErrorI18n`）返回给客户端。该层不直接操作数据库，也不包含核心业务算法，是 HTTP 层与业务层之间的薄胶水层。

## Key Files
| File | Description |
|------|-------------|
| `relay.go` | AI 请求中继核心入口，按 RelayMode 分发到 `relay` 包各 Helper（Text/Image/Audio/Embedding/Responses），同时处理 WebSocket realtime 连接 |
| `channel.go` | 渠道（Channel）管理 CRUD，包含模型列表查询、渠道状态过滤、按类型获取模型映射 |
| `channel_affinity_cache.go` | 渠道亲和力缓存统计查询与清除（`GetChannelAffinityCacheStats` / `ClearChannelAffinityCache`） |
| `channel_upstream_update.go` | 批量并发测试并更新上游渠道模型列表（支持 Gemini / Ollama 等自动同步） |
| `user.go` | 用户注册/登录/登出/信息修改，支持密码登录、2FA、Passkey；错误通过 `i18n` 国际化返回 |
| `token.go` | API Token（令牌）的增删改查，返回前对 key 字段做脱敏处理 |
| `log.go` | 请求日志查询，支持管理员全量查看和普通用户限定范围查看 |
| `billing.go` | 暴露 OpenAI 兼容的 `/v1/dashboard/billing/subscription` 和 `/v1/dashboard/billing/usage` 接口 |
| `option.go` | 系统配置项（SystemOption）的读写，仅管理员可修改 |
| `task.go` | 异步任务（Midjourney/Suno 等）状态查询与管理 |
| `task_video.go` | 视频生成异步任务的中继与状态拉取（`RelayTask` / `RelayTaskFetch`），对接 relay 包 channel 适配器 |
| `topup.go` | 用户充值入口（Epay），调度各支付渠道子 handler |
| `topup_stripe.go` / `topup_creem.go` / `topup_paddle.go` / `topup_waffo.go` / `topup_waffo_pancake.go` | 各支付渠道充值 handler（Stripe / Creem / Paddle / Waffo / Waffo-Pancake） |
| `subscription.go` | 订阅计划查询与管理（通用 DTO，供各支付渠道子文件调用） |
| `subscription_payment_stripe.go` / `subscription_payment_creem.go` / `subscription_payment_epay.go` / `subscription_payment_waffo_pancake.go` | 各支付渠道的订阅购买与 Webhook 处理 |
| `midjourney.go` | Midjourney 代理接口，转发 imagine/upscale/variation 等操作 |
| `model_meta.go` | 模型元数据（ModelMeta）管理，供前端展示模型详情 |
| `model.go` | 模型列表、模型所属渠道等信息查询（OpenAI 兼容 `/v1/models` 等） |
| `model_sync.go` | 从上游同步模型定价信息（批量并发，支持多渠道类型） |
| `channel-billing.go` | 查询并更新上游渠道余额 |
| `passkey.go` | Passkey/WebAuthn 注册与登录流程处理 |
| `pricing.go` | 模型定价信息的查询与同步 |
| `ratio_config.go` | 暴露倍率配置接口（可通过 `ratio_setting.IsExposeRatioEnabled()` 开关控制） |
| `ratio_sync.go` | 从远程或本地同步渠道/模型倍率配置（批量并发） |
| `video_proxy.go` | 视频内容代理接口 `VideoProxy`，将已完成任务的实际 MP4 流式代理给客户端 |
| `video_proxy_blockrun.go` / `video_proxy_gemini.go` / `video_proxy_kuaizi.go` | 各视频供应商（BlockRun / Gemini / Kuaizi）真实 URL 提取逻辑 |
| `usage_reconciliation.go` | 对账数据接口（`GetUsageSummary` / `GetUsageTransactions`），供第三方结算系统查询 |
| `usedata.go` | 用量统计数据查询（`GetAllQuotaDates`，按时间段/用户汇总） |
| `perf_metrics.go` | 性能指标摘要查询（`GetPerfMetricsSummary`），从 `pkg/perf_metrics` 读取近 N 小时数据 |
| `performance.go` | 系统运行时性能信息查询（goroutine 数、GC、内存、CPU 等） |
| `rankings.go` | 用户/模型排行榜快照查询（`GetRankings`，支持 week/month 等周期） |
| `group.go` | 分组（用量分组）列表查询 |
| `prefill_group.go` | 预填组（PrefillGroup）的 CRUD，支持按类型过滤 |
| `redemption.go` | 兑换码（Redemption）管理及用户兑换操作 |
| `checkin.go` | 用户每日签到状态与历史记录查询及签到操作 |
| `vendor_meta.go` | 供应商元数据（VendorMeta）分页查询与管理 |
| `deployment.go` | io.net 模型部署接口代理（`getIoAPIKey`，透传到 `pkg/ionet`） |
| `codex_oauth.go` | Codex（GitHub Copilot）OAuth 授权流程 handler |
| `codex_usage.go` | Codex 用量查询 handler，从上游聚合并缓存结果 |
| `playground.go` | 站内 Playground 接口，通过 `middleware.Distribute()` 选渠道后调用 relay 转发 |
| `misc.go` | 杂项接口（系统状态信息、OAuth 登录列表、主页通知等） |
| `missing_models.go` | 查询被渠道引用但缺少 ModelMeta 记录的模型名列表 |
| `setup.go` | 初始化安装向导接口（系统首次启动时创建 root 账户等） |
| `console_migrate.go` | 旧版控制台配置迁移（临时文件，下版本将删除） |
| `paddle_client_token.go` | Paddle 客户端 token 下发（前端支付 SDK 初始化用） |
| `payment_compliance.go` | 支付合规确认接口（用户确认支付条款） |
| `payment_webhook_availability.go` | Webhook 可用性自检接口 |
| `return_path.go` | 支付跳转 return_path 路径构建工具函数（`paymentReturnPath`） |
| `image.go` | 图片接口（当前为空实现占位） |
| `swag_video.go` | Swagger 文档注解入口（视频接口），不含逻辑 |
| `uptime_kuma.go` | Uptime Kuma 健康探针接口 |
| `oauth.go` / `github.go` / `discord.go` / `wechat.go` / `oidc.go` / `linuxdo.go` / `telegram.go` / `custom_oauth.go` | 各 OAuth 提供商登录回调 handler |
| `twofa.go` | 两步验证（TOTP）管理接口 |
| `secure_verification.go` | 敏感操作二次安全验证 handler（密码/Passkey 验证） |

## For AI Agents

### Working In This Directory
- **Rule 1（JSON）**：禁止直接调用 `encoding/json`，所有 marshal/unmarshal 必须使用 `common.Marshal` / `common.Unmarshal` / `common.DecodeJson` 等 `common/json.go` 中的包装函数。注意：`console_migrate.go` 例外性地使用了 `encoding/json`，这是临时迁移文件，下版本删除，勿仿照。
- **Rule 2（DB 兼容）**：controller 层本身不写 SQL，但若需直接调用 model 函数，须确认该函数已对 SQLite/MySQL/PostgreSQL 三库兼容。
- **Rule 5（DTO 指针）**：向上游转发的请求结构体中，可选数值/布尔字段必须使用指针类型加 `omitempty`，不得用非指针值类型。
- 错误响应统一通过 `common.ApiError(c, err)` 或 `common.ApiErrorI18n(c, msgKey)` 返回，不要手写 `c.JSON`（权限/业务错误场景除外）。
- i18n 消息 key 定义在 `i18n/` 包，新增消息需同步添加 en/zh 两份翻译。
- 管理员鉴权通过 middleware 层注入（`middleware.AdminAuth()`），controller 内通过 `c.GetInt("id")` / `c.GetInt("role")` 取当前用户信息，不要重复鉴权。
- 视频代理（`video_proxy*.go`）：各供应商提取真实 URL 的逻辑拆分到独立文件，`VideoProxy` 是统一入口，新增供应商需在 `video_proxy.go` 的 dispatch 逻辑中注册，并新建对应 `video_proxy_xxx.go`。

### Testing Requirements
- 构建验证：`make build`（或 `go build ./...`）
- 单元/集成测试：`go test ./controller/...`
- 测试文件：`channel-test.go`、`channel_test_internal_test.go`、`channel_test_stream_options_test.go`、`channel_upstream_update_test.go`、`model_list_test.go`、`model_owned_by_test.go`、`token_test.go`、`payment_webhook_availability_test.go`、`topup_waffo_pancake_test.go`、`topup_paddle_test.go`、`topup_stripe_test.go`、`codex_usage_test.go`、`usage_reconciliation_test.go`、`usedata_test.go`、`user_models_test.go`

### Common Patterns
- 所有 handler 签名均为 `func Xxx(c *gin.Context)`，通过 `c.GetInt("id")` 获取当前登录用户 ID。
- 分页查询使用 `common.GetPageQuery(c)` 解析请求参数，返回 `pageInfo` 对象（`SetTotal` / `SetItems`）。
- 成功响应：`common.ApiSuccess(c, data)`；错误响应：`common.ApiError(c, err)` 或 `c.JSON(http.StatusXxx, gin.H{...})`。
- 鉴权信息通过 gin Context 传递，key 定义在 `constant/` 包（`ContextKeyXxx`）。
- 中继请求（AI 转发）统一由 `relay.go` 的 `Relay()` / `relayHandler()` 调度，不在其他 controller 文件中直接调用 `relay` 包（`task_video.go` 和 `playground.go` 例外，它们分别对接异步任务和 Playground 路由）。

## Dependencies

### Internal
- `service/` — 业务逻辑（计费、渠道选择、token 计数、排行榜快照等）
- `model/` — 数据库 CRUD 操作
- `dto/` — 请求/响应数据传输对象
- `common/` — 工具函数（JSON、分页、响应格式化、加密）
- `middleware/` — 鉴权、限流中间件（通过 router 层注入，controller 内直接使用 Context）
- `relay/` — AI 请求中继核心逻辑
- `relay/channel/task/` — 异步任务 channel 适配器（视频生成等）
- `i18n/` — 国际化消息
- `constant/` — Context key 常量
- `types/` — 错误类型、relay 格式枚举
- `setting/` — 系统配置读取
- `pkg/perf_metrics` — 性能指标采集
- `pkg/ionet` — io.net HTTP 客户端（deployment.go）

### External
- `github.com/gin-gonic/gin` — HTTP 框架，Context 是所有 handler 的核心
- `github.com/gin-contrib/sessions` — Session 管理（登录态）
- `github.com/gorilla/websocket` — WebSocket 升级（realtime 路由）
- `github.com/bytedance/gopkg/util/gopool` — 异步任务 goroutine 池
- `github.com/shopspring/decimal` — 对账金额精度计算（usage_reconciliation.go）
- `golang.org/x/sync/errgroup` — 并发请求编排（uptime_kuma.go）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
