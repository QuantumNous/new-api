# Activity Operations Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Recall activity money, metric drill-down, exclusions, delivery retry, scheduling, and translation operationally auditable and recoverable without introducing a second analytics or revenue system.

**Architecture:** Extend the existing Recall controller/service/model stack. Persist only exclusion batches, campaign exclusion identities, and translation tasks; reconstruct metric snapshots from Recall recipients/events plus existing financial records, and record message-state transitions as append-only Recall events. Keep all worker ownership database-fenced so multiple application instances can safely execute the same queues.

**Tech Stack:** Go 1.22, Gin, GORM v2, SQLite/MySQL/PostgreSQL, React 19, TypeScript, TanStack Query, Base UI/Tailwind, i18next, Bun/Vitest.

---

## File structure and responsibility map

Backend persistence and query files:

- Create `model/recall_exclusion.go` for `RecallExclusionBatch`, `RecallCampaignExclusion`, preview snapshots, idempotent confirmation, and persistent suppression lookups.
- Create `model/recall_translation_task.go` for durable translation-task claims, renewals, epoch-fenced completion, requeue, and latest-task lookup.
- Create `model/recall_metric_query.go` for metric keys, normalized query/filter types, snapshot high-water reads, keyset pagination, and row-grain queries.
- Create `model/recall_revenue.go` for subscription/top-up classification of authoritative attributed conversions.
- Modify `model/recall_message.go` to add a monotonic state version, transactional `message_state_changed` events, baseline reconciliation, and exclusion-aware `leased -> sending` ownership.
- Modify `model/recall_event.go` only for shared Recall-event insertion helpers and immutable state-event decoding.
- Modify `model/main.go` to migrate the three approved tables, the message state-version column, dialect-specific large columns, and indexes.

Backend orchestration and HTTP files:

- Create `service/recall_metrics.go` for the metric registry, card/drawer/export unification, revenue totals, and stable response contracts.
- Create `service/recall_metric_token.go` for HMAC-signed snapshot/cursor tokens modeled after `service/subscription_purchase_quote_token.go`.
- Create `service/recall_exclusion.go` for bounded CSV preview, identity resolution, gzip snapshot creation, confirmation, and cancellation counts.
- Create `service/recall_translation_worker.go` for the database-backed translation worker and atomic campaign writeback.
- Modify `service/recall_email.go` for retry classification/delays and exclusion-aware send entry.
- Modify `service/recall_campaign.go` for schedule normalization, audience exclusion persistence, and translation enqueue behavior.
- Modify `service/recall_scheduler.go` to run bounded translation maintenance alongside the existing Recall workers.
- Create `controller/recall_campaign_metrics.go`, `controller/recall_campaign_exclusions.go`, and `controller/recall_translation_tasks.go` for focused admin-only HTTP handlers.
- Modify `controller/recall_campaign.go` only where the existing synchronous translation handler and summary response must delegate to the new services.
- Modify `router/api-router.go` and `router/recall_campaign_test.go` for the approved endpoint surface and auth/rate-limit ordering.

Console files:

- Modify `web/default/src/features/recall-campaigns/types.ts` and `api.ts` for the new response/task/query contracts.
- Modify `web/default/src/features/recall-campaigns/helpers.ts` for ISO-currency minor-unit formatting and schedule payload mapping.
- Create `web/default/src/features/recall-campaigns/components/campaign-metric-drawer.tsx` for the shared list/filter/download surface.
- Create `web/default/src/features/recall-campaigns/components/campaign-exclusion-dialog.tsx` for preview and confirmation.
- Modify `campaign-detail.tsx`, `campaign-editor.tsx`, and `campaign-translation-workspace.tsx` for the approved product presentation.
- Modify all eight files under `web/default/src/i18n/locales/` and update focused tests.

## Execution invariants

- Start implementation in `E:\workspace\new-api-worktrees\activity-operations-enhancements` on `feature/activity-operations-enhancements`, created from the latest `origin/main`; cherry-pick the approved design and this plan only.
- Before editing a symbol, run GitNexus upstream impact for that symbol. If the local GitNexus process still crashes, record the failed command and replace it with `rg` caller search plus focused tests before editing.
- Use `common.Marshal`, `common.Unmarshal`, `common.UnmarshalJsonStr`, or `common.DecodeJson`; business code must not call `encoding/json` marshal/unmarshal functions directly.
- Every database path must work on SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+.
- Every commit in the tasks below uses the Lore trailers required by the repository-level `AGENTS.md`.

### Task 1: Add the persistence contracts and portable migrations

**Files:**
- Create: `model/recall_exclusion.go`
- Create: `model/recall_translation_task.go`
- Modify: `model/recall_message.go`
- Modify: `model/main.go`
- Test: `model/recall_repository_test.go`
- Test: `model/recall_worker_test.go`

- [ ] **Step 1: Write schema-contract tests for all three new tables and message state version**

Add table-driven assertions covering the exact indexes and column capacities:

```go
func TestRecallOperationsSchemaContract(t *testing.T) {
	setupRecallRepositoryDB(t)
	require.True(t, DB.Migrator().HasTable(&RecallExclusionBatch{}))
	require.True(t, DB.Migrator().HasTable(&RecallCampaignExclusion{}))
	require.True(t, DB.Migrator().HasTable(&RecallTranslationTask{}))
	require.True(t, DB.Migrator().HasColumn(&RecallMessage{}, "StateVersion"))
	require.True(t, DB.Migrator().HasIndex(&RecallCampaignExclusion{}, "idx_recall_exclusion_campaign_identity"))
	require.True(t, DB.Migrator().HasIndex(&RecallTranslationTask{}, "idx_recall_translation_due"))
}
```

- [ ] **Step 2: Run the schema test and verify it fails before the models exist**

Run: `go test ./model -run TestRecallOperationsSchemaContract -count=1`

Expected: FAIL because the new model types and migration entries do not exist.

- [ ] **Step 3: Define the exact model contracts**

Use these fields and stable indexes:

