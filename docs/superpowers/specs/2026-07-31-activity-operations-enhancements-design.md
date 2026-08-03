# Activity Operations Enhancements Design

## Status

- Product design approved in conversation on 2026-07-31.
- This document is the implementation contract for the approved Activity Configuration enhancements.
- Implementation must start from a fresh feature branch based on the latest `origin/main`. The current documentation branch is not the implementation base.

## Decision Summary

Extend the existing Recall campaign subsystem instead of creating a second Activity Operations system.

The release will:

1. display campaign money in human-readable major currency units, with USD rendered as `$96.00` instead of a raw minor-unit count such as `9600`;
2. distinguish attributed spend from new external cash and split conversions into direct top-up, balance-paid subscription, and online-paid subscription categories;
3. make every supported metric drill-down use one shared query contract for its card, user/message drawer, filters, and CSV export;
4. reuse the unique email-open tracking delivered by PR #610 and the existing observed-click attribution instead of building another tracking pipeline;
5. add a durable CSV exclusion-list preview and confirmation flow that can stop unsent or retrying messages while preserving delivery and conversion history;
6. automatically retry only safely retryable SMTP failures, with at most five total attempts and an explicit non-automatic `uncertain` state;
7. present the existing activity scheduler as Manual, Once, Daily, or Weekly, with a start date/time and IANA timezone for scheduled modes;
8. move large-model email translation to a durable, multi-node-safe background task that the Console polls and can recover after refresh.

The implementation must continue to support SQLite, MySQL, and PostgreSQL.

## Problem

The Activity details page currently mixes several different concepts:

- currency values are exposed as technical minor-unit integers;
- attributed purchase value is presented without distinguishing whether new money entered Flatkey;
- the card totals cannot consistently explain which users or messages contributed to them;
- sent and failed recipient sets cannot be downloaded independently;
- an operator cannot upload a list of users who must be suppressed from an activity;
- transient SMTP failures require manual intervention, while ambiguous delivery outcomes must not be retried blindly;
- translation blocks the request and loses visible progress when the browser refreshes;
- the scheduler is technically capable of one-time and recurring execution, but its product presentation does not use one consistent start-date/time model.

These gaps make real activity reconciliation difficult. Activity 14 demonstrates the required accounting distinction: two attributed users produced `$96.00` of attributed spend, but only `$16.00` was new external cash because the other `$80.00` was a subscription bought from an existing wallet balance.

## Goals

- Make the activity funnel auditable from a metric card down to stable source rows.
- Make revenue terminology financially accurate without creating a second revenue ledger.
- Let operators download the exact rows represented by the active drawer filters.
- Let operators suppress users safely before or during an activity run.
- Recover transient SMTP failures without creating duplicate-mail risk.
- Make translation non-blocking and recoverable across browser refreshes and application restarts.
- Preserve the current Recall state machines, audit history, conversion attribution, and multi-node correctness patterns.

## Non-goals

- Do not build a new Activity Ops bounded context, analytics warehouse, message queue, or mirrored revenue table.
- Do not add provider-specific email delivery or click webhooks.
- Do not track repeated opens, devices, IP addresses, user agents, or location.
- Do not claim that an open pixel proves a human read the email.
- Do not perform foreign-exchange conversion or silently add amounts from different currencies.
- Do not recall a message after the SMTP request has entered the `sending` state.
- Do not automatically retry an SMTP outcome that may already have been accepted.
- Do not accept arbitrary email addresses into the persistent exclusion list when they do not resolve to a Flatkey user.
- Do not change relay/model-request behavior or add a router-side runtime dependency.

## Existing Baseline to Reuse

The implementation target is the latest `main`, which already contains:

- `RecallCampaign`, `RecallRecipient`, `RecallMessage`, and `RecallEvent` persistence;
- database-backed recipient and message leases with exact owner/expiry fencing;
- message states `scheduled`, `leased`, `sending`, `accepted`, `retry_wait`, `uncertain`, `failed`, and `cancelled`;
- revision-fenced campaign draft updates;
- one-time and daily/weekly recurring scheduling with IANA timezone validation;
- a synchronous `POST .../email-translations/generate` workflow;
- Activity recipient, event, metrics, retry, and export endpoints;
- PR #610's recipient-scoped open pixel, idempotent `email_open` event, and `opened_recipient_count` metric;
- the existing `observed_click` event and `observed_click_count` metric.

PR #610 does not provide the generic metric-user drawer or current-filter CSV export. This design reuses its tracking and event rows, then adds the missing query and presentation layer.

## Product Terminology

Use these labels consistently in the Console and exports:

