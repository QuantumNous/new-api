# Flatkey Lifecycle Email Continuous Activities Design

## Status

- Product design approved section by section in conversation on 2026-08-07.
- This document is the implementation contract for lifecycle email automation in Activity Configuration.
- The written specification still requires user review before implementation planning begins.
- The implementation must start from a fresh feature branch based on the latest `origin/main`; this documentation branch is not the implementation base.
- Repository baseline inspected at `593f5abf1615f6a5ddff53b5a1fe7751e11a6ecc`.

## Decision Summary

Extend the existing Recall/Activity Configuration subsystem instead of building a second email system.

The release will:

1. add `continuous` as a fourth internal Activity execution mode alongside the existing manual, scheduled-once, and recurring modes;
2. represent each lifecycle stage as one independently managed continuous Activity task;
3. write durable lifecycle events in the same database transaction as the corresponding registration, quota, or payment state change;
4. reuse existing Recall recipients, messages, SMTP delivery, pacing, retry, lease, history, localization, preview, and metrics capabilities;
5. deduplicate by business occurrence rather than by user alone, so a later quota cycle or a different order can legitimately trigger another email;
6. distinguish operational `service` mail from opt-out-aware `engagement` mail;
7. cover both wallet top-ups and subscription purchases;
8. let an operator choose the event-processing start time when activating a continuous task; and
9. recheck mutable eligibility immediately before SMTP admission.

The seven lifecycle triggers are:

- `user_registered`;
- `registration_unused`;
- `quota_low`;
- `quota_exhausted_unpaid`;
- `payment_failed`;
- `payment_pending`; and
- `payment_succeeded`.

## Problem

Flatkey currently has several direct or asynchronous email paths, but no single durable lifecycle-email workflow. Registration does not send a welcome email. The existing low-quota notification is not cycle-aware and does not provide separate depleted-balance behavior. Payment state changes are distributed across wallet and subscription code paths and multiple providers. Delayed conditions such as seven days without an API request and a payment remaining pending for 24 hours are not represented as durable work.

Sending these emails directly from registration, billing, and payment handlers would duplicate template, SMTP, retry, pacing, audit, and multi-node coordination behavior that the Activity subsystem already provides. It would also make repeated provider callbacks or concurrent quota settlement vulnerable to duplicate mail.

The current recurring Activity enrollment model also cannot be reused unchanged. Its campaign-local recipient identity is user-based, so one user is normally enrolled only once per campaign. Lifecycle messaging instead needs one enrollment per business occurrence, such as a quota cycle or trade number.

## Goals

- Automatically send the seven approved lifecycle emails.
- Keep registration, API settlement, and payment callbacks independent of SMTP latency and availability.
- Guarantee database-level idempotency across retries, callback replay, restarts, and multiple application nodes.
- Let the same user receive a later valid email for a new quota cycle or a different order.
- Preserve the existing Activity admin workflow, localized templates, pacing, retries, history, and metrics.
- Always resolve the current account-bound email instead of following Webhook, Bark, Gotify, or user notification-channel settings.
- Give operators a safe, previewable processing-start-time choice.
- Keep all migrations compatible with SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+.

## Non-goals

- Do not build a second SMTP sender, message queue, campaign console, or analytics ledger.
- Do not introduce Kafka, RabbitMQ, Asynq, Temporal, or another infrastructure dependency.
- Do not infer historical quota threshold crossings that occurred before lifecycle event collection began.
- Do not support reactivating continuous lifecycle tasks after a rollback or outage creates a producer-coverage gap; v1 must remain disabled until a separately reviewed recovery design and migration is implemented.
- Do not turn service emails into promotional messages or attach coupons to them.
- Do not add multiple email stages to one lifecycle occurrence in the first release.
- Do not treat an SMTP acceptance response as proof that a message reached the inbox.
- Do not add bounce or complaint webhooks for arbitrary SMTP providers.
- Do not make registration or payment handlers wait for email rendering or SMTP delivery.
- Do not change marketing opt-out semantics for existing Activity campaigns.

## Existing Baseline to Reuse

The current `origin/main` already contains:

- `RecallCampaign`, `RecallRecipient`, `RecallMessage`, and `RecallEvent` persistence;
- manual, one-time, and daily/weekly recurring execution;
- content-only campaigns and localized email templates;
- dedicated Activity SMTP configuration;
- multipart MIME, `Reply-To`, deterministic `Message-ID`, and retry-safe MIME boundaries;
- `List-Unsubscribe` and RFC 8058 one-click headers;
- global hourly limits and even global pacing;
- database-backed recipient and message leases;
- retry and uncertain-outcome handling;
- recipient, message, event, conversion, and metric history;
- revision-fenced campaign edits and activation validation; and
- multi-node-safe workers.

The lifecycle feature must extend these paths. It must not call the generic user notification dispatcher because that dispatcher may redirect a notification to Webhook, Bark, or Gotify and may use a notification override address.

## Product Semantics

### Registration without usage

`registration_unused` means:

```text
now >= users.created_at + 7 * 24 hours
AND users.request_count == 0
```

