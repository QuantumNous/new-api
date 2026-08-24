# Flatkey 渠道 Prometheus 健康监控设计

## 目标

在不改变现有模型级指标语义、不影响计费和渠道路由的前提下，为每一次真实上游渠道尝试记录低基数 Prometheus 指标。AWS 自建 Grafana 使用现有 `Google-Prometheus` 数据源展示渠道 RPM、TPM、成功率、超时率、P50/P95/P99、错误分类，并支持按模型下钻。

## 已确认约束

- Google Managed Service for Prometheus 抓取间隔保持 30 秒；仓库中的 `RunMonitoring` 已配置 `interval: 30s`，无需修改 Terraform。
- 渠道尝试必须包含重试。第一次渠道失败、第二次渠道成功时，两次尝试都要记录。
- `client_cancel` 单独记录，但不计入渠道故障率。
- 渠道名称只出现在独立 info 指标中；其余指标使用稳定的 `channel_id`，避免渠道改名重建全部时序。
- 渠道与模型组合只保留请求、Token 和成功/失败数据，不给耗时直方图增加 `model` 标签。
- 不修改其他业务、看板、数据源或无关基础设施。

## 方案选择

采用现有 `pkg/perf_metrics` 自定义 Prometheus 文本导出器的扩展方案，而不是引入新的全局 Prometheus registry。

原因：现有 `/metrics`、鉴权、Cloud Run sidecar 和 30 秒抓取已经在线工作；扩展当前进程内并发安全计数器的改动面最小，也不会改变已有 `newapi_model_requests_total` 的含义。

## 指标契约

### 渠道身份

```text
newapi_channel_info{channel_id="42",channel_name="openai-primary"} 1
```

渠道名称仅用于 Grafana 展示和 join。

### 渠道尝试

```text
newapi_channel_attempts_total{channel_id="42",status="success",error_category="none"}
newapi_channel_attempts_total{channel_id="42",status="error",error_category="timeout"}
newapi_channel_attempts_total{channel_id="42",status="client_cancel",error_category="client_cancel"}
```

允许的错误分类固定为：

- `none`
- `timeout`
- `rate_limit`
- `auth`
- `upstream_4xx`
- `upstream_5xx`
- `network`
- `bad_response`
- `client_cancel`
- `other`

### 渠道总耗时与 TTFT

```text
newapi_channel_request_duration_seconds_bucket{channel_id="42",le="..."}
newapi_channel_request_duration_seconds_sum{channel_id="42"}
newapi_channel_request_duration_seconds_count{channel_id="42"}
newapi_channel_ttft_seconds_sum{channel_id="42"}
newapi_channel_ttft_seconds_count{channel_id="42"}
```

耗时桶覆盖 250ms 到 600s，并输出 `+Inf`。P50/P95/P99 由 Grafana 的 `histogram_quantile` 计算。TTFT 只在已收到首个响应时记录。

### 渠道与模型下钻

```text
newapi_channel_model_attempts_total{channel_id="42",model="gpt-5",status="success"}
newapi_channel_model_input_tokens_total{channel_id="42",model="gpt-5"}
newapi_channel_model_output_tokens_total{channel_id="42",model="gpt-5"}
```

Token 使用成功结算阶段的真实 usage；请求次数和耗时在 controller 的每次真实上游尝试边界记录。

## 数据流

1. `controller/relay.go` 选出渠道并准备好请求体。
2. 在调用具体 relay helper 前保存 `attemptStartedAt`。
3. helper 返回后立即记录渠道尝试、耗时、TTFT、状态和错误分类。
4. 如果失败且满足重试条件，下一次循环作为新的渠道尝试单独记录。
5. 成功结算时，`service/text_quota.go` 或 `service/quota.go` 补充真实输入/输出 Token。
6. `/metrics` 暴露累计 counter、histogram 和 info 指标，Cloud Run sidecar 每 30 秒抓取到 Google Managed Prometheus。
7. AWS Grafana 通过现有 `Google-Prometheus` 数据源执行 PromQL。

## 错误分类规则

分类优先级为：客户端取消、超时、限流、鉴权、坏响应、网络错误、上游 4xx、上游 5xx、其他。分类只读取标准错误链、`NewAPIError` 的稳定错误码和 HTTP 状态码，不使用上游错误文本作为标签。

## Grafana 看板

Flatkey 文件夹新增“渠道健康”看板，默认 5 分钟速率窗口：

- 顶部：总 RPM、总 TPM、异常渠道数、整体成功率。
- 主表：渠道状态、RPM、TPM、成功率、超时率、P50、P95、P99、主要错误；异常渠道优先。
- 下钻：选中渠道后的延迟趋势、错误分类占比、异常模型排行。
- 成功率分母排除 `status="client_cancel"`。

关键 PromQL：

```promql
sum by (channel_id) (rate(newapi_channel_attempts_total[5m])) * 60

sum by (channel_id) (
  rate(newapi_channel_model_input_tokens_total[5m])
  + rate(newapi_channel_model_output_tokens_total[5m])
) * 60

histogram_quantile(
  0.95,
  sum by (channel_id, le) (rate(newapi_channel_request_duration_seconds_bucket[5m]))
)
```

## 并发与多实例

指标是每个 Cloud Run 实例的进程内累计值。Google Managed Prometheus 使用 `instance`、`service`、`revision` 目标标签区分实例；Grafana 查询通过 `sum by (channel_id, ...)` 聚合所有实例。指标不参与业务正确性，不需要跨实例锁或数据库持久化。

## 测试与验收

- 单元测试先验证新指标缺失而失败，再实现计数器。
- 验证重试场景可记录同一请求的两次渠道尝试。
- 验证直方图桶为累计值，且输出 `_sum`、`_count`。
- 验证固定错误分类和 `client_cancel` 独立状态。
- 验证渠道名称转义，且不会出现在高频指标标签中。
- 验证 Token 的输入/输出分别累计到渠道+模型。
- 运行 `go test ./pkg/perf_metrics/...`、相关 controller/service 测试、`go test ./...` 和 `go build ./...`。
- 部署后在 `/metrics`、Google PromQL 和 AWS Grafana 三层验证新时序可见。

## 成本边界

直方图只按渠道维度，模型不进入 bucket 标签；渠道+模型只输出少量 counter。这个结构对应已核算的 30 秒抓取成本区间，避免按请求 ID、错误文本、渠道名称或用户维度产生高基数时序。
