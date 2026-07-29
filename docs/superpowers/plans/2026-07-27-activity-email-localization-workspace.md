# Activity Email Localization Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an English-first Activity Configuration email workspace, understandable offer-expiry controls with fixed USD minimums, and one multi-node-safe hourly attempt limit shared by all Recall activity campaigns only.

**Architecture:** Keep Recall behavior inside the existing campaign, worker, and JSON email-sequence boundaries. Persist promotion-expiry mode on campaigns, localization revisions inside `email_sequence_config`, and one database quota row per UTC hour; expose only Recall-specific status/generation endpoints while continuing to use the existing system-option update path for the limit. Split the large Console editor into focused validity and localization components and keep all non-Recall SMTP callers unchanged.

**Tech Stack:** Go, Gin, GORM, SQLite/MySQL/PostgreSQL, React 19, TypeScript, React Hook Form, Zod, TanStack Query, Base UI/Tailwind, Bun/Vitest.

---

## File map

- `setting/operation_setting/recall_campaign_setting.go`: add and validate `email_hourly_limit` with default `100` and range `1..100000`.
- `model/recall_email_quota.go`: own UTC-hour quota rows, atomic reservation, and status reads.
- `model/recall_message.go`: order due work by effective due time plus ID and release a lease when no quota slot is available.
- `model/main.go`: register the quota table in normal and first-run migrations.
- `service/recall_email.go`: reserve immediately before the SMTP boundary and stop a batch cleanly on exhaustion.
- `service/recall_contract.go`, `model/recall_campaign.go`, `service/recall_campaign.go`: persist expiry mode, canonicalize USD minimums, maintain localization revisions, and enforce activation freshness.
- `controller/recall_campaign.go`, `router/api-router.go`: add admin-only quota-status and translation-generation endpoints.
- `web/default/src/features/recall-campaigns/{types.ts,schemas.ts,helpers.ts,api.ts}`: mirror the backend contract and API operations.
- `web/default/src/features/recall-campaigns/components/campaign-offer-validity-fields.tsx`: date-time and relative-validity controls.
- `web/default/src/features/recall-campaigns/components/campaign-translation-workspace.tsx`: English authoring, readiness, locale review, manual correction, and regeneration confirmation.
- `web/default/src/features/recall-campaigns/components/campaign-email-hourly-limit-control.tsx`: shared limit, usage, reset time, and exhaustion state.
- `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`, `index.tsx`: integrate the focused components and save-before-generate flow.
- `web/default/src/i18n/locales/{en,zh,es,fr,pt,ru,ja,vi}.json`: substantive visible copy in all eight Console languages.

### Task 1: Persist and atomically reserve the shared Activity email quota

**Files:**
- Create: `model/recall_email_quota.go`
- Create: `model/recall_email_quota_test.go`
- Modify: `model/main.go`
- Modify: `setting/operation_setting/recall_campaign_setting.go`
- Modify: `setting/operation_setting/recall_campaign_setting_test.go`

- [ ] **Step 1: Write failing setting and repository tests**

Add tests with these contracts:

```go
func TestRecallCampaignSettingDefaultsEmailHourlyLimit(t *testing.T) {
	require.Equal(t, 100, GetRecallCampaignSetting().EmailHourlyLimit)
}

func TestRecallCampaignSettingRejectsEmailHourlyLimitOutsideRange(t *testing.T) {
	for _, limit := range []int{0, 100001} {
		cfg := RecallCampaignSetting{BatchSize: 100, TickSeconds: 30, EmailHourlyLimit: limit}
		require.ErrorContains(t, cfg.NormalizeAndValidate(), "email hourly limit")
	}
}

func TestReserveRecallEmailQuotaNeverExceedsLimit(t *testing.T) {
	// Use one SQLite test database and concurrent goroutines.
	// Exactly limit reservations return true; every later reservation returns false.
}

func TestRecallEmailQuotaStatusUsesDatabaseHourAndResets(t *testing.T) {
	// Seed one UTC-hour row, assert used/remaining/reset_at, then advance the injected DB timestamp
	// into the next hour and assert a fresh zero-usage status.
}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./model ./setting/operation_setting -run 'Test(ReserveRecallEmailQuota|RecallEmailQuotaStatus|RecallCampaignSetting.*EmailHourlyLimit)' -count=1`

Expected: compile failures for `EmailHourlyLimit`, `RecallEmailQuotaWindow`, reservation, and status APIs.