```go
type RecallExclusionBatch struct {
	Id                      int64  `json:"id" gorm:"primaryKey"`
	CampaignId              int64  `json:"campaign_id" gorm:"index;not null"`
	Status                  string `json:"status" gorm:"type:varchar(16);not null;index"`
	FileSHA256              string `json:"file_sha256" gorm:"type:char(64);not null;index"`
	TotalRows               int64  `json:"total_rows"`
	ResolvedUsers           int64  `json:"resolved_users"`
	DuplicateRows           int64  `json:"duplicate_rows"`
	UnresolvedRows          int64  `json:"unresolved_rows"`
	ConflictRows            int64  `json:"conflict_rows"`
	CancelledMessages       int64  `json:"cancelled_messages"`
	ResolvedUserIDsSnapshot []byte `json:"-"`
	UploadedBy              int    `json:"uploaded_by"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime"`
	AppliedAt               int64  `json:"applied_at"`
}

type RecallCampaignExclusion struct {
	Id                   int64  `json:"id" gorm:"primaryKey"`
	CampaignId           int64  `json:"campaign_id" gorm:"uniqueIndex:idx_recall_exclusion_campaign_identity,priority:1;index"`
	RecipientIdentity    string `json:"recipient_identity" gorm:"type:varchar(96);uniqueIndex:idx_recall_exclusion_campaign_identity,priority:2"`
	UserId               int    `json:"user_id" gorm:"index"`
	Persistent           bool   `json:"persistent" gorm:"index"`
	PersistentReasonCode string `json:"persistent_reason_code" gorm:"type:varchar(64)"`
	LastRunReasonCode    string `json:"last_run_reason_code" gorm:"type:varchar(64)"`
	SourceBatchId        int64  `json:"source_batch_id" gorm:"index"`
	FirstRunEventId      int64  `json:"first_run_event_id" gorm:"index"`
	LastRunEventId       int64  `json:"last_run_event_id" gorm:"index"`
	FirstSeenAt          int64  `json:"first_seen_at"`
	LastSeenAt           int64  `json:"last_seen_at" gorm:"index"`
	CreatedBy            int    `json:"created_by"`
}

type RecallTranslationTask struct {
	Id                      int64  `json:"id" gorm:"primaryKey"`
	CampaignId              int64  `json:"campaign_id" gorm:"index;not null"`
	RequestedConfigRevision int64  `json:"requested_config_revision"`
	ResultConfigRevision    int64  `json:"result_config_revision"`
	SourceHash              string `json:"source_hash" gorm:"type:char(64);not null"`
	IdempotencyKey          string `json:"idempotency_key" gorm:"type:char(64);uniqueIndex"`
	Status                  string `json:"status" gorm:"type:varchar(16);index:idx_recall_translation_due,priority:1"`
	AttemptCount            int    `json:"attempt_count"`
	NextAttemptAt           int64  `json:"next_attempt_at" gorm:"index:idx_recall_translation_due,priority:2"`
	LeaseOwner              string `json:"-" gorm:"type:varchar(96)"`
	LeaseExpiresAt          int64  `json:"-" gorm:"index"`
	LeaseEpoch              int64  `json:"-"`
	SourceSnapshot          string `json:"-" gorm:"type:text"`
	ResultSnapshot          string `json:"-" gorm:"type:text"`
	ErrorCode               string `json:"error_code" gorm:"type:varchar(64)"`
	ErrorMessage            string `json:"-" gorm:"type:varchar(512)"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime"`
	StartedAt               int64  `json:"started_at"`
	FinishedAt              int64  `json:"finished_at"`
}
```

Add `StateVersion int64` to `RecallMessage`. Register all three new tables in both serial and parallel migration lists in `model/main.go`. Reuse the repository's dialect branches to make exclusion snapshots `BLOB`/`LONGBLOB`/`BYTEA` and translation snapshots `TEXT`/`LONGTEXT`/`TEXT` without destructive conversion.

- [ ] **Step 4: Run focused migration and repository tests**

Run: `go test ./model -run 'TestRecallOperationsSchemaContract|Test.*Recall.*Repository' -count=1`

Expected: PASS on the SQLite test database.

- [ ] **Step 5: Add MySQL/PostgreSQL DryRun assertions for generated column/index SQL**

The tests must assert that no SQLite-only `ALTER COLUMN`, PostgreSQL-only partial index, or MySQL-only JSON operation is emitted.

- [ ] **Step 6: Commit the schema foundation**

Commit intent: `Give activity operations durable cross-node state`

Required trailers include `Constraint: SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+ must share one schema contract`, `Confidence: high`, `Scope-risk: moderate`, and the exact focused test command.

### Task 2: Record reconstructable message-state history

**Files:**
- Modify: `model/recall_message.go`
- Modify: `model/recall_email_quota.go`
- Modify: `model/recall_event.go`
- Create: `model/recall_message_state_test.go`
- Modify: `service/recall_email.go`
- Modify: `service/recall_worker.go`
- Modify: `service/recall_scheduler.go`

- [ ] **Step 1: Write failing transition and baseline tests**

Cover `scheduled -> leased -> sending -> retry_wait -> leased -> sending -> accepted`, manual requeue, cancellation, and one idempotent baseline event per pre-existing message. Assert every committed state change increments `state_version` and writes exactly one `message_state_changed` event in the same transaction.

```go
func TestRecallMessageTransitionWritesVersionedEventAtomically(t *testing.T) {
	message := seedRecallMessage(t, RecallMessageLeased, 3)
	won, err := TransitionRecallMessageWithEvent(context.Background(), RecallMessageTransition{
		MessageID: message.Id, From: RecallMessageLeased, To: RecallMessageSending,
		Owner: "node-a", ExpectedLeaseUntil: message.LeaseExpiresAt,
	})
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, message.Id, 4, RecallMessageLeased, RecallMessageSending)
}
```

- [ ] **Step 2: Run the test and verify no transactional transition helper exists**

Run: `go test ./model -run 'TestRecallMessageTransition|TestRecallMessageBaseline' -count=1`

Expected: FAIL at compile time for the new transition contract.

- [ ] **Step 3: Implement one transition primitive and route existing state changes through it**

Define:

```go
type RecallMessageTransition struct {
	MessageID          int64
	RecipientID        int64
	CampaignID         int64
	StageNo            int
	From               string
	To                 string
	Owner              string
	ExpectedLeaseUntil int64
	Fields             map[string]any
}

