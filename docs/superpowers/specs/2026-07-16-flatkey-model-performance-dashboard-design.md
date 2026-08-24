# Flatkey 模型性能仪表盘设计

日期：2026-07-16
状态：设计与书面规格已由用户确认，等待实施计划
目标系统：NewAPI Router、Google-Prometheus、生产 Grafana `flatkey` 文件夹

## 1. 背景与现状证据

生产 Grafana `flatkey` 文件夹当前包含：

- `Flatkey Channel Health 渠道健康`
- `Flatkey Router 模型成功率`
- `渠道限流与卡死明细（账号池/Codex）`

现有看板使用 `Google-Prometheus` 数据源。模型成功率看板已经通过
`newapi_model_requests_total{model,status}` 展示模型成功率、请求率和错误率，但面板说明明确避免 latency histogram。

现有渠道延迟面板使用：

```promql
histogram_quantile(
  0.95,
  sum by (channel_id, le) (
    rate(newapi_channel_request_duration_seconds_bucket[5m])
  )
)
```

该指标只带 `channel_id`，记录单次真实上游渠道尝试。现有
`newapi_channel_ttft_seconds` 也是渠道维度 summary，仅输出 `sum/count`。因此当前指标不能准确计算：

- 按模型的端到端 Latency p50/p95/p99；
- 按模型的 TTFT p50/p95/p99；
- 按模型的最终失败分类和超时率。

## 2. 目标与非目标

### 2.1 目标

1. 以用户感知的完整 Relay 请求为样本，提供按模型的端到端 Latency p50/p95/p99。
2. 仅对成功流式请求且实际收到首 token 的样本提供 TTFT p50/p95/p99。
3. 明确展示 TTFT 样本数和覆盖率，避免低样本或无流式样本造成误判。
4. 复用现有请求、成功率和 Token counter，展示模型 RPS、成功率、错误率、输入/输出 Token 吞吐。
5. 记录重试结束后的最终失败分类，按模型区分 timeout、rate limit、auth、network、upstream 4xx/5xx 等错误。
6. 新建一个兼顾全模型巡检和单模型下钻的 Grafana 仪表盘。
7. 在多 Router 节点部署下保持 PromQL 语义正确，并严格控制 Prometheus series 基数。

### 2.2 非目标

- 不把单次渠道 attempt latency 当作模型端到端 latency；渠道诊断继续由现有渠道健康看板承担。
- 不增加 `api_key`、用户、分组或 `channel_id` 到新的模型 histogram 标签。
- 不为首版创建 Grafana 告警规则；颜色和排序只用于视觉巡检。
- 不回填新指标上线前的历史分位数。
- 不新增依赖，不引入日志或数据库分位数计算链路。

## 3. 已确认的产品决策

- 实现范围：补充 NewAPI 指标并创建完整 Grafana 仪表盘。
- Latency 口径：端到端请求耗时，不是单次上游渠道尝试耗时。
- Latency 样本：只统计成功请求；错误和超时单独展示。
- TTFT 样本：只统计成功流式请求且确实收到首 token 的样本。
- 使用方式：上半部分进行全模型巡检，下半部分按模型变量下钻。
- 布局：运维优先混合布局。
- 默认低样本门槛：当前查询窗口至少 20 个样本。

## 4. 架构与数据流

```text
Relay 请求生命周期
  -> RecordRelaySample（唯一端到端采样点）
     -> 现有数据库性能聚合（行为保持不变）
     -> 新模型 Latency / TTFT histogram
     -> 新模型流式成功 counter
     -> 新模型最终错误分类 counter
  -> /metrics 自定义 exposition
  -> Google-Prometheus 按 Router 实例抓取
  -> Grafana 先按 model/le 合并实例 bucket，再计算 quantile
```

新 histogram 使用 `RelayInfo.OriginModelName` 作为 `model` 标签，与现有模型 counter 和渠道模型 Token counter 对齐。

