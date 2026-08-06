# Flatkey Lifecycle Email Continuous Activities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver seven durable, idempotent Flatkey lifecycle emails as Continuous tasks inside Activity Configuration, covering registration, wallet and subscription quota cycles, and wallet/subscription payment states.

**Architecture:** Business transactions append replay-safe lifecycle events and maintain quota-cycle state; a database-leased continuous matcher converts each eligible occurrence into one existing Recall recipient/message flow; existing Recall workers render and send after a lifecycle-specific send-time gate. Activity Configuration owns trigger selection, immutable processing start time, delivery policy, localized one-stage templates, pacing, preview, actions, and metrics.

**Tech Stack:** Go, Gin, GORM, SQLite/MySQL 5.7.8+/PostgreSQL 9.6+, React/TypeScript, Zod, TanStack Query, Bun/Vitest, existing Recall SMTP and worker infrastructure.

---

## File and responsibility map

- `model/recall_lifecycle.go`: lifecycle trigger/policy constants, event schema, canonical occurrence hashing, event insert/lease/disposition repositories, collection marker, and trigger-slot ownership.
- `model/quota_lifecycle.go`: canonical wallet/subscription scopes, cycle state, and the only authoritative balance mutation transaction primitive.
- `model/purchase_lifecycle.go`: normalized wallet/subscription purchase transitions and transactional event production.
- `model/recall_campaign.go`, `model/recall_recipient.go`, `model/main.go`: additive campaign/recipient fields and migration registration.
- `service/recall_lifecycle.go`: continuous campaign validation, preview, event enrollment, occurrence-scoped recipient/message creation, and metrics.
- `service/recall_lifecycle_gate.go`: mutable send-time eligibility and current account-email resolution.
- `service/recall_campaign.go`, `service/recall_email.go`, `service/recall_scheduler.go`: control-plane integration, policy-aware MIME, and maintenance tick integration.
- Registration, quota, task-billing, top-up, and subscription files listed below: producer adapters only; they must delegate to shared model primitives.
- `controller/recall_campaign.go`, `router/api-router.go`: continuous preview/metrics/actions through existing Recall admin authorization.
- `web/default/src/features/recall-campaigns/*`: Continuous editor, start-time preview, trigger-aware validation/detail/metrics, and API types.
- Eight `web/default/src/i18n/locales/*.json` files: real translations for every new visible string.

## Task 1: Add the lifecycle domain model and additive migrations

**Files:**
- Create: `model/recall_lifecycle.go`
- Create: `model/recall_lifecycle_test.go`
- Create: `model/quota_lifecycle.go`
- Create: `model/quota_lifecycle_test.go`
- Modify: `model/recall_campaign.go`
- Modify: `model/recall_recipient.go`
- Modify: `model/main.go`
- Test: `model/task_cas_test.go`

