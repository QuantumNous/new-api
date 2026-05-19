<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# middleware

## Purpose
middleware 层为 new-api 的 Gin 中间件集合，横切处理所有 HTTP 请求的公共关切点：身份鉴权（Session/AccessToken/API Token）、限流（全局/关键接口/邮件/模型级别）、渠道分发（选择满足条件的上游渠道）、日志、CORS、Gzip、i18n 语言检测、安全验证（Turnstile/二次验证）、性能监控等。中间件不包含业务逻辑，通过 gin.Context 在请求链路上传递用户信息和决策结果。

## Key Files
| File | Description |
|------|-------------|
| `auth.go` | 核心鉴权中间件：`UserAuth()`（Session+AccessToken）、`AdminAuth()`、`TokenAuth()`（API Token 令牌鉴权），解析并写入用户 ID/角色/Token 信息到 Context |
| `distributor.go` | 渠道分发中间件 `Distribute()`：解析请求模型名，按令牌分组、优先级、权重从缓存中选择合适的上游渠道，写入 Context 供 controller 使用 |
| `rate-limit.go` | 限流实现：基于 Redis（`redisRateLimiter`）和内存（`inMemoryRateLimiter`）的滑动窗口限流，提供 `GlobalAPIRateLimit`、`CriticalRateLimit`、`EmailVerificationRateLimit` 等 |
| `model-rate-limit.go` | 模型级别请求速率限制（`ModelRequestRateLimit`），按模型名和用户组限制 QPS |
| `logger.go` | Gin 请求日志格式化（`SetUpLogger`），附加 RequestID 和 RouteTag 字段 |
| `cors.go` | CORS 跨域处理，允许所有来源（适用于 API 网关场景） |
| `gzip.go` | 请求体 Gzip 解压中间件（`DecompressRequestMiddleware`） |
| `i18n.go` | i18n 语言检测中间件，从 Accept-Language Header 或 Cookie 中提取语言偏好并写入 Context |
| `turnstile-check.go` | Cloudflare Turnstile 人机验证中间件 |
| `secure_verification.go` | 二次安全验证（密码/Passkey）中间件，用于敏感操作保护 |
| `stats.go` | 请求统计中间件（`StatsMiddleware`），采集请求量等运行指标 |
| `performance.go` | 系统负载检查（`SystemPerformanceCheck`），高负载时拒绝新请求 |
| `body_cleanup.go` | 请求体内存清理（`BodyStorageCleanup`），请求结束后释放缓存的 body |
| `header_nav.go` | HeaderNav 模块鉴权（`HeaderNavModuleAuth`），根据系统配置决定模块是否公开或需要登录 |
| `kling_adapter.go` / `jimeng_adapter.go` | 特定视频生成服务的请求格式适配中间件 |
| `request-id.go` | 为每个请求生成唯一 RequestID 并写入 Context 和响应 Header |
| `cache.go` / `disable-cache.go` | 响应缓存控制 Header 设置 |
| `utils.go` | middleware 内部工具函数（`abortWithOpenAiMessage` 等统一错误响应格式） |

## For AI Agents

### Working In This Directory
- **Rule 1（JSON）**：middleware 内的 JSON 操作同样须使用 `common.Marshal` / `common.Unmarshal`，禁止直接调用 `encoding/json` marshal/unmarshal。
- **Rule 2（DB 兼容）**：middleware 层通过 `model/` 层函数访问数据库（如 `model.ValidateAccessToken`），不直接执行 SQL，无需特殊处理。
- **Rule 5（保护标识）**：不得修改包路径或中间件内涉及项目名/组织名的任何标识。
- 鉴权信息统一通过 `c.Set(constant.ContextKeyXxx, value)` 写入 Context，key 常量必须在 `constant/` 包中定义，不得在 middleware 内硬编码字符串 key。
- 错误响应格式：relay 链路的鉴权/限流错误通过 `abortWithOpenAiMessage(c, httpStatus, message)` 返回 OpenAI 兼容格式；管理 API 错误使用 `c.JSON(status, gin.H{"success": false, "message": ...})`。
- 新增限流中间件时，先评估是否使用 Redis（多节点一致性）还是内存（单机高性能），并考虑 Redis 不可用时的降级策略。
- `Distribute()` 中间件是渠道选择的唯一入口，修改渠道选择逻辑必须在 `service/channel_select.go` 中进行，middleware 层只负责调用和写入结果。

### Testing Requirements
- 构建验证：`go build ./...`
- 单元测试：`go test ./middleware/...`
- 测试文件：`header_nav_test.go`

### Common Patterns
- 所有中间件均以 `gin.HandlerFunc`（或返回 `gin.HandlerFunc` 的工厂函数）形式定义。
- 拒绝请求时统一调用 `c.Abort()` 或 `c.AbortWithStatus()`，不得仅设置状态码后继续 `c.Next()`。
- 从 Context 读取鉴权信息使用 `c.GetInt("id")`、`c.GetString("username")` 等 gin 内置方法，或 `common.GetContextKey(c, constant.ContextKeyXxx)`。
- 限流 key 格式：`"rateLimit:" + mark + c.ClientIP()`，`mark` 用于区分不同限流场景。
- i18n 错误消息通过 `i18n.T(c, i18n.MsgXxx, map[string]any{...})` 格式化后传入响应。

## Dependencies

### Internal
- `model/` — Token/用户/渠道验证（`model.ValidateAccessToken`、`model.GetChannelById` 等）
- `service/` — 渠道选择（`service.CacheGetRandomSatisfiedChannel`）
- `common/` — Redis 客户端、工具函数、Context key 工具
- `constant/` — Context key 常量、渠道类型常量
- `i18n/` — 国际化消息
- `types/` — OpenAI 错误响应类型
- `setting/ratio_setting` — 分组比率配置（渠道分发时使用）

### External
- `github.com/gin-gonic/gin` — 中间件框架
- `github.com/gin-contrib/sessions` — Session 存储（用户登录态）
- `github.com/go-redis/redis/v9` （通过 `common.RDB`）— Redis 限流存储

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
