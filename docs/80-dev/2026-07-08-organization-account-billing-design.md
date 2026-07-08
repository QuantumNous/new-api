---
status: draft
owner: Dev Team
last-reviewed: 2026-07-08
---

# 组织、个人、模型账单设计

## 结论摘要

基于当前组织扩展边界，账单体系应拆成三层：

```text
个人账号 = 唯一真实扣费主体
组织账号 = 成员集合 + 报表权限 + 汇总视图
模型账单 = 消费明细的统计维度，不是账号主体
```

设计原则：

- 个人负责扣费。
- 组织负责汇总。
- 模型负责分类。

第一版不把组织设计成付款主体，也不把模型设计成账号主体。系统里只有个人账号真实持有余额、订阅、充值、扣费、退款和消费日志。

## 当前基础

当前账单主线已经围绕个人用户建立。

个人用户字段：

- `model.User.Quota`：个人剩余额度。
- `model.User.UsedQuota`：个人已用额度。
- `model.User.RequestCount`：个人请求次数。
- `model.User.Group`：个人分组，用于倍率、模型可用性和订阅升级/降级。

API Key 字段：

- `model.Token.UserId`：Token 所属用户。
- `model.Token.RemainQuota`：Token 剩余额度限制。
- `model.Token.UsedQuota`：Token 已用额度。
- `model.Token.ModelLimits`：Token 模型限制。
- `model.Token.Group`：Token 使用分组。

消费日志字段：

- `model.Log.UserId`：消费归属用户。
- `model.Log.CreatedAt`：消费发生时间。
- `model.Log.Type`：日志类型。
- `model.Log.ModelName`：消费模型。
- `model.Log.Quota`：消费额度。
- `model.Log.PromptTokens`：输入 token。
- `model.Log.CompletionTokens`：输出 token。
- `model.Log.ChannelId`：渠道。
- `model.Log.TokenId`：请求使用的 Token。

模型价格字段：

- `model.Pricing.ModelName`：模型名。
- `model.Pricing.QuotaType`：计费类型。
- `model.Pricing.ModelRatio`：倍率计费模型的倍率。
- `model.Pricing.ModelPrice`：固定价格模型的价格。
- `model.Pricing.BillingMode`：计费模式。
- `model.Pricing.BillingExpr`：表达式计费规则。

这些字段已经足够支撑个人账单、组织汇总账单和模型维度账单。

## 账号边界

### 个人账号

个人账号是真实账单主体。

负责：

- 钱包余额。
- 充值订单。
- 兑换码充值。
- 订阅套餐。
- 订阅额度扣费。
- API 消费扣费。
- 退款和系统调整。
- API Key 额度限制。
- 个人消费日志。

个人账号继续走现有扣费链路：

```text
请求 -> Token -> User -> 个人钱包/订阅 -> 预扣 -> 结算/退款 -> Log
```

第一版组织扩展不改变这条链路。

### 组织账号

组织账号不是付款主体，而是组织空间。

负责：

- 组织基本信息。
- 组织成员。
- 组织角色。
- 组织账单权限。
- 组织维度用量汇总。
- 组织维度消费明细查询。

组织账号不负责：

- 组织余额。
- 组织充值。
- 组织订阅。
- 组织付款客户 ID。
- 组织预扣费。
- 组织结算。
- 组织退款。
- 组织 API Key。

组织账单查询链路：

```text
Organization
  -> OrganizationMember.UserId
  -> Log.UserId
  -> group by member / model / channel / time
```

一个用户同一时间只能属于一个组织。这样组织账单可以稳定解释为“该组织成员在成员有效期内产生的个人消费汇总”。

### 模型账单

模型账单不是模型账号，而是账单分析维度。

负责回答：

- 哪些模型产生了消费？
- 每个模型消耗了多少额度？
- 每个模型消耗了多少输入/输出 token？
- 每个模型由哪些用户、组织、渠道使用？
- 每个模型在不同时间窗口下的消费趋势如何？

模型账单不负责：

- 模型余额。
- 模型充值。
- 模型订阅。
- 模型付款主体。
- 模型级扣费账户。

模型账单数据来源是 `Log.ModelName` 和模型价格配置。模型价格配置用于解释消费规则，消费事实仍以已经写入的日志为准。

