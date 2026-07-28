# 用户节省金额展示功能设计文档

> 状态：已实施（本地官方定价与历史消费回算）
> 目标功能：向用户展示“已为你节省约 xx 元”
> 基准日期：2026-07-27
> 相关页面：用户概览、钱包、用量日志、模型广场
> 相关模块：`model/pricing.go`、`controller/pricing.go`、`service/text_quota.go`、`model/log.go`、`web/src/features/pricing/**`、`web/src/features/dashboard/**`、`web/src/features/usage-logs/**`

## 1. 背景

当前系统已经具备完整的模型价格展示与消费日志能力：

- 模型广场通过 `/api/pricing` 暴露模型价格、分组倍率、可用分组、供应商与端点信息。
- 后端计费在请求结算时写入消费日志，日志包含实际扣费 `quota`、模型名、分组、token 数、计费倍率和 `other` 快照。
- 前端已有统一的额度与货币格式化能力，可以把 quota 展示为 USD、CNY 或自定义货币。
- 价格同步已支持官方倍率预设、`models.dev`、OpenRouter 和其他 new-api 兼容定价接口。

因此，“节省金额”不需要从零建立一套独立价格系统。实现直接复用模型广场的本地基础定价与消费日志：新消费在结算时固化官方定价估算，已有消费在查询时按当前本地官方定价进行受限回算。

### 1.1 官方定价声明

本文确认：当前实例模型广场的本地基础定价来自模型服务商官方公开定价，可以作为节省估算的默认官方基准。这里的“本地”指价格已经存在于当前服务进程及其配置中，不表示渠道采购价，也不需要运行时访问外部官网。

实现和运营必须遵守以下约束：

- 默认从 `model.GetPricing()` 读取模型广场本地基础定价，并把该来源标记为 `local_pricing_snapshot`。
- 启用本地价格回退即表示管理员确认当前模型广场基础定价来自官方公开定价；该声明必须在节省设置中显式保存并可关闭。
- `official_prices` 不是必须完整维护的第二份价格表，只用于覆盖个别模型、补充来源 URL、纠正本地价格或冻结特殊版本。
- `models.dev`、OpenRouter、兼容 `/api/pricing` 或 `/api/ratio_config` 只是本地价格的导入通道；导入后的本地基础价是否仍可声明为官方价，由管理员对当前实例负责。
- 管理员自定义折扣价、渠道采购价、站内促销价、充值优惠价和分组优惠价不得作为官方定价。
- 每条新消费估算必须记录价格来源和快照时间；有官方来源更新时间时一并记录，但不得用缓存刷新时间冒充官方更新时间。
- 官方定价来源应尽量记录服务商官方价格页、官方文档或官方公告 URL，便于管理员审计。
- 无法确认官方来源的模型必须跳过节省估算，不得用默认倍率猜测。

## 2. 目标

- 用户概览默认展示滚动近 24 小时估算节省；汇总接口支持不超过 31 天的自定义短窗口。
- 复用现有模型广场价格体系，避免重复维护模型价格。
- 保证功能上线后的新消费采用日志快照，不因后续价格表调整而漂移。
- 让功能上线前已有的普通文本消费记录也能参与估算，并明确标识为按当前官方价回算。
- 文案明确为“估算”和“官方定价”，不作为严格财务账单。
- 对管理员可解释：每条日志能追溯官方定价、实际扣费和差额。
- 不影响现有计费、预扣费、结算、退款和订阅扣费语义。

## 3. 非目标

- 不承诺节省金额与任何官方账单逐分一致。
- 不抓取或实时校验所有上游官网价格。
- 不把“官方定价”用于实际扣费。
- 不在第一阶段支持所有复杂任务类、图片、音频、视频和依赖请求上下文的特殊表达式完整官方价对齐。
- 不在第一阶段展示累计节省金额；累计值依赖日志保留策略，需等聚合表或汇总字段落地后再承诺。
- 不在第一阶段统计任务类、固定按次类、无法仅凭日志 token 确定性复算的动态表达式和会产生后续退款/重算的异步请求。
- 不新增生产依赖，不引入外部价格 SaaS。
- 不修改受保护的项目品牌、许可、归属、包名和元数据。

## 4. 核心口径

### 4.1 展示口径

用户可见文案统一使用估算表达：

- `已为你节省约 {{amount}}`
- `按官方定价估算`
- `定价快照时间：{{time}}`
- `含按当前官方定价回算的历史消费`
- `部分特殊请求暂不计入节省估算`

避免使用以下绝对表述：

- `真实节省`
- `官方账单价`
- `保证比官方便宜`
- `精确节省`

### 4.2 计算口径

每次请求结算时计算并记录：

```text
estimated_official_quota = 按官方定价估算的 quota
actual_quota = 当前请求实际扣费 quota
savings_quota = max(estimated_official_quota - actual_quota, 0)
savings_ratio = savings_quota / estimated_official_quota
```

只展示非负节省。若实际价格高于官方定价估算，`savings_quota` 记为 `0`，不向用户展示“亏损”或负节省。该请求仍可写入 `savings_estimate`，用于统计覆盖率和管理员解释，但前端不展示“节省 0”。

官方定价估算不叠加站内分组倍率、用户特殊倍率、充值折扣、渠道采购成本或管理员促销策略；实际扣费则直接使用本次请求最终写入日志的 `quota`。因此该差额表达的是“用户实际扣费相比官方公开定价少消耗的额度”，而不是上游采购成本差额。

### 4.3 金额换算

后端统一存储 quota，不存储展示货币金额。前端继续使用现有额度/货币格式化逻辑把 `savings_quota` 转换为站点配置的展示货币。

这样可以保持：

- 账务基础单位一致。
- 多货币展示随站点配置自动变化。
- 历史数据不受汇率展示配置影响。
- 展示金额是“按官方定价与站内实际扣费折算的额度差额”，不是用户真实付款差额。

## 5. 数据来源设计

### 5.1 官方定价来源

匹配同一个模型时按以下优先级取价：

1. `official_prices[model]` 中已确认的人工覆盖项。
2. `model.GetPricing()` 返回的模型广场本地基础定价快照。
3. 无匹配价格时跳过，不再回退到模糊名称、默认倍率或渠道成本。

`model.GetPricing()` 中的 `ModelRatio`、`ModelPrice`、`CompletionRatio`、缓存倍率、图片倍率、音频倍率和计费模式来自本地基础定价。节省计算只取这些基础字段，不使用模型广场前端叠加分组后的最终展示金额，也不把用户分组倍率带入官方价。

### 5.2 官方定价维护流程

官方定价继续在现有模型定价设置和模型广场维护，不要求管理员为节省功能另行录入完整价格表：