模型指标和渠道指标保持语义隔离：

- 模型指标回答“用户调用这个模型的最终体验如何”；
- 渠道指标回答“某一次真实上游尝试和某个渠道的健康度如何”。

## 5. Prometheus 指标 Contract

| 指标 | 类型与标签 | 采样口径 | 用途 |
| --- | --- | --- | --- |
| `newapi_model_request_duration_seconds` | histogram：`model`,`le` | 成功请求；`StartTime` 到请求完成 | Latency p50/p95/p99 |
| `newapi_model_ttft_seconds` | histogram：`model`,`le` | 成功流式请求且收到首 token；`StartTime` 到 `FirstResponseTime` | TTFT p50/p95/p99、样本数 |
| `newapi_model_stream_success_total` | counter：`model` | 所有成功流式请求 | TTFT 覆盖率分母 |
| `newapi_model_errors_total` | counter：`model`,`error_category` | 重试结束后的最终请求失败 | 最终错误率和超时率 |
| `newapi_model_requests_total` | 现有 counter：`model`,`status` | 所有模型请求 | RPS、成功率、错误率 |
| `newapi_channel_model_input_tokens_total` | 现有 counter：`channel_id`,`model` | 实际结算输入 Token | 按模型汇总输入 Token/s |
| `newapi_channel_model_output_tokens_total` | 现有 counter：`channel_id`,`model` | 实际结算输出 Token | 按模型汇总输出 Token/s |

### 5.1 Bucket

Latency bucket（秒）沿用现有渠道耗时边界：

```text
0.25, 0.5, 1, 2, 3, 5, 10, 15, 30, 60, 120, 300, 600, +Inf
```

TTFT bucket（秒）强化快速首 token 区间：

```text
0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 15, 30, 60, +Inf
```

每个 histogram 还输出 `_sum` 和 `_count`。

### 5.2 最终错误分类

`newapi_model_errors_total` 复用现有 `classifyChannelError` 的稳定低基数分类：

- `client_cancel`
- `timeout`
- `rate_limit`
- `auth`
- `bad_response`
- `network`
- `upstream_4xx`
- `upstream_5xx`
- `other`

该 counter 只记录最终失败，不记录中间重试 attempt。现有渠道 attempt error 指标保持不变。

## 6. 采样语义

### 6.1 成功请求

`RecordRelaySample` 在成功结算路径被调用时：

1. 继续写入现有数据库/内存性能聚合。
2. 增加 `newapi_model_requests_total{status="success"}`，保持现有行为。
3. 将端到端耗时记录到模型 Latency histogram。
4. 如果 `info.IsStream`，增加 `newapi_model_stream_success_total`。
5. 如果同时满足 `info.HasSendResponse()` 且时间戳有效，将 TTFT 记录到模型 TTFT histogram。

### 6.2 失败请求

最终重试失败路径把 `*types.NewAPIError` 传给模型采样逻辑：

1. 继续增加现有 `newapi_model_requests_total{status="error"}`。
2. 不记录 Latency histogram。
3. 不记录 TTFT histogram。
4. 使用 `classifyChannelError` 产生一个最终 `error_category`，增加 `newapi_model_errors_total`。

客户端取消计入最终失败分类，但不进入成功请求 Latency 分布。

### 6.3 无效样本

- `info == nil` 或 `OriginModelName == ""`：不创建模型 Prometheus series。
- `StartTime` 无效、未来时间或计算结果为负：不观察 histogram，并增加 dropped-sample counter。
- 成功流式请求已发送响应，但 `FirstResponseTime` 无效或早于 `StartTime`：不观察 TTFT，并增加 dropped-sample counter；没有收到首 token 的正常流式结束不属于无效样本，只通过覆盖率体现。
- 非流式成功请求：记录 Latency，不记录 TTFT，也不增加流式成功 counter。

## 7. 基数、内存和多节点安全