| Concept | Required label | Meaning |
| --- | --- | --- |
| Attributed spend | `Attributed spend` / `活动归因消费额` | Purchase value attributed to recipients by the existing Recall attribution rules. It is not necessarily new cash. |
| New external cash | `New external cash` / `新增外部现金` | Direct top-ups plus non-balance online subscription payments. |
| Direct top-up | `Direct top-up` / `直接充值` | A successful attributed trade classified as a normal top-up rather than a subscription order. |
| Balance-paid subscription | `Balance-paid subscription` / `余额购买套餐` | A successful subscription order whose `payment_provider` is `balance`; it consumes previously funded wallet value. |
| Online-paid subscription | `Online-paid subscription` / `在线支付购买套餐` | A successful subscription order whose `payment_provider` is not `balance`. |
| SMTP accepted | `SMTP accepted` / `SMTP 已接受` | The configured SMTP server accepted the message. This is not proof of inbox delivery. |
| Detected opens | `Users who opened` / `已读用户数` | Unique recipients with a valid `email_open` event. This is approximate. |
| Observed clicks | `Observed clicks` / `已观察点击` | Existing unique/attributed claim-link click observations; it is not redefined as an open. |

Do not use a generic `Revenue` label without showing whether it means attributed spend or new external cash.

## Money and Revenue Contract

### Storage and API units

All authoritative Recall attribution amounts remain integer minor units in the backend. Existing fields such as `RecallRecipient.ConversionAmount`, `TopUp.PaymentAmountMinor`, and `SubscriptionOrder.PaymentAmountMinor` are not converted to floating-point storage.

Metric APIs return both:

- `currency`, normalized to uppercase ISO currency code; and
- `amount_minor`, an integer.

The Console formats the value in that currency's major unit. For USD:

```text
9600 -> $96.00
1600 -> $16.00
```

The raw integer is never presented as a user-facing dollar count. Formatting must use a currency-aware helper rather than hard-coded division by 100 because zero-decimal currencies such as JPY exist.

### Authoritative attribution and classification

`RecallRecipient.ConversionTradeNo`, `ConversionCurrency`, and `ConversionAmount` remain the authoritative attributed conversion record. The implementation joins the conversion trade number to existing financial records only to classify the attributed amount:

1. Look for a successful `SubscriptionOrder` with the same `trade_no` and user.
2. If found and `PaymentProvider == PaymentProviderBalance`, classify the recipient amount as `balance_subscription`.
3. If found and the provider is not `balance`, classify it as `online_subscription`.
4. Otherwise, look for a successful `TopUp` with the same `trade_no` and user and classify it as `direct_topup`.
5. Do not classify a missing, unsuccessful, mismatched-user, or ambiguous record by guesswork.

Subscription lookup takes precedence because one-time online subscription purchases may also be mirrored into `top_ups` with the same trade number. That mirror must not make an online subscription look like a direct top-up or make it count twice.

For a balance-paid subscription, `WalletLedgerEntry` with `entry_type = prepaid_debit` and the matching subscription order is a reconciliation check. It explains the wallet deduction; it is not a second amount source and is not added to revenue.

The category amounts always sum the already-authoritative `RecallRecipient.ConversionAmount`. The joined financial rows classify and validate the conversion but do not create another attribution ledger.

### Derived totals

For each currency independently:

```text
attributed_spend = direct_topup + balance_subscription + online_subscription + unclassified_attributed
new_external_cash = direct_topup + online_subscription
```

`unclassified_attributed` is a diagnostic remainder, not a guessed cash category. If it is non-zero, the API returns its count and amount and the Console shows a reconciliation warning. It is included in attributed spend and excluded from new external cash.

Each category returns both its amount and its distinct recipient/user count. Conversion kind (`direct`, `assisted`, or `no_coupon`) is orthogonal to the payment category and remains available as a filter.

Amounts from different currencies are returned as separate rows. The Console may render multiple currency rows, but it must not perform FX conversion or display one cross-currency total.

### Activity 14 acceptance fixture

The implementation is correct for the known Activity 14 data only if it produces:

| Metric | USD amount | Distinct users |
| --- | ---: | ---: |
| Attributed spend | $96.00 | 2 |
| New external cash | $16.00 | 1 |
| Direct top-up | $16.00 | 1 |
| Balance-paid subscription | $80.00 | 1 |
| Online-paid subscription | $0.00 | 0 |

User 7824 is the `$16.00` direct-top-up case. User 7835 is the `$80.00` balance-paid subscription case. User 7835 must appear with a subscription order and wallet debit but without a third-party payment record. That absence is expected and must not be displayed as a missing-payment error.

## Unified Metric Query

### One source for card, drawer, and CSV

Introduce one internal `MetricQuery` contract and one metric-key registry. A metric's summary card, drawer total, drawer rows, and CSV export must use the same:

- source tables and predicates;
- row grain (`recipient`, `message`, or `conversion`);
- search normalization;
- stage/state/currency/conversion filters;
- deterministic ordering;
- snapshot boundary; and
- authorization check.

The frontend must not reconstruct a metric with a different client-side filter.

Supported drill-down keys include at least:

- `candidates`;
- `enrolled`;
- `excluded`;
- `opened_recipients`;
- `observed_clicks`;
- `messages_accepted`;
- `messages_failed`;
- `direct_conversions`;
- `assisted_conversions`;
- `no_coupon_conversions`;
- `attributed_spend`;
- `new_external_cash`;
- `direct_topup`;
- `balance_subscription`; and
- `online_subscription`.

Message metrics use message grain, so a recipient may appear once per stage. Open, click, conversion, and revenue metrics use recipient/conversion grain and appear once per attributed recipient. The drawer states its grain instead of implying that every number is a unique-user count.

Audience count semantics are recipient-identity based after this release:

- `enrolled` is the number of unique `RecallRecipient` identities;
- `excluded` is the number of unique identities actually rejected by at least one campaign audience run;
- `candidates` is the identity-deduplicated union of enrolled recipients and run-time exclusions; and
- a persistent CSV exclusion that has never been encountered by an audience run is available through the exclusion-list view but does not inflate `candidates` or `excluded`.

This definition makes each clickable audience count represent the rows that can be shown. Legacy occurrence counts remain disclosed through the historical limitation below rather than being silently mixed with the new identity-grain metric.

### Snapshots and pagination

Every query creates or accepts an opaque `snapshot` token containing a database `as_of` value and the applicable immutable fact upper bounds, such as maximum recipient, event, exclusion, and campaign-run event IDs. The token is server-generated and validated; clients do not construct it.

A maximum row ID is not a sufficient snapshot for a mutable row. In particular, an existing `RecallMessage` can change from `scheduled` to `accepted` after the token was created while retaining the same ID. Therefore:

- immutable enrollment rows use the recipient-ID high-water mark;
- open, click, and conversion queries use their append-only Recall event high-water mark;
- the first run-time exclusion stores an immutable `first_run_event_id` and uses the campaign-run event high-water mark; and
- message-state metrics use append-only `message_state_changed` Recall events written in the same transaction as each relevant state transition.

The message-state event contains message ID, recipient ID, stage, from/to state, transition timestamp, and a stable idempotency source key, but no address or body. The metric query derives each message's latest state at or before the snapshot event high-water mark. This keeps a failed message in an older snapshot even if it is manually requeued later, while a newer snapshot reflects the requeue or eventual acceptance.

Before enabling the new message-state metric query, run a bounded, idempotent baseline reconciliation for existing messages. It emits one baseline state event per existing message using a stable source key. After that boundary, every state change that affects a metric must emit its event transactionally. If a metric cannot be reconstructed as of its snapshot, it is not eligible to claim stable card/drawer/CSV equality.

The first metrics response supplies a snapshot for each clickable metric. Opening the drawer and exporting from it reuses that snapshot. A drawer opened without a supplied snapshot creates a new one and returns it.

Rows use deterministic keyset pagination, never an unbounded offset scan. The response contains:

```json
{
  "items": [],
  "total": 0,
  "amounts": [{"currency": "USD", "amount_minor": 0, "user_count": 0}],
  "snapshot": "opaque-token",
  "next_cursor": "opaque-cursor",
  "legacy_unidentified_count": 0,
  "drilldown_complete": true
}
```

`total` follows the metric's declared grain. The card and drawer read it from the same query result.

### Historical audience limitation

Existing `campaign_run` events contain only exclusion counts and reason totals, not excluded identities. Those identities cannot be reconstructed reliably.

After this release, run-time exclusion identities are persisted in `RecallCampaignExclusion`, making new-run audience drill-down complete. For older runs:

- keep the legacy count in `legacy_unidentified_count`;
- return every identifiable row that can be derived from `RecallRecipient` and the new exclusion ledger;
- set `drilldown_complete = false`; and
- show a clear `Historical excluded identities were not recorded` notice.

The clickable `excluded` and `candidates` totals use only identifiable, identity-deduplicated rows. The old run-occurrence aggregate is displayed separately as non-clickable historical context and is never added to the clickable total. The CSV and drawer must never pretend that an incomplete historical list exactly represents the legacy aggregate.

### Drawer

All supported metrics open the same right-side drawer component. It provides:

- user ID and masked or admin-authorized email;
- the metric timestamp;
- message stage and delivery state where applicable;
- conversion kind, trade number, payment category, currency, and formatted amount where applicable;
- sanitized failure code where applicable;
- search by exact user ID or normalized email;
- stage, state, conversion kind, payment category, and currency filters when relevant;
- keyset pagination; and
- `Download current results` using the active filters and snapshot.

Columns that do not apply to a metric are omitted rather than filled with misleading zero values.

### CSV export

The export endpoint executes the same `MetricQuery` with the same filters and snapshot as the drawer. It supports the existing bounded row/byte limits and streams or batches rows instead of loading an unbounded result into memory.

CSV output:

- is UTF-8 with a stable header order;
- includes the campaign ID, metric key, and export snapshot in metadata or stable columns;
- neutralizes spreadsheet formula prefixes (`=`, `+`, `-`, and `@`);
- never includes claim tokens, SMTP secrets, full email bodies, or raw provider payloads; and
- uses a sanitized filename.

`SMTP accepted` and `failed` can therefore be downloaded independently, as requested.

## Exclusion List Design

### File contract

Operators upload a CSV containing `user_id`, `email`, or both columns.

- Maximum file size: 5 MiB.
- Maximum data rows: 100,000.
- Headers are trimmed and matched case-insensitively.
- Email matching trims whitespace and is case-insensitive.
- Duplicate rows and duplicate identifiers collapse to one resolved user and are reported as warnings.
- A row containing both fields is valid only when both resolve to the same user.
- Malformed IDs, malformed emails, or conflicting two-column identities are blocking errors.
- Unknown users are reported as unresolved and are not imported.
- Confirmation requires at least one resolved user and no blocking errors.

The preview shows total rows, resolved users, duplicates, unresolved rows, conflicts, and a bounded sample. It never applies exclusions by itself.

### `RecallExclusionBatch`

Add a durable preview artifact so any application instance can handle confirmation:

| Field | Purpose |
| --- | --- |
| `id`, `campaign_id` | Stable batch identity and ownership. |
| `status` | `previewed` or `applied`. |
| `file_sha256` | Detect accidental duplicate uploads without storing the source file. |
| row/count fields | Preserve the exact preview summary. |
| `resolved_user_ids_snapshot` | Gzip-compressed JSON array of normalized resolved user IDs. |
| `uploaded_by`, `created_at`, `applied_at` | Audit fields. |

Do not store the original CSV or its raw email cells. The compressed snapshot is immutable. Use a dialect-compatible large binary column: SQLite `BLOB`, MySQL `LONGBLOB`, and PostgreSQL `BYTEA`.

Confirmation is idempotent. Reconfirming an already applied batch returns its applied result and does not duplicate exclusions or events.

### `RecallCampaignExclusion`

Add one campaign-level identity ledger with a unique `(campaign_id, recipient_identity)` key:

| Field | Purpose |
| --- | --- |
| `campaign_id`, `recipient_identity` | Stable identity using the same `user:<id>` or hashed email identity contract as `RecallRecipient`. |
| `user_id` | Resolved Flatkey user when one exists; CSV imports always populate it. |
| `persistent` | `true` for operator CSV suppression; `false` for a run-time audience exclusion recorded only for drill-down. |
| `persistent_reason_code` | Why operator suppression is active, when applicable. |
| `last_run_reason_code` | Latest normalized audience-run exclusion reason. |
| `source_batch_id` | Batch that made the row persistent, when applicable. |
| `first_run_event_id` | Immutable first campaign run in which the identity was excluded; used by metric snapshots. |
| `last_run_event_id` | Latest campaign run in which the identity was excluded, when applicable. |
| `first_seen_at`, `last_seen_at`, `created_by` | Audit and list ordering. |

Upsert rules are monotonic: once `persistent` becomes true, a later audience run cannot turn it false. The first non-zero `first_run_event_id` is immutable. A later run may update `last_run_event_id` and `last_run_reason_code` without removing the persistent source or reason.

The audience selector records excluded user identities as `persistent = false` in the same transaction as the campaign-run event and recipient snapshot. `RecallRecipient` remains the source for enrolled/in-group identities. Only `persistent = true` rows suppress delivery.

### Confirmation and active-run behavior

Confirming a batch:

1. reads the immutable resolved-user snapshot;
2. upserts persistent exclusions in bounded chunks;
3. cancels matching `scheduled`, `retry_wait`, and safely owned `leased` messages;
4. clears their retry and lease metadata;
5. prevents creation of later stages for those recipients; and
6. writes one sanitized audit event with counts, not the uploaded addresses.

Already `accepted`, opened, clicked, or converted history remains intact. The exclusion is not a deletion operation.

### Send/exclusion race

The transition from `leased` to `sending` and the persistent-exclusion check must be linearized in one database transaction.

Replace or wrap the existing `MarkRecallMessageSendingWithContext` operation so its database transaction performs this exact order: load and lock the `RecallRecipient`; check for a matching persistent exclusion; then CAS the exactly leased `RecallMessage` into `sending`. Exclusion confirmation locks the same recipient row before upserting the exclusion and cancelling eligible messages. A service-layer precheck outside this transaction is insufficient and must not be used as the correctness boundary.

Both the send transition and exclusion confirmation therefore lock or conditionally fence the same `RecallRecipient` row before making their decision:

- if the exclusion transaction wins, the message is cancelled and cannot enter `sending`;
- if the send transaction wins and enters `sending`, the SMTP request is considered in flight and cannot be recalled;
- an old worker whose lease or epoch no longer matches cannot commit a result;
- after an in-flight message becomes `accepted`, the acceptance remains recorded, but the transaction does not create the next stage when a persistent exclusion now exists.

