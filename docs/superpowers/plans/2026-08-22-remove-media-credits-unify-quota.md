# Remove Media Credits and Unify Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire media credits from the current product UI and billing path while keeping deprecated backend fields compatible for old clients, so image/video requests continue using configured model prices but consume only the subscription monthly quota and existing wallet fallback, while quota links open `/usage-logs`.

**Architecture:** Keep the legacy `media_credits_monthly`, `media_credits_total`, and `media_credits_used` database columns, public DTOs, request compatibility, and snapshot values for old clients and already-sold plans. New console forms and pages ignore those fields, and no billing path reads or spends them. Do not alter model-price, image/video ratio, or task `BillingSession` calculations; regression tests prove task funding mutates `amount_used` or wallet/token ledgers only. The profile and wallet monthly quota blocks use ordinary accessible links to `/usage-logs`.

> **Review compatibility override:** PR review requires the backend compatibility fields and entitlement snapshot propagation to remain until callers are migrated. This overrides the earlier task steps below that remove public DTO fields, omit snapshot fields, or force new media compatibility values to zero. UI removal and unified billing requirements remain unchanged.

**Tech Stack:** Go/Gin/GORM/testify; React 19 + TypeScript + Zod + i18next + Bun; Next.js/React server-rendered pricing page; SQLite test databases.

---

### Task 1: Lock the retired entitlement contract with failing backend tests

**Files:**
- Modify: `controller/subscription_plan_lifecycle_test.go`
- Modify: `controller/subscription_self_response_test.go`
- Modify: `model/subscription_entitlement_test.go`
- Modify: `service/subscription_purchase_test.go`
- Modify: `service/subscription_invoice_test.go`
- Modify: `service/subscription_upgrade_test.go`
- Modify: `service/subscription_wallet_renewal_test.go`

- [ ] **Step 1: Write the failing tests**

Add this lifecycle test and replace assertions that expect a media bucket or a non-zero media grant:

```go
func TestAdminSubscriptionPlanIgnoresLegacyMediaCredits(t *testing.T) {
	setupSubscriptionPlanControllerLifecycleTestDB(t)
	req := AdminUpsertSubscriptionPlanRequest{Plan: model.SubscriptionPlan{
		Title: "Unified quota", DurationUnit: model.SubscriptionDurationMonth,
		DurationValue: 1, Enabled: false, TotalAmount: 1000,
		MediaCreditsMonthly: 999,
	}}
	recorder := performAdminCreateSubscriptionPlan(t, req)
	require.Equal(t, http.StatusOK, recorder.Code)
	var raw struct{ Data map[string]any `json:"data"` }
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &raw))
	require.NotContains(t, raw.Data, "media_credits_monthly")
	var stored model.SubscriptionPlan
	require.NoError(t, model.DB.First(&stored, "title = ?", "Unified quota").Error)
	require.Zero(t, stored.MediaCreditsMonthly)
}
```

Change the self-response fixture to seed non-zero legacy columns and assert `monthly_bucket` remains present while `media_credits`, `media_credits_total`, and `media_credits_used` are absent from serialized responses. Change purchase/invoice/upgrade/renewal assertions to `require.Zero(t, result.Entitlement.MediaCreditsTotal)` and add a read-back assertion that `MediaCreditsUsed` is zero after a new grant. Keep old snapshot JSON with non-zero `media_credits_monthly` in one compatibility test and assert the new entitlement still has zero media total.

- [ ] **Step 2: Run focused tests to verify RED**

```powershell
$env:GOMODCACHE='E:\workspace\.gomodcache'
$env:GOCACHE='E:\workspace\.gocache-remove-media-credits'
go test ./controller -run 'TestAdminSubscriptionPlanIgnoresLegacyMediaCredits|TestGetSubscriptionSelfReturnsCurrentEntitlementQuotaReadModelWithoutMediaCredits' -count=1
go test ./model -run 'Subscription.*Media|GrantSubscriptionEntitlement' -count=1
go test ./service -run 'Subscription(Purchase|Invoice|Upgrade|WalletRenewal)' -count=1
```

