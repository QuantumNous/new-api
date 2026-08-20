# Subscription Short-Window Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Flatkey's active 5-hour and 7-day subscription restrictions while preserving monthly quota, media credits, and legacy stored data.

**Architecture:** Disconnect all short-window Redis calls from synchronous and asynchronous billing, then remove those buckets from self-service responses and console surfaces. Retain database columns, historical JSON fields, Redis helper code, and compatibility types where needed for reading old records; new plan writes normalize legacy short-window values to zero.

**Tech Stack:** Go, GORM, Redis/miniredis, Gin, React, TypeScript, Zod, Bun test.

## Global Constraints

- Monthly subscription quota remains enforced.
- Image/video media credits remain enforced.
- Codex upstream 5-hour/weekly usage reporting is out of scope and must remain unchanged.
- Do not drop `window_5h_amount` or `window_week_amount` database columns.
- Do not delete historical task snapshots or Redis keys; old keys expire naturally.
- New requests and tasks must not reserve, settle, refund, snapshot, or reject on Flatkey short-window counters.
- Wallet, profile, purchase, and subscription administration must not present Flatkey 5-hour or 7-day controls or meters.
- Add no dependencies.

---

### Task 1: Disconnect synchronous subscription billing from short windows

**Files:**
- Modify: `service/funding_source.go`
- Modify: `service/billing_session.go`
- Test: `service/subscription_window_test.go`

**Interfaces:**
- Preserves: `SubscriptionFunding.PreConsume`, `Settle`, `Refund`, `ReserveExtra`, `RollbackExtra`
- Changes: `BillingSession.SubscriptionTaskSnapshot() (float64, *model.TaskSubscriptionWindow)` always returns a nil window snapshot for subscription funding

- [ ] **Step 1: Write a failing inactive-window test**

```go
func TestSubscriptionFundingDoesNotExposeLegacyWindowSnapshot(t *testing.T) {
	guard := &subscriptionWindowGuard{
		subId: 12,
		limit5h: 100,
		limitWeek: 200,
		bucketHeld: map[string]int64{"legacy": 10},
	}
	funding := &SubscriptionFunding{windowGuard: guard}
	if snapshot := funding.WindowSnapshot(); snapshot != nil {
		t.Fatalf("legacy window snapshot must be inactive, got %+v", snapshot)
	}
}
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `go test ./service -run 'TestSubscriptionFundingDoesNotExposeLegacyWindowSnapshot' -count=1`

Expected: FAIL because the legacy guard is still exported.

- [ ] **Step 3: Remove the active guard from funding operations**

Delete `windowGuard` from `SubscriptionFunding`. Make `PreConsume` call `model.PreConsumeUserSubscription` directly after weighting. Keep the existing subscription pool fields and plan metadata assignment. Remove `Adjust`, `Release`, and reserve/re-query calls from settle, refund, extra reserve, and rollback paths. Preserve the pool mutations exactly.

Make `WindowSnapshot` return nil or remove it and have `SubscriptionTaskSnapshot` return `(sf.Weight(), nil)`. Delete the short-window-specific 429 mapping in `BillingSession.PreConsume`; generic monthly/pool exhaustion handling remains unchanged.

- [ ] **Step 4: Run focused billing tests and confirm GREEN**

Run: `go test ./service -run 'Test(SubscriptionFundingWeightedRounding|SubscriptionFundingDoesNotExposeLegacyWindowSnapshot|BillingSession)' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit synchronous enforcement removal**

```text
Stop gating subscription requests on short windows

Constraint: Monthly pool and media credit enforcement must remain active
Rejected: Dropping legacy Redis helpers | historical records still need compatibility
Confidence: high
Scope-risk: moderate
Tested: focused service billing tests
```

### Task 2: Stop asynchronous tasks from snapshotting or adjusting windows

**Files:**
- Modify: `service/task_billing.go`
- Modify: `controller/relay.go`
- Modify: `controller/asset_task_worker.go`
- Test: `service/task_billing_test.go`
- Test: `controller/asset_task_worker_test.go`

**Interfaces:**
- Preserves: subscription weight snapshot and weighted monthly-pool settlement
- Makes inert: `TaskBillingContext.SubscriptionWindow`
- Makes inert: `TaskAcceptedAccountingStepSubscriptionWindow`

- [ ] **Step 1: Write failing async no-window tests**

Add a task billing test with a legacy `SubscriptionWindow` snapshot and seeded miniredis counters. Run a subscription task refund/delta and assert the subscription pool changes while the Redis counters do not. Update the asset worker snapshot test to require `BillingContext.SubscriptionWindow == nil` while preserving `SubscriptionWeight == 1.5`.

- [ ] **Step 2: Run focused async tests and confirm RED**

