# Flexible plan launch checklist

Updated: 2026-07-23

## Required before production traffic

- Enable Alipay, Pix, and UPI in the Stripe account used by Flatkey.
- Keep Pix prices in BRL and UPI prices in INR; Alipay uses the configured plan currency.
- Create or migrate the Stripe webhook endpoint to API version `2026-06-24.dahlia`.
- Keep the existing recurring lifecycle events subscribed (do not replace the current event list):
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Add the Checkout events required by the new one-time and recovery flows:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
- Verify one live or test-mode purchase for Stripe recurring, Alipay, Pix, UPI, and Flatkey balance.
- Verify that closing an unpaid Checkout leaves a pending plan record under “套餐与余额记录” and that “Reopen Checkout” returns to the same Stripe session.

Existing recurring Stripe Prices do not need to be recreated. One-time purchases do not require twelve separate Stripe Prices.

## Non-blocking follow-ups

- Add a scheduled reconciliation job that expires stale pending subscription orders when the Stripe expiration webhook is unavailable for an extended period. The launch path already lets users reopen an unexpired Checkout from billing history.
- Remove `IgnoreAPIVersionMismatch` after every production webhook endpoint has been migrated to the Dahlia API version.
- Add customer-facing cancellation and recovery controls only when the cancellation product policy is approved; cancellation remains intentionally unavailable for this launch.
- Repair the existing Windows SQLite test fixtures that retain file handles in the full `controller` and `model` suites. The flexible-plan targeted suites pass; the known cleanup failures are unrelated to this feature.
