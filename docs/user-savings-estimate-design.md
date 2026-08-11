# 用户节省金额展示功能设计文档

> 状态：短窗口与历史累计功能已实施（2026-07-29）
> 目标功能：向用户展示“RAPI 已帮你节省约 xx 元”
> 基准日期：2026-07-27
> 累计扩展确认日期：2026-07-29
> 相关页面：用户概览、钱包、用量日志、模型广场
> 相关模块：`model/pricing.go`、`controller/pricing.go`、`service/text_quota.go`、`model/log.go`、`web/src/features/pricing/**`、`web/src/features/dashboard/**`、`web/src/features/usage-logs/**`
> 后续 UI 改造：`docs/user-savings-summary-ui-redesign.md`

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
- 在独立聚合阶段尽可能回算历史消费并冻结结果，为用户提供稳定的累计估算节省、累计覆盖率和统计起始时间。
- 文案明确为“估算”和“官方定价”，不作为严格财务账单。
- 对管理员可解释：每条日志能追溯官方定价、实际扣费和差额。
- 不影响现有计费、预扣费、结算、退款和订阅扣费语义。

## 3. 非目标

- 不承诺节省金额与任何官方账单逐分一致。
- 不抓取或实时校验所有上游官网价格。
- 不把“官方定价”用于实际扣费。
- 不在第一阶段支持所有复杂任务类、图片、音频、视频和依赖请求上下文的特殊表达式完整官方价对齐。
- 不在第一阶段展示累计节省金额；累计值在独立聚合阶段实现，不允许通过用户请求实时扫描全部消费日志。
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

上述规则适用于近 24 小时和不超过 31 天的短窗口查询。历史累计扩展为了保证人民币累计值不会随站点汇率配置变化而漂移，需要在聚合事件中额外冻结 `quota_per_unit` 和 USD/CNY 汇率，并存储按微元计算的人民币金额；累计接口不得再使用查询时当前汇率重新换算历史总额。

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
5. 短窗口历史回算结果不落库，每次汇总按查询时的当前本地官方价计算，并在接口中单独统计数量；历史累计任务只对每条旧日志成功回算一次，并将价格、换算口径和结果冻结到累计事件中。

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

历史累计阶段不直接把短窗口查询结果相加，而是为每条消费日志生成唯一聚合事件：

- 已有合法 `savings_estimate` 的日志直接使用日志内 quota 快照，人民币金额按首次聚合时可用的换算参数冻结。
- 没有快照的旧日志使用累计回算任务启动时的官方价格和换算参数回算一次，成功后冻结，后续价格和汇率变化不再重算。
- 无法安全回算的日志写入已处理但未覆盖的事件及稳定 `skip_reason`，计入累计请求分母，不计入金额。
- 同一日志由 `log_id` 唯一约束保证只能产生一个基础聚合事件；任务重试不得重复累计。

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
- `enabled=true` 时必须同时满足 `require_official_confirmation=true`；服务端拒绝保存其他组合，管理设置需先关闭整个节省功能才能关闭官方确认要求。
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
- 本短窗口接口不提供 lifetime/cumulative 字段；累计值由独立聚合接口返回，避免日志清理、查询范围和短窗口实时回算影响长期口径。
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
2. 长期累计使用独立事件表与按日聚合表，不扩展本接口为无边界日志扫描。

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

主文案必须明确带上“近 24 小时”，避免用户把滚动窗口误解为今日金额或历史累计：