1. 管理员通过现有能力维护模型广场本地基础定价。
2. 节省设置保存 `local_pricing_official_confirmed=true` 的实例级声明；该字段同时表示允许使用本地官方价格，不再增加语义重复的开关。
3. 个别模型需要纠偏时，仅在 `official_prices` 添加覆盖项；覆盖项优先于本地快照。
4. 本地定价或覆盖项更新后刷新模型广场缓存；新消费使用新快照，已有 `savings_estimate` 不回写。
5. 历史回算结果不落库，每次汇总按查询时的当前本地官方价计算，并在接口中单独统计数量。

如果覆盖项记录了官方来源更新时间且超过 90 天，管理员端提示“官方定价可能已过期”。本地模型广场数据目前没有可靠的官方更新时间，因此只记录 `price_snapshot_at`，不能把一分钟缓存刷新时间展示成“官方定价更新时间”。

### 5.2.1 模型广场复用边界

模型广场是默认官方定价快照的读取入口，但节省估算只读取基础定价字段：

- 模型广场展示层可以继续展示站内可用分组、分组价格和动态价格说明。
- 节省估算从 `model.GetPricing()` 读取 `QuotaType`、`ModelRatio`、`ModelPrice`、`CompletionRatio` 和各类 token 倍率。
- 本地来源的官方确认是实例级声明，不要求给模型广场每个模型新增 `official_confirmed` 字段。
- 如果同一个模型同时存在官方基准价和站内分组价，节省估算使用官方基准价，实际扣费使用消费日志最终 `quota`。
- 如果管理员把模型广场基础价改成促销价、采购价或其他非官方价，必须关闭 `local_pricing_official_confirmed`，或用已确认的 `official_prices` 覆盖后再开启展示。
- 如果后续在模型广场展示“约省 xx%”，也必须使用同一份官方定价快照，避免用户概览、日志详情和模型广场口径不一致。

因此，`official_prices` 只是覆盖层，不是启动节省估算的前置数据录入任务。

### 5.2.2 官方来源 URL 校验

官方定价来源 URL 用于审计和解释，不能成为安全风险或隐私泄露点。MVP 建议：

- 只允许 `http` 和 `https` URL。
- 保存前去除明显敏感的 query 参数，例如 `token`、`key`、`secret`、`signature`。
- 普通用户侧优先展示来源域名和更新时间，完整 URL 可放在管理员端。
- 管理员端允许查看完整 URL，但不得包含内部渠道控制台、带签名的临时链接或私有价格单。
- URL 为空时仍可确认官方定价，但必须记录 `source` 和 `price_snapshot_at`；`source_updated_at` 仅在确实已知官方更新时间时填写。

### 5.3 实际价来源

实际价以现有消费日志为准：

- 文本类：`service/text_quota.go` 结算后的 `summary.Quota`，作为 MVP 唯一统计来源。
- 任务类：现有任务结算路径中的最终 `Quota`，后续阶段接入。
- 固定按次类：现有 `ModelPriceHelperPerCall` 后的实际扣费，后续阶段接入。
- 订阅扣费：仍按实际消耗记录，展示层可说明“节省估算按请求实际消耗统计，不区分钱包或订阅来源”。

任务类、固定按次类和异步请求必须等失败退款、超时退款、实际用量重算和差额结算路径全部能同步修正节省估算后再纳入统计。MVP 不统计这些路径，避免退款后仍展示过高节省金额。

### 5.4 新旧消费记录策略

消费日志分为两类处理：

| 日志类型 | 数据来源 | 价格口径 | 稳定性 | 展示标识 |
| ---- | ---- | ---- | ---- | ---- |
| 新日志 | `other.savings_estimate` | 请求结算时的官方价格快照 | 后续价格变化不影响 | `snapshot` |
| 旧日志 | `model_name`、token、`quota`、`other` | 查询时的当前本地官方价 | 价格变化会改变回算结果 | `historical_rebuild` |

查询汇总时必须先读日志快照；只有日志没有 `savings_estimate` 时才尝试历史回算，不能覆盖或重复计算已有快照。

旧日志可直接复用的字段包括：`created_at`、`model_name`、`prompt_tokens`、`completion_tokens`、`quota` 和 `other`。其中 `quota` 是当时真实最终扣费。分组信息不参与官方价计算，MVP 汇总查询不读取数据库保留字 `group`。

历史回算第一阶段只支持满足以下确定性白名单的普通文本 token 计费和阶梯表达式计费：

- `prompt_tokens + completion_tokens > 0`。
- 本地官方价是 `QuotaType=0`，且 `BillingMode` 为空、`ratio`、`per_token` 或可确定性执行的 `tiered_expr`。
- `model.GetPricing()` 只包含当前可用模型；已下架或不再启用的历史模型没有本地匹配时，只能通过 `official_prices` 覆盖，否则跳过。
- `other` 必须是合法 JSON 对象，并至少包含 `group_ratio`、`cache_tokens`。普通倍率日志还必须包含 `model_ratio`、`completion_ratio`、`model_price`、`cache_ratio`；`model_price` 只接受项目历史上表示倍率计费的 `0` 或 `-1`。
- `billing_mode=tiered_expr` 的历史日志必须包含有效 `expr_b64`。系统使用日志内冻结表达式、token 明细和原 `group_ratio` 复算实际 quota；表达式包含 request rules、header、param、时间条件或日志未保存的输出图片/音频维度时跳过。
- 命中 `audio`、`ws`、`web_search`、`file_search`、`audio_input_seperate_price` 或 `image_generation_call` 标记时跳过。
- 缓存写入从 `cache_creation_tokens`、`cache_creation_tokens_5m`、`cache_creation_tokens_1h` 读取；字段不存在按 `0` 处理，但存在时必须是非负整数。
- 图片 token 只有在 `image=true`、`image_output` 为非负整数且官方价格存在合法 `ImageRatio` 时参与回算，否则跳过。
- Claude/OpenAI token 语义只依据 `usage_semantic` 和 `claude` 明确字段判断，不根据模型名猜测。
- 普通倍率日志使用日志内实际倍率和 token 明细复算当时 `quota`；阶梯日志复用 `pkg/billingexpr` 执行冻结表达式。两条路径都必须复用项目统一舍入与饱和规则，且复算值必须与日志 `quota` 完全一致。该校验可以识别未记录的附加倍率、工具费或旧日志语义差异；不一致时返回 `legacy_actual_quota_mismatch` 并跳过。
- 任何字段非法、quota 饱和或模型匹配不确定时跳过，不用简化公式放大节省金额。

历史回算不写回日志或数据库，避免制造伪历史快照。接口必须返回 `reconstructed_request_count`，前端在该值大于 0 时显示“含按当前官方定价回算的历史消费”。

