# 新表与索引/迁移方案（健康度5分钟切片 + 小时成功率 + 可选小时用户调用排行）

> 范围严格对齐需求：仅做两项的表/索引/迁移设计，不写实现代码。需求来源：[`Difference.md`](Difference.md:3)、[`Difference.md`](Difference.md:6)

## 现状入口（用于落地与改造定位）

- 日志表结构：[`model.Log`](model/log.go:20)
- 成功请求落日志入口：[`model.RecordConsumeLog()`](model/log.go:156)，主要调用链：[`relay.postConsumeQuota()`](relay/compatible_handler.go:192) → [`model.RecordConsumeLog()`](model/log.go:156)
- 失败请求落日志入口：[`model.RecordErrorLog()`](model/log.go:99)，主要调用链：[`controller.processChannelError()`](controller/relay.go:345) → [`model.RecordErrorLog()`](model/log.go:99)，并受 [`types.IsRecordErrorLog()`](types/error.go:363) 控制
- 现有小时聚合：[`model.QuotaData`](model/usedata.go:13) 与写入 [`model.LogQuotaData()`](model/usedata.go:58)（只精确到小时）
- 现有看板 API：[`controller.GetAllQuotaDates()`](controller/usedata.go:13)

## 口径定义（固定，不在实现中再猜）

### 1) 时间对齐
- 5 分钟时间片：`slice_start_ts = created_at - (created_at % 300)`，以服务器时区的“时间语义”展示（存储仍建议用 unix seconds，展示端按服务器时区渲染）。
- 小时：`hour_start_ts = created_at - (created_at % 3600)`（与现有 [`model.LogQuotaData()`](model/usedata.go:58) 对齐），展示同上按服务器时区。

### 2) 健康度 success slice 判定
来自需求：[`Difference.md`](Difference.md:3)

对某个 `model_name` 的某个 5 分钟 slice：
- `total_slice`：该 slice 内“有请求事件出现”则计 1（每个 slice 至多 1）。
- `success_slice`：该 slice 内只要存在至少 1 个“成功请求且满足阈值”则计 1（混合成功/失败时按成功）。
- “成功请求且满足阈值”的定义：
  - 请求在业务意义上成功（没有走错误返回；或可用 `HTTP 2xx` + 非错误响应体 来判定），且
  - 满足三者之一：
    - `response_bytes > 1024`（>1KB）
    - `completion_tokens > 2`
    - `assistant_content_chars > 2`

说明：失败请求定义为进入 [`controller.processChannelError()`](controller/relay.go:345) 的 `newAPIError != nil` 分支并且 `types.IsRecordErrorLog()` 为 true 时能落库；此外还存在“未落 error log 的失败”（例如显式配置 `types.ErrOptionWithNoRecordErrorLog()`），它们在健康度分母内是否计入属于产品口径问题；本方案默认：**健康度基于可观测事件**，即以“写入聚合的事件”为准。

---

## 总体建模选择

为满足高性能查询（按 model + 小时范围计算 success_slice/total_slice）与可选小时用户排行（按小时集合聚合 user count 降序），采用 **2 张新表**：

1) `model_health_slice_5m`：按 `model_name + slice_start_ts` 聚合 5 分钟切片结果（每行一个 model 的一个 5 分钟 slice）。
2) `user_call_hourly`：按 `hour_start_ts + user_id` 聚合该用户在该小时的调用次数（可用于单小时 topN，也可用于小时集合求和排行）。

不扩展现有 `quota_data` 的原因：
- `quota_data` 的主键维度是 `(user_id, username, model_name, created_at hour)`，偏向额度/令牌/模型维度；本需求的“用户总调用次数排行”不需要模型维度，且需要高效 topN（单小时）/小时集合求和（多小时）。单独新表能更轻、更专用、索引更精准，避免 `quota_data` 额外索引膨胀和聚合成本。

---

## 表 A：模型健康度 5 分钟切片表

### DDL（MySQL InnoDB）