```text
近 24 小时 RAPI 已帮你节省约 ¥32.18
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

钱包页可以在累计聚合期间展示已处理的部分金额，但必须明确标记为“累计统计中”或“已统计节省”。只有当后台回算状态为 `completed` 且长期累计值可靠时，才使用最终累计口径：

```text
累计估算节省：¥1,284.90
自 2024-03-12 开始统计 · 覆盖率 91%
```

用途是增强用户充值前的价值感知，但不能遮挡充值金额、到账金额和支付方式。累计回算未完成时，部分金额必须同时展示未完成状态或进度，不能标成最终累计值；金额仍需明确为估算，不得表述为现金返还或付款差额。

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

### 11.4 阶段四：历史累计聚合

在不改变短窗口接口的前提下，增加累计聚合持久化：

- 新增日志级幂等事件表、用户按 UTC 日聚合表和用户总计表，不复用 `quota_data` 的现有短窗口语义。
- 尽可能回算已有普通文本消费；无法安全回算的日志保留跳过原因并计入覆盖率分母。
- 新消费在日志落库后异步写入聚合事件，失败不影响计费请求，由补偿任务按日志游标修复。
- 价格、`quota_per_unit` 和人民币汇率按事件冻结；累计人民币金额使用整数微元存储。
- 基于聚合数据开放累计节省接口，并在概览或钱包页展示累计金额、统计起始时间、覆盖率和回算状态。
- 日志清理后保留累计事件和日聚合；用户删除时按现有账号数据删除策略同步清理。
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
- 累计扩展完成后，累计接口不扫描原始日志，能返回冻结人民币总额、累计覆盖率、统计起始时间和回算状态。
- 历史回算任务重复执行、崩溃恢复或批次重试不会重复累计同一 `log_id`。
- 官方价格、`quota_per_unit` 或人民币汇率变化不修改已有累计事件和累计人民币金额。
- 无法安全回算的旧日志不计入累计金额，但计入请求分母并降低累计覆盖率。
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

- KISS：短窗口继续复用 `model.GetPricing()`、日志基础列和 `logs.other`；累计阶段使用事件、按日汇总和用户总计三个职责明确的数据层。
- YAGNI：累计阶段仍只覆盖当前可确定性估算的文本类，不借机接入全部任务模型或运营排行榜。
- DRY：新日志快照与旧日志回算共用同一 quota 计算函数，官方价格运行时结构与模型广场字段对齐。
- SOLID：节省估算和累计聚合作为独立服务处理，聚合失败不得侵入实际计费和扣费路径。

## 15. 推荐结论

建议继续按“估算节省”定位。短窗口默认读取模型广场本地官方价，`official_prices` 仅作为可选覆盖；累计阶段尽可能回算历史日志并冻结结果，通过幂等聚合事件提供稳定累计金额。该方案同时保留近 24 小时实时价值感知和长期累计价值感知，并通过统计起始时间、覆盖率与回算状态保持可解释性。

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
- 不通过实时全表扫描做累计节省；累计值必须来自幂等持久化聚合。
- 钱包页累计展示只在回算完成后开放，并明确为估算，避免被理解成现金返还或付款差额。
- 不在运行时抓取官网或第三方接口；价格只从当前实例本地快照读取。
- 不把负节省展示给用户。该功能目标是价值感知，不是价格争议提示。

总体判断：短窗口核心闭环已经覆盖本地官方价、新日志快照、已有消费回算、确定性阶梯表达式、来源声明、查询边界和 UI 解释。短窗口历史回算结果随当前价格变化仍是有意接受的限制；累计阶段则通过一次性回算与冻结消除长期金额漂移。累计扩展应保持独立阶段，不与任务类、动态表达式或运营排行榜同时施工。

## 17. 历史累计节省扩展设计

### 17.1 已确认产品口径

本扩展采用以下已确认决策：

1. 尽可能回算当前日志库中已有的普通文本消费，不只从功能上线日开始统计。
2. 无法确定性回算的日志跳过金额计算，但计入累计请求分母并展示覆盖率。
3. 历史日志只回算一次；成功后的官方价、换算参数和人民币结果永久冻结。
4. 新请求使用请求结算时的官方价格快照；累计人民币金额使用请求聚合时冻结的换算参数。
5. 第一版只统计当前已支持的文本类消费日志，任务、图片、视频、音频和异步结算继续按既有跳过策略处理。
6. 后台历史任务必须分批、可暂停、可恢复、可重试，不能阻塞服务启动或用户请求。
7. 聚合过程必须幂等，同一消费日志无论重试多少次都只能贡献一次基础累计值。
8. 后续退款、差额结算或人工修正使用调整事件，不能静默覆盖已经展示过的基础事件。

累计值是估算统计，不参与余额、扣费、退款、充值到账、发票或财务对账。

### 17.2 展示语义

概览区分两个不同指标：

```text
近 24 小时节省约 ¥203.08
累计已节省约 ¥4,821.36
自 2024-03-12 开始统计 · 覆盖率 91%
```

- “近 24 小时”继续使用现有滚动窗口，可以随请求进入和移出而增减。
- “累计已节省”来自冻结聚合，只允许因新事件或明确调整事件变化，不因滚动时间、当前官方价或当前汇率变化而重算。
- `backfill_status != completed` 时不得显示最终口径的“累计已节省”，应显示“累计统计中”或“已统计节省”，并展示进度。
- 累计金额为 `0` 且已有已处理请求时，不使用价值营销文案，只展示保守状态。
- 累计覆盖率必须与金额同时可见，避免把部分模型统计描述成全部消费。
- 统计起始时间取最早已处理消费日志的发生时间，不取任务创建时间。

### 17.3 冻结换算口径

短窗口继续返回 quota 并按当前站点配置展示。累计人民币金额必须在事件生成时冻结：

```text
savings_cny_micros =
  savings_quota / quota_per_unit_snapshot
  * usd_cny_rate_snapshot
  * 1_000_000