- [ ] **Step 1: Write failing model tests for constants, occurrence identities, defaults, indexes, and seven trigger slots**

  Add table-driven tests that assert all seven triggers map to the approved policy, delayed offsets are exactly `7*24*time.Hour` and `24*time.Hour`, canonical inputs hash deterministically, lifecycle recipients use `occ:<sha256(event_type|occurrence_hash)>`, legacy campaigns default to `engagement`, and concurrent slot seeding yields exactly seven rows.

  ```go
  func TestLifecycleTriggerContracts(t *testing.T) {
      cases := []struct {
          trigger string
          policy  string
          delay   time.Duration
      }{
          {RecallLifecycleUserRegistered, RecallDeliveryService, 0},
          {RecallLifecycleRegistrationUnused, RecallDeliveryEngagement, 7 * 24 * time.Hour},
          {RecallLifecycleQuotaLow, RecallDeliveryService, 0},
          {RecallLifecycleQuotaExhaustedUnpaid, RecallDeliveryService, 0},
          {RecallLifecyclePaymentFailed, RecallDeliveryService, 0},
          {RecallLifecyclePaymentPending, RecallDeliveryEngagement, 24 * time.Hour},
          {RecallLifecyclePaymentSucceeded, RecallDeliveryService, 0},
      }
      for _, tc := range cases {
          contract, ok := RecallLifecycleContractForTrigger(tc.trigger)
          require.True(t, ok)
          require.Equal(t, tc.policy, contract.DeliveryPolicy)
          require.Equal(t, tc.delay, contract.Delay)
      }
  }
  ```

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./model -run 'TestLifecycle(TriggerContracts|Occurrence|Migration|TriggerSlot)' -count=1`

  Expected: FAIL because lifecycle types, fields, and tables do not exist.

- [ ] **Step 3: Implement focused domain types and migration-safe fields**

  Define:

  ```go
  type RecallLifecycleEvent struct {
      Id                int64  `gorm:"primaryKey"`
      EventType         string `gorm:"type:varchar(40);not null;uniqueIndex:idx_recall_lifecycle_occurrence,priority:1;index:idx_recall_lifecycle_due,priority:1"`
      OccurrenceKeyHash string `gorm:"type:char(64);not null;uniqueIndex:idx_recall_lifecycle_occurrence,priority:2"`
      UserId            int    `gorm:"not null;index"`
      ScopeType         string `gorm:"type:varchar(24);not null"`
      ScopeId           int64  `gorm:"not null"`
      BusinessKey       string `gorm:"type:varchar(192);not null"`
      OccurredAt        int64  `gorm:"not null;index:idx_recall_lifecycle_due,priority:4"`
      AvailableAt       int64  `gorm:"not null;index:idx_recall_lifecycle_due,priority:3"`
      SchemaVersion     int    `gorm:"not null;default:1"`
      EventData         string `gorm:"type:text;not null"`
      Disposition       string `gorm:"type:varchar(16);not null;index:idx_recall_lifecycle_due,priority:2"`
      CampaignId        int64  `gorm:"index"`
      RecipientId       int64  `gorm:"index"`
      LeaseOwner        string `gorm:"type:varchar(96);not null;default:''"`
      LeaseExpiresAt    int64  `gorm:"index"`
      AttemptCount      int    `gorm:"not null;default:0"`
      LastErrorCode     string `gorm:"type:varchar(64);not null;default:''"`
      ResolvedAt        int64
      CreatedAt         int64  `gorm:"autoCreateTime"`
      UpdatedAt         int64  `gorm:"autoUpdateTime"`
  }

  type RecallContinuousTriggerSlot struct {
      Trigger    string `gorm:"type:varchar(40);primaryKey"`
      CampaignId int64  `gorm:"not null;default:0;index"`
      UpdatedAt  int64  `gorm:"autoUpdateTime"`
  }

  type QuotaLifecycleState struct {
      Id                 int64  `gorm:"primaryKey"`
      UserId             int    `gorm:"not null;uniqueIndex:idx_quota_lifecycle_scope,priority:1"`
      ScopeType          string `gorm:"type:varchar(24);not null;uniqueIndex:idx_quota_lifecycle_scope,priority:2"`
      ScopeId            int64  `gorm:"not null;uniqueIndex:idx_quota_lifecycle_scope,priority:3"`
      CycleKey           string `gorm:"type:varchar(192);not null"`
      LastBalance        int64  `gorm:"not null"`
      WarningThreshold   int64  `gorm:"not null"`
      CycleSource        string `gorm:"type:varchar(192);not null;default:''"`
      Version            int64  `gorm:"not null;default:1"`
      CreatedAt          int64  `gorm:"autoCreateTime"`
      UpdatedAt          int64  `gorm:"autoUpdateTime"`
  }
  ```

  Add `DeliveryPolicy`, `LifecycleTrigger`, `LifecycleTriggerConfig`, and `ProcessingStartAt` to `RecallCampaign`; add nullable unique `LifecycleEventId` to `RecallRecipient`; register every model in both full and fast migrations; and use repository `common` JSON wrappers for event/config encoding.

- [ ] **Step 4: Implement conflict-safe event insert and slot seeding**

  Use `clause.OnConflict{DoNothing: true}` with an explicit reread where identity is needed. Treat a duplicate occurrence as success. Seed/repair all seven fixed slots without interpreting a missing row as unowned.

- [ ] **Step 5: Run model tests and verify GREEN**

  Run: `go test ./model -run 'TestLifecycle|TestMigrateDBFast' -count=1`

  Expected: PASS.

- [ ] **Step 6: Commit the domain layer**

  Commit with Lore intent: `Make lifecycle occurrences durable before any sender can consume them` and trailers recording cross-database constraints and the focused test command.

## Task 2: Add collection coverage marker and continuous campaign ownership

**Files:**
- Modify: `model/recall_lifecycle.go`
- Modify: `model/recall_campaign.go`
- Create: `model/recall_lifecycle_campaign_test.go`
- Modify: `service/recall_campaign.go`
- Modify: `controller/recall_campaign_test.go`

- [ ] **Step 1: Write failing tests for write-once collection time, slot races, campaign validation, and immutable fields**

  Cover concurrent marker creation (one database timestamp wins), invalid/missing marker blocking preview and activation, activation races admitting one running/paused owner, pause retaining ownership, cancel releasing ownership, and update rejection after activation for trigger/policy/start time.

  ```go
  func TestClaimContinuousTriggerSlotAllowsOneOwner(t *testing.T) {
      ids := runConcurrently(t, func() (int64, error) {
          return activateContinuousCampaign(t, RecallLifecycleQuotaLow)
      }, 2)
      require.Equal(t, 1, countSuccessful(ids))
      require.Equal(t, int64(1), countOwnedSlots(t, RecallLifecycleQuotaLow))
  }
  ```

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./model ./service ./controller -run 'Test(RecallLifecycleCollection|ClaimContinuous|ContinuousCampaign)' -count=1`

  Expected: FAIL because marker and transactional ownership APIs are absent.