### 7.1 Series 预算

每个活跃模型最坏约新增：

- Latency histogram：16 series；
- TTFT histogram：14 series；
- 流式成功 counter：1 series；
- 最终错误分类：最多 9 series。

合计最坏约 40 series/活跃模型；实际错误分类通常低于最坏值。

两个 histogram、流式成功 counter 和最终错误 counter 组成同一个“模型性能指标组”，按模型共同准入、共同刷新活跃时间并共同淘汰，避免 TTFT 覆盖率的分子、分母或错误分类与 histogram 生命周期不一致。现有 `newapi_model_requests_total` 和渠道指标不受该指标组上限影响。

保护策略：

1. 新模型性能指标组的独立空闲淘汰时间为 1 小时；Prometheus 已抓取的历史数据不受影响。
2. 默认最多保留 50 个活跃模型性能指标组，可通过 `PROMETHEUS_MAX_MODEL_HISTOGRAM_MODELS` 调整。达到上限时，新模型不创建部分指标组，已有模型继续记录。
3. 新增低基数健康指标：
   - `newapi_model_histogram_active_models`：当前实例保留的模型性能指标组数量；
   - `newapi_model_histogram_dropped_samples_total{reason}`：未进入模型 histogram 的观察数，`reason` 仅允许 `model_limit`、`invalid_latency`、`invalid_ttft`、`series_limit`。
4. `/metrics` 生成时先计算现有基础 series；如加入模型性能指标组会超过 `PROMETHEUS_MAX_SERIES_PER_SCRAPE`，按最久未活跃优先省略完整指标组，不得只输出覆盖率分子或分母。基础 counter 和渠道指标必须继续输出；因该限制未输出的 histogram 观察数计入 `reason="series_limit"`，同一观察不得在后续 scrape 重复计数。
5. Staging 必须以真实流量测量单实例 series 数；生产不得仅依据 Grafana 对多个实例求和后的 `newapi_perf_metrics_series` 判断单实例上限。

### 7.2 多节点

每个 Router 实例维护自己的累计 counter/histogram，不进行跨节点协调。Prometheus 保留 `instance` 维度；Grafana 查询必须先：

```promql
sum by (model, le) (..._bucket)
```

再调用 `histogram_quantile`。禁止先计算每个实例的 p95/p99 再平均。

## 8. Grafana 仪表盘

### 8.1 元数据

- 文件夹：`flatkey`
- 名称：`Flatkey Model Performance 模型性能`
- UID：`flatkey-model-performance`
- 数据源变量：`${datasource}`，当前值 `Google-Prometheus`
- Tags：`flatkey`、`router`、`prometheus`、`model-performance`
- 默认时间范围：Last 1 hour
- 自动刷新：30 seconds
- 首版不创建告警规则

### 8.2 变量

| 变量 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `datasource` | datasource | `Google-Prometheus` | 与现有 Flatkey 看板保持一致 |
| `model` | query，支持多选 | 创建时当前最高流量模型 | 下钻面板过滤；候选按近期 RPS 排序 |
| `min_samples` | custom | `20` | 可选 `10,20,50,100` |

模型候选来自：

```promql
query_result(
  sort_desc(sum by (model) (rate(newapi_model_requests_total[5m])))
)
```

通过 regex 提取 `model` 标签。全模型排名表不受 `model` 变量限制；下钻行受该变量限制。

### 8.3 行与面板

#### 行 1：全局健康摘要

1. 活跃模型数
2. 总请求率
3. 整体成功率
4. 整体 Latency P95
5. 整体 TTFT P95
6. TTFT 覆盖率
7. 模型 histogram dropped samples（仅有丢弃时显示红色，并按 `reason` 展开）

#### 行 2：全模型性能排名表

默认按 Latency P99 降序，字段：

- Model
- Req/s
- Requests in range
- Success %
- Error %
- Latency P50/P95/P99
- TTFT P50/P95/P99
- TTFT samples
- TTFT coverage %
- Input tok/s
- Output tok/s