功能上线后的新日志继续写入快照，这是长期主路径。若消费日志被关闭、清理或归档，系统只统计仍可查询的记录，前端不得把缺失日志解释为 0 消费或 0 节省。

## 6. 后端设计

### 6.1 配置结构

新增一个运营配置，建议命名为 `savings_estimate_setting`：

```json
{
  "enabled": false,
  "show_on_dashboard": true,
  "show_on_usage_logs": true,
  "local_pricing_official_confirmed": true,
  "rebuild_legacy_logs": true,
  "require_official_confirmation": true,
  "official_price_stale_days": 90,
  "max_summary_days": 31,
  "max_summary_log_rows": 50000,
  "updated_at": 1764230400,
  "official_prices": {}
}
```

配置原则：

- 默认关闭，只有官方定价快照和展示文案确认后再开启。
- 关闭时不计算、不展示；已写入的历史 `savings_estimate` 仍保留在日志中，但前端不展示。
- `local_pricing_official_confirmed=true` 同时表示允许读取 `model.GetPricing()`，也是管理员对当前实例本地基础定价来源的明确声明；默认开启。关闭后本地价格不得参与估算或“官方定价”文案。
- `rebuild_legacy_logs=true` 时回算缺少快照的已有消费日志；关闭后只聚合新日志快照。
- `official_prices` 可以为空；存在同模型覆盖项时覆盖本地快照，并继续受 `require_official_confirmation` 约束。
- 本地和覆盖项都未匹配时跳过，不猜价格。
- `max_summary_days` 限制用户侧查询窗口，避免把日志查询做成长期统计。
- `max_summary_log_rows` 是 MVP 的保护阈值；超过后应返回部分结果标识或提示用户缩小时间范围。

不保留 `reference_price_source` 和 `include_unpriced_models`：价格来源已经由固定优先级决定，而未定价模型必须跳过，两个配置项都没有合法的第二种行为。

兼容已有配置 JSON：升级时允许输入中继续存在已废弃字段，`common.UnmarshalJsonStr` 按未知字段忽略；下一次保存设置时输出规范化后的新结构，不需要数据库迁移或批量重写 option。

### 6.2 官方定价快照

新增运行时价格快照结构，字段尽量与 `model.Pricing` 对齐：

```go
type SavingsOfficialPrice struct {
    ModelName              string
    QuotaType              int
    ModelRatio             float64
    CompletionRatio        float64
    ModelPrice             float64
    CacheRatio             *float64
    CreateCacheRatio       *float64
    ImageRatio             *float64
    AudioRatio             *float64
    AudioCompletionRatio   *float64
    BillingMode            string
    BillingExpr            string
    Source                 string
    SourceURL              string
    SourceUpdatedAt        int64
    PriceSnapshotAt        int64
    PriceFingerprint       string
    OfficialConfirmed      bool
    ConfirmedAt            int64
    ConfirmedBy            string
}
```

该结构不需要第一阶段建表。匹配逻辑先读取 `options` 中的可选覆盖项，再把 `model.GetPricing()` 的匹配项转换成同一运行时结构。`PriceSnapshotAt` 是本次读取本地价格的时间；`SourceUpdatedAt` 仅在确实知道官方来源更新时间时填写。`PriceFingerprint` 用于证明实际使用的是哪一组价格字段。`ConfirmedBy` 只用于管理员审计，不向普通用户展示。

`PriceFingerprint` 使用固定字段 struct 依次写入 `ModelName`、`QuotaType`、`ModelRatio`、`CompletionRatio`、`ModelPrice`、缓存倍率、图片倍率、音频倍率、`BillingMode` 和 `BillingExpr`，通过 `common.Marshal` 序列化后计算 SHA-256。不得直接对 map、展示金额、来源 URL 或时间戳计算哈希，避免无业务变化时指纹漂移。

后续当价格源、审计和版本管理复杂化后，再考虑独立表。

### 6.2.1 缓存与失效策略

官方定价快照可以复用现有模型广场的一分钟缓存思路，但需要独立失效语义：

- 管理员确认、取消确认或更新官方定价后，立即刷新官方定价快照缓存。
- 站内分组倍率、用户特殊倍率、渠道成本、充值倍率变化时，不应刷新历史日志中的节省估算。
- 快照缓存影响新请求写入的 `savings_estimate`，也影响缺少快照的旧日志回算；已有日志快照始终优先且不变化。
- 如果缓存刷新失败，应停止写入新的节省估算并记录系统错误，不能使用过期或半更新快照继续生成用户可见金额。
- 多实例部署下复用现有 option/settings 广播和 `InvalidatePricingCache` 失效机制；没有跨实例通知时，允许一分钟缓存窗口内使用旧本地快照，并通过 `price_snapshot_at` 保持可解释。

### 6.3 日志字段

不建议第一阶段修改 `logs` 表结构。应复用 `logs.other`，新增普通用户可见字段：

```json
{
  "savings_estimate": {
    "schema_version": 1,
    "calculator": "text_token_v1",
    "official_quota": 1200,
    "actual_quota": 800,
    "savings_quota": 400,
    "source": "local_pricing_snapshot",
    "source_url": "https://provider.example/pricing",
    "source_updated_at": 1764230400,
    "price_snapshot_at": 1764230500,
    "price_fingerprint": "sha256:8fd9...",
    "official_confirmed": true,
    "matched_model": "gpt-4o",
    "pricing_mode": "per_token",
    "calculation_mode": "snapshot",
    "estimated": true
  }
}
```

字段说明：

| 字段 | 说明 |
| ---- | ---- |
| `schema_version` | 日志快照结构版本，MVP 固定为 `1` |
| `calculator` | 估算计算器标识，例如 `text_token_v1` |
| `official_quota` | 按官方定价估算的 quota |
| `actual_quota` | 本次实际扣费 quota |
| `savings_quota` | 非负节省 quota |
| `source` | 官方定价来源 |
| `source_url` | 官方定价来源 URL，可为空；写入前必须确认可公开或完成脱敏 |
| `source_updated_at` | 官方定价源更新时间，可未知且为 `0` |
| `price_snapshot_at` | 本次结算读取本地定价快照的时间，不等同于官方更新时间 |
| `price_fingerprint` | 官方价格关键字段的稳定 SHA-256 指纹，用于复核使用的价格版本 |
| `official_confirmed` | 是否已确认来源于官方定价 |
| `matched_model` | 本次估算匹配到的官方定价模型名 |
| `pricing_mode` | `per_token`、`per_request`、`tiered_expr` 等 |
| `calculation_mode` | 新日志固定为 `snapshot`；历史回算结果不写入日志 |
| `estimated` | 固定为 `true`，向前端明确这是估算数据 |

不放入 `admin_info`，因为节省金额是用户可见价值信息；但可额外在 `admin_info` 放调试字段，例如匹配到的原始模型名、跳过原因或价格版本。