- [ ] **Step 3: Implement the write-once marker and trigger-slot transaction API**

  Add exact APIs:

  ```go
  const RecallLifecycleCollectionStartedAtOption = "recall_campaign_setting.lifecycle_event_collection_started_at"

  func EnsureRecallLifecycleCollectionStartedAt(ctx context.Context) (int64, error)
  func GetRecallLifecycleCollectionStartedAt(ctx context.Context) (int64, error)
  func ClaimRecallContinuousTriggerTx(tx *gorm.DB, trigger string, campaignID int64) error
  func ReleaseRecallContinuousTriggerTx(tx *gorm.DB, trigger string, campaignID int64) error
  ```

  Obtain the initial marker from `GetDBTimestampWithContext`, insert only when absent, reread strongly consistently, reject malformed values, and never expose an update API.

- [ ] **Step 4: Extend draft canonicalization and activation validation**

  Add `continuous` to the execution-mode switch without changing due-campaign SQL. Enforce content-only, one stage, no promotion fields, supported trigger, exact trigger-to-policy mapping, valid marker, and `marker <= custom_start <= activation_db_now`. Resolve `From now` to DB time inside activation. Keep Manual/Once/Recurring semantics unchanged.

- [ ] **Step 5: Run focused tests and verify GREEN**

  Run: `go test ./model ./service ./controller -run 'Test(RecallLifecycleCollection|ClaimContinuous|ContinuousCampaign|RecallExecutionMode)' -count=1`

  Expected: PASS, including existing scheduled/manual fixtures.

- [ ] **Step 6: Commit campaign ownership**

  Commit with Lore intent: `Prevent overlapping continuous tasks from owning the same lifecycle trigger`.

## Task 3: Produce registration and delayed-unused events transactionally

**Files:**
- Modify: `model/registration_domain_risk.go`
- Modify: `model/user.go`
- Modify: `controller/user_register_test.go`
- Modify: `controller/oauth_language_test.go`
- Create: `model/registration_lifecycle_test.go`

- [ ] **Step 1: Write failing tests through password and OAuth registration transactions**

  Assert one immediate `user_registered` event and one `registration_unused` event with `available_at = created_at + 604800`, deterministic occurrence identities, initial wallet cycle `registration:<user_id>`, duplicate insert replay safety, and successful registration when email is empty.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./model ./controller -run 'Test.*Registration.*Lifecycle|TestRegister|TestOAuthRegistration' -count=1`

  Expected: lifecycle-row assertions fail while existing registration behavior remains green.

- [ ] **Step 3: Insert events and initial wallet state inside `insertRegisteredUserWithTx`**

  After the user row has its stable ID and before commit, call a focused helper:

  ```go
  func CreateRegistrationLifecycleEventsTx(tx *gorm.DB, user *User) error {
      // Immediate registration, delayed unused-registration, and the initial
      // wallet cycle are written in this same transaction.
  }
  ```

  Do not render templates, validate SMTP, or reject registration for missing email.

- [ ] **Step 4: Run registration tests and verify GREEN**

  Run: `go test ./model ./controller -run 'Test.*Registration.*Lifecycle|TestRegister|TestOAuthRegistration' -count=1`

  Expected: PASS.

- [ ] **Step 5: Commit registration producers**

  Commit with Lore intent: `Record registration milestones without coupling sign-up to email delivery`.

## Task 4: Implement the lifecycle-aware quota transaction primitive

**Files:**
- Modify: `model/quota_lifecycle.go`
- Modify: `model/quota_lifecycle_test.go`
- Modify: `model/user.go`
- Modify: `model/subscription.go`
- Create: `model/quota_lifecycle_concurrency_test.go`

- [ ] **Step 1: Write failing crossing, cycle, and concurrency tests**

  Table-test wallet and subscription scopes for above-to-low, low-to-lower, low-to-zero, above-to-zero, zero-to-positive, refund, admin grant, user/global thresholds, baseline initialization, cycle rotation, independent scopes, and two concurrent deductions. Assert above-to-zero emits only exhausted and each cycle emits at most one low and one exhausted occurrence.

  ```go
  cases := []struct {
      name string
      from, delta, threshold int64
      wantLow, wantExhausted bool
  }{
      {"above to low", 100, -60, 50, true, false},
      {"low to lower", 40, -10, 50, false, false},
      {"low to zero", 40, -40, 50, false, true},
      {"above to zero", 100, -100, 50, false, true},
      {"recovery", 0, 100, 50, false, false},
  }
  ```

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./model -run 'TestApplyLifecycleQuotaMutation|TestQuotaLifecycleConcurrent' -count=1`

  Expected: FAIL because the mutation primitive is absent.