分位数列使用连续色阶；样本不足不着色。

#### 行 3：选中模型性能趋势

- 端到端 Latency P50/P95/P99 time series
- TTFT P50/P95/P99 time series，并在 legend 显示 sample count

#### 行 4：选中模型负载与失败

- 请求率、成功率、错误率
- 输入/输出 Token/s
- 最终失败分类 rate：完整展示 client_cancel、timeout、rate_limit、auth、bad_response、network、upstream 4xx/5xx、other

## 9. 核心 PromQL

### 9.1 全模型 Latency P95 排名

```promql
histogram_quantile(
  0.95,
  sum by (model, le) (
    rate(newapi_model_request_duration_seconds_bucket[$__range])
  )
)
and on (model)
sum by (model) (
  increase(newapi_model_request_duration_seconds_count[$__range])
) >= $min_samples
```

P50/P99 只替换 quantile。趋势图使用 `$__rate_interval` 作为 bucket rate 窗口。

### 9.2 TTFT 覆盖率

```promql
100 *
(
  sum by (model) (
    increase(newapi_model_ttft_seconds_count[$__range])
  )
  or on (model)
  0 * sum by (model) (
    increase(newapi_model_stream_success_total[$__range])
  )
)
/
sum by (model) (
  increase(newapi_model_stream_success_total[$__range])
)
```

有成功流式请求但没有有效首 token 时覆盖率为 0%；分母为 0 时结果保持 null/NaN，由 Grafana 显示“不适用 / 无流式样本”，不得通过 `clamp_min` 伪造成 0%。

### 9.3 模型成功率

```promql
100 *
sum by (model) (
  rate(newapi_model_requests_total{status="success"}[$__rate_interval])
)
/
clamp_min(
  sum by (model) (
    rate(newapi_model_requests_total[$__rate_interval])
  ),
  0.001
)
```

### 9.4 Token 吞吐

```promql
sum by (model) (
  rate(newapi_channel_model_output_tokens_total[$__rate_interval])
)
```

输入 Token 只替换 metric name。`sum by(model)` 会正确消除 `channel_id`。

### 9.5 最终失败分类

```promql
sum by (model, error_category) (
  rate(newapi_model_errors_total{model=~"${model:regex}"}[$__rate_interval])
)
```

## 10. 无数据与降级行为

- 当前窗口样本少于 `min_samples`：表格保留 RPS、成功率和吞吐；Latency 和 TTFT 分位数分别按各自 `_count` 独立判断并显示“样本不足”。
- 无成功流式样本：TTFT 显示“不适用 / 无流式样本”，不得显示 0ms 或 0%。
- 新指标上线前的历史时间：保持 null，不补零；面板说明数据从指标版本上线后开始。
- `newapi_model_histogram_dropped_samples_total` 在当前窗口有增长：顶部显示红色数据质量状态。
- 单个模型没有 histogram 但有请求 counter：排名表仍显示该模型，并把分位数标记为缺失。
- Grafana 查询失败或数据源不可用：保留 Grafana 原生错误，不用 0 值掩盖。

## 11. 测试与验证

### 11.1 Go 单元测试

1. 成功非流式请求只增加 Latency histogram。
2. 成功流式请求增加 Latency、stream success；有首 token 时增加 TTFT。
3. 成功流式但无首 token 不增加 TTFT，并能降低覆盖率。
4. 失败请求不进入 Latency/TTFT histogram，增加正确的最终错误分类。
5. timeout、rate limit、auth、network、upstream 4xx/5xx 分类稳定。
6. bucket 累积值、`+Inf`、`_sum`、`_count` exposition 正确。
7. 多 goroutine 并发 Record 不丢计数，并通过 `go test -race`。
8. 模型性能指标组共同 idle retirement、50 模型上限和 dropped-sample counter 正确。
9. 全局 series cap 下按完整模型性能指标组省略，覆盖率分子/分母不拆分，`/metrics` 仍返回基础指标，且同一被省略观察不重复计入 dropped-sample counter。
10. label escaping 不泄漏或破坏 Prometheus 文本格式。

