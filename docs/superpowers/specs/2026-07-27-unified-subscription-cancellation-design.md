# Unified Subscription Cancellation and Resume Design

## Goal

Give every user whose current subscription renews automatically one provider-neutral control in the Flatkey wallet page:

- Stripe recurring subscriptions can be cancelled at the end of the paid period and resumed before that period expires.
- Flatkey wallet-balance subscriptions renew automatically by default, but the user can stop future wallet deductions and resume them before the paid period expires.
- Purchases whose canonical renewal source is empty do not show auto-renewal status or cancellation controls.

Cancelling renewal never refunds the current payment, shortens the current entitlement, or immediately removes access.

## Confirmed product behavior

- The normal wallet UI uses one cancellation action and one resume action, regardless of whether renewal is backed by Stripe or the Flatkey wallet.
- Wallet-balance renewal is enabled by default after a successful `balance_one_period` purchase.
- The enabled state displays `Auto-renew on` and a `Cancel subscription` action.
- A user-cancelled state displays `Auto-renew off` and a `Resume subscription` action.
- The confirmation dialog names the actual future charge that will stop:
  - Stripe: future Stripe subscription charges stop after the current paid period.
  - Wallet: future deductions from the Flatkey wallet balance stop after the current paid period.
- Cancellation is effective at period end. The current entitlement, quota windows, plan badge, and current period dates remain unchanged.
- Resume is allowed only while the current renewable contract and entitlement are still active and before `current_period_end`.
- Repeated cancel and resume requests are idempotent.
- A current contract with an incomplete, missing, or ambiguous Stripe binding fails safely and sets the existing support/migration-conflict capability; the server never guesses a binding.

## Scope

This change covers the current subscription contract, the wallet renewal scheduler, provider-neutral self-subscription state, authenticated lifecycle routes, the wallet current-plan card, translations, and focused tests.

It does not:

- refund payments or terminate current access;
- add immediate cancellation;
- turn Pix, UPI, Alipay, or another one-period payment into recurring billing;
- change plan purchase, upgrade, downgrade, or refund policy;
- broaden the current router exposure of the binding-ID Stripe handlers;
- resolve legacy subscription migration conflicts automatically.

The existing binding-specific Stripe controller/service helpers and compatibility API definitions are not deleted. The wallet UI no longer needs a binding ID and uses only the unified routes. Migration-conflict users remain on the existing support path.

## Canonical renewal state

`UserSubscriptionContract.renewal_source` continues to identify who performs the next renewal:

| `renewal_source` | Meaning |
| --- | --- |
| `provider_recurring` | Stripe owns the recurring charge. |
| `wallet_auto` | Flatkey deducts the next period price from wallet balance. |
| empty | The current purchase does not have an automatic-renewal contract. |

Add the exact renewal status `cancelled_by_user` to the existing statuses:

| `renewal_status` | Meaning | User action |
| --- | --- | --- |
| `enabled` | The next automatic renewal is scheduled. | Cancel |
| `cancelled_by_user` | The current period stays active but no later renewal is scheduled. | Resume before expiry |
| `paused_insufficient_balance` | Wallet renewal reached period end but could not charge. | No current-period resume control |
| `paused_plan_unavailable` | Wallet renewal reached period end but the plan cannot renew. | No current-period resume control |

For Stripe, `cancelled_by_user` is a provider-neutral projection of the exact current binding's `cancel_at_period_end=true`; the binding and Stripe remain authoritative. For wallet renewal, `cancelled_by_user` is persisted directly on the contract.

One-period payments with an empty canonical renewal source must not infer auto-renewal from a legacy payment-mode fallback. In particular, the wallet UI must not treat every `balance_one_period` contract as renewable when the server returns no canonical renewal source.

## API design

Add two authenticated, rate-limited endpoints under the existing subscription self group:

```text
POST /api/subscription/self/renewal/cancel
POST /api/subscription/self/renewal/resume
```

Neither endpoint accepts a provider or binding ID. The authenticated user's current contract is the only target.

Both endpoints return the existing success envelope with a provider-neutral renewal result:

```json
{
  "renewal_source": "wallet_auto",
  "renewal_status": "cancelled_by_user",
  "current_period_end": 1780000000,
  "can_cancel": false,
  "can_resume": true,
  "is_cancel_at_period_end": true
}
```

The frontend invalidates and refetches `GET /api/subscription/self` after success so the card, capabilities, and period data use the canonical server snapshot.

Errors use the repository's existing API error envelope. The service must distinguish these cases so the controller can return stable user-facing messages:

- no active renewable contract;
- current paid period already expired;
- renewal source is unsupported;
- current Stripe binding is missing, incomplete, terminal, or mismatched;
- migration conflict requires support;
- Stripe declined or could not confirm the lifecycle update.