func TransitionRecallMessageWithEvent(ctx context.Context, transition RecallMessageTransition) (bool, error)
func CreateRecallMessagesWithStateEventsTx(tx *gorm.DB, campaignID int64, messages []RecallMessage, occurredAt int64) error
func TransitionRecallMessagesWithEventsTx(tx *gorm.DB, transitions []RecallMessageTransition) (int, error)
func ReconcileRecallMessageStateEventBaseline(ctx context.Context, limit int) (int, error)
func CountUnbaselinedRecallMessagesForCampaign(ctx context.Context, campaignID int64) (int64, error)
```

Inside one GORM transaction, apply the exact CAS, increment `state_version`, and insert `RecallEvent{EventType: "message_state_changed", Source: "message_state", SourceEventId: fmt.Sprintf("%d:%d", messageID, nextVersion)}`. Event data contains only message ID, recipient ID, stage, from/to state, and transition time. New message creation starts at version 1 and inserts its initial state event in the same transaction. The batch helpers select/lock the concrete rows, apply all updates, and insert one event per row before commit; callers never loop separate single-row transactions for campaign-run creation or cancellation.

- [ ] **Step 4: Replace direct metric-relevant state updates**

Route campaign-run message creation, later-stage creation, lease acquisition/release, `BeginRecallEmailSMTPAttemptWithContext`, `MarkRecallMessageSendingWithContext`, completion, manual retry, campaign cancellation, and exclusion cancellation through the primitive. Preserve existing exact owner and lease-expiry fences; the quota reservation and `leased -> sending` state event remain in one transaction.

- [ ] **Step 5: Gate message metrics on bounded baseline completion**

Run `ReconcileRecallMessageStateEventBaseline` in bounded batches from Recall maintenance. The baseline CAS changes only rows with `state_version=0`; competing nodes either insert the same unique source key or observe the winner. A message-state metric checks `CountUnbaselinedRecallMessagesForCampaign` for its own campaign and returns a typed 409/retry response only while that campaign still contains a legacy version-0 row. Unrelated campaigns remain queryable while global bounded reconciliation progresses.

- [ ] **Step 6: Run model and email-worker regression tests**

Run: `go test ./model ./service -run 'RecallMessage|RecallEmail|RecallCampaignRetry|RecallCampaignCancel' -count=1`

Expected: PASS with no duplicate state events.

- [ ] **Step 7: Commit message state history**

Commit intent: `Make delivery metrics reconstructable at a fixed snapshot`

### Task 3: Classify attributed spend and external cash

**Files:**
- Create: `model/recall_revenue.go`
- Create: `model/recall_revenue_test.go`
- Modify: `service/recall_metrics.go`
- Test: `service/recall_attribution_test.go`

- [ ] **Step 1: Write the Activity 14 acceptance fixture first**

Seed recipients 7824 and 7835 with authoritative conversion amounts of 1600 and 8000 USD minor units. Seed 7824 with a successful `TopUp`; seed 7835 with a successful balance `SubscriptionOrder` plus `WalletLedgerEntryTypePrepaidDebit`, and deliberately do not seed a third-party payment row.

```go
require.Equal(t, RecallRevenueTotals{
	Currency: "USD", AttributedSpendMinor: 9600, AttributedUsers: 2,
	NewExternalCashMinor: 1600, ExternalCashUsers: 1,
	DirectTopupMinor: 1600, DirectTopupUsers: 1,
	BalanceSubscriptionMinor: 8000, BalanceSubscriptionUsers: 1,
	OnlineSubscriptionMinor: 0, OnlineSubscriptionUsers: 0,
}, totals[0])
```

- [ ] **Step 2: Run the fixture and verify the category types are absent**

Run: `go test ./model -run TestRecallRevenueActivity14Fixture -count=1`

Expected: FAIL at compile time.

- [ ] **Step 3: Implement precedence-safe classification**

Define category constants `direct_topup`, `balance_subscription`, `online_subscription`, and `unclassified`, plus this aggregate contract:

```go
type RecallRevenueTotals struct {
	Currency                 string
	AttributedSpendMinor     int64
	AttributedUsers          int64
	NewExternalCashMinor     int64
	ExternalCashUsers        int64
	DirectTopupMinor         int64
	DirectTopupUsers         int64
	BalanceSubscriptionMinor int64
	BalanceSubscriptionUsers int64
	OnlineSubscriptionMinor  int64
	OnlineSubscriptionUsers  int64
	UnclassifiedMinor        int64
	UnclassifiedUsers        int64
}
```

Query a successful same-user `SubscriptionOrder` by trade number first; only when absent query a successful same-user `TopUp`. Treat the wallet debit as reconciliation evidence, never as another amount source.

- [ ] **Step 4: Add mirrored-top-up, ambiguous, mismatched-user, and mixed-currency tests**

Assert an online subscription mirrored into `top_ups` remains `online_subscription`, missing/ambiguous facts become `unclassified`, and USD/JPY are returned as separate rows.

- [ ] **Step 5: Run revenue and attribution tests**

Run: `go test ./model ./service -run 'RecallRevenue|RecallAttribution' -count=1`

Expected: PASS and Activity 14 yields exactly `$96.00` attributed spend versus `$16.00` external cash.

- [ ] **Step 6: Commit revenue classification**

Commit intent: `Separate attributed value from newly received cash`

### Task 4: Build the unified metric query, signed snapshots, and CSV export

**Files:**
- Create: `model/recall_metric_query.go`
- Create: `model/recall_metric_query_test.go`
- Create: `service/recall_metric_token.go`
- Create: `service/recall_metric_token_test.go`
- Create: `service/recall_metrics.go`
- Create: `service/recall_metrics_test.go`
- Create: `controller/recall_campaign_metrics.go`
- Modify: `controller/recall_campaign.go`
- Modify: `router/api-router.go`
- Modify: `router/recall_campaign_test.go`

- [ ] **Step 1: Write registry coverage and card/drawer/export equality tests**

The registry must contain exactly the supported keys from the design. For each key, execute the same query three ways and assert identical totals and row identities under one snapshot.

```go
type RecallMetricKey string

