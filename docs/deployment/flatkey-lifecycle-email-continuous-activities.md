# Flatkey Lifecycle Email Continuous Activities Deployment

This rollout enables lifecycle email automation through Continuous Activities. Treat the release as a producer-coverage rollout, not only a Console feature rollout: registration, payment, and quota producer nodes must all emit durable lifecycle events before any continuous task can consume them.

## Runtime Scope

| Component | Required | Reason |
| --- | --- | --- |
| Database additive migration | Yes | Adds lifecycle event, trigger ownership, quota lifecycle, campaign, and recipient audit state. |
| `newapi-console` | Yes | Owns Activity Configuration, preview, activation, workers, and producer paths that run in Console nodes. |
| `newapi-router` | Yes | Router-side quota settlement must emit lifecycle events consistently. |
| `newapi-web` | No | The embedded Console bundle ships with `newapi-console`; no separate web deployment is required. |

Do not drop new schema on rollback. The migration is additive and audit-preserving.

## Pre-Deploy Checklist

- Confirm the additive migration is ready for the production database engine before deploying code.
- Confirm continuous preview, activation, and workers are disabled for the initial migration/code rollout.
- Confirm every producer-capable `newapi-console` and `newapi-router` node is included in the deployment plan.
- Confirm `newapi-web` is not treated as a rollout dependency.
- Confirm Activity SMTP settings and test recipients are available for draft template validation.
- Confirm localized templates exist for all seven lifecycle triggers before activation.
- Confirm service-mail templates are operational account, quota, or order mail only. Service mail has no unsubscribe controls and ignores marketing opt-out, so operators must review copy before activation.
- Confirm engagement triggers still respect marketing opt-out and unsubscribe behavior.

Block deployment if the additive migration cannot be applied, if any producer node will remain on old code, or if operators cannot validate SMTP and translations before activation.

## Deploy Checklist

1. Apply the additive database migration while continuous preview, activation, and workers remain disabled.
2. Deploy the new shared Go image to every `newapi-console` node.
3. Deploy the new shared Go image to every `newapi-router` node.
4. Verify every producer-capable node is upgraded and emitting the complete lifecycle producer matrix.

## Producer Matrix

Pass this matrix before writing the collection marker. A failed row means producer coverage is incomplete and marker insertion must wait.

| Trigger | Producer service/path | Source scope | Pass verification | Fail verification |
| --- | --- | --- | --- | --- |
| `user_registered` | `newapi-console` registration paths through `model.RegisterUserWithDomainRisk` -> `insertRegisteredUserWithTx` -> `CreateRegistrationLifecycleEventsTx` in `model/registration_domain_risk.go` and `model/registration_lifecycle.go`. | `user:<id>` plus initial wallet lifecycle state `wallet:<user_id>`. | A new password or OAuth registration creates one pending `user_registered` event with `scope_type=user`, `scope_id=<user_id>`, and the persisted user creation time. | Any successful registration path creates no event, creates a duplicate event for one user occurrence, or fails registration because email delivery or SMTP state is unavailable. |
| `registration_unused` | Same registration transaction as `user_registered`: `CreateRegistrationLifecycleEventsTx`. | `user:<id>`. | The same registration creates one pending `registration_unused` event with `available_at = users.created_at + 604800`. | The delayed event is missing, due time differs from 7x24 hours, or the event depends on key creation instead of the user record. |
| `quota_low` | `newapi-router` and `newapi-console` quota mutations routed through `model.ApplyLifecycleQuotaMutation` and wrappers such as `ApplyWalletQuotaMutationTx`, including runtime/task billing in `service/task_billing.go`, wallet/user mutations in `model/user.go`, and subscription mutations in `model/subscription.go`. | `wallet:<user_id>` and `subscription:<user_subscription_id>`. | A downward crossing from `previous >= effective_threshold` to `0 < current < effective_threshold` creates one pending `quota_low` event for the current cycle. | Any authoritative balance write bypasses `ApplyLifecycleQuotaMutation`, no event is created for a qualifying crossing, or low and exhausted events are both created for a direct above-to-zero deduction. |
| `quota_exhausted_unpaid` | Same quota mutation primitive and router/console quota paths as `quota_low`. | `wallet:<user_id>` and `subscription:<user_subscription_id>`. | A crossing from positive balance to `<= 0` creates one pending `quota_exhausted_unpaid` event for the current cycle. | Exhaustion creates no event, creates more than one event for one cycle, or a later top-up/renewal fails to rotate the cycle before future crossings. |
| `payment_failed` | Top-up and subscription status transitions through `model.PersistPurchaseLifecycleTransition` or `PersistSubscriptionPurchaseLifecycleTransitionWithWinner`, called from `model/topup.go`, `model/stripe_card.go`, `model/subscription.go`, `service/subscription_purchase.go`, `service/subscription_contract.go`, `service/subscription_invoice.go`, `service/subscription_compensation.go`, `service/subscription_wallet_renewal.go`, and `controller/subscription_payment_waffo_pancake.go`. | `topup:<trade_no or top_ups:id>` and `subscription:<trade_no or subscription_orders:id>`. | A first terminal failed, cancelled, canceled, or expired transition creates one pending `payment_failed` event. | Callback replay creates duplicates, a terminal failure writes status without an event, or a corrected later success is blocked from creating its own success occurrence. |
| `payment_pending` | Top-up creation through `TopUp.Insert` in `model/topup.go`; subscription order creation through `CreateSubscriptionOrderWithPendingPurchaseLifecycleTx` in `model/purchase_lifecycle.go`, called by subscription purchase and recurring checkout paths. | `topup:<trade_no or top_ups:id>` and `subscription:<trade_no or subscription_orders:id>`. | A pending order creates one pending `payment_pending` event with `available_at = create_time + 86400`. | Pending creation does not create an event, due time differs from 24 hours, or replay creates duplicate pending events. |
| `payment_succeeded` | Same purchase transition primitives as `payment_failed`; wallet success additionally calls `ApplyWalletTopUpSuccessMutationTx`, and subscription success can rotate subscription quota through `ApplyLifecycleQuotaMutation` when a subscription scope ID is present. | `topup:<trade_no or top_ups:id>` and `subscription:<trade_no or subscription_orders:id>`. | A first success transition creates one pending `payment_succeeded` event and rotates the applicable quota cycle. | Success credits quota without an event, replays credit or emits twice, or subscription success does not rotate the subscription cycle when the scope exists. |