```

约束：

- 使用 decimal 或整数安全运算，不使用 `float64 -> int64` 裸转换。
- `quota_per_unit_snapshot` 必须大于 `0`。
- `usd_cny_rate_micros` 使用 `1 USD = x CNY` 的六位小数整数快照。
- `savings_cny_micros` 使用人民币微元，`1 CNY = 1_000_000 micros`。
- 新日志如果已有换算快照则直接使用；旧快照缺少换算字段时，使用首次累计聚合时的站点换算参数并冻结。
- 历史无快照日志统一使用该次回算任务固定的换算参数，任务运行过程中管理员修改汇率不能造成同一批历史数据使用不同口径。
- 累计接口返回微元字符串和格式化所需的货币代码，避免 JavaScript `Number` 对超大 `int64` 失真。

为保证实时聚合失败后仍能按请求发生时的口径补偿，新文本消费需要在现有 `other.savings_estimate` 中增加以下可选字段，并继续保持 `schema_version=1` 向后兼容：

```json
{
  "quota_per_unit_snapshot": 500000,
  "usd_cny_rate_micros": 7300000,
  "savings_cny_micros": "153848610"
}
```

- 新代码写入这三个字段；旧后端和旧日志缺少字段时仍按原 schema v1 解析。
- 新日志的累计事件必须优先复制日志中的冻结微元值，不能在补偿执行时使用新的汇率重算。
- 历史任务处理旧快照和无快照日志时，统一使用任务级冻结参数补齐这三个字段对应的事件值，但不强制回写原日志 JSON。
- 微元转换使用 decimal 半远离零取整；示例对应 `10,537,576 quota / 500,000 * 7.3 = 153.8486096 CNY`，冻结为 `153,848,610 micros`。

### 17.4 数据模型

累计事件、日聚合、用户总计和任务状态统一存放在主数据库，原始消费日志继续从 `LOG_DB` 读取。原因是日志库可能使用 ClickHouse，而 ClickHouse 不适合承担本功能所需的唯一约束、行级更新和事务式聚合。主库仍只需支持项目既有的 SQLite、MySQL 和 PostgreSQL。

跨库读取不追求“日志写入与累计写入”原子提交：累计链路依靠稳定来源键、唯一事件和补偿扫描实现最终一致性。聚合失败不得影响消费日志和实际扣费。

#### 17.4.1 日志聚合事件 `user_savings_events`

每条消费日志至少对应一个基础事件，成功估算和跳过事件都持久化：

| 字段 | 类型建议 | 说明 |
| ---- | ---- | ---- |
| `id` | GORM 主键 | 由 GORM 生成 |
| `event_key` | string unique | 基础事件使用 `log:{source_key}:base`；调整事件包含稳定修订号 |
| `source_key` | string index | 消费日志稳定来源键 |
| `log_id` | int64 index | 关系型日志 ID；ClickHouse 或旧日志无法提供时为 `0` |
| `user_id` | int index | 当前用户 |
| `occurred_at` | int64 index | 原消费发生时间 |
| `day_start_utc` | int64 index | UTC 自然日起点 |
| `event_type` | string | `base`、`refund_adjustment`、`settlement_adjustment`、`admin_adjustment` |
| `coverage_state` | string | `estimated` 或 `skipped` |
| `skip_reason` | string | 未覆盖原因；成功时为空 |
| `calculation_mode` | string | `snapshot` 或 `historical_rebuild_frozen` |
| `official_quota` | int64 | 官方价估算 quota |
| `actual_quota` | int64 | 实际消费 quota |
| `savings_quota` | int64 | 非负节省；调整事件允许有符号增量 |
| `savings_cny_micros` | int64 | 冻结人民币微元；调整事件允许有符号增量 |
| `quota_per_unit_snapshot` | int64 | 换算单位快照 |
| `usd_cny_rate_micros` | int64 | 汇率六位小数快照 |
| `price_snapshot_at` | int64 | 官方价格快照时间 |
| `price_fingerprint` | string | 官方价格指纹 |
| `aggregate_version` | int | 聚合算法版本，第一版为 `1` |
| `aggregated_at` | int64 index | `0` 表示尚未进入日聚合和用户总计 |
| `created_at` | int64 | 事件写入时间 |

基础事件的 `event_key` 唯一约束是幂等边界。不得只依赖内存游标或“查询后再插入”，因为并发任务和崩溃重试会产生重复累计。

`event_key` 和 `source_key` 建议限制为 ASCII `varchar(128)`，避免 MySQL 5.7 在 `utf8mb4` 长索引上的兼容问题。`log_id`、`user_id`、`occurred_at`、`day_start_utc` 和 `aggregated_at` 使用普通 B-Tree 索引，不使用数据库专属 JSON、部分索引或表达式索引。

来源键规则：

- 新日志在写入前生成随机且全局唯一的 `savings_aggregation_key`，保存在 `other.savings_estimate`，关系型数据库和 ClickHouse 使用相同规则。
- 已有 SQLite、MySQL、PostgreSQL 日志使用 `db:{id}`。
- 已有 ClickHouse 日志的 `id` 默认为 `0`，不能用作游标或幂等键；使用稳定字段规范化后的 SHA-256 作为 `legacy-ch:{hash}` 回退键。
- 如果已有 ClickHouse 中存在所有稳定字段完全相同的重复行，系统无法无损区分其身份。任务必须计入 `ambiguous_source_key` 跳过数并向管理员披露，不能冒险重复累计。

#### 17.4.2 用户按日聚合 `user_savings_daily`

| 字段 | 类型建议 | 说明 |
| ---- | ---- | ---- |
| `id` | GORM 主键 | 由 GORM 生成 |
| `user_id` | int | 与 `day_start_utc` 组成唯一键 |
| `day_start_utc` | int64 | UTC 自然日起点 |
| `request_count` | int64 | 基础消费事件数，不含调整事件 |
| `estimated_request_count` | int64 | 成功估算事件数 |
| `snapshot_request_count` | int64 | 使用原日志快照的事件数 |
| `reconstructed_request_count` | int64 | 历史冻结回算事件数 |
| `official_quota` | int64 | 受检累加 |
| `actual_quota` | int64 | 受检累加 |
| `savings_quota` | int64 | 基础事件与调整事件之和 |
| `savings_cny_micros` | int64 | 冻结人民币微元之和 |
| `first_occurred_at` | int64 | 当日最早消费时间 |
| `last_occurred_at` | int64 | 当日最晚消费时间 |
| `updated_at` | int64 | 最近聚合时间 |

事件生成与汇总更新拆成两个可恢复阶段：事件生产者只批量插入唯一事件；聚合器再事务式领取 `aggregated_at=0` 的事件，在内存中按用户和日期合并增量，批量更新日聚合及用户总计，最后标记事件完成。这样无需依赖各数据库对 `INSERT ... RETURNING` 的不同支持，也避免事件唯一键并发冲突导致日汇总重复增加。

#### 17.4.3 用户总计 `user_savings_totals`

每个用户最多一行，用于概览和钱包页 `O(1)` 读取：

| 字段 | 类型建议 | 说明 |
| ---- | ---- | ---- |
| `user_id` | int primary key | 用户唯一总计 |
| `request_count` | int64 | 基础消费事件总数 |
| `estimated_request_count` | int64 | 成功估算事件总数 |
| `snapshot_request_count` | int64 | 日志快照事件总数 |
| `reconstructed_request_count` | int64 | 历史冻结回算事件总数 |
| `official_quota` | int64 | 受检累计官方 quota |
| `actual_quota` | int64 | 受检累计实际 quota |
| `savings_quota` | int64 | 受检累计节省 quota |
| `savings_cny_micros` | int64 | 冻结人民币微元总计 |
| `statistics_started_at` | int64 | 最早基础事件发生时间 |
| `last_aggregated_at` | int64 | 最近聚合提交时间 |

`user_savings_daily` 用于按日趋势与重建，`user_savings_totals` 用于用户累计卡片。累计接口不得每次把用户全部日记录重新求和；维护总计表可把读取复杂度从 `O(统计天数)` 降为 `O(1)`。

#### 17.4.4 回算任务 `user_savings_backfill_jobs`

任务至少记录：

- `status`：`pending`、`running`、`paused`、`completed`、`failed`。
- `cursor_log_id`、`target_max_log_id`：关系型日志库游标和固定上界。
- `cursor_created_at`、`cursor_request_id`、`target_created_at`、`target_request_id`：ClickHouse 复合游标和固定上界。
- `target_count`、`processed_count`、`estimated_count`、`skipped_count`，其中 `target_count` 在任务启动时按固定边界计算，用于稳定展示进度。
- `price_snapshot_at`、`quota_per_unit_snapshot`、`usd_cny_rate_micros`。
- `pricing_snapshot_json`、`pricing_snapshot_hash`：持久化本次任务使用的规范化官方价格 Map 及其 SHA-256，保证进程重启后继续使用同一价格口径。
- `started_at`、`updated_at`、`completed_at`、`last_error`。

第一版允许全实例只有一个活动历史任务，避免多个任务使用不同价格口径并行回算同一日志范围。

`pricing_snapshot_json` 使用跨数据库兼容的 `TEXT`，只保存计算必需的规范化计费字段、确认状态、来源更新时间和价格指纹，不保存管理员账号、内部备注或敏感来源 URL。序列化和恢复必须使用 `common.Marshal`、`common.Unmarshal` 等项目 JSON 包装函数。恢复任务时先校验 hash；损坏或无法解析时把任务标记为 `failed`，不能改用当前价格继续。

### 17.5 新消费聚合流程

新消费日志成功落库后触发累计聚合：

```text
消费日志落库
  -> 读取合法 savings_estimate
  -> 构造 base 事件与冻结人民币金额
  -> 批量插入唯一事件，aggregated_at=0
  -> 聚合器批量更新 UTC 日聚合和用户总计
  -> 同一事务标记事件 aggregated_at
  -> 失败只记录告警，不回滚用户请求或实际扣费
  -> 补偿任务按稳定游标查找未生成 base 事件的 consume 日志并重试