It does not require the user to have created a Key. A user with no Key and a user with a Key that has never successfully called the API are both eligible. `Token.AccessedTime` is not authoritative because token creation initializes it and a default Key may not exist.

### Pending and failed payment

`payment_pending` is a delayed engagement reminder. It is created with the order and becomes due at exactly `order.create_time + 24 hours`. It sends only while the order is still `pending`, at most once per order.

`payment_failed` is separate. It represents an explicit terminal result supplied by the payment workflow, including normalized `failed`, `cancelled`, or final `expired` states. Merely remaining pending for 24 hours does not convert an order to failed.

If a failure is corrected before its email reaches SMTP, the failure email is skipped. If failure mail was already accepted and the order later succeeds, the normal success email may still be sent because it communicates a new final state.

### Quota cycles

Wallet balance and subscription balance are independent scopes.

Each scope has a current quota cycle. Registration creates the initial wallet cycle. A successful wallet top-up starts a new wallet cycle. A successful subscription purchase or renewal starts a new cycle for the relevant subscription balance scope.

Scope and cycle identities are canonical and replayable:

- Wallet uses `scope_type=wallet` and `scope_id=<user_id>`.
- The initial wallet cycle is `registration:<user_id>`.
- A successful wallet top-up rotates to `topup:<topup.trade_no>`. If the legacy row has no trade number, use `topups:<topup.id>`.
- Subscription balance uses `scope_type=subscription` and `scope_id=<user_subscription_id>`, where the ID is the authoritative activated subscription-balance row, not a plan ID or provider customer ID.
- A successful subscription purchase or renewal rotates that subscription scope to `subscription_order:<subscription_order.trade_no>`. If the legacy row has no trade number, use `subscription_orders:<subscription_order.id>`.
- A balance-funded subscription purchase or renewal uses the same successful `SubscriptionOrder` identity for the new subscription cycle. Its wallet debit updates the wallet scope but does not rotate the wallet cycle.
- An administrative grant, refund, invite reward, or other non-payment balance adjustment updates the current scope balance but does not rotate its cycle.
- A pre-existing wallet or subscription scope with no lifecycle-state row is initialized lazily from its locked authoritative balance with `baseline:<scope_type>:<scope_id>`. This deterministic baseline is initialization, not a cycle rotation.

`quota_low` occurs only on a downward threshold crossing:

```text
previous_balance >= effective_threshold
AND current_balance < effective_threshold
AND current_balance > 0
```

The effective threshold is the user's `QuotaWarningThreshold` when configured, otherwise the global `QuotaRemindThreshold`.

`quota_exhausted_unpaid` occurs when the relevant scope crosses from a positive balance to `<= 0`. “Unpaid” means that no newer successful top-up or renewal has restored or replaced that depleted cycle before send time; it does not mean the user has never paid in their lifetime.

If one settlement moves balance directly from at or above the threshold to `<= 0`, only `quota_exhausted_unpaid` is created. The user must not receive low-quota and exhausted-quota emails for the same deduction.

## Trigger Contract

| Trigger | Event creation | Due time | Occurrence key inputs | Send-time gate | Policy |
| --- | --- | --- | --- | --- | --- |
| `user_registered` | First successful user creation | Immediate | User ID | User exists, is usable, and has a valid current account email | `service` |
| `registration_unused` | Same user-creation transaction | `created_at + 7x24h` | User ID | `request_count == 0` | `engagement` |
| `quota_low` | Downward crossing into the positive low-balance range | Immediate | User, balance scope, quota cycle | Same scope remains `0 < balance < effective threshold` and the cycle has not changed | `service` |
| `quota_exhausted_unpaid` | Positive balance crosses to `<= 0` | Immediate | User, balance scope, quota cycle | Same scope remains exhausted and no newer successful payment or renewal exists | `service` |
| `payment_failed` | First normalized transition to a provider-declared terminal failure | Immediate | Purchase kind and trade/order number | Order remains terminally failed and has not been corrected to success | `service` |
| `payment_pending` | Order creation | `create_time + 24h` | Purchase kind and trade/order number | Order is still `pending` | `engagement` |
| `payment_succeeded` | First committed transition to success | Immediate | Purchase kind and trade/order number | Order remains successful | `service` |

Wallet top-ups and subscription orders are both valid purchase kinds for all applicable payment triggers.

## Delivery Policy

### `service`

Service mail covers:

- registration success;
- low quota;
- exhausted quota before the next payment;
- explicit payment failure; and
- payment success.

It has these rules:

- ignore the marketing opt-out flag;
- omit the body unsubscribe link;
- omit `List-Unsubscribe` and `List-Unsubscribe-Post` headers;
- prohibit coupon, discount, promotion-code, or win-back configuration;
- keep the content strictly limited to the user's account, quota, order, or completed action; and
- resolve only the current account-bound email.

The Console must display a visible operational-content warning when editing a service template. Backend validation must reject promotion/coupon configuration and promotion-only template variables. Arbitrary prose cannot be classified perfectly by code, so operator copy review remains part of activation.

### `engagement`

Engagement mail covers:

- seven-day registration-without-usage; and
- payment still pending after 24 hours.

