# Responses 流启动恢复配置说明

该功能用于处理 `/v1/responses` 流式请求在首个真实 payload 发送前遇到短时渠道故障的场景。

## 适用范围

- 仅作用于 `/v1/responses` 的流式请求
- 仅覆盖首包发送前的阶段
- 首包发出后不会跨渠道续传

## 行为说明

开启后，如果分发层短时间内拿不到可用渠道，或 relay 层在首包前遇到可重试错误，请求不会立即返回失败。

系统会在配置的恢复窗口内：

- 周期性重新探测可用渠道
- 通过 SSE `: PING` 保持客户端连接
- 一旦恢复成功，继续返回真实流数据

如果恢复窗口耗尽仍未成功，则返回 SSE `event: error`。

## 配置项

这些选项位于 `general_setting` 下：

- `responses_stream_bootstrap_recovery_enabled`
  - 是否启用启动恢复
- `responses_stream_bootstrap_grace_period_seconds`
  - 恢复窗口，默认 `180`
- `responses_stream_bootstrap_probe_interval_milliseconds`
  - 渠道探测间隔，默认 `1000`
- `responses_stream_bootstrap_ping_interval_seconds`
  - SSE 保活间隔，默认 `10`
- `responses_stream_bootstrap_retryable_status_codes`
  - 可触发恢复的状态码列表，默认 `[401,403,408,429,500,502,503,504]`

## 建议

- 该功能更适合 CLI、Agent、长连接客户端等需要在短时抖动下保持连接的场景
- 不建议把恢复窗口设置得过长，否则会延迟真实错误暴露
