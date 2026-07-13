# Stripe 自动续费订阅实现说明

## 范围

- 第一阶段仅支持 Stripe 自动续费；支付宝自动续费不在本次范围内。
- 套餐按 `billing_mode` 拆分为 `one_time` 与 `auto_renew`，不在支付弹窗内让用户选择扣费方式。
- 每个用户同一时间最多持有一个未结束的 Stripe 自动续费合约；设置到期取消的当前周期仍计为未结束。
- `web/classic` 已支持自动续费套餐发起 Stripe Checkout、显示合约状态和到期取消续费。
- `web/default` 本期未同步。默认前端采用独立的 React 19/Base UI 技术栈，需在后续专门的 UI 任务中按其组件和 i18n 约定实现，避免在本次 Stripe 后端功能中引入未验证的跨前端改动。

## 生命周期

- Stripe Checkout 的 `checkout.session.completed` 创建或更新本地 `BillingSubscription` 合约。
- 创建 Stripe Checkout 前会先写入 `BillingSubscription(status=pending_signup)`，以本地签约参考号关联 Checkout metadata；签约回调补齐 Stripe subscription ID。Checkout 创建失败会把该记录标记为 `signup_failed`，允许用户重新发起。
- `invoice.paid` 为每个支付周期创建一条新的 `UserSubscription`；以 Stripe invoice ID 幂等，配额消费逻辑继续复用现有订阅机制。
- 每张 Stripe invoice 都对应一条 `RecurringChargeAttempt`。`invoice.paid` 会在同一事务中标记尝试为 `paid` 并创建权益；`invoice.payment_failed` 会记录 `failed` 尝试并将合约标记为 `past_due`。
- `customer.subscription.deleted` 将合约标记为 `canceled`。
- 用户的取消续费操作调用 Stripe 的 `cancel_at_period_end`，当前周期权益保留至 `current_period_end`。
- Stripe webhook 接收只要求 `StripeWebhookSecret`，不依赖普通充值使用的 `StripePriceId`；因此仅配置自动续费套餐的实例也能正常履约。

## 支付保护

`auto_renew` 套餐会被 Stripe 一次性支付、Epay、支付宝和 Creem 的一次性入口拒绝，防止生成无法正确履约的 `SubscriptionOrder`。自动续费套餐只允许进入 Stripe recurring checkout。

## 验证

后端聚焦测试只在 `new-api-devtools` 容器环境中执行。classic 生产构建完成模块转换后，因现有依赖 `pdfjs-dist/build/pdf.mjs` 无法解析失败；该模块位于与本次改动无关的 `src/helpers/playgroundPdfExtract.js`。

仓库的全量 Go 测试还有本功能前已存在的失败：根包缺少 `web/classic/dist` 嵌入目录，以及 `relay/channel/claude` 与 `service/channel_affinity_usage_cache_test.go` 的失败。本次未将它们归因于自动续费实现。