Expected: FAIL because current DTOs expose media fields and new grants copy `MediaCreditsMonthly` into `MediaCreditsTotal`.

### Task 2: Normalize backend plans and entitlements while retaining legacy columns

**Files:**
- Modify: `model/subscription.go`
- Modify: `model/subscription_entitlement.go`
- Verify unchanged schema: `model/main.go`
- Test: tests added in Task 1

- [ ] **Step 1: Normalize new plan writes and entitlement grants**

In `CreateSubscriptionPlan` and `UpdateSubscriptionPlan`, set the compatibility field to zero before persistence:

```go
plan.MediaCreditsMonthly = 0
```

At the beginning of `GrantSubscriptionEntitlement`, after input validation and before idempotency comparison, normalize the compatibility input:

```go
input.MediaCreditsTotal = 0
```

Keep the GORM fields and `AutoMigrate` definitions unchanged so historical rows remain readable. New `UserSubscription` rows therefore persist zero for both media columns, while all existing `amount_total`, `amount_used`, wallet, and task accounting code remains authoritative.

- [ ] **Step 2: Run focused tests to verify GREEN**

Run:

```powershell
go test ./controller -run 'TestAdminSubscriptionPlanIgnoresLegacyMediaCredits|TestGetSubscriptionSelfReturnsCurrentEntitlementQuotaReadModelWithoutMediaCredits' -count=1
go test ./model -run 'Subscription.*Media|GrantSubscriptionEntitlement' -count=1
go test ./service -run 'Subscription(Purchase|Invoice|Upgrade|WalletRenewal)' -count=1
```

Expected: all focused tests pass, including old snapshot compatibility tests, with no schema migration or deleted-column error.

- [ ] **Step 3: Commit the model contract**

```powershell
git add model/subscription.go model/subscription_entitlement.go controller/subscription_plan_lifecycle_test.go controller/subscription_self_response_test.go model/subscription_entitlement_test.go
git commit -m "Retire media credits from new subscription entitlements" -m "New plans and grants use only the unified quota ledger while legacy columns remain readable for rollback." -m "Constraint: Preserve cross-database schema compatibility and historical snapshots.
Rejected: Drop legacy columns now | Existing deployments and rollback versions still read them.
Confidence: high
Scope-risk: moderate
Directive: Treat media columns as compatibility-only and never expose or spend them.
Tested: Focused controller and model subscription tests.
Not-tested: Full repository suite remains subject to existing parallel SQLite contention."
```

### Task 3: Remove media credits from subscription service grant payloads

**Files:**
- Modify: `service/subscription_purchase.go`
- Modify: `service/subscription_invoice.go`
- Modify: `service/subscription_upgrade.go`
- Modify: `service/subscription_wallet_renewal.go`
- Modify: `service/subscription_purchase_test.go`
- Modify: `service/subscription_invoice_test.go`
- Modify: `service/subscription_upgrade_test.go`
- Modify: `service/subscription_wallet_renewal_test.go`

- [ ] **Step 1: Write failing service assertions**

For each prepaid, recurring invoice, upgrade, and wallet-renewal grant fixture, assert the persisted entitlement has zero media total even when the plan and old snapshot contain non-zero values. Add one invoice snapshot assertion that newly serialized `plan_snapshot` omits the retired field while an old snapshot containing it still parses.

- [ ] **Step 2: Run RED**

```powershell
go test ./service -run 'Test.*(Purchase|Invoice|Upgrade|Renewal).*Media|Test.*Snapshot.*Media' -count=1
```

Expected: FAIL on current `MediaCreditsTotal: plan.MediaCreditsMonthly` assignments.

- [ ] **Step 3: Implement the minimal service change**

Replace every new-grant assignment with zero and make the recurring helper compatibility-only:

```go
func recurringInvoiceGrantMediaCredits(_ *model.SubscriptionPlan, _ recurringInvoicePlanSnapshot) int64 {
	return 0
}
```

Leave `MediaCreditsMonthly` in private snapshot structs with `json:"media_credits_monthly,omitempty"` only when required to decode historical snapshots; do not populate it when creating a new snapshot. Keep all model price, image ratio, video ratio, and `BillingSession` calls unchanged.

