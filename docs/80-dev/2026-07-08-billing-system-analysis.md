---
status: draft
owner: Dev Team
last-reviewed: 2026-07-08
---

# 当前账单功能分析

## 结论摘要

当前系统的账单能力本质是“个人用户额度钱包 + 个人订阅额度 + 消费日志”的组合，而不是组织级账单系统。

已支持：

- 个人钱包余额、已用额度、请求次数统计。
- API Key 级别额度限制和已用额度统计。
- 个人充值订单、在线支付、兑换码充值、管理员补单。
- 个人订阅套餐、订阅订单、用户订阅实例、订阅额度扣费与重置。
- API 消费日志、充值日志、退款日志、管理审计日志。
- 模型倍率计费、固定价格/按次计费、表达式阶梯计费。
- OpenAI 兼容的 billing subscription / usage 查询接口。

未支持：

- 组织、企业、租户级账单账户。
- 组织共享余额或组织共享订阅。
- 组织成员消费归集、分摊、成本中心、组织发票。
- 独立的 BillingAccount / Organization / Tenant 付款主体模型。

`group` 当前是用户分组、模型可用分组、路由/计费倍率分组，不是组织账户。

补充边界：如果后续引入组织概念，组织也不参与扣费。组织只作为统计账单、用量分析、成本归集和汇总报表工具存在。当前个人钱包、个人订阅、Token 额度、预扣费、结算、退款逻辑应继续保持唯一扣费链路。

## 账单主体

### 用户个人账户

核心账单主体是 `model.User`。

相关字段：

- `Quota`：用户剩余额度。
- `UsedQuota`：用户已用额度。
- `RequestCount`：用户请求次数。
- `Group`：用户分组，用于倍率、模型可用性、套餐升级/降级等逻辑。
- `StripeCustomer`：Stripe 客户标识。

代码位置：

- `model/user.go`

这说明当前余额和已用量是直接挂在用户上的，不是挂在组织或账单账户上。

### API Key 额度

`model.Token` 支持 API Key 级别额度：

- `RemainQuota`
- `UnlimitedQuota`
- `UsedQuota`
- `Group`

Token 仍然通过 `UserId` 归属于某个用户。它可以限制单个 Key 的额度和统计单个 Key 的用量，但不是独立付款主体。

代码位置：

- `model/token.go`

## 钱包充值账单

钱包充值订单由 `model.TopUp` 表达。

字段包括：

- `UserId`
- `Amount`
- `Money`
- `TradeNo`
- `PaymentMethod`
- `PaymentProvider`
- `CreateTime`
- `CompleteTime`
- `Status`

支持的支付方式/网关常量包括：

- `stripe`
- `creem`
- `waffo`
- `waffo_pancake`
- `balance`
- `epay`

用户侧接口包括：

- 查询充值配置：`GET /api/user/topup/info`
- 查询个人充值记录：`GET /api/user/topup/self`
- 兑换码充值：`POST /api/user/topup`
- Epay 支付：`POST /api/user/epay/pay`
- Stripe 支付：`POST /api/user/stripe/pay`
- Creem 支付：`POST /api/user/creem/pay`
- Waffo 支付：`POST /api/user/waffo/pay`
- Waffo Pancake 支付：`POST /api/user/waffo-pancake/pay`

管理员侧接口包括：

- 查询全平台充值记录：`GET /api/user/admin/topup`
- 管理员补单：`POST /api/user/admin/topup/complete`

代码位置：

- `model/topup.go`
- `controller/topup.go`
- `controller/topup_stripe.go`
- `controller/topup_creem.go`
- `controller/topup_waffo.go`
- `controller/topup_waffo_pancake.go`
- `router/api-router.go`

## 兑换码充值

兑换码由 `model.Redemption` 表达。

字段包括：

- `UserId`：创建兑换码的管理员/用户。
- `Key`
- `Status`
- `Name`
- `Quota`
- `CreatedTime`
- `RedeemedTime`
- `UsedUserId`
- `ExpiredTime`

兑换逻辑中，用户提交兑换码后会把 `Quota` 加到该用户的 `quota` 上，并写入 `LogTypeTopup` 日志。

管理员可以创建、查询、更新、删除兑换码。

代码位置：

