# Stripe Subscription Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a precise Stripe recurring subscription cancel/resume lifecycle without guessing by customer, plan, price, or current subscription.

**Architecture:** Persist a provider-neutral binding keyed by `(provider, provider_subscription_id)` and expose user/admin lifecycle actions through a small Stripe lifecycle service. Webhooks and reconciliation use DB uniqueness plus Stripe idempotency keys for multi-node safety; frontend consumes backend capability flags and never receives the real Stripe `sub_xxx` ID.

**Tech Stack:** Go 1.22+, Gin, GORM, stripe-go v81.4.0, SQLite/MySQL/PostgreSQL, React 19, TypeScript, Bun, i18next.

---

## Baseline

- `go mod download` -> exit 0.
- `go test ./model ./service ./controller ./router` -> baseline failure in `service/TestRefundTaskQuota_Wallet` due `UNIQUE constraint failed: users.aff_code`; `model`, `controller`, and `router` passed.
- GitNexus MCP impact tools were requested by root `AGENTS.md`, but no GitNexus MCP tools were exposed in this runtime. Use local symbol inspection and fresh tests instead.

## File Structure

- Create `model/subscription_recurring.go`: `SubscriptionProviderBinding`, `PaymentWebhookEvent`, snapshot structs, CRUD/idempotency helpers, binding-safe entitlement termination.
- Modify `model/subscription.go`: add `ProviderBindingId` to `UserSubscription`; add transaction entry point `CompleteSubscriptionOrderWithProviderBinding`.
- Modify `model/main.go`: AutoMigrate new recurring models in normal and fast migrations.
- Create `service/stripe_subscription_lifecycle.go`: Stripe client interface, cancel/resume/admin-invalidate lifecycle, snapshot application, invoice collection reconciliation stubs with precise mapping boundaries.
- Create `service/subscription_reconciliation_task.go`: master-only recurring reconciliation loop entry.
- Modify `controller/subscription_payment_stripe.go`: add Checkout + Subscription metadata and return full Checkout Session for session ID/subscription linkage.
- Modify `controller/topup_stripe.go`: route `checkout.session.completed` subscription orders through binding completion; add `customer.subscription.updated/deleted` handlers and event ID idempotency.
- Create `controller/subscription_stripe_lifecycle.go`: user cancel/resume handlers.
- Modify `controller/subscription.go`: include `recurring_subscriptions` in `GET /api/subscription/self`; route admin invalidate/delete through lifecycle policy.
- Modify `router/api-router.go`: add `POST /api/subscription/self/recurring/:binding_id/{cancel,resume}` with `UserAuth` and `CriticalRateLimit`.
- Modify `i18n/keys.go`, `i18n/locales/en.yaml`, `i18n/locales/zh-CN.yaml`, `i18n/locales/zh-TW.yaml`, `i18n/locales/pt.yaml`: backend lifecycle error messages.
- Modify `docs/openapi/api.json`: document self recurring cancel/resume and self response shape.
- Modify `web/default/src/features/subscriptions/types.ts`: recurring DTO and capability flags.
- Modify `web/default/src/features/subscriptions/api.ts`: cancel/resume client calls.
- Create `web/default/src/features/subscriptions/components/dialogs/recurring-subscription-action-dialog.tsx`: confirmation UI.
- Modify `web/default/src/features/wallet/components/subscription-plans-card.tsx`: list each manageable recurring binding with pending action state.
- Modify `web/default/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx`: show admin provider status, disable Delete for Stripe recurring.
- Modify `web/default/src/i18n/static-keys.ts` and `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`: eight-language user-facing copy.

## Task 1: Recurring Persistence

**Files:**
- Create: `model/subscription_recurring.go`
- Modify: `model/subscription.go`
- Modify: `model/main.go`
- Test: `model/subscription_recurring_test.go`

- [x] **Step 1: Write failing model tests**

Add tests for:
- AutoMigrate creates `subscription_provider_bindings`, `payment_webhook_events`, and `user_subscriptions.provider_binding_id`.
- duplicate `(provider, provider_subscription_id)` returns the existing binding for the same user/order and rejects another user/order.
- duplicate `(provider, event_id)` records only one processing event.
- the same user may own two different Stripe subscription IDs.

- [x] **Step 2: Run RED**

Run: `go test ./model -run 'TestSubscriptionProviderBinding|TestPaymentWebhookEvent|TestCompleteSubscriptionOrderWithProviderBinding' -count=1`
Expected: FAIL because the new models/functions do not exist.

- [x] **Step 3: Implement minimal persistence**

Define the new structs, GORM tags, lifecycle constants, snapshot struct, helper functions, and migration registration. Add `ProviderBindingId int64` to `UserSubscription`.