- [ ] **Step 4: Run GREEN and task-funding regression checks**

```powershell
go test ./service -run 'Test.*(Purchase|Invoice|Upgrade|Renewal).*Media|Test.*Snapshot.*Media' -count=1
go test ./service -run 'TestRefundTaskQuota|TestSettlePreparedTaskQuota|TestAcceptedTaskSubscriptionFunding' -count=1
```

Expected: all selected tests pass and task funding tests show only subscription `amount_used` or wallet/token ledgers changing.

### Task 4: Remove media fields from Go public APIs

**Files:**
- Modify: `controller/subscription.go`
- Modify: `controller/subscription_self_purchase.go`
- Modify: `controller/subscription_plan_lifecycle_test.go`
- Modify: `controller/subscription_self_response_test.go`

- [ ] **Step 1: Add API-shape RED assertions**

Update tests to decode responses as `map[string]any` and assert:

```go
require.Contains(t, data, "monthly_bucket")
require.NotContains(t, data, "media_credits")
require.NotContains(t, currentSubscription, "media_credits_total")
require.NotContains(t, currentSubscription, "media_credits_used")
require.NotContains(t, currentPlan, "media_credits_monthly")
```

For admin plan list/create/update responses assert `media_credits_monthly` is absent. JSON requests containing the legacy field may still decode for old clients, but the stored compatibility column must be zero.

- [ ] **Step 2: Run RED**

```powershell
go test ./controller -run 'Test(GetSubscriptionSelf|Admin.*SubscriptionPlan)' -count=1
```

- [ ] **Step 3: Implement DTO and handler cleanup**

Remove media fields from public request/response DTOs and remove mapper assignments and negative-value validation. Keep `model.SubscriptionPlan` compatibility fields private to the model/service layer. `GetSubscriptionSelf` returns only the unified `monthly_bucket` plus existing quota/current-period data.

- [ ] **Step 4: Run GREEN**

```powershell
go test ./controller -run 'Test(GetSubscriptionSelf|Admin.*SubscriptionPlan)' -count=1
```

### Task 5: Remove media credits from console forms, types, cards, and add usage-log links

**Files:**
- Modify: `web/default/src/features/subscriptions/types.ts`
- Modify: `web/default/src/features/subscriptions/lib/plan-form.ts`
- Modify: `web/default/src/features/subscriptions/lib/plan-form.test.ts`
- Modify: `web/default/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx`
- Modify: `web/default/src/features/subscriptions/components/dialogs/subscription-purchase-dialog.tsx`
- Modify: `web/default/src/features/wallet/lib/subscription-plan-lifecycle.ts`
- Modify: `web/default/src/features/wallet/components/current-plan-card.tsx`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.tsx`
- Modify: `web/default/src/features/profile/lib/subscription-summary.ts`
- Modify: `web/default/src/features/profile/components/profile-header.tsx`
- Modify: `web/default/src/features/subscriptions/components/dialogs/subscription-purchase-dialog.test.tsx`
- Modify: `web/default/src/features/wallet/lib/subscription-plan-lifecycle.test.ts`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.test.tsx`
- Modify: `web/default/src/features/profile/lib/subscription-summary.test.ts`
- Modify: `web/default/src/features/profile/hooks/use-profile-subscription.test.ts`
- Modify: `web/default/src/features/profile/components/profile-header.test.tsx`
- Modify: `web/default/src/i18n/static-keys.ts`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/locales/zh.json`

- [ ] **Step 1: Write RED console tests**

Change plan-form tests to prove a payload never contains `media_credits_monthly` even when legacy input is supplied, and change current-card/profile tests to prove one monthly meter remains, no media meter/text renders, and the monthly block is an accessible link:

```ts
expect(payload.plan).not.toHaveProperty('media_credits_monthly')
expect(html).not.toContain('Media generation credits')
expect(html).toContain('href="/usage-logs"')
expect(html.match(/data-wallet-usage-meter=/g)?.length).toBe(1)
```

- [ ] **Step 2: Run RED**

```powershell
Set-Location web/default
bun test src/features/subscriptions/lib/plan-form.test.ts src/features/wallet/components/subscription-plans-card.test.tsx src/features/profile/components/profile-header.test.tsx -t "media|quota|usage-logs"
```

Expected: FAIL because schema, forms, cards, and profile still render/configure media credits and do not link the quota block.

- [ ] **Step 3: Implement minimal console cleanup**

Delete media fields from the Zod schema/defaults/payload mapper and remove the form field and purchase-dialog line. Remove media normalization and plan-card media labels. Delete the media usage meter from `CurrentPlanCard` and `ProfileHeader`; wrap the existing monthly quota meter/summary in:

```tsx
<a href='/usage-logs' className='block rounded-lg focus-visible:outline-none focus-visible:ring-2'>
  {/* existing monthly quota meter/summary */}
