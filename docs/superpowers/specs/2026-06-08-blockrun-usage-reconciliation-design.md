# BlockRun 用量对账接口（`GET /usage/summary` + `GET /usage/transactions`）— 设计文档

**日期：** 2026-06-08
**作者：** Claude Code（与 slZhong 脑爆确定）
**状态：** 待评审（决策已锁定）

---

## 1. 背景与目的

对账方（消费此接口做对账的人）给出了**他期望 new-api 实现的两个接口契约**：
1. `GET /usage/summary` —— 指定时间范围的用量/成本汇总（totals + by_model + by_api_key）。
2. `GET /usage/transactions` —— 同范围的**逐笔明细**，分页返回。

本需求：在 new-api 实现这两个契约，自报账本里 **BlockRun 系渠道**在指定时间范围内的用量与成本，供对账方拉取核对。

> 最初参考的 flatkey `/mcp/blockrun/usage`（period/date、channels[]、v3 contract）**已作废**；以对账方给的 `/usage/*` 契约为准。

### 关键背景
- BlockRun = x402 链上微支付上游 vendor（Base USDC 按调用付费）。
- new-api 里 BlockRun 是多渠道：渠道类型名以 `BlockRun` 开头者（当前 `100 BlockRun / 101 BlockRunVideo / 102 BlockRunSeedance`）。
- `docs/channel/blockrun-pricing-audit.md` 记录过"链上实付远高于账面"，但**链上成本/折前官价本期不做**（见 §8）。

---

## 2. 范围（YAGNI）

### 纳入
- 两个根级、静态 token 守护的只读接口：`/usage/summary`、`/usage/transactions`（分页）。
- 数据范围（两接口一致）：**全部 BlockRun 系渠道**（类型名前缀 `blockrun`，大小写不敏感）在 `[start, end)` 内、`type=LogTypeConsume` 的日志。

### 明确不做（本期）
- ❌ `total_cost`（折前官价）：new-api 取不到真实值，**不返回**（不伪造、不改字段语义）。
- ❌ `metadata.chain` 等链/结算信息：new-api 未逐请求落库（x402 结算回执在 `payment-response` 响应头，未持久化）。
- ❌ 链上 x402 实付 USDC 采集（独立子工程）。
- ❌ 渠道/账户维度（summary 契约无此维度）、写操作、鉴权体系改造。

---

## 3. 接口契约

### 3.1 认证（两接口共用）
- 机制：单一静态共享密钥（env `BLOCKRUN_USAGE_SUMMARY_TOKEN`）。**刻意不走** new-api 的 JWT/`TokenAuth()`/用户体系——token 仅鉴权、**不划分用户**。
- 取值：**只认** `Authorization: Bearer <token>`（不支持 `?token=` 或自定义头兜底）。
- 比较：`crypto/subtle.ConstantTimeCompare` 常数时间比较（防时序侧信道）。
- 失败：env 未配置 → `503`；缺失/错误 token → `401`。错误体 `{"error":"..."}`（外部对账端点，不套 new-api 的 `{success,message}` i18n 体系）。
- 限流：`/usage` group 在鉴权**之前**再挂 `middleware.GlobalAPIRateLimit()`（与整个 `/api` 同档，IP 维度，默认 180 次/180s）。放在 auth 前是为了让**未鉴权的暴力尝试也被限流**，并防止每请求一次的整窗 DB 扫描被放大成资源耗尽；该档位对周期性对账/分页消费方足够宽松。
- 落点：根级 `/usage` group 挂限流 + 鉴权两道中间件，两接口共用；`router/main.go` 的 `SetRouter` 内 +1 行 `SetUsageReconciliationRouter(router)`（根 engine，与现有 `/api/usage/token` 不冲突）。

### 3.2 数据范围（两接口共用）
- 遍历 `constant.ChannelTypeNames`，取名前缀 `blockrun`(忽略大小写) 的类型号 → 筛 `channels` 表得 `id` 集合（含 `id→{name}`）。
- 过滤：`type=LogTypeConsume` AND `channel_id IN (…)` AND `created_at ∈ [start,end)`（`created_at` 为 int 秒，ISO 入参转 UTC unix 秒，纯整数比较，跨库安全）。

