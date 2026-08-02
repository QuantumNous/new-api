# 分组、模型计价与账务系统梳理

本文以 2026-07-28 当前工作区源码为准，梳理从模型基础价、分组倍率、计费汇率，到预扣、结算、充值、兑换码、订阅和前端展示的完整规则。文中的“官方价格”指项目中配置的美元基础价；系统不会在线查询厂商官网，因此只有配置本身准确、及时，页面上的“官方原价”才等于真实官方价。

## 1. 结论先行

当前源码已经实现目标主公式：

```text
模型消费人民币成本
= 配置的官方美元成本
× BillingUSDToCNYRate
× 本次请求的有效消费分组倍率
```

若目标是“用户充值 1 元得到 1 元余额，并按官方人民币价格的 5% 销售”，推荐配置关系为：

```text
QuotaPerUnit = 500000                 # 保持当前值
quota_display_type = CNY
USDExchangeRate = 1                  # 钱包展示：500000 quota = ¥1
Price = 1                            # Epay 一个充值单位的站内价格
TopupGroupRatio = 1                  # 充值倍率，不是消费倍率
AmountDiscount = 1                   # 无充值档位折扣
BillingUSDToCNYRate = 实际美元兑人民币计费汇率，例如 7.3
GroupRatio = 0.05                    # 目标消费分组的销售倍率
```

例：项目中某模型的基础成本为 `$10`，计费汇率为 `7.3`，有效消费组倍率为 `0.05`：

```text
模型广场人民币官方原价 = 10 × 7.3 = ¥73
人民币销售价           = 10 × 7.3 × 0.05 = ¥3.65
销售价 / 官方原价      = 0.05
```

完成本地后端重启后，`http://127.0.0.1:3000/api/status` 和 `http://localhost:5173/api/status` 均已由最新工作区代码返回新字段：

```text
quota_display_type = CNY
usd_exchange_rate = 1
billing_usd_to_cny_rate = 1
price = 1
quota_per_unit = 500000
```

这证明新代码和状态接口已经在本地生效，但数据库当前仍使用兼容默认值 `BillingUSDToCNYRate=1`，还没有保存目标值 `7.3`。公开 `/api/pricing` 同时显示基础分组倍率仍为 `ChatGPT Plus=0.3`、`ChatGPT Pro=0.5`、`ChatGPT官转=7.3`，没有目标 `0.05`。其中“官转”的 `7.3` 很可能承载旧方案中的人民币换算语义；启用独立计费汇率后若不迁移，会发生重复换算。公开接口不能确认用户到消费组的 `GroupGroupRatio` 特殊覆盖、`TopupGroupRatio` 和充值折扣。

本次没有替用户改数据库，也没有部署生产环境。因此当前结论是：**公式和本地代码已改好，但目标计费汇率与 GPT 分组倍率都尚未配置完成，完整生产配置也尚未完成运行态验收。**

## 2. 三套单位必须分开

设：

- `Q = QuotaPerUnit`，当前为 `500000`，见 `common/constants.go:62`；
- `q` 为数据库和接口中的原始整数 quota；
- `u = q / Q` 为一个历史“账户单位”；
- `B = BillingUSDToCNYRate`，模型美元成本换算人民币的计费汇率；
- `G` 为请求实际命中的有效消费分组倍率。

### 2.1 原始 quota

用户余额、令牌余额、消费日志、兑换码、订阅总额度等仍保存原始 quota。`QuotaPerUnit` 只是原始 quota 与账户单位之间的比例：

```text
账户单位 u = 原始 quota q / QuotaPerUnit
```

当前 `500000 quota = 1 账户单位`。quota 本身没有天然的美元或人民币币种；币种由展示规则和业务语义决定。

### 2.2 钱包展示汇率 `USDExchangeRate`

钱包、用户余额、额度表单和消费金额列先把原始 quota 除以 `QuotaPerUnit`，再按显示模式处理：