type RecallMetricQuery struct {
	CampaignID       int64
	Metric           RecallMetricKey
	Search           string
	StageNo          *int
	State            string
	ConversionKind   string
	PaymentCategory  string
	Currency         string
	Snapshot         RecallMetricSnapshot
	Cursor           RecallMetricCursor
	Limit            int
}

type RecallMetricSnapshot struct {
	AsOf                  int64
	RecipientMaxID        int64
	FactEventMaxID        int64
	MessageStateEventMaxID int64
	ExclusionMaxID        int64
	CampaignRunEventMaxID int64
}

type RecallMetricCursor struct {
	SortTime int64
	RowID    int64
}

type RecallMetricRow struct {
	RowID            int64
	RecipientID      int64
	MessageID        int64
	UserID           int
	Email            string
	OccurredAt       int64
	StageNo          int
	State            string
	ConversionKind   string
	TradeNo          string
	PaymentCategory  string
	Currency         string
	AmountMinor      int64
	FailureCode      string
}
```

- [ ] **Step 2: Run the tests and verify the unified registry is missing**

Run: `go test ./model ./service -run 'RecallMetric(Query|Registry|Snapshot|Export)' -count=1`

Expected: FAIL at compile time.

- [ ] **Step 3: Implement signed snapshot and cursor tokens**

Model them after `service/subscription_purchase_quote_token.go`. Encode version, campaign ID, metric key, `as_of`, recipient/event/exclusion/run-event high-water IDs, filter hash, row grain, and expiry; sign with `common.GenerateHMAC`. Reject malformed, expired, cross-campaign, cross-metric, or filter-mismatched tokens as a stable stale-snapshot error.

- [ ] **Step 4: Implement metric-key metadata and filter validation**

Each registry entry declares grain (`identity`, `message`, or `conversion`), supported filters, deterministic sort columns, and query builder. Normalize search as exact numeric user ID or trimmed case-insensitive email. Unsupported filters return a typed bad-request error instead of being ignored. Tests explicitly assert identity-deduplicated `enrolled`, `excluded`, and `candidates`; message-per-stage accepted/failed rows; and recipient-deduplicated opens, clicks, and conversions.

- [ ] **Step 5: Implement immutable and message-state snapshot reads**

Use recipient/event/exclusion high-water bounds for immutable facts. Derive message state from the latest `message_state_changed` event at or below the state-event high-water. Read unique opens from the existing `email_open` events and clicks from the existing `observed_click` events; do not introduce a second tracker or reinterpret claim clicks. Return `legacy_unidentified_count` separately and set `drilldown_complete=false` when old run aggregates lack identities.

- [ ] **Step 6: Implement keyset pagination and formula-safe CSV**

CSV must use the same normalized query and snapshot as the drawer, reuse existing row/byte ceilings, stream bounded batches, keep a stable header order, include campaign ID/metric key/snapshot metadata columns, prefix cells beginning with `=`, `+`, `-`, or `@` with a single quote, sanitize the download filename, and omit secrets/bodies/provider payloads.

Emit operational logs/counters containing campaign ID, metric key, a filter hash, row count, and truncation state; never log search text or email addresses.

- [ ] **Step 7: Add the HTTP surface**

Register:

```text
GET /api/recall-campaigns/:id/metric-users
GET /api/recall-campaigns/:id/metric-users/export
```

Extend the existing metrics response with currency-separated revenue categories and per-card snapshot metadata. Map invalid filters to 400, missing campaign to 404, and invalid/stale snapshot to 409.

- [ ] **Step 8: Run model, service, controller, and router tests**

Run: `go test ./model ./service ./controller ./router -run 'RecallMetric|RecallCampaignMetrics|RecallMetricExport' -count=1`

Expected: PASS, including concurrent inserts after a snapshot and separate accepted/failed row sets.

- [ ] **Step 9: Commit unified metric queries**

Commit intent: `Let every activity metric explain the rows behind it`

### Task 5: Persist audience exclusions and provide bounded CSV preview

**Files:**
- Modify: `model/recall_exclusion.go`
- Create: `model/recall_exclusion_test.go`
- Create: `service/recall_exclusion.go`
- Create: `service/recall_exclusion_test.go`
- Create: `controller/recall_campaign_exclusions.go`
- Test: `controller/recall_campaign_test.go`
- Modify: `router/api-router.go`
- Modify: `router/recall_campaign_test.go`

- [ ] **Step 1: Write parser boundary tests**

Cover case-insensitive `user_id`/`email` headers, trimming, duplicate collapse, agreeing identities, conflicts, malformed values, unknown users, a 5 MiB boundary, and a 100,000 data-row boundary. Preview must leave `recall_campaign_exclusions` empty.

- [ ] **Step 2: Run the parser tests and verify the service is missing**

Run: `go test ./service -run TestRecallExclusionPreview -count=1`

Expected: FAIL at compile time.

- [ ] **Step 3: Implement the bounded preview contract**

Define:

```go
type RecallExclusionPreview struct {
	BatchID         int64                    `json:"batch_id"`
	TotalRows       int64                    `json:"total_rows"`
	ResolvedUsers   int64                    `json:"resolved_users"`
	DuplicateRows   int64                    `json:"duplicate_rows"`
	UnresolvedRows  int64                    `json:"unresolved_rows"`
	ConflictRows    int64                    `json:"conflict_rows"`
	BlockingErrors  []RecallExclusionProblem `json:"blocking_errors"`
	Warnings        []RecallExclusionProblem `json:"warnings"`
	CancelableWork  int64                    `json:"cancelable_work"`
	Confirmable     bool                     `json:"confirmable"`
}