日志解析必须向前兼容：

- 未知 `schema_version` 默认跳过聚合，不报错。
- 缺少 `savings_estimate` 时进入历史回算分支，而不是直接丢弃。
- 已有 `savings_estimate` 但结构或字段非法时跳过，不降级回算，避免损坏快照被静默替换。
- `Other` 为空、非 JSON 或缺少历史回算基础字段时保守跳过。
- 已存在的 `schema_version=1` 快照可能没有新增字段：缺少 `calculation_mode` 时按 `snapshot` 处理，缺少 `price_snapshot_at` 或 `price_fingerprint` 时仍允许聚合，只表示该旧快照的价格版本不可完整审计。
- 新版本可以增加字段，但不能改变 `official_quota`、`actual_quota`、`savings_quota` 的含义。

### 6.4 模型名匹配

官方定价快照匹配必须使用稳定、可追溯的顺序：

1. 优先使用 `relayInfo.OriginModelName`。
2. 若请求发生模型映射，记录并尝试匹配映射前模型名和映射后模型名。
3. 对 compact、thinking budget 等项目已有模型名规则，复用 `ratio_setting.FormatMatchingModelName` 的归一化结果。
4. 最后才允许使用已有通配符规则，例如 compact wildcard 或明确配置的模型通配符。
5. 匹配失败时跳过节省估算，不使用相似名称、供应商名称或前缀猜测。

写入日志时必须保存 `matched_model`，用于后续解释历史估算为什么使用某个官方定价。

历史回算没有 `relayInfo`，候选模型仅来自 `log.model_name`、`ratio_setting.FormatMatchingModelName(log.model_name)` 和项目已有的明确通配符规则。不得用渠道、供应商或字符串相似度推测模型。

### 6.5 计算入口

文本类请求在 `service/text_quota.go` 中完成实际扣费后，写日志前注入 `savings_estimate`。

推荐流程：

```text
calculateTextQuotaSummary
  -> 得到 actual quota
  -> TryTieredSettle 如适用
  -> build other
  -> AttachSavingsEstimate(ctx, relayInfo, usage, actualQuota, other)
  -> attachQuotaSaturation
  -> RecordConsumeLog
```

MVP 只在文本类成功消费日志写入前注入。任务类和固定按次类走对应日志写入前的同名注入函数，但必须在第二阶段完成退款/重算闭环后再开启，保持“只影响日志，不影响扣费”。

### 6.6 计算规则

#### 普通 token 模型

按现有实际计费公式的结构计算官方定价估算，但使用官方定价快照字段：

```text
official_quota =
  (
    prompt_tokens
    + completion_tokens * official_completion_ratio
    + cache_tokens * official_cache_ratio
    + cache_create_tokens * official_create_cache_ratio
    + image_tokens * official_image_ratio
    + audio_tokens * official_audio_ratio
  )
  * official_model_ratio
```

再通过 `common.QuotaFromDecimalChecked` 转换为 quota，遵守现有溢出保护。

注意事项：

- 必须复用现有 token 归一化语义，避免缓存、图片、音频重复计价。
- Claude 语义与 OpenAI 语义要与实际扣费路径保持一致。
- 没有足够 usage 数据时跳过，不估算。

#### 固定按次模型

```text
official_quota = official_model_price * common.QuotaPerUnit
```

如果实际扣费使用了分组倍率、请求倍率或任务倍率，官方定价默认不叠加站内分组优惠，只代表官方公开基准价。任务时长、分辨率、数量等官方也收费的参数，第二阶段只在已有可靠参数和边界校验时纳入。

#### 动态表达式模型

MVP 支持仅依赖已保存 token 维度的确定性 `tiered_expr`，复用 `pkg/billingexpr` 并以 `groupRatio=1` 计算官方基准：

```text
official_quota = official_expr_result / 1_000_000 * common.QuotaPerUnit
```

新请求可直接使用模型广场官方表达式生成快照。历史请求还必须使用日志 `expr_b64` 复算并验证实际 `quota`。依赖 request body、headers、时间条件、request rules 或日志未保存 token 维度的表达式仍跳过；没有官方定价表达式时也跳过，不用简单 input/output 比率猜测复杂表达式。

### 6.7 服务边界

独立的 `service/savings_estimate.go` 负责四件事：

1. 按“人工覆盖 -> 本地模型广场”的优先级读取官方定价快照。
2. 根据本次 usage 和实际扣费生成 `savings_estimate`。
3. 解析已有日志快照，或对无快照旧日志执行受限回算。
4. 聚合用户时间窗口，并区分快照数量与回算数量。

它不应该负责：

- 修改用户余额。
- 改变实际扣费 quota。
- 处理退款、补扣或订阅权益。
- 同步第三方价格源。
- 渲染前端金额和货币。

推荐内部返回结构：

```go
type SavingsEstimateResult struct {
    Estimate  *SavingsEstimate
    SkipReason string
}
```

`Estimate == nil` 表示不写用户可见字段。`SkipReason` 只进入管理员调试或日志，不向普通用户暴露。

### 6.8 跳过原因枚举

为便于调试和测试，跳过原因建议使用稳定枚举字符串：

| 原因 | 说明 |
| ---- | ---- |
| `disabled` | 功能关闭 |
| `missing_official_price` | 没有官方定价快照 |
| `unconfirmed_official_price` | 价格源未确认来自官方 |
| `missing_usage` | 缺少 usage，无法估算 |
| `unsupported_billing_mode` | MVP 不支持该计费模式 |
| `unsupported_async_task` | MVP 不支持异步任务路径 |
| `unknown_extra_ratio` | 命中未知附加倍率 |
| `quota_saturated` | 官方定价估算触发 quota 饱和 |
| `invalid_snapshot` | 官方定价快照字段非法 |
| `legacy_log_insufficient_detail` | 旧日志缺少特殊 token 或附加计费明细，不能安全回算 |
| `legacy_log_invalid_snapshot` | 旧日志包含损坏的 `savings_estimate`，禁止降级回算 |
| `legacy_log_missing_base_fields` | 旧日志缺少稳定文本计费基础字段 |
| `legacy_actual_quota_mismatch` | 使用日志内倍率无法复算出原始实际 quota，可能存在未记录附加计费 |

这些枚举可用于后端测试、管理员日志和运营覆盖率分析，但不应出现在普通用户界面。

## 7. 聚合接口设计

### 7.1 用户接口

新增：

```http
GET /api/user/savings/summary?start_timestamp=...&end_timestamp=...
```