## 组织账单口径

### 成员归属

组织成员关系使用独立模型表达：

```go
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
    UserId         int
    Role           string // owner / admin / member / billing
    JoinedAt       int64
    LeftAt         int64  // 0 表示当前仍有效
}
```

规则：

- 一个用户同一时间只能属于一个组织。
- `LeftAt = 0` 表示当前有效成员。
- 添加成员时必须校验该用户没有其他当前有效组织成员关系。
- 移除成员时必须保留成员记录并设置 `LeftAt`，不要物理删除，否则无法保留历史归属口径。

实现约束：

- 不依赖跨数据库部分索引实现“当前有效成员唯一”，因为 SQLite、MySQL、PostgreSQL 的支持和语义不一致。
- 添加成员必须在服务层事务中检查该用户是否存在 `LeftAt = 0` 的成员关系。
- 如果并发添加同一用户，需要使用事务、行锁或可移植的唯一约束辅助方案保证最终只有一个当前有效组织。

### 历史归属

组织账单按成员有效期统计：

```text
Log.UserId = OrganizationMember.UserId
Log.CreatedAt >= OrganizationMember.JoinedAt
OrganizationMember.LeftAt = 0 或 Log.CreatedAt < OrganizationMember.LeftAt
```

含义：

- 用户加入组织前的历史消费不进入组织账单。
- 用户在组织成员有效期内的消费进入组织账单。
- 用户离开组织后，组织仍可查看其成员有效期内产生的历史消费。

### 消费类型

第一版默认统计：

- `LogTypeConsume`：API 消费。

可选支持：

- `LogTypeRefund`：退款。
- `LogTypeSystem`：系统调整。

组织账单拆成两个口径：

- 用量口径：默认只统计 `LogTypeConsume`，用于组织用量概览、排行和趋势。
- 对账口径：消费、退款、系统调整分列展示，不默认合并成净额。

接口可显式提供 `include_refund`、`include_adjustment` 或 `view=usage|reconciliation` 参数。管理员或 Billing 角色可在对账视图中打开完整账务口径。

## 三类账单视图

### 个人账单视图

面向单个用户。

指标：

- 剩余额度。
- 已用额度。
- 请求次数。
- 充值记录。
- 订阅状态。
- 消费明细。
- API Key 用量。
- 模型分布。
- 时间趋势。

筛选：

- 时间窗口。
- Token。
- 模型。
- 渠道。
- 日志类型。

权限：

- 用户只能看自己的个人账单。
- 系统管理员可查看所有用户账单。

### 组织账单视图

面向组织 Owner、Admin、Billing 和系统管理员。

指标：

- 组织总消费额度。
- 组织总请求数。
- 组织总 prompt tokens。
- 组织总 completion tokens。
- 成员消费排行。
- 模型消费分布。
- 渠道消费分布。
- 时间趋势。
- 消费明细导出。

筛选：

- 时间窗口。
- 成员。
- 模型。
- 渠道。
- 日志类型。

权限：

- 系统管理员：查看所有组织。
- 组织 Owner/Admin：查看本组织汇总和成员明细，管理成员。
- 组织 Billing：查看本组织汇总和成员明细，导出报表，不管理成员。
- 组织 Member：默认只看自己的组织内用量；是否允许看组织汇总由产品配置决定。
- 未加入组织的普通用户：不展示组织账单入口。

### 模型账单视图

模型账单应同时支持个人、组织和管理员三个入口。

个人侧：

- 我的模型消费排行。
- 我的模型 token 消耗。
- 我的模型时间趋势。

组织侧：

- 本组织模型消费排行。
- 本组织模型 token 消耗。
- 本组织模型时间趋势。
- 可下钻到成员。

管理员侧：

- 全平台模型消费排行。
- 模型调用量。
- 模型 token 消耗。
- 模型渠道分布。
- 模型分组可用性。
- 模型价格/倍率解释。

模型账单不直接重新计算扣费，应优先使用 `Log.Quota` 作为消费事实。价格配置只用于展示当前模型的计费规则和辅助解释，不用来覆盖历史日志。

历史价格解释规则：