- [ ] **Step 3: Implement the minimal cross-database quota model**

Use this public contract:

```go
type RecallEmailQuotaWindow struct {
	WindowStartedAt int64 `json:"window_started_at" gorm:"primaryKey;autoIncrement:false"`
	Attempts        int   `json:"attempts" gorm:"not null;default:0"`
	UpdatedAt       int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecallEmailQuotaStatus struct {
	Limit           int   `json:"limit"`
	Used            int   `json:"used"`
	Remaining       int   `json:"remaining"`
	WindowStartedAt int64 `json:"window_started_at"`
	ResetsAt        int64 `json:"resets_at"`
	Exhausted       bool  `json:"exhausted"`
}

func ReserveRecallEmailQuotaWithContext(ctx context.Context, limit int) (RecallEmailQuotaStatus, bool, error)
func GetRecallEmailQuotaStatusWithContext(ctx context.Context, limit int) (RecallEmailQuotaStatus, error)
```

Derive `window_started_at` from `GetDBTimestamp() / 3600 * 3600`. Insert the window with `clause.OnConflict{DoNothing: true}`, then perform one conditional atomic update using `attempts < limit` and `gorm.Expr("attempts + ?", 1)`. Read the row after the update to build status. Register `RecallEmailQuotaWindow` in both migration lists without database-specific SQL.

- [ ] **Step 4: Verify GREEN**

Run: `go test ./model ./setting/operation_setting -run 'Test(ReserveRecallEmailQuota|RecallEmailQuotaStatus|RecallCampaignSetting)' -count=1`

Expected: PASS, including the concurrent reservation assertion.

- [ ] **Step 5: Commit the quota persistence slice with a Lore message**

Intent: protect the Activity email stream with one cross-node hourly budget. Tested evidence must name the model and setting tests; scope risk is moderate because it adds a migration but does not yet change sending.

### Task 2: Enforce quota at the Recall SMTP boundary and preserve due order

**Files:**
- Modify: `model/recall_message.go`
- Modify: `model/recall_repository_test.go`
- Modify: `service/recall_email.go`
- Modify: `service/recall_email_test.go`

- [ ] **Step 1: Write failing due-order, lease-release, and worker tests**

Add tests proving:

```go
func TestListDueRecallMessagesOrdersByEffectiveDueTimeThenID(t *testing.T) {
	// Mix scheduled_at, next_attempt_at, and expired lease rows.
	// Assert effective due time first and ID only as the tie breaker.
}

func TestReleaseRecallMessageLeaseRestoresScheduledAndRetryStates(t *testing.T) {
	// Lease one scheduled and one retry_wait row, release each with its captured prior state,
	// and assert its due timestamp and attempt_count are unchanged.
}

func TestRecallEmailWorkerStopsAtSharedHourlyLimit(t *testing.T) {
	// Limit two; enqueue four valid messages; assert two SMTP calls, two reservations,
	// later work remains due, and the batch stops without incrementing attempts/backoff.
}

func TestRecallEmailWorkerPreSMTPCancellationDoesNotConsumeQuota(t *testing.T) {
	// An opted-out or expired recipient is cancelled with zero quota use.
}

func TestRecallEmailWorkerRetryAndUncertainSendReserveNewSlots(t *testing.T) {
	// Each actual SMTP attempt reserves once, including retry and uncertain outcomes.
}

func TestUnrelatedEmailSenderDoesNotReferenceRecallQuota(t *testing.T) {
	// Keep common.SendEmailWithMessageID injectable and prove quota rows change only through RecallEmailWorker.
}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./model ./service -run 'Test(ListDueRecallMessagesOrders|ReleaseRecallMessageLease|RecallEmailWorker.*Quota|UnrelatedEmailSender)' -count=1`

Expected: failures because effective-due ordering, lease restoration, and quota reservation are absent.

- [ ] **Step 3: Implement due candidates and reversible leases**

Define a candidate that captures the original state before leasing:

```go
type RecallDueMessage struct {
	ID                   int64
	State                string
	EffectiveDueAt       int64
	PreviousLeaseExpires int64
}

func ListDueRecallMessages(now int64, limit int) ([]RecallDueMessage, error)
func LeaseDueRecallMessage(candidate RecallDueMessage, owner string, now, leaseUntil int64) (bool, error)
func ReleaseRecallMessageLeaseWithContext(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, candidate RecallDueMessage) (bool, error)
```