### 3.3 `GET /usage/summary`

**入参**：`start`、`end`（ISO8601/RFC3339 UTC，必填；要求 `end>start` 且区间 ≤ **31 天**，否则 400）。

**响应**（成本仅 `actual_cost`；每个 cost 对象带 `currency`）：

```json
{
  "provider": "flatkey-newapi",
  "period": { "start": "2026-06-01T00:00:00Z", "end": "2026-06-02T00:00:00Z", "timezone": "UTC" },
  "totals": {
    "requests": 153284,
    "input_tokens": 182000000, "output_tokens": 9300000,
    "cache_read_tokens": 32000000, "cache_creation_tokens": 1200000,
    "total_tokens": 224500000,
    "actual_cost": "568.6738400000", "currency": "USD"
  },
  "by_api_key": [
    { "api_key_id": "84", "api_key_name": "BlockRun Main",
      "requests": 84000, "input_tokens": 100000000, "output_tokens": 5100000,
      "cache_read_tokens": 12000000, "cache_creation_tokens": 500000, "total_tokens": 117600000,
      "actual_cost": "205.0600000000", "currency": "USD" }
  ],
  "by_model": [
    { "model": "anthropic/claude-haiku-4.5",
      "requests": 84000, "input_tokens": 100000000, "output_tokens": 5100000,
      "cache_read_tokens": 12000000, "cache_creation_tokens": 500000, "total_tokens": 117600000,
      "actual_cost": "205.0600000000", "currency": "USD" }
  ],
  "generated_at": "2026-06-02T00:05:00Z"
}
```

### 3.4 `GET /usage/transactions`（分页）

**入参**：`start`、`end`（同上）；`page`（默认 1）；`page_size`（默认 **100**，上限 **500**，超出截断）。

**响应**：

```json
{
  "transactions": [
    {
      "transaction_id": "txn_9001",
      "request_id": "req_abc123",
      "api_key_id": "84",
      "api_key_name": "BlockRun Main",
      "model": "anthropic/claude-haiku-4.5",
      "requested_model": "claude-haiku-4-5",
      "created_at": "2026-06-01T10:12:30.000Z",
      "input_tokens": 1200, "output_tokens": 320,
      "cache_read_tokens": 128, "cache_creation_tokens": 0, "total_tokens": 1648,
      "actual_cost": "0.0031000000", "currency": "USD",
      "status": "success",
      "duration_ms": 1820,
      "metadata": { "channel_id": 34, "channel_name": "blockRun-claude-0603" }
    }
  ],
  "pagination": { "page": 1, "page_size": 100, "total_pages": 1533, "total_count": 153284, "has_more": true },
  "generated_at": "2026-06-01T10:20:00Z"
}
```

排序：`created_at ASC, id ASC`（稳定翻页）。

---

## 4. 数据映射（new-api `logs` → 响应）

