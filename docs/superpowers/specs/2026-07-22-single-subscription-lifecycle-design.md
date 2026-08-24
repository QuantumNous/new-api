# 单用户单订阅生命周期设计

- 状态：待书面审阅
- 日期：2026-07-22
- 基线：`SolveaCX/new-api` PR #462 后续分支，起点 commit `10519e8f4`
- 关联设计：`docs/superpowers/specs/2026-07-22-stripe-subscription-cancellation-design.md`

## 1. 背景与问题

当前订阅实现把每次支付完成都视为一次独立购买：创建新的 `UserSubscription`，保存固定的起止时间和额度。Stripe Checkout 虽然使用 `mode=subscription`，但本地没有把 Stripe subscription 当作跨账期合同处理，也没有通过 `invoice.paid`、`invoice.payment_failed` 等事件完成续费、宽限、换档和额度发放。

现状允许同一用户拥有多条 active `UserSubscription`，前端也按数组展示并叠加消费。这与已经确认的产品规则冲突：一个用户只能有一个当前套餐，升级立即替换，降级下期生效，额度不能叠加或跨期累计。

本设计将“支付合同”和“每期可消费额度”分开：

- `UserSubscriptionContract` 表示用户唯一的当前套餐合同和下一步意图。
- `UserSubscription` 保留为每个已支付账期的额度快照和审计历史。
- `SubscriptionProviderBinding` 精确绑定 Stripe `sub_xxx`，负责远端 recurring 生命周期。
- `SubscriptionChangeIntent` 记录升级、降级及跨系统补偿过程。

## 2. 已确认的产品规则

以下规则是本设计的固定输入：

1. 每个用户最多一个当前套餐合同；不允许同档重复购买、额度叠加或时长叠加。
2. 套餐高低由显式 `tier_rank` 判断，不使用价格或 `sort_order` 推断。
3. 升级立即生效并从升级成功时开始一个全新账期：旧账期立即结束、旧剩余额度作废、新档发放完整额度。
4. Stripe 到 Stripe 的升级复用同一个 Stripe subscription，并替换现有 subscription item 的 Price；不创建第二个 `sub_xxx`。
5. 升级收取新套餐全价，不抵扣旧套餐剩余时间，不退款。
6. 降级只对 Stripe recurring 开放，在当前账期结束时生效；当前账期套餐、额度和结束时间不变。
7. 同一账期多次选择降级时，以数据库最后提交的一次选择为准，只保留一个待生效套餐。
8. Stripe 套餐默认自动续费；用户可以取消或恢复自动续费。
9. 取消自动续费优先于预约降级：取消时清除降级预约；恢复时恢复当前套餐续费，不恢复旧降级预约。
10. 余额支付只购买一期，不自动续费；到期后合同结束，不能预约下期降级。
11. 每个新账期发放完整额度，上期剩余额度清零，不跨期累计。
12. 普通续费或降级续费扣款失败后进入三天宽限期；不发新额度，只能继续使用上期剩余额度。三天后仍未支付则套餐失效。
13. 订阅额度属于用户，不属于 API key。用户购买、升级或续费后不需要新建 key，现有 key 和之后新建的 key 都使用同一用户的当前额度。

## 3. 范围与非目标

### 3.1 本期范围

- 单用户唯一合同和唯一当前额度。
- Stripe recurring 首期、续费、取消、恢复、立即升级、期末降级和扣款失败宽限。
- 余额一期的首次购买和立即升级。
- Stripe webhook 幂等、乱序处理和定时对账。
- 钱包页单套餐视图、套餐换档和续费管理。
- 旧多订阅数据收敛和三数据库迁移。
- 与正在实现的 Stripe recurring 取消模块合并为同一套模型和服务边界。

### 3.2 非目标

- 不实现按剩余时间折算、差价补扣、退款或 E2 结算。
- 不为订阅自动创建新用户组。
- 不在本期改变 PLG 分组折扣规则。`upgrade_group` 为空时，用户原有 PLG 折扣仍然存在；若要让订阅用户不享受 PLG 折扣，应显式配置一个倍率为 1 的现有分组，或在后续设计独立的计费折扣策略。
- 不把 Creem、Waffo Pancake 或 epay 改造成自动续费。它们如果继续开放，只能按一期支付处理并服从唯一合同约束。
- 不接入 Stripe Customer Portal。
- 不允许管理员静默删除仍在扣款的 Stripe recurring。

## 4. 核心架构与不变量

```text
User
  1 --- 1 UserSubscriptionContract
              | current_entitlement_id
              | current_provider_binding_id
              | pending_plan_id
              |
              + --- N UserSubscription             每期额度与历史
              + --- N SubscriptionProviderBinding  历史/当前支付合同
              + --- N SubscriptionChangeIntent     换档与补偿审计
```

系统必须持续满足以下不变量：

- `UserSubscriptionContract.user_id` 唯一。
- 一个合同最多一条 current entitlement；历史额度不能重新参与消费。
- 一个合同最多一个当前 provider binding。
- `(provider, provider_subscription_id)` 全局唯一，绝不按 Customer、Plan 或最近创建时间猜测 Stripe subscription。
- 一个 Stripe invoice 最多发放一次额度。
- 一个合同最多一个当前待生效 plan；降级的“最后一次选择”由合同变更版本决定。
- Stripe recurring 的远端状态以 Stripe GET 的当前对象为准；webhook payload 只是唤醒信号和审计输入。
- 所有数据库约束、事务和条件更新同时兼容 SQLite、MySQL 和 PostgreSQL，不依赖 partial index、数据库专用 JSON 或 advisory lock。

## 5. 数据模型

### 5.1 `SubscriptionPlan`

新增：

| 字段 | 语义 |
|---|---|
| `tier_rank` | 可空正整数；值越大套餐越高；对参与新生命周期的套餐必填 |

约束和管理规则：

