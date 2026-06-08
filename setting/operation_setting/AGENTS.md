<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# setting/operation_setting

## Purpose

管理网关运营层配置，涵盖最多子领域的设置模块：
- 渠道自动禁用关键字（`operation_setting.go`）
- Demo 站点 / 自用模式开关
- 通用运营设置：额度展示类型、自定义货币、Ping 间隔（`general_setting.go`）
- 签到奖励配置（`checkin_setting.go`）
- 监控告警配置（`monitor_setting.go`）
- 支付配置（`payment_setting.go`、`payment_setting_old.go`）
- 额度配置（`quota_setting.go`）
- Token 配置（`token_setting.go`）
- 渠道亲和度（粘性路由）配置（`channel_affinity_setting.go`）
- HTTP 状态码错误范围（`status_code_ranges.go`）
- 工具函数（`tools.go`）

## Key Files

| File | Description |
|------|-------------|
| `operation_setting.go` | 自动禁用关键字列表、Demo/SelfUse 开关 |
| `general_setting.go` | `GeneralSetting`：文档链接、额度展示类型（USD/CNY/TOKENS/CUSTOM）、自定义货币符号与汇率、Ping 间隔；`GetCurrencySymbol`/`IsCurrencyDisplay`/`IsCNYDisplay`/`GetUsdToCurrencyRate` 辅助函数 |
| `checkin_setting.go` | 签到奖励额度范围配置 |
| `monitor_setting.go` | 渠道监控告警阈值、DingTalk 告警（webhook URL/secret/冷却时间）、渠道类型过滤（`AutoTestChannelAllowedTypes`/`AutoTestChannelIgnoredTypes`）；`GetMonitorSetting()` 读取 `CHANNEL_TEST_FREQUENCY` 环境变量覆盖 |
| `monitor_setting_test.go` | DingTalk 字段默认值与 `UpdateConfigFromMap` 反序列化单元测试 |
| `payment_setting.go` | 当前支付配置结构 |
| `payment_setting_old.go` | 旧版支付配置兼容层（迁移过渡用） |
| `quota_setting.go` | 新用户初始额度、邀请奖励等配置 |
| `token_setting.go` | Token 相关限制配置 |
| `channel_affinity_setting.go` | 渠道亲和度（sticky routing）配置 |
| `status_code_ranges.go` | 将 HTTP 状态码映射为错误类型的范围配置 |
| `status_code_ranges_test.go` | 状态码范围单元测试 |
| `tools.go` | 运营配置相关工具函数 |

## For AI Agents

### Working In This Directory

- `general_setting.go` 中的 `QuotaDisplayType` 决定前端和日志中额度的展示方式，修改展示逻辑时先调用 `GetQuotaDisplayType()` / `GetCurrencySymbol()`，不要硬编码货币符号；`GetUsdToCurrencyRate(usdToCny)` 返回 1 USD 对应的目标货币数量（CUSTOM 模式使用 `CustomCurrencyExchangeRate`）。
- `general_setting.go` 还包含 `DocsLink` 字段，控制前端文档链接地址，默认值为 `"https://docs.newapi.pro"`。
- `operation_setting.go` 中的 `AutomaticDisableKeywords` 是全局变量（非 GlobalConfig 体系），上游响应匹配这些关键字时渠道会被自动禁用。
- `monitor_setting.go` 的 `GetMonitorSetting()` 会读取 `CHANNEL_TEST_FREQUENCY` 环境变量动态覆盖自动测试开关和间隔；DingTalk 告警字段通过 GlobalConfig 加载，默认冷却 60 分钟。
- `MonitorSetting` 新增 `AutoTestChannelAllowedTypes`/`AutoTestChannelIgnoredTypes`（`[]int`）用于限制/排除自动测试的渠道类型，空切片表示不过滤。
- 新增支付方式时，在 `payment_setting.go` 中扩展配置结构，同时参考 `setting/` 根目录对应的 `payment_*.go` 适配文件（含 `payment_paddle.go`）。
- 状态码范围配置（`status_code_ranges.go`）影响渠道健康判断逻辑，修改前运行 `status_code_ranges_test.go`。

### Testing Requirements

- 运行 `go test ./setting/operation_setting/...` 覆盖状态码范围逻辑及 DingTalk 告警字段。
- 修改 `general_setting.go` 的货币换算逻辑后，手动验证 `GetCurrencySymbol()`、`IsCurrencyDisplay()` 和 `GetUsdToCurrencyRate()` 返回值。
- 修改 `monitor_setting.go` 后运行 `go test ./setting/operation_setting/...` 验证 `monitor_setting_test.go`。

### Common Patterns

```go
// 获取额度展示货币符号
symbol := operation_setting.GetCurrencySymbol()

// 判断是否以货币形式展示
if operation_setting.IsCurrencyDisplay() {
    rate := operation_setting.GetUsdToCurrencyRate(usdToCnyFromDB)
    // 按 rate 换算
}

// 检查是否命中自动禁用关键字
for _, kw := range operation_setting.AutomaticDisableKeywords {
    if strings.Contains(response, kw) { ... }
}

// 获取监控配置（含 env 覆盖）
ms := operation_setting.GetMonitorSetting()
if ms.DingTalkAlertEnabled {
    // 发送 DingTalk 告警，注意冷却 ms.DingTalkAlertCooldownMinutes 分钟
}
```

## Dependencies

### Internal

- `setting/config/` — `GlobalConfig` 注册框架（部分文件使用，`operation_setting.go` 使用全局变量）

### External

无

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