```text
USD 模式：    $u
CNY 模式：    ¥(u × USDExchangeRate)
TOKENS 模式： 直接显示原始 quota
CUSTOM 模式： 自定义符号 + u × CustomCurrencyExchangeRate
```

代码入口为 `web/default/src/lib/currency.ts:167-220,393-423,482-519` 和 `web/default/src/lib/format.ts:68-116`。因此在 `CNY + USDExchangeRate=1` 下，`500000 quota` 显示为 `¥1`。

`USDExchangeRate` 是账户额度的展示/输入换算参数，不参与模型扣费，也不应被当作真实外汇牌价的唯一来源。

### 2.3 模型计费汇率 `BillingUSDToCNYRate`

`BillingUSDToCNYRate` 只把美元口径的模型成本换成站内人民币成本。它位于“货币与展示”中的“显示模式”旁，名称为“计费汇率”，说明文字明确其不改变钱包余额和充值价格，见 `web/default/src/features/system-settings/general/pricing-section.tsx:191-258`。

后端默认值为 `1`；非正数、NaN 或无穷值回退为 `1`，保存接口会拒绝无效值，见：

- `setting/operation_setting/billing_currency_setting.go:5-11`
- `controller/option.go:236-244`

这两个汇率的职责不能交换：

| 参数 | 影响 | 不影响 |
| --- | --- | --- |
| `USDExchangeRate` | 钱包、余额、原始 quota、日志金额的显示和额度表单反向换算 | 模型实际扣费 |
| `BillingUSDToCNYRate` | 模型预扣、结算、模型广场的美元价转人民币价 | 充值到账、兑换码、管理员调额、钱包面值 |

## 3. 模型计价模式与优先级

普通同步请求的选择顺序为：

1. `billing_mode[model] == tiered_expr` 时，阶梯表达式优先；缺少表达式会直接报错，不回退。
2. 否则，只要 `ModelPrice` 命中，就使用固定按次价格，包括显式配置为 `0` 的情况。
3. 否则使用 `ModelRatio`。
4. `ModelRatio` 未配置时，只有自用/接受未配置模型等现有例外规则允许继续，否则拒绝请求。

代码见 `relay/helper/price.go:83-194`。异步按次任务不走阶梯表达式，其顺序是当前 `ModelPrice`、内置默认 `ModelPrice`、`ModelRatio`，见 `relay/helper/price.go:197-265`。

### 3.1 `ModelRatio` 按 token 计费

`ModelRatio` 不是直接的“美元/百万 token”，而是以原始 quota 为基础的倍率。当前 `Q=500000` 时：

```text
1,000,000 输入 token × ModelRatio 1 = 1,000,000 quota = 2 账户单位
```

所以 `ModelRatio=1` 对应 `$2 / 1M` 输入 token 的基础美元价；模型广场因此用 `model_ratio × 2` 还原美元百万 token 单价，见 `web/default/src/features/pricing/lib/price.ts:61-96`。

非固定价文本请求的概念公式为：

```text
加权 token
= 基础文本输入
 + 缓存读取 token × CacheRatio
 + 缓存写入 token × CacheCreationRatio
 + 图片输入 token × ImageRatio
 + 输出 token × CompletionRatio

官方美元成本 = 加权 token × ModelRatio / Q
基础扣费 quota = 加权 token × ModelRatio × B × G
```

实际实现会根据上游 usage 语义，从总输入中减去已经独立计价的缓存、图片和音频 token，并把负的基础余量钳制为 0，见 `service/text_quota.go:230-318`。

### 3.2 `ModelPrice` 固定按次计费

`ModelPrice` 表示一次调用的美元基础价：

```text
扣费 quota = ModelPrice × Q × B × G × ∏OtherRatios
```

预扣见 `relay/helper/price.go:178-187`，文本结算见 `service/text_quota.go:321-328`，异步按次任务见 `relay/helper/price.go:228-264`。