type RecallExclusionProblem struct {
	Row     int64  `json:"row"`
	Code    string `json:"code"`
	Message string `json:"message"`
}
```

Hash the file while reading through a 5 MiB `LimitReader`; never persist raw CSV or raw email cells. Resolve to normalized user IDs, use `common.Marshal`, gzip the sorted unique ID array, and persist an immutable `previewed` batch.

- [ ] **Step 4: Implement idempotent confirmation**

Lock the batch, verify campaign ownership/status, decompress the immutable IDs, and process sorted users in bounded chunks inside one transaction. For each identity, lock the same `RecallRecipient` row used by send entry, monotonically upsert `persistent=true`, `persistent_reason_code=operator_csv`, `source_batch_id`, `first_seen_at`, `last_seen_at`, and `created_by`, then cancel eligible work through `TransitionRecallMessagesWithEventsTx`. Mark the batch `applied`, store the actual cancelled-message count, and insert one bounded admin event before commit. Reconfirmation returns the stored applied outcome.

Emit counts keyed by campaign and batch ID for preview, apply, and cancelled messages; do not log uploaded identifiers or CSV contents.

- [ ] **Step 5: Add preview/get/confirm routes and tests**

Register the three approved endpoints before `/:id`; assert admin authorization, multipart limits, batch/campaign mismatch handling, and cross-node refresh recovery.

- [ ] **Step 6: Run focused exclusion tests**

Run: `go test ./model ./service ./controller ./router -run 'RecallExclusion' -count=1`

Expected: PASS with no suppression side effect before confirmation.

- [ ] **Step 7: Commit exclusion preview and confirmation**

Commit intent: `Let operators suppress a reviewed set without retaining uploaded PII`

### Task 6: Linearize exclusions against audience enrollment and SMTP sending

**Files:**
- Modify: `service/recall_audience.go`
- Modify: `service/recall_campaign.go`
- Modify: `model/recall_exclusion.go`
- Modify: `model/recall_message.go`
- Modify: `model/recall_email_quota.go`
- Modify: `service/recall_email.go`
- Test: `service/recall_audience_test.go`
- Test: `service/recall_email_test.go`
- Test: `model/recall_worker_test.go`

- [ ] **Step 1: Write audience-ledger and exclusion/send race tests**

Assert every new run persists rejected identities with `first_run_event_id`; persistent CSV exclusions do not inflate `candidates` until encountered. Race confirmation against `leased -> sending` on a real SQLite database and assert exactly one outcome: exclusion cancels before send, or the already-sending SMTP operation proceeds.

- [ ] **Step 2: Run the race test repeatedly and verify it fails under the current split operations**

Run: `go test ./model ./service -run 'RecallExclusion.*Race|RecallAudience.*Exclusion' -count=20`

Expected: FAIL because the current send transition does not check persistent suppression in its transaction.

- [ ] **Step 3: Persist run-time excluded identities**

During `CommitRecallCampaignRun`, upsert identity-grain `RecallCampaignExclusion` rows with `persistent=false`, normalized `last_run_reason_code`, and the immutable run event ID. The first non-zero `first_run_event_id` never changes; later runs update `last_run_event_id`, `last_run_reason_code`, and `last_seen_at` without clearing `persistent`, `persistent_reason_code`, or `source_batch_id`. Keep legacy aggregate counts only as non-clickable context.

- [ ] **Step 4: Replace the send-entry operation with one transaction**

Extend the actual runtime send-entry primitive, `BeginRecallEmailSMTPAttemptWithContext`, and keep `MarkRecallMessageSendingWithContext` consistent for callers/tests. Implement the required order:

```text
lock recipient
check campaign-level persistent exclusion
reserve the SMTP quota slot
CAS exact leased message owner/expiry to sending
record message_state_changed
commit before SMTP call
```

The helper must return a typed suppressed result so the worker cancels pending/retry work without calling SMTP. It must not recall a row already in `sending`.

- [ ] **Step 5: Prevent future stages and preserve history**

Cancellation changes only scheduled/leased/retry-wait messages and prevents later-stage creation. Accepted messages, open/click events, conversions, and audit history remain queryable.

- [ ] **Step 6: Run race, audience, and email tests**

Run: `go test ./model ./service -run 'RecallExclusion|RecallAudience|RecallEmail' -count=20`

Expected: PASS without duplicate sends or stale-lease completion.

- [ ] **Step 7: Commit exclusion linearization**

Commit intent: `Make suppression and send ownership choose one durable winner`

### Task 7: Add safe automatic SMTP retries

**Files:**
- Modify: `service/recall_activity_smtp.go`
- Modify: `service/recall_email.go`
- Modify: `model/recall_message.go`
- Test: `service/recall_activity_smtp_test.go`
- Test: `service/recall_email_test.go`

- [ ] **Step 1: Write deterministic classification and delay tests**

Use a fake clock and sender. Assert retryable failures schedule total attempts 2-5 at approximately 30, 60, 120, and 240 seconds; permanent failures stop immediately; uncertain outcomes remain `uncertain` and never enter the automatic due scan.

```go
var recallSMTPRetryDelays = [...]time.Duration{
	30 * time.Second, time.Minute, 2 * time.Minute, 4 * time.Minute,
}
```

- [ ] **Step 2: Run the tests and verify current retry timing does not meet the contract**

Run: `go test ./service -run 'RecallSMTP.*Class|RecallEmail.*Retry|RecallEmail.*Uncertain' -count=1`

Expected: FAIL on bounded attempt/delay assertions.

- [ ] **Step 3: Implement safe error categories**

Map SMTP 4xx temporary replies and safe failures before any acceptance ambiguity to retryable; map SMTP 5xx authentication/address/content rejection to permanent; map timeout or connection loss after the request may have been accepted to uncertain. Persist only sanitized codes and bounded safe messages.

Increment outcome counters for accepted, retryable, permanent, and uncertain attempts without recording recipient addresses or provider payloads.

- [ ] **Step 4: Enforce five total attempts and preserve manual uncertainty acknowledgment**

After the fifth attempt, mark failed. Keep `acknowledge_uncertain=true` mandatory in `RetryRecipient`; include the existing duplicate-risk audit data and UI copy.

- [ ] **Step 5: Run SMTP/email/campaign retry regressions**

Run: `go test ./service -run 'RecallActivitySMTP|RecallEmail|RecallCampaignRetry' -count=1`

Expected: PASS.

- [ ] **Step 6: Commit retry policy**

Commit intent: `Recover temporary SMTP failures without duplicating uncertain mail`

### Task 8: Normalize Manual, Once, Daily, and Weekly scheduling

**Files:**
- Modify: `service/recall_contract.go`
- Modify: `service/recall_campaign.go`
- Modify: `model/recall_campaign.go`
- Test: `service/recall_campaign_test.go`
- Test: `service/recall_email_test.go`

- [ ] **Step 1: Write schedule mapping and calendar-boundary tests**

Cover Manual, Once, Daily, Weekly, IANA validation, one-time past start, weekly weekday, DST spring-forward skip, DST fall-back wall-clock choice, legacy recurring `scheduled_at=0`, and multi-node `next_run_at` CAS ownership.

- [ ] **Step 2: Write stage-offset tests from first SMTP acceptance**

For offsets 0/1/4 days, assert stage 2 is `FirstSentAt+1d` and stage 3 is `FirstSentAt+4d`; assert neither uses recipient enrollment nor previous-stage send time.

- [ ] **Step 3: Run schedule tests and verify recurring start information is currently lost**

Run: `go test ./service -run 'RecallCampaign.*(Schedule|Recurring|DST)|RecallEmail.*Stage' -count=1`

Expected: FAIL on recurring start-boundary persistence and product-mode mapping.

- [ ] **Step 4: Implement the normalized schedule contract**

Continue storing backend execution modes `manual`, `scheduled_once`, and `recurring`, while mapping product Daily/Weekly to recurrence frequency. Preserve `schedule.scheduled_at` for recurring drafts, persist recurrence JSON for Once so timezone display round-trips, and compute calendar occurrences in the selected `time.Location`.

- [ ] **Step 5: Preserve the existing occurrence fence**

Keep `next_run_at` as the authoritative CAS value and ensure only the winner advances it. Weekly chooses the first selected weekday/time at or after the start boundary.

- [ ] **Step 6: Run campaign and email scheduling regressions**

Run: `go test ./service ./model -run 'RecallCampaign|RecallEmail.*Stage' -count=1`

Expected: PASS.

- [ ] **Step 7: Commit schedule semantics**

Commit intent: `Present scheduling choices without weakening occurrence ownership`

### Task 9: Queue, lease, and atomically apply translation tasks

**Files:**
- Modify: `model/recall_translation_task.go`
- Create: `model/recall_translation_task_test.go`
- Create: `service/recall_translation_worker.go`
- Create: `service/recall_translation_worker_test.go`
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_scheduler.go`
- Modify: `service/recall_email_translation.go`
- Modify: `service/recall_email_translation_test.go`