Use a portable SQL `CASE` expression for effective due ordering. The lease update must include the candidate state and due predicate so a stale candidate cannot win. Release only an exact lease epoch owned by the worker and restore scheduled/retry/expired-lease state without altering `attempt_count`, due timestamps, or retry backoff.

- [ ] **Step 4: Reserve immediately before sending**

Process due candidates sequentially in `RunBatch` so claiming stops after the first exhausted reservation. Keep all suppression, activity, expiry, template, rendering, and second-fence checks before `ReserveRecallEmailQuotaWithContext`. On exhaustion, release the lease, return a typed wait signal containing `resets_at`, stop the batch without treating the message as failed, and leave `worker_concurrency` untouched. A successful reservation is never refunded, including uncertain SMTP outcomes or a process failure after reservation.

- [ ] **Step 5: Verify GREEN**

Run: `go test ./model ./service -run 'Test(ListDueRecallMessagesOrders|ReleaseRecallMessageLease|RecallEmailWorker)' -count=1`

Expected: PASS; sender call count never exceeds the configured limit.

- [ ] **Step 6: Commit the delivery enforcement slice with a Lore message**

Intent: keep all Recall activities inside one attempt budget without affecting common SMTP. Record the conservative no-refund choice and the fact that completion order across nodes is not serialized.

### Task 3: Add fixed/relative expiry modes and canonical USD minimums

**Files:**
- Modify: `service/recall_contract.go`
- Modify: `model/recall_campaign.go`
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_campaign_test.go`
- Modify: `service/recall_stripe_test.go`
- Modify: `model/recall_repository_test.go`

- [ ] **Step 1: Write failing validation, persistence, and scheduler tests**

Cover:

```go
func TestValidateRecallCampaignDraftSupportsFixedAndRelativePromotionExpiry(t *testing.T) {
	// fixed requires future promotion_expires_at and clears promotion_valid_seconds;
	// relative requires positive promotion_valid_seconds and clears promotion_expires_at.
}

func TestRecallCampaignEffectiveExpiryUsesCouponAsHardUpperBound(t *testing.T) {
	// Assert min(fixed-or-relative expiry, coupon_redeem_by) for one run.
}

func TestRecurringFixedExpiryCompletesAfterFinalEligibleRun(t *testing.T) {
	// If the next recurrence is at/after fixed expiry, commit the current run and mark completed.
}

func TestNewAndEditableRecallMinimumAmountsCanonicalizeToUSD(t *testing.T) {
	// Client sends EUR/empty with positive minimum; stored normalized draft uses usd.
}

func TestLegacyRunningRecallMinimumCurrencyIsNotRewritten(t *testing.T) {
	// Loading and sending an immutable running record preserves its historical currency.
}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./service ./model -run 'Test(ValidateRecallCampaignDraftSupports|RecallCampaignEffectiveExpiry|RecurringFixedExpiry|NewAndEditableRecallMinimum|LegacyRunningRecallMinimum)' -count=1`

Expected: compile or assertion failures for expiry fields and USD canonicalization.

- [ ] **Step 3: Implement the contract and migration-safe model fields**

Add:

```go
const (
	RecallPromotionExpiryRelative = "relative"
	RecallPromotionExpiryFixed    = "fixed"
)

type RecallCampaignDraft struct {
	// existing fields
	PromotionExpiryMode string `json:"promotion_expiry_mode"`
	PromotionExpiresAt  int64  `json:"promotion_expires_at"`
}
```

Persist `PromotionExpiryMode` as `varchar(16)` and `PromotionExpiresAt` as `int64` on `model.RecallCampaign`, include them in draft updates, transition allowlists, model conversion, and immutable comparisons. Normalize historical rows with an empty mode to `relative` when reading. For new or editable drafts, a positive minimum always sets `MinimumAmountCurrency = "usd"`; zero minimum clears it. Do not run a data rewrite over existing running rows.

- [ ] **Step 4: Implement one effective-expiry helper and recurring completion**

Use one helper for activation and every run:

```go
func recallPromotionExpiryAt(draft RecallCampaignDraft, runAt time.Time) (int64, error) {
	// fixed => promotion_expires_at; relative => runAt + promotion_valid_seconds;
	// apply coupon_redeem_by as the hard upper bound; require result > runAt.
}
```

For recurring fixed campaigns, if the next run is at or after the fixed/coupon bound, commit the current run with status `completed`, `next_run_at = 0`, and `completed_at` set. Completed campaigns remain allowed to finish already-scheduled email messages.

- [ ] **Step 5: Verify GREEN and commit**

Run: `go test ./service ./model -run 'Test(RecallCampaign|ValidateRecallCampaignDraftSupports|NewAndEditableRecallMinimum|LegacyRunningRecallMinimum)' -count=1`

Expected: PASS with legacy relative behavior unchanged.

### Task 4: Persist localization freshness and make Console draft saves translation-free

**Files:**
- Modify: `service/recall_contract.go`
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_campaign_test.go`