固定价模式不再按实际输入/输出、缓存、图片 token 倍率重算基础价；请求级的合法 `OtherRatios` 和独立工具/音频附加费仍按对应路径处理。

### 3.3 阶梯动态表达式

存储键为：

```text
billing_setting.billing_mode
billing_setting.billing_expr
```

见 `setting/billing_setting/tiered_billing.go:11-66`。表达式系数使用实际的 `$ / 1M tokens` 价格，主要变量为：

| 变量 | 含义 |
| --- | --- |
| `p`、`c` | 输入、输出文本 token |
| `len` | 完整输入上下文长度，用于阶梯条件 |
| `cr` | 缓存读取 token |
| `cc`、`cc1h` | 缓存写入 token，普通/5 分钟与 1 小时 |
| `img`、`img_o` | 图片输入、输出 token |
| `ai`、`ao` | 音频输入、输出 token |

`p`、`c` 只会排除表达式明确单独引用的子类别；`len` 保留完整上下文长度，见 `pkg/billingexpr/types.go:16-30` 和 `service/tiered_settle.go:12-90`。请求条件使用同一表达式中的 `param()`、`header()`、`has()` 等能力；当前前端把基础表达式与请求规则组合为 `(base) * rules`，见 `web/default/src/features/pricing/lib/billing-expr.ts:533-573`。

预扣公式：

```text
rawCost = 使用估算 token 执行表达式
quotaBeforeGroup = rawCost / 1,000,000 × 快照 Q × 快照 B
preConsumedQuota = round(quotaBeforeGroup × 快照 G)
```

未提供最大输出 token 且分组非免费时，默认按 `8192` 输出 token 估算。快照冻结表达式文本与哈希、分组倍率、估算 token、命中阶梯、`QuotaPerUnit`、计费汇率和表达式版本，见 `relay/helper/price.go:282-351`、`pkg/billingexpr/types.go:40-62`。

最终结算用实际 token 重新运行冻结表达式：

```text
actualQuota = round(actualExprOutput / 1,000,000 × 快照 Q × 快照 B × 快照 G)
```

见 `pkg/billingexpr/settle.go:8-37`。表达式结算失败时使用最终预扣额度，若没有则使用快照估算值，见 `service/tiered_settle.go:93-123`。

## 4. 各类倍率怎样叠加

### 4.1 消费分组倍率

有效消费倍率 `G` 的选择顺序是：

1. 若路由上下文存在 `auto_group`，先把 `UsingGroup` 更新为实际选中的具体分组。
2. 若存在 `GroupGroupRatio[userGroup][usingGroup]`，该特殊矩阵值直接覆盖基础倍率。
3. 否则使用 `GroupRatio[usingGroup]`。
4. 分组不存在时记录日志并回退为 `1`。

见 `relay/helper/price.go:43-69`、`setting/ratio_setting/group_ratio.go:62-98`。

特殊倍率是“用户所属分组 → 实际消费分组”的组合覆盖，不是单个用户的额外倍率，也不是与基础分组倍率相乘。即使基础 `GroupRatio[usingGroup]=0.05`，只要命中特殊矩阵中的其他值，最终就不会按 `0.05` 计费。

### 4.2 完成、缓存、图片和音频倍率

- 输出 token 使用 `CompletionRatio`，入口为 `setting/ratio_setting/model_ratio.go:436`。
- 缓存读取使用 `CacheRatio`，缓存写入使用 `CreateCacheRatio`，入口为 `setting/ratio_setting/cache_ratio.go:158` 等；Claude 1 小时缓存写入倍率是 5 分钟倍率的 `6 / 3.75`，见 `relay/helper/price.go:35-36,121-129`。
- 图片输入 token 使用 `ImageRatio`，入口为 `setting/ratio_setting/model_ratio.go:655-675`。
- 音频输入、输出使用 `AudioRatio` 和 `AudioCompletionRatio`；专用音频/Realtime 公式为：