| 响应字段 | new-api 来源 | 备注 |
|---|---|---|
| `requests` | 行数 COUNT（summary） | |
| `input_tokens` / `output_tokens` | `logs.prompt_tokens` / `logs.completion_tokens` | 列 |
| `cache_read_tokens` | `Other.cache_tokens` | **JSON 文本，逐行解析** |
| `cache_creation_tokens` | `Other.cache_creation_tokens`（含 5m/1h 合计） | **JSON 文本** |
| `total_tokens` | 四类之和 | Go 侧 |
| `actual_cost` | `Quota / 500000`（逐行；summary 为 Σ） | 折后实收，准确 |
| ~~`total_cost`~~ | — | **不返回**（取不到折前官价真实值） |
| `currency` | 常量 `"USD"` | |
| `model` | `Other.upstream_model_name`，无则回落 `logs.model_name` | 上游/规范名 |
| `requested_model`（仅 transactions） | `logs.model_name`（= `OriginModelName`） | 客户端请求名；blockrun 无映射时与 model 相等 |
| `by_api_key` / `api_key_id`,`api_key_name` | `logs.token_id`(转字符串) / `logs.token_name` | summary 按 token 分组 |
| `transaction_id`（transactions） | `"txn_" + logs.id` | 确定性唯一 |
| `request_id`（transactions） | `logs.request_id` | |
| `created_at`（transactions） | `logs.created_at`(unix 秒) → RFC3339 | **秒精度**（`.000Z`，无毫秒） |
| `duration_ms`（transactions） | `logs.use_time`(秒) × 1000 | **秒级粒度** |
| `status`（transactions） | 默认 `"success"`；`Other.stream_status.status=="error"` → `"error"` | |
| `metadata`（transactions） | `{channel_id, channel_name}` | 放 new-api 确有的；**不含 chain** |
| `generated_at` | 当前 UTC | RFC3339 |
| `pagination`（transactions） | GORM `Count` + `Limit/Offset` | total_pages=⌈total/page_size⌉；has_more=page<total_pages |

- 成本字符串：`shopspring/decimal`，10 位小数。

---

## 5. 实现架构

### 5.1 不能照搬 SQL 聚合的原因
- 受 **Rule 2** 约束（SQLite/MySQL/PG 全兼容）；缓存 token 在 `Other` JSON 文本里，**无可移植 SQL 对其 SUM/筛选** → summary 必须逐行读 `Other`。

### 5.2 做法
- **共享**：token 守护、ISO 时间解析、BlockRun 渠道集合解析、`Other` 解析（缓存 token / upstream_model_name / stream_status）、成本换算（actual=Quota/500000）。
- **summary**：GORM `Rows()` **流式扫描**范围内匹配行 → Go 侧逐行解析 `Other`、按 model_name / token_id 增量累加 `totals`/`by_model`/`by_api_key`（内存只与分组数有关，不随行数膨胀）。
- **transactions**：GORM `Count` 取 total_count；`Order(created_at,id).Limit(page_size).Offset((page-1)*page_size)` 取当前页（≤500 行物化）→ 逐行解析 `Other` 组装明细 + 分页元信息。

### 5.3 性能与索引（已评审）
- **命中索引**：查询 `WHERE type AND channel_id IN(...) AND created_at∈[start,end) ORDER BY created_at,id` 由现有 **`idx_created_at_id (created_at,id)`** 服务——`created_at` 前导列限定时间窗范围扫描，`ORDER BY` 被该索引覆盖**无 filesort**；`type`/`channel_id` 为残余过滤。`Count` 同走该索引。
- **不新增索引**（已评审）：理论最优是 `(channel_id, created_at)` 复合索引，但需在生产巨大且高频写入的 `logs` 表上 ALTER 加索引（成本/锁风险），**本期不加**；靠 `idx_created_at_id` + 时间窗 + 流式足够。后续若 profiling 显示时间窗内非 blockrun 行占比过高再评估。
- **列裁剪**：summary 仅 `SELECT model_name, token_id, token_name, prompt_tokens, completion_tokens, quota, other`，跳过 content/ip/username/upstream_request_id 等大列。
- **范围上限**：`end-start` > **31 天** → 400（防超长区间扫描/OOM）。
- **主要 CPU 成本**：逐行 `Other` JSON 解析（day 级范围可接受；范围上限兜底）。深翻页 OFFSET 有丢弃成本，对账偶发可接受，必要时后续改 keyset。

---

## 6. 产出文件

