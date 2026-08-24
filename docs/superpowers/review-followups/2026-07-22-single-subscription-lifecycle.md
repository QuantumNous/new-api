# Single Subscription Lifecycle — Non-blocking Follow-ups

This file records review findings intentionally deferred to keep the release path moving. Items here must not be treated as release blockers unless later evidence raises their severity.

## Task 5

- Legacy `POST /api/subscription/balance/pay` generates a server-side random request ID when the old UI omits one. Transaction serialization and same-plan/rank rejection prevent a second debit, but a retry returns `plan unchanged` instead of the original terminal result. Remove this compatibility path after the frontend fully migrates to `/api/subscription/self/change-plan` with a stable client UUID.
- `router/subscription_routes_test.go` primarily asserts Gin handler names for blocked legacy subscription purchase routes. Add an authenticated runtime router test later to cover middleware and route wiring end to end.

## Task 6

- `service/subscription_invoice.go` falls back to `now + 30 days` when Stripe invoice/subscription period facts are absent. Normal subscription invoices provide these fields, but a later hardening pass should fail closed or add explicit fallback coverage.
- If a Stripe Checkout Session was created but its URL was not persisted, replay uses the stored Stripe idempotency key with current user email/customer inputs. Freeze the original Checkout parameters later to eliminate possible Stripe idempotency-parameter drift.

## Tasks 7-8

- Schedule-drift reconciliation currently performs the remote comparison only when the local binding already stores a non-empty schedule ID. Add later coverage for a remotely attached schedule when the local schedule pointer is empty; current upgrade/downgrade command serialization remains the primary invariant.
- Webhook processing uses a fixed 300-second lease without heartbeat renewal. Current entitlement grants and transaction writes are idempotent, so this is not a release blocker, but long-running handlers should eventually renew ownership or expose lease-expiry telemetry before the sweeper retries them.
- Grace-expiry fallback currently treats an authoritative `uncollectible` invoice like a successfully voided invoice, although Stripe can still allow manual payment of an uncollectible invoice. Define an explicit compensation policy later; only `void` is the irreversible cancellation fence.
- Grace-invoice void tests currently assert that an idempotency key is present, not its exact lifecycle-derived value. Add an exact-value assertion when lifecycle key formatting is stabilized.

## Task 9

- When upgrade crash recovery finds that Stripe already applied the target Price and its latest invoice is paid, the command persists the recovered invoice/snapshot but may leave the intent `syncing` until the webhook, reconciliation worker, or a same-request replay applies the entitlement. Monitor stale `syncing` upgrade age and consider reconciling the paid invoice in the original command response path during a later hardening pass.

## Task 10

- The synchronous downgrade writer caps latest-choice convergence at four Stripe schedule updates. A burst with more replacements can return a transient error, while the persisted `syncing` intent and reconciliation worker still converge later. Add a race/stress test and convergence-attempt telemetry in a later hardening pass.
- Broad `go test ./service` remains blocked by the pre-existing `users.aff_code` unique-fixture failure in `TestRefundTaskQuota_Wallet`; Task 10 targeted tests, compile-only checks, and vet pass. Repair the shared fixture isolation separately.

## Task 12

- Concurrent first-run migration audits can surface a database unique-constraint error instead of returning the already-created audit result. Normalize that race into a stable idempotent response in a later hardening pass.
- Migration-conflict observability currently records the broad audit classification but not enough structured detail to distinguish every operator remediation path. Add metrics/log fields for the exact conflict reason and affected local record IDs.

## Final Task 14-15 review deferrals

- `AdminListUserSubscriptions` currently ignores read errors from the active-entitlement, recurring-binding, contract, current-entitlement, and pending-change lookups. A database failure can therefore return HTTP 200 with an incomplete canonical lifecycle payload. Change the admin endpoint to fail closed with `common.ApiError` for canonical lifecycle read failures, while keeping `/self` legacy compatibility behavior separate; add explicit database-error regression coverage.
- `SelfSubscriptionMigration` in `web/default/src/features/subscriptions/types.ts` still exposes the legacy required `required` and `blocked` fields, and `single-contract.typecheck.ts` asserts that shape. The wallet runtime no longer depends on `migration.blocked`, but a later contract cleanup should remove the legacy fields and keep only canonical migration state such as `requires_admin_review`, `has_migration_conflict`, `classification`, and `reason` after backend compatibility is confirmed.