```text
(文本输入
 + 文本输出 × CompletionRatio
 + 音频输入 × AudioRatio
 + 音频输出 × AudioRatio × AudioCompletionRatio)
× ModelRatio × B × G
```

见 `service/quota.go:58-94,167-220,293-343`。Gemini 独立音频输入价格等路径可直接使用美元/百万 token 价格，再乘 `Q × B × G`，见 `service/text_quota.go:291-297`。

### 4.3 工具调用附加费

Web Search、File Search 等工具价格按美元/千次配置：

```text
工具 quota = 美元千次价 × 调用次数 / 1000 × Q × B × G
```

图片生成工具的单次价格直接执行：

```text
图片工具 quota = 美元单次价 × Q × B × G
```

文本结算使用请求快照中的计费汇率，见 `service/text_quota.go:85-139`。通用工具计算器的相同公式见 `service/tool_billing.go:34-86`。

### 4.4 `OtherRatios` 与任务倍率

时长、分辨率、质量、数量等请求级倍率通过 `PriceData.AddOtherRatio` 加入，所有合法值相乘：

```text
O = ratio1 × ratio2 × ...
最终费用 = 基础费用 × O
```

非正数、NaN 和正无穷值不会被接受，见 `types/price_data.go:43-118`。异步任务在基础价选定后由适配器加入时长、分辨率等倍率，并可根据上游实际结果调整后做差额结算，见 `relay/relay_task.go:181-204,241-297`。

## 5. 预扣、资金来源和最终结算

### 5.1 普通同步请求

- 倍率模式预扣基于 `max(promptTokens, PreConsumedQuota) + maxTokens` 的估算，再乘 `ModelRatio × B × G`，见 `relay/helper/price.go:104-135`。
- 固定价格模式按固定价、计费汇率、有效分组和请求级倍率预扣。
- 阶梯模式按表达式估算并持有完整阶梯快照。
- 最终实际费用与预扣费用做差：正差额补扣，负差额退款，见 `service/billing_session.go:41-75`、`service/billing.go:51-94`。

普通请求的 `PriceData` 保留本次模型价/倍率、分组倍率、计费汇率和其他倍率，结算使用该请求数据，而不是单纯重新读取所有全局配置。

### 5.2 钱包与订阅资金来源

`BillingSession` 支持钱包和订阅资金来源，并按用户偏好执行 `subscription_only`、`wallet_only`、`wallet_first`、`subscription_first` 及允许的回退。预扣成功后会同步 `FinalPreConsumedQuota`，见 `service/billing_session.go:331-448`。

订阅额度同样以原始 quota 记账；它不是免扣费机制。异步任务会要求足额预扣，不依赖信任额度绕过，相关路径见 `service/billing_session.go:295-328`。

### 5.3 异步任务快照

任务提交时持久化：

- `ModelPrice`
- `ModelRatio`
- `GroupRatio`
- `BillingUSDToCNYRate`
- `OtherRatios`

见 `model/task.go:111-120`、`controller/relay.go:647-669`。失败时退还任务已预扣 quota；成功后的实际价与预扣价做差额补扣或退款，见 `service/task_billing.go:173-275`。

旧任务缺少计费汇率时按 `1` 兼容，避免旧任务在新版本中突然按新汇率重算。

## 6. `/api/pricing` 与模型广场

`model.GetPricing()` 从已启用渠道能力构建模型列表，加入模型元数据、可用分组、端点、`ModelRatio`/`ModelPrice`、完成/缓存/图片/音频倍率以及阶梯表达式，并缓存约一分钟，见 `model/pricing.go:18-38,67-96,203-481`。

`/api/pricing` 还会：