- [ ] **Step 1: Write lifecycle, idempotency, and epoch-fence tests**

Cover `queued -> running -> succeeded`, failed, superseded, duplicate submit, terminal-failed requeue, lease expiry/reclaim, stale epoch completion, restart recovery, and a changed campaign revision/source.

```go
const (
	RecallTranslationQueued     = "queued"
	RecallTranslationRunning    = "running"
	RecallTranslationSucceeded  = "succeeded"
	RecallTranslationFailed     = "failed"
	RecallTranslationSuperseded = "superseded"
)
```

- [ ] **Step 2: Run lifecycle tests and verify no durable queue exists**

Run: `go test ./model ./service -run 'RecallTranslation(Task|Worker)' -count=1`

Expected: FAIL at compile time.

- [ ] **Step 3: Implement idempotent enqueue and due-task claims**

Derive the ordinary unique idempotency key from campaign ID, requested config revision, and canonical source hash. A conditional claim sets `running`, increments `lease_epoch`, sets owner/expiry, and increments attempt count. Lease renewal and completion always match owner, epoch, and `running` state.

- [ ] **Step 4: Reuse the existing translation/validation pipeline**

The worker reads the immutable source snapshot and calls the existing protected-token, campaign-aware all-language translator. Partial language output remains local to the attempt and never updates `RecallCampaign`.

- [ ] **Step 5: Implement atomic success or supersession**

In one transaction, verify task epoch, draft status, config revision, and source hash; write the complete result, update email sequence, increment campaign revision, and mark succeeded. If revision/source changed, mark superseded and write no campaign content.

Emit task-status, lease-recovery, duration, and supersession counters keyed only by campaign/task IDs and sanitized error class.

- [ ] **Step 6: Run the task from existing Recall maintenance**

Add a bounded `Translations.RunBatch` call to `RunRecallMaintenanceTick`; one worker error must not stop recipient, email, campaign, or revocation maintenance.

- [ ] **Step 7: Run translation, scheduler, and large-template regressions**

Run: `go test ./model ./service -run 'RecallTranslation|RecallMaintenance|RecallEmailTranslation|Recall.*Large' -count=1`

Expected: PASS across restart and stale-worker cases.

- [ ] **Step 8: Commit durable translation execution**

Commit intent: `Keep model translation observable across requests and restarts`

### Task 10: Expose asynchronous translation polling endpoints

**Files:**
- Create: `controller/recall_translation_tasks.go`
- Modify: `controller/recall_campaign.go`
- Modify: `controller/recall_campaign_test.go`
- Modify: `router/api-router.go`
- Modify: `router/recall_campaign_test.go`

- [ ] **Step 1: Write 202, polling, latest, and safe-error controller tests**

Assert duplicate generate calls return the same task; active/success responses never expose source/result snapshots or raw provider errors; failed and superseded tasks expose stable error codes/copy keys only.

- [ ] **Step 2: Run controller/router tests and verify poll routes are absent**