- [ ] **Step 3: Implement the only authoritative quota mutation API**

  Define a request that makes scope and idempotency explicit:

  ```go
  type LifecycleQuotaMutation struct {
      UserID          int
      ScopeType       string
      ScopeID         int64
      Delta           int64
      RequireAtLeast  int64
      Cause           string
      SourceRef       string
      Threshold       int64
      NextCycleKey    string
      NextCycleSource string
      OccurredAt      int64
  }

  type LifecycleQuotaMutationResult struct {
      Applied         bool
      PreviousBalance int64
      CurrentBalance  int64
      CycleKey        string
  }

  func ApplyLifecycleQuotaMutation(tx *gorm.DB, mutation LifecycleQuotaMutation) (LifecycleQuotaMutationResult, error)
  ```

  Lock or CAS the authoritative wallet `users.quota` or subscription balance row plus `QuotaLifecycleState`, lazily create deterministic baselines, apply the guarded delta once, rotate only for approved successful-payment causes, insert crossings with conflict-safe occurrence keys, and update state before commit.

- [ ] **Step 4: Convert model-level wallet/subscription helpers into thin transaction adapters**

  Route `IncreaseUserQuota`, `DecreaseUserQuota`, `PreConsumeUserQuota`, `RefundUserQuota`, `PostConsumeUserSubscriptionDelta`, `PreConsumeUserSubscription`, `RefundSubscriptionPreConsume`, and `ResetDueSubscriptions` through the primitive. Preserve public signatures where callers rely on them; eliminate asynchronous wallet/subscription balance writes even when `common.BatchUpdateEnabled` is true; leave usage/log aggregates batched.

- [ ] **Step 5: Run quota model tests and verify GREEN under both batch settings**

  Run: `go test ./model -run 'Test(ApplyLifecycleQuotaMutation|QuotaLifecycleConcurrent|BatchUpdate|Subscription)' -count=1`

  Expected: PASS with tests toggling `common.BatchUpdateEnabled` false and true.

- [ ] **Step 6: Commit the primitive**

  Commit with Lore intent: `Preserve quota-cycle crossings at the authoritative balance transaction boundary`.

## Task 5: Route every runtime quota path through the primitive

**Files:**
- Modify: `service/funding_source.go`
- Modify: `service/billing_session.go`
- Modify: `service/pre_consume_quota.go`
- Modify: `service/quota.go`
- Modify: `service/text_quota.go`
- Modify: `service/task_billing.go`
- Modify: `controller/compute.go`
- Modify: `controller/task_video.go`
- Modify: `controller/midjourney.go`
- Modify: `controller/user.go`
- Modify: `service/task_billing_test.go`
- Create: `service/quota_lifecycle_integration_test.go`