- 只返回当前用户可用分组覆盖到的模型；
- 删除用户不可用分组的倍率；
- 用 `GroupGroupRatio[当前用户组][消费组]` 覆盖返回给该用户的基础分组倍率；
- 返回 `group_ratio`、`usable_group`、`auto_groups`、供应商与端点信息。

见 `controller/pricing.go:12-76`。因此登录用户在模型广场看到的分组倍率应与普通请求的特殊倍率优先级一致。

模型广场从 `/api/status` 读取 `billing_usd_to_cny_rate`，非法或缺失时回退为 `1`，见 `web/default/src/features/pricing/hooks/use-pricing-data.ts:32-45`。当前展示规则是：

```text
配置基础美元价 = ModelRatio × 2，或 ModelPrice，或表达式中的美元单价
人民币官方原价 = 配置基础美元价 × B × 1
人民币销售价   = 配置基础美元价 × B × 当前展示分组倍率
```

按 token、按次和动态表达式的实现分别见：

- `web/default/src/features/pricing/lib/price.ts:61-112,132-264`
- `web/default/src/features/pricing/lib/dynamic-price.ts:75-92,167-181`
- `web/default/src/features/pricing/components/model-card.tsx:92-234`
- `web/default/src/features/pricing/components/pricing-columns.tsx:114-337`

销售价与“Official list price”并列展示，分组徽标显示原始倍率，例如 `0.05x`，见 `web/default/src/features/pricing/components/price-value-comparison.tsx:34-61`、`web/default/src/components/group-badge.tsx:92-105`。

模型广场的 USD/CNY 开关只改变页面展示；后端始终按请求快照中的 `B × G` 扣费。充值字段 `Price`、钱包展示字段 `USDExchangeRate` 和 `TopupGroupRatio` 不参与模型广场模型价计算。

## 7. 钱包与消费日志展示

钱包余额、已用额度、订阅额度和兑换结果统一使用原始 quota 的展示函数，见：

- `web/default/src/features/wallet/components/wallet-stats-card.tsx:58-65`
- `web/default/src/features/wallet/components/subscription-plans-card.tsx:489-543`
- `web/default/src/lib/format.ts:68-116`

消费日志的总扣费列也按 `q / Q × USDExchangeRate` 显示，且使用更高小数精度，见 `web/default/src/lib/format.ts:204-214`、`web/default/src/features/usage-logs/components/common-logs-stats.tsx:92`。

新消费日志的 `other` 会记录：

- 模型倍率/固定价格；
- 有效分组倍率和特殊倍率；
- 本次冻结的 `billing_usd_to_cny_rate`；
- 阶梯模式、表达式和命中阶梯；
- 管理员可见的 quota 饱和标记。

后端写入见 `service/log_info_generate.go:71-118,293-320`，前端类型和详情展示见 `web/default/src/features/usage-logs/types.ts:170-190`、`web/default/src/features/usage-logs/components/dialogs/details-dialog.tsx:213-287`。

日志中的“实际扣费金额”是钱包面值，仍使用 `USDExchangeRate`；日志里的“美元模型单价换算”优先使用该条日志冻结的 `BillingUSDToCNYRate`。两者分别回答“扣了多少余额”和“当时按什么人民币模型单价计费”，不要混为同一个汇率。

## 8. 充值通道公式

以下公式以非 `TOKENS` 显示模式为主。`TOKENS` 模式会先将用户输入除以 `QuotaPerUnit` 再保存为账户单位。

设：

- `A`：用户请求的充值数量；
- `T`：`TopupGroupRatio[userGroup]`，为 0 时当前代码按 1；
- `D`：对应充值档位的 `AmountDiscount`，未配置或无效时为 1；
- `Q`：`QuotaPerUnit`。

`BillingUSDToCNYRate` 不参与任何充值公式。

### 8.1 Epay

```text
站内提交支付金额 = A × Price × T × D
订单 Amount       = A
到账 quota        = A × Q
```

