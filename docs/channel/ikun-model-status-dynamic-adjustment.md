# Ikun 模型状态接口分析与动态调整策略框架

分析时间：2026-05-22 17:15（Asia/Shanghai）  
接口地址：`https://status.ikuncode.cc/api/status?period=90m&board=hot`  
接入范围：首期仅接入 Ikun 渠道。未配置状态接口的上游保持现有静态渠道策略，不参与动态禁用、启用、优先级和权重调整。

## 1. 结论摘要

Ikun 状态接口可以支撑“按上游服务、按模型”的动态调度判断。接口返回的核心数据位于 `groups[].layers[]`：

- `groups[]` 表示一个 Ikun 监控对象，可与本地渠道或渠道标签建立映射。
- `layers[]` 表示该监控对象下的具体模型状态，包含当前状态、延迟和 90 分钟时间线。
- `timeline[]` 提供固定探测间隔内的可用率、延迟、状态计数和错误分类，可用于判断波动趋势。
- `current_status.status` / `timeline.status` 的状态码可按当前样本推断为：`1=可用`、`2=降级`、`0=不可用`。

动态调整不应直接把“某个模型异常”扩大为“整个渠道禁用”。更合理的首期框架是：优先调整 `abilities` 表中对应模型的 `enabled`、`priority`、`weight`；只有当同一渠道下全部已监控模型都不可用时，才将渠道置为自动禁用。

## 2. 请求与响应特征

### 2.1 请求

```http
GET /api/status?period=90m&board=hot
Host: status.ikuncode.cc
Accept: application/json
```

当前响应：

- HTTP 状态码：`200`
- Content-Type：`application/json; charset=utf-8`
- 响应体大小：约 `183 KB`
- 无需鉴权

### 2.2 顶层结构

```json
{
  "data": [],
  "groups": [],
  "meta": {}
}
```

字段说明：

| 字段 | 类型 | 当前样本 | 用途 |
| --- | --- | --- | --- |
| `data` | array | 空数组 | 当前不可作为业务数据源依赖 |
| `groups` | array | 9 个对象 | 核心监控数据 |
| `meta` | object | 包含周期、看板、监控 ID 等元信息 | 用于校验周期和调试 |

`meta.period` 为 `90m`，`meta.timeline_mode` 为 `raw`，`meta.slow_latency_ms` 为 `5000`。`meta.count` 当前为 `0`，但 `groups` 有数据，因此实现时不能用 `meta.count` 判断是否存在监控数据。

## 3. `groups[]` 结构

单个 `groups[]` 对象代表一个监控对象。当前样本包含 9 个监控对象，均属于 `board=hot`。

| 字段 | 类型 | 示例 | 说明 |
| --- | --- | --- | --- |
| `provider` | string | `Codex Pro` | 监控对象展示名 |
| `provider_slug` | string | `codex-pro` | 稳定映射键，建议优先使用 |
| `provider_url` | string | 空字符串 | 当前样本未提供有效 URL |
| `service` | string | `cx`、`cc`、`gm` | 服务分类 |
| `category` | string | `commercial` | 分类 |
| `sponsor` | string | `IKunCode` | 来源标识 |
| `sponsor_url` | string | 空字符串 | 当前样本未提供有效 URL |
| `price_min` / `price_max` | number | `2.2`、`2.3` | 价格范围，可用于展示，不建议用于首期调度 |
| `channel` | string | `Codex Pro` | 渠道展示名 |
| `board` | string | `hot` | 看板 |
| `probe_url` | string | `https://api.ikuncode.cc/v1/chat/completions` | 探测目标 |
| `template_name` | string | `cc-sonnet-tiny` | 探测模板名，部分对象不存在 |
| `interval_ms` | number | `180000` 或 `300000` | 探测间隔 |
| `slow_latency_ms` | number | `5000` | 慢请求阈值 |
| `current_status` | number | `0`、`1`、`2` | 监控对象聚合状态 |
| `layers` | array | 2 到 3 个模型层 | 模型级状态数据 |