5. Only after every producer row passes, insert the collection marker `recall_campaign_setting.lifecycle_event_collection_started_at` once through the approved helper `model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext`.

The collection marker is a write-once coverage boundary. It means every producer-capable Console and router node was upgraded before that database timestamp. It is not a feature flag, not an editable setting, and not a reusable recovery token. If a marker already exists, do not update it, replace it, or reuse a new value for the same v1 rollout.

This repository exposes the marker operation as a model helper, not as a checked-in operator CLI in this document. Run it through a controlled administrator one-shot call to `model.InsertRecallLifecycleEventCollectionStartedAtBarrierWithContext`. The helper obtains database time, inserts conflict-safely, reads the stored option back in the same transaction, and returns the persisted timestamp. Compare the returned timestamp with a strong read through `model.GetRecallLifecycleEventCollectionStartedAtWithContext`. Do not write the marker with direct SQL, `model.UpdateOption`, `UPDATE options`, or any editable settings path.

Events emitted before the marker may remain for audit, but continuous tasks must not select them.

## Enable Checklist

1. Create seven draft Continuous Activities, one per lifecycle trigger.
2. Validate localized templates with test SMTP and test recipients.
3. Resolve all activation blockers before enabling any trigger:
   - missing or invalid collection marker;
   - invalid processing start boundary;
   - duplicate running or paused task for the trigger;
   - SMTP configuration or test-send failure;
   - missing, stale, or invalid translations;
   - service-mail copy that is promotional or needs operational review.
4. Preview a safe processing start boundary for each task.
5. Activate only one trigger at a time.
6. Start each trigger with the initial hourly limit approved in the deployment change record. The approval source must cite the SMTP provider/account allowance and current Activity email throughput; do not infer a production number from defaults.
7. Observe at least the minimum window approved in the deployment change record before activating the next trigger or raising throughput. The minimum must be no shorter than `max(configured recall_campaign_setting.tick_seconds, 5 minutes lifecycle event lease TTL, 60 seconds email message lease)`.
8. Do not raise throughput while `messages_uncertain_count` is increasing, while new `messages_failed_count` entries lack an understood safe error-code cause, or while backlog/disposition counts are still changing in a way the change record did not approve.

For service triggers, keep the no-unsubscribe policy visible during operator review. Do not activate service templates that contain coupons, discount language, win-back messaging, or promotional-only variables.

## Monitor Checklist

Monitor each trigger independently after activation:

- recorded events inside the task boundary;
- pending-not-due and due backlog;
- leased event count;
- enrolled event count;
- enrolled recipients and queued messages;
- disposition counts and safe skip reasons;
- `SMTP accepted`, uncertain, failed, and cancelled outcomes;
- no-account-email and invalid-email skips;
- engagement opt-out skips for engagement triggers;
- send-time ineligible or suppressed reasons;
- safe error-code breakdowns;
- event lease recovery and retry counts;
- processing latency and last processed event.

`SMTP accepted` only means the configured SMTP server accepted the message. Do not report it as inbox delivery.

Increase hourly limits only after the approved observation window completes, backlog drains predictably, skip reasons are understood, no unapproved uncertain/failure gate is open, and SMTP outcomes match the change record.

## Rollback Checklist

1. Pause all running Continuous Activities.
2. Set `recall_campaign_setting.enabled=false` as the Recall operational control. In code, `RunRecallMaintenanceTick` returns immediately when this setting is false, scheduler config changes can wake the loop, and campaign activation/action mutation paths use the same disabled gate.
3. Disable continuous preview and activation at the operator/release-control layer while rollback is in progress.
4. Wait for drain before rolling back producers. Observe at least `max(configured recall_campaign_setting.tick_seconds, 5 minutes lifecycle event lease TTL, 60 seconds email message lease)`, then confirm active lifecycle leases, event enrollments, queued/sending message counts, and SMTP start counts are no longer increasing. Already-entered SMTP calls may continue after the setting changes; do not treat one scheduler tick as proof of drain.
5. If the rollback needs a stronger stop, stop the master Recall worker nodes after disabling the setting, then apply the same database and SMTP observation gate.
6. Roll back producer application nodes only after the continuous control plane is paused, disabled, and drained.
7. Keep additive schema, lifecycle events, recipients, messages, trigger slots, quota lifecycle state, and audit rows.
8. Keep registration, API requests, and payments running with prior behavior after the rollback.

Do not clear or rewrite audit rows to make rollback appear clean.

## Coverage Gap Rule

If rollback or an outage creates any producer coverage gap after the collection marker is written, v1 continuous lifecycle processing must stay disabled.

Do not restart v1 by reusing the old marker. Do not replace it with a new marker. Do not synthesize missing events from current balances or order state. Recovery requires a separate reviewed migration design. Collection epochs are outside this release.

## Verification Notes

This document is based on the approved lifecycle design and Task 13 rollout requirements. It does not claim live MySQL or PostgreSQL production validation, and it does not include database commands that were not run locally.
