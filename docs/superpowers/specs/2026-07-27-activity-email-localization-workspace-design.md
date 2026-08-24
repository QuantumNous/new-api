# Activity Configuration Authoring and Email Throughput Design

## Status

Interaction design approved on 2026-07-27. Written specification awaiting user review.

## Goal

Make Activity Configuration faster and safer to operate in three places:

1. Reduce email authoring from as many as 24 independently visible templates—eight languages across three email stages—to one English source per stage, one explicit localization action, and optional target-language review.
2. Replace timestamp and raw-second inputs with understandable expiry controls, and make minimum purchase amounts unambiguously USD.
3. Protect the Activity Configuration email stream with one adjustable hourly limit shared by all Recall activities while leaving every other system email path unchanged.

The Console must prevent activation when localized content is missing, failed, or based on an older English source. Successful generated translations do not require individual operator confirmation. Activity email delivery must never exceed the configured module-wide hourly limit across application nodes.

## Evidence and current behavior

The design is grounded in:

- `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- `web/default/src/features/recall-campaigns/components/campaign-email-html-editor.tsx`
- `web/default/src/features/recall-campaigns/index.tsx`
- `web/default/src/features/recall-campaigns/schemas.ts`
- `web/default/src/components/datetime-picker.tsx`
- `service/recall_campaign.go`
- `service/recall_email.go`
- `service/recall_scheduler.go`
- `service/recall_email_translation.go`
- `model/recall_message.go`
- `setting/operation_setting/recall_campaign_setting.go`
- `docs/superpowers/specs/2026-07-21-recall-email-auto-localization-design.md`
- `docs/superpowers/specs/2026-07-22-recall-html-email-design.md`

The current Console materializes all eight templates in form state, initially copying the English template into missing locales, and exposes eight language buttons. The backend treats a complete eight-locale payload as an authoritative manual set and skips automatic translation. This restored an emergency manual bypass but makes operators maintain up to 24 templates and can make copied English content look structurally complete.

The backend already supports a strict eight-locale contract, one batched AI request across stages, protected HTML translation segments, delivery-time language selection, and English fallback for historical resilience. This design reuses those capabilities while making generation an explicit Console action.

The current offer UI accepts `coupon_redeem_by` as a Unix timestamp, accepts `promotion_valid_seconds` as raw seconds, and exposes `minimum_amount_currency`. Campaign runs currently compute each recipient expiry as `runAt + promotion_valid_seconds`, capped by the coupon redeem-by timestamp.

Activity messages are already persisted, leased, retried, and selected in ascending message ID order, but there is no hourly Activity email quota. The SMTP sender configuration is shared with unrelated system email paths, so the new limiter must live inside the Recall email worker rather than inside the common SMTP sender.

## Product decisions

- English is the only source language.
- Saving a Console draft does not generate translations.
- The operator explicitly selects **Generate 7 translations** after editing English.
- One action localizes every configured email stage in one batch.
- Successful generation is sufficient for activation; manual review is optional.
- Missing, failed, or stale translations block activation.
- Editing English makes every target locale for that stage stale immediately.
- Regeneration replaces all seven target locales. If any target contains manual edits, the confirmation dialog shows the count before replacement.
- Delivery-time English fallback remains only as a compatibility and incident-safety path. New activation cannot rely on it.
- Coupon redeem-by uses a localized date-time picker and remains an absolute instant.
- Promotion validity supports either one fixed expiry instant or a duration after each campaign run.
- Minimum purchase amount is always denominated in USD; the operator cannot select another currency.
- One adjustable hourly limit is shared by all Activity Configuration campaigns.
- The hourly limit applies only to Recall activity messages. Registration, verification, password-reset, notification, and every other system email remain outside its accounting and control.
- Quota windows reset on the hour and use database time for multi-node consistency.

## Goals

1. Make the common path one source edit plus one generation action.
2. Make translation freshness visible and enforceable.
3. Keep optional human corrections possible without forcing seven review steps.
4. Preserve the exact `en`, `zh`, `es`, `fr`, `pt`, `ru`, `ja`, and `vi` persisted locale set.
5. Preserve HTML, template actions, scheduled-message snapshots, admin authorization, and optimistic concurrency.
6. Replace machine-oriented timestamp and second inputs with operator-oriented date-time and duration controls.
7. Enforce a predictable module-wide Activity email ceiling without throttling unrelated system mail.

## Non-goals

- Supporting a non-English source language.
- Adding languages beyond the existing eight.
- Replacing the HTML editor or adding a WYSIWYG dependency.
- Adding a generic background-job system.
- Changing audience selection, discount calculation, product scope, campaign scheduling, or attribution beyond the explicitly described expiry and USD controls.
- Requiring translation approval workflows, reviewer roles, or per-language sign-off.
- Removing the delivery-time English fallback from historical or already-running records.
- Applying a global SMTP-account limit or throttling non-Recall emails.
- Giving each campaign an independent hourly allowance.
- Reinterpreting the existing campaign `worker_concurrency` field or adding a separate simultaneous-SMTP connection limit.
- Replacing the existing database-backed message queue or adding Redis as a quota dependency.

## Chosen interaction

### English content

The Email Sequence card has two tabs: **English content** and **Translation review**.

English content shows the existing stage controls and English subject/HTML editor only. The section header shows aggregate readiness, such as `3 emails · translations not generated` or `21/21 translations ready`.

The primary localization action is **Generate 7 translations**. Saving remains a separate action. For an unsaved or dirty draft, selecting Generate first saves the English source without localization, then starts generation. If saving succeeds and generation fails, the English draft remains saved and the operator can retry.

### Translation review

Translation review lists the seven target languages with derived states:

- **Generated** — generated from the current English source.
- **Manually edited** — operator-edited and still tied to the current English source revision.
- **Stale** — English changed after this target was generated or edited.
- **Failed** — the most recent generation attempt failed; no partial replacement occurred.
- **Missing** — no valid target template exists.

Selecting a language opens its templates for every email stage. Each editor displays the current English source as read-only context beside the editable target language. Saving a correction affects only that target locale and records it as manually edited.

Manual review is never required merely because a translation was generated.

### Regeneration

Regeneration always targets all seven languages for every configured stage. If `manual_locales` is non-empty, a confirmation dialog states the number and names of manually edited languages and explains that regeneration replaces them.

The operator cannot preserve old manual corrections as current after the English source changes. They may cancel regeneration, but activation remains blocked until a new complete translation set exists.

### Activation

The activation control displays concise blockers beside the disabled action. The preflight response identifies the affected stage and locale when possible.

Activation succeeds only when every stage contains exactly the eight supported languages and its translation source revision equals its current English source revision.

### Offer validity and minimum amount

The Products, minimum, and validity card replaces machine-oriented inputs with these controls:

- **Coupon redeem-by** uses the existing localized `DateTimePicker`. It displays the administrator's local time and serializes the selected instant as a Unix timestamp. Clearing it preserves the existing no-coupon-deadline value of `0` where the coupon source permits it.
- **Promotion validity mode** is a two-option segmented control:
  - **Fixed expiry date** shows a `DateTimePicker`. Every recipient created by the activity receives the same expiry instant.
  - **Valid after each run** shows integer day and hour inputs and serializes their combined duration to `promotion_valid_seconds`.
- The card displays the effective expiry. Coupon redeem-by is always the hard upper bound, so an earlier coupon deadline visibly shortens the promotion expiry rather than doing so silently.
- A recurring activity with a fixed expiry explains that no run can start at or after that instant. When its next due run reaches the fixed expiry, the scheduler completes the activity instead of repeatedly failing it.
- **Minimum amount** has a fixed `USD` suffix. The currency input is removed. New and edited drafts canonicalize a positive minimum amount to `usd` on the server regardless of a client-supplied `minimum_amount_currency` value.

The validity mode, relevant value, effective expiry, and local timezone are visible together. Invalid, past, or contradictory values receive field-level errors before save and are revalidated on the server at activation and run time.

### Activity email hourly limit

The Activity Configuration list header contains a compact **Activity email limit** control and a status summary such as `76 / 100 sent this hour · resets at 15:00`. This is one module-wide setting, not a field inside each campaign editor.

Only administrators can change the limit. The control states that it applies to all Activity Configuration campaigns and does not affect other system emails. Its default is `100` attempts per hour and its accepted range is `1` through `100000`.

Changing the value takes effect without restarting workers:

- Increasing it allows queued Activity messages to resume on the next scheduler tick when the new value exceeds current usage.
- Decreasing it never rewrites the already-recorded usage. If current usage meets or exceeds the new value, new Activity email attempts wait until the next hour.
- The setting has no unlimited value. Pausing and resuming campaigns remain separate operational actions.

## Data contract

### Localization metadata

Extend each JSON-backed `RecallEmailStage` with optional localization metadata:

```json
{
  "stage_no": 1,
  "delay_seconds": 0,
  "template_version": 4,
  "source_revision": 3,
  "translated_source_revision": 3,
  "manual_locales": ["es"],
  "templates": {
    "en": { "subject": "...", "body_html": "..." },
    "zh": { "subject": "...", "body_html": "..." },
    "es": { "subject": "...", "body_html": "..." },
    "fr": { "subject": "...", "body_html": "..." },
    "pt": { "subject": "...", "body_html": "..." },
    "ru": { "subject": "...", "body_html": "..." },
    "ja": { "subject": "...", "body_html": "..." },
    "vi": { "subject": "...", "body_html": "..." }
  }
}
```

Rules:

- `source_revision` starts at `1` and increments only when the normalized English subject or body changes.
- `translated_source_revision` is set to `source_revision` only after a complete validated generation succeeds.
- `manual_locales` is a normalized subset of the seven target locale codes.
- Generated, stale, and ready states are derived from the template set and revision fields rather than trusted from a client-provided status string.
- `template_version` keeps its existing snapshot semantics and increments when persisted template content changes.
- The localization metadata itself remains inside the existing `email_sequence_config` JSON, so it requires no localization-specific table.

### Offer expiry

Extend the campaign draft and persisted campaign with:

```json
{
  "promotion_expiry_mode": "fixed",
  "promotion_expires_at": 1816646400,
  "promotion_valid_seconds": 0,
  "discount_config": {
    "minimum_amount": 1000,
    "minimum_amount_currency": "usd",
    "coupon_redeem_by": 1816732800
  }
}
```

Rules:

- `promotion_expiry_mode` is `fixed` or `relative`.
- Fixed mode requires a future `promotion_expires_at` and ignores `promotion_valid_seconds`.
- Relative mode requires positive `promotion_valid_seconds`, clears `promotion_expires_at`, and computes each run's expiry as `runAt + promotion_valid_seconds`.
- The effective recipient expiry is the earlier of the mode-specific expiry and a positive `coupon_redeem_by`.
- `minimum_amount_currency` remains in the API contract for compatibility but is server-canonicalized to `usd` whenever `minimum_amount > 0`; it is empty when no minimum applies.
- Persist `promotion_expiry_mode` and `promotion_expires_at` as campaign columns. Existing `promotion_valid_seconds` remains the relative-duration column.

### Activity email quota

Extend `operation_setting.RecallCampaignSetting` with:

```json
{
  "email_hourly_limit": 100
}
```

Add a cross-database `RecallEmailQuotaWindow` record keyed uniquely by the UTC Unix hour start. It stores the number of Activity email attempts reserved in that window. The table is owned only by the Recall email worker and is registered through the repository's normal cross-database migration path.

The counter represents SMTP attempt slots, not accepted deliveries. A conditional atomic increment succeeds only while the stored count is below the currently configured limit. Database time selects the hour, so application-node clock skew cannot create parallel windows.

## API and service flow

### Draft save

The Console uses a deferred-localization save path. It persists English changes and existing target templates without invoking the translator. Existing English-only API clients keep the current automatic-localization behavior unless they explicitly request deferred localization, preserving compatibility.

When normalized English changes, the backend increments `source_revision` and leaves `translated_source_revision` unchanged. This makes stored targets stale without deleting them.

### Explicit generation

Add an admin-only generation endpoint under the existing Recall Campaign API group. The operation:

1. Reads or accepts the proposed normalized English templates under the current campaign `config_revision`.
2. Captures the campaign and per-stage source revisions.
3. Sends all stages and all seven target languages through the existing translator in one request.
4. Validates response shape, protected tokens, HTML reconstruction, locale completeness, and template limits.
5. Rechecks the campaign and source revisions.
6. Atomically replaces all seven target templates, clears `manual_locales`, sets every `translated_source_revision` to the matching source revision, increments template versions when content changed, and advances `config_revision`.

If the campaign or English source changed while generation was running, the operation returns a conflict and persists nothing.

### Active campaigns

An active campaign must never persist a stale intermediate email set. English edits remain local until generation succeeds. The generation endpoint translates the proposed English templates and atomically updates the complete eight-locale set under the current `config_revision`.

Already scheduled `RecallMessage.TemplateSnapshot` values remain unchanged. Newly scheduled messages use the new template version.

### Activation guard

Server-side activation validates, for every stage:

- exactly the eight supported locale keys;
- valid normalized subject and exactly one body representation per locale;
- `source_revision > 0`;
- `translated_source_revision == source_revision`.

The endpoint returns structured blockers instead of relying on the Console's disabled button.

### Expiry normalization and campaign runs

Draft save and activation normalize the selected validity mode and reject missing, past, or incompatible values. At each campaign run:

1. Fixed mode starts with `promotion_expires_at`; relative mode starts with `runAt + promotion_valid_seconds`.
2. A positive coupon redeem-by earlier than that value becomes the effective expiry.
3. The run is rejected before recipient insertion if the effective expiry is not after `runAt`.
4. Every recipient created in that run receives the same normalized effective expiry snapshot.

For recurring fixed-expiry campaigns, the scheduler marks the campaign completed when the next run is at or after the fixed expiry. This is a normal terminal condition, not a retryable worker error.

### Activity limit configuration

The existing administrator configuration API reads and updates `recall_campaign_setting.email_hourly_limit`. The Activity Configuration screen owns the control and status presentation. Campaign CRUD payloads do not repeat the limit because it is shared by the module.

### Quota-aware delivery

The Recall email worker, and only that worker, applies the limit:

1. Select due Activity messages by effective due time (`scheduled_at` for scheduled messages and `next_attempt_at` for retries), then message ID.
2. Lease and run existing suppression, activity, expiry, template, and address checks. Messages stopped before SMTP do not consume quota.
3. Immediately before crossing into the SMTP send boundary, obtain database time and conditionally reserve one slot in the current `RecallEmailQuotaWindow`.
4. When a slot is unavailable, release any unsent lease back to its previous due state, stop scanning later messages for that batch, and report the shared reset time. The backlog is not rewritten message by message.
5. When a slot is reserved, continue through the existing stable Message-ID, `sending`, SMTP, accepted, retry, uncertain, and failed flow.

Reservations are never refunded after the SMTP boundary because a timeout or process failure may have occurred after provider acceptance. A crash between reservation and SMTP can underuse a window by one slot, but it cannot cause over-send. Automatic and manual retries reserve a new slot for each new SMTP attempt.

The conditional counter update is the correctness boundary across nodes. Process-local flags may avoid redundant polling after exhaustion, but they cannot grant capacity or replace the database check. Raising the configured limit allows the next tick to reserve against the same window; lowering it blocks new reservations once stored usage reaches the new value.

Queue order is a claim-order guarantee: workers claim the oldest effective-due message first, with message ID as the stable tie-breaker. SMTP calls may finish in a different order when multiple nodes are already processing claimed messages; the limiter does not serialize network completion.

## Atomicity and error handling

- Generation is all-or-nothing across every stage and target language.
- A translation timeout, provider error, malformed response, missing locale, damaged token, invalid rebuilt HTML, oversized body, revision conflict, or validation error leaves the prior stored templates and revisions unchanged.
- The UI preserves the last successful templates for reference but continues to show stale or failed state and blocks activation.
- A retry uses the latest English source revision.
- Repeated clicks while generation is active are disabled client-side and deduplicated or rejected server-side.
- Field-oriented validation errors remain attached to English or target-language editors as appropriate.
- Error messages never include API credentials, complete email HTML, private promotion codes, or recipient data.
- Date-time controls serialize local selections to UTC Unix timestamps and show the interpreted local timezone before save.
- A quota reservation and counter increment are atomic. A duplicate window insert or competing increment retries through the cross-database repository helper without exceeding the configured limit.
- Exhausted quota is an operational wait state, not a message failure. It does not increment `attempt_count`, change retry backoff, or discard a lease-owned template snapshot.
- Failure to read or reserve quota fails closed for Activity email delivery and leaves other system email paths available.
- Quota status responses expose only usage, limit, and reset time; they do not expose message contents or recipients.

## Compatibility

- Historical stages containing all eight valid locales but no revision metadata normalize to `source_revision = 1` and `translated_source_revision = 1` when first loaded or updated.
- Historical English-only drafts normalize to `source_revision = 1` and `translated_source_revision = 0`; they remain editable but cannot activate before generation.
- Historical active campaigns continue sending with exact-language selection and English fallback. They are not stopped merely because old metadata is absent.
- Complete manual eight-locale API clients remain accepted. Their normalized set is treated as current and authoritative under existing validation.
- Existing English-only API clients retain automatic localization by default.
- Queued and retrying messages retain their original template snapshots and versions.
- Historical campaigns without `promotion_expiry_mode` normalize to `relative` and continue using their stored positive `promotion_valid_seconds`.
- Historical running campaigns are not silently rewritten from a non-USD minimum. New drafts and permitted edits use USD; legacy immutable runtime snapshots keep their existing Stripe semantics.
- Existing API clients may continue sending `minimum_amount_currency`, but a new or edited positive minimum is canonicalized to `usd` and the normalized response reflects that value.
- A missing `email_hourly_limit` setting loads the safe default of `100` without changing campaign records.
- Existing scheduled and retrying Activity messages join the shared quota in effective-due-time order after deployment.
- Common SMTP functions and every non-Recall caller remain behaviorally unchanged.

## Accessibility and responsive behavior

- Tabs, locale rows, editor controls, generation, retry, and confirmation dialogs are keyboard operable.
- Status is conveyed by text and icon, not color alone.
- Generation progress uses an announced polite live region; failures and activation blockers use alert semantics.
- Focus moves to the first blocker when activation fails and returns to the triggering control when a dialog closes.
- Desktop uses a side-by-side English/target editor. Narrow screens stack English above the target editor and keep the active locale and status visible.
- Date-time pickers, validity-mode selection, duration inputs, and the Activity email limit are fully labeled and keyboard operable. Selected instants include a textual timezone.
- The hourly usage summary is text, not color-only progress, and its reset time is announced when quota exhaustion changes delivery status.
- On narrow screens the shared limit and usage summary stack above the campaign table; date and time controls wrap without horizontal scrolling.
- No explanation or critical action depends on hover.

## Content rules

- Use **English content**, **Translation review**, **Generate 7 translations**, **Regenerate 7 translations**, **Manually edited**, **Stale**, and **Unable to publish** consistently.
- Regeneration confirmation explicitly says that manual corrections will be replaced.
- Activation blockers state what is wrong and the recovery action, for example: `Email 2 translations were generated from English v3, but the source is now v4. Regenerate translations.`
- Use **Coupon redeem-by**, **Promotion validity**, **Fixed expiry date**, **Valid after each run**, **Effective expiry**, **Activity email limit**, **Sent this hour**, and **Resets at** consistently.
- The limit helper says `Shared by all Activity Configuration campaigns. Other system emails are not affected.`
- Minimum amount renders with a fixed `USD` suffix rather than a selectable currency label.
- All new visible keys are translated in the Console's eight locale files and verified by the repository i18n tooling.

## Verification

### Frontend

- A new draft renders only English editors.
- Saving a Console draft does not call translation.
- Generate saves a dirty draft first, then requests one all-stage translation batch.
- Aggregate and per-locale states render correctly for generated, manually edited, stale, failed, and missing content.
- Manual correction changes only one locale and marks it correctly.
- Regeneration warns about and replaces manual corrections.
- Missing, failed, or stale locales disable activation and focus the returned blocker.
- Coupon redeem-by and fixed promotion expiry round-trip between local date-time controls and UTC timestamps.
- Switching validity modes shows only the relevant value, clears inactive data on save, and displays the effective expiry.
- Relative validity converts day and hour input to the exact duration and handles recurring runs.
- Minimum amount has a fixed USD suffix and no editable currency field.
- Activity Configuration shows the shared limit, current usage, and reset time; changing the limit updates the module setting rather than a campaign draft.
- Quota exhaustion is shown as waiting, not failed, and raising the limit refreshes the status without a page reload.
- Responsive and keyboard behavior works for English editing, locale selection, dialogs, and errors.
- Every new copy key exists as a substantive translation in all eight Console locale files.

### Backend

- Draft source saves increment only the affected stage's source revision and never call the translator in deferred mode.
- Explicit generation batches all stages and seven locales once.
- Success atomically stores a complete canonical locale set and matching revisions.
- Provider failure, malformed output, invalid HTML, missing locale, and revision conflict persist nothing.
- Manual target edits set `manual_locales` without changing source revision.
- Regeneration clears manual markers and replaces all target templates.
- Activation rejects missing, invalid, failed-equivalent, or stale locale sets.
- Active-campaign template updates are atomic and preserve already-scheduled snapshots.
- Historical complete, English-only, active, and API-client compatibility paths remain covered.
- Fixed and relative expiry modes produce the documented recipient expiry, enforce coupon redeem-by as the upper bound, and complete expired recurring fixed-mode campaigns normally.
- Positive minimum amounts canonicalize to USD for new and editable campaigns while legacy immutable runtime records remain unchanged.
- The hourly quota defaults to 100, validates its range, resets at the database-derived hour, and responds correctly to mid-window increases and decreases.
- Competing nodes cannot reserve more slots than the configured limit, including first-row creation races and boundary-hour races.
- Due selection resumes in effective-due-time then ID order after reset; exhausted quota does not increment message attempts or retry backoff.
- Definite pre-SMTP cancellation consumes no slot; retry and uncertain SMTP attempts consume a new slot; a post-reservation crash can underfill but never oversend.
- Direct tests of unrelated registration, verification, password-reset, and notification send paths show that they do not read or mutate Recall quota.

### Release evidence

Run targeted Recall Campaign Go tests and frontend component/schema tests, then Go formatting and tests, Bun typecheck, lint, build, i18n sync/report checks, and an administrator browser smoke test covering create, both validity modes, USD minimum, generation, optional correction, English edit, blocked activation, regeneration, hourly exhaustion, next-hour recovery, live limit adjustment, and successful activation.

## Success criteria

1. An operator can configure a normal activity by authoring only the English templates and selecting one generation action.
2. The Console never requires opening or confirming all seven generated translations.
3. Activation cannot succeed with missing, failed, or stale target content.
4. Optional manual corrections are visible, preserved until regeneration, and explicitly warned before replacement.
5. Generation failure never partially replaces a campaign's stored locale set.
6. Existing active campaigns, API clients, and scheduled-message snapshots continue to work.
7. Operators configure coupon and promotion expiry without typing Unix timestamps or raw seconds.
8. New and edited minimum purchase amounts are always interpreted as USD without a currency selector.
9. All Activity Configuration campaigns together stay within the configured hourly attempt limit across nodes and resume their oldest due work after reset.
10. Non-Recall system emails are neither counted nor throttled by this feature.