- 当前价格配置不能解释所有历史价格变更。
- 如果日志 `Other` 中已经记录当次请求的计费模式、表达式、命中档位或其他价格快照，应优先展示日志内快照。
- 如果日志没有价格快照，只展示 `Log.Quota` 事实和当前价格配置，不反推历史应扣额度。

## 数据聚合设计

### 查询策略

组织成员关系在主库，消费日志可能在主库 `LOG_DB = DB`，也可能在独立日志库 `LOG_DB`，甚至是 ClickHouse。组织账单不能假设组织表和日志表可以跨库 join。

实现必须采用两阶段查询：

```text
1. 从主库查询 OrganizationMember，得到成员 UserId、JoinedAt、LeftAt。
2. 在日志库按 user_id、created_at、type、model_name、channel 等条件查询或聚合 Log。
```

如果成员有效期不同，日志条件需要表达为按成员分组的时间窗口。第一版可以先按成员逐个查询后在服务层合并汇总；当成员规模较大时，再引入可移植的批量条件构造或聚合缓存。

分页规则：

- 组织消费明细必须先应用组织权限、成员 `UserId` 和成员有效期过滤，再排序和分页。
- 不能先从日志表取一页全局日志再在内存中过滤成员，否则会漏数据、页数不准，也可能暴露非组织成员日志。
- 排序应复用现有日志排序口径，优先按 `created_at desc` 和稳定次序字段分页。

事实源规则：

- 组织账单事实源是 `Log`。
- `QuotaData` 或其他聚合表只能作为性能优化，不能作为唯一事实源。
- 如果聚合表缺失、刷新延迟或口径不满足成员有效期过滤，必须降级回 `Log` 查询。

### 组织总览

输入：

- `organization_id`
- `start_timestamp`
- `end_timestamp`

处理：

```text
1. 从主库查询组织成员有效期。
2. 在日志库按成员 UserId 和有效期过滤 Log。
3. 默认筛选 LogTypeConsume。
4. 汇总 quota、prompt_tokens、completion_tokens、请求数。
```

输出：

- `total_quota`
- `request_count`
- `prompt_tokens`
- `completion_tokens`
- `member_count`
- `active_member_count`

### 成员排行

维度：

- `Log.UserId`
- `Log.Username`

指标：

- `sum(Log.Quota)`
- `sum(Log.PromptTokens)`
- `sum(Log.CompletionTokens)`
- `count(*)`

### 模型分布

维度：

- `Log.ModelName`

指标：

- `sum(Log.Quota)`
- `sum(Log.PromptTokens)`
- `sum(Log.CompletionTokens)`
- `count(*)`

展示时可补充模型价格信息：

- `Pricing.QuotaType`
- `Pricing.ModelRatio`
- `Pricing.ModelPrice`
- `Pricing.BillingMode`

### 渠道分布

维度：

- `Log.ChannelId`

指标：

- `sum(Log.Quota)`
- `count(*)`

渠道名称可沿用现有渠道缓存或查询逻辑补齐。

### 时间趋势

维度：

- 小时或天。

指标：

- `sum(Log.Quota)`
- `count(*)`
- `sum(Log.PromptTokens)`
- `sum(Log.CompletionTokens)`

第一版建议按天聚合，后续再支持小时粒度。

## 接口设计

### 组织基础

- `GET /api/organization/self`
- `GET /api/organization/current`
- `PATCH /api/organization/current`

### 组织成员

- `GET /api/organization/current/members`
- `POST /api/organization/current/members`
- `PATCH /api/organization/current/members/:user_id`
- `DELETE /api/organization/current/members/:user_id`

添加成员时：

- 校验目标用户存在且未删除。
- 校验目标用户当前不属于其他组织。
- 校验操作者是系统管理员或本组织 Owner/Admin。

删除成员时：

- 设置 `LeftAt`。
- 不删除历史消费日志。
- 不物理删除成员关系。
- 不影响该用户个人账号、Token、余额和订阅。

### 组织账单

- `GET /api/organization/current/billing/summary`
- `GET /api/organization/current/billing/members`
- `GET /api/organization/current/billing/models`
- `GET /api/organization/current/billing/channels`
- `GET /api/organization/current/billing/trend`
- `GET /api/organization/current/billing/logs`