- 存量未迁移套餐的 `tier_rank` 可以为 `NULL`；参与新钱包页的启用套餐必须大于 0，且不能与另一个启用套餐重复。
- Go、Pro、Max 必须按实际产品关系配置递增 rank。
- 为跨 SQLite/MySQL/PostgreSQL 和多节点保证“启用套餐 rank 唯一”，新增 `SubscriptionTierRankReservation`：`tier_rank` 为主键，`active_plan_id` 唯一。启用、禁用或替换套餐版本时在事务内占用或释放 reservation，不使用 partial index。
- 历史或待启用的新版本可以保留相同 rank，但同一时刻只有 reservation 指向的 plan 可启用。合同在原 plan 版本结束前继续引用原版本，不被后台静默迁移。
- rank 相同的套餐不能互相购买或切换，因此同档重复购买在业务模型层不可表达。
- 套餐一旦被合同、额度历史或换档意图引用，`tier_rank`、`duration_*`、`total_amount`、`stripe_price_id` 和 `upgrade_group` 视为生命周期关键字段，不允许原地修改；需要变更时禁用旧套餐并新建版本。
- `sort_order` 只决定展示顺序，`price_amount` 只用于展示和余额计价，均不得用于判断升降级。
- Stripe Price 必须是 recurring Price，周期必须与套餐周期一致；多币种由同一 Price 的 Stripe 配置决定，不能因结算币种不同改变 rank。

Go 模型中 `TierRank` 必须是 `*int` 或等价 nullable 类型，未配置值写 SQL `NULL`，不能用 0 代替。reservation 使用非空整数主键：

```go
TierRank *int `gorm:"type:int"`

type SubscriptionTierRankReservation struct {
    TierRank     int `gorm:"primaryKey;type:int"`
    ActivePlanId int `gorm:"uniqueIndex;not null"`
}
```

### 5.2 `UserSubscriptionContract`

新增用户唯一合同表：

| 字段 | 语义 |
|---|---|
| `id` | 本地主键 |
| `user_id` | 用户 ID，唯一 |
| `status` | `active`、`grace`、`ended`、`needs_attention` |
| `payment_mode` | `stripe_recurring`、`balance_one_period` 或 `external_one_period`；新钱包页只创建前两种 |
| `current_plan_id` | 当前生效套餐 |
| `current_entitlement_id` | 当前唯一额度快照 |
| `current_provider_binding_id` | 当前 Stripe binding；一期支付为 0 |
| `current_period_start` | 当前已支付账期开始 |
| `current_period_end` | 当前已支付账期结束 |
| `grace_period_end` | 宽限结束时间；无宽限为 0 |
| `pending_plan_id` | 下期降级目标；无预约为 0 |
| `pending_effective_at` | 预约生效时间 |
| `latest_change_intent_id` | 当前最后一次换档命令 |
| `change_version` | 每次用户换档选择递增，用于“最后一次选择为准” |
| `provider_sync_token` | 跨系统同步短租约 token |
| `provider_sync_until` | 同步租约过期时间 |
| `base_user_group` | 首次应用 `upgrade_group` 前的原用户组 |
| `applied_user_group` | 当前由合同应用的用户组；未应用为留空 |
| `created_at/updated_at` | 审计时间 |

合同在结束后仍保留。同一用户再次购买时复用该合同记录、递增版本并创建新的额度和 binding 历史，不通过新增第二条合同规避唯一约束。

支付模式映射固定为：Stripe Checkout `mode=subscription` 且存在已验证 `sub_xxx` 才是 `stripe_recurring`；钱包余额扣款是 `balance_one_period`；兼容保留的 epay、Creem、Waffo Pancake 等非 recurring 成功订单统一是 `external_one_period`。仅凭 `payment_provider=stripe` 不能判定 recurring，Stripe one-time 钱包充值不创建订阅合同。

`needs_attention` 只用于已经发生远端副作用但本地尚未完成补偿的异常。处于该状态时停止新的换档写操作，但不凭该状态自动扣除已确认支付的权益；对账任务必须继续修复。

### 5.3 `UserSubscription`

保留现有额度快照，新增：

| 字段 | 语义 |
|---|---|
| `contract_id` | 所属合同；存量历史可为 0 |
| `provider_binding_id` | 对应 Stripe binding；一期支付为 0 |
| `grant_key` | 可空唯一值；Stripe 为 `stripe:in_xxx`，余额为 `balance:<trade_no>` |
| `current_slot` | 可空整数；当前额度固定为 1，历史为 `NULL` |
| `access_end_time` | 实际可消费截止时间；正常等于 `end_time`，宽限时只延长此字段 |
| `end_reason` | `renewed`、`upgraded`、`expired`、`cancelled`、`admin_invalidated` |

数据库对 `(contract_id, current_slot)` 建唯一索引。三个目标数据库都允许唯一索引中存在多条 `NULL`，因此历史记录可共存，而 `current_slot=1` 最多一条。

nullable 唯一字段必须在 Go 中实际使用指针或 `sql.Null*`，并在写入前把空值归一化为 SQL `NULL`，不能写空字符串或 0：

```go
ContractId  int     `gorm:"uniqueIndex:idx_contract_current_slot,priority:1"`
CurrentSlot *int    `gorm:"type:int;uniqueIndex:idx_contract_current_slot,priority:2"`
GrantKey    *string `gorm:"type:varchar(255);uniqueIndex"`
```

额度切换在同一事务内完成：先将旧行的 `current_slot` 清空并写入结束原因，再创建新行并设置 `current_slot=1`，最后更新合同的 `current_entitlement_id`。事务外永远不暴露两个 current entitlement。

已经预扣到旧 `UserSubscription.id` 的在途请求继续在旧记录上结算或退款，不得把旧请求的消费转移到新账期。

### 5.4 `SubscriptionProviderBinding`

复用取消订阅设计中的 provider-neutral binding，并增加 `contract_id`。binding 保留：

- `provider_subscription_id`、`provider_customer_id`、当前 Price 和 subscription item ID。
- Stripe status、`cancel_at_period_end`、账期、最新 invoice、schedule ID 和 livemode。
- provider snapshot 的最后同步时间和终止时间。

同一合同可以有多个历史 binding，但合同只通过 `current_provider_binding_id` 指向一个当前 binding。用户取消、恢复、升级和 webhook 必须同时校验：

```text
binding.contract_id == contract.id
binding.id == contract.current_provider_binding_id
binding.user_id == authenticated_user_id
```

取消模块原设计允许同一用户多份 active recurring；本设计生效后该假设被本设计取代。binding 的精确定位、远端取消/恢复、snapshot 同步和 webhook 去重逻辑继续复用，但用户入口只允许操作唯一合同指向的当前 binding。