Run: `go test ./service ./controller -run 'Test.*(Task.*Subscription.*Window|SubscriptionSnapshot)' -count=1`

Expected: existing code updates Redis or persists a non-nil window snapshot.

- [ ] **Step 3: Remove active async window accounting**

In `taskAdjustFunding`, retain weighted subscription-pool delta calculation and delete `AdjustSubscriptionWindowFromSnapshot`. Make `ApplyAcceptedTaskSubscriptionWindowOnce` only mark its compatibility ledger step done without touching Redis, or remove its worker call if completion does not depend on the marker. In relay and asset task snapshot creation, keep `SubscriptionWeight` and never assign `SubscriptionWindow`.

- [ ] **Step 4: Run focused async tests and confirm GREEN**

Run: `go test ./service ./controller -run 'Test.*(Task.*Subscription.*Window|SubscriptionSnapshot|AcceptedTaskSubscription)' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit async accounting removal**

```text
Keep async subscription billing out of legacy windows

Constraint: Weighted monthly-pool settlement must remain restart-safe
Confidence: high
Scope-risk: moderate
Tested: focused task billing and asset worker tests
```

### Task 3: Remove short windows from public subscription contracts

**Files:**
- Modify: `controller/subscription.go`
- Test: `controller/subscription_self_response_test.go`
- Test: `controller/subscription_plan_lifecycle_test.go`

**Interfaces:**
- Removes public JSON fields: `window_5h`, `window_7d`, `window_5h_amount`, `window_week_amount`, and current-subscription `usage_limits`
- Preserves public JSON fields: `monthly_bucket`, `quota`, and `media_credits`
- Preserves database/model fields for compatibility

- [ ] **Step 1: Write failing public-response assertions**

Change the self-response contract test to assert `window_5h` and `window_7d` are absent while `monthly_bucket` and `media_credits` are present. Change public plan tests to assert `window_5h_amount` and `window_week_amount` are absent. Add create/update tests that submit non-zero legacy window amounts and assert the stored plan values are normalized to zero.

- [ ] **Step 2: Run focused controller tests and confirm RED**

Run: `go test ./controller -run 'Test.*Subscription(Self|Plan).*Window' -count=1`

Expected: responses still contain legacy window fields and writes retain non-zero values.

- [ ] **Step 3: Remove public fields and normalize writes**

Delete window fields from `SubscriptionPlanPublicDTO`, `SubscriptionSelfResponse`, `SubscriptionSelfSubscriptionDTO`, `SubscriptionSelfPlanDTO`, and `SubscriptionSelfCurrentSubscriptionDTO`. Remove the Redis usage query and `UsageLimits` construction. In both plan create and update handlers set:

```go
req.Plan.Window5hAmount = 0
req.Plan.WindowWeekAmount = 0
```

Do this before model insert/update, replacing the old negative-value validation. Keep admin model/database structs intact.

- [ ] **Step 4: Run focused controller tests and confirm GREEN**

Run: `go test ./controller -run 'Test.*Subscription(Self|Plan).*Window' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the API cleanup**

```text
Retire short windows from subscription APIs

Constraint: Legacy columns stay readable but new plan writes normalize them to zero
Confidence: high
Scope-risk: moderate
Tested: focused subscription controller tests
```

### Task 4: Remove short-window meters from wallet and profile

**Files:**
- Modify: `web/default/src/features/wallet/components/current-plan-card.tsx`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.tsx`
- Modify: `web/default/src/features/wallet/lib/subscription-plan-lifecycle.ts`
- Modify: `web/default/src/features/profile/components/profile-header.tsx`
- Modify: `web/default/src/features/profile/lib/subscription-summary.ts`
- Modify: `web/default/src/features/subscriptions/types.ts`
- Test: `web/default/src/features/wallet/components/subscription-plans-card.test.tsx`
- Test: `web/default/src/features/wallet/lib/subscription-plan-lifecycle.test.ts`
- Test: `web/default/src/features/profile/components/profile-header.test.tsx`
- Test: `web/default/src/features/profile/lib/subscription-summary.test.ts`

**Interfaces:**
- Preserves UI: monthly quota and media generation credits
- Removes UI/data properties: `window5h`, `window7d`, `window_5h`, `window_7d`, `usage_limits`

- [ ] **Step 1: Write failing absence/preservation tests**

Update fixtures to omit short-window fields. Assert rendered wallet/profile output does not contain `5-hour limit` or `7-day limit`, while it still contains `Monthly model quota` and `Media generation credits`. Assert normalized self data contains monthly and media data without synthesized short-window buckets.

- [ ] **Step 2: Run focused UI tests and confirm RED**

Run: `bun test src/features/wallet/components/subscription-plans-card.test.tsx src/features/wallet/lib/subscription-plan-lifecycle.test.ts src/features/profile/components/profile-header.test.tsx src/features/profile/lib/subscription-summary.test.ts`

Working directory: `web/default`

Expected: assertions fail because short-window meters and normalized fields still exist.

- [ ] **Step 3: Remove short-window presentation and normalization**

Remove the two meters from current-plan and profile cards. Keep media and monthly rows. Remove plan-card 5h/7d feature lines. Remove short-window fields from normalized wallet/profile response types and summary builders. Keep legacy optional plan fields only where admin API parsing requires backward compatibility.

- [ ] **Step 4: Run focused UI tests and confirm GREEN**

Run: `bun test src/features/wallet/components/subscription-plans-card.test.tsx src/features/wallet/lib/subscription-plan-lifecycle.test.ts src/features/profile/components/profile-header.test.tsx src/features/profile/lib/subscription-summary.test.ts`

Working directory: `web/default`

Expected: PASS.

- [ ] **Step 5: Commit user-facing cleanup**

```text
Show only monthly and media subscription limits