- `model/redemption.go`
- `controller/redemption.go`
- `controller/user.go`
- `router/api-router.go`

## 订阅账单

订阅体系包含三层模型。

### 订阅套餐

`model.SubscriptionPlan` 表示套餐配置。

关键字段：

- `Title`
- `Subtitle`
- `PriceAmount`
- `Currency`
- `DurationUnit`
- `DurationValue`
- `CustomSeconds`
- `Enabled`
- `AllowBalancePay`
- `AllowWalletOverflow`
- `StripePriceId`
- `CreemProductId`
- `WaffoPancakeProductId`
- `MaxPurchasePerUser`
- `UpgradeGroup`
- `DowngradeGroup`
- `TotalAmount`
- `QuotaResetPeriod`
- `QuotaResetCustomSeconds`

能力说明：

- 支持按年、月、日、小时、自定义秒数配置有效期。
- 支持总订阅额度。
- 支持每日、每周、每月、自定义周期重置额度。
- 支持购买后升级用户分组，过期后降级或恢复分组。
- 支持配置订阅额度耗尽后是否允许回退到钱包扣费。

### 订阅订单

`model.SubscriptionOrder` 表示一次订阅购买订单。

字段包括：

- `UserId`
- `PlanId`
- `Money`
- `TradeNo`
- `PaymentMethod`
- `PaymentProvider`
- `Status`
- `CreateTime`
- `CompleteTime`
- `ProviderPayload`

### 用户订阅实例

`model.UserSubscription` 表示用户已经拥有的订阅实例。

字段包括：

- `UserId`
- `PlanId`
- `AmountTotal`
- `AmountUsed`
- `StartTime`
- `EndTime`
- `Status`
- `Source`
- `LastResetTime`
- `NextResetTime`
- `UpgradeGroup`
- `PrevUserGroup`
- `DowngradeGroup`
- `AllowWalletOverflow`

这层是实际扣订阅额度的对象。

代码位置：

- `model/subscription.go`
- `controller/subscription.go`

## 订阅购买与管理接口

用户侧订阅接口：

- `GET /api/subscription/plans`
- `GET /api/subscription/self`
- `PUT /api/subscription/self/preference`
- `POST /api/subscription/balance/pay`
- `POST /api/subscription/epay/pay`
- `POST /api/subscription/stripe/pay`
- `POST /api/subscription/creem/pay`
- `POST /api/subscription/waffo-pancake/pay`

管理员侧订阅接口：

- `GET /api/subscription/admin/plans`
- `POST /api/subscription/admin/plans`
- `PUT /api/subscription/admin/plans/:id`
- `PATCH /api/subscription/admin/plans/:id`
- `POST /api/subscription/admin/bind`
- `POST /api/subscription/admin/plans/:id/subscriptions/reset`
- `GET /api/subscription/admin/users/:id/subscriptions`
- `POST /api/subscription/admin/users/:id/subscriptions`
- `POST /api/subscription/admin/users/:id/subscriptions/reset`
- `POST /api/subscription/admin/user_subscriptions/:id/invalidate`
- `DELETE /api/subscription/admin/user_subscriptions/:id`

代码位置：

- `router/api-router.go`
- `controller/subscription.go`
- `controller/subscription_payment_epay.go`
- `controller/subscription_payment_stripe.go`
- `controller/subscription_payment_creem.go`
- `controller/subscription_payment_waffo_pancake.go`

## 扣费资金来源

请求扣费通过统一的 `BillingSession` 处理。

资金来源只有两类：

- `wallet`
- `subscription`

对应实现：

- `WalletFunding`
- `SubscriptionFunding`

用户可以设置扣费偏好：

- `subscription_first`
- `wallet_first`
- `subscription_only`
- `wallet_only`

默认值是 `subscription_first`。

行为概括：

- `subscription_first`：优先扣订阅；没有订阅时扣钱包；订阅额度不足时，如果订阅允许钱包兜底，则扣钱包。
- `wallet_first`：优先扣钱包；钱包不足时扣订阅。
- `subscription_only`：只扣订阅。
- `wallet_only`：只扣钱包。

代码位置：

- `service/billing.go`
- `service/billing_session.go`
- `service/funding_source.go`
- `common/str.go`
- `dto/user_settings.go`