见 `controller/topup.go:149-176,228-258`、`model/topup.go:109-149`。源码只把计算金额传给 Epay 客户端，没有声明商户通道实际结算币种，因此不能仅凭代码断言它一定按 CNY 收款。

目标 `¥1 -> ¥1` 需要站内 `Price=T=D=1`，并由商户通道实际按人民币收款；后者必须在支付平台侧验证。

### 8.2 Stripe

站内预览公式是：

```text
预览金额 = A × StripeUnitPrice × T × D
```

但创建 Checkout 时只发送：

```text
Price = StripePriceId
Quantity = A
```

本地订单和到账又是：

```text
TopUp.Money = A × T
到账 quota  = TopUp.Money × Q
```

见 `controller/topup_stripe.go:88-118,341-385,388-415`、`model/topup.go:152-202`。因此 `StripeUnitPrice` 和档位折扣影响站内预览，却不直接决定外部 Checkout Price，也不进入本地到账值；Stripe 后台 Price 的币种和单价才决定实付。这是当前最明显的充值公式不一致风险。

### 8.3 Creem

本地产品配置含 `price`、`currency` 和原始 `quota`：

```text
TopUp.Amount = product.quota   # 已是原始 quota
TopUp.Money  = product.price
到账 quota   = TopUp.Amount
```

创建 Checkout 时只发送外部 `product_id`，见 `controller/topup_creem.go:50-130,375-420`、`model/topup.go:439-509`。本地 `price/currency` 不会覆盖外部产品的实际价格或币种；没有核验外部产品配置，不能声称 Creem 已实现人民币 1:1。

### 8.4 Waffo

```text
支付金额 = A × WaffoUnitPrice × T × D
到账 quota = A × Q
```

请求显式发送 `OrderCurrency=WaffoCurrency`；未设置时代码默认 `USD`，见 `controller/topup_waffo.go:56-60,89-105,200-265`、`model/topup.go:530-574`。要实现人民币 1:1，除单价和倍率为 1 外，还必须确认 `WaffoCurrency` 及上游实际支持的币种。

### 8.5 Waffo Pancake

```text
支付金额 = A × WaffoPancakeUnitPrice × T × D
到账 quota = A × Q
```

创建会话发送 `ProductID` 和金额快照，但这段代码没有显式币种字段，见 `controller/topup_waffo_pancake.go:53-92,339-410`、`model/topup.go:577-633`。因此不能从本仓库代码推断外部产品币种，也不能在未核验上游产品的情况下承诺人民币 1:1。

### 8.6 管理员手动补单

不同支付提供方的 `TopUp.Amount` 不是同一种单位。当前实现按提供方区分：

- Stripe：`Money × Q`；
- Creem：`Amount` 已是原始 quota；
- Epay、Waffo、Waffo Pancake 等：`Amount × Q`。

见 `model/topup.go:362-433`。这避免了对 Creem 再乘一次 `QuotaPerUnit`；维护新支付通道时必须明确其 `Amount` 语义。

## 9. 兑换码、管理员调额和订阅

### 9.1 兑换码

兑换码保存原始 quota，兑换时直接执行 `user.quota += redemption.quota`，见 `model/redemption.go:137-185`。默认前端创建/编辑兑换码时会依据当前显示模式把输入金额转换为原始 quota，见 `web/default/src/features/redemption-codes/lib/redemption-form.ts:76-98`。

因此在 `CNY + USDExchangeRate=1 + Q=500000` 下，管理员输入 `¥1` 会保存为 `500000 quota`。`BillingUSDToCNYRate` 不参与。

### 9.2 管理员调额

后端的增加、减少和覆盖操作都接收原始 quota，见 `controller/user.go:1111-1146`。默认前端使用 `parseQuotaFromDollars` 做显示金额到原始 quota 的换算，见 `web/default/src/features/users/components/user-quota-dialog.tsx:48-85`。

### 9.3 订阅

