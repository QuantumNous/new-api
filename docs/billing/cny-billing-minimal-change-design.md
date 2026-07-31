# 人民币钱包与官方美元模型价计费：最小改动设计

## 1. 背景与目标

当前系统的模型基础价格来自 OpenAI 等厂商的美元报价，但站点希望采用人民币钱包：

- 用户支付 `¥1`，获得可见余额 `¥1`；
- 模型销售价为“官方美元价格换算成人民币后的 5%”；
- 模型广场同时展示人民币官方原价、人民币销售价和尽可能直观的小倍率（推荐 `0.05`）；
- 尽量不改变已有额度存储、模型价格配置和数据库结构。

本设计的核心计费公式为：

```text
人民币模型消费 = 官方 USD 成本 × BillingUSDToCNYRate × 实际消费分组倍率
```

推荐初始配置：

```text
BillingUSDToCNYRate = 7.3
实际消费分组倍率 = 0.05
```

例如官方成本为 `$10`：

```text
人民币官方原价 = 10 × 7.3 = ¥73
人民币销售价   = 10 × 7.3 × 0.05 = ¥3.65
销售价 / 官方原价 = 0.05
```

## 2. 设计边界

### 2.1 保持不变

- `QuotaPerUnit` 保持现值，例如 `500000`；
- 用户、令牌、日志、充值订单等表中的 quota 字段及数据库 schema 不变；
- 现有 `ModelRatio`、`ModelPrice`、完成倍率、缓存倍率、图片/音频倍率继续以美元模型价格体系为基准；
- 动态计费表达式中的价格系数继续表示厂商公布的 USD/1M tokens，不把人民币汇率写入表达式；
- 路由完成后仍以实际选中的具体消费分组倍率结算，不使用充值分组倍率代替；
- 历史原始额度不批量重写，不执行额度乘除迁移。

### 2.2 新增且严格隔离的语义

| 配置 | 语义 | 允许影响的范围 |
| --- | --- | --- |
| `BillingUSDToCNYRate` | 官方美元模型成本换算成人民币的计费汇率 | 模型消费、模型广场价格 |
| `USDExchangeRate` | 一个内部额度单位在钱包中如何展示 | 余额、额度、日志及额度表单的展示/输入换算 |
| `Price` | 购买一个基础充值单位所需支付的本地金额 | Epay 等使用该字段的充值通道 |
| `GroupRatio` | 实际模型消费分组倍率 | 模型预扣费和结算 |
| `TopupGroupRatio` | 充值价格或到账规则中的充值分组倍率 | 充值，不得用于模型消费 |

`BillingUSDToCNYRate` 不得进入充值、兑换码、管理员调额、余额转账或订阅额度面值换算。`USDExchangeRate` 也不得替代 `BillingUSDToCNYRate` 参与模型扣费。

## 3. 钱包面值

原始额度仍按 quota 整数存储。人民币显示公式为：

```text
可见人民币余额 = 原始 quota / QuotaPerUnit × USDExchangeRate
```

目标配置为：

```text
general_setting.quota_display_type = CNY
USDExchangeRate = 1
QuotaPerUnit = 500000
```

因此：

```text
500000 原始 quota = ¥1 可见余额
```

这里的 `USDExchangeRate = 1` 不是声明真实外汇牌价为 1，而是定义站点钱包面值：一个历史上的“系统美元单位”现在显示并输入为一个人民币单位。切换显示模式或汇率只重解释显示值，不修改数据库中的原始 quota。

## 4. 模型消费计费

### 4.1 统一公式

先在现有美元价格体系中得到本次请求的官方 USD 成本，再统一换算：

```text
officialCostUSD = 现有 ModelRatio / ModelPrice / 动态表达式计算结果
billedCNY       = officialCostUSD × BillingUSDToCNYRate × actualGroupRatio
chargedQuota    = billedCNY × QuotaPerUnit
```

其中 `actualGroupRatio` 必须是本次请求路由和计费最终采用的具体分组倍率。API Key 的候选组、自动组或跨组重试只负责选组；实际扣费以最终命中的具体组为准。

其他已有的请求级倍率（例如图片数量、时长、质量或工具调用倍率）仍在其原有位置参与 `officialCostUSD` 或最终费用计算，不改变本设计中的货币换算顺序。

### 4.2 按量模型

基础 `ModelRatio`、输入/输出倍率、缓存倍率等继续表达美元价格关系。最终 quota 换算时统一乘：

```text
BillingUSDToCNYRate × actualGroupRatio
```

不得为了人民币计费而把所有 `ModelRatio` 预先乘以 `7.3`，否则模型配置会与官方美元价脱钩，并存在重复换算风险。

### 4.3 按次模型

`ModelPrice` 继续表示每次调用的 USD 基础价格：

```text
chargedQuota = ModelPrice
             × BillingUSDToCNYRate
             × actualGroupRatio
             × QuotaPerUnit
```

### 4.4 动态计费表达式

表达式系数继续使用官方 `USD/1M tokens`：