Locks are acquired in ascending recipient ID order for batch confirmation. SQLite relies on its serialized writer transaction; MySQL and PostgreSQL use row locking plus existing conditional updates. Correctness cannot depend on a process-local mutex.

## SMTP Retry and Delivery Semantics

### Outcome classification

Classify every send attempt as one of:

- `accepted`: the SMTP server accepted the message after DATA;
- `retryable`: a clearly temporary failure where retrying is safe, including applicable 4xx responses or a connection failure known to occur before submission;
- `permanent`: an applicable 5xx or deterministic configuration/address error;
- `uncertain`: the connection failed at a point where the server may already have accepted the message.

Sanitized error codes are stored; secrets, full HTML, auth strings, and raw provider responses are not.

### Automatic retry policy

There are at most five total SMTP attempts, including the first attempt. The four automatic retry delays are approximately:

```text
30 seconds, 1 minute, 2 minutes, 4 minutes
```

The worker stores the absolute `next_attempt_at`, increments `attempt_count` only for an actual transport attempt, and uses the existing message lease/CAS fence.

- `retryable` schedules the next delay while attempts remain.
- The fifth retryable failure becomes terminal `failed`.
- `permanent` becomes `failed` immediately.
- `uncertain` never auto-retries.
- A campaign cancellation or persistent exclusion wins before a pending retry is leased again.

The existing manual retry endpoint and request shape remain available. Retrying `uncertain` requires the existing `acknowledge_uncertain = true` request field and a corresponding duplicate-risk warning in the Console. A normal failed message does not require that acknowledgement.

## Scheduling UX and Semantics

### Operator choices

Present one schedule selector with:

- Manual;
- Once;
- Daily; and
- Weekly.

Map these to the existing backend execution modes:

- Manual -> `manual`;
- Once -> `scheduled_once`;
- Daily/Weekly -> `recurring` with the matching frequency.

All non-manual modes show an activity start date/time and an IANA timezone picker. Weekly also shows a weekday. Do not use the browser's implicit local timezone as the stored contract.

### Persistence and recurrence

Use `schedule.scheduled_at` as the start boundary for Once, Daily, and Weekly. For recurring campaigns, stop clearing this value during normalization. Existing recurring drafts with `scheduled_at = 0` remain valid and mean `start at the first recurrence after activation`.

Persist the normalized schedule JSON in the existing `recurrence_config` field for Once as well as recurring modes so the IANA timezone can reconstruct the operator's one-time display. `scheduled_at` remains the authoritative instant for Once, while `next_run_at` remains the authoritative scheduler fence for every scheduled occurrence.

For Weekly, the selected weekday and wall-clock time define occurrences; `scheduled_at` is only the lower start boundary. The first run is the first selected weekday/time at or after that boundary. Daily and weekly calculations use calendar operations in the selected location rather than adding fixed 24-hour or 7-day seconds, preserving local wall-clock intent across daylight-saving transitions and retaining the current behavior of skipping a nonexistent local wall-clock occurrence.

The scheduler continues to use the existing campaign CAS on `next_run_at`, so multiple application instances cannot own the same occurrence.

### Email stage offsets

Keep the current `DelaySeconds` model and make its UI meaning explicit:

- stage 1 is scheduled from the recipient enrollment/run timestamp;
- stage 2 and stage 3 delays are absolute offsets from the first message's `FirstSentAt` / first SMTP acceptance;
- later-stage offsets are not added cumulatively to the previous stage's delay.

For example, offsets `0 days`, `1 day`, and `4 days` mean first send immediately, second send one day after the first acceptance, and third send four days after the first acceptance.

## Asynchronous Translation

### API behavior

Keep the existing campaign-scoped translation command but change it to return HTTP 202 with a durable task instead of waiting for the model:

```text
POST /api/recall-campaigns/:id/email-translations/generate
GET  /api/recall-campaigns/:id/email-translations/tasks/:task_id
GET  /api/recall-campaigns/:id/email-translations/tasks/latest
```

The create request continues to include `config_revision`, campaign name, and the email sequence. It validates the current draft and source synchronously, then creates or returns the idempotent task.

The task response includes:

- `id`;
- `campaign_id`;
- `requested_config_revision`;
- `result_config_revision` when successful;
- `status`;
- `attempt_count`;
- safe `error_code` and localized-safe error copy key;
- `created_at`, `started_at`, and `finished_at`.

The status set is exactly:

```text
queued, running, succeeded, failed, superseded
```

### `RecallTranslationTask`

Add a durable task model with:

| Field | Purpose |
| --- | --- |
| `campaign_id`, `requested_config_revision` | Revision fence. |
| `source_hash`, `idempotency_key` | Same campaign content version returns the same task. |
| `status`, `attempt_count`, `next_attempt_at` | Observable lifecycle. |
| `lease_owner`, `lease_expires_at`, `lease_epoch` | Multi-node claim and stale-worker fence. |
| `source_snapshot`, `result_snapshot` | Immutable input and all-language output. |
| `result_config_revision` | Campaign revision created by successful writeback. |
| `error_code`, `error_message` | Sanitized terminal failure. |
| timestamp fields | Queue, start, and finish audit. |

The source and result snapshots use the same dialect-compatible long-text strategy as Recall email sequence storage: MySQL `LONGTEXT`, SQLite/PostgreSQL `TEXT`. Do not regress the large-template fixes already present on `main`.

The unique idempotency key is derived from campaign ID, requested config revision, and a canonical hash of the translatable source. Repeated clicks while a task is queued, running, or succeeded return that task. Repeating the command after a terminal `failed` state may atomically requeue the same task only while the campaign revision and source hash still match.

### Worker and atomic writeback

Every application instance may scan due translation tasks. A worker claims one by a conditional database update that increments `lease_epoch`. Long work renews the lease; if a lease expires, a different node may claim a new epoch.

The worker:

1. loads the immutable source snapshot;
2. runs the existing protected-token translation and validation pipeline for all required languages;
3. keeps partial language output only inside the task attempt;
4. validates the complete result;
5. starts a database transaction;
6. verifies task owner, epoch, and `running` state;
7. verifies the campaign is still a draft with the same `config_revision` and source content;
8. stores the complete result snapshot, updates the campaign email sequence, increments campaign `config_revision`, and marks the task `succeeded` atomically.

If the campaign revision or source no longer matches, the task becomes `superseded` and writes nothing to the campaign. An expired or older worker epoch cannot commit a late result.

There is never a partially translated campaign row. Existing manual-locale preservation, English-source rules, campaign-type-aware validation, protected placeholders, and all-language atomicity remain unchanged.

### Console polling and recovery

After receiving 202, the Console polls the task endpoint about every two seconds while the status is `queued` or `running` and stops on a terminal status.

- Disable duplicate generation while the current task is active.
- Show distinct queued, translating, succeeded, failed, and superseded states.
- On success, invalidate and reload the campaign detail; do not apply a stale client-side result over newer editor state.
- On failure, restore the action and display only safe error copy.
- On superseded, explain that the draft changed and must be translated again.
- On page load or refresh, call `tasks/latest` and resume polling when the latest task is active.
- If the operator has unsaved local edits, never overwrite them silently when a background task completes.

Polling state is UI state only. Task correctness and recoverability remain entirely in the database.

## HTTP Surface

All endpoints remain admin-only except the already-public, response-neutral open-pixel endpoint from PR #610.

| Method and path | Purpose |
| --- | --- |
| `GET /api/recall-campaigns/:id/metrics` | Existing summary plus currency-separated revenue categories and drill-down snapshot metadata. |
| `GET /api/recall-campaigns/:id/metric-users` | Unified filtered drawer query. |
| `GET /api/recall-campaigns/:id/metric-users/export` | CSV from the same metric query, filters, and snapshot. |
| `POST /api/recall-campaigns/:id/exclusions/preview` | Multipart CSV validation and durable batch preview. |
| `GET /api/recall-campaigns/:id/exclusions/batches/:batch_id` | Recover a preview after refresh or cross-node routing. |
| `POST /api/recall-campaigns/:id/exclusions/batches/:batch_id/confirm` | Idempotently apply the resolved exclusion snapshot. |
| `POST /api/recall-campaigns/:id/email-translations/generate` | Existing route; now validates and enqueues/returns an idempotent translation task with HTTP 202. |
| `GET /api/recall-campaigns/:id/email-translations/tasks/:task_id` | Poll one translation task. |
| `GET /api/recall-campaigns/:id/email-translations/tasks/latest` | Restore task status after refresh. |

Metric-user query parameters are `metric`, `q`, `stage_no`, `state`, `conversion_kind`, `payment_category`, `currency`, `snapshot`, `cursor`, and bounded `limit`. Unsupported filters for a metric are rejected instead of silently ignored.

Controller errors use stable machine-readable codes and safe messages. Backend context cancellation and timeouts propagate normally.

## Frontend Layout

The Activity detail page keeps one metric section but changes money cards to formatted currency values and explanatory labels. Count cards and money cards use the same click treatment when drill-down is available.

The shared drawer is the only user-list presentation; sent, failed, opened, clicked, conversion, and revenue cards do not each implement a private table.

The exclusion-list flow is a two-step dialog:

1. choose/upload CSV and inspect preview counts plus bounded error samples;
2. explicitly confirm the resolved users and show the number of pending/retry messages that will be cancelled.

The scheduling editor presents the four product choices directly. The translation workspace shows the durable task state and resumes it after refresh.

