# Stripe 自动续费订阅实现说明

## 范围

- 第一阶段仅支持 Stripe 自动续费；支付宝自动续费不在本次范围内。
- 套餐按 `billing_mode` 拆分为 `one_time` 与 `auto_renew`，不在支付弹窗内让用户选择扣费方式。
- 每个用户同一时间最多持有一个未结束的自动续费合约（**跨支付方全局互斥**，为后续支付宝周期扣款预留）；设置到期取消的当前周期仍计为未结束。
- `web/classic` 已支持自动续费套餐发起 Stripe Checkout、显示合约状态和到期取消续费，管理端可配置 `billing_mode` 与 `stripe_recurring_price_id`。
- `web/default` 本期未同步。默认前端采用独立的 React 19/Base UI 技术栈，需在后续专门的 UI 任务中按其组件和 i18n 约定实现，避免在本次 Stripe 后端功能中引入未验证的跨前端改动。
- 支付宝自动续费设计见 `docs/development/2026-07-13-alipay-auto-renew-design.md`。模型层已 provider 泛化；Phase 1 已提供签约入口、notify 绑定、首期扣款与解约（需开通周期扣款产品并配置 `AlipayCyclePay*`）。

## 生命周期

- Stripe Checkout 的 `checkout.session.completed` 创建或更新本地 `BillingSubscription` 合约。
- 创建 Stripe Checkout 前会先写入或复用 `BillingSubscription(status=pending_signup)`，以本地签约参考号关联 Checkout metadata；同一用户对同一套餐的重复点击会复用 pending 行并重新创建 Checkout Session。超过 48 小时的 `pending_signup` 会在下次发起时标记为 `signup_expired`。
- 签约回调补齐 Stripe subscription ID 后，会立刻履约所有 `pending_contract` 发票（`CompleteStripeAutoRenewSignupAndFulfill`）。Checkout 创建失败会把**新创建**的 pending 记录标记为 `signup_failed`；复用中的 pending 保持可重试。
- `checkout.session.completed` 只会将 `pending_signup` 或 `signup_failed` 推进到 `pending_first_charge`。同一 Checkout 的重放不会降级 `active`、`trialing`、`past_due` 或 `canceled` 合约。
- `checkout.session.expired`（`mode=subscription`）将对应 pending 标记为 `signup_expired`，释放互斥。
- `invoice.paid` 为每个支付周期创建一条新的 `UserSubscription`；以 Stripe invoice ID 幂等，配额消费逻辑继续复用现有订阅机制。权益、扣款记录和 `BillingSubscription` 的 `active` 状态、当前周期、最后发票及支付状态在同一事务中同步；因此 `invoice.paid` 早于 Checkout 完成时，补偿履约也会完整更新合约。
- 每张 Stripe invoice 都对应一条 `RecurringChargeAttempt`。`invoice.paid` 会在同一事务中标记尝试为 `paid` 并创建权益；`invoice.payment_failed` 必须带 invoice id，记录 `failed` 尝试并将合约标记为 `past_due`；若同 invoice 已是 `paid` 则不降级。
- Webhook handler 失败返回 **HTTP 500**，以便 Stripe 重试；业务键幂等保证重放安全。
- `customer.subscription.updated` 同步 `cancel_at_period_end`、周期与状态，不会重开 `canceled` 合约，也不会把已生效合约降为 `incomplete`。
- 非空的 Stripe subscription ID、signup reference 和 invoice ID 均通过可空唯一键列受到数据库约束；可空列允许多个 `pending_signup` 记录保留空 subscription ID，并在启动迁移时回填历史记录。
- `customer.subscription.deleted` 将合约标记为 `canceled`。
- 用户的取消续费操作调用 Stripe 的 `cancel_at_period_end`，当前周期权益保留至 `current_period_end`。
- Stripe webhook 接收只要求 `StripeWebhookSecret`，不依赖普通充值使用的 `StripePriceId`；因此仅配置自动续费套餐的实例也能正常履约。

## 支付保护

`auto_renew` 套餐会被 Stripe 一次性支付、Epay、支付宝和 Creem 的一次性入口拒绝，防止生成无法正确履约的 `SubscriptionOrder`。自动续费套餐只允许进入 Stripe recurring checkout。

## 验证

后端聚焦测试只在 `new-api-devtools` 容器环境中执行。classic 生产构建完成模块转换后，因现有依赖 `pdfjs-dist/build/pdf.mjs` 无法解析失败；该模块位于与本次改动无关的 `src/helpers/playgroundPdfExtract.js`。

仓库的全量 Go 测试还有本功能前已存在的失败：根包缺少 `web/classic/dist` 嵌入目录，以及 `relay/channel/claude` 与 `service/channel_affinity_usage_cache_test.go` 的失败。本次未将它们归因于自动续费实现。