当前样本中的监控对象：

| provider | provider_slug | service | interval_ms | current_status | 模型层数 |
| --- | --- | --- | ---: | ---: | ---: |
| Claude Code-稳定 | `claude-code-stable` | `cc` | 300000 | 2 | 3 |
| cc逆向 | `cc-reverse` | `cc` | 300000 | 2 | 3 |
| cc逆向2 | `cc-reverse-2` | `cc` | 300000 | 2 | 3 |
| cc逆向3 | `cc-reverse-3` | `cc` | 300000 | 1 | 3 |
| cc-wf | `cc-wf` | `cc` | 300000 | 0 | 3 |
| cc-kiro | `cc-kiro` | `cc` | 300000 | 2 | 3 |
| Codex | `codex` | `cx` | 180000 | 0 | 3 |
| Codex Pro | `codex-pro` | `cx` | 180000 | 2 | 3 |
| Gemini | `gemini` | `gm` | 300000 | 1 | 2 |

## 4. `layers[]` 模型层结构

`layers[]` 是动态调度的主要依据。

| 字段 | 类型 | 示例 | 说明 |
| --- | --- | --- | --- |
| `model` | string | `GPT 5.4` | 展示名 |
| `request_model` | string | `gpt-5.4` | 实际请求模型名，建议用于匹配本地 `abilities.model` |
| `layer_order` | number | `0` | 层级顺序 |
| `current_status` | object | 见下方 | 当前探测状态 |
| `timeline` | array | 18 或 30 个点 | 历史探测序列 |

`current_status` 示例：

```json
{
  "status": 1,
  "latency": 1538,
  "timestamp": 1779441338
}
```

字段说明：

- `status`：状态码。根据样本推断，`1` 表示可用，`2` 表示降级，`0` 表示不可用。
- `latency`：毫秒级延迟。
- `timestamp`：Unix 秒级时间戳，按 UTC 解释后与接口拉取时间一致。

## 5. `timeline[]` 时间线结构

`timeline[]` 用于判断趋势，避免只依据单点状态频繁抖动。

| 字段 | 类型 | 示例 | 说明 |
| --- | --- | --- | --- |
| `time` | string | `09:15:38` | 展示时间 |
| `timestamp` | number | `1779441338` | Unix 秒级时间戳 |
| `status` | number | `1`、`2`、`0` | 该探测点状态 |
| `latency` | number | `1538` | 该探测点延迟，毫秒 |
| `availability` | number | `100`、`70`、`0` | 该探测点可用率 |
| `status_counts` | object | 见下方 | 错误原因分类 |

当前样本中：

- `interval_ms=300000` 的模型通常有 18 个点，对应 90 分钟。
- `interval_ms=180000` 的模型通常有 30 个点，对应 90 分钟。
- 部分 Claude Code-稳定模型层出现 17 个点，说明实现必须容忍时间线长度不一致。

## 6. `status_counts` 错误分类

常规字段：

| 字段 | 含义 |
| --- | --- |
| `available` | 可用探测次数 |
| `degraded` | 降级探测次数 |
| `unavailable` | 不可用探测次数 |
| `missing` | 数据缺失 |
| `slow_latency` | 慢延迟 |
| `rate_limit` | 限流 |
| `server_error` | 服务端错误 |
| `client_error` | 客户端错误 |
| `auth_error` | 鉴权错误 |
| `invalid_request` | 非法请求 |
| `network_error` | 网络错误 |
| `response_timeout` | 响应超时 |
| `content_mismatch` | 响应内容不匹配 |

部分不可用探测点会额外出现：

```json
{
  "http_code_breakdown": {
    "server_error": {
      "500": 1
    }
  }
}
```

首期实现应保留 `http_code_breakdown` 原始内容用于审计，但调度决策先聚合到 `server_error`、`network_error`、`rate_limit` 等稳定分类上，避免被嵌套结构变化影响。