```

累计聚合属于展示分析链路，不得因为聚合表故障导致 API 请求失败、重复扣费或余额回滚。

实现时应在消费日志成功后提交聚合工作。进程内工作队列必须有容量上限且不得阻塞请求；队列已满、进程退出或事件写入失败时依赖补偿扫描恢复。补偿扫描按稳定游标读取缺少基础事件的消费日志，并使用日志内冻结换算字段；不能把内存队列当作唯一可靠来源。

### 17.6 历史回算流程

管理员启动历史任务时冻结任务边界和口径：

1. 冻结任务扫描上界。关系型日志库记录 `target_max_log_id`；ClickHouse 记录 `(target_created_at, target_request_id)` 复合上界。新日志由实时聚合或补偿任务处理。
2. 冻结并持久化本次官方价格 Map、价格快照 hash、`price_snapshot_at`、`quota_per_unit_snapshot` 和人民币汇率。
3. 使用 Keyset 分页从游标开始顺序读取，初始批次为 1,000 条；禁止使用 `OFFSET`。
4. 每条日志先尝试解析已有快照；无快照时执行现有确定性历史回算。
5. 成功和跳过结果都写入基础事件，避免失败日志在每次重试时重复消耗计算资源。
6. 每批事务提交后更新游标和计数；进程退出后从已提交游标继续。
7. 关系型日志到达 `target_max_log_id`、ClickHouse 到达复合目标上界，并且目标范围不存在遗漏事件后标记 `completed`。

任务暂停只停止领取新批次，不中断正在提交的数据库事务。任务失败保留游标、错误和冻结口径，恢复时继续使用原口径，不能悄悄换成新的官方价格或汇率。

#### 17.6.1 高性能回算算法

历史扫描使用“单次顺序读取、批内并行计算、单写入器批量提交”：

```text
冻结任务边界与价格 Map
  -> Keyset 读取一批必要日志列
  -> 过滤已有 source_key
  -> 有界 CPU worker 解析与计算
  -> 批量插入待聚合事件
  -> 事务聚合 pending events
       -> 批内按 (user_id, day_start_utc) 合并
       -> 批内按 user_id 合并
       -> 批量 Upsert daily
       -> 批量 Upsert totals
       -> 批量标记 aggregated_at
  -> 提交游标和计数
  -> 下一批