### 5.5 `SubscriptionChangeIntent`

新增换档和补偿审计表：

| 字段 | 语义 |
|---|---|
| `id`、`contract_id`、`user_id` | 本地标识 |
| `change_version` | 该命令取得的合同版本 |
| `request_id` | 客户端命令 ID；与 `user_id` 组成唯一约束 |
| `kind` | `purchase`、`upgrade`、`downgrade`、`cancel`、`resume` 或 `terminate` |
| `from_plan_id/to_plan_id` | 换档两端 |
| `payment_mode` | purchase/upgrade 选择的支付模式；降级沿用 Stripe recurring，其他操作留空 |
| `status` | `created`、`syncing`、`awaiting_payment`、`scheduled`、`applied`、`failed`、`expired`、`superseded`、`compensation_required` |
| `provider_binding_id` | 被修改的精确 binding |
| `provider_invoice_id` | 升级账单 |
| `provider_schedule_id` | 降级 schedule |
| `provider_idempotency_key` | Stripe 写请求幂等键 |
| `previous_schedule_snapshot` | 升级前需要恢复的降级摘要；只存最小必要字段 |
| `wallet_debit_trade_no` | 余额升级扣款记录 |
| `effective_at` | 立即升级时间或期末降级时间 |
| `superseded_by_id` | 被后续选择替代时的审计关系 |
| `last_error`、`created_at/updated_at` | 故障与时间 |

合同的 `latest_change_intent_id` 是唯一的当前命令指针。历史 intent 不删除。首次购买命令在创建 Stripe Checkout 前先创建一条 `status=ended` 的合同壳和 purchase intent，从而让并发请求也受 `user_id` 唯一约束；支付成功后再激活合同。

### 5.6 `SubscriptionOrder` 与 webhook 去重

`SubscriptionOrder` 新增 `contract_id`、`change_intent_id` 和 `purpose`，其中 purpose 为 `initial_purchase` 或 `upgrade`。Stripe Checkout Session 和 Subscription metadata 必须同时带上本地 trade number、user、plan、contract/change intent 标识。

创建 Checkout Session 成功后，把 `checkout_session_id` 回写订单。首期 `invoice.paid` 不依赖 Session 到达顺序：它先从 invoice 取得 subscription ID，再 GET Subscription，并用 Subscription metadata 精确定位本地订单。只有已知 session ID 或能够由 Stripe 按 subscription 查询到 Session 时，Session 才作为补充审计证据，不是首期发放的必需输入。

复用取消设计中的 `PaymentWebhookEvent`，以 `(provider, event_id)` 唯一去重，并保留 `processing/processed/failed`、`processing_token`、`processing_until`、attempt count 和 last error。业务副作用仍由 `grant_key`、合同版本和 provider binding 唯一约束二次保护，不能只依赖 Event ID。

## 6. 合同状态与用户可执行操作

| 本地状态 | 支付模式 | 可升级 | 可降级 | 可取消/恢复 | 说明 |
|---|---|---:|---:|---:|---|
| 无合同或 `ended` | 无 | 购买 | 否 | 否 | 新购任意启用套餐 |
| `active` | Stripe recurring | 是 | 是 | 是 | 正常完整能力 |
| `active` | 余额/外部一期 | 是 | 否 | 否 | 到期自动结束 |
| `grace` | Stripe recurring | 否 | 否 | 可取消 | 仅处理欠款、取消和对账 |
| `needs_attention` | 任意 | 否 | 否 | 视远端状态 | 等待补偿，避免新命令扩大分歧 |

同 rank 选择永远返回业务错误，不创建订单、intent 或 Stripe 对象。

## 7. 生命周期流程

### 7.1 首次购买

#### Stripe recurring

1. 在数据库内创建或锁定用户唯一合同；确认没有 active/grace 合同和其他未决 purchase intent，再创建 pending 订单并生成唯一 trade number。
2. 创建 Stripe Checkout Session，`mode=subscription`，只包含目标套餐一个 Price。
3. Checkout 和 Subscription metadata 都保存本地归属标识。
4. `invoice.paid` 先到时通过 Subscription metadata 定位订单并进入 `ReconcilePaidInvoice`；`checkout.session.completed` 先到时从 Session 取得 invoice/subscription 后进入同一函数。共同的必查对象是 Subscription 和 Invoice，Session 只在可定位时增强校验。两条路径都校验 user、plan、Customer、Price、livemode 和金额。
5. 在一个事务内完成订单成功、合同激活、binding 建立和首期额度创建。
6. 同一 invoice 的另一个 webhook 只会命中相同 `grant_key` 并幂等返回。

Stripe Checkout 页面关闭、支付失败或异步支付未完成时，不创建 active 合同，不发额度。

pending purchase 必须闭环：

- Checkout 创建调用失败且 Stripe 未创建 Session：订单和 purchase intent 标记 `failed`，合同壳保持 `ended`，立即允许新 purchase。
- Stripe 结果未知：用完全相同的参数和 Stripe Idempotency Key 重试创建请求，让 Stripe 返回原 Session，再校验 metadata 并保存 session ID；只有 Stripe 明确确认未创建时才标记 failed。
- Session 尚未过期且未支付：同一 `request_id` 幂等返回原 pay link；不同 `request_id` 也返回“已有待支付订单”和原 pay link，不创建第二个 Checkout。
- `checkout.session.expired` 或 GET Session 确认 expired 且未支付：订单和 intent 原子转 `expired`，清除合同 `latest_change_intent_id`，合同保持 `ended`，新 request ID 可以立即创建新 purchase。
- `checkout.session.async_payment_failed`：订单和 intent 转 `failed`，合同保持 `ended`；新 request ID 可以重试。
- 同一已 expired/failed 的 `request_id` 永远返回其终态审计结果，不复用该 ID 创建新外部对象；前端重新发起时生成新的 request ID。

#### 余额一期

1. 在同一数据库事务中锁定用户余额和合同。
2. 校验没有 active/grace 合同、套餐允许余额支付且余额足够。
3. 扣除完整一期费用，创建成功订单、active 合同和一期额度。
4. `payment_mode=balance_one_period`，无 provider binding。
5. 到 `current_period_end` 后结束合同；不自动续费、不自动扣余额。

