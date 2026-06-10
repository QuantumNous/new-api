<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-10 -->

# service

## Purpose
service 层是 new-api 分层架构（Router→Controller→Service→Model）的第三层，承载核心业务逻辑：计费结算、额度管理、渠道选择与重试、Token 计数估算、任务调度、文件处理、支付对接等。该层不直接暴露 HTTP 路由，对 controller 层提供函数调用接口，向 model 层请求数据，并可直接操作 Redis 缓存及外部 HTTP 服务。

## Key Files
| File | Description |
|------|-------------|
| `billing.go` | 计费入口：`PreConsumeBilling` / `SettleBilling` / `RefundBilling`，基于 BillingSession 管理预扣与结算全流程 |
| `quota.go` | 额度计算核心：按 token 类型（文本/音频/图片）、model ratio、group ratio 计算实际消耗额度，调用 `billingexpr` 支持表达式计费 |
| `pre_consume_quota.go` | 请求前预扣费：校验用户/令牌余额、执行 DB 预扣，返还失败时的预扣费 |
| `channel_select.go` | 渠道选择与重试：`CacheGetRandomSatisfiedChannel` 按优先级/权重从缓存中选取满足条件的渠道，支持跨分组重试 |
| `tiered_settle.go` | 分层结算：按阶梯定价规则对 token 消耗分段计费 |
| `task_billing.go` | 异步任务（图片/视频生成等）的计费处理 |
| `token_counter.go` | 图片/文件 token 计数，按模型类型（GPT-4o、Patch-based 等）计算 token 数 |
| `token_estimator.go` | 请求发送前的 token 数预估，用于预扣费计算 |
| `channel.go` | 渠道健康管理：自动禁用/恢复渠道，记录错误日志 |
| `channel_affinity.go` | 渠道亲和性缓存：优先将同一 token 的请求路由到上次成功的渠道 |
| `http_client.go` | 统一 HTTP 客户端配置（超时、代理等） |
| `webhook.go` | 通用 Webhook 发送工具 |
| `epay.go` / `waffo_pancake.go` | 支付对接：易支付（Epay）、Waffo Pancake 支付回调处理 |
| `blog_cms.go` | 远程 CMS 博客服务：`FetchBlogList` / `FetchBlogPost` 通过 HTTP 调用 `apps.voc.ai`（或 `BLOG_CMS_HOST` 环境变量覆盖）的 `/n/blog/listDataV2` 和 `/n/blog/detailData` 接口，将原始响应映射为 `BlogPost`/`BlogListResult` 结构；`ParseBlogCategoryIDs`（逗号分隔字符串 → `[]int`）供 controller 层调用；`BLOG_CMS_SITE`、`BLOG_CMS_CATEGORY_IDS` 可通过环境变量覆盖默认站点和分类 |
| `codex_oauth.go` / `codex_credential_refresh.go` | GitHub Copilot（Codex）OAuth 凭证获取与定时刷新 |
| `sensitive.go` | 敏感词检测 |
| `user_notify.go` | 用户通知（邮件/Webhook）发送 |
| `subscription_reset_task.go` | 订阅套餐周期重置定时任务 |

## Subdirectories

| Directory | Description |
|-----------|-------------|
| `openaicompat/` | OpenAI Chat Completions ↔ Responses API 双向转换层（see `openaicompat/AGENTS.md`） |
| `passkey/` | WebAuthn/Passkey 认证服务：BuildWebAuthn、session 存储、WebAuthnUser 适配（see `passkey/AGENTS.md`） |

## For AI Agents

### Working In This Directory
- **Rule 1（JSON）**：所有 JSON 操作必须使用 `common.Marshal` / `common.Unmarshal` / `common.DecodeJson`，禁止直接调用 `encoding/json` 的 marshal/unmarshal。
- **Rule 2（DB 兼容）**：service 层通过调用 `model/` 层函数间接访问数据库；若直接调用 `model.DB`，必须保证 SQLite/MySQL/PostgreSQL 三库兼容（使用 `commonGroupCol`、`commonKeyCol`、`common.UsingPostgreSQL` 等）。
- **Rule 5（DTO 指针）**：构造上游请求 DTO 时，可选字段必须用指针类型加 `omitempty`，零值不能被 omit。
- **Rule 6（计费表达式）**：修改计费逻辑前必须先读 `pkg/billingexpr/expr.md`，遵循其中的变量定义、token 归一化规则和版本化约定。
- service 层函数不得直接持有或返回 `*gorm.DB`，数据库访问统一通过 `model/` 包函数完成。
- 耗时操作（如通知、日志写入）通过 `gopool.Go(func(){...})` 异步执行，避免阻塞请求链路。
- 渠道错误处理遵循 `types.NewAPIError` / `types.NewError` 规范，携带 `ErrorCode` 和重试策略选项。

### Testing Requirements
- 构建验证：`go build ./...`
- 单元测试：`go test ./service/...`
- 测试文件：`task_billing_test.go`、`tiered_settle_test.go`、`text_quota_test.go`、`error_test.go`、`waffo_pancake_test.go`、`channel_affinity_usage_cache_test.go`、`blog_cms_test.go`

### Common Patterns
- 函数签名通常接受 `*gin.Context` + `*relaycommon.RelayInfo` 作为核心参数，计费相关函数还接受 `preConsumedQuota int`。
- 错误返回使用 `*types.NewAPIError`（relay 链路）或 `error`（内部工具函数），两者不混用。
- 渠道选择使用 `RetryParam` 结构跟踪重试次数和当前分组状态。
- 异步任务通过 `gopool.Go` 提交，不直接启动 `go` goroutine。
- 精度敏感的额度计算使用 `github.com/shopspring/decimal`，避免浮点精度问题。

## Dependencies

### Internal
- `model/` — 数据库 CRUD（用户额度、渠道、日志、Token）
- `relay/common` — RelayInfo 结构（请求上下文）
- `common/` — 工具函数、Redis 客户端、配置常量
- `dto/` — 请求/响应结构体
- `types/` — 错误类型定义
- `pkg/billingexpr` — 表达式计费引擎
- `pkg/perf_metrics` — 性能指标采集
- `setting/ratio_setting` — 模型/分组比率配置
- `constant/` — 业务常量
- `i18n/` — 国际化消息

### External
- `github.com/gin-gonic/gin` — Context 传递（日志、请求信息）
- `github.com/bytedance/gopkg/util/gopool` — 异步 goroutine 池
- `github.com/shopspring/decimal` — 高精度十进制计算
- `github.com/samber/lo` — 泛型集合工具

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