```

关系型日志库分页：

```sql
WHERE type = consume
  AND id > :cursor_id
  AND id <= :target_max_id
ORDER BY id ASC
LIMIT :batch_size
```

ClickHouse 的历史 `id` 不可用，采用与表排序键一致的复合 Keyset：

```sql
WHERE type = consume
  AND (created_at, request_id) > (:cursor_created_at, :cursor_request_id)
  AND (created_at, request_id) <= (:target_created_at, :target_request_id)
ORDER BY created_at ASC, request_id ASC
LIMIT :batch_size
```

若 ClickHouse 同一 `(created_at, request_id)` 存在多行，批次读取必须把该键的全部行作为一个边界组处理，不能在组中间推进游标。新日志引入 `savings_aggregation_key` 后不再依赖该兼容路径。

计算优化：

- 任务启动时把规范化官方价格构建为 `map[string]OfficialPrice`，模型匹配平均为 `O(1)`；禁止每条日志遍历完整价格列表。
- 查询只读取 `id`、`request_id`、`user_id`、`created_at`、`model_name`、token、`quota` 和 `other` 等必要列。
- 每条 `other` 最多解析一次；解析结果同时用于快照识别、历史回算和来源键构建。
- CPU worker 建议为 `min(max(runtime.NumCPU()/2, 1), 4)`，输入输出队列均有上限；数据库保持单批次写入器，避免并发事务争抢索引和行锁。
- 批内使用两个 Map 分别按 `(user_id, day_start_utc)` 和 `user_id` 合并增量，将日表和总计表写操作从“每日志一次”降低为“每批每键一次”。
- 事件使用批量 `CreateInBatches`；预先批量查询本批已有 `source_key`，减少唯一键冲突日志，但最终正确性仍由唯一约束保证。
- 聚合器只处理 `aggregated_at=0` 的事件。第一版全实例只运行一个聚合器，使用现有系统任务租约防止多节点重复执行；事务读取使用项目 `lockForUpdate(tx)`，SQLite 自动跳过不支持的锁语法。

批次自适应：

- 默认 `1,000`，允许范围 `500..5,000`。
- 最近连续三批提交耗时低于目标值且无数据库等待时逐步放大；提交变慢、锁等待或内存压力升高时减半。
- 每批事务应控制在数秒内，不为了吞吐量开启覆盖整个历史任务的长事务。
- 每批提交后持久化游标；不得只在任务结束时保存进度。
- 管理员设置的批大小是初始值和上限约束，不允许配置无限批次。

复杂度：设历史日志数为 `N`、官方模型数为 `M`、批大小为 `B`、批内不同用户/日期键数为 `K`：

- 时间复杂度：`O(M + N)`。
- 工作内存：`O(M + B + K)`。
- 原始日志读取：一次顺序扫描，不随页数退化。
- 用户累计查询：读取 `user_savings_totals` 单行，`O(1)`。
- 按日趋势查询：读取目标时间范围的日记录，`O(天数)`，与原始日志总量无关。

明确禁止：

- 用户打开页面时回算全部历史日志。
- 使用深分页 `LIMIT/OFFSET`。
- 每条日志单独查询价格、检查事件或更新聚合表。
- 多个无界 worker 同时写数据库。
- 为累计任务反复更新原始日志 `other`。
- 每次查询按当前官方价格或汇率重算历史累计金额。

### 17.7 调整与修正

- 当前文本消费基础事件视为不可变。
- 后续接入会退款或二次结算的任务类请求时，为同一 `log_id` 写入唯一调整事件。
- 调整事件存储 quota 和人民币微元的有符号差额，并更新原事件所属 UTC 日聚合。
- 重复退款通知或结算回调必须使用稳定业务修订号构造唯一 `event_key`。
- 官方定价后来发生变化不属于调整原因，不修改已有累计事件。
- 如果管理员确认历史官方价格配置错误，第一版采用显式“新建修正任务”生成调整事件，不允许直接覆盖数据库总额。
- 同一日志的基础事件加全部调整事件后，净 `official_quota`、`actual_quota` 和 `savings_quota` 必须满足业务约束，用户可见净节省不得小于 `0`；违反约束的调整必须拒绝并告警。

### 17.8 累计接口

新增：

```http
GET /api/user/savings/lifetime
```

响应建议：

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "currency": "CNY",
    "savings_cny_micros": "4821360000",
    "savings_quota": "330230136",
    "official_quota": "721003221",
    "actual_quota": "390773085",
    "request_count": 18240,
    "estimated_request_count": 16598,
    "snapshot_request_count": 4120,
    "reconstructed_request_count": 12478,
    "coverage_ratio": 0.90998,
    "statistics_started_at": 1709856000,
    "last_aggregated_at": 1785254400,
    "backfill_status": "completed",
    "backfill_progress": 1,
    "is_complete": true
  }
}
```