All new user-visible strings must use `t()` and receive real translations in all eight `web/default` locale files. Run the repository i18n synchronization check and inspect untranslated reports for the changed keys.

## Privacy, Security, and Observability

- Keep all operational list and export endpoints under existing admin authorization.
- Do not log uploaded email addresses, CSV contents, translation bodies, full failure text, or claim tokens.
- Log campaign ID, task/batch ID, metric key, filter hash, row count, state transition, and sanitized error class.
- Record bounded audit events for exclusion confirmation and translation terminal transitions.
- Keep PR #610's open endpoint response-neutral for invalid, stale, and valid tokens.
- Do not add IP/user-agent capture to open or click events.
- Escape CSV formula prefixes and sanitize content-disposition filenames.
- Cap upload bytes, parsed rows, response items, CSV rows, and exported bytes before allocating unbounded memory.

Operational counters should include:

- translation tasks by status, lease recovery, duration, and supersession;
- SMTP attempts by accepted/retryable/permanent/uncertain outcome;
- metric export rows and truncation;
- exclusion preview/apply counts and cancelled messages;
- unclassified attributed conversions.

## Database and Migration Requirements

Add only these new tables:

- `recall_exclusion_batches`;
- `recall_campaign_exclusions`;
- `recall_translation_tasks`.

Reuse existing Recall tables and financial records. Do not add a metric mirror table or a second revenue ledger.

Migrations must be idempotent and pass on SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+.

- Use GORM abstractions and existing dialect helpers where practical.
- Avoid partial unique indexes because they are not uniformly portable.
- Use an ordinary unique idempotency key for translation tasks.
- Use application-side gzip for exclusion snapshots and the dialect-specific large-binary type described above.
- Use the existing long-text migration pattern for translation source/result snapshots.
- Build indexes for task due scans, persistent exclusion checks, metric keyset ordering, campaign/recipient-identity uniqueness, and batch ownership.

No destructive data migration is required. Existing campaigns remain readable. Historical excluded-user drill-down follows the explicit incomplete-history behavior above.

## Error Handling

| Area | Required behavior |
| --- | --- |
| Metric query | Invalid metric/filter -> 400; missing campaign -> 404; stale/invalid snapshot -> 409 with reload guidance; export limit -> bounded/truncated result with explicit indication. |
| Revenue classification | Missing/ambiguous financial record -> attributed but unclassified; never guess or count as external cash. |
| Exclusion upload | Size/row limit -> reject before apply; malformed/conflicting rows -> non-confirmable preview; unknown users -> reported and omitted. |
| Exclusion confirm | Already applied -> idempotent success; competing send -> linearized result; batch/campaign mismatch -> 404/409. |
| SMTP | Retry only safe temporary outcomes; permanent -> failed; ambiguous -> uncertain/manual acknowledgement. |
| Schedule | Invalid/unknown IANA timezone, past one-time start, invalid weekday/time -> reject before activation. |
| Translation | Invalid source -> synchronous 400; provider/validation terminal error -> failed task; changed revision -> superseded; stale worker -> no-op lease loss. |

## Testing Strategy

### Money and revenue

- Verify currency formatting, including `9600 -> $96.00`, zero, negative diagnostic values, and zero-decimal currencies.
- Preserve minor-unit storage and response fields.
- Build Activity 14's two-user fixture and assert every amount and user count in the acceptance table.
- Verify subscription-order precedence over a mirrored `TopUp`.
- Verify balance-paid subscription uses its order and wallet debit without requiring a third-party payment row.
- Verify unmatched trade numbers remain attributed/unclassified and do not inflate external cash.
- Verify currencies are never silently combined.

### Metric query, drawer, and CSV

- For every metric key, assert card total, drawer total, and exported row set are produced by the same filters and snapshot.
- Cover user/email search, stage/state/category/currency filters, deterministic keyset pagination, repeated users in message-grain metrics, and concurrent inserts after a snapshot.
- Verify opened recipients reuse `email_open`, observed clicks retain their existing meaning, and both are recipient-deduplicated.
- Verify accepted and failed CSVs are separate and formula-safe.
- Verify historical unidentified exclusions are disclosed rather than fabricated.

### Exclusion list

- Cover `user_id`, email, both columns agreeing, both columns conflicting, malformed rows, unknown users, duplicates, case/whitespace normalization, 5 MiB, and 100,000-row boundaries.
- Verify preview has no suppression side effect and confirmation is idempotent across nodes.
- Race exclusion confirmation against `leased -> sending` and assert exactly one linearized outcome.
- Verify scheduled/retry-wait work is cancelled, old leases cannot commit, accepted/open/click/conversion history is preserved, and no later stage is created.

### SMTP retry

- Assert five total attempts with delays near 30s/1m/2m/4m.
- Assert permanent errors stop immediately.
- Assert uncertain errors never auto-retry and manual retry requires `acknowledge_uncertain = true` plus duplicate-risk acknowledgement copy.
- Assert exclusion/cancellation wins before a retry lease and exact lease fencing prevents stale completion.