```sql
CREATE TABLE IF NOT EXISTS model_health_slice_5m (
  slice_start_ts BIGINT NOT NULL COMMENT 'slice start unix seconds, aligned to 300s',
  model_name VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'origin model name (after mapping: log model)',
  total_requests INT NOT NULL DEFAULT 0 COMMENT 'events observed in this slice for this model',
  error_requests INT NOT NULL DEFAULT 0 COMMENT 'events considered failure in this slice for this model',
  success_qualified_requests INT NOT NULL DEFAULT 0 COMMENT 'successful requests meeting threshold',
  has_success_qualified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if any qualified success in slice',
  max_response_bytes INT NOT NULL DEFAULT 0 COMMENT 'max response bytes observed in slice (0 if unknown)',
  max_completion_tokens INT NOT NULL DEFAULT 0 COMMENT 'max completion tokens observed in slice',
  max_assistant_chars INT NOT NULL DEFAULT 0 COMMENT 'max assistant content char length observed in slice (0 if unknown)',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (model_name, slice_start_ts),
  KEY idx_slice_start (slice_start_ts),
  KEY idx_slice_model (slice_start_ts, model_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 索引设计理由
- `PRIMARY KEY (model_name, slice_start_ts)`：写入与幂等更新以“模型+切片”为自然键，便于 `INSERT ... ON DUPLICATE KEY UPDATE`。
- `KEY idx_slice_model (slice_start_ts, model_name)`：健康度查询通常是 `WHERE slice_start_ts BETWEEN ? AND ? AND model_name IN (...)` 或 `GROUP BY model_name`，该组合支持范围扫描 + 按模型聚合。
- `KEY idx_slice_start (slice_start_ts)`：用于按时间清理/归档、以及按全模型时间窗统计时的范围扫描。

### 分区/归档建议
- 若数据量大（模型多、QPS 高、长期保存）：建议按月对 `slice_start_ts` 做 RANGE 分区（例如每月一个分区）。MySQL 分区 DDL 需结合上线月份生成，略。
- 保留策略建议：保留 90 天或 180 天（由业务需要决定）；过期分区可直接 `DROP PARTITION` 快速清理。

---

## 表 B：小时用户调用次数排行表

### DDL（MySQL InnoDB）

```sql
CREATE TABLE IF NOT EXISTS user_call_hourly (
  hour_start_ts BIGINT NOT NULL COMMENT 'hour start unix seconds, aligned to 3600s',
  user_id INT NOT NULL COMMENT 'user id',
  username VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'denormalized username for display',
  total_calls INT NOT NULL DEFAULT 0 COMMENT 'total calls in this hour',
  success_calls INT NOT NULL DEFAULT 0 COMMENT 'successful calls in this hour (best-effort)',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (hour_start_ts, user_id),
  KEY idx_hour_calls (hour_start_ts, total_calls, user_id),
  KEY idx_user_hour (user_id, hour_start_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 索引设计理由
- `PRIMARY KEY (hour_start_ts, user_id)`：自然聚合键，小时级 UPSERT 非常直接。
- `KEY idx_hour_calls (hour_start_ts, total_calls, user_id)`：单小时 topN 查询形态是 `WHERE hour_start_ts=? ORDER BY total_calls DESC LIMIT N`，该索引能在同一小时分组内更快定位高 calls（MySQL 对 DESC 索引的利用依版本/执行计划而定，但该索引仍利于过滤与回表减少）。
- `KEY idx_user_hour (user_id, hour_start_ts)`：支持按用户查历史（可选），以及回填/核对数据时的快速定位。

### 分区/归档建议
- 同样可按 `hour_start_ts` 做月分区；保留周期建议与健康度表一致或更短（例如 90 天）。

---

## 写入路径（事件来源、成功/失败判定、字段来源、需要补采样的点）

### 1) 成功事件来源（consume log 路径）
主链路：[`relay.postConsumeQuota()`](relay/compatible_handler.go:192) → [`model.RecordConsumeLog()`](model/log.go:156)

在 `RecordConsumeLog` 发生前，系统已计算并持有：
- `completion_tokens`：来自 `usage.CompletionTokens`（多渠道由 adaptor 解析或本地估算，见 [`relay/channel/openai.OaiStreamHandler()`](relay/channel/openai/relay-openai.go:106) 末尾 `ResponseText2Usage`）。
- `prompt_tokens`：同上。
- `model_name`：`relayInfo.OriginModelName`，写入时可能对 gizmo 做归一化（[`relay.postConsumeQuota()`](relay/compatible_handler.go:405)）。
- `is_stream`：`relayInfo.IsStream`（[`relay.TextHelper()`](relay/compatible_handler.go:28) 内对 Content-Type 的判断）。

需要补采样字段：
- `response_bytes`：
  - 非流式：在 [`service.IOCopyBytesGracefully()`](service/http.go:25) 中已知 `len(data)`，建议在此处把 `len(data)` 写入 `gin.Context`（如 `c.Set("resp_bytes", len(data))`）或写入 `other` map 后再落日志。
  - 流式：目前没有统一的 “写入字节计数器”，建议在 stream handler 中统计写出的 bytes（例如累计 `len(lastStreamData)` 或底层 writer 计数），最终放到 `other`，供聚合使用。
- `assistant_content_chars`：
  - OpenAI 流式：已有 `responseTextBuilder`（[`relay/channel/openai.OaiStreamHandler()`](relay/channel/openai/relay-openai.go:119)），可在结束时取 `len(responseTextBuilder.String())`（或更优为 builder.Len）。
  - OpenAI 非流式：`simpleResponse.Choices[].Message` 的 content 可解析（[`relay/channel/openai.OpenaiHandler()`](relay/channel/openai/relay-openai.go:196)），可求和/取 max。
  - 其他渠道：若走 `ResponseText2Usage`（[`relay/channel/openai.OaiStreamHandler()`](relay/channel/openai/relay-openai.go:184)）通常也有 responseText，可同样计算长度；否则需要在各 adaptor 的 DoResponse 中补齐（以“尽量可用”为目标，无法获取则置 0）。
- `success_qualified`（布尔）：
  - 成功判定：成功路径天然是 `RecordConsumeLog` 被调用（无 newAPIError），可视为“成功请求”候选。
  - 阈值判定：`resp_bytes>1024 OR completion_tokens>2 OR assistant_chars>2`。

写入动作（逻辑层，不实现）：
- 每次 `RecordConsumeLog`：
  - 计算 `slice_start_ts`、`hour_start_ts`
  - `model_health_slice_5m`：对 `(model_name, slice_start_ts)` 做 UPSERT 增量：
    - `total_requests += 1`
    - `success_qualified_requests += (qualified?1:0)`
    - `has_success_qualified = has_success_qualified OR qualified`
    - `max_* = GREATEST(max_*, current_*)`
  - `user_call_hourly`：对 `(hour_start_ts, user_id)` UPSERT：
    - `total_calls += 1`
    - `success_calls += 1`（成功路径）

### 2) 失败事件来源（error log 路径）
主要入口：[`controller.processChannelError()`](controller/relay.go:345) → [`model.RecordErrorLog()`](model/log.go:99)

当前 error log 具备：
- `userId/modelName/channelId/tokenId/group` 等维度（[`controller.processChannelError()`](controller/relay.go:355)）。
- `other` 里有 `error_type/error_code/status_code` 等（[`controller.processChannelError()`](controller/relay.go:363)）。

缺失字段（用于阈值判定）：
- `completion_tokens/resp_bytes/assistant_chars` 通常不可得（失败时可能没有有效响应体/usage）。

写入动作（逻辑层，不实现）：
- 每次 `RecordErrorLog`：
  - 计算 `slice_start_ts`、`hour_start_ts`
  - `model_health_slice_5m` UPSERT：
    - `total_requests += 1`
    - `error_requests += 1`
    - `has_success_qualified` 不变（失败不触发）
  - `user_call_hourly` UPSERT：
    - `total_calls += 1`
    - `success_calls` 不变

注意：并非所有失败都会进入 `RecordErrorLog`（例如错误使用了 [`types.ErrOptionWithNoRecordErrorLog()`](types/error.go:348)），因此健康度与排行的“失败覆盖率”取决于该开关。若需要 100% 覆盖，应在更底层（请求生命周期结束处）补“统一失败事件”，但这超出本次范围；本方案仅声明风险。

---

## 查询模式（健康度 & 用户排行）

### 1) 健康度：按模型 + 小时段（可选多个小时）返回 success_slice/total_slice 与成功率

输入：
- `model_names`（可多选）
- `hours`：一组 `hour_start_ts` 或一个时间范围 `[start_hour, end_hour)`（服务器时区语义）

查询思路：
- 小时段内包含若干 5 分钟 slice：`slice_start_ts BETWEEN hour_start_ts AND hour_start_ts+3600-300`
- `total_slice = COUNT(*)`（每行代表一个 slice）
- `success_slice = SUM(has_success_qualified)`
- `success_rate = success_slice / total_slice`

示例 SQL（单模型、多小时范围）：

```sql
SELECT
  model_name,
  FLOOR(slice_start_ts / 3600) AS hour_bucket,
  SUM(has_success_qualified) AS success_slice,
  COUNT(*) AS total_slice,
  SUM(has_success_qualified) / COUNT(*) AS success_rate
FROM model_health_slice_5m
WHERE model_name = ?
  AND slice_start_ts >= ?
  AND slice_start_ts < ?
GROUP BY model_name, hour_bucket
ORDER BY hour_bucket ASC;
```

示例 SQL（多模型、指定小时集合）：

```sql
SELECT
  model_name,
  FLOOR(slice_start_ts / 3600) AS hour_bucket,
  SUM(has_success_qualified) AS success_slice,
  COUNT(*) AS total_slice,
  SUM(has_success_qualified) / COUNT(*) AS success_rate
FROM model_health_slice_5m
WHERE model_name IN ( ... )
  AND FLOOR(slice_start_ts / 3600) IN ( ... )
GROUP BY model_name, hour_bucket;
```

> 注：`FLOOR(slice_start_ts / 3600)` 用于把 5 分钟 bucket 归到小时 bucket（基于 unix 秒），展示层按服务器时区解释。

### 2) 用户排行：给定小时集合或单小时，按用户聚合 count 降序

单小时 topN（最快路径）：

```sql
SELECT user_id, username, total_calls
FROM user_call_hourly
WHERE hour_start_ts = ?
ORDER BY total_calls DESC
LIMIT ?;
```

多小时集合（求和排行）：

```sql
SELECT user_id,
       MAX(username) AS username,
       SUM(total_calls) AS total_calls
FROM user_call_hourly
WHERE hour_start_ts IN ( ... )
GROUP BY user_id
ORDER BY total_calls DESC
LIMIT ?;
```

索引命中解释：
- 单小时 topN：`WHERE hour_start_ts=?` 走 `PRIMARY KEY` 前缀或 `idx_hour_calls`，排序字段 `total_calls` 与索引靠近能减少额外排序开销。
- 多小时集合：`WHERE hour_start_ts IN (...)` 走 `PRIMARY KEY` 扫描对应小时分区/范围，聚合后排序（不可完全避免），但比从原始 logs 聚合小得多。

---

## 迁移/回填策略（从现有 logs/quota_data）

### 目标
- 让新表在上线后“尽快可用”，并在可行范围内补历史数据。

### 可回填的部分
1) `user_call_hourly`：
- 从 [`model.Log`](model/log.go:20) 可回填（强可行）：
  - 成功：`logs.type = LogTypeConsume`（[`model.LogTypeConsume`](model/log.go:46)）视为成功调用事件
  - 失败：`logs.type = LogTypeError`（[`model.LogTypeError`](model/log.go:49)）视为失败调用事件（注意：受 `IsRecordErrorLog` 影响，历史 error 不一定全）
- 回填 SQL（示意，按小时聚合）：

```sql
INSERT INTO user_call_hourly (hour_start_ts, user_id, username, total_calls, success_calls)
SELECT
  (created_at - (created_at % 3600)) AS hour_start_ts,
  user_id,
  MAX(username) AS username,
  COUNT(*) AS total_calls,
  SUM(type = 2) AS success_calls
FROM logs
WHERE created_at >= ? AND created_at < ?
  AND type IN (2, 5)
GROUP BY hour_start_ts, user_id
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  total_calls = VALUES(total_calls),
  success_calls = VALUES(success_calls);
```

风险与成本：
- 成本：按时间范围扫 `logs`，若 logs 很大需分批（按天/按小时）执行。
- 风险：历史错误日志可能不全（跳过记录），`success_calls` 可靠、`failure` 可能偏低。

2) `model_health_slice_5m`：
- 从 logs 只能“部分回填”（强约束）：
  - `completion_tokens` 在 consume log 有（[`model.Log.CompletionTokens`](model/log.go:31)），可用于阈值之一（`completion_tokens>2`）。
  - `response_bytes` 与 `assistant_content_chars` 历史上不在 logs 明确存储（[`service.IOCopyBytesGracefully()`](service/http.go:25) 仅写 header，不持久化），因此无法严格按需求口径回填。