- [x] **Step 4: Run GREEN**

Run: `go test ./model -run 'TestSubscriptionProviderBinding|TestPaymentWebhookEvent|TestCompleteSubscriptionOrderWithProviderBinding' -count=1`
Expected: PASS.

- [x] **Step 5: Commit**

Commit with Lore message:
`Persist Stripe recurring bindings for precise lifecycle routing`

## Task 2: Checkout Completion Binding

**Files:**
- Modify: `controller/subscription_payment_stripe.go`
- Modify: `controller/topup_stripe.go`
- Modify: `model/subscription.go`
- Test: `controller/topup_stripe_test.go`, `model/subscription_recurring_test.go`

- [x] **Step 1: Write failing tests**

Add tests for:
- Checkout subscription completion requires event `subscription=sub_xxx`; empty subscription returns retryable error and creates no entitlement.
- session metadata and subscription metadata include `newapi_trade_no`, `newapi_user_id`, `newapi_plan_id`.
- replay of `checkout.session.completed` fills a missing binding without creating another entitlement.

- [x] **Step 2: Run RED**

Run: `go test ./controller -run 'TestStripeSubscriptionCheckout|TestFulfillSubscriptionOrder' -count=1`
Expected: FAIL because metadata/binding completion is missing.

- [x] **Step 3: Implement minimal completion flow**

Use only the session `subscription` ID. Fetch Stripe subscription snapshot through injectable package-level function. Validate customer, price, livemode, and metadata against the local order and plan. Complete order, binding, and first entitlement in one DB transaction.

- [x] **Step 4: Run GREEN**

Run: `go test ./controller -run 'TestStripeSubscriptionCheckout|TestFulfillSubscriptionOrder' -count=1`
Expected: PASS.

- [x] **Step 5: Commit**

Commit with Lore message:
`Bind Stripe checkout subscriptions from authoritative session state`

## Task 3: User Cancel/Resume API

**Files:**
- Create: `service/stripe_subscription_lifecycle.go`
- Create: `controller/subscription_stripe_lifecycle.go`
- Modify: `router/api-router.go`
- Modify: `controller/subscription.go`
- Modify: `i18n/keys.go`, `i18n/locales/en.yaml`, `i18n/locales/zh-CN.yaml`, `i18n/locales/zh-TW.yaml`, `i18n/locales/pt.yaml`
- Test: `service/stripe_subscription_lifecycle_test.go`, `controller/subscription_stripe_lifecycle_test.go`

- [x] **Step 1: Write failing tests**

Add tests for normal cancel, resume, repeated cancel/resume no-op, foreign binding denial, non-Stripe no Stripe call, incomplete binding no Stripe call, terminal resume denial, snapshot mismatch failure, and `past_due` immediate cancel ending local entitlement.

- [x] **Step 2: Run RED**

Run: `go test ./service ./controller -run 'TestStripeSubscriptionLifecycle|TestCancelRecurring|TestResumeRecurring' -count=1`
Expected: FAIL because lifecycle service and routes do not exist.

- [x] **Step 3: Implement minimal service/controller**

Inject Stripe operations behind variables/interfaces for tests. Use deterministic idempotency keys containing binding ID, desired action, and current period end. Return backend capability DTO without real Stripe subscription ID.

- [x] **Step 4: Run GREEN**

Run: `go test ./service ./controller -run 'TestStripeSubscriptionLifecycle|TestCancelRecurring|TestResumeRecurring' -count=1`
Expected: PASS.

- [x] **Step 5: Commit**

Commit with Lore message:
`Gate recurring self-service actions on precise Stripe bindings`

## Task 4: Webhook Updated/Deleted

**Files:**
- Modify: `controller/topup_stripe.go`
- Modify: `service/stripe_subscription_lifecycle.go`
- Modify: `model/subscription_recurring.go`
- Test: `controller/topup_stripe_test.go`, `service/stripe_subscription_lifecycle_test.go`

- [x] **Step 1: Write failing tests**

Add tests for signed event ID dedupe, unrelated subscription event 200, NewAPI metadata missing order retryable 500, updated fetches current Stripe snapshot, deleted is terminal/idempotent, and late updated cannot revive deleted binding.

- [x] **Step 2: Run RED**

Run: `go test ./controller ./service -run 'TestStripeSubscriptionWebhook|TestApplyProviderSubscription' -count=1`
Expected: FAIL because new event types are ignored.

- [x] **Step 3: Implement minimal webhook flow**

After signature verification, persist event processing row. For `updated`, fetch current snapshot before applying. For `deleted`, apply terminal state and reconcile invoice collection. Unknown no-metadata subscription objects return 200.

