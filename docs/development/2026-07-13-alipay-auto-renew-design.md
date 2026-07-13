# 支付宝自动续费设计（基于 Stripe 自动续费骨架）

## 背景

`codex/stripe-auto-renew-subscription` 已落地：

- `BillingSubscription`：支付方合约
- `RecurringChargeAttempt`：周期扣款尝试（幂等）
- `UserSubscription`：周期权益（`source=auto_renew`）
- Stripe Checkout + webhook + classic 管理/购买/取消

支付宝订阅目前仅为**一次性** `page.pay` → `SubscriptionOrder`。自动续费不能再塞进该路径，应复用上述三层模型，新增 Alipay 适配与**商户主动扣款调度**。

## 目标

1. 用户对 `billing_mode=auto_renew` 套餐可用支付宝完成签约并自动续期。
2. 与 Stripe 共用权益与互斥语义，避免双开自动续费。
3. 扣款失败、解约、重试、幂等与 Stripe 同等安全水位。

## 非目标（本期）

- 微信周期扣费
- 改价后静默生效（支付宝通常需重新签约）
- `web/default` 完整 UI（可与 Stripe 二期一并做）

## 产品与支付差异

| | Stripe | 支付宝周期扣款 |
|--|--------|----------------|
| 扣款发起 | 支付方主动（invoice） | **商户主动**调扣款 API |
| 合约标识 | `subscription` id | `agreement_no` |
| 签约入口 | Checkout `mode=subscription` | `alipay.user.agreement.page.sign` 等 |
| 解约 | `cancel_at_period_end` | `alipay.user.agreement.unsign` |
| 周期边界 | invoice line period | **本地维护** `current_period_*` + 调度器 |

必须开通支付宝「周期扣款 / 委托代扣」类产品权限；与现有电脑网站支付不是同一能力。

## 决策（已定）

1. **全局互斥**：同一用户任意时刻最多 1 个未结束 auto_renew 合约（跨 Stripe/Alipay）。
2. **首期策略（MVP）**：签约成功后**立即发起首期扣款**，成功才发权益；仅签约未扣款不发权益。
3. **解约语义**：用户取消 → 调支付宝解约，本地 `cancel_at_period_end=true` 或按解约结果置 `canceled`；当前周期 `UserSubscription` 用到 `EndTime`。
4. **金额**：签约时按套餐 `PriceAmount × 汇率` 写入协议约束金额；改价需新签，不做静默改价。

## 模型映射

| 字段 | Stripe | Alipay |
|------|--------|--------|
| `provider` | `stripe` | `alipay` |
| `provider_subscription_id` | Stripe subscription id | `agreement_no` |
| `signup_reference` | Checkout metadata 参考号 | `external_agreement_no` |
| `provider_customer_id` | Stripe customer | `alipay_user_id`（可选） |
| `provider_checkout_id` | Checkout session id | 签约页/请求号（可选） |
| `provider_invoice_id`（attempt） | Stripe invoice id | 本地周期 `out_trade_no` |

状态复用：`pending_signup` → `pending_first_charge` / `active` → `past_due` → `canceled` / `signup_failed` / `signup_expired`。

履约：继续 `FulfillRecurringInvoice`（provider 无关）。

## 生命周期

```text
用户选择 auto_renew + 支付宝
  → pending_signup (external_agreement_no)
  → 跳转协议签约页

签约成功通知
  → 绑定 agreement_no
  → 发起首期扣款 (out_trade_no)
  → 成功: FulfillRecurringInvoice + active
  → 失败: past_due / pending_first_charge + 查单重试

周期调度器 (alipay only)
  → 扫描 active 且 current_period_end <= now（且未 cancel_at_period_end 到期）
  → 创建 RecurringChargeAttempt(pending) + 调扣款
  → 通知/查单成功 → Fulfill
  → 失败 → past_due + 退避

用户取消
  → agreement.unsign
  → cancel_at_period_end 或 canceled

支付宝解约通知
  → 本地 canceled（不重开）
```

## API 草案

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/subscription/alipay/checkout/auto-renew` | 创建/复用 pending，返回签约 URL |
| POST | `/api/subscription/alipay/notify` | 扩展：识别签约/扣款/解约（或拆子路径） |
| POST | `/api/subscription/self/cancel-renewal` | 已有；按 `provider` 分发到 unsign |

Admin 套餐：`billing_mode=auto_renew` 时可勾选启用支付宝自动续费；产品码/模板可全局配置（`setting`）或套餐级字段（后续）。

## 调度与补偿

- 新增轻量 job（可挂现有定时任务循环）：
  - 到点扣款
  - 查询 `pending` attempt
- 复用 `AlipayPendingTask` 思路：trade 级 next_query_at / 重试
- Webhook/notify 失败返回非 success，配合查单，避免只依赖单通道

## 幂等

| 键 | 用途 |
|----|------|
| `(provider, provider_subscription_id)` 可空唯一 | 合约 |
| `(provider, signup_reference)` 可空唯一 | 签约 |
| `(provider, provider_invoice_id)` | 扣款尝试 + 权益 |

与 Stripe 已落地规则一致：已 `paid` 不被 `failed` 降级；`canceled` 不被迟到成功重开。

## 前端

- classic：`auto_renew` 且启用支付宝时展示签约入口；有 Stripe+Alipay 时支付方式二选一
- 取消续费 UI 共用，文案按 provider 可不变
- default：二期

## 实施阶段

### Phase 0（已完成）— Provider 泛化

- 互斥 / 当前合约查询不绑死 `stripe`
- Signup create/reuse/complete/fulfill/expire API 支持 `provider` 参数
- Stripe 调用点改为传入 `PaymentProviderStripe` 的薄封装
- 文档明确支付宝后续挂载点

### Phase 1（进行中 / 骨架已合入本分支）— 签约 + 首期 MVP

- [x] `POST /api/subscription/alipay/checkout/auto-renew`
- [x] `service`：`AgreementPageSign` / `AgreementUnsign` / `TradePay`+agreement
- [x] 签约 notify 完成 `BillingSubscription` 绑定并尝试首期扣款
- [x] 交易 notify 履约 `aliar*` out_trade_no
- [x] 用户取消续费调用 `agreement.unsign`
- [x] classic：auto_renew + `plan.alipay_enabled` 显示支付宝入口
- [x] 系统配置：`AlipayCyclePayEnabled` / product codes / sign_scene
- [ ] 真实沙箱端到端验收（依赖商户开通周期扣款产品）
- [ ] 周期调度 worker（Phase 2）

### Phase 2 — 周期调度

- 到点扣款 worker
- 失败重试与 past_due
- 运营可观测（日志/管理端列表可选）

### Phase 3

- default 前端
- 对账与报表
- 协议变更/换绑（若业务需要）

## 风险

1. 商户未开通周期扣款产品 → 无法上线 Phase 1。
2. 主动扣款合规与文案（自动续费展示、取消入口）。
3. 汇率变动：协议金额以签约时快照为准。
4. 调度漏跑：必须有查单与补偿，不能只靠 notify。

## 验收（Phase 1）

- [ ] 签约成功有合约，首期成功有权益
- [ ] 同用户无法同时再开 Stripe/Alipay auto_renew
- [ ] 取消后续费不再扣；当期权益可用
- [ ] 同一 out_trade_no 重放不双发权益
- [ ] 放弃签约可重新发起（expired/failed）