It has these rules:

- respect the existing marketing opt-out state;
- retain the body unsubscribe link;
- add `List-Unsubscribe`;
- add `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; and
- resolve only the current account-bound email.

### Address resolution

Lifecycle mail does not follow notification-channel settings and does not use Webhook, Bark, Gotify, or a notification-only address. Immediately before SMTP admission, the worker reloads the user and resolves `users.email` as the account-bound address.

If the address is missing or invalid, the occurrence is terminally skipped with an auditable reason. A missing email never makes registration, quota settlement, or payment state changes fail.

## Architecture

The design has three planes.

### Control plane: Activity Configuration

`RecallCampaign` remains the administrative source of truth. A continuous lifecycle task owns:

- one lifecycle trigger;
- one delivery policy determined by that trigger;
- one localized email stage;
- one immutable processing-start time after activation;
- draft/running/paused/cancelled lifecycle;
- template revision;
- worker concurrency; and
- existing hourly pacing and metrics behavior.

At most one running or paused continuous task may own a trigger at a time. Draft tasks do not reserve the trigger.

### Enrollment plane: lifecycle events

Registration, quota, and payment code writes small durable events. A continuous matcher leases due events for the task's trigger, rechecks enrollment facts, and either:

- atomically creates an occurrence-scoped `RecallRecipient` plus its initial `RecallMessage`; or
- records a terminal skip disposition.

The matcher never sends email. It only converts a business occurrence into the existing Recall delivery state machine.

### Delivery plane: existing Recall workers

Existing recipient/message/email workers continue to provide:

- template snapshots and localization;
- database leases and fencing;
- SMTP admission, global pacing, and hourly limits;
- retries and uncertain-outcome handling;
- deterministic `Message-ID` reuse;
- pause/cancel behavior; and
- delivery history and metrics.

Before SMTP admission, a lifecycle-specific gate reloads the current user, quota scope, and order facts. It refreshes the account email snapshot only while the message is still safely pre-send.

## Data Model

All fields and indexes must work on SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+. JSON-shaped configuration and event data use `TEXT` plus the repository `common` JSON wrappers.

### `RecallCampaign` additions

Add:

| Field | Purpose |
| --- | --- |
| `DeliveryPolicy` | `engagement` or `service`; existing campaigns default to `engagement`. |
| `LifecycleTrigger` | Empty for legacy campaigns; one of the seven trigger identifiers for `continuous`. |
| `LifecycleTriggerConfig` | Versioned JSON configuration reserved for trigger-compatible parameters. Core 7-day, 24-hour, and threshold-source semantics remain server validated. |
| `ProcessingStartAt` | Operator-selected event eligibility (`AvailableAt`) boundary, frozen at activation. |

`ExecutionMode` gains `continuous` as a fourth internal value. The complete internal set is `manual`, `scheduled_once`, `recurring`, and `continuous`. The Console labels map exactly as follows:

| Console label | Internal value |
| --- | --- |
| Manual | `manual` |
| Once | `scheduled_once` |
| Recurring | `recurring` |
| Continuous | `continuous` |

`manual` remains the existing operator-triggered mode and is not renamed or folded into Once. The existing due-campaign query remains limited to `scheduled_once` and `recurring`; its behavior and predicates do not change. `continuous` is never returned by that query and is consumed only by the lifecycle-event worker. Existing manual execution continues through its current explicit path.

For the first release, a continuous task must use a content-only email shape, exactly one email stage, and no promotion configuration. `DeliveryPolicy`, not the content-only campaign type, controls unsubscribe behavior.

### `RecallLifecycleEvent`

Add an outbox/work table with at least:

| Field | Purpose |
| --- | --- |
| `Id` | Stable event identity. |
| `EventType` | One of the seven lifecycle triggers. |
| `OccurrenceKeyHash` | SHA-256 of a canonical, versioned business-occurrence string. |
| `UserId` | Flatkey user associated with the event. |
| `ScopeType`, `ScopeId` | Wallet, subscription, or purchase scope. |
| `BusinessKey` | Bounded order/trade/cycle reference for audit; never an email address. |
| `OccurredAt` | Time of the authoritative business state transition. |
| `AvailableAt` | Earliest enrollment time; future for 7-day and 24-hour triggers. |
| `SchemaVersion` | Event payload contract version. |
| `EventData` | Minimal non-secret fact snapshot in `TEXT`. |
| `Disposition` | `pending`, `leased`, `enrolled`, `skipped`, or `failed`. |
| `CampaignId`, `RecipientId` | Activity and recipient that resolved the event, when applicable. |
| `LeaseOwner`, `LeaseExpiresAt` | Multi-node event ownership. |
| `AttemptCount`, `LastErrorCode` | Bounded retry and audit state. |
| `ResolvedAt`, `CreatedAt`, `UpdatedAt` | Lifecycle timestamps. |

The unique key is `(event_type, occurrence_key_hash)`. Due-event scans use an index covering event type, disposition, available time, occurrence time, and ID.

The canonical occurrence strings include:

```text
v1|user_registered|user:<user_id>
v1|registration_unused|user:<user_id>
v1|quota_low|<scope_type>:<scope_id>|cycle:<cycle_key>|user:<user_id>
v1|quota_exhausted_unpaid|<scope_type>:<scope_id>|cycle:<cycle_key>|user:<user_id>
v1|payment_failed|<purchase_kind>|trade:<trade_no>
v1|payment_pending|<purchase_kind>|trade:<trade_no>
v1|payment_succeeded|<purchase_kind>|trade:<trade_no>
```

If a trade number is absent, use a stable source-table name and source-row ID. Never use a timestamp or random UUID as a fallback for a replayable business event.

Quota occurrence examples therefore resolve to stable strings such as:

```text
v1|quota_low|wallet:42|cycle:registration:42|user:42
v1|quota_exhausted_unpaid|wallet:42|cycle:topup:fk_20260807_001|user:42
v1|quota_low|subscription:913|cycle:subscription_order:sub_20260807_002|user:42
```

### Continuous trigger slot

Add one `RecallContinuousTriggerSlot` row per trigger. The trigger is the primary key. The row stores the currently owning campaign ID and is locked during activation, cancellation, and replacement.

Migration or startup initialization conflict-safely inserts all seven fixed trigger rows with no owner. Every node may run the seed concurrently; duplicate-key results are successful no-ops. Activation must also perform an insert-if-absent repair for its selected trigger inside the activation transaction, then reread and lock the row before claiming it. If the row cannot be repaired, reread, or locked, activation fails closed and leaves the campaign non-running. A missing slot must never be interpreted as an unowned trigger.

This ordinary-row locking pattern avoids non-portable partial unique indexes and guarantees that two application nodes cannot activate different tasks for the same trigger concurrently. A paused task retains the slot. Cancellation clears it.

### Quota lifecycle state

Add `QuotaLifecycleState`, uniquely keyed by `(user_id, scope_type, scope_id)`, with:

- current cycle key;
- last committed balance;
- last effective warning threshold;
- source payment/order reference for the cycle;
- created and updated timestamps; and
- any version field required for compare-and-swap updates.

Quota settlement locks or conditionally updates this row together with the authoritative balance change and event insert. Successful top-up or renewal rotates the cycle in the same transaction as payment success.

### Lifecycle-aware quota mutation API

Introduce one model-layer transaction primitive, `ApplyLifecycleQuotaMutation(tx, mutation)`, as the only allowed authoritative wallet or subscription balance mutation path after this feature is deployed. The request carries the user ID, canonical scope tuple, signed delta or guarded absolute update, mutation cause, stable source reference, current effective threshold inputs, and an optional next cycle key. A next cycle key is valid only for a committed successful wallet top-up or subscription purchase/renewal.

Within one database transaction, the primitive:

1. locks or compare-and-swap guards the authoritative balance and `QuotaLifecycleState`;
2. derives the previous committed balance and current cycle, lazily creating the deterministic baseline cycle when an existing scope has no state row;
3. applies the balance mutation exactly once;
4. rotates the cycle only when the request carries an allowed successful-payment cycle key;
5. evaluates downward low/exhausted crossings, including the above-to-zero suppression rule;
6. conflict-safely inserts any lifecycle event; and
7. stores the resulting balance, threshold, cycle, and source reference before commit.

All current balance paths must delegate to this primitive or to a thin wrapper around it. This includes wallet pre-consume, settlement, reserve, refund, and adjustment calls currently reached through `IncreaseUserQuota`, `DecreaseUserQuota`, and `PreConsumeUserQuota`; `BillingSession` and funding-source reserve/refund; synchronous and asynchronous task billing; compute reserve/refund; administrative quota edits; provider top-up completion; subscription purchase, renewal, reset, debit, and refund paths; and future balance mutation entry points. Direct SQL/GORM arithmetic or a direct subscription-balance mutation that bypasses this primitive is a correctness defect.

The existing `BatchUpdateStore` cannot be the authoritative wallet/subscription balance path because an aggregated or delayed delta cannot preserve ordered threshold crossings in the same transaction as lifecycle state and events. When lifecycle-capable quota code is deployed, covered balance mutations must commit synchronously through `ApplyLifecycleQuotaMutation`, even when `common.BatchUpdateEnabled` is true. Batch updating may remain for non-authoritative usage/log aggregates. Existing `db=false` callers must be converted to lifecycle-aware adapters instead of enqueueing wallet or subscription balance deltas. Router load and database contention from this deliberate compatibility change must be measured before production rollout.

### Existing recipient and message reuse

Add nullable `LifecycleEventId` to `RecallRecipient` with a unique index. Legacy recipients leave it null.

For a lifecycle enrollment, `RecipientIdentity` is an occurrence identity rather than `user:<id>`:

```text
occ:<sha256(event_type | occurrence_key_hash)>
```

The existing unique `(campaign_id, recipient_identity)` protects campaign-local retry. Unique `lifecycle_event_id` prevents a cancelled/recreated campaign from delivering the same lifecycle occurrence again. `UserId` remains populated for recipient lookup and conversion/audit joins.

`RecallMessage` continues to use unique `(recipient_id, stage_no)`. The first release creates only stage 1.

## Transaction and Data Flow

### Event production

The event row must be inserted in the same database transaction as the state transition that proves it:

- user insertion produces immediate registration and delayed unused-registration events;
- wallet or subscription order creation produces the delayed pending-payment event;
- the first terminal failure transition produces a failed-payment event;
- the first success transition produces a successful-payment event and rotates the applicable quota cycle;
- quota settlement updates balance state and produces low or exhausted events when a crossing occurs.

Duplicate registration callbacks, payment callbacks, or settlement retries use conflict-safe insert behavior. A duplicate unique event is a successful no-op, not an error.

The transaction performs no localization, template rendering, HTTP request, SMTP connection, or other external side effect.

### Payment producer coverage

Introduce one shared transaction-aware primitive, `PersistPurchaseLifecycleTransition(tx, transition)`, for purchase creation and normalized state transitions. It updates the authoritative `TopUp` or `SubscriptionOrder`, inserts the matching lifecycle event, and, for a first committed success, invokes the quota mutation primitive to apply credit and rotate the correct cycle. Provider handlers may normalize external statuses, but they must not update purchase status, grant quota, or rotate a cycle outside this primitive.

The required integration matrix is:

| Business transition | Existing integration anchors that must delegate | Required lifecycle result |
| --- | --- | --- |
| Wallet order created in `pending` | Every `TopUp` insert/checkout creation path | One `payment_pending` event with `available_at=create_time+24h`. |
| Subscription order created in `pending` | `SubscriptionOrder.Insert` and every provider or recurring-order creation wrapper | One `payment_pending` event with `available_at=create_time+24h`. |
| Wallet first terminal success | `RechargeWithPaymentSnapshot`, `RechargeCreem`, `RechargeWaffo`, `RechargeWaffoPancake`, `RechargePaddle`, and any other wallet success variant | One `payment_succeeded` event, wallet credit, and one wallet-cycle rotation keyed by the successful `TopUp`. |
| Subscription first terminal success | `CompleteSubscriptionOrder`, `CompleteSubscriptionOrderWithProviderBinding`, recurring renewal completion, and provider-specific success wrappers | One `payment_succeeded` event, subscription activation/credit, and one subscription-cycle rotation keyed by the successful `SubscriptionOrder`. |
| Balance-funded subscription purchase or renewal | Direct balance-purchase/renewal paths that currently bypass `CompleteSubscriptionOrder` | Wallet debit through `ApplyLifecycleQuotaMutation`; one subscription `payment_succeeded` event and subscription-cycle rotation. Do not create a pending event unless the committed order actually entered `pending`. |
| First terminal failure, cancellation, or final expiry | `UpdatePendingTopUpStatus`, `ExpireSubscriptionOrder`, and every provider-specific terminal-state wrapper | One `payment_failed` event for the first normalized `failed`, `cancelled`, or final `expired` transition; no cycle rotation. |
| Provider callback replay or concurrent completion | Every wallet and subscription callback path | Lock/compare-and-swap the source row; an already-applied state is a successful no-op and cannot insert another event, grant quota twice, or rotate the cycle twice. |

Future providers must enter through the same primitives. Tests must enumerate every current provider callback and balance-funded path so adding a provider-specific direct status or quota write fails review.

### Event enrollment

For each running continuous task, workers select bounded batches where:

```text
event_type = campaign.lifecycle_trigger
AND disposition is pending or recoverably leased
AND occurred_at >= lifecycle_event_collection_started_at
AND available_at >= campaign.processing_start_at
AND available_at <= database_now
```

The collection marker constrains source-event completeness, while `ProcessingStartAt` constrains when an occurrence becomes eligible. For immediate triggers, `AvailableAt == OccurredAt`. For delayed triggers, an order or registration recorded before the selected start remains eligible when its 24-hour or 7-day due time falls on or after the selected start. A delayed occurrence that was already due before the selected start is not enrolled.

Claim uses database time, an exact lease owner/expiry fence, and cross-database-safe compare-and-swap behavior. In one transaction the winner:

1. locks or revalidates the event;
2. reads current account, quota, or order facts;
3. records a terminal skip or creates the recipient and stage-1 message;
4. links event, campaign, recipient, and message audit records; and
5. commits the event disposition.

A malformed event must not block later events. Permanent schema/data errors become a terminal failed disposition with a safe code. Temporary database errors release or expire the lease for retry.

### Send-time gate

Immediately before the existing `leased -> sending` SMTP admission transaction, lifecycle messages recheck:

- account still exists and is usable;
- current account email is valid;
- engagement opt-out state when applicable;
- `request_count == 0` for registration-unused;
- relevant balance range and cycle for quota-low;
- relevant balance remains exhausted with no newer payment for exhausted-unpaid;
- current order status for pending, failed, and succeeded payment mail; and
- campaign remains active for sending.

If the gate fails, the message and recipient transition to the existing ineligible/suppressed/cancelled path with a lifecycle-specific reason. SMTP quota and pacing are not consumed.

## Processing Start Time

Activation requires a processing start choice:

- `From now` is the default.
- `Custom date and time` may select an earlier boundary.

The earliest allowed value is stored in the existing `options` table at key `recall_campaign_setting.lifecycle_event_collection_started_at`. Its value is a decimal Unix timestamp obtained from database time. It is a write-once coverage marker, not an editable Console setting.

The marker is inserted conflict-safely only after every producer-capable Console and router node has been upgraded and is emitting durable lifecycle events. Multiple nodes or rollout retries may attempt the insert, but the first committed value wins and later attempts must return the stored value without changing it. Continuous-task preview and activation read the persisted database value strongly consistently; a missing or invalid marker blocks activation. Events emitted by partially upgraded nodes before the marker may remain for audit but cannot be selected by a task.

The UI must not allow a time before that boundary because quota crossings cannot be reconstructed accurately from current balance. `From now` resolves to database time during activation, not the browser clock. A custom boundary must be greater than or equal to the collection marker and no later than activation database time. The selected time applies to event eligibility (`AvailableAt`), not only to source-row creation time, so registrations and pending orders recorded earlier can still mature after the task starts.

Before activation, the Console shows:

- selected start time and timezone;
- earliest available event time;
- estimated matching event count;
- currently due count;
- a bounded, masked event sample; and
- a warning that send-time rechecks can reduce the final recipient count.

Activating with a past start processes matching recorded events in event order. Already resolved lifecycle events remain resolved and cannot be duplicated. Existing pacing and hourly limits absorb the backlog.

Pausing freezes new event enrollment and SMTP delivery for that campaign while events continue to accumulate. Resuming processes the backlog from the immutable start boundary. Cancelling cancels unsent messages and releases the trigger slot. Already resolved occurrences are not reset.

Events older than the collection boundary require an explicit one-time Activity or a separately designed historical import. They are not silently synthesized by the continuous task.

## Admin Console Design

### Creation flow

Add `Continuous` to the existing execution mode choices without removing Manual:

```text
Manual / Once / Recurring / Continuous
```

When `Continuous` is selected:

- replace static Audience Template controls with Lifecycle Trigger;
- hide scheduled-once and daily/weekly recurrence controls;
- hide coupons, discounts, promotion expiry, and product scope;
- show the trigger's fixed delivery-policy badge and explanation;
- show processing-start-time controls;
- retain task name, localization, preview, test send, worker concurrency, and hourly limit;
- allow exactly one email stage and hide add-stage controls; and
- show trigger-specific template variables.

The seven trigger options display their exact business conditions. The 7-day delay, 24-hour delay, and quota threshold source are explanatory and server-validated rather than freely editable in this release.

### Activation and editing

- Draft tasks do not claim a trigger slot.
- Activation fails if another running or paused task owns the trigger.
- After activation, trigger, delivery policy, and processing start time are immutable.
- Template text, translations, name, concurrency, and pacing limits remain revision-fenced editable fields where the existing Activity contract allows them.
- Changing the trigger requires a new draft task.
- Service-template activation displays the operational-content warning and blocks promotion configuration.

### Templates and variables

Each trigger exposes only applicable variables, such as:

- site name, user display name, Console URL, documentation URL;
- quota scope, balance snapshot, effective threshold, and top-up URL;
- purchase kind, trade/order number, amount, currency, provider, and payment URL; and
- relevant event and completion timestamps.

Templates continue to use the existing localized subject, text, and HTML forms. Template data is versioned and validated. User-controlled values are escaped according to their output context.

### Operations and metrics

The list adds Execution Mode and Lifecycle Trigger columns. The details view adds:

- events recorded within the task boundary;
- pending-not-due and due backlog;
- leased and enrolled counts;
- queued, SMTP accepted, uncertain, failed, and cancelled messages;
- send-time ineligible/suppressed counts;
- no-email and engagement-opt-out counts;
- event lease recovery and retry counts;
- last processed event and processing latency; and
- safe error-code breakdowns.

Continuous tasks do not show a traditional static-audience preview. They show rule text, start-time event estimates, masked recent samples, and test-email preview instead.

## Error Handling

| Area | Required behavior |
| --- | --- |
| Duplicate source event | Conflict-safe success; never create a second lifecycle event. |
| Missing/invalid account email | Terminal skip `no_account_email` or `invalid_email`; no retry. |
| Engagement opt-out | Terminal skip/suppression `engagement_opted_out`; service mail ignores this flag. |
| Mutable condition changed | Terminal ineligible result such as `registration_used`, `quota_recovered`, `quota_cycle_changed`, or `order_state_changed`. |
| Temporary database error | Release/expire event or message lease and retry with bounded backoff. |
| Invalid event schema | Terminal failed event with safe version/error code; do not block the queue. |
| Template/localization error | Block activation when statically detectable; otherwise fail before SMTP without retrying invalid content. |
| SMTP temporary failure | Reuse existing safe automatic retry policy. |
| SMTP permanent failure | Reuse existing terminal failed state. |
| SMTP uncertain result | Reuse existing uncertain/manual-acknowledgement behavior; do not blindly retry. |
| Node termination | Exact lease expiry and fencing allow another node to continue. |
| Paused task | No new enrollment or SMTP sends; keep durable backlog. |
| Cancelled task | Cancel unsent messages, release trigger slot, preserve all history. |

Manual retry of a failed message reuses the same recipient, occurrence, message row, and deterministic `Message-ID`. It does not create a second lifecycle event.

## Audit and Privacy

Every lifecycle delivery must be traceable as:

```text
business source row
-> lifecycle event
-> continuous Activity task
-> occurrence-scoped recipient
-> message and template snapshot
-> SMTP attempts
-> final accepted, skipped, suppressed, uncertain, failed, or cancelled state
```

Use stable, safe reason codes. Do not place raw email addresses, SMTP errors, provider payloads, secrets, checkout tokens, or full templates into lifecycle event data or application logs.

Admin APIs remain under existing Recall admin authorization. Event samples and histories mask email addresses in list responses unless an existing privileged detail contract explicitly permits the full account email.

`SMTP accepted` means the configured SMTP server accepted the message. The UI must not label it as inbox-delivered. Bounce and complaint metrics remain unavailable until a provider-specific callback design is approved.

## API Validation Contract

Existing campaign create/update/activate endpoints gain continuous-task fields. The backend, not only the Console, enforces:

- supported execution mode and trigger;
- trigger-to-delivery-policy mapping;
- content-only, one-stage, no-promotion lifecycle shape;
- one active/paused task per trigger;
- start time not earlier than event collection;
- required localized templates and variables;
- immutable fields after activation; and
- revision-fenced updates.

Audience-preview behavior for continuous tasks is replaced by an event-boundary preview response containing counts, earliest available time, and bounded masked samples. Unsupported legacy audience or recurrence fields are rejected instead of silently ignored.

## Backward Compatibility and Migration

Migrations are additive:

- add the lifecycle fields to `recall_campaigns`;
- add nullable unique `lifecycle_event_id` to `recall_recipients`;
- create `recall_lifecycle_events`;
- create `recall_continuous_trigger_slots`; and
- create `quota_lifecycle_states`.

The migration/startup path conflict-safely seeds all seven trigger-slot rows. It must not create `recall_campaign_setting.lifecycle_event_collection_started_at`; that write occurs only at the rollout barrier after all producer nodes are upgraded.

Existing campaigns receive `delivery_policy = engagement`, an empty lifecycle trigger, and no lifecycle event link. Their scheduling, audience deduplication, templates, unsubscribe behavior, and metrics remain unchanged.

Do not use partial unique indexes. Use ordinary unique keys, trigger-slot rows, row locks, and compare-and-swap updates that work across all supported databases. Register tables and columns in every applicable full/fast migration path.

No destructive rollback is required. Rolling back application code must leave new tables and columns intact.

## Testing Strategy

### Trigger semantics

- Cover password, OAuth, and other user-creation paths, including users without email.
- Assert registration-unused becomes due at exactly `created_at + 7x24h` and uses `request_count == 0`.
- Assert Key existence and `Token.AccessedTime` do not change the unused definition.
- Assert pending payment becomes due at exactly `create_time + 24h` and only while status remains pending.
- Cover explicit failed, cancelled, expired, corrected-to-success, and replayed payment callbacks.
- Cover both wallet `TopUp` and `SubscriptionOrder` events for every supported provider path.
- Verify a failed message is skipped when success wins before SMTP, while a later success occurrence remains valid.

### Quota lifecycle

- Cover user threshold and global fallback threshold.
- Cover above-to-low, low-to-lower, low-to-zero, above-to-zero, zero-to-positive, and positive-to-low transitions.
- Assert above-to-zero produces only exhausted mail.
- Assert one low and one exhausted event at most per quota cycle.
- Assert successful top-up or renewal rotates the correct scope and permits a later cycle to trigger again.
- Assert wallet and subscription scopes do not suppress each other.
- Assert administrative grants do not rotate a payment-defined cycle.
- Assert the canonical wallet/subscription scope and cycle keys match registration, successful top-up, successful subscription order, balance-funded renewal, and administrative-adjustment rules.
- Exercise every wallet/subscription mutation entry point with `common.BatchUpdateEnabled` both false and true and prove authoritative balance writes never bypass lifecycle state/event transactions.
- Race concurrent settlements and verify one event per business occurrence.

### Idempotency and multi-node behavior

- Replay registration and payment mutations and verify the event unique key wins once.
- Run two event workers against the same due row and assert one lease owner, one recipient, and one stage-1 message.
- Expire an event lease and verify a second node recovers without duplicate enrollment.
- Cancel and recreate a trigger task with an overlapping start time and verify resolved lifecycle events are not delivered twice.
- Race task activation on two nodes and assert the trigger slot admits one campaign.
- Race trigger-slot seeding on multiple nodes, delete one slot in a test, and verify activation repairs it or fails closed.
- Race collection-marker insertion and verify one database-time value wins, cannot be edited, and is required by preview/activation.
- Verify stale lease owners cannot commit an enrollment or send-time transition.

### Delivery policy and MIME

- Assert every service trigger omits body and header unsubscribe controls.
- Assert every engagement trigger respects opt-out and includes body unsubscribe, `List-Unsubscribe`, and RFC 8058 one-click headers.
- Assert notification-channel preferences never redirect lifecycle mail away from the account email.
- Change the account email between event creation and send and verify the current valid account address is used.
- Assert retries reuse the deterministic `Message-ID` and existing uncertain-outcome behavior.

### Console and API

- Cover continuous create, validation, preview, activation, duplicate-trigger rejection, pause, resume, cancel, and immutable-field rules.
- Verify a custom start time processes recorded events and a time before collection is rejected.
- Verify backlog estimates are labeled as estimates and masked samples expose no secrets.
- Verify one-stage template editing, translation, preview, and test send.
- Verify existing Manual, Once, and Recurring campaign fixtures, labels, due-query behavior, and UI flows remain unchanged.
- Verify all new visible strings have real translations in all Console locale files.

### Database compatibility

- Exercise migrations and unique/index definitions on SQLite, MySQL, and PostgreSQL test/dry-run paths.
- Include a real SQLite concurrency test and dialect-aware locking/CAS tests.
- Avoid database-specific JSON, partial-index, timestamp, or upsert assumptions without a tested fallback.

Minimum implementation verification includes:

```text
go test ./model ./service ./controller -run "Recall|Lifecycle|Quota|TopUp|Subscription"
cd web/default && bun test src/features/recall-campaigns
cd web/default && bun run typecheck
cd web/default && bun run i18n:sync
```

The implementation must also run relevant full package suites, lint/build checks, migration compatibility checks, and local browser smoke tests.

## Rollout

This feature changes shared Go models, registration/payment paths, quota settlement used by relay traffic, Recall workers, database schema, and the embedded Console frontend.

- `newapi-console`: required.
- `newapi-router`: required because router-side quota settlement must emit lifecycle events consistently and shared schema/runtime code changes.
- `newapi-web`: not required.
- Database migration: required before event collection.
- Terraform and Cloudflare: not required.

Roll out in this order:

1. Apply additive migrations with continuous preview, activation, and workers disabled.
2. Deploy the new shared Go image to every Console and router node; upgraded nodes begin emitting durable lifecycle events, but no task may consume them yet.
3. Verify every producer-capable node is upgraded and emitting the complete producer matrix.
4. Conflict-safely insert `recall_campaign_setting.lifecycle_event_collection_started_at` using database time; never update an existing value.
5. Create seven draft tasks and validate localized templates with test SMTP/test recipients.
6. Preview a safe start boundary for each task.
7. Activate tasks one at a time with a low hourly limit.
8. Observe backlog, skip reasons, SMTP outcomes, opt-outs, and processing latency before increasing throughput.

During a mixed-version deployment, do not claim event coverage before the write-once marker exists. On rollback, pause continuous tasks and disable preview, activation, and workers before rolling back producer nodes, but retain all schema and audit rows. If rollback or an outage creates a producer-coverage gap, v1 is not restartable: keep the feature disabled and do not reuse or replace the old marker. Restoring continuous lifecycle processing then requires a separate reviewed design and migration; collection epochs are explicitly outside this release. Registration, API requests, and payments continue with the prior behavior after rollback.

## Alternatives Rejected

### Direct email calls in each business handler

Rejected because they would duplicate SMTP, templates, pacing, retries, audit, and failure behavior. They would also be fragile under payment callback replay and multi-node quota settlement.

### Treat lifecycle conditions as ordinary recurring audiences

Rejected because the existing user identity deduplication cannot represent repeated quota cycles or multiple orders for one user. A scheduled scan also loses the authoritative state-transition boundary.

### Separate lifecycle-email subsystem

Rejected because it would duplicate the mature Recall delivery and Activity Configuration control planes.

### Mark every lifecycle email as marketing or every email as service

Rejected because registration-unused and pending-payment reminders require opt-out handling, while operational account/quota/order confirmations must not depend on marketing preferences.

### Unlimited historical scan

Rejected because exact historical quota crossings and cycles cannot be reconstructed before durable event collection. Operator-selected time remains available within the recorded event window.

### Multiple active tasks for the same trigger

Rejected for the first release because it makes duplicate lifecycle communication easy and introduces undefined A/B-test ownership semantics.

## Completion Criteria

The feature is complete only when:

- all seven triggers cover both applicable wallet and subscription flows;
- delayed boundaries are exactly 7x24 hours and 24 hours;
- one business occurrence creates at most one lifecycle event, recipient, and stage-1 message across nodes and task replacement;
- a new quota cycle or different order can legitimately trigger again;
- low-quota and exhausted-quota rules, including direct above-to-zero suppression, pass tests;
- account email resolution and every send-time gate pass tests;
- service and engagement unsubscribe/MIME behavior match the approved matrix;
- processing start time can be selected within the recorded event window with preview and pacing;
- existing manual, one-time, and recurring campaigns remain unchanged;
- SQLite, MySQL, and PostgreSQL compatibility checks pass;
- all Console locales and UI flows pass validation;
- staging rollout validates event collection, backlog processing, pause/resume, and SMTP outcomes; and
- deployment notes explicitly include both Console and router nodes.