Constraint: Flatkey short windows must disappear without hiding active limits
Confidence: high
Scope-risk: moderate
Tested: wallet and profile component tests
```

### Task 5: Remove short-window administration controls

**Files:**
- Modify: `web/default/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx`
- Modify: `web/default/src/features/subscriptions/lib/plan-form.ts`
- Modify: `web/default/src/features/subscriptions/lib/format.ts`
- Modify: `web/default/src/features/subscriptions/lib/index.ts`
- Test: `web/default/src/features/subscriptions/lib/plan-form.test.ts`

**Interfaces:**
- Removes form values/payload fields: `window_5h_amount`, `window_week_amount`
- Preserves: `total_amount`, `media_credits_monthly`, reset period, pricing, and feature lines

- [ ] **Step 1: Write failing form-contract tests**

Assert `formValuesToPlanPayload` does not emit either window field. Assert total monthly quota and media credits are still serialized. The drawer source is verified after the edit with `rg -n "window_5h_amount|window_week_amount|5-hour window limit|7-day window limit" web/default/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx`, which must return no matches.

- [ ] **Step 2: Run focused administration tests and confirm RED**

Run: `bun test src/features/subscriptions/lib/plan-form.test.ts src/features/subscriptions/components`

Working directory: `web/default`

Expected: payload and drawer still expose legacy fields.

- [ ] **Step 3: Delete form fields and dead formatter**

Remove both fields from the Zod schema, defaults, plan-to-form conversion, and payload conversion. Remove both `FormField` blocks from the drawer. Delete `formatWindowSummary` and its barrel export when `rg` confirms no remaining call site.

- [ ] **Step 4: Run focused administration tests and confirm GREEN**

Run: `bun test src/features/subscriptions/lib/plan-form.test.ts src/features/subscriptions/components`

Working directory: `web/default`

Expected: PASS.

- [ ] **Step 5: Commit administration cleanup**

```text
Remove obsolete subscription window controls

Constraint: Older API payloads cannot re-enable inactive enforcement
Confidence: high
Scope-risk: narrow
Tested: subscription form and component tests
```

### Task 6: Final regression and deployment verification

**Files:**
- Modify only files required to correct failures caused by Tasks 1-5

**Interfaces:**
- Verifies both plans together

- [ ] **Step 1: Scan for active Flatkey window call sites**

Run: `rg -n "reserveSubscriptionWindows|GetSubscriptionWindowUsage|AdjustSubscriptionWindowFromSnapshot|window_5h|window_7d|window_5h_amount|window_week_amount" service controller web/default/src/features/wallet web/default/src/features/profile web/default/src/features/subscriptions`

Expected: legacy compatibility definitions/tests/storage may remain; no synchronous/async billing call, public DTO, wallet/profile meter, or admin form control remains. Codex channel usage-window files remain untouched.

- [ ] **Step 2: Run focused Go regression suites**

Run: `go test ./service ./controller -run 'Test.*(Subscription|TopUp|TaskBilling|AssetTask)' -count=1`

Expected: PASS. If this broad focused command stalls like the initial baseline, run each named changed test group separately and record the stalled command as a verification gap.

- [ ] **Step 3: Run frontend regression, typecheck, lint, and build**

Working directory: `web/default`

Run: `bun test src/features/wallet src/features/profile src/features/subscriptions`

Run: `bun run typecheck`

Run: `bun run lint`

Run: `bun run build`

Expected: PASS.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check`

Run: `git status --short`

Confirm no database migration, Terraform, Cloudflare, Codex upstream window-report, or unrelated file changed.

- [ ] **Step 5: Commit final integration fixes if any**

```text
Verify localized wallet pricing without short limits

Constraint: Router and console deploy together; all router nodes must roll forward
Confidence: high
Scope-risk: broad
Tested: focused Go tests, frontend tests, typecheck, lint, and production build
```