规则：

- 只能查询当前登录用户。
- 只读取当前用户的 `user_savings_totals` 单行，不扫描日聚合、原始日志或解析 `other`。
- `savings_cny_micros`、`savings_quota`、`official_quota` 和 `actual_quota` 均使用十进制字符串返回，前端使用安全 decimal/BigInt 处理；累计接口不能沿用短窗口受 50,000 行保护后的 JavaScript `number` 假设。
- `coverage_ratio = estimated_request_count / request_count`，分母为 `0` 时返回 `0`。
- `is_complete` 只有在历史任务完成且实时补偿没有已知积压时为 `true`。
- 回算过程中可以返回已处理金额，但前端必须使用“已统计”语义并展示进度。
- 日聚合累加使用受检 `int64`；溢出时接口失败并记录管理员可见告警，不能返回负数或截断金额。

### 17.9 管理设置与状态

累计扩展新增独立配置，避免复用 `rebuild_legacy_logs` 的查询时回算语义：

```json
{
  "lifetime_enabled": false,
  "lifetime_backfill_batch_size": 1000,
  "lifetime_show_on_dashboard": true,
  "lifetime_show_on_wallet": false
}
```

- `lifetime_enabled` 控制实时累计和累计接口展示，不影响短窗口估算。
- 历史任务的启动、暂停、恢复属于显式管理员动作，不因为打开开关就在服务启动时自动扫描全库。
- 设置页以可视化开关、批次输入和任务状态展示为主，JSON 继续作为高级兼容入口。
- 管理员界面显示处理进度、成功数、跳过数、最近错误、冻结价格时间和冻结汇率。