## 7. 状态码推断

当前接口没有返回状态枚举说明，以下映射来自样本中 `status`、`availability`、`latency` 和 `status_counts` 的交叉验证：

| 状态码 | 推断含义 | 证据 |
| ---: | --- | --- |
| `1` | 可用 | `availability=100` 占主，延迟通常低于 `slow_latency_ms` |
| `2` | 降级 | 常伴随 `slow_latency=1`，`availability=70` 或延迟超过 5000 ms |
| `0` | 不可用 | 常伴随 `unavailable=1`、`server_error` 或 `network_error` |

实现上应把该映射配置化，并在日志中标记为 Ikun 适配器的解析规则，避免后续接口语义变化时需要改动核心调度逻辑。

## 8. 动态调整策略框架

### 8.1 设计目标

动态调整用于降低上游波动对用户请求的影响，不替代现有失败重试和自动禁用逻辑。首期目标：

- 快速降低异常上游的流量占比。
- 对持续不可用的模型能力自动下线。
- 对恢复稳定的模型能力自动恢复。
- 保留管理员手动禁用、手动优先级和权重的最终控制权。

### 8.2 接入边界

只处理显式配置了状态监控来源的渠道：

```json
{
  "status_monitor": {
    "enabled": true,
    "provider": "ikun",
    "provider_slug": "codex-pro"
  }
}
```

建议把该配置放在渠道额外设置中，或后续迁移到独立配置表。未配置 `status_monitor.enabled=true` 的渠道不参与动态调整。

### 8.3 数据流

```mermaid
flowchart LR
  A["定时任务拉取 Ikun 状态接口"] --> B["Schema 校验与适配器解析"]
  B --> C["按 provider_slug 建立监控对象索引"]
  C --> D["按 request_model 映射本地 abilities.model"]
  D --> E["计算模型健康分与调度动作"]
  E --> F["写入动态调度覆盖层"]
  F --> G["同步 abilities / channel 状态"]
  G --> H["记录审计日志与指标"]
```

### 8.4 映射规则

优先级从高到低：

1. `status_monitor.provider_slug` 精确匹配 `groups[].provider_slug`。
2. `abilities.model` 精确匹配 `layers[].request_model`。
3. 若存在本地模型映射，先把用户请求模型归一化到上游请求模型，再匹配 `request_model`。

不建议用 `provider` 或 `channel` 作为唯一键，因为它们更像展示名，后续更容易变化。

### 8.5 健康分计算

每个 `(provider_slug, request_model)` 计算一个健康状态：

| 健康状态 | 判定建议 | 调度动作 |
| --- | --- | --- |
| `healthy` | 当前 `status=1`，最近 3 个点无 `0`，最近 90 分钟可用率 ≥ 95% | 恢复基准权重和优先级 |
| `degraded` | 当前 `status=2`，或最近 90 分钟可用率在 70% 到 95%，或延迟超过 `slow_latency_ms` | 降权，必要时降低优先级 |
| `unhealthy` | 当前 `status=0`，或最近 2 个点连续不可用，或最近 90 分钟可用率 < 70% | 禁用对应模型能力 |
| `unknown` | 接口拉取失败、数据缺失、模型未匹配或时间线过旧 | 不产生新的动态变更 |

### 8.6 禁用与启用规则

禁用规则：

- 对单模型异常，优先设置对应 `abilities.enabled=false`，不直接禁用整个渠道。
- 当一个渠道已映射的全部模型能力均为 `unhealthy`，再把渠道状态更新为自动禁用。
- 手动禁用渠道不允许被动态任务自动启用。
- 若某模型在当前组内只剩最后一个可用渠道，不立即禁用；改为降权并触发告警，避免把用户请求推入无渠道状态。

启用规则：

