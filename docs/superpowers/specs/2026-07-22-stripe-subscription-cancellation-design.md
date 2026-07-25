# Stripe recurring 取消与恢复闭环设计

- 状态：已批准
- 日期：2026-07-22
- 基线：`SolveaCX/new-api` PR #462，head `575f2afca1abb61b40e5cc95572d0377a67d8d31`

## 1. 目标

为 Stripe Checkout `subscription` 模式创建的 recurring 补齐取消、恢复和管理员立即失效闭环，同时保持以下产品语义：

- 用户在 NewAPI 套餐页管理自动续费，不跳转 Stripe Customer Portal。
- 正常订阅取消时向 Stripe 设置 `cancel_at_period_end=true`。
- 已支付的当前周期继续使用，到 `current_period_end` 才结束权益。
- 到期前可以恢复自动续费，即设置 `cancel_at_period_end=false`。
- `past_due` 三天宽限期内用户主动取消是例外：立即取消远端 recurring、停止失败账单自动重试、立即结束本地权益。
- 管理员对 Stripe recurring 执行“立即失效”时，必须先成功立即取消 Stripe 远端，再停止本地权益。
- 管理员对非 Stripe recurring 的本地订阅继续只做本地立即失效。
- 仅 Stripe 支付创建且具有非空 Stripe subscription ID 的 recurring 可以进入用户取消或恢复流程。

本设计只解决取消与恢复。整体 recurring 续费、换档和套餐叠加策略暂不在本设计中决策。

## 2. 已确认的现状与问题

PR #462 已使用 Stripe Checkout `mode=subscription`，但支付完成后的处理仍按一次性订单实现：

- Checkout 通过 `client_reference_id` 关联本地订单。
- `checkout.session.completed` 调用 `CompleteSubscriptionOrder`。
- 本地创建一条固定 `start_time/end_time` 的 `UserSubscription`。
- `SubscriptionOrder` 和 `UserSubscription` 均未保存 Stripe subscription ID。
- webhook 未处理 `customer.subscription.updated` 或 `customer.subscription.deleted`。
- 用户侧没有取消或恢复接口。
- 管理员失效只更新本地状态，不会停止 Stripe 后续扣款。

当前代码还允许一个用户持有多个订阅。同一个 Stripe Customer 下可能同时存在多个独立的 Stripe subscriptions，因此 Customer ID、套餐 ID、用户 ID、“最高价当前套餐”或最近创建时间都不能作为取消目标。

## 3. 设计原则

### 3.1 支付合约与用量权益分离

Stripe subscription 是跨多个账期长期存在的支付合约；`UserSubscription` 是本地用量权益。二者生命周期不同，不能假定永久一对一。

新增独立 provider binding 表作为稳定合约标识。取消和恢复操作绑定 provider 合约；续费模块以后可以选择延长原权益或为新账期创建新权益，而无需重做取消接口。

### 3.2 精确绑定，不做推断

所有用户操作和 webhook 更新必须通过：

```text
(provider, provider_subscription_id)
```

精确定位合约。Customer ID 和 Price ID 只用于一致性校验，不能用于选择操作对象。

### 3.3 Stripe 是远端续费意图的权威源

`provider_status`、`cancel_at_period_end`、`current_period_start` 和 `current_period_end` 以 Stripe subscription snapshot 为准。

取消接口不能先把本地权益改成取消后再调用 Stripe。正常流程必须先完成 Stripe 操作，再保存 Stripe 返回的权威状态；webhook 和对账任务负责修复跨系统写入间隙。

### 3.4 多节点和跨数据库安全

正确性不能依赖进程内锁或单节点事件顺序。实现必须使用数据库唯一约束、事务、条件更新、Stripe Idempotency Key 和 webhook Event ID 去重，并同时兼容 SQLite、MySQL 与 PostgreSQL。

## 4. 数据模型

### 4.1 `SubscriptionProviderBinding`

新增 provider-neutral 的 recurring 合约表：

