<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# setting

## Purpose

统一管理网关的所有运行时配置。所有配置项通过 `setting/config/GlobalConfig` 注册，支持从数据库动态加载与持久化，各子目录按领域职责独立拆分。根目录下还保留了若干遗留的全局变量式配置文件（`rate_limit.go`、`sensitive.go`、`chat.go` 等），尚未迁移至 `config.GlobalConfig` 体系。

## Key Files

| File | Description |
|------|-------------|
| `auto_group.go` | 自动分组相关配置与逻辑 |
| `chat.go` | 聊天功能全局开关与配置 |
| `midjourney.go` | Midjourney 渠道专属配置 |
| `payment_creem.go` | Creem 支付集成配置 |
| `payment_stripe.go` | Stripe 支付集成配置 |
| `payment_paddle.go` | Paddle 支付集成配置（全局变量 + `ApplyPaddleEnvOverrides`/`EffectivePaddleSandbox`/`ValidatePaddleOption`） |
| `payment_paddle_test.go` | Paddle 配置单元测试（env override、sandbox 判定、格式校验） |
| `payment_waffo.go` | Waffo 支付集成配置 |
| `payment_waffo_pancake.go` | Waffo Pancake 支付集成配置 |
| `rate_limit.go` | 全局限流参数 |
| `sensitive.go` | 敏感词过滤配置 |
| `user_usable_group.go` | 用户可用分组配置 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `billing_setting/` | 计费模式配置（ratio 固定倍率 / tiered_expr 表达式计费） |
| `config/` | 配置管理框架：`GlobalConfig` 注册中心、DB 序列化/反序列化通用逻辑 |
| `console_setting/` | 管理控制台 UI 配置（公告、FAQ、API 信息、Uptime Kuma 面板开关） |
| `model_setting/` | 模型层配置（透传开关、思维模型黑名单、Claude/Gemini/Qwen/Grok 专属参数） |
| `operation_setting/` | 运营配置（自动禁用关键字、签到、监控告警、支付、额度、Token、渠道亲和度等） |
| `perf_metrics_setting/` | 性能指标采集配置（采集开关、刷新间隔、桶时间、保留天数） |
| `performance_setting/` | 运行时性能优化配置（磁盘缓存、CPU/内存/磁盘监控阈值） |
| `ratio_setting/` | 模型计费比率配置（模型比率、分组比率、暴露比率、缓存比率） |
| `reasoning/` | 推理模型 effort 后缀解析（-high/-low/-max 等后缀处理） |
| `system_setting/` | 系统级配置（OIDC、Passkey、Discord、主题、法律声明、SSRF 防护） |

## For AI Agents

### Working In This Directory

- 新增配置项必须在对应子目录的 `init()` 中通过 `config.GlobalConfig.Register(name, &struct)` 注册，DB 存储键格式为 `<name>.<json_tag>`。
- 根目录的遗留文件（`rate_limit.go`、`sensitive.go` 等）使用全局变量直接赋值，与 `GlobalConfig` 体系无关，修改时不需要调用 Register。
- 配置读取是热路径，避免在 getter 函数内引入锁或复杂计算。
- 若需跨子包同步配置到 `common` 包，参考 `performance_setting/config.go` 中的 `syncToCommon()` 模式。

### Testing Requirements

- `setting/config/config_test.go` 覆盖序列化/反序列化；修改 `config/config.go` 后必须运行 `go test ./setting/config/...`。
- `setting/model_setting/claude_test.go` 覆盖 Claude 模型配置；修改 claude.go 后运行 `go test ./setting/model_setting/...`。
- `setting/operation_setting/status_code_ranges_test.go` 覆盖状态码范围；修改后运行 `go test ./setting/operation_setting/...`。
- `setting/operation_setting/monitor_setting_test.go` 覆盖 DingTalk 告警字段与渠道类型过滤；修改 monitor_setting.go 后运行 `go test ./setting/operation_setting/...`。
- `setting/payment_paddle_test.go` 覆盖 Paddle env override、sandbox 判定、格式校验；修改 payment_paddle.go 后运行 `go test ./setting/...`。

### Common Patterns

```go
// 在子包 init() 中注册
func init() {
    config.GlobalConfig.Register("my_setting", &mySetting)
}

// Getter 直接返回包级变量指针
func GetMySetting() *MySetting {
    return &mySetting
}
```

## Dependencies

### Internal

- `common/` — `SysError`、`SysLog`、磁盘缓存/监控配置接口
- `setting/config/` — `GlobalConfig` 注册与序列化框架（所有子目录依赖）
- `pkg/billingexpr/` — 表达式计费引擎（`billing_setting` 依赖）
- `types/` — relay 类型定义（`ratio_setting` 依赖）

### External

- `github.com/samber/lo` — 集合工具函数（`reasoning`、`billing_setting` 使用）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