- 可选回填策略（折中）：
  - 仅用 `completion_tokens>2` 作为“阈值满足”的代理条件回填历史 `has_success_qualified`。
  - 对历史数据，明确标注“健康度为近似口径”，避免误导（展示层可加说明，但超出本次范围；此处仅声明风险）。

示例回填 SQL（近似口径，仅基于 completion_tokens）：

```sql
INSERT INTO model_health_slice_5m
  (slice_start_ts, model_name, total_requests, error_requests, success_qualified_requests, has_success_qualified, max_completion_tokens)
SELECT
  (created_at - (created_at % 300)) AS slice_start_ts,
  model_name,
  COUNT(*) AS total_requests,
  SUM(type = 5) AS error_requests,
  SUM(type = 2 AND completion_tokens > 2) AS success_qualified_requests,
  MAX(type = 2 AND completion_tokens > 2) AS has_success_qualified,
  MAX(CASE WHEN type = 2 THEN completion_tokens ELSE 0 END) AS max_completion_tokens
FROM logs
WHERE created_at >= ? AND created_at < ?
  AND type IN (2, 5)
GROUP BY slice_start_ts, model_name
ON DUPLICATE KEY UPDATE
  total_requests = VALUES(total_requests),
  error_requests = VALUES(error_requests),
  success_qualified_requests = VALUES(success_qualified_requests),
  has_success_qualified = VALUES(has_success_qualified),
  max_completion_tokens = GREATEST(max_completion_tokens, VALUES(max_completion_tokens));
```