```text
rawCostUSD = exprOutput / 1,000,000
chargedQuota = rawCostUSD
             × QuotaPerUnit
             × BillingUSDToCNYRate
             × actualGroupRatio
```

表达式中不得硬编码 `7.3` 或 `0.05`。汇率和消费分组倍率必须由计费上下文统一注入，以保证普通计费与动态表达式计费一致。

## 5. 模型广场展示

模型广场必须使用与后端扣费相同的 `BillingUSDToCNYRate`，但官方原价和销售价采用不同倍率：

```text
人民币官方原价 = 官方 USD 价格 × BillingUSDToCNYRate
人民币销售价   = 官方 USD 价格 × BillingUSDToCNYRate × actualGroupRatio
```

规则如下：

- 官方原价只乘计费汇率，不乘任何消费分组倍率；
- 销售价乘实际展示分组的消费倍率；
- 倍率比较使用 `销售价 / 官方原价`，在推荐配置下显示 `0.05`；
- 不使用 `USDExchangeRate`、`Price` 或 `TopupGroupRatio` 计算模型广场价格；
- 用户切换模型广场的 USD/CNY 视图只改变展示币种，不改变后端实际扣费；
- 动态表达式、按次价格、输入/输出/缓存价格都遵循同一套官方价与销售价边界。

这样能够真实表达“官方人民币价格的 5%”，而不是通过缩小官方原价或混用充值汇率得到更小但失真的比例。

## 6. 请求与任务快照

汇率可能在请求执行期间被管理员修改，因此预扣费和最终结算不能分别读取实时配置。

### 6.1 同步请求

预扣费时将以下数据冻结到请求计费上下文：

- `BillingUSDToCNYRate`；
- 实际消费分组及其倍率；
- 模型价格/倍率或动态表达式版本；
- 其他已有的结算必要参数。

最终结算必须使用同一个冻结汇率，并将汇率写入消费日志，便于复核。

### 6.2 异步任务

图片、视频等异步任务在创建时把 `BillingUSDToCNYRate` 写入任务的 billing context。任务完成、失败退款或补差额时均使用任务快照，不重新读取全局汇率。

### 6.3 旧数据兼容

旧请求日志、旧任务或旧快照可能没有 `BillingUSDToCNYRate`。兼容规则为：

```text
字段缺失、0、负数、NaN 或无穷值 -> 回退为 1
```

回退 `1` 保持历史行为，避免部署新代码后把旧任务突然按 `7.3` 结算。新请求必须写入有效快照。

## 7. 人民币 1:1 充值

### 7.1 Epay

Epay 的目标配置为：

```text
Price = 1
TopupGroupRatio = 1
AmountDiscount = 1（或不配置折扣）
USDExchangeRate = 1
quota_display_type = CNY
```

设用户输入充值数量为 `A`：

```text
实际支付 = A × Price × TopupGroupRatio × AmountDiscount = ¥A
到账 quota = A × QuotaPerUnit
可见余额增加 = A × USDExchangeRate = ¥A
```

因此用户支付 `¥1`，增加 `500000` 原始 quota，并显示为 `¥1`。

消费组倍率 `0.05` 只能配置在模型消费分组中。不得把 `TopupGroupRatio` 设置为 `0.05`，否则会改变充值价格或到账结果，而不是实现模型五折以下计费。

### 7.2 外部支付通道限制

仅修改站内 `Price`、`USDExchangeRate` 或 `BillingUSDToCNYRate`，不能保证所有外部支付通道都实现人民币 1:1。

| 通道 | 价格/币种权威来源 | 实现人民币 1:1 的条件 |
| --- | --- | --- |
| Epay | 站内 `Price`、充值倍率、档位折扣；币种由商户通道决定 | 商户通道按 CNY 收款，三个倍率均为 1 |
| Stripe | Stripe 后台 `PriceId` 对应的单价和币种 | 外部 Price 必须是 `CNY ¥1/单位`；`StripeUnitPrice=1` 仅能保证站内预览一致，不能覆盖外部 Price |
| Creem | Creem 外部产品的价格、币种和产品定义 | 外部产品必须支持并配置 CNY 1:1，且到账 quota 与 `QuotaPerUnit` 对齐；不能只依赖本地展示配置 |
| Waffo | 站内 Waffo 币种、单价、充值倍率和折扣 | 币种为 CNY、单价为 1、倍率和折扣为 1 |
| Waffo Pancake | 创建会话时未显式传币种，实际币种由上游产品或通道配置决定 | 现状不能严格承诺 CNY 1:1；应停用该通道，或在确认上游支持 CNY 后单独改造并验收 |

Stripe 优惠码、外部产品折扣和支付平台税费也可能破坏严格的“实付 ¥1”。上线前必须分别检查。支付回调还应校验实际支付金额和币种是否与订单快照一致，不能仅依赖订单号和成功状态。

## 8. 配置迁移步骤