## 消费计费方式

当前支持多种计费方式。

### 模型倍率计费

默认模式是 `ratio`。模型根据 `ModelRatio`、补全倍率、缓存倍率、图片倍率、音频倍率等参数计算额度。

代码位置：

- `relay/helper/price.go`
- `setting/ratio_setting/model_ratio.go`
- `service/text_quota.go`
- `service/quota.go`

### 固定价格/按次计费

部分模型或任务按固定价格/按次价格计算，之后再乘以用户使用分组倍率。

典型场景：

- Midjourney 类任务。
- 异步视频/图像/音乐任务。
- 某些固定价格模型。

代码位置：

- `relay/helper/price.go`
- `service/task_billing.go`
- `model/task.go`

### 表达式阶梯计费

`tiered_expr` 支持通过表达式描述复杂计费：

- 输入 token：`p`
- 输出 token：`c`
- 上下文长度：`len`
- 缓存读取：`cr`
- 缓存写入：`cc`、`cc1h`
- 图片输入/输出：`img`、`img_o`
- 音频输入/输出：`ai`、`ao`
- 请求参数/请求头条件：`param()`、`header()`
- 阶梯标识：`tier()`

表达式输出按 `$ / 1M tokens` 转换为内部 quota，再乘以分组倍率。

代码位置：

- `setting/billing_setting/tiered_billing.go`
- `pkg/billingexpr/expr.md`
- `pkg/billingexpr/*`
- `service/tiered_settle.go`

### 工具调用附加计费

文本请求还会对部分工具调用加收费用，例如：

- web search
- Claude web search
- file search
- image generation call
- audio input

代码位置：

- `service/text_quota.go`
- `service/tool_billing.go`

## 预扣费、结算与退款

整体流程：

1. 请求进入后先估算预扣额度。
2. `PreConsumeBilling` 创建 `BillingSession`。
3. 根据用户扣费偏好选择钱包或订阅。
4. 请求成功后按实际用量 `SettleBilling`。
5. 实际用量大于预扣时补扣。
6. 实际用量小于预扣时退回差额。
7. 请求失败时退款。

订阅预扣有独立幂等记录：

- `SubscriptionPreConsumeRecord`
- 按 `request_id` 去重。
- 失败退款通过 `RefundSubscriptionPreConsume` 回滚。

异步任务也保存计费上下文：

- `TaskPrivateData.BillingSource`
- `TaskPrivateData.SubscriptionId`
- `TaskPrivateData.TokenId`
- `TaskPrivateData.BillingContext`

这样任务后续轮询完成或失败时可以进行差额结算或退款。

代码位置：

- `service/billing.go`
- `service/billing_session.go`
- `service/funding_source.go`
- `model/subscription.go`
- `service/task_billing.go`
- `model/task.go`

## 消费日志与账单查询

`model.Log` 是消费和操作日志的主要表。

字段包括：

- `UserId`
- `CreatedAt`
- `Type`
- `Content`
- `Username`
- `TokenName`
- `ModelName`
- `Quota`
- `PromptTokens`
- `CompletionTokens`
- `UseTime`
- `IsStream`
- `ChannelId`
- `TokenId`
- `Group`
- `RequestId`
- `UpstreamRequestId`
- `Other`

日志类型包括：

- `LogTypeTopup`
- `LogTypeConsume`
- `LogTypeManage`
- `LogTypeSystem`
- `LogTypeError`
- `LogTypeRefund`
- `LogTypeLogin`

当请求通过订阅扣费时，日志 `Other` 会写入：

- `billing_source`
- `billing_preference`
- `subscription_id`
- `subscription_pre_consumed`
- `subscription_post_delta`
- `subscription_plan_id`
- `subscription_plan_title`
- `subscription_total`
- `subscription_used`
- `subscription_remain`
- `subscription_consumed`
- `wallet_quota_deducted = 0`

代码位置：

- `model/log.go`
- `service/log_info_generate.go`

## OpenAI 兼容账单接口

系统提供旧 Dashboard 风格的兼容接口：

- `GET /dashboard/billing/subscription`
- `GET /v1/dashboard/billing/subscription`
- `GET /dashboard/billing/usage`
- `GET /v1/dashboard/billing/usage`