</a>
```

Retain all model price/fee display fields and existing purchase/renewal actions. Remove now-unused media translation keys from `static-keys.ts` and every locale JSON.

- [ ] **Step 4: Run GREEN and typecheck**

```powershell
bun test src/features/subscriptions/lib/plan-form.test.ts src/features/wallet/components/subscription-plans-card.test.tsx src/features/profile/components/profile-header.test.tsx
bun run typecheck
```

Expected: targeted tests and TypeScript checks pass with no media-credit string in rendered console output.

### Task 6: Remove media-credit pricing copy and stale SEO descriptions from the website

**Files:**
- Modify: `website/src/lib/online-static-copy.tsx`
- Modify: `website/src/components/online-pricing-page.tsx`
- Modify: `website/src/components/online-pricing-page.test.tsx`
- Modify: `website/src/app/(en)/pricing/page.tsx`
- Modify: `website/src/app/[locale]/pricing/page.tsx`

- [ ] **Step 1: Write RED website assertions**

Replace media-credit snippets with unified quota copy and assert every supported locale renders model usage wording without media-credit wording:

```ts
expect(html).toContain('Up to $45 model usage / mo')
expect(html).not.toMatch(/media credits|media quota|媒体额度|メディアクレジット|медиакредитов/i)
```

Add the same negative assertion for English and localized pricing metadata descriptions.

- [ ] **Step 2: Run RED**

```powershell
Set-Location website
bun test src/components/online-pricing-page.test.tsx
```

Expected: FAIL because pricing cards render `planCopy.media`/`mediaSub` and metadata says “media credits”.

- [ ] **Step 3: Implement website cleanup**

Remove `media` and `mediaSub` from `PlanCopy`, delete the image/video credits block from `OnlinePricingPage`, and retain unified model usage and production controls. Rewrite all locale plan entries and both pricing-page descriptions so images/video are covered by the same model-usage amount; do not change `getPricingData()` or model fee calculations.

- [ ] **Step 4: Run GREEN and website checks**

```powershell
bun test
bun run lint
bun run typecheck
bun run build
```

### Task 7: Repository-wide verification and change audit

**Files:**
- Verify: all files named in Tasks 1-6; no new schema migration file

- [ ] **Step 1: Search for leaked public concepts**

```powershell
rg -n "media_credits|Media generation credits|media credits|媒体额度|媒体生成额度|メディアクレジット|медиакредит" controller model service web/default/src website/src
```

Expected remaining matches are limited to compatibility model fields/private historical snapshot decoding and tests proving old input is ignored; no public DTO, UI, form, or pricing copy may match.

- [ ] **Step 2: Run backend and frontend verification**

```powershell
go test ./controller ./model ./service
Set-Location web/default; bun test; bun run typecheck; bun run build
Set-Location ../../website; bun test; bun run lint; bun run typecheck; bun run build
```

If known full Go suite contention/timeout recurs, record the exact failing package/test and separately run every changed package's focused tests to completion; do not call the full suite green.

- [ ] **Step 3: Run GitNexus and inspect the diff**

```powershell
gitnexus detect_changes --repo new-api
git diff --check
git status --short
```

If GitNexus still reports the LadybugDB version mismatch, record that exact output in final verification notes and rely on `rg`, focused tests, and diff review. Do not add `.gitnexus/`.

- [ ] **Step 4: Run the affected pages locally when frontend dev servers are available**

```powershell
Set-Location web/default
bun run dev --host 127.0.0.1
# In a second shell, open profile and wallet pages and verify the quota link target is /usage-logs.
Set-Location ../../website
bun run dev --hostname 127.0.0.1
# In a second shell, request /pricing and /zh/pricing and verify no media-credit copy is in SSR HTML.
```

If local server startup is blocked by missing environment or database configuration, record the command and concrete error; retain render-to-static-markup tests as the next-best check.

- [ ] **Step 5: Commit using the Lore protocol**

Use one or more commits whose messages include `Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, and `Not-tested` trailers, then report changed files, test evidence, and any verification gaps.