- [ ] **Step 1: Write failing localization-state tests**

Add exact behaviors:

```go
func TestDeferredRecallDraftSaveStoresEnglishWithoutCallingTranslator(t *testing.T) {
	// defer_localization=true; fake translator call count stays zero; source_revision starts at one;
	// translated_source_revision stays zero for English-only content.
}

func TestDeferredRecallDraftEnglishEditMarksStoredTargetsStale(t *testing.T) {
	// Source revision increments once, target templates remain stored, translated revision stays old.
}

func TestDeferredRecallManualLocaleEditMarksOnlyThatLocale(t *testing.T) {
	// Editing es adds only es to normalized manual_locales without changing source revision.
}

func TestLegacyCompleteRecallLocalesNormalizeCurrentAndEnglishOnlyNormalizeStale(t *testing.T) {
	// Complete eight-locale history => 1/1; English-only => 1/0.
}

func TestExistingEnglishOnlyAPIClientStillAutomaticallyLocalizes(t *testing.T) {
	// defer_localization omitted/false retains the current translator behavior.
}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./service -run 'Test(DeferredRecall|LegacyCompleteRecallLocales|ExistingEnglishOnlyAPIClient)' -count=1`

Expected: compile failures for localization metadata and deferred save behavior.

- [ ] **Step 3: Implement derived revision metadata**

Extend `RecallEmailStage`:

```go
SourceRevision           int      `json:"source_revision,omitempty"`
TranslatedSourceRevision int      `json:"translated_source_revision,omitempty"`
ManualLocales            []string `json:"manual_locales,omitempty"`
```

Add `DeferLocalization bool json:"defer_localization,omitempty"` to the request-only draft contract. Normalize revisions from stored content, compare normalized English to increment only its stage revision, derive changed target locales instead of trusting client status strings, and retain the prior complete target set when English becomes stale. Existing callers without the flag keep automatic localization.

- [ ] **Step 4: Add activation freshness validation**

Activation must return an error identifying stage and locale when the set is not exactly eight valid locales or `translated_source_revision != source_revision`. Historical already-active campaigns bypass this new activation gate and retain delivery-time English fallback.

- [ ] **Step 5: Verify GREEN and commit**

Run: `go test ./service -run 'Test(DeferredRecall|LegacyCompleteRecallLocales|ExistingEnglishOnlyAPIClient|RecallCampaign.*Activat)' -count=1`

Expected: PASS; no translator call occurs during a deferred draft save.

### Task 5: Add atomic explicit generation and quota-status APIs

**Files:**
- Modify: `model/recall_campaign.go`
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_campaign_test.go`
- Modify: `controller/recall_campaign.go`
- Modify: `controller/recall_campaign_test.go`
- Modify: `router/api-router.go`
- Modify: `router/recall_campaign_test.go`

- [ ] **Step 1: Write failing generation and controller tests**

Cover one translator call for all stages/seven targets, all-or-nothing failure, protected-content validation propagation, manual-marker clearing, `config_revision` conflict, active-campaign English update atomicity, structured activation blockers, admin authorization, and quota status fields.

Use this request/response contract:

```go
type RecallEmailGenerationRequest struct {
	ConfigRevision int64              `json:"config_revision"`
	Name           string             `json:"name"`
	Emails         []RecallEmailStage `json:"email_sequence"`
}

