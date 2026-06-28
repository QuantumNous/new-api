# DR-100 One-Time Skill Purchase PRD

**Status:** ship
**Ticket:** DR-100
**Branch:** feature/DR-100-one-time-single-skill-purchase-2-buy-out-checkou
**Date:** 2026-06-29

## Context

DR-40 added Skill monetization fields, DR-67 added use-time subscription entitlement, and DR-81 added package download. There is still no backend path for a user to buy a single Skill outright and retain durable download plus run rights without an active subscription.

This PRD covers the backend purchase and entitlement authority for `monetization_type=one_time`.

## Goals

1. Add `POST /api/v1/marketplace/skills/{id}/purchase`.
2. Support only published Skills whose monetization type is `one_time`.
3. Create an idempotent purchase order keyed by `(user_id, idempotency_key)`.
4. On successful payment settlement, grant one durable entitlement row keyed by `(user_id, skill_id)`.
5. Ensure DR-81 download and DR-67 runtime entitlement checks accept that durable one-time grant without requiring a subscription.
6. Emit a privacy-safe `skill_purchased` analytics/billing event containing `skill_id`, `skill_version_id`, `amount`, and `monetization_type=one_time`, with no prompt or raw content.

## Non-Goals

- No frontend checkout UI in this ticket.
- No per-use token markup settlement changes from DR-89.
- No subscription plan semantics changes.
- No prompt/package content in payment or analytics metadata.

## Product Contract

One-time purchase price is fixed at USD 2.00 for this ticket. The backend stores both display amount (`2.00`, `USD`) and quota charge amount (`2 * common.QuotaPerUnit`) so existing DeepRouter wallet accounting remains the payment source in V1.

The purchase endpoint accepts:

```json
{
  "idempotency_key": "client-generated-key",
  "payment_status": "paid"
}
```

`payment_status` is optional and defaults to `paid`. Tests may send `failed` or `abandoned` to lock in the no-grant failure contract; production callers should only expect durable entitlement after `paid`.

## Data Model

Add:

- `skill_purchase_orders`: one row per idempotent purchase attempt.
- `skill_entitlements`: one durable row per `(user_id, skill_id)` grant.

Order status values:

- `pending`
- `succeeded`
- `failed`
- `abandoned`

Entitlement grant source:

- `one_time_purchase`

## API Behavior

Successful first paid request:

- creates or reuses the purchase order;
- debits user wallet quota by USD 2 equivalent;
- writes the durable entitlement;
- writes/refreshes the download enablement row;
- emits exactly one `skill_purchased` event;
- returns `200` with `status=succeeded`, `entitled=true`, and amount fields.

Duplicate paid request with the same idempotency key:

- returns the original succeeded order;
- does not debit quota again;
- does not create a second entitlement;
- does not emit a second purchase event.

Failed or abandoned request:

- records a failed/abandoned order status;
- debits no quota;
- grants no entitlement;
- emits no `skill_purchased` event.

## Acceptance

- Successful USD 2 one-time purchase grants durable download plus run rights.
- Download endpoint accepts one-time entitlement even when subscription/group plan is otherwise insufficient.
- Runtime DR-67 use-time check accepts one-time entitlement without subscription.
- Duplicate callback/request grants once and charges once.
- Failed/abandoned payment grants nothing.
- `skill_purchased` event is emitted once with allowed metadata and no prompt/raw content.
