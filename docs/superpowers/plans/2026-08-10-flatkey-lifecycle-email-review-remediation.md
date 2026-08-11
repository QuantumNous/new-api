# Flatkey Lifecycle Email Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every verified PR #677 review finding without changing the approved payment-correction semantics, and leave regression evidence for transaction ownership, state convergence, preview canonicalization, and UI race fencing.

**Architecture:** Keep each financial or campaign transition under a single database winner, move the expensive lifecycle SMTP decision outside the recipient-lock transaction, and make trigger-derived delivery policy the shared backend/frontend source of truth. Treat API encoding as the final Continuous payload boundary, while preserving narrow compatibility fallbacks only for non-running campaigns whose lifecycle marker is not ready.

**Tech Stack:** Go, GORM, SQLite/MySQL/PostgreSQL dialect behavior, Bun, React, TypeScript, Vitest, GitHub CLI.

---

## Execution constraints

- Work only in `C:\Users\11247\.config\superpowers\worktrees\new-api\flatkey-lifecycle-email-continuous` on `feat/flatkey-lifecycle-email-continuous`; do not touch the dirty repository at `E:\workspace\new-api`.
- For every behavior, add or strengthen the regression test first, run it and record the expected RED failure, then make the minimum production change and rerun GREEN.
- Do not remove `failed|expired|cancelled -> success` from `topUpSuccessFromStatuses`; late authoritative payment success is an approved correction path.
- Do not edit `model/recall_campaign.go`, `model/redemption.go`, or `service/billing_session.go` for mis-anchored DataTool comments unless an independently reproduced defect requires it.
- Before Task 3, read `pkg/billingexpr/expr.md` completely. Preserve the billing-expression contract and add no new dependency.
- Commit each task independently with the Lore trailers `Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, and `Not-tested` where they carry useful decision context.
- After each task: specification review first, then code-quality review; resolve and re-review every finding before moving to the next task.

## File responsibility map

- `model/recall_lifecycle.go`: lifecycle occurrence insertion, duplicate classification, lease/defer primitives, and trigger-to-policy mapping.
- `model/recall_email_quota.go`: bounded recipient reservation transaction; it must not call the multi-table lifecycle service gate while holding the recipient row lock.
- `service/recall_lifecycle_gate.go` and `service/recall_email.go`: full lifecycle eligibility evaluation and SMTP worker orchestration.
- `service/recall_lifecycle.go`: claimed lifecycle-event enrollment and lifecycle metrics marker classification.
- `service/recall_campaign.go`, `service/recall_attribution.go`, and `service/recall_contract.go`: Continuous campaign state transitions, audit, metrics compatibility, and preview policy contract.
- `service/quota.go` and `service/billing.go`: no-session subscription quota settlement and notifications.
- `model/purchase_lifecycle.go`, `model/subscription_recurring.go`, and `service/subscription_compensation.go`: payment lifecycle terminal invariants, provider-binding repair, and historical compensation replay.
- `controller/subscription_payment_waffo_pancake.go`: observable checkout-failure lifecycle persistence.
- `model/data_tool_call.go`: single-winner terminal settlement/refund and quota underflow protection.
- `web/default/src/features/recall-campaigns/*`: async preview fencing, schedule-mode state restoration, template sanitization, API canonicalization, and stable validation.

### Task 1: Make lifecycle occurrence, SMTP reservation, and leased-event disposition converge safely

**Files:**
- Modify: `model/recall_lifecycle.go`
- Modify: `model/recall_lifecycle_test.go`
- Modify: `model/recall_email_quota.go`
- Modify: `model/recall_email_quota_test.go`
- Modify: `service/recall_lifecycle_gate.go`
- Modify: `service/recall_lifecycle_gate_test.go`
- Modify: `service/recall_email.go`
- Modify: `service/recall_email_test.go`
- Modify: `service/recall_lifecycle.go`
- Modify: `service/recall_lifecycle_test.go`

- [ ] **Step 1: Add RED tests for targeted MySQL duplicate handling**

  Extend `TestLifecycleInsertConflictSQLIsTargetedByDialect` so the MySQL dry-run SQL is a plain `INSERT` and does not contain `INSERT IGNORE`. Add table-driven tests around a small duplicate classifier using wrapped and direct `*mysql.MySQLError` values:

  ```go
  tests := []struct {
      name string
      err  error
      want bool
  }{
      {"duplicate occurrence", &mysql.MySQLError{Number: 1062}, true},
      {"truncated value", &mysql.MySQLError{Number: 1406}, false},
      {"missing default", &mysql.MySQLError{Number: 1364}, false},
      {"wrapped duplicate", fmt.Errorf("insert lifecycle occurrence: %w", &mysql.MySQLError{Number: 1062}), true},
  }
  ```

  Assert `TryInsertRecallLifecycleEventWithContext` returns `(false, nil)` only for the duplicate classifier and propagates every other insert error.

- [ ] **Step 2: Run the occurrence tests and capture RED**

  Run:

  ```powershell
  go test ./model -run 'Test(LifecycleInsertConflictSQLIsTargetedByDialect|RecallLifecycleMySQLDuplicateClassification|TryInsertRecallLifecycleEventPropagatesNonDuplicateError)$' -count=1 -v
  ```

  Expected: the SQL-shape assertion fails on `INSERT IGNORE`, or the new duplicate-classification symbol/behavior is absent.

- [ ] **Step 3: Implement ordinary MySQL insert plus exact 1062 handling**

  Make `insertRecallLifecycleEvent` issue the normal `Create` path on MySQL. In `TryInsertRecallLifecycleEventWithContext`, classify only duplicate-key error 1062 as an idempotent occurrence collision and return all other errors:

  ```go
  func isRecallLifecycleOccurrenceDuplicate(err error) bool {
      var mysqlErr *mysql.MySQLError
      return errors.As(err, &mysqlErr) && mysqlErr.Number == 1062
  }
  ```

  Preserve the existing targeted PostgreSQL/SQLite conflict behavior and `(RowsAffected == 1)` inserted result.

- [ ] **Step 4: Add RED tests proving the lifecycle gate runs before the recipient lock transaction**

  Refactor the current test seam so a service-level evaluator can record when it ran and a model-level reservation seam can record when `recall_recipients` was locked. Add tests named for these observable guarantees:

  ```go
  func TestProcessLeasedItemEvaluatesLifecycleGateBeforeRecipientReservation(t *testing.T)
  func TestBeginRecallEmailSMTPAttemptUsesPrecomputedLifecycleDecision(t *testing.T)
  func TestBlockedLifecycleDecisionDoesNotReserveQuotaOrPacing(t *testing.T)
  ```

  The decision passed into the model must be immutable/bounded: allowed, stable denial code, and any event/version identity needed for a short recheck. The test must fail while `BeginRecallEmailSMTPAttemptWithContext` invokes the registered multi-table gate after locking the recipient.

- [ ] **Step 5: Run the SMTP-gate tests and capture RED**

  Run:

  ```powershell
  go test ./model ./service -run 'Test(ProcessLeasedItemEvaluatesLifecycleGateBeforeRecipientReservation|BeginRecallEmailSMTPAttemptUsesPrecomputedLifecycleDecision|BlockedLifecycleDecisionDoesNotReserveQuotaOrPacing|BeginRecallEmailSMTPAttempt|RegisterRecallLifecycleSMTPGate)$' -count=1 -v
  ```

  Expected: at least the ordering/precomputed-decision regression fails for the current callback-under-lock design.

- [ ] **Step 6: Move full eligibility evaluation out of the recipient-lock transaction**

  In `service.processLeasedItem`, compute the lifecycle SMTP decision immediately before `BeginRecallEmailSMTPAttemptWithContext`. Change the model entry point to consume that decision instead of invoking a service callback. Keep the reservation transaction limited to recipient/message lease checks, exclusion state, quota/pacing reservation, and status CAS. Remove the obsolete registered gate callback only after all call sites use the explicit decision.

  If a short transaction-time recheck is required, constrain it to the already-identified lifecycle event/recipient row; do not scan or lock user quota, later events, top-ups, subscriptions, or campaign tables from inside the recipient transaction.

- [ ] **Step 7: Add RED tests for claimed campaign unavailability**

  Add a table-driven service regression that claims an event, changes the trigger campaign to paused or cancelled/unavailable, runs `enrollClaimedEvent`, and asserts the event is no longer `leased`:

  ```go
  func TestEnrollClaimedLifecycleEventDefersWhenCampaignBecomesUnavailable(t *testing.T) {
      // cases: paused and cancelled/missing trigger slot
      // expect pending/deferred disposition, empty owner, zero lease expiry,
      // stable reason lifecycle_campaign_unavailable, and a future retry time.
  }
  ```

- [ ] **Step 8: Run the campaign-unavailable regression and capture RED**

  Run:

  ```powershell
  go test ./service -run 'TestEnrollClaimedLifecycleEventDefersWhenCampaignBecomesUnavailable$' -count=1 -v
  ```

  Expected: current code returns nil while leaving the event leased.

- [ ] **Step 9: Defer and clear lease ownership on retryable campaign unavailability**

  In `enrollClaimedEvent`, route `ok == false` from `loadRecallLifecycleCampaignForEventTx` through `model.DeferRecallLifecycleEvent` with stable reason `lifecycle_campaign_unavailable` and the existing bounded backoff. Preserve terminal skip handling for malformed/irrecoverable lifecycle data; do not convert all campaign errors into retryable deferrals.

- [ ] **Step 10: Verify Task 1 GREEN and commit**

  Run:

  ```powershell
  go test ./model -run 'Test(Lifecycle|RecallLifecycle|BeginRecallEmailSMTPAttempt)' -count=1
  go test ./service -run 'Test(RecallLifecycle|ProcessLeasedItem|EnrollClaimedLifecycleEvent)' -count=1
  git diff --check
  ```

  Commit with an intent-led Lore message such as:

  ```text
  Keep lifecycle delivery retries observable and lock-bounded

  Constraint: Recipient reservation cannot hold a row lock while scanning payment and quota state.
  Rejected: INSERT IGNORE | It hides non-duplicate MySQL write failures.
  Confidence: high
  Scope-risk: moderate
  Directive: Keep expensive lifecycle eligibility checks outside the recipient reservation transaction.
  Tested: focused model and service lifecycle suites
  Not-tested: live MySQL concurrency
  ```

### Task 2: Unify Continuous transitions, audit, metrics degradation, and preview policy

**Files:**
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_campaign_continuous_test.go`
- Modify: `service/recall_attribution.go`
- Modify: `service/recall_attribution_test.go`
- Modify: `service/recall_lifecycle.go`
- Modify: `service/recall_lifecycle_test.go`
- Modify: `service/recall_contract.go`
- Modify: `service/recall_contract_test.go`
- Modify only if controller-level response coverage is needed: `controller/recall_campaign_test.go`

- [ ] **Step 1: Add RED transition-order and activation-audit regressions**

  Extend the existing Continuous tests to prove campaign-before-slot order and atomic rollback:

  ```go
  func TestRecallCampaignContinuousActivateTransitionsCampaignBeforeClaimingSlot(t *testing.T)
  func TestRecallCampaignContinuousResumeTransitionsCampaignBeforeClaimingSlot(t *testing.T)
  func TestRecallCampaignContinuousSlotConflictRollsBackTransitionAndAudit(t *testing.T)
  func TestRecallCampaignContinuousActivateWritesAtomicAdminEvent(t *testing.T)
  func TestRecallCampaignContinuousActivationAuditConflictRollsBackCampaignAndSlot(t *testing.T)
  ```

  Assert the successful event uses the existing deterministic `recallCampaignAdminTransitionEvent` contract (`campaign_activated`/`activate`) and is stored by `InsertRequiredRecallAdminEventTx` in the same transaction.

- [ ] **Step 2: Run transition/audit tests and capture RED**

  Run:

  ```powershell
  go test ./service -run 'TestRecallCampaignContinuous(ActivateTransitionsCampaignBeforeClaimingSlot|ResumeTransitionsCampaignBeforeClaimingSlot|SlotConflictRollsBackTransitionAndAudit|ActivateWritesAtomicAdminEvent|ActivationAuditConflictRollsBackCampaignAndSlot)$' -count=1 -v
  ```

  Expected: activate/resume still claim the slot first and successful activation lacks an admin event.

- [ ] **Step 3: Implement one campaign-before-slot transactional order**

  Change `activateContinuousCampaign` and `resumeContinuousCampaign` to perform the guarded campaign transition first, then claim the trigger slot, then insert the required admin event. Let any slot or audit error abort the transaction so GORM rolls back all earlier updates. Keep cancel as campaign transition then slot release, giving activate/resume/cancel one shared lock order. Remove compensating slot-release code that only existed because the old order claimed first.

- [ ] **Step 4: Add RED metrics compatibility tests**

  Add cases for a Continuous campaign with no initialized marker:

  ```go
  func TestRecallMetricsDraftContinuousWithoutMarkerOmitsLifecycleSection(t *testing.T)
  func TestRecallMetricsPausedContinuousWithoutMarkerOmitsLifecycleSection(t *testing.T)
  func TestRecallMetricsRunningContinuousWithoutMarkerReturnsError(t *testing.T)
  func TestRecallMetricsRunningContinuousWithMalformedMarkerReturnsError(t *testing.T)
  ```

  The first two must retain the generic campaign aggregates and omit only lifecycle-specific data. The running cases must remain visible operational failures.

- [ ] **Step 5: Run metrics tests and capture RED**

  Run:

  ```powershell
  go test ./service ./controller -run 'TestRecall(MetricsDraftContinuousWithoutMarkerOmitsLifecycleSection|MetricsPausedContinuousWithoutMarkerOmitsLifecycleSection|MetricsRunningContinuousWithoutMarkerReturnsError|MetricsRunningContinuousWithMalformedMarkerReturnsError)$' -count=1 -v
  ```

  Expected: current `GetMetrics` propagates marker-not-ready errors for draft/paused campaigns.

- [ ] **Step 6: Implement narrow marker-not-ready degradation**

  Introduce or reuse an error identity that distinguishes an absent/not-ready lifecycle collection marker from malformed/corrupt data. In `GetMetrics`, suppress only that identity when `campaign.ExecutionMode == continuous` and status is not running. Do not catch arbitrary lifecycle errors and do not relax activation/preview validation.

- [ ] **Step 7: Add RED preview trigger-policy tests**

  Extend `PreviewRecallEmail` tests with every lifecycle trigger, omitted policy, and explicit conflict:

  ```go
  func TestPreviewRecallEmailDerivesDeliveryPolicyFromLifecycleTrigger(t *testing.T)
  func TestPreviewRecallEmailRejectsDeliveryPolicyConflictingWithLifecycleTrigger(t *testing.T)
  ```

  Use `RecallLifecycleTriggerDeliveryPolicy` as the expected mapping. Assert the conflict returns one stable validation message before body/template rendering.

- [ ] **Step 8: Run preview tests and capture RED**

  Run:

  ```powershell
  go test ./service -run 'TestPreviewRecallEmail(DerivesDeliveryPolicyFromLifecycleTrigger|RejectsDeliveryPolicyConflictingWithLifecycleTrigger)$' -count=1 -v
  ```

  Expected: omitted policy currently takes a generic default or an explicit conflicting policy is accepted.

- [ ] **Step 9: Make the trigger authoritative in preview**

  At the start of `PreviewRecallEmail`, derive the required policy when a lifecycle trigger is present. Fill an omitted policy and reject a non-empty conflicting one using the stable validation error. Only then normalize template actions and render the preview.

- [ ] **Step 10: Verify Task 2 GREEN and commit**

  Run:

  ```powershell
  go test ./service -run 'TestRecallCampaignContinuous|TestRecallMetrics|TestPreviewRecallEmail' -count=1
  go test ./controller -run 'TestRecall.*Metrics' -count=1
  git diff --check
  ```

  Commit with an intent-led Lore message such as:

  ```text
  Make Continuous state and message policy transactionally authoritative

  Constraint: Campaign transitions and trigger slots must share campaign-before-slot lock order.
  Rejected: Broad metrics fallback | It would hide running campaign corruption.
  Confidence: high
  Scope-risk: moderate
  Directive: Derive lifecycle delivery policy from the trigger at every preview boundary.
  Tested: focused Continuous campaign, metrics, and preview tests
  Not-tested: live multi-node MySQL deadlock stress
  ```

### Task 3: Enforce payment, entitlement, notification, and DataTool accounting invariants

**Files:**
- Read completely before editing: `pkg/billingexpr/expr.md`
- Modify: `service/quota.go`
- Modify: `service/quota_notify_test.go`
- Modify: `service/quota_notify_guard_test.go`
- Modify if direct no-session settlement coverage belongs there: `service/billing_status_test.go`
- Modify: `controller/subscription_payment_waffo_pancake.go`
- Modify: `controller/subscription_lifecycle_source_guard_test.go`
- Modify: `model/purchase_lifecycle.go`
- Modify: `model/subscription_lifecycle_test.go`
- Modify: `model/topup_lifecycle_test.go`
- Modify: `model/subscription_recurring.go`
- Modify: `model/subscription_recurring_test.go`
- Modify: `service/subscription_compensation.go`
- Modify: `service/subscription_compensation_test.go`
- Modify: `model/data_tool_call.go`
- Modify: `model/data_tool_call_test.go`

- [ ] **Step 1: Read and preserve the billing-expression contract**

  Run:

  ```powershell
  Get-Content -Raw pkg/billingexpr/expr.md
  ```

  Confirm the changes below operate after the existing expression/reservation result and do not reinterpret expression fields, reserve tokens, grant keys, or status semantics.

- [ ] **Step 2: Add RED notification and Waffo/Pancake transition-error tests**

  Add a no-`BillingSession` subscription debit regression through `SettleBilling -> PostConsumeQuota` that asserts the subscription notification dispatcher, not only the wallet notifier, is called exactly once. Extend the source/behavior guard around `SubscriptionRequestWaffoPancakePay` to inject a lifecycle transition failure and assert it is logged with `trade_no` and returned/reported as a distinct state-update failure rather than ignored.

  Suggested test names:

  ```go
  func TestPostConsumeQuotaSubscriptionFallbackDispatchesSubscriptionNotification(t *testing.T)
  func TestSubscriptionRequestWaffoPancakePayReportsFailureTransitionError(t *testing.T)
  ```

- [ ] **Step 3: Run notification/controller tests and capture RED**

  Run:

  ```powershell
  go test ./service -run 'Test(PostConsumeQuotaSubscriptionFallbackDispatchesSubscriptionNotification|.*QuotaNotify.*|.*BillingStatus.*)$' -count=1 -v
  go test ./controller -run 'TestSubscriptionRequestWaffoPancakePayReportsFailureTransitionError$' -count=1 -v
  ```

  Expected: the no-session path emits only the wallet notification and the checkout failure path discards the transaction error.

- [ ] **Step 4: Implement notification parity and observable transition failure**

  After a successful subscription quota mutation in `PostConsumeQuota`, invoke the same idempotent subscription notification path used by BillingSession settlement, while retaining the existing wallet notification behavior only where its contract applies. In Waffo/Pancake checkout failure handling, capture the `model.DB.Transaction` result, include `trade_no` in structured logging, and return the state-update failure so callers/alerts can distinguish it from the provider checkout error.

- [ ] **Step 5: Add RED lifecycle scope, top-up timestamp, and provider-binding repair tests**

  Add these regressions:

  ```go
  func TestSubscriptionSuccessWithoutScopeRollsBackOrderEventAndQuotaCycle(t *testing.T)
  func TestTopUpTerminalFailureSetsCompleteTime(t *testing.T)
  func TestCompleteSubscriptionOrderRepairsMissingProviderBindingAfterSuccess(t *testing.T)
  func TestCompleteSubscriptionOrderCASLoserDoesNotCreateUnownedProviderBinding(t *testing.T)
  ```

  The missing-scope case must prove no success status/event/quota rotation commits. The top-up table must cover failed, expired, and cancelled while preserving later transition to success. The binding repair case must seed an already-successful order with validated owner/snapshot data but no binding, then assert the idempotent create/load helper repairs it.

- [ ] **Step 6: Run lifecycle/binding tests and capture RED**

  Run:

  ```powershell
  go test ./model -run 'Test(SubscriptionSuccessWithoutScopeRollsBackOrderEventAndQuotaCycle|TopUpTerminalFailureSetsCompleteTime|CompleteSubscriptionOrderRepairsMissingProviderBindingAfterSuccess|CompleteSubscriptionOrderCASLoserDoesNotCreateUnownedProviderBinding)$' -count=1 -v
  ```

  Expected: missing scope can currently commit success without quota rotation, non-success top-ups retain zero `complete_time`, and completed binding repair returns `nil, nil`.

- [ ] **Step 7: Enforce scope/timestamp and repair completed bindings idempotently**

  In `persistPurchaseLifecycleSubscriptionTransitionWithWinner`, require `SubscriptionScopeID > 0` after the winner hook and before success event/status persistence. In the top-up failed/expired/cancelled branches, set `CompleteTime = occurredAt`. In `CompleteSubscriptionOrderWithProviderBinding`, validate completed-order ownership and snapshot, then call the existing `createOrLoadProviderBindingTx`; retain the explicit CAS-loser no-create path when this callback did not own completion.

- [ ] **Step 8: Add a RED historical compensation replay test**

  Seed a balance-debit order already in `success` with an unapplied `SubscriptionChangeIntent` and missing/incomplete entitlement, then run the Stripe-to-balance compensation path:

  ```go
  func TestStripeToBalanceReconciliationRepairsHistoricalSuccessfulOrderExactlyOnce(t *testing.T)
  ```

  Assert the first run applies entitlement and completes the intent by the existing grant key, and the second run makes no duplicate grant/debit.

- [ ] **Step 9: Run compensation tests and capture RED**

  Run:

  ```powershell
  go test ./service -run '^(TestStripeToBalanceReconciliationRepairsHistoricalSuccessfulOrderExactlyOnce|TestStripeToBalanceReconciliationRecoversPreparedSyncingIntentExactlyOnce|TestStripeToBalanceReplayAndReconciliationCrashWindowsDoNotDoubleDebitRefundOrGrant)$' -count=1 -v
  ```

  Expected: current `applied == false` handling returns success without repairing intent/entitlement.

- [ ] **Step 10: Implement idempotent successful-order compensation repair**

  In `grantStripeToBalanceEntitlement`, when the normal lifecycle transition returns `applied == false`, re-lock and reload the order and change intent. If the order is already success and the intent remains unapplied, call `RotateCurrentEntitlementTx` with the stable existing `balance:<tradeNo>` grant key and then mark the intent applied in the same transaction. Return an observable invariant error for incompatible state instead of silently succeeding; never mark only the intent without repairing entitlement.

- [ ] **Step 11: Add RED DataTool terminal-winner and underflow tests**

  Add deterministic concurrency/interleaving tests around one pending `DataToolCall`:

  ```go
  func TestFailAndRefundDataToolCallConcurrentFailuresHaveOneWinner(t *testing.T)
  func TestDataToolCallConcurrentFailAndSettleHaveOneTerminalWinner(t *testing.T)
  func TestFailAndRefundDataToolCallRejectsUserUsedQuotaUnderflow(t *testing.T)
  func TestFailAndRefundDataToolCallRejectsTokenUsedQuotaUnderflow(t *testing.T)
  ```

  Assert exactly one terminal operation mutates wallet/token quota, the final status is never overwritten, refund/settlement ledgers remain exact, and an underflow attempt rolls back all state.

- [ ] **Step 12: Run DataTool tests and capture RED**

  Run:

  ```powershell
  go test ./model -run 'Test(FailAndRefundDataToolCallConcurrentFailuresHaveOneWinner|DataToolCallConcurrentFailAndSettleHaveOneTerminalWinner|FailAndRefundDataToolCallRejectsUserUsedQuotaUnderflow|FailAndRefundDataToolCallRejectsTokenUsedQuotaUnderflow)$' -count=1 -v
  ```

  Expected: the old implementation can let both transactions observe pending and either double-refund/overwrite status or decrement `used_quota` below zero.

- [ ] **Step 13: Give DataTool one locked terminal owner and guarded refunds**

  At the start of both `CompleteAndSettleDataToolCall` and `FailAndRefundDataToolCall`, select the `data_tool_calls` row `FOR UPDATE`, re-check `status == pending`, and return the stored terminal result without financial side effects for a loser/retry. Keep the final status write qualified by `WHERE id = ? AND status = pending` and require `RowsAffected == 1`.

  Change every user/token refund decrement to this invariant shape and fail the transaction on zero affected rows:

  ```go
  result := tx.Model(target).
      Where("id = ? AND used_quota >= ?", id, refund).
      UpdateColumn("used_quota", gorm.Expr("used_quota - ?", refund))
  if result.Error != nil {
      return result.Error
  }
  if result.RowsAffected != 1 {
      return fmt.Errorf("data tool refund used_quota invariant violated")
  }
  ```

- [ ] **Step 14: Verify Task 3 GREEN and commit**

  Run:

  ```powershell
  go test ./model -run 'Test(Subscription|TopUp|CompleteSubscriptionOrder|DataTool)' -count=1
  go test ./service -run 'Test(.*QuotaNotify.*|.*BillingStatus.*|.*SubscriptionCompensation.*|CompleteStripeToBalanceCompensation)' -count=1
  go test ./controller -run 'TestSubscription.*Lifecycle|TestSubscriptionRequestWaffoPancake' -count=1
  git diff --check
  ```

  Commit with an intent-led Lore message such as:

  ```text
  Give payment and quota terminal transitions one accountable winner

  Constraint: Subscription success must carry an entitlement scope before commit.
  Rejected: Treating already-success as a no-op | Rolling deployments require idempotent repair.
  Confidence: high
  Scope-risk: broad
  Directive: Lock DataTool calls before any quota mutation and guard every used_quota decrement.
  Tested: focused lifecycle, compensation, notification, and DataTool suites
  Not-tested: production-provider callbacks and live MySQL race stress
  ```

### Task 4: Canonicalize Continuous editing and fence stale previews

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-email-html-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-email-html-editor.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`
- Modify: `web/default/src/features/recall-campaigns/email-html.ts`
- Modify: `web/default/src/features/recall-campaigns/email-html.test.ts`
- Modify: `web/default/src/features/recall-campaigns/api.ts`
- Modify: `web/default/src/features/recall-campaigns/api.test.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.test.ts`

- [ ] **Step 1: Add RED async preview fence tests**

  `RecallEmailPreviewSnapshot` already captures `deliveryPolicy` and `lifecycleTrigger`; add regressions proving `shouldApplyRecallEmailPreviewResult` also uses them. Keep subject/body/campaign type constant while changing only delivery policy or lifecycle trigger:

  ```ts
  it('ignores a preview response after delivery policy changes', async () => {})
  it('ignores a preview response after lifecycle trigger changes', async () => {})
  ```

  Assert both success and error completions from the stale request are ignored.

- [ ] **Step 2: Run preview fence tests and capture RED**

  Run from `web/default`:

  ```powershell
  bun test src/features/recall-campaigns/components/campaign-email-html-editor.test.tsx
  ```

  Expected: current guard returns true because it compares only request id, campaign type, subject, and body.

- [ ] **Step 3: Add policy and trigger to every preview guard/check**

  Add `currentDeliveryPolicy: RecallDeliveryPolicy` and `currentLifecycleTrigger?: RecallLifecycleTrigger` to the `shouldApplyRecallEmailPreviewResult` props. Compare candidate to latest and current to candidate for both fields. At both the success and error call sites, read `form.getValues('delivery_policy') ?? 'engagement'` and `form.getValues('lifecycle_trigger') || undefined` before mutating preview HTML or error state.

- [ ] **Step 4: Add RED Continuous-exit tests**

  In `campaign-editor.test.tsx`, initialize a valid recurring draft, switch to Continuous, then switch to manual/once/recurring and assert every submitted inactive field is legal and non-empty where required:

  ```ts
  it.each(['manual', 'once', 'recurring'])(
    'restores legal non-continuous defaults when switching from continuous to %s',
    async (mode) => {},
  )
  ```

  Prefer restoring the cached pre-Continuous draft during one editor session; when no snapshot exists (for example a persisted Continuous draft), assert stable legal defaults for audience, coupon source, promotion expiry, product scope, schedule, and campaign type.

- [ ] **Step 5: Run mode-switch tests and capture RED**

  Run from `web/default`:

  ```powershell
  bun test -t 'restores legal non-continuous defaults' src/features/recall-campaigns/components/campaign-editor.test.tsx
  ```

  Expected: current normalization keeps Continuous zero values after leaving the mode.

- [ ] **Step 6: Restore a valid non-Continuous draft on mode exit**

  Keep a ref/snapshot of the last valid non-Continuous fields before entering Continuous. In `setScheduleMode`, restore that snapshot when available; otherwise apply the same legal defaults used for a new non-Continuous campaign. Then pass the restored draft through `normalizeRecallScheduleForMode` and update every affected form field, not only execution/schedule fields.

- [ ] **Step 7: Add RED plain-text template-action tests**

  Add `email-html.test.ts` cases where plain text contains `{{.ClaimURL}}`, `{{.UnsubscribeURL}}`, `{{.ProductSummary}}`, and allowed variables under `service` and `content_only`. Assert forbidden actions are stripped, allowed content is preserved, and generated HTML has no empty action link.

- [ ] **Step 8: Run template tests and capture RED**

  Run from `web/default`:

  ```powershell
  bun test src/features/recall-campaigns/email-html.test.ts
  ```

  Expected: plain-text conversion currently returns before `stripRecallDisallowedTemplateActions`.

- [ ] **Step 9: Apply one allowlist to HTML and plain text**

  In `normalizeRecallBodyInputToHtml`, first convert HTML/plain text to an HTML string, then always pass the result through `stripRecallDisallowedTemplateActions` with the effective policy. Preserve normal paragraph conversion and allowed placeholders.

- [ ] **Step 10: Add RED API-boundary canonicalization tests**

  Extend the create/update/Stripe API parameterized tests with a Continuous draft containing stale values for all inactive fields. Assert encoded wire data contains the canonical values:

  ```ts
  expect(payload).toMatchObject({
    audience_template: '',
    audience_config: {},
    coupon_source: '',
    existing_coupon_id: 0,
    discount_config: {},
    product_scope: '',
    promotion_expiry_mode: '',
    promotion_expiry_days: 0,
    promotion_expiry_at: '',
    schedule: {},
  });
  ```

  Match the exact existing wire zero values from `assertContinuousDraftFieldsEmpty`/schema rather than inventing alternate null forms.

- [ ] **Step 11: Run API tests and capture RED**

  Run from `web/default`:

  ```powershell
  bun test src/features/recall-campaigns/api.test.ts
  ```

  Expected: the encoder currently clears only audience and discount fields.

- [ ] **Step 12: Centralize full Continuous canonicalization in the encoder**

  Extract or reuse one pure helper that returns the canonical Continuous inactive-field shape. Apply it in `encodeRecallCampaignDraft` so create, update, and Stripe validation callers get identical payloads even when they bypass the editor submit helper.

- [ ] **Step 13: Add RED missing-English-stage validation tests**

  In `helpers.test.ts`, call `prepareRecallCampaignSubmitDraft` with `execution_mode: 'continuous'` and either an empty sequence, an empty first-stage templates map, or a first stage without `en`. Assert a stable explicit validation error rather than an invalid synthesized stage:

  ```ts
  it.each([
    [],
    [{ stage_no: 1, delay_seconds: 0, templates: {} }],
  ])('rejects Continuous drafts without an English first stage', (emailSequence) => {
    expect(() => prepareRecallCampaignSubmitDraft({
      ...continuousDraft,
      email_sequence: emailSequence,
    })).toThrow('English template is required');
  });
  ```

- [ ] **Step 14: Run helper tests and capture RED**

  Run from `web/default`:

  ```powershell
  bun test src/features/recall-campaigns/helpers.test.ts
  ```

  Expected: current helper can emit a stage with an empty templates object and fail only later in schema validation.

- [ ] **Step 15: Fail early with the stable Continuous validation error**

  In the Continuous branch, after `assertContinuousDraftFieldsEmpty` and before constructing the normalized stage, require `draft.email_sequence[0]?.templates?.en`; otherwise throw `Error('English template is required')`, matching the existing schema message. Do not synthesize an empty template object. Keep the existing legacy-draft policy derivation behavior unchanged.

- [ ] **Step 16: Verify Task 4 GREEN and commit**

  Run from `web/default`:

  ```powershell
  bun test src/features/recall-campaigns/api.test.ts src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/email-html.test.ts src/features/recall-campaigns/components/campaign-email-html-editor.test.tsx src/features/recall-campaigns/components/campaign-editor.test.tsx
  bun run typecheck
  ```

  Then from repository root:

  ```powershell
  git diff --check
  ```

  Commit with an intent-led Lore message such as:

  ```text
  Keep Continuous editor state and previews bound to current intent

  Constraint: Lifecycle trigger is the delivery-policy source of truth.
  Rejected: Relying only on editor submit normalization | Direct API callers also need canonical payloads.
  Confidence: high
  Scope-risk: moderate
  Directive: Fence async previews by every field that changes the rendered contract.
  Tested: focused Recall frontend tests and TypeScript typecheck
  Not-tested: browser-level SMTP preview against a live backend
  ```

## Final integration and PR delivery

- [ ] Run all focused backend suites covering the modified behavior:

  ```powershell
  go test ./model -run 'Test(Lifecycle|RecallLifecycle|BeginRecallEmailSMTPAttempt|Subscription|TopUp|CompleteSubscriptionOrder|DataTool)' -count=1
  go test ./service -run 'Test(Recall|.*QuotaNotify.*|.*BillingStatus.*|.*SubscriptionCompensation.*|CompleteStripeToBalanceCompensation)' -count=1
  go test ./controller -run 'Test(Recall|Subscription)' -count=1
  ```

- [ ] Run router and static verification:

  ```powershell
  go test ./router -count=1
  go vet ./model ./service ./controller ./router
  git diff --check origin/main...HEAD
  ```

- [ ] Run all Recall frontend tests and release checks from `web/default`:

  ```powershell
  bun test src/features/recall-campaigns
  bun run typecheck
  bun run i18n:sync
  bun run build
  ```

- [ ] Re-run `campaign-editor.test.tsx` at least three times to check the previously observed intermittent identity-switch failure at the test named `clears translation task and dirty refresh state when switching campaign identity`. Fresh mapping evidence is 70/70 for the complete file plus 3/3 focused repetitions, so treat a new failure as a separate asynchronous identity/query race, diagnose it under systematic debugging, and fix it only with its own RED/GREEN regression before delivery.

- [ ] Run GitNexus change impact if the repository index can be repaired. If `gitnexus detect-changes` remains unavailable because indexing fails, record that validation gap instead of claiming it ran.

- [ ] Dispatch a final full-diff specification reviewer, then a full-diff code-quality reviewer. Resolve every valid finding and rerun the relevant tests.

- [ ] Push `feat/flatkey-lifecycle-email-continuous`, then reply to the original aggregate PR comment at `https://github.com/SolveaCX/new-api/pull/677#issuecomment-5236529894`. Map each unique item to its fix commit and tests, or to the verified non-applicability evidence for the late-success design, starter-template behavior, and wrong-file duplicate comments.

- [ ] Wait for PR checks to finish and inspect failures/logs. Do not report completion until the required checks and the fresh local verification above are green, or until any remaining external-only gap is explicitly identified.