type RecallEmailGenerationResponse struct {
	ConfigRevision int64              `json:"config_revision"`
	Emails         []RecallEmailStage `json:"email_sequence"`
}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./service ./controller ./router -run 'Test(GenerateRecallEmailTranslations|RecallEmailGeneration|RecallEmailQuotaStatusRoute)' -count=1`

Expected: compile failures for service/controller methods and routes.

- [ ] **Step 3: Implement atomic generation**

Add `GenerateEmailTranslations(ctx, actorID, campaignID, request)` to the campaign service. Normalize the proposed English stages, capture the current campaign revision and per-stage source revisions, invoke the existing translator once, validate an exact complete result, recheck the revision, then CAS-update all seven targets plus English in one `email_sequence_config` write. Clear `manual_locales`, set translated revisions equal to source revisions, and increment template versions only when persisted content changes. Failure or conflict persists nothing.

- [ ] **Step 4: Add admin routes**

Register before `/:id`:

```text
GET  /api/recall-campaigns/email-quota
POST /api/recall-campaigns/:id/email-translations/generate
```

The quota endpoint reads `operation_setting.GetRecallCampaignSetting().EmailHourlyLimit` and `model.GetRecallEmailQuotaStatusWithContext`. It exposes only limit, usage, remaining, window start, reset time, and exhausted state.

- [ ] **Step 5: Verify GREEN and commit**

Run: `go test ./service ./controller ./router -run 'Test(GenerateRecallEmailTranslations|RecallEmailGeneration|RecallEmailQuota)' -count=1`

Expected: PASS with one translator call and zero partial writes on every failure case.

### Task 6: Mirror the contract in frontend types, schemas, helpers, and API calls

**Files:**
- Modify: `web/default/src/features/recall-campaigns/types.ts`
- Modify: `web/default/src/features/recall-campaigns/schemas.ts`
- Modify: `web/default/src/features/recall-campaigns/schemas.test.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.test.ts`
- Modify: `web/default/src/features/recall-campaigns/api.ts`
- Modify: `web/default/src/features/recall-campaigns/api.test.ts`

- [ ] **Step 1: Write failing pure-contract tests**

Assert fixed/relative schema branches, future date validation, coupon cap display calculation, positive minimum canonicalized to `USD`, relative day/hour conversion, derived ready/stale/manual/missing locale states, generation request URL/body, quota status URL, and update-option key `recall_campaign_setting.email_hourly_limit`.

- [ ] **Step 2: Verify RED**

Run from `web/default`: `bun test src/features/recall-campaigns/schemas.test.ts src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/api.test.ts`

Expected: type or assertion failures for the new fields and endpoints.

- [ ] **Step 3: Implement the frontend domain contract**

Add `RecallPromotionExpiryMode`, localization metadata fields, `RecallEmailQuotaStatus`, and generation request/response interfaces. Default new drafts to `promotion_expiry_mode: 'relative'`, `promotion_expires_at: 0`, `defer_localization: true`, and USD minimum semantics. Add pure helpers for seconds/date conversion and localization status; keep status derived from revisions and template presence.

- [ ] **Step 4: Verify GREEN**

Run the same Bun test command. Expected: PASS.

### Task 7: Replace machine-oriented offer fields with accessible validity controls

**Files:**
- Create: `web/default/src/features/recall-campaigns/components/campaign-offer-validity-fields.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-offer-validity-fields.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`

- [ ] **Step 1: Write failing component tests**

Render the editor and assert:

- coupon redeem-by uses `DateTimePicker`, not a numeric timestamp input;
- fixed promotion mode shows a second `DateTimePicker` and hides duration inputs;
- relative mode shows integer days/hours and hides fixed expiry;
- switching modes clears the inactive serialized value;
- effective expiry shows the coupon-capped result with local timezone text;
- minimum amount has a visible USD suffix and no editable currency field;
- keyboard labels and field errors are associated.

- [ ] **Step 2: Verify RED**

Run from `web/default`: `bun test src/features/recall-campaigns/components/campaign-offer-validity-fields.test.tsx src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: FAIL because raw number and currency inputs still render.

- [ ] **Step 3: Implement and integrate the focused component**

Use React Hook Form `Controller` to map local `Date` values to UTC Unix seconds. Keep days/hours as presentation values while serializing exactly one positive `promotion_valid_seconds`. Render the fixed USD suffix beside the minimum amount and set/clear `minimum_amount_currency` in submit normalization rather than exposing it.

- [ ] **Step 4: Verify GREEN**

Run the same Bun tests. Expected: PASS.

### Task 8: Build the English-first translation workspace and save-before-generate flow

**Files:**
- Create: `web/default/src/features/recall-campaigns/components/campaign-translation-workspace.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-translation-workspace.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Cover new English-only draft, separate English/Translation review tabs, one all-stage Generate action, dirty save before generation, optional locale review, manual correction marker, stale state after English edit, regeneration warning with manual count, previous targets preserved after generation failure, no per-locale confirmation requirement, and activation blocker focus.

- [ ] **Step 2: Verify RED**

Run from `web/default`: `bun test src/features/recall-campaigns/components/campaign-translation-workspace.test.tsx src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: FAIL because the editor still renders eight language buttons and has no explicit generation action.