返回：

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "savings_quota": 123456,
    "official_quota": 345678,
    "actual_quota": 222222,
    "request_count": 128,
    "estimated_request_count": 112,
    "snapshot_request_count": 72,
    "reconstructed_request_count": 40,
    "coverage_ratio": 0.875,
    "source": "mixed",
    "official_confirmed": true,
    "source_updated_at": 1764230400,
    "rebuild_price_snapshot_at": 1764230500,
    "official_price_stale": false,
    "is_partial": false,
    "window_days": 30
  }
}
```

说明：

- `enabled=false` 表示功能关闭，前端应隐藏节省入口和金额。
- `request_count` 是范围内总消费请求数。
- `estimated_request_count` 是成功估算的请求总数，等于快照数量与历史回算数量之和。
- `snapshot_request_count` 是直接使用日志内 `savings_estimate` 的请求数。
- `reconstructed_request_count` 是缺少日志快照、按查询时当前本地官方价回算的请求数。
- `coverage_ratio` 用于提示估算覆盖率。
- `source` 是汇总分类：只有本地来源时为 `local_pricing_snapshot`，只有覆盖项时为 `official_override`，存在多种来源或旧版 `official_snapshot` 与新来源并存时为 `mixed`。单条日志保留原始 source，不强行改写历史数据。
- 只查询当前登录用户。
- MVP 查询窗口建议限制在 31 天以内，只承诺本月和近 24 小时等短窗口。
- 不提供 lifetime/cumulative 字段，避免日志清理或归档后累计值失真。
- 为兼容现有 API 和前端，保留 `source_updated_at` 字段；汇总语义固定为所有已知官方来源更新时间中的最早值，完全未知时为 `0`。
- `official_price_stale` 只根据已知的 `source_updated_at` 判断；本地来源更新时间未知时不伪造过期结论。
- `rebuild_price_snapshot_at` 是本次查询为历史回算构建价格 Map 的时间；没有历史回算时为 `0`。
- `official_confirmed=true` 表示所有被纳入金额的价格都通过人工覆盖确认或本地实例级官方声明，不能使用“任意一条已确认”的宽松逻辑。
- `is_partial` 表示日志扫描超过保护阈值，前端应弱化或隐藏金额并提示缩小范围。
- 时间范围使用 `[start_timestamp, end_timestamp)` 左闭右开区间，避免相邻窗口重复统计。
- `end_timestamp` 必须大于 `start_timestamp`。为容忍浏览器与服务器时钟偏差，后端接受不超过服务器当前时间 5 分钟的值，并将实际查询结束时间截断为服务器当前时间；超过 5 分钟才返回“结束时间不能晚于当前时间”。窗口天数和日志查询都使用截断后的时间。
- 时间校验服务应返回规范化后的 `effective_end_timestamp`，controller 必须把它传给汇总查询，不能只完成校验后继续使用原始未来时间。

### 7.2 管理员接口

可后续增加：

```http
GET /api/savings/summary?username=...&start_timestamp=...&end_timestamp=...
```

用于运营分析，不作为 MVP 必需项。

### 7.3 查询实现

MVP 为了兼容 SQLite、MySQL、PostgreSQL 和 ClickHouse，不依赖数据库 JSON 查询函数。推荐两阶段：

1. 时间范围较短的用户侧汇总，按 `user_id`、`type=consume`、时间范围查询日志后在 Go 中优先解析快照，再回算旧日志。
2. 后续如果需要长期累计高性能统计，再把 `savings_quota` 汇总进 `quota_data` 或新增聚合表。

不建议第一阶段使用 MySQL JSON_EXTRACT 或 PostgreSQL JSONB 操作符，因为会增加跨数据库分支。

MVP 查询实现约束：

- 只查询必要字段：`id`、`created_at`、`model_name`、`prompt_tokens`、`completion_tokens`、`quota`、`other`。`group` 不参与计算且是数据库保留字，MVP 不查询。
- 查询前先按相同条件 `COUNT`，超过 `max_summary_log_rows` 时返回 `is_partial=true`，并建议前端提示缩小时间范围。
- 后端不要为部分结果补推测值；部分结果只用于保守展示或隐藏金额。
- 查询条件必须包含 `user_id` 和时间范围，不能允许无边界扫描。
- 时间范围参数无效时返回 400，不使用“默认全部时间”。
- 每次汇总只调用一次 `model.GetPricing()`，构建 `map[string]SavingsOfficialPrice`；人工覆盖同步构建为 Map。单条日志只执行有限模型候选查找，整体复杂度为 O(价格模型数 + 日志数)，禁止逐日志线性扫描完整价格列表。
- 单条日志 quota 仍使用现有 `int`，但 `official_quota`、`actual_quota`、`savings_quota` 的汇总字段使用 `int64` 并做受检累加。按单条 quota 的 int32 安全上限和 50,000 行保护阈值，前端数值仍低于 JavaScript `Number.MAX_SAFE_INTEGER`。

### 7.3.1 单条日志聚合流程

```text
读取 consume log
  -> other 中存在合法 savings_estimate：聚合快照，snapshot_request_count + 1
  -> other 中存在但损坏的 savings_estimate：跳过，不回算
  -> 不存在 savings_estimate 且 rebuild_legacy_logs=false：跳过
  -> 不存在 savings_estimate 且允许回算：校验基础字段和禁止标记
  -> 使用日志内倍率复算实际 quota；不一致则跳过
  -> 匹配 official_prices 覆盖项，否则匹配 model.GetPricing()
  -> 仅普通文本 token 计费可安全计算：聚合，reconstructed_request_count + 1
  -> 其他情况：按稳定 skip reason 跳过