风险与成本：
- 风险（核心）：历史健康度不满足 “response bytes / assistant chars” 两个条件的严格口径；只用 `completion_tokens` 会低估某些“低 token 但有输出内容/大响应”的成功 slice。
- 成本：同样需要扫 logs；建议只回填最近 N 天，并在上线后逐步补齐（真正口径需新增采样后才成立）。

---

## 方案小结（给实现方的最小指令集）

- 建两张表：`model_health_slice_5m`、`user_call_hourly`（DDL 如上）。
- 成功事件：在 [`model.RecordConsumeLog()`](model/log.go:156) 触发处（或其上游统一点）做两个表的 UPSERT 增量。
- 失败事件：在 [`controller.processChannelError()`](controller/relay.go:345) / [`model.RecordErrorLog()`](model/log.go:99) 触发处做两个表的 UPSERT 增量。
- 必须补采样字段：
  - 非流式 `response_bytes`：可从 [`service.IOCopyBytesGracefully()`](service/http.go:25) 的 `len(data)` 得到并传递到日志/聚合。
  - 流式 `response_bytes`：需要在 stream handler 增加计数（无现成统一计数）。
  - `assistant_content_chars`：可从流式聚合文本 builder / 非流式 choice 内容解析得到。
- 回填：
  - `user_call_hourly`：可从 logs 回填（高可行）。
  - `model_health_slice_5m`：只能近似回填（仅 completion_tokens 口径），或不回填历史，待采样上线后自然积累。