No local `cancelled_by_user` projection is returned for Stripe unless the provider snapshot confirms `cancel_at_period_end=true`. Resume similarly succeeds only after the Stripe snapshot confirms it is false.

## Backend dispatch

Introduce one provider-neutral service boundary for cancel and resume. It loads the authenticated user's current contract, validates the active entitlement and paid period, and dispatches by the canonical renewal source.

### Wallet auto-renewal

The wallet path runs in a database transaction and locks the `UserSubscriptionContract` row using the same `subscriptionCommandLock` used by `RenewWalletSubscriptionContract`.

- Cancel changes `enabled` to `cancelled_by_user`.
- Cancelling an already `cancelled_by_user` contract returns success without another update.
- Resume changes `cancelled_by_user` to `enabled` only when the current contract and entitlement are active and `current_period_end` is still in the future.
- Resuming an already enabled contract returns success.
- The wallet scheduler continues selecting only `renewal_status=enabled`, so a user-cancelled contract is never charged.

This row lock defines the race with the renewal job. If cancellation obtains the lock first, the scheduler sees `cancelled_by_user` and does not deduct. If the renewal transaction obtains the lock and completes first, that renewal is already committed and cancellation applies to the newly started following period. There is no refund or partial rollback.

The lock is database-backed for MySQL and PostgreSQL and uses the repository's existing SQLite transaction behavior, so correctness does not depend on a process-local mutex and remains valid across production nodes.

### Stripe recurring

The Stripe path resolves only `contract.current_provider_binding_id` and then reuses `CancelStripeRecurringSubscription` or `ResumeStripeRecurringSubscription`. Those services retain provider ownership checks, terminal-state checks, Stripe idempotency keys, downgrade coordination, authoritative snapshot application, and compensation handling.

The unified resolver must verify all of the following before dispatch:

- the contract is the authenticated user's current active Stripe recurring contract;
- `current_provider_binding_id` is positive;
- the binding belongs to the same user and contract;
- the provider is Stripe and the provider subscription ID is complete;
- the binding is not terminal;
- migration classification does not require admin review.

The existing Stripe idempotency behavior handles repeat requests. The database contract/binding checks prevent a stale UI request from targeting a former subscription. The implementation must not keep a database transaction open while waiting on the Stripe network call; it validates the exact target immediately before the provider service call and relies on the existing authoritative revalidation when the provider snapshot is applied.

## Self-subscription response and capabilities

`GET /api/subscription/self` remains the canonical read model.

Update its renewal projection so that:

- an active exact Stripe binding with `cancel_at_period_end=false` returns `provider_recurring/enabled`;
- an active exact Stripe binding with `cancel_at_period_end=true` returns `provider_recurring/cancelled_by_user`;
- an active wallet contract returns its persisted wallet renewal status, including `cancelled_by_user`;
- a one-period contract without canonical auto-renewal returns empty renewal source/status;
- stale provider state without an active matching binding returns empty renewal state and support/migration capabilities rather than a guessed action.

Set provider-neutral capabilities from that canonical projection:

- `can_cancel=true` only for an active, supported, enabled renewal;
- `can_resume=true` only for an active, supported, user-cancelled renewal before period end;
- `is_cancel_at_period_end=true` for `cancelled_by_user` on either Stripe or wallet;
- `requires_support=true` and both actions false for migration conflicts or incomplete provider state.

## Wallet UI

The current-plan card renders renewal UI only when `renewal_source` is `provider_recurring` or `wallet_auto`.

The card receives mutation callbacks and pending state from the subscription-plans container. The container owns the API mutation, toast handling, query invalidation, and refetch. During a mutation, both lifecycle actions are disabled to prevent double submission.

Display rules:

| State | Badge | Action |
| --- | --- | --- |
| Stripe or wallet `enabled` | `Auto-renew on` | `Cancel subscription` |
| Stripe or wallet `cancelled_by_user` | `Auto-renew off` | `Resume subscription` |
| Empty or unsupported renewal source | No renewal badge | No lifecycle action |
| Migration/support conflict | Current support warning | No lifecycle action |

The cancel confirmation states that access continues through the displayed end date. The provider-specific sentence is selected from `renewal_source`; frontend code does not inspect or choose a Stripe binding.

All new visible strings are translated in all eight console locale files (`en`, `zh`, `fr`, `ru`, `ja`, `vi`, `es`, and `pt`) and pass the repository i18n synchronization check.

## Pix and UPI automatic-renewal research

Stripe now supports recurring mandates for both payment rails, but they are separate future integrations and are not enabled by this branch.

### Pix