- [ ] **Step 3: Implement the workspace**

The English tab renders the existing subject/HTML editor for `templates.en` only. Translation review renders aggregate `ready/total`, seven locale rows, read-only English context, and one target editor. `Generate 7 translations` calls the editor's save helper first when the form is new or dirty, then calls the generation endpoint with the returned campaign ID/revision. Regeneration displays a confirmation dialog when `manual_locales` is non-empty and replaces all targets only after success.

- [ ] **Step 4: Enforce publish readiness in the UI without replacing the server guard**

Disable activation when any stage is missing/stale/invalid and render the exact recovery action. When the server returns structured blockers, focus the first blocker. Do not require locale-by-locale acknowledgement.

- [ ] **Step 5: Verify GREEN**

Run: `bun test src/features/recall-campaigns/components/campaign-translation-workspace.test.tsx src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: PASS with one generation request for all stages.

### Task 9: Add the shared Activity email limit control and eight-language copy

**Files:**
- Create: `web/default/src/features/recall-campaigns/components/campaign-email-hourly-limit-control.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-email-hourly-limit-control.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/index.tsx`
- Modify: `web/default/src/features/recall-campaigns/copy.ts`
- Modify: `web/default/src/features/recall-campaigns/copy.test.ts`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`

- [ ] **Step 1: Write failing quota-control and copy tests**

Assert default `100`, range validation, `used / limit`, localized reset time, exhausted waiting state, mid-window increase refresh, decrease below usage without rewriting usage, and helper copy stating that all Activity Configuration campaigns share the limit while other system emails are unaffected. Extend copy tests so every new key exists and non-English locales do not copy the English sentence verbatim except protected product terms.

- [ ] **Step 2: Verify RED**

Run from `web/default`: `bun test src/features/recall-campaigns/components/campaign-email-hourly-limit-control.test.tsx src/features/recall-campaigns/copy.test.ts`

Expected: FAIL because the control and translations do not exist.

- [ ] **Step 3: Implement the list-header control**

Query `/api/recall-campaigns/email-quota`, update `recall_campaign_setting.email_hourly_limit` through the existing `useUpdateOption`, invalidate quota and system-option queries on success, and show the last confirmed value on failure. Poll only while the page is visible, using the reset time to avoid aggressive refreshes.

- [ ] **Step 4: Add substantive translations and verify GREEN**

Run:

```text
bun test src/features/recall-campaigns
bun run i18n:sync
```

Expected: all feature tests pass and no new key appears in `_reports/{lang}.untranslated.json`.

### Task 10: Full verification, review, and final Lore commit

**Files:**
- Review every file changed by Tasks 1-9.
- Do not modify or push `main`.

- [ ] **Step 1: Run backend validation**

```text
gofmt -w <changed Go files>
go test ./model ./service ./controller ./router ./setting/operation_setting -count=1
go test ./...
go build ./...
```

Expected: every command exits `0` with no test failures.

- [ ] **Step 2: Run frontend validation**

From `web/default`:

```text
bun test src/features/recall-campaigns
bun run typecheck
bun run lint
bun run i18n:sync
bun run build:check
```

Expected: every command exits `0`; translation reports contain no changed key.

- [ ] **Step 3: Run browser smoke tests**

At desktop 1440px and mobile 390px, verify create draft, both expiry modes, coupon cap, USD minimum, generation success/failure, optional manual correction, stale English, regeneration warning, activation blockers, quota exhaustion, next-hour recovery presentation, live limit increase/decrease, keyboard focus, and successful activation using safe local/staging test data only.

- [ ] **Step 4: Run repository scope and code review checks**

Run `git diff --check`, inspect `git diff --stat`, confirm common SMTP callers are unchanged, and use GitNexus `detect_changes(scope: "compare", base_ref: "main")` if the tool is available. Perform a specification pass followed by code-quality/security/multi-node review; fix every critical or important finding and rerun affected validation.

- [ ] **Step 5: Commit remaining integration changes with Lore**

The final commit record must state: the limit is Recall Activity-module-wide only; quota reservations count SMTP attempts and are never refunded; fixed/relative expiry compatibility; USD canonicalization scope; targeted and full validation evidence; and any browser or cross-database validation gap. Stop with the feature branch verified and unpushed unless the user separately requests staging or PR actions.