Run: `go test ./controller ./router -run 'Recall.*Translation.*(Generate|Task|Route)' -count=1`

Expected: FAIL because the existing generation handler returns a synchronous result.

- [ ] **Step 3: Change the existing generate route to enqueue and return 202**

Keep:

```text
POST /api/recall-campaigns/:id/email-translations/generate
```

Add:

```text
GET /api/recall-campaigns/:id/email-translations/tasks/:task_id
GET /api/recall-campaigns/:id/email-translations/tasks/latest
```

Validate draft/source/revision synchronously before enqueue. Keep all three routes admin-only and preserve the critical generation rate limiter.

- [ ] **Step 4: Run controller/router translation tests**

Run: `go test ./controller ./router -run 'Recall.*Translation' -count=1`

Expected: PASS with HTTP 202 for creation.

- [ ] **Step 5: Commit translation HTTP lifecycle**

Commit intent: `Let the Console resume translation status after refresh`

### Task 11: Add frontend contracts and currency-safe helpers

**Files:**
- Modify: `web/default/src/features/recall-campaigns/types.ts`
- Modify: `web/default/src/features/recall-campaigns/api.ts`
- Modify: `web/default/src/features/recall-campaigns/api.test.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.test.ts`

- [ ] **Step 1: Write helper and API tests**

Assert `9600 USD -> $96.00`, `0 USD -> $0.00`, diagnostic `-1 USD -> -$0.01`, and `9600 JPY -> ¥9,600`. Assert metric query params preserve the supplied snapshot/filter/cursor, export uses the same query, exclusion preview uses multipart form data, and translation generate accepts HTTP 202 task data.

- [ ] **Step 2: Run focused frontend tests and verify new contracts are absent**

Run: `cd web/default && bun test src/features/recall-campaigns/api.test.ts src/features/recall-campaigns/helpers.test.ts`

Expected: FAIL at compile time or missing export assertions.

- [ ] **Step 3: Add exact frontend types**

Add these concrete response contracts; amounts remain integer minor units:

```ts
export type RecallMetricKey =
  | 'candidates'
  | 'enrolled'
  | 'excluded'
  | 'opened_recipients'
  | 'observed_clicks'
  | 'messages_accepted'
  | 'messages_failed'
  | 'direct_conversions'
  | 'assisted_conversions'
  | 'no_coupon_conversions'
  | 'attributed_spend'
  | 'new_external_cash'
  | 'direct_topup'
  | 'balance_subscription'
  | 'online_subscription'

export type RecallTranslationTaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'superseded'

export interface RecallMetricFilters {
  q?: string
  stage_no?: number
  state?: string
  conversion_kind?: string
  payment_category?: string
  currency?: string
  snapshot?: string
  cursor?: string
  limit?: number
}

export interface RecallMetricAmount {
  currency: string
  amount_minor: number
  user_count: number
}

export interface RecallMetricRow {
  row_id: number
  recipient_id: number
  message_id: number
  user_id: number
  email: string
  occurred_at: number
  stage_no: number
  state: string
  conversion_kind: string
  trade_no: string
  payment_category: string
  currency: string
  amount_minor: number
  failure_code: string
}

export interface RecallMetricResult {
  items: RecallMetricRow[]
  total: number
  amounts: RecallMetricAmount[]
  snapshot: string
  next_cursor: string
  legacy_unidentified_count: number
  drilldown_complete: boolean
}

export interface RecallTranslationTask {
  id: number
  campaign_id: number
  requested_config_revision: number
  result_config_revision: number
  status: RecallTranslationTaskStatus
  attempt_count: number
  error_code: string
  error_copy_key: string
  created_at: number
  started_at: number
  finished_at: number
}

export interface RecallExclusionPreview {
  batch_id: number
  total_rows: number
  resolved_users: number
  duplicate_rows: number
  unresolved_rows: number
  conflict_rows: number
  blocking_errors: Array<{ row: number; code: string; message: string }>
  warnings: Array<{ row: number; code: string; message: string }>
  cancelable_work: number
  confirmable: boolean
}
```

Add terminal/active task guards using the five-status union.

- [ ] **Step 4: Add API calls and ISO-currency formatting**

Use `Intl.NumberFormat(locale, {style: 'currency', currency})` to derive fraction digits and divide by `10 ** maximumFractionDigits`. Never hard-code `/100`.

- [ ] **Step 5: Run API/helper tests and typecheck**

Run: `cd web/default && bun test src/features/recall-campaigns/api.test.ts src/features/recall-campaigns/helpers.test.ts && bun run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit frontend contracts**

Commit intent: `Give the Console typed activity operations contracts`

### Task 12: Build the shared metric drawer and exclusion workflow

**Files:**
- Create: `web/default/src/features/recall-campaigns/components/campaign-metric-drawer.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-metric-drawer.test.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-exclusion-dialog.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-exclusion-dialog.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-detail.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-detail.test.tsx`

- [ ] **Step 1: Write interaction tests before components**

Assert a metric card opens the right-side drawer with its card snapshot; filters reset pagination but preserve snapshot; `Download current results` uses active filters; message grain is labeled; historical incomplete exclusions show the notice; accepted and failed cards produce separate exports.

- [ ] **Step 2: Write exclusion-dialog interaction tests**

Assert upload only previews, blocking conflicts disable confirmation, confirmation copy includes cancelable work, applied success refreshes metrics, and no raw unresolved email is retained in React state after close.

- [ ] **Step 3: Run component tests and verify they fail before components exist**

Run: `cd web/default && bun test src/features/recall-campaigns/components/campaign-metric-drawer.test.tsx src/features/recall-campaigns/components/campaign-exclusion-dialog.test.tsx src/features/recall-campaigns/components/campaign-detail.test.tsx`

Expected: FAIL at import/interaction assertions.

- [ ] **Step 4: Implement one registry-driven metric card section and shared drawer**

Render only applicable columns, mask email unless the existing admin response authorizes it, use keyset `next_cursor`, and disable duplicate downloads while a request is active. Count and money cards share the same accessible click treatment.

- [ ] **Step 5: Implement the two-step exclusion dialog**

First step uploads and shows counts/samples. Second step explicitly confirms resolved users and cancelable work. Recover a saved preview by batch ID after a component remount.

- [ ] **Step 6: Run component tests and typecheck**

Run: `cd web/default && bun test src/features/recall-campaigns/components/campaign-metric-drawer.test.tsx src/features/recall-campaigns/components/campaign-exclusion-dialog.test.tsx src/features/recall-campaigns/components/campaign-detail.test.tsx && bun run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit metric and exclusion UI**