- [ ] **Step 1: Add failing integration tests for reserve, settle, refund, task, compute, video, and admin adjustments**

  Exercise wallet and subscription funding through the public service/controller seams, with batch mode both ways. Assert committed balance, lifecycle state, emitted event count, and rollback behavior. Administrative grants/refunds must not rotate cycles.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./service ./controller -run 'Test.*QuotaLifecycle|Test.*TaskQuota|Test.*Funding' -count=1`

  Expected: at least one existing path bypasses lifecycle state/event production.

- [ ] **Step 3: Replace direct arithmetic at every listed caller**

  Preserve existing task-accounting idempotency by invoking `ApplyLifecycleQuotaMutation` inside `runAcceptedAccountingStepOnce` transactions. Pass stable source references for reserve/refund pairs and do not add external side effects inside the quota transaction. Remove the old `checkAndSendQuotaNotify` email path after lifecycle coverage is proven; keep unrelated notification behavior unchanged.

- [ ] **Step 4: Add a source guard for future direct wallet/subscription balance writes**

  Add a focused repository test that permits authoritative arithmetic only in `model/quota_lifecycle.go` and enumerated migration/test files. It must fail when production code introduces `UPDATE users SET quota`, `gorm.Expr("quota +`, `gorm.Expr("quota -`, or direct subscription balance arithmetic elsewhere.

- [ ] **Step 5: Run service/controller tests and verify GREEN**

  Run: `go test ./model ./service ./controller -run 'Test.*(QuotaLifecycle|TaskQuota|Funding|DirectQuotaMutationGuard)' -count=1`

  Expected: PASS.

- [ ] **Step 6: Commit quota integration**

  Commit with Lore intent: `Keep router and task billing paths inside one quota lifecycle contract`.

## Task 6: Normalize wallet purchase lifecycle transitions

**Files:**
- Create: `model/purchase_lifecycle.go`
- Create: `model/topup_lifecycle_test.go`
- Modify: `model/topup.go`
- Modify provider/controller top-up callback files discovered by `rg -n 'Recharge(WithPaymentSnapshot|Creem|Waffo|WaffoPancake|Paddle)|UpdatePendingTopUpStatus'`

- [ ] **Step 1: Write failing wallet transition tests**

  Cover pending creation at `create_time+86400`, first explicit `failed/cancelled/expired`, first success, corrected failure-to-success, callback replay, concurrent completion, stable trade-number fallback, wallet credit, and exactly one wallet-cycle rotation.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./model ./controller -run 'TestTopUpLifecycle' -count=1`

  Expected: FAIL because top-up status/credit paths do not share a lifecycle primitive.

- [ ] **Step 3: Implement normalized transactional purchase transitions**

  Define:

  ```go
  type PurchaseLifecycleTransition struct {
      Kind       string
      SourceID   int64
      TradeNo    string
      UserID     int
      FromStatus []string
      ToStatus   string
      OccurredAt int64
      Credit     int64
      SourceRef  string
  }

  func PersistPurchaseLifecycleTransition(tx *gorm.DB, transition PurchaseLifecycleTransition) (bool, error)
  ```

  CAS/lock the `TopUp`, normalize terminal statuses, insert the matching event, and on first success call the quota mutation primitive with cycle `topup:<trade_no>` or `topups:<id>`. A replay returns successful no-op without a second credit or event.

- [ ] **Step 4: Delegate every wallet provider path**

  Replace direct status and quota writes in `UpdatePendingTopUpStatus`, `RechargeWithPaymentSnapshot`, `RechargeCreem`, `RechargeWaffo`, `RechargeWaffoPancake`, `RechargePaddle`, checkout/order creation, and any `rg`-discovered sibling with the shared primitive.

- [ ] **Step 5: Run wallet tests and verify GREEN**

  Run: `go test ./model ./controller -run 'Test(TopUpLifecycle|Recharge|TopUp)' -count=1`

  Expected: PASS.

- [ ] **Step 6: Commit wallet payment producers**

  Commit with Lore intent: `Make wallet payment callbacks replay-safe lifecycle producers`.

## Task 7: Normalize subscription purchase lifecycle transitions

**Files:**
- Modify: `model/purchase_lifecycle.go`
- Create: `model/subscription_lifecycle_test.go`
- Modify: `model/subscription.go`
- Modify: `model/subscription_recurring.go`
- Modify provider/controller subscription callback files discovered by `rg -n 'CompleteSubscriptionOrder|ExpireSubscriptionOrder|PurchaseSubscriptionWithBalance'`

- [ ] **Step 1: Write failing subscription transition tests**

  Cover pending provider order creation, success, renewal, explicit failure/cancel/final expiry, callback replay, concurrent completion, balance-funded purchase/renewal, wallet debit without wallet-cycle rotation, and subscription-cycle rotation keyed by `subscription_order:<trade_no>` or `subscription_orders:<id>`.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./model ./controller -run 'TestSubscription.*Lifecycle|TestPurchaseSubscriptionWithBalance' -count=1`

  Expected: FAIL on missing pending/success/failure events or cycle state.

- [ ] **Step 3: Delegate provider and recurring paths to `PersistPurchaseLifecycleTransition`**

  Integrate `SubscriptionOrder.Insert`, `CompleteSubscriptionOrder`, `CompleteSubscriptionOrderWithProviderBinding`, recurring completion, `ExpireSubscriptionOrder`, provider wrappers, and balance-funded purchase/renewal. Keep activation/entitlement writes in their current transaction but make the lifecycle transition the sole status/event/cycle boundary.

- [ ] **Step 4: Add a provider-matrix regression test**

  The test enumerates every current success/failure wrapper and asserts that replay leaves one payment event and one quota-cycle mutation. This is the review gate for future providers.

- [ ] **Step 5: Run subscription tests and verify GREEN**

  Run: `go test ./model ./controller -run 'Test(Subscription.*Lifecycle|PurchaseSubscriptionWithBalance|CompleteSubscriptionOrder|Recurring)' -count=1`

  Expected: PASS.

- [ ] **Step 6: Commit subscription producers**

  Commit with Lore intent: `Unify provider and balance-funded subscription outcomes under one lifecycle transition`.

## Task 8: Enroll due lifecycle events into occurrence-scoped Recall delivery

**Files:**
- Create: `service/recall_lifecycle.go`
- Create: `service/recall_lifecycle_test.go`
- Modify: `model/recall_lifecycle.go`
- Modify: `model/recall_recipient.go`
- Modify: `model/recall_message.go`
- Modify: `service/recall_scheduler.go`
- Modify: `service/recall_scheduler_test.go`

- [ ] **Step 1: Write failing event lease/enrollment tests**

  Cover the exact eligibility predicate (`event_type`, collection marker, `available_at >= processing_start_at`, due by DB time), two-node leasing, expired lease recovery, stale-owner fencing, malformed event isolation, terminal skips, task replacement, and one event/recipient/stage-1 message across campaign replacement.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./model ./service -run 'TestRecallLifecycle(EventLease|Enrollment|Boundary|Recovery)' -count=1`

  Expected: FAIL because no continuous matcher exists.

- [ ] **Step 3: Implement event leasing and atomic enrollment**

  Add `RecallLifecycleWorker` with a replica owner and bounded `RunBatch(ctx, limit)`. The winning transaction revalidates the exact lease epoch, loads current facts, creates `RecallRecipient{LifecycleEventId: &event.Id, RecipientIdentity: RecallLifecycleRecipientIdentity(...)}` and one `RecallMessage`, links audit IDs, and resolves the event. Permanent bad data becomes safe terminal codes; temporary DB errors remain retryable.

- [ ] **Step 4: Integrate the worker into Recall runtime and maintenance tick**

  Run it only on the existing master scheduler when Recall is enabled. Place enrollment before recipient/email work so a newly enrolled due event may progress in the same tick without bypassing pacing.

- [ ] **Step 5: Run lease/enrollment tests and verify GREEN**

  Run: `go test ./model ./service -run 'TestRecallLifecycle|TestRecallMaintenance' -count=1`

  Expected: PASS.

- [ ] **Step 6: Commit enrollment**

  Commit with Lore intent: `Convert each due business occurrence into one existing Recall delivery flow`.

## Task 9: Add send-time gates and service/engagement MIME policy

**Files:**
- Create: `service/recall_lifecycle_gate.go`
- Create: `service/recall_lifecycle_gate_test.go`
- Modify: `service/recall_email.go`
- Modify: `service/recall_email_test.go`
- Modify: `model/recall_message.go`
- Modify: `model/recall_recipient.go`

- [ ] **Step 1: Write failing mutable-eligibility tests for all seven triggers**

  Assert current usable account/current valid `users.email`, `request_count == 0`, current quota range and cycle, exhausted balance without a newer payment cycle, and current pending/failed/succeeded order state. Change email between enrollment and SMTP admission and assert the new account email is used. Missing/invalid email and changed facts must terminate before consuming pacing/quota.

- [ ] **Step 2: Write failing MIME and opt-out matrix tests**

  For every service trigger assert no body unsubscribe link, no `List-Unsubscribe`, no `List-Unsubscribe-Post`, and opt-out ignored. For both engagement triggers assert opt-out suppression plus body/header/RFC 8058 one-click controls. Assert retries preserve deterministic `Message-ID`.

- [ ] **Step 3: Run the tests and verify RED**

  Run: `go test ./service -run 'TestRecallLifecycleSendGate|TestRecallLifecycleMIME' -count=1`

  Expected: FAIL because current Recall mail assumes engagement unsubscribe behavior.

- [ ] **Step 4: Gate inside the leased-to-sending admission boundary**

  Before `MarkRecallMessageSendingWithContext`, call a lifecycle gate for lifecycle recipients only. Refresh `EmailSnapshot` transactionally while still pre-send. Reuse existing suppressed/ineligible/cancelled states with safe reason codes such as `no_account_email`, `invalid_email`, `engagement_opted_out`, `registration_used`, `quota_recovered`, `quota_cycle_changed`, and `order_state_changed`.

- [ ] **Step 5: Make rendering and headers policy-aware**

  Add delivery policy to render input/options. Keep existing campaigns as engagement. Do not use generic user notification routing; lifecycle email always passes current account email directly to the Recall SMTP sender.

- [ ] **Step 6: Run email tests and verify GREEN**

  Run: `go test ./model ./service -run 'TestRecall.*(Email|Lifecycle|Unsubscribe|MessageID)' -count=1`

  Expected: PASS.

- [ ] **Step 7: Commit delivery policy**

  Commit with Lore intent: `Recheck mutable lifecycle facts before SMTP and separate service mail from engagement mail`.

## Task 10: Expose continuous preview, actions, metrics, and audit APIs

**Files:**
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_lifecycle.go`
- Modify: `controller/recall_campaign.go`
- Modify: `controller/recall_campaign_test.go`
- Modify: `router/api-router.go`
- Modify: `model/recall_event.go`

- [ ] **Step 1: Write failing API tests**

  Cover create/update/get/list, continuous event-boundary preview, activation blockers, duplicate-trigger conflict, pause/resume/cancel, immutable start fields, masked bounded samples, earliest available time, estimated/due counts, lifecycle backlog/disposition metrics, and existing admin authorization.

- [ ] **Step 2: Run the tests and verify RED**

  Run: `go test ./controller ./service -run 'TestRecall.*Continuous|TestRecall.*LifecyclePreview|TestRecall.*LifecycleMetrics' -count=1`

  Expected: FAIL on missing response fields/endpoints.

- [ ] **Step 3: Add trigger-aware summary/detail/draft response fields**

  Extend existing endpoints rather than create a parallel controller. For continuous preview return:

  ```go
  type RecallLifecyclePreview struct {
      ProcessingStartAt int64                   `json:"processing_start_at"`
      CollectionStartAt int64                   `json:"collection_start_at"`
      EarliestAvailable int64                   `json:"earliest_available_at"`
      EstimatedCount    int64                   `json:"estimated_count"`
      DueCount          int64                   `json:"due_count"`
      Samples           []RecallLifecycleSample `json:"samples"`
  }
  ```

  Mask user/order identifiers according to existing admin list conventions and never expose event payload secrets or raw email addresses.

- [ ] **Step 4: Preserve existing endpoint and scheduler behavior**

  Continuous never enters `GetDueRecallCampaigns`; manual, once, and recurring fixtures must remain byte-for-byte compatible except additive JSON fields.

- [ ] **Step 5: Run API tests and verify GREEN**

  Run: `go test ./controller ./service -run 'TestRecall' -count=1`

  Expected: PASS.

- [ ] **Step 6: Commit APIs**

  Commit with Lore intent: `Let operators preview and govern continuous lifecycle backlogs through Activity Configuration`.

## Task 11: Add Continuous controls to the Console

**Files:**
- Modify: `web/default/src/features/recall-campaigns/types.ts`
- Modify: `web/default/src/features/recall-campaigns/schemas.ts`
- Modify: `web/default/src/features/recall-campaigns/api.ts`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-translation-workspace.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-preview-dialog.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-action-dialog.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-detail.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-table.tsx`
- Test: corresponding `*.test.ts` and `*.test.tsx` files in the same feature directory

- [ ] **Step 1: Write failing type/schema/editor tests**

  Assert the exact mode set `Manual / Once / Recurring / Continuous`, seven triggers, fixed policy badges, default From now, custom time validation, lifecycle controls replacing audience/schedule/promotion fields, exactly one stage/no add-stage control, service warning, trigger variables, and unchanged legacy modes.

- [ ] **Step 2: Write failing preview/detail/action tests**

  Assert event-boundary estimates/samples/warning, activation blockers, lifecycle metrics and safe `SMTP accepted` wording, pause/resume/cancel, and immutable trigger/start display after activation.

- [ ] **Step 3: Run the tests and verify RED**

  Run: `cd web/default; bun test src/features/recall-campaigns`

  Expected: FAIL on missing `continuous` types and UI controls.

- [ ] **Step 4: Implement typed API/schema support**

  Add `continuous` to `RecallExecutionMode`, literal unions for all triggers/policies, continuous draft/preview/metric fields, and discriminated validation. Reject audience/recurrence/promotion fields instead of silently discarding them.

- [ ] **Step 5: Implement the editor and operations views**

  Reuse existing date-time control for optional start time. Show Lifecycle Trigger and fixed delivery policy; preserve task name, localization, preview/test-send, worker concurrency, and hourly limit. Show execution mode/trigger in list/detail and lifecycle metric cards.

- [ ] **Step 6: Run feature tests and typecheck**

  Run: `cd web/default; bun test src/features/recall-campaigns; bun run typecheck`

  Expected: both commands exit 0.

- [ ] **Step 7: Commit Console behavior**

  Commit with Lore intent: `Make lifecycle automation configurable as a first-class Continuous Activity`.

## Task 12: Add all eight translations and browser coverage

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Test: Recall Console locale/component tests

- [ ] **Step 1: Add a failing locale parity test**

  Require every new English lifecycle key in all seven other locales and reject values copied verbatim from English except fixed product identifiers such as `SMTP`.

- [ ] **Step 2: Run locale tests and verify RED**

  Run: `cd web/default; bun run i18n:sync; bun test src/features/recall-campaigns`

  Expected: FAIL until every locale has real translations.

- [ ] **Step 3: Translate every visible lifecycle string**

  Translate mode/trigger labels, exact rule descriptions, policy badges, operational warning, start-time controls, coverage boundary errors, preview estimates, metric labels, skip reasons, and SMTP-accepted wording in all eight files.

- [ ] **Step 4: Run locale, feature, and build checks**

  Run: `cd web/default; bun run i18n:sync; bun test src/features/recall-campaigns; bun run typecheck; bun run build`

  Expected: all commands exit 0.

- [ ] **Step 5: Run a local browser smoke test**

  Verify creation/edit/preview/activation views at desktop and narrow viewport, keyboard access to mode/trigger/start-time controls, no clipped translated labels, one-stage restriction, and legacy Manual/Once/Recurring flows.

- [ ] **Step 6: Commit translations and UI verification fixes**

  Commit with Lore intent: `Keep Continuous Activity controls understandable in every supported Console locale`.

## Task 13: Verify cross-database, multi-node, regression, and rollout contracts

**Files:**
- Create or modify: dialect-aware migration/CAS tests under `model/`
- Create: `docs/deployment/flatkey-lifecycle-email-continuous-activities.md`
- Modify: plan checkboxes as tasks complete

- [ ] **Step 1: Add failing dialect and multi-node regression cases not covered above**

  Exercise SQLite concurrency for event leases/slot claims, SQL generation or test containers for MySQL/PostgreSQL-compatible indexes/locks/upserts, stale fences, marker races, worker recovery, and campaign replacement dedupe. Do not use partial indexes, database JSON types, or dialect-only upserts without a tested fallback.

- [ ] **Step 2: Run focused backend verification**

  Run: `go test ./model ./service ./controller -run 'Recall|Lifecycle|Quota|TopUp|Subscription' -count=1`

  Expected: exit 0.

- [ ] **Step 3: Run broader backend verification**

  Run package suites separately to keep output visible:

  ```text
  go test ./model -count=1
  go test ./service -count=1
  go test ./controller -count=1
  go test ./router -count=1
  go vet ./model ./service ./controller ./router
  ```

  Expected: each command exits 0. If the repository-wide suite exceeds the environment window, record the bounded-package evidence and the exact uncompleted command without claiming it passed.

- [ ] **Step 4: Run full Console verification**

  Run:

  ```text
  cd web/default
  bun test src/features/recall-campaigns
  bun run typecheck
  bun run i18n:sync
  bun run build
  ```

  Expected: every command exits 0.

- [ ] **Step 5: Perform requirements and source-bypass audits**

  Reread the design completion criteria. Use `rg` to prove there are no direct purchase-status or authoritative wallet/subscription balance writes outside the shared primitives, no continuous campaign in the scheduled due query, and no service lifecycle mail adding unsubscribe controls. Review `git diff origin/main...HEAD` for secrets, raw emails, provider payloads, and database-specific schema assumptions.

- [ ] **Step 6: Write deployment notes**

  State explicitly: additive migration required; `newapi-console` required; `newapi-router` required; `newapi-web` not required; deploy all producer nodes before inserting the write-once marker; activate one trigger at a time with low hourly limits; rollback/outage producer gaps keep v1 disabled pending a separate migration design.

- [ ] **Step 7: Request final specification and code-quality reviews and fix every Critical/Important issue**

  Review range: merge-base with `origin/main` through `HEAD`. Re-run affected tests after each correction.

- [ ] **Step 8: Run fresh completion verification and commit the verified handoff**

  Commit with Lore intent: `Document the only safe rollout boundary for lifecycle event coverage`, including all executed and unexecuted verification in `Tested:` and `Not-tested:` trailers.