这些接口只读消费事实，不写账务数据。

用户侧组织接口使用 `current` 语义，不从 URL 接收组织 ID。后端根据当前登录用户查询其唯一当前组织，减少越权查询风险。

### 管理员组织账单

- `GET /api/admin/organizations`
- `GET /api/admin/organizations/:id/billing/summary`
- `GET /api/admin/organizations/:id/billing/members`
- `GET /api/admin/organizations/:id/billing/models`
- `GET /api/admin/organizations/:id/billing/channels`
- `GET /api/admin/organizations/:id/billing/trend`
- `GET /api/admin/organizations/:id/billing/logs`

管理员接口可跨组织查询，用户侧接口只能查询当前用户所在组织。

## 页面设计

### 用户侧

- `/organization/usage`
  - 组织总消费。
  - 时间趋势。
  - 模型分布。
  - 渠道分布。

- `/organization/members`
  - 成员列表。
  - 成员角色。
  - 加入时间。
  - 移除成员。

- `/organization/logs`
  - 组织消费明细。
  - 按成员、模型、渠道、时间筛选。
  - 导出。

- `/organization/settings`
  - 组织名称。
  - 组织状态。
  - 成员邀请或添加入口。

### 管理员侧

- `/admin/organizations`
  - 组织列表。
  - 状态。
  - Owner。
  - 成员数。
  - 总消费入口。

- `/admin/organizations/:id`
  - 组织详情。
  - 成员管理。
  - 组织账单。
  - 组织消费明细。

## 明确不做

第一版不做：

- 组织余额。
- 组织充值。
- 组织订阅。
- 组织付款客户 ID。
- 组织预扣费、补扣、退款。
- 组织 API Key。
- Token 绑定组织。
- 请求传 `organization_id`。
- Header 归属组织。
- 项目成本中心。
- 独立 `OrganizationUsage` 流水。
- 模型账号余额。
- 模型级付款主体。

这些能力会把组织从“汇总视图”推进到“真实账单主体”，会触碰现有扣费链路，不符合当前扩展边界。

## 落地顺序

### 第一阶段：组织成员与权限

- 新增 `Organization`。
- 新增 `OrganizationMember`。
- 实现一个用户同一时间只能属于一个组织。
- 实现组织角色。
- 实现用户侧组织入口可见性。

### 第二阶段：组织账单只读查询

- 实现组织总览。
- 实现成员排行。
- 实现组织消费明细。
- 使用成员有效期过滤现有 `Log`。
- 不写任何新账务流水。

### 第三阶段：模型维度账单

- 实现组织模型分布。
- 实现个人模型分布。
- 实现管理员全平台模型分布。
- 展示当前模型价格配置用于解释，不重算历史扣费。

### 第四阶段：导出与对账

- 组织明细导出。
- 成员消费导出。
- 模型消费导出。
- 可选支持退款和系统调整口径。

## 风险与约束

### 成员有效期

第一版必须保留 `JoinedAt` 和 `LeftAt`。物理删除成员关系会导致离职成员历史消费失去组织归属，因此不作为可选实现。

### 日志库兼容

组织账单查询需要兼容主库日志和独立日志库。查询应优先复用现有日志查询模式，不引入数据库特有 SQL，也不能依赖组织表和日志表跨库 join。

### 历史价格解释

模型价格配置可能变化。组织和模型账单应以 `Log.Quota` 为消费事实，不应用当前价格配置反推历史消费。价格配置只作为展示解释；如果日志内已有当次价格快照，应优先展示日志快照。

### 聚合缓存

`QuotaData` 等聚合表只能用于加速趋势或汇总查询。由于它们可能存在刷新延迟、开关关闭或口径不含成员有效期的问题，组织账单必须保留从 `Log` 查询的准确路径。

### 权限误用

组织 Member 默认不应看到其他成员明细。成员级明细对组织 Owner/Admin/Billing 和系统管理员开放。

## 最终决策

第一版账单设计采用：

```text
个人账号真实扣费
组织账号只读汇总
模型账单作为统计维度
```

这能在不影响现有个人钱包、订阅、Token、预扣、结算和退款链路的前提下，补齐组织账单和模型账单视图。