### 11.2 Staging 验证

1. `go test ./pkg/perf_metrics/...`。
2. `go test ./controller/... ./service/...` 中受签名变化影响的测试。
3. `go test -race ./pkg/perf_metrics/...`。
4. `/metrics` 连续抓取无错误，新 metric 的 HELP/TYPE/labels 正确。
5. 发起真实成功非流式、成功流式、timeout 和 rate-limit 请求，核对对应 series。
6. 用构造样本手算 p50/p95/p99，并与 PromQL 结果比较。
7. 检查单实例 `newapi_perf_metrics_series` 与 `PROMETHEUS_MAX_SERIES_PER_SCRAPE` 的余量。
8. 观察至少一个完整空闲淘汰周期的等价测试；生产无需等待一小时，可通过时钟/可注入 retention 单测证明。

### 11.3 Grafana 验证

1. 数据源、变量和默认值正确。
2. 全模型排名默认按 Latency P99 降序。
3. 多节点 PromQL 先合并 bucket 后计算 quantile。
4. 低样本、无流式样本和 dropped-sample 状态符合设计。
5. model 多选只影响下钻行，不影响全模型排名。
6. Last 1 hour 和 30s refresh 正确。
7. 保存后重新打开仪表盘，面板、变量和权限均保持。

## 12. 发布顺序

1. 在独立功能分支实现并完成单元测试与 series 预算测试。
2. 部署到 staging Router；验证真实指标和 PromQL。
3. 在 Grafana 中先创建未对外依赖的仪表盘草稿并校验面板。
4. 生产 Router 滚动部署所有实例。该代码进入 Relay 请求路径，因此 `Router deploy: required`。
5. 确认所有生产 Router target 正常抓取且无 series cap 错误。
6. 在生产 Grafana `flatkey` 文件夹保存最终仪表盘。

其他部署目标：

- `newapi-console`：如果与 Router 共用同一 Go 镜像发布流程则随版本发布；功能本身不依赖 Console 请求流量。
- `newapi-web`：不需要。
- 数据库迁移：不需要。
- Terraform/Cloudflare：不需要；若需调整生产环境变量上限，应按 GCP 运维流程单独评审。

## 13. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| Histogram 乘数导致 series 超限 | 仅 `model` 标签、1 小时淘汰、默认 50 模型、全局 cap 前优先丢模型 histogram、staging 实测 |
| 低样本 p99 误导 | 默认至少 20 样本；始终展示 sample count |
| 多实例错误聚合 | `sum by(model,le)` 后再 `histogram_quantile`；测试跨实例 fixture |
| 错误/重试语义混淆 | 模型 errors 只记录最终失败；渠道 attempt 指标保持独立 |
| TTFT 把非流式请求当 0 | 非流式不产生 TTFT；面板显示不适用 |
| 生产历史在新指标上线前为空 | 不回填、不补零，面板注明生效时间 |

## 14. 完成标准

当且仅当以下条件全部满足，任务可视为完成：

- 新模型 Latency/TTFT histogram、stream success 和最终 errors counter 按 contract 输出；
- 单元测试、race test 和 series cap 测试通过；
- Staging 真实请求验证成功，单实例 series 有明确余量；
- 生产 Router 全部实例已发布并可被 Prometheus 正常抓取；
- `Flatkey Model Performance 模型性能` 已保存在生产 Grafana `flatkey` 文件夹；
- p50/p95/p99、TTFT、RPS、成功率、错误分类、Token 吞吐、低样本和数据质量状态均按设计工作；
- 没有已知 scrape 错误、错误口径或未说明的验证缺口。