1. 备份当前 options、消费分组倍率、充值分组倍率、档位折扣和所有外部支付产品配置。
2. 部署支持 `BillingUSDToCNYRate` 和计费快照的代码；首次保持该值为 `1`，确认旧行为无回归。
3. 确认 `QuotaPerUnit` 和数据库 schema 未改变，也不运行余额数据迁移。
4. 设置 `quota_display_type=CNY`、`USDExchangeRate=1`，确认已有 `500000` quota 显示为 `¥1`。
5. 设置 Epay `Price=1`，把所有需要人民币 1:1 的充值组倍率和档位折扣设为 `1`。
6. 分别核对 Stripe、Creem、Waffo、Waffo Pancake 的外部币种、单价、产品和优惠配置；不能满足 CNY 1:1 的通道先停用。
7. 设置 `BillingUSDToCNYRate=7.3`。
8. 将目标模型消费分组倍率设为 `0.05`，保持 `TopupGroupRatio=1`。
9. 用一个按 token 模型、一个按次模型和一个异步任务做小额真实验收，再开放全部流量。
10. 记录切换时间。切换前的历史日志按其原语义保留，不用新汇率追溯重算。

迁移会改变现有原始余额的计价购买力，但不会改变余额数字本身。上线前应明确这是一次站点计价政策切换，而不是普通的货币符号调整。

## 9. 回滚方案

由于没有数据库 schema 和 quota 数据迁移，站内回滚以恢复配置为主：

1. 暂停新增充值和新增长任务，等待在途请求完成；
2. 将消费分组倍率恢复为备份值，例如原策略的 `0.3`；
3. 将 `BillingUSDToCNYRate` 恢复为 `1`；
4. 恢复原 `quota_display_type`、`USDExchangeRate`、`Price`、充值倍率和折扣；
5. 恢复或停用对应的 Stripe/Creem/Waffo/Pancake 外部产品；
6. 如需回滚代码，使用切换前构建，但保留新字段兼容读取能力更安全；
7. 核对切换窗口内的请求/任务日志。已经冻结汇率的在途任务应继续按其快照结算，不能用回滚后的全局值覆盖。

## 10. 验收清单

### 10.1 配置与存储

- [ ] `/api/status` 返回 `quota_display_type=CNY`、`usd_exchange_rate=1`、`billing_usd_to_cny_rate=7.3`、预期的 `quota_per_unit`；
- [ ] 数据库没有新增/修改 quota 列，也没有批量改写用户余额；
- [ ] 消费分组倍率为 `0.05`，充值分组倍率为 `1`；
- [ ] 所有充值档位折扣为 `1` 或未配置。

### 10.2 钱包与充值

- [ ] `500000` 原始 quota 显示为 `¥1`；
- [ ] Epay 充值 `1` 实付 `¥1`，到账增加 `500000` quota，余额显示增加 `¥1`；
- [ ] 兑换码和管理员调额输入 `¥1` 时转换为 `500000` quota；
- [ ] Stripe/Creem/Waffo 的外部币种、单价、到账额度与站内预览一致；
- [ ] Waffo Pancake 未在无法支持 CNY 时对外宣称人民币 1:1。

### 10.3 模型广场

- [ ] 官方 `$10` 示例在 CNY 视图显示官方原价 `¥73`；
- [ ] 同一模型、同一分组的销售价显示 `¥3.65`；
- [ ] 页面显示的销售/官方倍率为 `0.05`；
- [ ] 官方原价不随消费分组切换而改变，销售价随实际分组倍率改变；
- [ ] USD/CNY 视图切换不会改变后端实际扣费。

### 10.4 请求结算

- [ ] 按 token、按次、动态表达式、图片/音频、工具调用和异步任务均执行 `USD 成本 × 7.3 × 0.05`；
- [ ] 预扣费、结算和日志中的汇率、分组倍率、quota 结果一致；
- [ ] 请求开始后把全局汇率从 `7.3` 改为其他值，该请求仍按快照中的 `7.3` 结算；
- [ ] 异步任务创建后修改全局汇率，任务完成或退款仍使用任务快照；
- [ ] 缺少汇率字段的旧快照按 `1` 兼容结算；
- [ ] 没有负扣费、溢出、重复换算或把 `USDExchangeRate` 误用于模型消费的路径。

## 11. 最终推荐配置

```text
QuotaPerUnit = 500000                 # 保持不变
quota_display_type = CNY
USDExchangeRate = 1                  # 钱包：500000 quota 显示 ¥1
Price = 1                            # Epay：一个充值单位支付 ¥1
TopupGroupRatio = 1                  # 充值倍率
AmountDiscount = 1                   # 无充值折扣
BillingUSDToCNYRate = 7.3            # 官方 USD 模型成本换算人民币
GroupRatio = 0.05                    # 实际模型消费分组倍率
```

这组配置把钱包、充值、官方价格换算和模型折扣拆成独立参数：用户支付 `¥1` 获得 `¥1` 余额，同时 GPT 销售价严格等于官方人民币价格的 `5%`。
