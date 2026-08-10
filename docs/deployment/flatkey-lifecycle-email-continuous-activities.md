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
5. Only after all producer nodes are verified, insert the collection marker `recall_campaign_setting.lifecycle_event_collection_started_at` once, using database time.

The collection marker is a write-once coverage boundary. It means every producer-capable Console and router node was upgraded before that database timestamp. It is not a feature flag, not an editable setting, and not a reusable recovery token. If a marker already exists, do not update it, replace it, or reuse a new value for the same v1 rollout.

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
6. Start each trigger with a low hourly limit.
7. Wait for stable backlog, disposition, and SMTP outcome signals before activating the next trigger or raising throughput.

For service triggers, keep the no-unsubscribe policy visible during operator review. Do not activate service templates that contain coupons, discount language, win-back messaging, or promotional-only variables.

## Monitor Checklist

Monitor each trigger independently after activation:

- recorded events inside the task boundary;
- pending-not-due and due backlog;
- enrolled recipients and queued messages;
- disposition counts and safe skip reasons;
- `SMTP accepted`, uncertain, failed, and cancelled outcomes;
- no-account-email and invalid-email skips;
- engagement opt-out skips for engagement triggers;
- send-time ineligible or suppressed reasons;
- event lease recovery and retry counts;
- processing latency and last processed event.

`SMTP accepted` only means the configured SMTP server accepted the message. Do not report it as inbox delivery.

Increase hourly limits only after backlog drains predictably, skip reasons are understood, and SMTP accepted/uncertain/failure rates look stable.

## Rollback Checklist

1. Pause all running Continuous Activities.
2. Disable continuous preview, activation, and lifecycle workers.
3. Confirm no new lifecycle enrollment or SMTP delivery can start from continuous tasks.
4. Roll back producer application nodes only after the continuous control plane is paused and disabled.
5. Keep additive schema, lifecycle events, recipients, messages, trigger slots, quota lifecycle state, and audit rows.
6. Keep registration, API requests, and payments running with prior behavior after the rollback.

Do not clear or rewrite audit rows to make rollback appear clean.

## Coverage Gap Rule

If rollback or an outage creates any producer coverage gap after the collection marker is written, v1 continuous lifecycle processing must stay disabled.

Do not restart v1 by reusing the old marker. Do not replace it with a new marker. Do not synthesize missing events from current balances or order state. Recovery requires a separate reviewed migration design. Collection epochs are outside this release.

## Verification Notes

This document is based on the approved lifecycle design and Task 13 rollout requirements. It does not claim live MySQL or PostgreSQL production validation, and it does not include database commands that were not run locally.