这些接口基于 `TokenAuth`。

统计口径：

- 默认按用户：读取用户 `quota` 和 `used_quota`。
- 如果启用 `DisplayTokenStatEnabled`：按当前 token 的 `remain_quota`、`used_quota`、`expired_time` 返回。

代码位置：

- `router/dashboard.go`
- `controller/billing.go`

## 分组和组织的边界

当前代码里存在 `Group`，但它不是组织账单。

`Group` 的用途主要是：

- 用户分组。
- 模型/渠道可用分组。
- 使用分组倍率。
- 用户分组对使用分组的特殊倍率。
- 订阅套餐购买后的用户分组升级。
- 订阅过期后的用户分组降级或恢复。

相关代码：

- `model/user.go`
- `model/token.go`
- `setting/ratio_setting/group_ratio.go`
- `relay/helper/price.go`
- `model/subscription.go`

未看到以下组织账单必备模型：

- `Organization`
- `Tenant`
- `BillingAccount`
- `OrganizationSubscription`
- `OrganizationMember`
- `organization_id`
- `tenant_id`
- 组织共享钱包
- 组织付款主体
- 组织发票主体

因此不能把当前 `group` 解释为组织账单。

## 是否支持个人账单

支持。

个人账单能力包括：

- 用户个人钱包。
- 用户个人充值记录。
- 用户个人兑换码充值。
- 用户个人订阅。
- 用户个人消费日志。
- 用户个人扣费偏好。
- API Key 级别额度限制和用量统计。
- 管理员查看/管理用户充值与订阅。

个人账单是当前系统的主线。

## 是否支持组织账单

不支持组织扣费账单。

当前系统没有组织级账单账户。即使有用户分组、模型分组、渠道分组，它们也只是权限/路由/价格倍率维度，不是共享付款主体。

后续如果引入组织，目标不是让组织成为付款主体，而是提供“组织维度的统计账单与分析汇总”。组织应只读取现有个人消费结果，不改变请求扣费资金来源。

建议新增的组织分析概念：

- 组织模型：组织、成员、角色。
- 组织成员关系：一个用户同一时间只能属于一个组织。
- 组织统计账单：按组织、成员、模型、渠道、时间窗口汇总。
- 组织报表权限：谁能查看组织用量、导出明细、查看成本分析。

明确不做：

- 不做组织余额。
- 不做组织订阅。
- 不做组织付款客户 ID。
- 不做组织预扣费、补扣、退款。
- 不把请求从个人扣费切换为组织扣费。
- 不迁移现有个人钱包和个人订阅。
- 不修改 Token 模型，不给 API Key 增加组织或项目归属。
- 不从请求 Header、请求上下文或客户端参数读取组织归属。
- 不新增组织消费流水表；组织账单从现有个人消费日志按成员用户汇总。

组织统计账单的数据来源应是现有个人消费事实：请求仍按用户个人钱包/订阅完成扣费，组织层只根据成员关系读取并汇总这些用户已发生的消费日志。

## 组织级账单扩展设计

### 设计原则

组织级账单是用户级账单之上的只读汇总视图。

- 用户级账号能力保持不变：个人钱包、个人订阅、充值、兑换码、消费日志、API Key 额度继续走原链路。
- 组织级账号只表达组织、成员、角色和报表权限。
- 一个用户同一时间只能属于一个组织，避免同一笔用户消费被多个组织重复解释。
- 组织账单不做精确成本归因到 Token、项目、Header 或请求上下文。
- 组织账单查询链路为：`OrganizationMember.UserId -> Log.UserId -> 汇总 quota / tokens / model / channel / created_at`。

### 数据模型草案

```go
// model/organization.go
type Organization struct {
    Id        int
    Name      string
    OwnerId   int
    Status    int
    CreatedAt int64
    UpdatedAt int64
}

type OrganizationMember struct {
    Id             int
    OrganizationId int
    UserId         int    // 唯一约束：同一时间只能属于一个组织
    Role           string // owner / admin / member / billing
    JoinedAt       int64
    LeftAt         int64  // 0 表示当前仍有效
}
```

`OrganizationMember` 需要在当前有效成员上保证 `UserId` 唯一。实现时可根据数据库兼容性选择：