- [x] **Step 4: Run GREEN**

Run: `go test ./controller ./service -run 'TestStripeSubscriptionWebhook|TestApplyProviderSubscription' -count=1`
Expected: PASS.

- [x] **Step 5: Commit**

Commit with Lore message:
`Make Stripe subscription webhooks idempotent and terminal-aware`

## Task 5: Admin Lifecycle Protection

**Files:**
- Modify: `controller/subscription.go`
- Modify: `service/stripe_subscription_lifecycle.go`
- Modify: `model/subscription.go`
- Test: `controller/subscription_test.go`, `service/stripe_subscription_lifecycle_test.go`

- [x] **Step 1: Write failing tests**

Add tests for Stripe recurring admin invalidate requiring successful remote cancel before local cancel, remote failure keeping local active, non-Stripe retaining local invalidate, and Delete rejecting Stripe recurring history.

- [x] **Step 2: Run RED**

Run: `go test ./controller ./service -run 'TestAdmin.*Subscription' -count=1`
Expected: FAIL because admin still does local-only invalidate/delete.

- [x] **Step 3: Implement minimal admin policy**

Route admin invalidate through lifecycle service when a Stripe recurring binding exists; keep existing local semantics otherwise. Hard delete returns business error for Stripe recurring bindings.

- [x] **Step 4: Run GREEN**

Run: `go test ./controller ./service -run 'TestAdmin.*Subscription' -count=1`
Expected: PASS.

- [x] **Step 5: Commit**

Commit with Lore message:
`Protect Stripe recurring contracts during admin invalidation`

## Task 6: Reconciliation Task

**Files:**
- Create: `service/subscription_reconciliation_task.go`
- Modify: `main.go`
- Test: `service/stripe_subscription_lifecycle_test.go`

- [x] **Step 1: Write failing tests**

Add tests for master-only guard and invoice collection reconciliation only touching invoices mapped to active NewAPI recurring bindings.

- [x] **Step 2: Run RED**

Run: `go test ./service -run 'TestStripeSubscriptionReconciliation' -count=1`
Expected: FAIL because reconciliation entry does not exist.

- [x] **Step 3: Implement minimal reconciliation**

Start only on master node. Scan non-terminal bindings, fetch Stripe snapshots, apply snapshot/termination, and run invoice reconciliation with exact binding mapping only.

- [x] **Step 4: Run GREEN**

Run: `go test ./service -run 'TestStripeSubscriptionReconciliation' -count=1`
Expected: PASS.

- [x] **Step 5: Commit**

Commit with Lore message:
`Repair Stripe recurring state from master reconciliation`

## Task 7: Frontend Recurring Management

**Files:**
- Modify: `web/default/src/features/subscriptions/types.ts`
- Modify: `web/default/src/features/subscriptions/api.ts`
- Create: `web/default/src/features/subscriptions/components/dialogs/recurring-subscription-action-dialog.tsx`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.tsx`
- Modify: `web/default/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx`
- Modify: `web/default/src/i18n/static-keys.ts`
- Modify: `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`
- Test: frontend typecheck/build/i18n sync and focused component tests if present.

- [x] **Step 1: Write failing frontend tests or type assertions**

Add tests where existing test harness supports it; otherwise add type-level consumption and run typecheck RED before implementation.

- [x] **Step 2: Run RED**

Run: `bun run typecheck`
Expected: FAIL while API/types/components are missing.

- [x] **Step 3: Implement minimal UI**

Render every backend-manageable recurring item, pending action state, cancel/resume confirmation, backend message toasts, and admin delete disablement. Do not render `sub_xxx`.

- [x] **Step 4: Run GREEN**

Run from `web/default`: `bun run typecheck`, `bun run lint`, `bun run build:check`, `bun run i18n:sync`
Expected: PASS or documented unrelated baseline issue.

- [x] **Step 5: Commit**

Commit with Lore message:
`Expose recurring lifecycle capabilities without leaking Stripe IDs`

## Final Verification

- `go test ./model ./service ./controller ./router`
- `go build ./...`
- From `web/default`: `bun run typecheck`, `bun run lint`, `bun run build:check`, `bun run i18n:sync`
- Inspect `web/default/src/i18n/locales/_reports/*.untranslated.json` for newly added keys.
- `git status --short`
- `git log --oneline --decorate -n 10`

## Scope Guard

- Do not implement `invoice.paid`, renewal credit issuance, plan switching, E2 settlement, PLG discounts, refunds, Stripe Customer Portal, or non-Stripe remote recurring cancellation.
- Do not choose a subscription by customer, user, price, current subscription, highest price, or newest record.
- Do not expose Stripe subscription IDs to frontend responses.