管理员任务接口已按现有 `system-task` 路由规范落地：

```http
GET  /api/system-task/savings-lifetime-backfill
POST /api/system-task/savings-lifetime-backfill
POST /api/system-task/savings-lifetime-backfill/pause
POST /api/system-task/savings-lifetime-backfill/resume
POST /api/system-task/savings-lifetime-backfill/retry
```

- 复用现有管理员鉴权与操作审计中间件。
- `start` 仅在没有活动任务时成功，并在事务内按日志数据库类型冻结关系型 ID 上界或 ClickHouse 复合上界，同时冻结 `target_count`、规范化官方价格 JSON、价格 hash 和换算参数。
- `pause`、`resume` 使用任务 ID 或版本做条件更新，防止并发管理员操作覆盖新状态。
- 每个状态变更记录操作者、旧状态、新状态、任务边界和冻结口径；接口不得返回内部数据库连接或敏感价格来源参数。
- 第一版不提供“取消并删除结果”；需要重新计算时必须走显式修正任务，避免破坏已展示累计值。

实际实现中，运行中任务先进入 `pause_requested`，当前批次事件、聚合结果和游标提交后再转为 `paused`；恢复后回到 `pending` 并继续使用任务载荷中冻结的价格 Map、价格 hash、汇率和 `quota_per_unit`。失败任务可在故障排除后通过 `retry` 从已保存游标继续，原任务的冻结口径和已提交聚合结果保持不变。实时事件异步写入失败时，由主节点每分钟执行一次近 7 天有界补偿扫描，每轮最多 5 个批次；补偿使用 Keyset 游标和事件唯一键，不阻塞用户请求，也不会重复累计。ClickHouse 新日志依赖写入时生成的唯一 `request_id`；对旧日志中跨批次且 `(created_at, request_id)` 完全相同、无法稳定区分的剩余行，任务显式增加 `ambiguous_cursor_count` 和跳过数，管理员界面显示歧义数量，禁止静默视为已估算。