```

快照计算和历史回算必须复用同一个纯计算函数，输入为标准化 token 摘要、实际 `quota` 与官方价格。功能开关、模型匹配和日志解析放在调用方，避免构造伪造 `gin.Context` 或 `RelayInfo`。

### 7.4 失败行为与错误码

用户汇总接口建议采用稳定的失败口径：

| 场景 | 建议响应 |
| ---- | ---- |
| 功能关闭 | `200`，返回 `enabled=false` 和空汇总，前端隐藏入口 |
| 时间范围缺失 | `400`，提示必须传入开始和结束时间 |
| 时间范围非法 | `400`，提示时间范围无效 |
| 结束时间领先服务器不超过 5 分钟 | `200`，内部截断到服务器当前时间后查询 |
| 结束时间领先服务器超过 5 分钟 | `400`，提示结束时间不能晚于当前时间 |
| 超过 `max_summary_days` | `400`，提示缩小时间范围 |
| 超过 `max_summary_log_rows` | `200`，返回 `is_partial=true`，不返回推测金额 |
| 无可估算日志 | `200`，返回 `savings_quota=0`、`estimated_request_count=0`，前端隐藏金额 |
| 官方定价全部过期 | `200`，返回 `official_price_stale=true`，前端展示更新时间 |
| 本地定价未声明为官方 | `200`，本地回退不可用；仅统计已确认覆盖项，否则返回无可估算日志 |
| 旧日志细节不足 | `200`，跳过对应日志并降低 `coverage_ratio` |

这里不建议用 `404` 表示功能关闭或无数据，因为这不是资源不存在，而是产品展示条件不足。

### 7.5 前端类型建议

前端 API 类型应保持和后端响应一致，避免在组件里拼装业务语义：

```ts
type SavingsSummary = {
  enabled: boolean
  savings_quota: number
  official_quota: number
  actual_quota: number
  request_count: number
  estimated_request_count: number
  snapshot_request_count: number
  reconstructed_request_count: number
  coverage_ratio: number
  source: string
  official_confirmed: boolean
  source_updated_at: number
  rebuild_price_snapshot_at: number
  official_price_stale: boolean
  is_partial: boolean
  window_days: number
}
```

组件根据 `enabled`、`is_partial`、`savings_quota`、`coverage_ratio` 和 `reconstructed_request_count` 决定展示状态；金额格式化继续复用现有 quota/currency 工具。滚动升级期间若旧后端尚未返回新增字段，前端将 `snapshot_request_count` 回退为 `estimated_request_count`，将 `reconstructed_request_count` 和 `rebuild_price_snapshot_at` 回退为 `0`。

## 8. 前端设计

### 8.1 用户概览

在用户概览余额摘要区域增加一个轻量指标：

```text
已为你节省约 ¥32.18
按官方定价估算，近 24 小时覆盖 87.5% 请求
其中 40 条历史消费按当前官方定价回算
```

位置建议：

- 放在 `SummaryCards` 右侧余额区域的次级信息位。
- 不新增大面积营销卡片。
- 功能已开启但没有可估算数据时保留轻量状态位，展示“暂无可估算的消费记录”，便于用户确认功能已生效；不展示“已节省 ¥0”。
- 当 `is_partial=true` 时不展示金额，只展示“数据量较大，请缩小时间范围查看估算节省”。
- 当 `official_price_stale=true` 时仍可展示金额，但必须同时展示已知的官方定价更新时间。
- 当 `reconstructed_request_count>0` 时展示历史回算说明，不能把回算结果描述为请求当时已固化的价格。
- 当 `savings_quota=0` 时隐藏节省金额，避免出现没有价值感的“节省 0”。
- 功能关闭时隐藏入口；覆盖率为 0 或日志窗口不完整时展示保守状态，不把空数据渲染成“已节省 ¥0”。
- 概览窗口固定为滚动 24 小时。请求执行时重新计算 `end=当前 Unix 秒`、`start=end-24h`，不能把组件首次挂载时的时间范围永久缓存。
- 查询 key 使用稳定的“rolling-24h”语义，查询函数内生成当前时间；保持现有 60 秒 stale time，并在窗口重新聚焦或定时刷新时获得新的时间窗口，避免页面长时间打开后数据停留在旧区间。

### 8.2 钱包页

钱包页展示后置到聚合表阶段。只有当长期累计值可靠后，才在充值主流程附近展示累计节省：

```text
累计估算节省：¥1,284.90
```

用途是增强用户充值前的价值感知，但不能遮挡充值金额、到账金额和支付方式。MVP 不在钱包页展示节省金额，避免用户把额度差额理解为真实现金返还或付款差额。

### 8.3 用量日志

日志详情弹窗展示单次请求：

```text
官方定价估算：¥0.0120
实际扣费：¥0.0080
估算节省：¥0.0040
来源：官方定价快照，更新时间：2026-07-27
```

列表列不建议默认新增，避免请求日志过宽。可在列设置中作为可选列。

新日志直接展示持久化快照。已有旧日志第一阶段只参与概览汇总，不在日志详情中即时拼装一个未持久化对象；如后续要展示单条旧日志回算，后端必须返回显式的 `calculation_mode=historical_rebuild`，前端显示“按当前官方定价回算”。

### 8.4 节省设置

设置页应直接说明：默认使用模型广场本地官方定价，`official_prices` 仅用于可选覆盖。默认 JSON 必须包含：

```json
{
  "local_pricing_official_confirmed": true,
  "rebuild_legacy_logs": true,
  "official_prices": {}
}
```

管理员关闭 `local_pricing_official_confirmed` 后，界面不得继续声称本地价格是官方价。

### 8.5 模型广场

模型广场可以展示“站内价 vs 官方定价”的弱提示：

```text
约省 24%
```

但这应作为后续阶段。MVP 优先完成基于真实请求日志的用户节省金额，因为它更贴近实际价值。

### 8.6 国际化

新增所有可见文本必须进入 `web/src/i18n/locales/{lang}.json`：

- en
- zh
- zh-TW
- fr
- ru
- ja
- vi

组件中使用 `useTranslation()` 和 `t('English key')`。长语言下金额、百分比和说明允许换行，不固定高度。

### 8.7 节省趋势图扩展

用量分析中的“官方价估算 vs 已覆盖请求实际消费”趋势图采用独立设计，详见 `docs/user-savings-trend-design.md`。该扩展继续复用本设计的价格来源、快照优先、历史回算、覆盖率和受检 quota 汇总口径。

## 9. 边界与跳过策略

以下情况不计算节省金额：

- 没有官方定价。
- 价格源未确认来自官方定价。
- 上游没有返回 usage，实际扣费为 0。
- 任务类、固定按次类或异步请求尚未接入退款/重算闭环。
- 模型使用复杂动态表达式，但缺少官方定价表达式。
- 请求命中未知附加倍率，无法安全映射到官方价。
- 官方定价估算触发 quota 饱和。
- 旧日志缺少可判断特殊 token、工具附加费或计费模式所需的明细。
- 旧日志已经包含损坏的 `savings_estimate`；此时不得降级到当前价格回算。

跳过时不写用户可见 `savings_estimate`。管理员调试可选写入：

```json
{
  "admin_info": {
    "savings_skip_reason": "missing_reference_price"
  }
}
```

实际扣费大于或等于官方定价估算时，不属于估算失败。后端可以写入 `savings_quota=0` 的 `savings_estimate` 以保留覆盖率和解释性，但前端不展示“节省 0”，也不展示负节省。

## 10. 安全与合规

- 节省金额仅用于展示，不参与扣费、退款、发票、充值到账或订阅权益。
- 不向前端暴露内部渠道成本、供应商密钥、渠道余额或管理员采购价。
- 不向普通用户暴露 `ConfirmedBy`、内部审计备注、导入任务 ID 或管理员账号。
- 用户只能查看自己的节省汇总。
- 管理员聚合接口必须沿用现有管理权限中间件。
- 官方定价确认动作建议写入审计事件 `savings.official_price_confirm`，取消确认写入 `savings.official_price_unconfirm`，批量更新写入 `savings.official_price_update`。
- `local_pricing_official_confirmed` 的开启和关闭同样属于来源声明变更，应写入管理审计日志。
- 所有 JSON 编解码继续使用 `common.Marshal`、`common.Unmarshal`、`common.DecodeJson` 等包装函数。
- 所有 quota 转换使用 `common.QuotaFromDecimalChecked` 等现有安全函数，禁止裸 `int(...)` 转换。
- 跨数据库实现避免数据库专属 JSON 查询语法，除非为每个受支持数据库提供分支与回退。
- 普通用户可见的 `source_url` 必须经过脱敏或只展示域名，避免把带 token 的导入地址写进日志后长期暴露。

### 10.1 可观测性

MVP 只保留以下三个轻量指标或结构化日志，避免为展示功能先建设完整指标体系：

- `savings_estimate_attached_total`：成功写入估算的请求数。
- `savings_estimate_skipped_total{reason}`：新日志和历史回算统一按跳过原因统计。
- `savings_legacy_rebuild_total`：成功回算的旧日志数。

这些指标只用于内部观测，不向普通用户展示。灰度期重点关注覆盖率、跳过原因分布和用户侧误解反馈，不以总节省金额作为唯一成功指标。

## 11. 实施阶段

### 11.1 阶段一：本地价格与新旧日志 MVP

后端：

1. 新增 savings estimate 配置。
2. 构建“人工覆盖优先、本地模型广场回退”的官方定价读取函数。
3. 抽取新日志快照与旧日志回算共用的纯 quota 计算函数。
4. 在文本类消费日志写入前注入 `other.savings_estimate`。
5. 扩展汇总日志查询字段，并对缺少快照的已有普通文本消费执行受限回算。
6. 为价格快照增加稳定 `price_fingerprint`，并在汇总请求内预构建价格 Map。
7. 扩展用户节省汇总接口，返回快照数量、回算数量、覆盖率和历史回算价格快照时间。
8. 增加后端单元测试，覆盖来源优先级、普通倍率与阶梯表达式历史回算、实际 quota 复算校验、价格指纹、动态请求表达式跳过、负节省和受检汇总。

前端：

1. 新增 savings summary API 与类型。
2. 在用户概览展示滚动近 24 小时估算节省、覆盖率与历史回算说明。
3. 在日志详情展示单次估算节省。
4. 设置页默认提供可视化开关与统计限制表单，并保留 JSON 高级模式；明确本地模型广场为默认来源、覆盖 JSON 为可选，模式切换时保留未知字段和高级价格字段。
5. 补齐七语言。

### 11.2 阶段二：任务类与固定按次

- 完成失败退款、超时退款、实际用量重算和差额结算对节省估算的修正策略。
- 接入 Midjourney、Sora、Veo、图片生成等固定按次或任务类路径。
- 对时长、分辨率、数量等附加倍率建立官方价映射。
- 在任务日志详情中展示估算节省。

### 11.3 阶段三：运营分析与模型广场对比

- 管理员按用户、分组、模型查看总节省。
- 模型广场展示官方定价与站内价差异。
- 可选增加价格源更新时间、来源说明和覆盖率报表。

### 11.4 阶段四：聚合表优化

当日志量较大时，增加聚合持久化：

- 在 `quota_data` 中增加 `savings_quota`、`official_quota`，或新增 `savings_data` 表。
- 写入时按天、用户、模型、分组汇总。
- 基于聚合数据再开放累计节省和钱包页累计展示。
- 保持 SQLite、MySQL、PostgreSQL 迁移兼容。

### 11.5 灰度与回滚

上线建议按以下顺序：

1. 发布后端配置、官方定价快照和日志注入能力，但保持 `enabled=false`。
2. 确认当前实例模型广场基础定价为官方价，并仅为例外模型配置覆盖项。
3. 在测试环境或内部账号开启，检查日志详情中的单次估算。
4. 开启用户汇总接口，但前端入口保持隐藏。
5. 对小范围用户展示用户概览指标，观察跳过率、覆盖率和反馈。
6. 全量展示用户概览，日志详情保持可解释。

回滚策略：

- 关闭 `enabled` 后，停止写入新的 `savings_estimate`，前端隐藏汇总入口。
- 已写入日志无需清理；它们只是历史展示快照，不影响账务。
- 如果发现本地定价来源声明错误，应关闭 `local_pricing_official_confirmed` 并刷新缓存；已写入快照不自动回写，历史回算会在下次查询时停止或改用覆盖项。
- 如果前端文案引发误解，可只关闭 `show_on_dashboard`，保留日志详情供管理员和用户解释。

## 12. 测试要求

### 12.1 后端测试

建议测试点：

- token 模型按官方定价计算 `official_quota` 和 `savings_quota`。
- 未配置 `official_prices` 时可从 `model.GetPricing()` 匹配本地官方价。
- 同一模型同时存在覆盖项和本地价时，已确认覆盖项优先。
- `local_pricing_official_confirmed=false` 时不使用本地价，但仍可使用已确认覆盖项。
- 阶段二接入后，固定按次模型计算正确。
- 无官方定价时不写 `savings_estimate`。
- 价格源未确认官方来源时不写 `savings_estimate`。
- 实际扣费高于官方定价估算时 `savings_quota=0`，前端不展示节省金额。
- 动态表达式缺少官方定价表达式时跳过。
- 任务类和固定按次类在 MVP 中跳过。
- 模型映射、归一化和通配符匹配会写入正确的 `matched_model`。
- 写入 `schema_version=1`、`calculator=text_token_v1` 和稳定 `price_fingerprint`；价格字段不变时指纹不变，任一计费字段变化时指纹变化。
- 已有 schema v1 快照缺少 `calculation_mode`、`price_snapshot_at` 或 `price_fingerprint` 时仍能聚合。
- `Other` 中已有字段不被覆盖。
- 无 `savings_estimate` 的旧日志可根据模型、基础 token 和实际 `quota` 回算。
- 旧日志基础倍率字段完整，且缓存、缓存写入、图片等明细有效时正确回算。
- `Other` 为空、非 JSON 或缺少任一稳定基础字段时返回 `legacy_log_missing_base_fields` 并跳过。
- 使用日志内倍率复算结果与实际 `quota` 不一致时返回 `legacy_actual_quota_mismatch` 并跳过。
- 旧日志命中音频、WSS、搜索、独立音频价或图片生成调用费标记时跳过。
- 已有损坏快照或未知 `schema_version` 时跳过且不降级回算。
- 非管理员日志格式化不剥离 `savings_estimate`，但继续剥离 `admin_info`。
- 汇总接口只返回当前用户的数据。
- 汇总接口使用 `[start_timestamp, end_timestamp)`，相邻窗口不重复统计。
- 结束时间领先服务器不超过 5 分钟时截断到当前时间；超过 5 分钟时返回 400，避免浏览器时钟偏差再次触发误报。
- 查询窗口超过 `max_summary_days` 时返回 400。
- 超过 `max_summary_log_rows` 时返回 `is_partial=true`，且不补推测金额。
- 功能关闭时返回空汇总并由前端隐藏入口。
- 时间范围缺失、非法或超过上限时返回 400。
- 官方来源 URL 只接受 `http`/`https`，敏感 query 参数被剔除或拒绝。
- 官方定价确认、取消确认、批量更新会写入审计动作。
- 官方定价缓存刷新失败时不写入新的用户可见节省估算。
- 官方定价超过过期阈值时返回 `official_price_stale=true`。
- 本地快照只记录 `price_snapshot_at`，不会把缓存刷新时间伪装成 `source_updated_at`。
- 汇总返回的 `estimated_request_count` 等于 `snapshot_request_count + reconstructed_request_count`。
- 汇总 quota 超过 int32 时仍以正确的 `int64` 值返回，不发生回绕或负数。
- 混合来源汇总继续返回兼容字段 `source_updated_at`，其值为最早的已知官方来源更新时间；无历史回算时 `rebuild_price_snapshot_at=0`。
- 当前本地价格变化不影响已有快照，但会影响下一次旧日志回算结果。
- 跳过原因枚举稳定，可被测试断言和管理员调试使用。
- 大数、NaN、Inf 和饱和路径不产生负节省。

新增或大幅重写 Go 测试使用 `require` 做前置和致命断言，使用 `assert` 做值断言。

### 12.2 前端测试

建议测试点：

- 有节省数据时概览展示金额和估算说明。
- 功能已开启但无节省数据时展示“暂无可估算的消费记录”，不展示“节省 0”。
- 覆盖率低于 100% 时展示覆盖率说明。
- `reconstructed_request_count>0` 时展示“按当前官方定价回算”的历史数据说明。
- 旧后端缺少新增计数字段时，前端使用兼容默认值且不报错。
- 页面持续打开或重新聚焦时，滚动 24 小时查询会使用新的当前时间，不复用首次挂载时的固定结束时间。
- `is_partial=true` 时不展示金额并提示缩小时间范围。
- `official_price_stale=true` 时展示官方定价更新时间。
- `savings_quota=0` 时隐藏节省金额。
- 功能关闭、覆盖率为 0 或 `is_partial=true` 时不把金额展示成“节省 0”。
- 日志详情正确展示官方定价估算、实际扣费、节省和来源。
- 长翻译不导致按钮或卡片文本溢出。
- 货币展示跟随现有 quota/currency 配置。

## 13. 验收标准

- 关闭配置后，用户界面完全不出现节省金额。
- 开启配置后，文本类请求能在日志详情看到单次估算节省。
- 用户概览能展示滚动近 24 小时估算节省与覆盖率，页面持续打开时窗口仍会向前滚动。
- `official_prices` 为空时，只要本地价格官方声明有效，模型广场已有模型即可参与估算。
- 功能上线前已有的普通文本消费记录可进入汇总，并单独返回回算数量。
- 历史日志只有在基础字段完整且日志内倍率或冻结阶梯表达式能精确复算实际 `quota` 时才纳入，无法证明安全时跳过。
- MVP 不展示累计节省，不在钱包页展示节省金额。
- 官方定价变更后，已有 `savings_estimate` 的日志金额保持不变；无快照旧日志按当前价格重新回算并明确标识。
- 无官方定价或不可安全估算的请求不会产生误导展示。
- 未确认官方来源的价格不会参与节省估算。
- 官方定价确认动作可审计，包含操作者、来源和模型范围。
- 官方来源 URL 不向普通用户泄露敏感 query 或内部地址。
- 官方定价缓存更新后影响新日志和后续旧日志回算，但不回写或改变已有日志快照。
- 新日志记录稳定价格指纹；汇总在 50,000 行保护范围内使用 `int64` 安全累加，并且不会逐日志扫描完整模型价格列表。
- 关闭 `enabled` 后停止写入新的节省估算，前端隐藏入口，历史日志不影响账务。
- 超过日志扫描阈值时前端不展示不完整金额。
- 实际扣费、用户余额、订阅扣费、充值到账和退款逻辑无变化。
- SQLite、MySQL、PostgreSQL 下后端测试通过。
- 前端 i18n、类型检查、相关测试和构建通过。

## 14. 设计原则应用

- KISS：第一阶段直接复用 `model.GetPricing()`、日志基础列和 `logs.other`，不新建价格表或回填任务。
- YAGNI：先覆盖文本类和用户概览，不提前实现全量任务模型与长期聚合表。
- DRY：新日志快照与旧日志回算共用同一 quota 计算函数，官方价格运行时结构与模型广场字段对齐。
- SOLID：节省估算作为独立服务注入日志，不侵入实际计费和扣费路径。

## 15. 推荐结论

建议实现该功能，并按“估算节省”定位上线。MVP 默认读取模型广场本地官方价，`official_prices` 仅作为可选覆盖；新消费写快照，已有普通文本消费按当前官方价受限回算。该方案能直接利用现有数据，同时保留来源声明、覆盖率与计算模式的可解释性。

## 16. 遗漏与过当检查

当前方案建议保留的必要项：

- 本地模型广场官方来源声明、可选覆盖项和价格快照时间，解决“钱从哪里来”的可信度问题。
- 新日志写入时固化快照，解决上线后价格漂移问题。
- 旧日志受限回算并单独计数，解决已有消费无法展示的问题。
- 用户侧短窗口聚合，解决 MVP 性能和日志保留不确定性问题。
- 未确认、无 usage、依赖请求上下文的动态表达式、异步退款链路先跳过，避免误导用户。
- 前端按估算展示并在不完整数据时隐藏金额，降低财务误解风险。

当前方案刻意不做的项：

- 不做自动官网抓价。官方价格页面格式不稳定，维护成本高，MVP 没必要。
- 不做累计节省。没有聚合表前，累计值会受日志保留影响。
- 不做钱包页累计营销。容易被理解成现金返还或付款差额。
- 不在运行时抓取官网或第三方接口；价格只从当前实例本地快照读取。
- 不把负节省展示给用户。该功能目标是价值感知，不是价格争议提示。

总体判断：核心闭环已经覆盖本地官方价、新日志快照、已有消费回算、确定性阶梯表达式、来源声明、查询边界和 UI 解释。历史回算结果随当前价格变化是有意接受的限制，必须通过 `reconstructed_request_count` 和文案显式披露。若第一阶段再加入数据库回填、任务类、依赖请求上下文的动态表达式或累计金额，就属于过当。