### 7.2 正常 Stripe 续费

`invoice.paid` 是新账期额度发放的唯一业务信号：

1. 通过 invoice 的 subscription ID 精确找到当前 binding 和合同。
2. GET Stripe Subscription 和 Invoice，确认 invoice 已 paid、Price 与预期计划一致、livemode 正确。
3. 使用 `stripe:<invoice_id>` 作为 `grant_key`。
4. 在事务内结束上期额度，保留上期 `amount_used` 审计；创建新账期额度，`amount_used=0`、`amount_total=plan.total_amount`。
5. 更新合同账期、binding snapshot 并清除宽限状态。

定时任务不得在没有 paid invoice 的情况下推测续费成功并发额度。

### 7.3 立即升级

升级始终收取目标套餐完整一期价格，成功时间成为新账期开始。升级成功后旧额度和旧剩余时长立即作废。

#### Stripe recurring 升 Stripe recurring

对现有 subscription 调用 update，关键参数固定为：

```text
items[0].id = 当前 subscription item ID
items[0].price = 目标套餐 Stripe Price ID
billing_cycle_anchor = now
proration_behavior = none
payment_behavior = pending_if_incomplete
```

必须传现有 subscription item ID。只传新 Price 会新增第二个 item，造成同一 subscription 双重计费，属于阻断级错误。

Stripe 参数依据：