### Task 8: Keep historical balance grant replays idempotent

**Files:**
- Modify: `model/subscription_entitlement_test.go`
- Modify: `model/subscription_entitlement.go`

- [ ] **Step 1: Write the failing scoped replay test**

Add a table test that first grants an entitlement with `MediaCreditsTotal: 0`, then replays the same grant key with a positive compatibility value. The `balance_one_period` case with `Source: balance` and a `balance:` grant key must reuse the existing entitlement, while a Stripe recurring case must still return `ErrSubscriptionEntitlementGrantConflict`.

```go
tests := []struct {
	name        string
	paymentMode string
	source      string
	grantKey    string
	wantLegacy  bool
}{
	{name: "balance one period", paymentMode: SubscriptionPaymentModeBalanceOnePeriod, source: PaymentMethodBalance, grantKey: "balance:legacy-media", wantLegacy: true},
	{name: "stripe recurring", paymentMode: SubscriptionPaymentModeStripeRecurring, source: PaymentProviderStripe, grantKey: "stripe:legacy-media", wantLegacy: false},
}
```

- [ ] **Step 2: Run RED**

```powershell
$env:GOMODCACHE='E:\workspace\.gomodcache'
$env:GOCACHE='E:\workspace\.gocache-restore-media-replay'
go test ./model -run TestSubscriptionEntitlementGrantLegacyZeroMediaReplayIsScopedToBalanceOnePeriod -count=1
```

Expected: the balance one-period subtest fails with `ErrSubscriptionEntitlementGrantConflict`; the Stripe subtest continues to pass by expecting that conflict.

- [ ] **Step 3: Implement the narrow matcher**

Replace the direct media-total equality in `grantMatchesInput` with a helper that preserves exact matching and permits only the approved one-way legacy case:

```go
func grantMediaCreditsMatch(existing *UserSubscription, input GrantEntitlementInput) bool {
	if existing.MediaCreditsTotal == input.MediaCreditsTotal {
		return true
	}
	return existing.MediaCreditsTotal == 0 &&
		input.MediaCreditsTotal > 0 &&
		input.PaymentMode == SubscriptionPaymentModeBalanceOnePeriod &&
		input.Source == PaymentMethodBalance &&
		strings.HasPrefix(strings.TrimSpace(input.GrantKey), "balance:")
}
```

The compatibility match must return the existing entitlement unchanged; it must not mutate `MediaCreditsTotal` during replay.

- [ ] **Step 4: Run GREEN and focused regressions**

```powershell
go test ./model -run 'TestSubscriptionEntitlementGrantLegacyZeroMediaReplayIsScopedToBalanceOnePeriod|TestSubscriptionEntitlementGrantIdempotentAndConflict' -count=1
go test ./service -run 'TestBalancePurchaseCreatesOnePeriodWithoutBinding|TestStripeToBalanceCompensationGrantInputPreservesMediaCredits' -count=1
```

Expected: all selected tests pass, strict Stripe mismatch detection remains active, and new balance grants still receive the configured compatibility value.

- [ ] **Step 5: Verify, commit, push, and answer the review**

Run `gofmt`, `git diff --check`, the changed-package focused suites, and console typecheck. Commit with Lore trailers, push the PR branch, then answer the top-level review with the `main` baseline evidence and the scoped historical-balance replay safeguard.