Commit intent: `Make campaign totals directly inspectable and exportable`

### Task 13: Present schedule modes and resumable translation status

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-translation-workspace.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-translation-workspace.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-action-dialog.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-action-dialog.test.ts`

- [ ] **Step 1: Write Manual/Once/Daily/Weekly editor tests**

Assert Manual hides start controls; Once/Daily/Weekly show start date/time plus IANA timezone; Weekly shows weekday; later-email offsets are labeled as absolute offsets from the first accepted email.

- [ ] **Step 2: Write translation polling/recovery tests**

Use fake timers to assert generate returns a task, active tasks poll about every two seconds, terminal states stop polling, `tasks/latest` resumes after remount, success invalidates campaign detail, and unsaved local edits are never overwritten.

- [ ] **Step 3: Run tests and verify the synchronous UI contract fails**

Run: `cd web/default && bun test src/features/recall-campaigns/components/campaign-editor.test.tsx src/features/recall-campaigns/components/campaign-translation-workspace.test.tsx src/features/recall-campaigns/components/campaign-action-dialog.test.ts`

Expected: FAIL on schedule choices and task polling.

- [ ] **Step 4: Implement product schedule mapping**

Map Once to `scheduled_once`; Daily/Weekly to `recurring` with `frequency`; keep timezone and start instant in form state and API payload. Display errors beside the controlling field.

- [ ] **Step 5: Implement task polling and refresh recovery**

Disable generation while queued/running. Show queued, translating, succeeded, failed, and superseded separately. On success, invalidate/refetch; if the editor is dirty, show a refresh action rather than applying background data.

- [ ] **Step 6: Preserve the uncertain retry warning**

Keep the explicit checkbox and `acknowledge_uncertain=true` payload; make the duplicate-risk copy visible before the retry button enables.

- [ ] **Step 7: Run component tests and typecheck**

Run: `cd web/default && bun test src/features/recall-campaigns/components/campaign-editor.test.tsx src/features/recall-campaigns/components/campaign-translation-workspace.test.tsx src/features/recall-campaigns/components/campaign-action-dialog.test.ts && bun run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit schedule and translation UI**

Commit intent: `Make scheduled sends and background translation understandable`

### Task 14: Complete eight-language copy and end-to-end verification

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/static-keys.ts` only for non-literal lookup keys
- Test: `web/default/src/i18n/config.test.ts`

- [ ] **Step 1: Add real translations for every new visible string**

Use the approved terms for attributed spend, new external cash, direct top-up, balance-paid subscription, online-paid subscription, SMTP accepted, detected opens, observed clicks, incomplete historical identity disclosure, exclusions, schedule modes, and translation states. Do not copy English values into non-English locale files except registered brands/literals.

- [ ] **Step 2: Run synchronization and inspect changed-key reports**

Run: `cd web/default && bun run i18n:sync`

Expected: exit 0; none of the changed keys appear in `src/i18n/locales/_reports/*.untranslated.json`.

- [ ] **Step 3: Run the minimum backend verification**

Run: `go test ./model ./service ./controller -run 'Recall' -count=1`

Expected: PASS.

- [ ] **Step 4: Run cross-database compatibility tests**

Run the repository's SQLite real tests plus MySQL/PostgreSQL DryRun/dialect suites introduced in Tasks 1 and 4.

Expected: PASS with no dialect-specific unsupported SQL.

- [ ] **Step 5: Run the frontend verification**

Run: `cd web/default && bun test src/features/recall-campaigns && bun run typecheck && bun run build`

Expected: all tests, typecheck, and production build pass.

- [ ] **Step 6: Run GitNexus change-scope verification or documented fallback**

Run `detect_changes({scope: "compare", base_ref: "main"})`. If the indexer again exits abnormally, capture that output and run `git diff --stat origin/main...HEAD`, `git diff --name-only origin/main...HEAD`, and focused `rg` caller checks for every changed public symbol.

- [ ] **Step 7: Run browser visual smoke without production side effects**

Start the local Go/Console runtime with seeded fixtures and use the in-app browser to capture evidence for:

1. formatted USD revenue split and Activity 14 values;
2. metric drawer, filters, and current-result download;
3. separate accepted/failed downloads;
4. exclusion preview/conflict/confirmation impact;
5. Manual/Once/Daily/Weekly controls;
6. queued/running/succeeded translation plus refresh recovery;
7. failed and superseded translation states; and
8. uncertain retry duplicate-risk acknowledgment.

Do not send real email, activate a production campaign, charge a payment method, or apply a production exclusion.

- [ ] **Step 8: Request an independent code review and fix all actionable findings**

Review must cover correctness, privacy, cross-node fencing, SQLite/MySQL/PostgreSQL behavior, CSV injection, i18n completeness, and deployment scope. Re-run the smallest proving test after each fix.

- [ ] **Step 9: Commit verification and copy**

Commit intent: `Finish the operational contract with localized and reproducible evidence`

The final delivery report must include changed-file groups, Activity 14 evidence, test commands/results, screenshot paths, remaining known risks, and this deployment recommendation:

```text
Router deploy: required
Reason: shared Go schema and runtime initialization change, even though relay request behavior is unchanged.
Other deploy targets: newapi-console required; newapi-web, Terraform, and Cloudflare not required; staging first.
Risk / validation: disable Recall during mixed-version rollout, complete migrations on every node, then re-enable and watch task leases, SMTP outcomes, exclusions, and unclassified conversions.
```