- 只有动态任务曾经禁用或降权的能力，才允许动态任务恢复。
- 恢复需要连续 3 个健康探测点，或最近 15 分钟无不可用点。
- 恢复时写回基准 `priority` 和 `weight`，而不是使用当前动态值继续叠加。

### 8.7 优先级和权重调整

本项目当前调度逻辑中：

- `priority` 越高越优先。
- 同一优先级内按 `weight` 加权选择。
- `abilities` 表已经保存了模型维度的 `enabled`、`priority`、`weight`。

建议引入“基准值 + 动态覆盖”的计算方式：

| 监控状态 | priority 调整 | weight 调整 |
| --- | --- | --- |
| `healthy` | 使用基准值 | 使用基准值 |
| `degraded` | 基准优先级降低 1 档，或保持优先级但降权 | 基准权重 × 30% 到 60% |
| `unhealthy` | 不参与选择 | `enabled=false` |
| `unknown` | 不调整 | 不调整 |

不要直接覆盖管理员配置。需要保存基准值，例如：

```json
{
  "dynamic_status": {
    "provider": "ikun",
    "last_state": "degraded",
    "base_priority": 10,
    "base_weight": 100,
    "applied_priority": 9,
    "applied_weight": 40,
    "updated_at": 1779441338,
    "reason": "availability=86, status=2, slow_latency=1"
  }
}
```

长期看，更推荐独立表保存动态覆盖层，避免污染渠道配置 JSON，也便于审计和回滚。

### 8.8 定时任务建议

首期任务频率：

- Ikun 接口拉取间隔：`180s`，不高于当前最短 `interval_ms=180000`。
- 请求超时：`10s`。
- 失败重试：最多 2 次，指数退避。
- 连续拉取失败：不新增禁用动作，只记录 `unknown` 并保留上一次动态调整。
- 数据过期阈值：最新 `timestamp` 距当前时间超过 `2 * interval_ms` 时视为过旧。

### 8.9 审计与可观测性

每次产生调度动作时记录：

- 渠道 ID、渠道名称、渠道标签。
- `provider_slug`、`request_model`。
- 原始状态、目标状态、基准权重、动态权重、基准优先级、动态优先级。
- 最近 90 分钟可用率、最近 3 个探测点状态、错误分类摘要。
- 操作原因、执行结果、错误信息。

指标建议：

- `upstream_status_poll_success_total`
- `upstream_status_poll_failure_total`
- `upstream_status_stale_total`
- `channel_dynamic_disabled_total`
- `channel_dynamic_enabled_total`
- `ability_dynamic_weight_adjusted_total`
- `ability_dynamic_priority_adjusted_total`

## 9. 首期实现建议

首期可以拆为 4 个模块：

1. **Ikun 状态适配器**：负责拉取、校验、解析接口，输出统一的模型健康快照。
2. **渠道映射器**：把 `provider_slug + request_model` 映射到本地 `channel + ability`。
3. **策略引擎**：根据健康快照、基准配置和保护规则生成调度动作。
4. **动作执行器**：以事务方式更新 `abilities`，必要时更新 `channels.status`，并写入审计日志。

首期不建议做的事：

- 不对未配置状态监控的上游做动态调整。
- 不根据单个降级点立刻禁用渠道。
- 不把接口返回的展示名作为唯一映射键。
- 不覆盖管理员手工配置的基准优先级和权重。
- 不在 Ikun 接口不可用时批量禁用渠道。

## 10. 验收口径

后续进入实现时，建议按以下口径验收：

- Ikun 接口拉取失败不会改变任何渠道状态。
- 未配置 `status_monitor.enabled=true` 的渠道不会被动态任务修改。
- 单模型不可用只影响该模型对应的 `ability`，不会误伤同渠道其他健康模型。
- 手动禁用渠道不会被动态任务自动启用。
- 降级模型会降低权重或优先级，不会立即被当作不可用处理。
- 动态任务能恢复自己禁用或降权的能力，并恢复到基准配置。
- 每次动态动作都有可追溯的审计记录。