### Scheduling

- Cover Manual, Once, Daily, and Weekly payload mapping.
- Cover start boundary, IANA validation, DST transitions, weekly weekday, legacy recurring `scheduled_at = 0`, and multi-node `next_run_at` CAS ownership.
- Assert stage 2/3 schedule from the first SMTP acceptance and use absolute, not additive, offsets.

### Translation

- Cover queued -> running -> succeeded, terminal failed, superseded, idempotent duplicate submit, failed-task requeue, lease expiry, epoch fencing, and application restart.
- Assert all languages write atomically and partial results never update the campaign.
- Assert an old task cannot overwrite a new campaign revision.
- Assert `tasks/latest` supports refresh recovery and frontend polling stops at terminal states.
- Preserve content-only/promotion validation, protected tokens, manual locales, source revision, and large-template coverage.

### Cross-database and commands

All new SQL and migrations receive SQLite/MySQL/PostgreSQL DryRun or dialect-specific compatibility coverage. Include a real SQLite concurrency test for leases and exclusion/send races.

Minimum targeted verification:

```text
go test ./model ./service ./controller -run "Recall"
cd web/default && bun test src/features/recall-campaigns
cd web/default && bun run typecheck
```

Implementation verification must also run the repository-required i18n synchronization/report checks, relevant lint/build checks, and browser smoke tests.

## Browser and Visual Acceptance

Use the in-app browser against the local implementation and retain screenshot evidence for:

1. Activity details showing formatted USD revenue categories and clear attributed-spend versus external-cash labels;
2. a metric card opening the shared drawer, applying filters, and exposing current-filter download;
3. separate SMTP-accepted and failed exports;
4. exclusion CSV preview, conflict feedback, and confirmation impact;
5. Manual/Once/Daily/Weekly scheduling with start date/time and timezone;
6. translation moving through queued/running/succeeded and restoring after refresh;
7. failed and superseded translation states; and
8. SMTP uncertain-state duplicate-risk acknowledgement.

No production email, payment, exclusion, or campaign activation is part of browser smoke verification.

## Deployment and Rollout

This feature changes the Go Console backend, Recall workers, database schema, and `web/default` Console bundle.

- `newapi-console`: required.
- Database migration: required on the Console/master startup path.
- `newapi-router`: required for release consistency because the shared Go image and schema models change, even though relay request behavior is unchanged.
- `newapi-web`: not required.
- Terraform/Cloudflare: not required.

Deploy and test on `staging` first. Validate migrations on all supported dialects before staging promotion. During rollout, old binaries do not know the new exclusion or translation-task rules, so keep Recall sending disabled until every Recall worker is running the new image and migrations are complete. Then re-enable Recall and watch task leases, SMTP retry outcomes, and exclusion metrics.

Rollback must not drop the new tables. If the new release is rolled back, disable Recall first so old workers cannot bypass persistent exclusions or synchronous translation cannot conflict with queued tasks. Roll forward after correction.

## Alternatives Rejected

- **A new Activity Ops service or message queue:** rejected because existing Recall database leases and state machines already provide the required durable worker pattern.
- **A metric snapshot table:** rejected because it would create a second analytics truth and introduce reconciliation lag.
- **A second revenue ledger:** rejected because `RecallRecipient` attribution plus existing order tables already provide authoritative value and classification.
- **Treat all attributed spend as revenue/cash:** rejected because balance-paid subscriptions would double-count previously funded money.
- **Provider-specific SMTP webhooks:** rejected because arbitrary configured SMTP providers cannot supply one portable contract.
- **Retry every SMTP failure:** rejected because uncertain outcomes can create duplicate mail and permanent errors cannot recover by delay.
- **Store exclusion preview only in browser memory:** rejected because confirmation may reach another node or occur after refresh.
- **Store one row per uploaded CSV item:** rejected because the approved 100,000-row flow only needs the immutable resolved-ID snapshot; the compressed batch plus campaign exclusion ledger is sufficient.
- **Keep translation synchronous:** rejected because long model calls block requests and cannot recover visible progress after refresh.
- **Store translation state in process memory:** rejected because production is multi-node and workers restart.

## Completion Criteria

The feature is complete only when:

- Activity 14 produces the exact accepted amount split;
- a card, drawer, and CSV demonstrably share one filtered snapshot;
- sent and failed recipient/message lists can be downloaded separately;
- a confirmed exclusion prevents all not-yet-sending work and preserves history;
- SMTP retry classification and five-attempt bounds pass deterministic tests;
- schedule start/timezone and stage-offset semantics pass DST and legacy tests;
- translation survives refresh/restart and cannot be committed by a stale worker;
- SQLite, MySQL, and PostgreSQL compatibility checks pass;
- all eight Console locales are complete; and
- the required browser visual smoke evidence is captured without performing production side effects.