- 余额购买套餐扣除 `ceil(plan.PriceAmount × Q)` 原始 quota，见 `model/subscription.go:719-819`。
- 默认前端保存套餐时固定 `currency: USD`，套餐总额度则按当前显示模式转成原始 quota，见 `web/default/src/features/subscriptions/lib/plan-form.ts:95-119`。
- 外部支付完成后创建 `UserSubscription`，不会给钱包增加可消费余额；用于订单历史的 `TopUp.Amount=0`，见 `model/subscription.go:484-668`。
- 管理员绑定订阅同样不移动钱包余额，见 `model/subscription.go:697-716`。

`BillingUSDToCNYRate` 不参与套餐售价、购买扣款或订阅额度面值。若站点把钱包账户单位解释为人民币，`PriceAmount` 和外部订阅支付产品仍需单独按这一业务语义配置并验收。

## 10. 已修复边界、已知风险与未验证项

### 10.1 本地代码已加载，目标汇率尚未保存

最新工作区代码已在本地重启，3000 直连和 5173 代理的 `/api/status` 都返回 `billing_usd_to_cny_rate=1`。这说明字段已经生效，但目标值 `7.3` 尚未写入配置；`/api/pricing` 中的 GPT 基础组倍率也仍是旧值 `0.3`、`0.5` 和 `7.3`，没有 `0.05`。生产环境没有部署。管理员完成汇率和分组迁移后，仍需通过 `/api/status`、`/api/pricing`、小额模型调用和日志快照完成最终验收。

### 10.2 异步任务计费快照已补齐

异步 token 任务差额结算现在优先使用任务 `BillingContext` 中持久化的 `ModelRatio`、`GroupRatio`、`BillingUSDToCNYRate` 和 `OtherRatios`，不再在任务完成时重新读取当前模型倍率或分组倍率。只有历史任务缺少整个 `BillingContext` 时，才兼容回退到当前配置，并保留旧逻辑中 `group -> group` 特殊倍率优先于普通分组倍率的语义，见 `service/task_billing.go` 中的 `RecalculateTaskQuotaByTokens`。

回归测试 `TestRecalculateTaskQuotaByTokensUsesPersistedBillingContext` 会在任务创建后把全局模型倍率、分组倍率和计费汇率改为不同值，确认最终仍按任务快照结算。

### 10.3 音频倍率快照已补齐

普通音频和 Realtime/WSS 结算现在使用请求开始时写入 `PriceData` 的 `CompletionRatio`、`AudioRatio` 和 `AudioCompletionRatio`，见 `relay/helper/price.go:121-176`、`service/quota.go:59-89,117-136,175-204,302-331`。回归测试 `TestCalculateAudioQuotaUsesFrozenRequestRatios` 覆盖请求期间修改全局倍率的场景。

### 10.4 请求重试保留原始计费汇率

同步请求切换到下一个候选分组时，`reserveRelayGroupBilling` 会重新计算最终命中组的分组倍率，但把首次请求 `PriceData` 中的计费汇率传给重算函数；只有旧上下文没有有效汇率时才读取当前配置，见 `controller/relay.go:312-324`、`relay/helper/price.go:72-83`。异步 Task 每次尝试调用按次价格助手时也会优先沿用当前请求 `PriceData` 已捕获的有效汇率，同时刷新最终组倍率。`TestReserveRelayGroupBillingCreatesSessionForFreeToPaidFallback` 和 `TestModelPriceHelperPerCallPreservesInitialBillingRateAcrossGroupRetry` 分别覆盖同步与 Task 的跨组重试。

### 10.5 Realtime 阶梯音频变量已补齐

Realtime/WSS 阶梯结算现在会把文本 token 与音频 token 分开归一化，并同时传入 `p`、`c`、`ai`、`ao` 和 `len`，见 `service/quota.go:159-164`、`service/tiered_settle.go` 中的 `BuildRealtimeTieredTokenParams`。回归测试 `TestBuildRealtimeTieredTokenParamsSeparatesAudioVariables` 覆盖该变量映射。