- Checkout subscriptions must use Pix Automático; ordinary Pix remains a one-time rail.
- The customer authorizes a mandate in their bank app before future off-session deductions can occur.
- Stripe exposes Pix mandate options on subscription payment settings, including amount, IOF handling, end date, and payment schedule.
- Stripe accounts located in Brazil can accept one-time Pix but cannot use Pix Automático, so account-country eligibility must be checked before exposing it.
- Pix recurring support requires the relevant Dahlia API version and webhook endpoint version.

Official references:

- <https://docs.stripe.com/payments/pix>
- <https://docs.stripe.com/payments/pix/pix-automatico>
- <https://docs.stripe.com/payments/pix/save-payment-details>
- <https://docs.stripe.com/changelog/dahlia/2026-04-22/pix-recurring-payments-support>

### UPI

- Stripe supports UPI recurring e-mandates / UPI AutoPay for customers in India, in INR.
- The customer authorizes the mandate in a UPI app with a UPI PIN.
- Stripe sends a pre-debit notification at least 24 hours before a recurring charge; the PaymentIntent can remain `processing` during that window.
- Recurring transactions above INR 15,000 are not supported by Stripe's documented UPI recurring flow.
- Subscription payment settings expose UPI mandate fields including amount, amount type, description, and end date.
- UPI recurring support requires the relevant Dahlia API version and webhook endpoint version.

Official references:

- <https://docs.stripe.com/payments/upi>
- <https://docs.stripe.com/india-recurring-payments>
- <https://docs.stripe.com/changelog/dahlia/2026-03-25/adds-support-for-the-upi-payment-method>
- <https://docs.stripe.com/payments/payment-methods/payment-method-support>
- <https://docs.stripe.com/api/subscriptions/create>

Adding either rail later requires a separate design for account eligibility, mandate consent/state, asynchronous processing, pre-debit timing, webhook reconciliation, currency/amount limits, and rail-specific failure recovery. Their eventual cancellation UI can reuse the provider-neutral lifecycle contract designed here once their provider bindings become authoritative.

## Error and failure behavior

- Provider errors do not mutate wallet state or fabricate a successful renewal projection.
- A failed wallet update rolls back the whole transaction.
- A stale duplicate request returns the already-achieved state.
- A cancel/resume request received after the period expires fails without reviving the entitlement.
- A user-cancelled wallet contract remains user-cancelled across scheduler scans and application restarts.
- Stripe webhooks and reconciliation remain authoritative if the provider changes state outside this endpoint.
- Logs identify the contract and binding IDs but do not log payment credentials or secrets.

## Test strategy

Implementation follows test-driven development.

Backend tests cover:

- the new `cancelled_by_user` state as a valid wallet and provider-neutral renewal projection;
- wallet cancel, duplicate cancel, resume, duplicate resume, and resume-after-expiry;
- the scheduler never charges a user-cancelled wallet contract;
- the renewal-versus-cancel transaction ordering described above;
- Stripe cancel/resume dispatch uses only `current_provider_binding_id`;
- missing, mismatched, multiple, incomplete, and terminal Stripe bindings fail safely;
- Stripe provider failure does not report a cancelled/resumed state;
- self-response renewal status and provider-neutral capabilities for Stripe, wallet, one-period, and migration-conflict cases;
- both unified routes are authenticated and use the intended lifecycle handlers.

Frontend tests cover:

- Stripe enabled: on badge plus cancel action;
- Stripe cancelled: off badge plus resume action;
- wallet enabled: on badge plus cancel action;
- wallet cancelled: off badge plus resume action;
- one-period/empty renewal source: no renewal badge or lifecycle action;
- provider-specific confirmation copy;
- pending-state double-submit prevention;
- success invalidates/refetches self-subscription data and failure preserves the current UI state.

Translation verification covers all eight locale files and the i18n synchronization report.

## Verification baseline

Before implementation, the focused subscription baseline passed:

- `model` subscription contract, recurring, and entitlement tests;
- `service` wallet-renewal and recurring-lifecycle tests;
- `controller` self-subscription and recurring lifecycle tests;
- `router` subscription route tests.

The full `go test ./...` baseline did not complete within several minutes on Windows. Broader package runs also expose pre-existing SQLite temporary-database cleanup file locks and controller environment/global-state failures. Verification for this branch must run the focused tests first, then the broadest practical Go and frontend checks, and report those baseline gaps separately from feature regressions.

## Success criteria

- A Stripe or wallet auto-renewing subscriber sees one consistent cancel/resume experience.
- Cancelling never removes already-paid access and prevents the next uncommitted renewal.
- Resuming before expiry restores the correct Stripe or wallet renewal path.
- One-time subscriptions show no auto-renewal control.
- The server never accepts a client-selected provider binding through the unified API.
- Wallet cancellation remains correct across concurrent nodes and scheduler races.
- Focused backend and frontend lifecycle tests pass, with any broader baseline failures reported explicitly.