| 字段 | 类型语义 | 说明 |
|---|---|---|
| `id` | 本地主键 | 用户接口只暴露此 ID，不暴露 `sub_xxx` |
| `user_id` | 用户 ID | 普通索引 |
| `plan_id` | 初始套餐 ID | 显示和校验使用，不能作为操作目标 |
| `initial_order_id` | 首期订单 ID | 关联创建该合约的 `SubscriptionOrder` |
| `provider` | `stripe` | 为未来 provider 保留统一边界 |
| `provider_subscription_id` | `sub_xxx` | 与 provider 组成复合唯一约束 |
| `provider_customer_id` | `cus_xxx` | 普通索引，仅用于一致性校验 |
| `provider_price_id` | `price_xxx` | 首期契约快照和一致性校验 |
| `provider_latest_invoice_id` | `in_xxx` | Stripe 当前 latest invoice，用于 `past_due` 取消与账单收集校验 |
| `provider_status` | Stripe 原始状态 | `active/past_due/canceled/unpaid/...` |
| `cancel_at_period_end` | 布尔值 | 待到期取消意图 |
| `current_period_start` | Unix 秒 | Stripe 当前账期开始 |
| `current_period_end` | Unix 秒 | Stripe 当前账期结束，普通索引 |
| `grace_period_end` | Unix 秒 | 与续费失败模块共享；无宽限为 0 |
| `canceled_at` | Unix 秒 | Stripe snapshot 字段 |
| `ended_at` | Unix 秒 | Stripe snapshot 字段 |
| `livemode` | 布尔值 | 防止 test/live 环境串单 |
| `last_synced_at` | Unix 秒 | 最后一次权威同步时间 |
| `created_at` | Unix 秒 | 本地审计字段 |
| `updated_at` | Unix 秒 | 本地审计字段 |

约束：

- `(provider, provider_subscription_id)` 复合唯一。
- 不建立 `user_id` 或 `plan_id` 唯一约束，因为当前产品允许多份订阅并存。
- 不使用 partial index、数据库特定 JSON 类型或数据库特定 upsert SQL。
- 同一 provider subscription ID 若已绑定另一用户、订单或套餐，视为永久安全错误并告警，绝不自动改绑。

### 4.2 `UserSubscription`

新增：

```text
provider_binding_id bigint, default 0, index
```

语义：

- Stripe recurring 权益指向对应 binding。
- Free、余额购买、管理员发放、epay、Creem、Waffo 等保持 `0`。
- 未来一份 recurring 合约可以关联多期权益记录，因此 `provider_binding_id` 不是唯一字段。

### 4.3 `PaymentWebhookEvent`

新增通用 webhook 事件审计与去重表：

| 字段 | 说明 |
|---|---|
| `provider` + `event_id` | 复合唯一 |
| `event_type` | Stripe Event Type |
| `provider_object_id` | subscription ID 等主对象 ID |
| `event_created` | Stripe Event 创建时间 |
| `status` | `processing/processed/failed` |
| `attempt_count` | 本地处理次数 |
| `payload_hash` | 原始 payload 哈希，不存完整敏感 payload |
| `last_error` | 最近错误摘要 |
| `processed_at` | 完成时间 |
| `created_at/updated_at` | 本地时间 |

事件表负责审计和跨节点去重，但业务状态转换本身仍须幂等，不能把 Event ID 表当作唯一正确性保障。

## 5. 首期开通与 binding 建立

虽然本设计不实现续费，但取消闭环要求首期支付时可靠保存 Stripe subscription ID。

### 5.1 Checkout metadata

创建 Checkout Session 时同时设置：

```text
Session.Metadata:
  newapi_trade_no
  newapi_user_id
  newapi_plan_id

SubscriptionData.Metadata:
  newapi_trade_no
  newapi_user_id
  newapi_plan_id
```

Session metadata 用于首期排障；Subscription metadata 长期保留在 recurring 对象上，用于 webhook 归属判断和缺失 binding 修复。

### 5.2 首期完成顺序

`checkout.session.completed` 或异步支付成功后：