### 10.6 非阶梯模式仍有少量实时配置读取

非阶梯请求已冻结模型、分组、计费汇率和音频倍率等主要参数，但结算时仍会读取当前 `QuotaPerUnit` 以及工具单价等独立收费配置。运行中修改这些全局项可能造成一次请求内的预扣/结算口径不完全一致。

### 10.7 配置价不等于自动同步的官方价

模型广场的“官方原价”来自 `ModelRatio`、`ModelPrice` 或阶梯表达式，不会联网核对官方价格。默认模型倍率表仍含历史人民币换算常量和注释，例如 `setting/ratio_setting/model_ratio.go:13-15,159-233`。新增计费汇率只会乘到当前配置成本上，不会自动修正过期、自定义或已经按人民币换算过的价格；上线前必须审计目标 GPT 模型的基础价。

### 10.8 阶梯表达式文档存在漂移

`pkg/billingexpr/expr.md:111-139` 仍描述旧的 `|||` 请求规则分隔写法，而当前前端生成 `(base) * rules`，后端直接执行统一表达式。配置和运维应以当前编译器/编辑器行为为准，并修正文档后再向管理员公开该语法。

### 10.9 支付金额与币种核对不足

支付回调普遍会验签、检查成功状态和本地订单状态，但没有在所有通道中把回调的实际金额、币种与创建订单时的本地快照做一致性核对。Stripe 还存在预览、外部 Price、订单 `Money` 和到账额度四套口径不一致的问题。

本次没有读取或验证 Stripe、Creem、Epay、Waffo、Waffo Pancake 的外部商户产品与币种配置，也没有执行真实支付。因此任何“人民币 1:1 已经可用于生产”的结论都不成立。

### 10.10 数值边界

quota 按 int32 安全策略执行饱和转换，并在发生钳制时写入管理员日志，见 `common/quota_math.go`、`service/log_info_generate.go:19-49`。这能防止溢出变成负扣费，但饱和本身代表异常请求或异常配置，仍需要管理员处理。

## 11. 上线前验收清单

1. 新进程的 `/api/status` 必须同时返回 `quota_display_type=CNY`、`usd_exchange_rate=1`、目标 `billing_usd_to_cny_rate` 和 `quota_per_unit=500000`。
2. 核对目标用户组到目标消费组是否存在 `GroupGroupRatio` 覆盖；最终有效倍率必须确实为 `0.05`。
3. 保证充值组倍率和档位折扣为 1；不要把消费折扣 `0.05` 配进 `TopupGroupRatio`。
4. 审计目标 GPT 的 `ModelRatio`、`ModelPrice` 或阶梯表达式是否真的是当前官方美元价。
5. 用一个按 token 模型验证：官方 `$10` 在模型广场显示官方 `¥73`、销售 `¥3.65`、分组 `0.05x`，实际扣费与日志一致。
6. 分别验证一个固定按次模型、一个阶梯模型、缓存、图片、音频、工具调用和异步任务。
7. 验证普通请求、跨组重试和长任务执行期间修改配置时的快照行为；10.2 至 10.5 已有回归测试，10.6 所列实时配置读取仍应避免在请求处理中途变更。
8. 对每个启用的支付通道做小额受控真实支付，核对实付币种、实付金额、订单金额、到账 quota 和最终钱包显示。
9. 对兑换码、管理员调额、余额购买订阅和外部订阅分别验收，确认它们不受 `BillingUSDToCNYRate` 影响。
10. 检查消费日志中的有效分组倍率、计费汇率、模型价、预扣与结算差额；确认没有 quota 饱和告警。

只有上述运行态与支付验收完成后，才能确认“充值 1 人民币得到 1 人民币额度，并按官方人民币价格的 5% 销售 GPT”完整成功。