### 17.10 缓存与一致性

- 累计接口可以按用户 ID 和累计 schema 版本缓存 1 分钟，不应为了构造缓存 key 先读取总计行的 `last_aggregated_at`。
- 日聚合与用户总计事务提交后尽力失效对应用户累计缓存；失效失败只造成最长一个 TTL 的展示延迟。
- 回算任务完成前 `is_complete=false` 是权威状态，不能依赖缓存中的金额猜测完成度。
- 日聚合和用户总计都应支持从事件表重建，用于检测或修复三层数据不一致；重建属于管理员维护操作。

### 17.11 保留与删除策略

- 原始消费日志按现有策略清理后，累计事件、日聚合和用户总计默认保留，以保证累计值不因日志保留周期下降。
- 删除用户时必须清理该用户的累计事件、日聚合、用户总计和任务状态，不能留下可关联的历史统计。
- 如果产品支持用户主动清除消费历史，需要明确该操作是否同时清除累计节省；默认建议同时清除并二次确认。
- 管理员不得通过删除单个原始日志静默改变累计值；需要显式调整事件或重建操作。

### 17.12 测试与验收补充

后端必须覆盖：

- 同一 `source_key` 并发、重复和崩溃重试只产生一个基础事件。
- 事件可先成功落库但保持 `aggregated_at=0`；日聚合或用户总计更新失败时聚合事务整体回滚，重试后不会重复累计。
- 历史任务暂停、恢复、进程重启后继续使用原价格和汇率快照。
- 历史任务价格快照损坏或 hash 不匹配时失败，不会回退到当前价格继续计算。
- 已有合法日志快照、可回算旧日志和不可回算旧日志分别产生正确事件。
- 跳过事件计入 `request_count`，不增加金额和 `estimated_request_count`。
- 官方价格、`quota_per_unit` 和汇率修改后，已有累计金额不变。
- 调整事件可增加或减少累计金额，但重复业务修订不会重复调整。
- 日聚合、用户总计与事件表重建结果一致。
- 累计查询只读取用户总计单行，不访问日表或原始日志表。
- Keyset 扫描不会漏读或重复读取批次边界；禁止回退为 OFFSET 分页。
- 有界 worker、批量事件写入和批内聚合在大批量固定输入下保持确定结果。
- ClickHouse 复合游标边界组和模糊来源键按设计处理，不静默重复累计。
- SQLite、MySQL、PostgreSQL 下迁移、唯一约束、事务和聚合语义一致。
- 大数与溢出路径不会产生负金额或静默截断。

前端必须覆盖：

- 近 24 小时和累计指标的时间口径文案不会混淆。
- 回算未完成时显示进度和“已统计”语义，不显示最终累计文案。
- 累计完成后显示冻结人民币金额、统计起始时间和覆盖率。
- 累计金额和累计 quota 字符串使用 BigInt/安全 decimal 格式化，不经过不安全的隐式 `Number` 转换。
- 功能关闭、无数据、覆盖率为 0、任务失败和缓存延迟均有明确状态。
- 桌面与移动端长金额、长日期和七语言文本不溢出。

完成标准：

1. 历史普通文本日志被尽可能处理，所有目标范围日志都有成功或跳过基础事件。
2. 重复执行历史任务不会改变累计结果。
3. 累计金额在官方价格和汇率调整后保持不变。
4. 新请求最终能通过实时路径或补偿路径进入累计，且不影响计费成功率。
5. 用户能够明确区分近 24 小时节省、累计节省、覆盖率和统计起始时间。