- [Change the price of existing subscriptions](https://docs.stripe.com/billing/subscriptions/change-price)
- [Set the subscription billing renewal date](https://docs.stripe.com/billing/subscriptions/billing-cycle)
- [Pending updates](https://docs.stripe.com/billing/subscriptions/pending-updates)
- [Subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules)

处理顺序：

1. 数据库锁定合同，比较 rank，创建 upgrade intent 并取得新的 `change_version`。
2. 若存在预约降级，先把 schedule 的恢复信息保存在 intent 中，再 release 当前 schedule；本地 `pending_plan_id` 暂时保留。
3. 使用包含 contract、version、目标 plan 的确定性 Stripe Idempotency Key 更新同一个 subscription。
4. Stripe 立即支付成功时，或随后 `invoice.paid` 到达时，GET 当前 Subscription/Invoice 确认新 Price 已生效，再原子结束旧额度、发放高档完整额度、重置账期并清除原降级预约。
5. 需要 3DS 或其他用户动作时，intent 进入 `awaiting_payment`，API 返回 Stripe 托管的付款 URL。本地套餐和额度不提前改变。
6. 付款失败或 pending update 失效时，当前套餐和额度保持不变；如果步骤 2 曾 release schedule，补偿任务按保存的摘要重新建立降级 schedule，确认成功后才把 intent 标记为 failed。
7. 若无法确认升级结果或无法恢复 schedule，合同进入 `needs_attention`，对账任务持续 GET Stripe 并完成“应用升级”或“恢复降级”中的唯一正确分支。

如果当前 subscription 已设置 `cancel_at_period_end=true`，Stripe 升级成功表示用户主动重新选择 recurring：成功后恢复自动续费；支付失败则保留原取消意图。

#### 余额一期升 Stripe recurring

创建新的 Stripe Checkout subscription。付款前继续使用当前余额套餐；首期 paid invoice 成功后，原子替换为高档额度并建立当前 binding。支付失败不改变当前套餐。

#### 余额一期升余额一期

余额扣款和额度替换在一个数据库事务内完成；收取高档完整一期价格，旧额度和剩余时长不抵扣。

#### Stripe recurring 升余额一期

这是一个可补偿 saga：

前置条件固定为：合同是 `active` 而非 `grace/needs_attention`；不存在未决 purchase/upgrade；最新 Stripe invoice 已支付且没有 open/past_due invoice。已有 `cancel_at_period_end=true` 可以继续，成功的余额升级会把它升级为立即取消；已有 pending downgrade 必须进入下面的 schedule 保存/恢复流程。

1. 事务内扣除余额并创建 intent，但不改变当前套餐额度。
2. 通过共享取消服务保存并 release 现有降级 schedule，然后精确取消当前 Stripe subscription，`invoice_now=false`、`prorate=false`，避免旧档以后继续自动扣款。
3. 若 Stripe 明确仍 active 或取消失败，使用唯一 trade number 原路退回余额，恢复原降级 schedule，保留原合同和额度。
4. 若 Stripe 已 canceled，则取消是不可逆事实；系统必须重试本地事务直到高档余额一期额度生效并结束 binding。不能简单退款后留下一个已被取消的旧 recurring。
5. 立即取消后调用取消模块的 invoice collection reconciliation，确保目标失败 invoice 不再重试，并修复同 Customer 下能够精确映射的其他 NewAPI active recurring invoice；未知 invoice 只告警不修改。
6. 本地完成后合同切换为 `balance_one_period`，新账期从完成时间开始。

失败收敛表：

| 已发生事实 | 必须动作 | 最终本地状态 |
|---|---|---|
| 余额扣款事务失败 | 不调用 Stripe | 原 Stripe 套餐保持 active |
| schedule release 明确失败 | 幂等退款；不调用 cancel | 原套餐和原降级预约不变 |
| cancel 超时/结果未知 | GET Subscription/Invoice/Schedule；不得先退款或发新额度 | intent `compensation_required`，合同暂时 `needs_attention` |
| GET 确认 subscription 仍 active | 恢复原 schedule，幂等退款 | 原套餐继续；全部补偿成功后退出 `needs_attention` |
| GET 确认 subscription 已 canceled | 不退款；重试本地额度切换 | 最终必须成为高档余额一期 |
| 仍 active 但退款失败 | 保留原套餐，重试唯一 trade number 退款 | `needs_attention`，禁止其他换档 |
| 已 canceled 但本地额度事务失败 | 不退款，重试同一 intent 的本地切换 | `needs_attention`，旧额度暂不再接受新预扣 |
| cancel 失败且原 schedule 恢复失败 | 幂等退款并持续重建 schedule | 原套餐额度可用，合同 `needs_attention` |
| cancel 成功但 invoice collection reconciliation 失败 | 完成余额额度切换，同时持续修复 invoice collection | 高档额度可用，合同 `needs_attention` 直至修复 |

所有退款、schedule 写入、cancel 和本地切换都使用各自确定性幂等键。对账只根据 GET 后的 Stripe 事实选择“退款并恢复旧套餐”或“完成新余额套餐”，两个分支不能同时执行。

### 7.4 期末降级

只有 active Stripe recurring 可以降级。余额一期用户不能预约降级。

1. 数据库锁定合同，确认目标 rank 更小，递增 `change_version`，更新唯一 `pending_plan_id` 和 `pending_effective_at=current_period_end`。
2. 创建或更新 Stripe Subscription Schedule：当前 phase 保持当前 Price 至 `current_period_end`；下一 phase 使用低档 Price。下一 phase 完成一个账期后 `end_behavior=release`，让 subscription 继续以低档 Price recurring。
3. 每次新选择将上一 intent 标记 `superseded`。远端同步通过合同短租约串行执行，worker 每次写 Stripe 前后都重新读取最新 version；如果写完发现自己已过期，必须继续把 schedule 收敛到最新 plan。
4. 当前账期套餐、额度和结束时间完全不变。
5. 到期时 schedule 切 Price 不等于本地发额度。只有低档续费 invoice paid 后，才结束高档额度、发放低档完整额度并清空 pending 字段。
6. 低档扣款失败则进入宽限期，宽限期间仍只使用上期高档的剩余额度；支付成功后才切低档。

### 7.5 取消与恢复自动续费

复用取消订阅模块的 Stripe 精确 binding 操作，并增加合同协调：

- 正常取消：先把降级摘要保存在取消 intent 中并 release schedule，再设置 `cancel_at_period_end=true`；只有 Stripe 已确认待到期取消后才清除本地 pending 降级。若设置取消失败，则恢复原 schedule 和 pending 降级。当前已支付额度始终保持到期。
- 恢复：设置 `cancel_at_period_end=false`，续费当前套餐；不恢复之前被取消清除的降级预约。
- `past_due` 宽限期内主动取消：立即取消远端 subscription、停止失败 invoice 重试并立即结束本地合同和剩余额度。
- 管理员立即失效 Stripe recurring：必须先确认远端已取消，再结束本地合同。

取消/恢复接口仍可接受本地 `binding_id`，但该 binding 必须是合同当前 binding。前端只展示唯一当前合同，不提供历史 binding 的用户操作入口。

### 7.6 余额一期自然到期

到期任务锁定合同和 current entitlement，设置额度为 `expired`、清空 `current_slot`，合同改为 `ended`。不创建订单、不扣余额、不发下一期额度。

### 7.7 扣款失败和三天宽限

`invoice.payment_failed` 处理：

1. 精确找到当前 binding 和合同，GET Invoice/Subscription 确认仍未支付。
2. 合同进入 `grace`，`grace_period_end=首次本期失败时间+72小时`。
3. 不创建新额度，不重置 `amount_used`。旧 entitlement 的 `end_time` 保留原已支付账期边界，只把 `access_end_time` 延长到 grace end，因此用户只能使用旧剩余额度。
4. 重复失败事件不得延长 72 小时窗口。
5. 宽限内 invoice paid 时按正常续费或降级成功处理，发放新一期完整额度。
6. 宽限到期任务再次 GET Invoice。若已 paid，则走 paid 路径；若仍未支付，立即取消远端 subscription、停止 invoice 自动重试并结束本地合同。
7. 取消与付款并发时，以 Stripe GET 的最终 invoice/subscription 状态决策：已收款就发对应账期额度，未收款且已取消就结束。不得出现收款成功但静默不发额度的状态。

## 8. 额度消费、API key 与用户组

### 8.1 额度选择

消费路径不再遍历并叠加多个 active subscription，而是从用户唯一合同读取 `current_entitlement_id`。`billing_preference` 仍决定订阅额度和钱包余额的先后顺序。

`PreConsumeUserSubscription` 及其查询必须改为校验 current entitlement 的 `access_end_time > now`；账期历史、套餐内部 reset 上限和续费判断继续使用不可变的 `end_time`。宽限只改变访问截止时间，不能把付费账期伪装成延长三天。

已有 API key 无需更新。订阅变化只改变用户级合同指针，所有属于该用户的 key 在下一次请求时自动读取新额度。

### 8.2 额度换期

- 续费、升级或降级成功都创建新 `UserSubscription` 快照，不复用旧行清零。
- 旧行保留实际已用额度和结束原因。
- 旧余额不转入新行。
- 套餐内部已有的 daily/weekly/monthly reset 可以继续作用于当前账期，但不能越过合同账期结束时间。

### 8.3 `upgrade_group` 与 PLG 分组

订阅创建不会新建分组。`SubscriptionPlan.upgrade_group` 只引用系统已经存在的 group 配置：

- 为空：不改变用户组；原 PLG 分组及折扣继续存在。
- 非空：首次生效时把原 group 保存到合同 `base_user_group`，并应用套餐指定 group。
- 套餐切换时直接从当前套餐 group 切到目标套餐 group；不能把中间套餐 group 当作用户原始 group。目标套餐未配置 group 时立即恢复 `base_user_group`。
- 合同结束时，只有当用户当前 group 仍等于 `applied_user_group` 时才恢复 `base_user_group`。如果管理员或其他业务已经改过 group，订阅结束不能覆盖新值。
- 已结束合同再次激活时，先清空旧 `base_user_group/applied_user_group`，再以当时用户的实际 group 建立新基线，不能复用上一次合同的 group 快照。
- 该逻辑修复现有多条 `UserSubscription.prev_user_group` 在连续换档时可能回退到中间组的问题。

本期不自动实现“所有订阅用户取消 PLG 9 折”。如果套餐未配置 `upgrade_group`，保留 PLG 折扣是明确行为，不是缺陷。

## 9. Webhook、幂等与对账

### 9.1 处理事件

至少处理：

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.pending_update_applied`
- `customer.subscription.pending_update_expired`
- `subscription_schedule.updated/released/canceled`

### 9.2 处理原则

- 验签后以 `(provider,event_id)` 登记 `processing` 并取得处理租约。只有 `processed` 事件可以直接幂等返回 2xx。
- 唯一冲突命中 `failed` 或租约已过期的 `processing` 时，使用条件更新接管、增加 attempt count 并重试；命中仍由其他节点持有的 `processing` 时短暂等待，仍未完成则返回非 2xx 让 Stripe 重试，不能提前确认成功。
- 业务事务和必要副作用全部完成后才把事件置为 `processed`。任何错误都写 `failed/last_error` 并返回非 2xx；进程崩溃留下的 `processing` 由租约过期接管。
- 同一 Event ID 的 payload hash 不一致时停止处理并触发安全告警。
- 涉及 subscription、invoice 或 schedule 的事件处理前重新 GET 当前对象。
- `invoice.paid` 通过 `grant_key` 保证每期只发一次额度。
- `customer.subscription.updated` 只同步 provider snapshot 和唤醒 intent 协调，不单独发额度。
- `customer.subscription.pending_update_applied` 只触发 GET Subscription/Invoice 并唤醒 upgrade intent；仍然只有 paid invoice 能发额度。
- `customer.subscription.pending_update_expired` 触发升级失败收敛和原降级 schedule 恢复；不得改变当前套餐或额度。
- `customer.subscription.deleted` 终止 binding；是否结束本地合同取决于该 binding 是否仍是合同当前 binding。
- 迟到的非终态事件不能复活已终止 binding。
- 找不到 binding 时，只有 metadata 能唯一校验本地订单、用户和计划才允许补建；Customer + Price 不足以自动绑定。

### 9.3 跨系统同步租约

不在数据库事务中持有行锁等待 Stripe 网络请求。需要写 Stripe 的命令先用条件更新取得短租约：

```text
provider_sync_token = 随机操作 token
provider_sync_until = now + 短超时
```

只有租约持有者可写当前 provider desired state。租约过期可被其他节点接管。每次外部写之后重新读取合同版本和 Stripe 当前状态，直到远端与数据库最后版本一致。

### 9.4 定时对账

仅 master node 周期扫描以下异常：

- active/grace 合同与 Stripe status、Price、period 或 cancel flag 不一致。
- 当前 binding、current entitlement 或 current slot 缺失/重复。
- upgrade intent 长时间 `awaiting_payment` 或需要恢复 schedule。
- pending downgrade 与 Stripe schedule 不一致。
- paid invoice 没有对应 `grant_key`。
- grace 已到期但远端仍在重试。
- 远端已 canceled、本地仍 active。

对账只修复 Stripe 或 webhook 已经确定的事实，不凭本地时间推测支付成功或正常触发换档。

## 10. 用户 API

### 10.1 套餐和当前合同

`GET /api/subscription/plans` 增加 `tier_rank` 和相对当前合同的 `relation`：`current`、`upgrade`、`downgrade` 或 `unavailable`。

`GET /api/subscription/self` 改为单合同结构，并在迁移期保留旧字段兼容：

```json
{
  "billing_preference": "subscription_first",
  "contract": {
    "id": 12,
    "status": "active",
    "payment_mode": "stripe_recurring",
    "current_plan": { "id": 2, "title": "Pro", "tier_rank": 20 },
    "current_period_start": 1784707200,
    "current_period_end": 1787385600,
    "entitlement": {
      "amount_total": 150000000,
      "amount_used": 30000000
    },
    "pending_change": {
      "kind": "downgrade",
      "plan_id": 1,
      "effective_at": 1787385600
    },
    "cancel_at_period_end": false,
    "can_upgrade": true,
    "can_downgrade": true,
    "can_cancel": true,
    "can_resume": false
  }
}
```

服务端返回 capability，前端不能自行推断是否允许操作。

### 10.2 购买与换档

新增统一入口：

```text
POST /api/subscription/self/change-plan
```

请求：

```json
{
  "plan_id": 3,
  "payment_mode": "stripe_recurring",
  "request_id": "client-generated-uuid"
}
```

后端根据当前合同和 rank 判定首次购买、升级或降级。降级忽略客户端支付模式并沿用 Stripe recurring；余额合同请求降级直接拒绝。

响应 `result` 取以下值之一：

- `applied`：余额事务或 Stripe 已确认支付并完成切换。
- `checkout_required`：返回新建 recurring 的 `pay_link`。
- `payment_action_required`：优先返回经 GET Invoice 校验属于当前合同的 `hosted_invoice_url`；如果 Stripe 未提供托管页，则只向已鉴权的当前用户返回该 invoice 的 PaymentIntent/confirmation secret，由 Stripe.js 完成验证。不得返回其他 invoice 的 secret，也不得仅凭 webhook payload 提供付款入口。
- `scheduled`：降级已预约。
- `processing`：命令已登记，正在等待 provider 对账。

现有 `/subscription/stripe/pay` 和 `/subscription/balance/pay` 在兼容期调用同一 command service，不允许继续走“无视已有合同再插入一条 active subscription”的旧路径。

### 10.3 取消与恢复

沿用取消模块入口：

```text
POST /api/subscription/self/recurring/:binding_id/cancel
POST /api/subscription/self/recurring/:binding_id/resume
```

接口只接受当前合同返回的本地 binding ID，不向浏览器暴露 `sub_xxx`。

### 10.4 并发与错误语义

- 所有写入口接受客户端 `request_id`，同一 user + request ID 幂等。
- 只有未决降级可以被后续降级选择替换并取得更高 `change_version`。已有 purchase/upgrade 正在 `awaiting_payment` 时，新的换档请求返回原 intent 状态和付款入口，不创建第二个升级，也不静默替换目标套餐。
- 同 rank、余额降级、grace 换档、非当前 binding 操作均在调用 Stripe 前拒绝。
- Stripe 成功、本地响应断开时，客户端重试得到同一 intent 状态。

## 11. 钱包页设计

本次会话已确认的钱包页视觉稿位于 `C:\Users\11247\.codex\visualizations\2026\07\22\019f87c8-6599-7c93-9435-681b3821821a\wallet-subscription-redesign.html`。该文件用于视觉复核；跨环境实施的可移植行为源以本节文字和 API capability 为准。

信息结构固定为：

1. 钱包统计和余额。
2. 唯一“当前套餐”卡片，展示套餐、额度进度、支付模式、续费/到期时间和状态。
3. 至多一条“下期将切换到”信息；不显示 active 订阅数量。
4. Stripe recurring 显示取消或恢复自动续费；余额一期显示“本期结束后到期”，不显示取消按钮。
5. Go/Pro/Max 套餐卡按 rank 显示“当前套餐”“立即升级”“下期降级”。
6. 升级弹窗明确选择 Stripe 自动续费或余额一期，并写明“立即开始新账期、旧剩余额度不保留、收取新套餐全价”。
7. 降级确认明确显示生效日期，并允许用最后一次选择替换预约。
8. 需要 3DS 时跳转 Stripe 托管付款页；页面返回后轮询 `GET /self`，不乐观发额度。
9. 保留钱包充值、邀请奖励和账单历史；订阅历史移至账单历史，不在当前套餐卡叠放多条 active 记录。
10. 所有新用户可见文案覆盖现有前端全部 locale，并登记静态 i18n keys。

## 12. 管理员行为

- 套餐表单新增 `tier_rank`，对启用的新生命周期套餐必填并实时校验唯一。
- 已被引用的生命周期关键字段只读；管理员通过新建套餐版本变更。
- 管理员给用户发放套餐时，如果用户已有 active/grace 合同则默认拒绝，不能默默叠加。需要替换时必须使用明确的 replace 操作和审计原因。
- 管理员立即失效当前 Stripe recurring 时先取消远端再结束本地；Stripe 失败则本地保留原状态。
- 历史 entitlement 可以查看但不能重新激活为第二条 current。
- Stripe recurring binding 禁止硬删除；仅允许终止和保留审计。

`max_purchase_per_user` 只统计用户主动完成的首次购买或升级进入该 plan，不统计自动续费；管理员发放是否计数沿用管理员操作的明确参数，默认不计。

## 13. 存量迁移与发布顺序

### 13.1 阶段一：加表与只读审计

1. 普通和 fast AutoMigrate 同时注册新表、字段和索引。
2. 给参与新套餐体系的 Go/Pro/Max 配置唯一 rank。
3. 上线只读审计任务，统计每个用户的 active entitlement、Stripe subscription、缺失 binding 和 group 状态。
4. 此阶段仍关闭新单合同写路径。

### 13.2 阶段二：安全回填

- 无 active subscription：不强制创建合同。
- 恰好一条 active entitlement 且 provider 可唯一验证：创建/复用合同，绑定该 entitlement 和 provider binding。
- 恰好一条余额或一期 entitlement：创建 `balance_one_period` 合同。
- 多条 active、多个 remote recurring、缺失 subscription ID、Customer + Price 不能唯一定位或 group 基线不明确：标记迁移冲突，不自动选“最高价”“最新”或“最高 rank”，也不自动取消远端收费。

迁移冲突用户在旧权益到期前保持原消费语义，并禁止进入新购买和换档入口，但不能失去止付能力。迁移期继续使用取消模块的 legacy precise-binding 视图，列出每一个已验证的 Stripe binding，允许用户对明确的 binding 取消或恢复自动续费；不得按用户、Customer 或套餐猜测目标。该 legacy 入口不创建新合同、不换档，只管理已经存在的远端 recurring。管理员必须明确选择保留合同、终止其他 recurring 并记录补偿方案。全量开启前迁移冲突必须归零，归零后用户界面才退化为唯一当前 binding。

### 13.3 阶段三：切换写路径

1. 短时间冻结订阅新购，执行最后增量审计。
2. 开启单合同 command service 和新 `GET /self`。
3. 所有旧支付入口改为调用 command service，禁止直接 `CreateUserSubscriptionFromPlanTx` 创建第二条 active。
4. 消费路径切换为合同 `current_entitlement_id`。
5. 开启 invoice/schedule webhook 和对账任务。
6. 解冻新购并观察支付、grant 去重、grace 和 provider drift 指标。

Schema 迁移是向前兼容的。写路径切换后不支持直接回滚到可叠加多订阅的旧代码；出现问题时关闭新购买和换档，保持 webhook/对账运行并向前修复。

## 14. 三数据库与并发要求

- `tier_rank` 使用 nullable 列兼容存量，并通过 `SubscriptionTierRankReservation` 保证启用套餐唯一；`grant_key`、`current_slot` 使用 nullable 列，使普通唯一索引可兼容存量和历史行。
- 不使用 PostgreSQL partial unique index、MySQL generated column 或 SQLite 专用 trigger。
- 普通 `migrateDB` 与 `migrateDBFast` 必须包含相同模型。
- SQLite 的 `SubscriptionPlan` 手工建表/补列逻辑同步加入 `tier_rank` 和索引。
- 所有用户写命令锁定或 CAS 更新合同；多节点正确性依赖数据库唯一约束、`change_version`、条件更新和 Stripe Idempotency Key，不依赖进程内 mutex。
- 并发购买时只有一个事务能占用合同 current slot；失败请求必须在创建 Stripe 对象前结束，或由明确 intent 对账取消多余 Checkout。

## 15. 安全、审计和可观测性

- 用户接口只暴露本地 contract/binding/intent ID，不暴露 Stripe subscription ID。
- 每次 provider 写入记录 user、contract、binding、intent、request ID、Stripe request ID、目标状态和结果。
- Customer、Price、subscription item、livemode、metadata 任一不匹配都停止本地发放并触发安全告警，绝不自动改绑。
- 指标至少覆盖：invoice paid 发放成功/重复、payment failed、grace 数量、换档成功/失败、schedule drift、补偿积压、binding 缺失和 `needs_attention` 数量。
- 日志不记录 Stripe webhook secret、完整支付凭证或不必要的原始 payload。

## 16. 测试矩阵

### 16.1 模型与迁移

- SQLite、MySQL、PostgreSQL 均能完成普通/fast migration。
- 每用户只能一条合同；每合同只能一个 current slot；grant key 唯一。
- nullable 字段实际写入 SQL `NULL`；空字符串/0 不会占用 `grant_key/current_slot/tier_rank` 语义。
- rank 唯一、已引用关键字段不可修改。
- 并发首次购买、并发余额扣款和并发换档只有一个合法结果。

### 16.2 首期与续费

- Checkout complete 与 invoice paid 任意顺序只创建一份首期额度。
- Checkout 创建失败、结果未知查回、Session expired 和 async payment failed 都释放未决 purchase；有效 Session 的相同/不同 request ID 均复用原 pay link，过期后新 request ID 可重新购买。
- 正常续费创建新快照、旧余额清零、完整发新额度。
- 重放 invoice paid 不重复发额度。
- 现有 API key 和新 key 都立即读取当前 entitlement。

### 16.3 升级

- Go 到 Pro、Pro 到 Max 立即收全价、anchor 重置、旧额度作废、新额度完整发放。
- Stripe 更新明确替换现有 item，subscription 仍是原 `sub_xxx` 且只有一个 item。
- 3DS 未完成前本地套餐不变；成功后切换；失败后保持原套餐。
- `pending_update_applied` 与 `pending_update_expired` 任意顺序、重放和延迟到达都收敛到 Stripe GET 的当前事实；expired 能恢复原降级 schedule。
- 有预约降级时升级成功清除预约，升级失败恢复原 schedule。
- Stripe recurring 升余额覆盖：已有 `cancel_at_period_end`、已有 pending schedule、open/past_due invoice 拒绝、schedule release 失败、cancel 超时、确认 active 后退款失败、确认 canceled 后本地写失败和 invoice collection reconciliation 失败。
- 同 rank 选择不创建订单或 provider 请求。

### 16.4 降级、取消和恢复

- 降级预约不改变当前额度；到期 paid 后才切换。
- 连续选择多个低档，最终 Stripe schedule 和本地只保留最后一次。
- 余额一期不能预约降级。
- 取消自动续费清除降级；恢复续当前套餐且不恢复旧降级。
- 取消只影响当前 binding，历史 binding 不被修改。

### 16.5 宽限

- 首次失败进入固定 72 小时，重复失败不延长。
- 宽限期间不发新额度，只消费旧剩余。
- 宽限内支付成功发新账期完整额度。
- 到期仍失败则远端停止重试、本地结束。
- 宽限到期取消与 invoice paid 并发时，不漏发已收款账期且不重复发放。

### 16.6 Webhook 和迁移冲突

- webhook 首次处理失败后状态为 `failed` 并返回非 2xx；重放能接管并最终完成。
- webhook 处理节点崩溃留下 `processing` 后，租约过期可由另一节点接管；仍在有效租约中的并发重复不能提前返回成功。
- 同 Event ID 不同 payload hash 触发告警且不执行业务。
- 首期 `invoice.paid` 早于 Checkout event 时只靠 Subscription metadata 也能完成订单、binding 和唯一额度。
- 多 active/multi-recurring 迁移冲突不会自动选主或自动取消；新购买/换档被阻止，但用户仍能精确取消每一个已验证 legacy binding。
- 冲突 resolver 选择保留 binding、终止其他 recurring、处理 group 和补偿后，才能生成唯一 current contract。

### 16.7 用户组

- `upgrade_group` 为空不改变 PLG group。
- 配置 group 时不创建新 group，只应用已有 group。
- Go -> Pro -> 合同结束恢复首次订阅前的 base group，不回退到 Go 中间组。
- 管理员在合同期间改 group 后，合同结束不覆盖管理员新值。

### 16.8 前端和 Stripe Test Clock E2E

- 钱包页只显示一个当前套餐和至多一个下期套餐。
- capability 正确控制升级、降级、取消和恢复按钮。
- Stripe Test Clock 覆盖首期、自动续费、立即升级、期末降级、取消/恢复、扣款失败三天宽限和自然终止。
- 测试只在部署好的 Test/Sandbox 环境执行，不在用户本地启动服务。
- 沙箱 recurring 套餐固定为：Go rank 10 / `price_1TvreNP2QP4PXU8SWi955hYq`，Pro rank 20 / `price_1Tvrf7P2QP4PXU8SByn7xmLj`，Max rank 30 / `price_1Tvrg4P2QP4PXU8SY41cJt25`。
- 使用上述 Price 验证 USD、JPY、BRL、INR Checkout、同 subscription 唯一 item、账期、额度和账单历史。
- 钱包充值继续使用沙箱 one-time Price `price_1Tvri3P2QP4PXU8Sbw5Me18U`、`price_1TvriyP2QP4PXU8S6kpEj65k`、`price_1Tvrk1P2QP4PXU8SrtZKfpYK`、`price_1TvrkpP2QP4PXU8S3U8AwlFT`、`price_1TvrlZP2QP4PXU8S34sNGTXO`，并验证它们只增加钱包余额，不创建 recurring 合同；随后用余额完成一期套餐测试。

## 17. 预计改动边界

后端主要涉及：

- `model/subscription.go` 及新的合同、binding、intent model 文件。
- `model/main.go` 的普通/fast/SQLite migration。
- Stripe Checkout、subscription update、schedule 和 webhook controller/service。
- 订阅重置、到期、宽限和对账任务。
- 用户/管理员 subscription API、后端 i18n 和 OpenAPI。
- 消费路径从 active 列表切换到合同 current entitlement。

前端主要涉及：

- `web/default/src/features/subscriptions` 的 schema、API 和管理弹窗。
- `web/default/src/features/wallet/components/subscription-plans-card.tsx` 及换档/取消确认组件。
- 全部 locale 与静态 i18n key 校验。

取消订阅分支已经实现或正在实现的 binding、webhook 去重、取消/恢复和 reconciliation 代码应作为共享基础合入，不能再创建第二套同名模型或独立状态源。

## 18. 完成标准

- 任意用户在正常写路径下不可能获得两个 current entitlement 或两个当前 recurring binding。
- Stripe 首期和每次续费只按 paid invoice 发放一次完整额度。
- 升级、降级、取消、恢复、余额一期和三天宽限均符合第 2 节规则。
- Stripe 与本地发生部分失败时有可重试 intent 和明确补偿，不靠人工猜测最终状态。
- 钱包页只展示一个当前套餐，用户能自助管理唯一 Stripe recurring。
- 旧多订阅数据在全量开放前完成收敛，冲突记录不被自动误绑或误取消。
- SQLite、MySQL、PostgreSQL 的迁移、唯一约束和并发测试通过。
- 未配置 `upgrade_group` 时明确保留原用户组；配置时连续换档不会错误回退到中间组。