1. 从 Checkout Session 事件读取 `subscription=sub_xxx`。
2. 若 subscription ID 为空，不发放本地权益，返回可重试错误并告警。
3. 调用 Stripe `subscription.Get(sub_xxx)` 获取权威 snapshot。
4. 校验 Customer、Price、livemode 和 metadata 均与本地订单一致。
5. 在一个数据库事务中完成：
   - 本地订单置成功；
   - 幂等创建或校验 `SubscriptionProviderBinding`；
   - 创建首期 `UserSubscription`；
   - 设置 `provider_binding_id`；
   - 以 Stripe `current_period_start/end` 覆盖本地权益起止时间。

`CompleteSubscriptionOrder` 需要支持返回创建的权益并接收 provider snapshot，或增加共享的内部事务函数。订单已经 success 时不能直接跳过 binding 校验；webhook 重放必须能够补齐“订单和权益已成功、binding 缺失”的部分状态。

## 6. 状态机

本地权益状态与 provider 合约状态分开保存。

### 6.1 正常自动续费

```text
provider_status=active
cancel_at_period_end=false
UserSubscription.status=active
```

前端显示“自动续费中”和下次续费时间。

### 6.2 正常取消

```text
用户点击取消
  -> Stripe Update(cancel_at_period_end=true)
  -> provider_status 仍为 active
  -> cancel_at_period_end=true
  -> UserSubscription.status 仍为 active
  -> UserSubscription.end_time 对齐 current_period_end
```

前端显示“将在指定日期到期”。取消请求不能清空额度、提前降级用户组或立即把权益改为 `cancelled`。

### 6.3 恢复自动续费

```text
用户点击恢复
  -> Stripe Update(cancel_at_period_end=false)
  -> cancel_at_period_end=false
  -> 本地权益保持 active
```

只有 Stripe subscription 尚未进入终态且当前时间早于有效期结束时可以恢复。已经 `canceled/ended` 的订阅不能恢复，用户需要重新购买。

### 6.4 `past_due` 宽限期内主动取消

已批准的例外语义：

```text
provider_status=past_due 且 grace_period_end > now
用户点击取消
  -> Stripe subscription.Cancel(...)
  -> InvoiceNow=false
  -> Prorate=false
  -> Stripe 停止失败账单的自动收集/重试
  -> 校验目标失败 invoice 的 auto_advance=false
  -> 修复同 Customer 下其他 NewAPI active recurring 的 invoice 自动收集状态
  -> binding 进入 canceled/ended
  -> grace_period_end 清零
  -> 本地权益立即 cancelled，end_time 截到当前时间
```

此分支不使用 `cancel_at_period_end=true`，因为已支付周期已经结束，继续保留 recurring 可能导致用户取消后仍被失败账单重试扣款。

现有失败 invoice 保留为 Stripe 账务审计记录；本设计不删除、作废或退款历史 invoice。

Stripe 官方取消文档与 stripe-go v81.4.0（API version `2025-02-24.acacia`）明确说明：立即取消 subscription 会暂停 finalized invoice 的自动收集；SDK 注释将该影响描述为 Customer 范围，而不仅是被取消的 subscription。由于当前代码允许同一个 Customer 下存在多份 recurring，实现不能假定取消 Go 只影响 Go 的 invoice。

因此立即取消以及到期产生 `customer.subscription.deleted` 后都必须执行 invoice collection reconciliation：

1. 只扫描该 Customer 下能够通过 subscription ID 精确映射到 NewAPI binding 的 open/draft invoice。
2. 目标被取消 binding 的失败 invoice 必须保持 `auto_advance=false`，确保不再自动重试。
3. 其他仍为 active、`charge_automatically` 的 NewAPI binding，其 invoice 若被本次取消连带暂停，则恢复 `auto_advance=true`。
4. 无法映射到 NewAPI binding 的 invoice 不自动修改，只告警，避免影响同 Stripe 账户中的无关账务。
5. 恢复其他 invoice 失败时记录待修复状态并由对账任务重试；不得把其他 recurring 错误地标记为取消。

官方依据：