| 文件 | 内容 |
|---|---|
| `middleware/usage_recon_auth.go` | `UsageReconAuth()` 静态 Bearer token 守护 + bearer 解析 + env 常量（约定：放 middleware/） |
| `model/usage_reconciliation.go` | 数据访问：`BlockRunChannelTypes`/`GetBlockRunChannels`、`StreamBlockRunUsageLogs`(Rows 流式)、`CountBlockRunUsageLogs`、`QueryBlockRunUsageLogsPaged` |
| `controller/usage_reconciliation.go` | `GetUsageSummary`/`GetUsageTransactions` handler、DTO、Go 聚合、Other 解析、成本换算、时间/分页解析 |
| `router/usage_reconciliation.go` | `SetUsageReconciliationRouter`：`/usage` group + `middleware.GlobalAPIRateLimit()`（auth 前）+ `middleware.UsageReconAuth()` + 两路由 |
| `router/main.go` | `SetRouter` 内 +1 行 `SetUsageReconciliationRouter(router)` |
| `middleware/usage_recon_auth_test.go` | 503/401/200（纯中间件，无 DB） |
| `model/usage_reconciliation_test.go` | 渠道类型/集合、流式过滤、Count、分页排序（用 model 包既有 TestMain） |
| `controller/usage_reconciliation_test.go` | 参数校验(含 31 天)、summary 聚合、transactions 字段/分页、成本/缓存解析（每测试自建内存 sqlite，不引入 controller 包 TestMain） |

编辑现有符号前按 GitNexus 规则跑 `gitnexus_impact`（仅 `SetRouter` 一处新增调用，风险低）。

---

## 7. 测试策略（SQLite 内存库，验证跨库可移植）

- **认证**：未配 env→503、错 token→401、`Bearer` 正确→200。
- **参数**：缺 start/end→400、end≤start→400、非法 ISO→400；`page_size>500` 截断为 500、缺省为 100。
- **范围**：只统计 BlockRun 系渠道（类型名前缀 blockrun，大小写不敏感）；非 blockrun 渠道日志不计入。
- **summary**：mock 多渠道多模型多 token 日志，断言 totals/by_model/by_api_key 分组、四类 token+total、缓存从 `Other` 解析、`actual_cost`=ΣQuota/500000、响应**不含** total_cost。
- **transactions**：断言分页（total_count/total_pages/has_more）、排序、逐字段映射（transaction_id/model/requested_model/status/duration_ms/metadata）、缓存解析、**不含** total_cost/chain。

---

## 8. 已锁定决策

| # | 决策 | 结论 |
|---|---|---|
| 1 | 目标契约 | 对账方 `GET /usage/summary` + `GET /usage/transactions`（flatkey v3 作废） |
| 2 | 认证 | 静态 Bearer token（env），仅鉴权不划分用户 |
| 3 | 数据范围 | 全部 BlockRun 系渠道（类型名前缀 `blockrun`，大小写不敏感），单一聚合，无渠道维度 |
| 4 | `total_cost` | **不返回**（取不到折前官价真实值，不伪造） |
| 5 | `actual_cost` | = Quota/500000（折后实收） |
| 6 | `provider` | 常量 `"flatkey-newapi"` |
| 7 | `metadata` | 放 new-api 确有的 `{channel_id, channel_name}`，**不含 chain** |
| 8 | `status` | 默认 `success`，`Other.stream_status` 标 error 时反映 `error` |
| 9 | 分页 | `page` 默认 1；`page_size` 默认 100、上限 500；排序 `created_at,id` 升序 |
| 10 | 精度限制 | `created_at` 秒精度(`.000Z`)、`duration_ms`=use_time×1000（秒级） |
| 11 | `transaction_id` | `"txn_" + 日志id` |
| 12 | 性能 | 流式扫描(`Rows()`)+列裁剪；命中 `idx_created_at_id`，无 filesort |
| 13 | 索引 | **不加**新复合索引，靠现有 `idx_created_at_id` |
| 14 | 范围上限 | `end-start` ≤ **31 天**，超出 400 |
| 15 | 限流 | `/usage` group 在 auth 前挂 `GlobalAPIRateLimit()`（IP 维度，默认 180/180s），防暴力破解 token + DB 扫描放大 |

### 实现期需精确对齐
- `api_key_id` 字符串格式（默认 `strconv.Itoa(token_id)`）。
- token 的 env 变量名（拟 `BLOCKRUN_USAGE_SUMMARY_TOKEN`，两接口共用）。