- 第一版只允许物理删除成员记录，直接对 `user_id` 建唯一索引。
- 如果要保留历史成员关系，则用 `left_at = 0` 表达当前成员，并在服务层事务中保证同一用户只有一条当前有效成员记录；不要依赖部分索引，因为 SQLite、MySQL、PostgreSQL 的支持和语义不一致。

不新增以下模型：

- `OrganizationProject`
- `OrganizationUsage`
- `OrganizationTokenBinding`
- `BillingAccount`
- `OrganizationSubscription`

### 账单查询规则

组织账单只按成员用户汇总现有日志。

- 汇总范围：当前组织有效成员的 `UserId`。
- 数据来源：`model.Log`，以 `Log.UserId` 关联组织成员。
- 消费类型：默认统计 `LogTypeConsume`，退款和系统调整是否进入报表需要在接口参数中明确。
- 可筛选维度：成员、模型、渠道、时间窗口。
- 可展示维度：组织总用量、成员排行、模型成本、渠道成本、时间趋势、消费明细导出。

历史归属推荐采用成员有效期口径：

- `Log.CreatedAt >= OrganizationMember.JoinedAt`
- `OrganizationMember.LeftAt = 0` 或 `Log.CreatedAt < OrganizationMember.LeftAt`

这样成员离开组织后，组织仍可查看其在组织成员有效期内产生的历史消费；成员加入组织前的个人历史消费不进入组织账单。

### 后端接口草案

- `GET /api/organization/self`：当前用户所在组织。
- `GET /api/organization/:id/members`：组织成员列表。
- `POST /api/organization/:id/members`：添加成员；必须校验该用户当前不属于其他组织。
- `DELETE /api/organization/:id/members/:user_id`：移除成员；若保留历史，设置 `LeftAt`。
- `GET /api/organization/:id/usage`：组织用量汇总。
- `GET /api/organization/:id/usage/members`：成员用量排行。
- `GET /api/organization/:id/logs`：组织消费明细，底层按成员 `UserId` 查询现有日志。
- `GET /api/admin/organizations`：系统管理员查看所有组织。

这些接口只读取或维护组织与成员关系，不触发扣费、退款、预扣或结算。

### 页面规划

用户侧页面：

- `/organization/usage`：组织总用量、时间趋势、模型和渠道分布。
- `/organization/members`：成员列表、角色、加入时间、移除成员。
- `/organization/logs`：组织消费明细，支持按成员、模型、渠道、时间筛选和导出。
- `/organization/settings`：组织基础信息和成员邀请入口。

管理员页面：

- `/admin/organizations`：全局组织列表、状态、成员数、用量入口。
- `/admin/organizations/:id`：系统管理员查看某个组织的成员和用量明细。

未加入组织的普通用户不展示组织页面入口。

### 权限模型

- 系统管理员：查看和管理所有组织、成员、组织用量和组织消费明细。
- 组织 Owner/Admin：管理本组织成员，查看本组织汇总、成员排行和消费明细。
- 组织 Billing：查看本组织汇总、成员排行和消费明细，可导出报表，不管理成员。
- 组织 Member：查看本组织汇总和自己的组织内用量；是否可看其他成员明细由产品配置决定，默认不允许。
- 普通用户：未加入组织时只能看个人账单和个人日志。

### 迁移策略

- 现有用户默认不属于任何组织。
- 不自动创建个人组织。
- 不回填历史日志到独立组织流水，因为没有独立组织流水表。
- 用户加入组织后，组织账单按成员有效期汇总现有 `Log.UserId` 日志。
- 如果第一版使用物理删除成员关系，则组织账单只能按当前成员汇总；若需要保留离职成员历史账单，应从第一版开始保留 `JoinedAt` / `LeftAt`。

### 决策结论

1. 组织成为一等统计维度，不复用 `group`。
2. 组织用量归属只按成员用户判断，不按项目、Token、Header 或显式组织 Key 判断。
3. 不新增独立组织用量流水表，从现有 `logs` 按成员聚合。
4. API Key 不增加组织或项目归属字段。
5. 管理员全局账单和组织管理员报表分开授权。
6. 第一版组织报表支持组织总览、成员排行、模型成本、渠道成本、时间趋势和明细导出；不支持项目成本。