- [Stripe：Cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel)
- [Stripe API：Cancel a subscription](https://docs.stripe.com/api/subscriptions/cancel)

### 6.5 自然到期

`customer.subscription.deleted` 到达时：

- binding 进入终态。
- 若 `ended_at` 等于或晚于已付 `current_period_end`，本地权益标记为 `expired`。
- 若 Stripe Dashboard 或管理员在周期中立即终止，权益标记为 `cancelled`，`end_time` 截到实际结束时间。
- 只处理该 binding 关联的权益，不影响同用户其他订阅。

本地到期任务仍可在 `end_time` 到达后先标记 `expired`，作为 webhook 延迟时的安全兜底；后续 webhook 或对账同步必须是幂等的。

## 7. 用户 API

新增：

```text
POST /api/subscription/self/recurring/:binding_id/cancel
POST /api/subscription/self/recurring/:binding_id/resume
```

路由使用 `UserAuth` 和 `CriticalRateLimit`。

### 7.1 可管理性校验

调用 Stripe API 前必须同时满足：

1. binding 存在且 `binding.user_id` 等于当前登录用户。
2. `binding.provider == stripe`。
3. `binding.provider_subscription_id` 非空且以 Stripe subscription ID 形式存在。
4. 首期本地订单 `payment_provider == stripe`。
5. 首期本地订单 `payment_method == stripe`。
6. binding 与当前本地权益关系有效。
7. Stripe snapshot 返回的 subscription ID、Customer 和 livemode 与本地一致。

余额购买、管理员发放、Free、epay、Creem、Waffo Pancake，以及任何 provider/payment method 不匹配或缺失 Stripe subscription ID 的记录，均不得进入取消或恢复 Stripe API。

### 7.2 精确目标

接口只接受本地 `binding_id`。禁止使用以下字段选择 Stripe subscription：

- `user_id`
- `plan_id`
- `provider_customer_id`
- `UserSubscription.id`
- 页面 `current_subscription`
- 最高价格套餐
- 最近创建记录

例如同一 `cus_123` 下存在 `sub_go` 与 `sub_pro`，取消 Go 时必须通过 Go 的 binding 精确更新 `sub_go`，Pro 不发生任何状态变化。

### 7.3 Stripe 调用

正常取消：

```go
subscription.Update(providerSubscriptionID, &stripe.SubscriptionParams{
    CancelAtPeriodEnd: stripe.Bool(true),
})
```

恢复：

```go
subscription.Update(providerSubscriptionID, &stripe.SubscriptionParams{
    CancelAtPeriodEnd: stripe.Bool(false),
})
```

`past_due` 主动取消使用立即取消：

```go
subscription.Cancel(providerSubscriptionID, &stripe.SubscriptionCancelParams{
    InvoiceNow: stripe.Bool(false),
    Prorate:    stripe.Bool(false),
})
```

每次 Stripe 写请求设置确定性 Idempotency Key，至少包含：

```text
binding_id + desired_action + current_period_end
```

重复设置同一目标状态应直接返回当前状态，不重复产生外部副作用。

### 7.4 响应

成功响应遵循现有 `common.ApiSuccess`：

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 17,
    "plan_id": 2,
    "provider": "stripe",
    "provider_status": "active",
    "cancel_at_period_end": true,
    "current_period_end": 1787414400,
    "can_cancel": false,
    "can_resume": true
  }
}
```

API 不返回真实 Stripe subscription ID。

### 7.5 错误语义

遵循当前项目的业务响应约定：鉴权通过后的业务错误使用 HTTP 200、`success=false` 和后端 i18n message；鉴权失败仍由 middleware 返回对应 HTTP 状态。

| 条件 | 外部语义 | 是否调用 Stripe |
|---|---|---|
| `binding_id` 非法 | 参数错误 | 否 |
| binding 不存在或不属于当前用户 | 统一返回“订阅不存在”，避免泄漏其他用户记录 | 否 |
| provider 不是 Stripe | “该订阅不支持 Stripe 自动续费管理” | 否 |
| 本地 payment provider/method 不是 Stripe | “该订阅不支持 Stripe 自动续费管理” | 否 |
| Stripe subscription ID 为空 | “订阅支付绑定不完整，请联系支持”并告警 | 否 |
| 取消已处于待到期取消 | 幂等成功，返回当前状态 | 可不调用 |
| 恢复已处于自动续费 | 幂等成功，返回当前状态 | 可不调用 |
| 恢复终态 subscription | “订阅已结束，无法恢复” | 否 |
| Stripe 对象与 Customer/livemode 不匹配 | 通用操作失败并触发安全告警 | 不继续写本地 |
| Stripe 暂时不可用或超时 | 先 GET 对账；目标状态已生效则成功，否则返回稍后重试 | 视对账结果 |
| Stripe 成功、本地写失败 | 返回操作处理中/稍后刷新，依赖 webhook 与对账修复 | 已调用 |

错误文案必须加入后端 en/zh i18n；前端 toast 使用响应 message，不硬编码中文。

## 8. Webhook

新增事件：

- `customer.subscription.updated`
- `customer.subscription.deleted`

### 8.1 `customer.subscription.updated`

Stripe 事件可能重复或乱序。处理器不直接用事件 payload 覆盖本地，而是：

1. 读取事件中的 subscription ID。
2. 通过 `(stripe, subscription_id)` 查 binding。
3. 若属于 NewAPI，调用 `subscription.Get` 获取当前权威 snapshot。
4. 在数据库事务中应用 snapshot。

这样即使“取消”事件在用户恢复后才送达，GET 得到的仍是当前 `cancel_at_period_end=false`，不会把本地状态回滚成待取消。

### 8.2 `customer.subscription.deleted`

删除事件是终态：

- 幂等写入 binding 终态。
- 结束该 binding 对应的权益。
- 执行已有用户组回退逻辑，但必须继续尊重同用户其他有效升级订阅。
- 终态完成后忽略迟到的非终态 snapshot。

### 8.3 未知对象

- binding 不存在，但 metadata 表明是 NewAPI 管理的 subscription：按 `newapi_trade_no` 尝试补建；依赖失败时返回 500 让 Stripe 重试并告警。
- binding 不存在且没有 NewAPI metadata：视为同 Stripe 账户中的无关对象，记录后返回 200，避免无限重试。
- provider subscription ID 已绑定到另一用户或订单：永久安全错误，拒绝改绑并告警。

### 8.4 webhook 返回码

- 签名错误：400。
- 数据库或 Stripe 依赖的临时错误：500，让 Stripe 重试。
- 确认无关事件：200。
- 永久不合法且重试无法修复：200 并告警。

## 9. 管理员立即失效

现有管理员 `invalidate` 语义保留“立即停止权益”，但按来源分支。

### 9.1 Stripe recurring

1. 读取精确 binding 并验证 provider、payment provider/method 与 subscription ID。
2. 调用 Stripe `subscription.Cancel`，`InvoiceNow=false`、`Prorate=false`。
3. Stripe 成功返回 canceled 后，执行 invoice collection reconciliation：被取消 binding 的 invoice 保持停止收集，其他 active NewAPI recurring 的 invoice 恢复正常自动收集。
4. 在本地事务中把 binding 和权益置为终态。
5. Stripe 调用失败或状态不确定时，不先停止本地权益；GET 对账后决定。

这样避免“本地已失效但 Stripe 下月继续扣款”。

### 9.2 非 Stripe recurring

Free、余额购买、管理员发放、epay、Creem、Waffo 等继续只做本地立即失效，不调用 Stripe。

### 9.3 删除保护

存在 provider binding 的 recurring 历史不得硬删除，否则 Stripe webhook 和账务对账会失去路由依据。管理员 UI 对 recurring 隐藏或禁用 Delete，改为“立即终止并失效”。

如果未来确实需要只停本地、不碰 Stripe 的抢险操作，必须新增显式 root-only `force_local` 操作，要求原因并写审计日志；本设计不实现该能力。

## 10. 前端

### 10.1 自助数据

`GET /api/subscription/self` 新增：

```text
recurring_subscriptions: []
```

每项至少包含：

- 本地 binding ID
- `plan_id` 与套餐标题
- provider
- provider status
- `cancel_at_period_end`
- `current_period_end`
- `grace_period_end`
- `can_cancel`
- `can_resume`

后端计算 capability，前端不得仅凭 `source` 或标题猜测是否可管理。

### 10.2 按钮可见性

“取消自动续费”或“恢复自动续费”仅在以下条件全部满足时显示：

- `provider == stripe`
- 后端返回可管理 recurring binding
- Stripe subscription ID 在后端绑定完整，但真实 ID 不下发前端
- 首期 provider/payment method 已由后端验证为 Stripe
- subscription 尚未进入终态

以下记录不显示任何 Stripe 取消/恢复按钮：

- Free
- 余额购买
- 管理员发放
- epay
- Creem
- Waffo Pancake
- provider/payment method 不匹配
- binding 缺失或 Stripe subscription ID 缺失

### 10.3 多订阅展示

不能只给 `current_subscription` 增加按钮。该字段只表示页面用于展示的最高价当前套餐，其他 Stripe recurring 仍可能继续扣款。

钱包套餐区必须列出所有可管理 recurring：

- 自动续费中：显示“下次续费：日期”和“取消自动续费”。
- 待到期取消：显示“将在日期到期，期间仍可使用”和“恢复自动续费”。
- `past_due`：显示宽限截止时间；取消确认明确“将立即停止权益并停止扣款重试”。
- 多份 recurring：每份独立操作，确认弹窗明确只影响选中的套餐。

请求期间禁用对应按钮。成功后刷新 `GET /api/subscription/self`，不在浏览器里乐观拼装 Stripe 状态。

### 10.4 管理员 UI

用户订阅管理表增加 provider recurring 状态：

- Stripe recurring 显示 Stripe 状态和是否待取消。
- Invalidate 文案明确“将立即取消 Stripe 自动续费并停止权益”。
- Stripe recurring 禁止 Delete。
- 非 Stripe 订阅继续显示本地失效语义。

所有新增用户可见文案同步八种前端语言，并登记非字面使用的 static keys。

## 11. 幂等、乱序与失败恢复

### 11.1 API 幂等

- 取消和恢复都是“设置目标状态”，重复请求返回同一结果。
- Stripe 写请求使用确定性 Idempotency Key。
- 本地 snapshot 更新按 binding 行事务化。

### 11.2 webhook 幂等

- `(provider, event_id)` 唯一约束去重事件。
- `(provider, provider_subscription_id)` 唯一约束去重合约。
- 重复 `updated` 应覆盖相同 snapshot。
- 重复 `deleted` 应为终态 no-op。
- Checkout 重放可补齐 binding，但不能重复发权益。

### 11.3 乱序

- `updated` 事件处理前重新 GET 当前 Stripe subscription。
- `deleted` 终态具有优先级，后续非终态事件不能复活它。
- 不以进程接收顺序或 `event.created` 单独决定状态覆盖。

### 11.4 跨系统失败

- Stripe 成功、本地失败：返回可重试结果；Stripe webhook 和对账任务补写。
- Stripe 超时、结果未知：GET subscription 对账后再响应。
- 本地成功、HTTP 响应断开：客户端重试同一目标状态，幂等返回。
- webhook 本地写失败：返回 500。

### 11.5 定时对账

新增仅 master node 运行的 reconciliation task，定期扫描非终态 binding，并通过 Stripe GET 核对：

- 本地 active、Stripe canceled。
- 本地待取消、Stripe 已恢复。
- 本地已失效、Stripe 仍 active。
- Customer、Price 或 livemode 不一致。
- Stripe subscription 无法查询。
- binding 缺失的 NewAPI metadata subscription。
- 被取消 binding 的失败 invoice 仍在自动收集。
- 同 Customer 下其他 active NewAPI recurring 的 invoice 被取消动作连带暂停自动收集。

对账写入使用数据库事务和条件更新。master-node 限制减少重复外部请求，但数据库唯一约束和幂等转换仍是正确性保障。

## 12. 迁移与存量数据

### 12.1 数据库迁移

- `SubscriptionProviderBinding` 与 `PaymentWebhookEvent` 注册到普通和 fast AutoMigrate。
- `UserSubscription.provider_binding_id` 由 GORM 添加，默认 0。
- 所有索引和字段使用 SQLite/MySQL/PostgreSQL 共同支持的类型。
- 部署先完成 schema migration，再开放用户取消入口。

### 12.2 已存在 Stripe recurring 的回填

现有记录没有 subscription ID，数据库迁移无法凭本地字段可靠推断。

回填顺序：

1. 优先重放近期 `checkout.session.completed`，从 Session 的 `subscription` 字段建立 binding。
2. 或按本地订单查对应 Checkout Session，再读取其 subscription。
3. 仅凭 Customer + Price 不能自动绑定；同一 Customer 可有多份相同 Price recurring。
4. 无法唯一确认的记录标记“绑定不完整”，用户按钮隐藏，交由人工核对。

在回填完成前不得允许用户取消一个推断出的 Stripe subscription。

## 13. 后端与前端改动面

预计实现文件：

后端：

- `model/subscription_recurring.go`
- `model/subscription.go`
- `model/main.go`
- `controller/subscription_payment_stripe.go`
- `service/stripe_subscription_lifecycle.go`
- `controller/subscription_stripe_lifecycle.go`
- `controller/topup_stripe.go`
- `router/api-router.go`
- `service/subscription_reconciliation_task.go`
- `main.go`
- `i18n/locales/en.yaml`
- `i18n/locales/zh-CN.yaml`
- `docs/openapi/api.json`

前端：

- `web/default/src/features/subscriptions/types.ts`
- `web/default/src/features/subscriptions/api.ts`
- `web/default/src/features/wallet/components/subscription-plans-card.tsx`
- 新增钱包取消确认组件
- `web/default/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx`
- `web/default/src/i18n/static-keys.ts`
- `web/default/src/i18n/locales/*.json`

测试：

- `model/subscription_recurring_test.go`
- `service/stripe_subscription_lifecycle_test.go`
- Stripe webhook controller tests
- 钱包 recurring 管理组件 tests

## 14. 测试与验收矩阵

### 14.1 模型与服务测试

- 首期完成原子创建订单、binding 和权益。
- Checkout 重放不重复创建权益，能补齐缺失 binding。
- 同一 provider subscription ID 不能绑定两个用户。
- 同一用户可有多个不同 provider subscription IDs。
- 正常取消不改变本地 active 权益或已用额度。
- 恢复只清除到期取消意图。
- `past_due` 取消立即结束远端与本地权益并清除宽限。
- `past_due` 取消后目标失败 invoice 停止自动重试，其他 active recurring 的 invoice 自动收集不受影响。
- `deleted` 重放不重复失效或降组。
- 迟到 `updated` 不能复活终态 binding。
- Stripe 成功、本地事务失败后可由 webhook 或对账修复。

### 14.2 用户 API 正向测试

- Stripe recurring 正常取消。
- 待取消 Stripe recurring 正常恢复。
- 双击取消、双击恢复。
- 取消、恢复、再次取消。
- 同一 Customer 有 Go 与 Pro，取消 Go 不改变 Pro。
- 同一套餐有两份 recurring，只取消目标 binding。
- 用户不能操作其他用户的 binding。

### 14.3 用户 API 负例

以下每项都必须验证 Stripe mock 未被调用：

- `binding_id` 非法。
- binding 不存在。
- binding 属于其他用户。
- provider 为 Creem、Waffo 或其他非 Stripe。
- 初始订单 `payment_provider != stripe`。
- 初始订单 `payment_method != stripe`。
- 余额购买的订阅。
- 管理员发放的订阅。
- Free 订阅。
- epay 订阅。
- binding 的 Stripe subscription ID 为空。
- Stripe snapshot Customer 不匹配。
- Stripe snapshot livemode 不匹配。
- 已终态 subscription 尝试恢复。

### 14.4 webhook 测试

- 签名错误返回 400。
- 无关 Stripe subscription 事件返回 200。
- NewAPI metadata 事件缺本地订单时返回可重试错误。
- Event ID 重放只执行一次业务转换。
- 两节点并发处理同一 Event ID 不重复副作用。
- 取消事件晚于恢复事件到达时，以 Stripe GET 当前状态为准。
- `deleted` 后迟到 `updated` 不复活。

### 14.5 管理员测试

- Stripe recurring 远端立即取消成功后才停本地。
- Stripe 立即取消失败时本地保持 active。
- 管理员立即取消一份 recurring 不得暂停同 Customer 下其他 active recurring 的 invoice 自动收集。
- 非 Stripe 订阅失效不调用 Stripe。
- Stripe recurring 禁止硬删除。

### 14.6 前端测试

- 仅 Stripe recurring 显示取消或恢复按钮。
- Free、余额、admin、epay、Creem、Waffo 均不显示按钮。
- binding 不完整不显示按钮，并显示联系支持状态。
- 多 recurring 全部列出并操作精确 binding ID。
- 待取消显示正确日期与恢复按钮。
- `past_due` 确认文案明确立即失效与停止重试。
- 请求中按钮禁用，完成后重新拉取服务端状态。

### 14.7 Stripe Test Clock E2E

1. 同一 Customer 建立 Go 与 Pro 两份 recurring。
2. 取消 Go，验证只有 `sub_go.cancel_at_period_end=true`。
3. 恢复 Go，验证只有 `sub_go.cancel_at_period_end=false`。
4. 再次取消 Go并推进到周期末。
5. 验证 Go 不再生成下一期、Go 本地权益到期、Pro 保持自动续费。
6. 重放并乱序发送 subscription webhook，验证最终状态一致。
7. 构造 `past_due`，在宽限期取消，验证远端立即 canceled、失败账单不再自动重试、本地立即失效。
8. 验证目标失败 invoice `auto_advance=false`，同 Customer 下 Pro 等其他 active recurring 的 invoice 仍能自动收集。
9. 管理员立即失效 Stripe recurring，验证目标后续不再扣款且其他 active recurring 不受影响。

数据库集成验证覆盖 SQLite、MySQL 与 PostgreSQL 的 migration、唯一约束和并发条件更新。

## 15. 与 recurring 续费模块的接口边界

取消模块负责：

- provider binding 建立与读取。
- 用户取消和恢复。
- `past_due` 主动取消的立即终止。
- 管理员立即终止。
- `customer.subscription.updated/deleted`。
- provider 当前状态和 period snapshot 同步。

续费模块负责：

- `invoice.paid`。
- `invoice.payment_failed`。
- 每期额度重置、延长或新建权益。
- 三天宽限期的进入与自动结束。
- invoice ID 幂等和续费账单历史。

共享 model 接口：

```text
FindBindingByProviderSubscriptionID
CompleteOrderWithProviderBinding
ApplyProviderSubscriptionSnapshot
ApplyProviderSubscriptionTermination
FindActiveEntitlementsByBindingID
```

取消模块不创建新账期或发放额度。续费模块不得按 Customer、Plan 或“当前套餐”猜测 binding，也不得覆盖用户的取消意图。

## 16. 范围外事项

以下事项不属于本设计：

- `invoice.paid` 自动续费发放或延长权益的具体实现。
- `invoice.payment_failed` 宽限期任务的完整实现；这里只定义取消时的交界行为。
- 多档位叠加是否继续保留。
- 一个用户是否最多允许一个付费 recurring。
- 升级、降级、换档、proration 和 E2 结算。
- PLG 用户组折扣与新订阅折扣策略。
- Stripe Customer Portal。
- Creem、Waffo、epay 的远端 recurring 取消。
- 退款、按比例退款、撤销历史账单。
- 只停本地不取消远端的管理员抢险入口。

## 17. 完成标准

本设计实现完成必须同时满足：

- 用户能够从 NewAPI 套餐页精确取消或恢复任意一份 Stripe recurring。
- 正常取消不提前停止已付权益。
- `past_due` 主动取消立即停止远端重试和本地权益。
- 管理员失效不会遗留仍在扣款的 Stripe recurring。
- 非 Stripe 记录不会进入 Stripe API。
- 多订阅、重复请求、webhook 重放、乱序和多节点并发均不会取消错单或重复产生副作用。
- 三种数据库均可迁移并通过目标测试。
- 存量无法唯一回填的记录不会被猜测绑定。
