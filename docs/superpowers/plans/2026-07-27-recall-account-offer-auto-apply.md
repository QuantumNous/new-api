# Recall Account Offer Auto-Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make issued Recall offers discoverable from the signed-in account, select the largest actual checkout discount server-side, and durably revoke unredeemed Stripe Promotion Codes after campaign cancellation.

**Architecture:** Add a private account-offer query and a shared service resolver based on server-resolved checkout facts. Keep claim links only for click attribution, and add a database-backed revocation queue with CAS leases so cancellation is an immediate local fence while Stripe deactivation retries safely across nodes.

**Tech Stack:** Go, Gin, GORM, SQLite/MySQL/PostgreSQL, stripe-go v86, React, TypeScript, Bun/Vitest.

---

## File map

- `model/recall_recipient.go`: issuance/revocation columns, account candidates, binding, and CAS revocation leases.
- `model/recall_campaign.go`: atomic cancel plus revocation enqueue/requeue.
- `service/recall_contract.go`, `service/recall_claim.go`: safe offer views, shared eligibility/calculation, and best-offer resolver.
- `controller/recall_campaign.go`, `router/api-router.go`: private `GET /api/user/recall/offers`.
- `controller/topup_stripe.go`, `controller/subscription_payment_stripe.go`, `service/subscription_purchase.go`: authoritative checkout integration.
- `service/recall_stripe.go`, `service/recall_revocation.go`, `service/recall_scheduler.go`, `service/recall_worker.go`: Stripe deactivation and cancellation-race handling.
- `web/default/src/features/wallet/{types.ts,index.tsx,lib/recall-claim.ts}`: account loading and per-product preview.
- `web/default/src/features/subscriptions/components/dialogs/subscription-purchase-dialog.tsx`, `web/default/src/features/wallet/components/subscription-plans-card.tsx`: offer-list context and subscription preview.

### Task 1: Persist issuance order and query account-owned candidates

**Files:**
- Modify: `model/recall_recipient.go`
- Modify: `model/recall_repository_test.go`
- Modify: `service/recall_worker.go`
- Test: `service/recall_worker_test.go`

- [ ] **Step 1: Write failing tests**

```go
func TestListRecallOfferCandidatesForUserIncludesUsableStatusesAndBindsExactEmail(t *testing.T) {
	// scheduled/running/paused/completed return; draft/cancelled do not.
	// user_id matches directly; user_id=0 requires exact normalized enabled-user email and CAS binding.
}

func TestPersistRecallRecipientPromotionSetsImmutableIssuedAt(t *testing.T) {
	ok, err := PersistRecallRecipientPromotion(ctx, recipient.Id, "promo_one", "FKONE234", 1_785_100_000)
	require.True(t, ok)
	require.NoError(t, err)
	ok, err = PersistRecallRecipientPromotion(ctx, recipient.Id, "promo_one", "FKONE234", 1_785_100_060)
	require.True(t, ok)
	require.NoError(t, err)
	require.Equal(t, int64(1_785_100_000), loadRecipient(t, recipient.Id).PromotionIssuedAt)
}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./model -run 'Test(ListRecallOfferCandidatesForUserIncludesUsableStatusesAndBindsExactEmail|PersistRecallRecipientPromotionSetsImmutableIssuedAt)$' -count=1`

Expected: compile failure for `PromotionIssuedAt`, the candidate query, and new persistence signature.

- [ ] **Step 3: Implement the minimum model contract**

```go
PromotionIssuedAt int64 `json:"promotion_issued_at" gorm:"index"`

type RecallOfferCandidate struct {
	Recipient RecallRecipient
	Campaign  RecallCampaign
}

func (candidate RecallOfferCandidate) EffectiveIssuedAt() int64 {
	if candidate.Recipient.PromotionIssuedAt > 0 { return candidate.Recipient.PromotionIssuedAt }
	return candidate.Recipient.CreatedAt
}
```

Implement `ListRecallOfferCandidatesForUserWithContext(ctx, userID, normalizedEmail, now)` with joined campaign status and recipient-state predicates. Bind exact email-only rows with `BindRecallRecipientUserWithContext`; omit conflicts. Change `PersistRecallRecipientPromotion` to accept `issuedAt` and use `CASE WHEN promotion_issued_at = 0 THEN ? ELSE promotion_issued_at END`. Pass `time.Now().Unix()` after new Stripe creation; legacy rows use `CreatedAt` fallback.

- [ ] **Step 4: Verify GREEN**

Run: `go test ./model ./service -run 'Test(ListRecallOfferCandidates|PersistRecallRecipientPromotion|RecallWorker.*Promotion)' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit with Lore**

```text
Preserve deterministic Recall offer issuance order

Constraint: Legacy recipients fall back to created_at.
Rejected: Use updated_at | Worker updates would reorder offers.
Confidence: high
Scope-risk: narrow
Directive: Never overwrite a nonzero promotion_issued_at.
Tested: focused model and worker tests
```

### Task 2: Share eligibility, actual-discount calculation, and best-offer selection

**Files:**
- Modify: `service/recall_contract.go`
- Modify: `service/recall_claim.go`
- Modify: `service/recall_claim_test.go`

- [ ] **Step 1: Write failing tests**

```go
func TestCalculateRecallDiscountMinorHonorsCurrencyMinimumRoundingAndClamp(t *testing.T) {
	// 12.5% of 999 => 125; exact USD fixed amount applies; EUR mismatch => 0;
	// minimum currency/amount must match; result clamps to subtotal; JPY minor units also round once.
}

func TestResolveBestRecallOfferOrdersByDiscountIssuedAtThenRecipientID(t *testing.T) {
	// Largest actual discount wins; equal amounts use issued_at DESC, then recipient ID ASC.
}

func TestRecallCancelledIsNotActiveButPausedAndCompletedRemainActive(t *testing.T) {
	require.False(t, activeRecallCampaignStatus(model.RecallCampaignCancelled))
	require.True(t, activeRecallCampaignStatus(model.RecallCampaignPaused))
	require.True(t, activeRecallCampaignStatus(model.RecallCampaignCompleted))
}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./service -run 'Test(CalculateRecallDiscountMinor|ResolveBestRecallOffer|RecallCancelled)' -count=1`

Expected: missing resolver/calculator and current cancelled-status assertion failure.

- [ ] **Step 3: Implement safe views and resolver**

```go
type RecallOfferView struct {
	CampaignID int64 `json:"campaign_id"`
	RecipientID int64 `json:"recipient_id"`
	CampaignName string `json:"campaign_name"`
	PromotionCodeMasked string `json:"promotion_code_masked"`
	IssuedAt int64 `json:"issued_at"`
	ExpiresAt int64 `json:"expires_at"`
	Discount RecallDiscountConfig `json:"discount"`
	Products RecallProductScope `json:"products"`
	Redeemed bool `json:"redeemed"`
}

type RecallResolvedOffer struct {
	View RecallOfferView
	PromotionCodeID string
	DiscountMinor int64
}
```

Add `ListOffers(ctx,userID)` and:

```go
func (s *RecallClaimService) ResolveBestRecallOffer(
	ctx context.Context, userID int, purchaseKind, priceID, currency string, subtotalMinor int64,
) (*RecallResolvedOffer, error)
```

Parse each campaign independently; skip malformed candidates with structured logs. Use exact price membership. Percent uses minor-unit rounding; fixed discounts require exact uppercase currency/currency option; minimum currency/amount must match; clamp to subtotal; zero is ineligible. Sort discount DESC, issued time DESC, recipient ID ASC. Remove `cancelled` from `activeRecallCampaignStatus`; keep scheduled/running/paused/completed. Claim validation uses the same validator so cancelled links reject.

- [ ] **Step 4: Verify GREEN**

Run: `go test ./service -run 'TestRecall(Claim|Offer|Calculate|Resolve|Cancelled)' -count=1`

Expected: PASS; update the old test so completed remains valid but cancelled rejects.

- [ ] **Step 5: Commit with Lore**

```text
Choose Recall offers by authoritative checkout value

Constraint: Selection uses only server-resolved price, currency, and subtotal.
Rejected: Let recall_claim select the campaign | A stale link can force a weaker or cancelled offer.
Confidence: high
Scope-risk: moderate
Directive: Frontend preview is advisory; checkout must rerun ResolveBestRecallOffer.
Tested: focused Recall service tests
```

### Task 3: Add private account discovery

**Files:**
- Modify: `controller/recall_campaign.go`
- Modify: `controller/recall_campaign_test.go`
- Modify: `router/api-router.go`
- Modify: `router/recall_campaign_test.go`

- [ ] **Step 1: Write failing controller and route tests**

```go
func TestRecallOffersUsesAuthenticatedUserAndNeverReturnsSecrets(t *testing.T) {
	r := invokeRecallHandler(t, ListRecallOffers, http.MethodGet, "/", nil, 51, nil)
	require.Equal(t, http.StatusOK, r.Code)
	require.Equal(t, "no-store", r.Header().Get("Cache-Control"))
	require.NotContains(t, r.Body.String(), "CLAIMSECRET")
	require.NotContains(t, r.Body.String(), "stripe_promotion_code_id")
	require.NotContains(t, r.Body.String(), "email_snapshot")
}
```

Also assert unauthenticated route access rejects.

- [ ] **Step 2: Verify RED**

Run: `go test ./controller ./router -run 'TestRecallOffers' -count=1`

Expected: missing handler/route.

- [ ] **Step 3: Add thin handler and route**

```go
func ListRecallOffers(c *gin.Context) {
	runtime, err := recallControllerRuntime()
	if err != nil { common.ApiError(c, err); return }
	offers, err := runtime.Claims.ListOffers(c.Request.Context(), c.GetInt("id"))
	if err != nil { common.ApiError(c, err); return }
	c.Header("Cache-Control", "no-store")
	common.ApiSuccess(c, offers)
}
```

Register `selfRoute.GET("/recall/offers", controller.ListRecallOffers)`. Disabled Recall returns `[]`.

- [ ] **Step 4: Verify GREEN**

Run: `go test ./controller ./router -run 'TestRecall(Offers|Claim)' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit with Lore**

```text
Expose safe account-owned Recall offers

Constraint: Never return claims, raw codes, Stripe IDs, or email snapshots.
Confidence: high
Scope-risk: narrow
Directive: Keep the endpoint authenticated and no-store.
Tested: focused controller and router tests
```

### Task 4: Resolve the best offer on every supported purchase path

**Files:**
- Modify: `controller/topup_stripe.go`
- Modify: `controller/topup_stripe_test.go`
- Modify: `controller/subscription_payment_stripe.go`
- Modify: `controller/subscription_payment_stripe_test.go`
- Modify: `service/subscription_purchase.go`
- Modify: `service/subscription_purchase_test.go`

- [ ] **Step 1: Write failing no-claim checkout tests**

```go
func TestStripePayAppliesBestAccountRecallOfferWithoutClaim(t *testing.T) {}
func TestSubscriptionStripePayIgnoresWeakerSuppliedClaimAndUsesBestAccountOffer(t *testing.T) {}
func TestSubscriptionPurchaseQuoteAppliesBestRecallOfferWithoutClaim(t *testing.T) {}
```

Seed two valid offers and assert the larger actual discount's Promotion Code and campaign/recipient metadata win. Add a post-cancel request test and assert cancellation never updates an already-created fake Checkout Session.

- [ ] **Step 2: Verify RED**

Run: `go test ./controller ./service -run 'Test(StripePayAppliesBestAccount|SubscriptionStripePayIgnoresWeaker|SubscriptionPurchaseQuoteAppliesBest)' -count=1`

Expected: current link-only code omits every no-claim discount.

- [ ] **Step 3: Integrate authoritative resolution**

After resolving actual price, currency, quantity, and subtotal, call:

```go
offer, err := runtime.Claims.ResolveBestRecallOffer(ctx, userID, purchaseKind, resolvedPriceID, resolvedCurrency, resolvedSubtotalMinor)
if err != nil { return existingPaymentError(err) }
if offer != nil {
	checkout.Discounts = []*stripe.CheckoutSessionDiscountParams{{PromotionCode: stripe.String(offer.PromotionCodeID)}}
	// preserve existing campaign/recipient attribution metadata
}
```

Validate a supplied claim only as click attribution; log typed failure and continue account resolution. Do not silently retry Checkout with a weaker offer after an ambiguous Stripe failure. Preserve unrelated top-up bonus/promotion behavior.

- [ ] **Step 4: Verify GREEN**

Run: `go test ./controller ./service -run 'Test(StripePay|Subscription.*Recall|Recall.*Checkout|Recall.*Purchase)' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit with Lore**

```text
Apply the best account Recall offer at checkout

Constraint: Existing Checkout Sessions and unrelated promotion paths remain unchanged.
Rejected: Trust the browser-selected offer | Checkout facts and eligibility can change.
Confidence: high
Scope-risk: broad
Directive: Resolve after checkout facts and before the single Checkout creation attempt.
Tested: focused controller and subscription purchase tests
```

### Task 5: Durably revoke cancelled campaign Promotion Codes

**Files:**
- Modify: `model/recall_recipient.go`
- Modify: `model/recall_campaign.go`
- Modify: `model/recall_repository_test.go`
- Modify: `service/recall_stripe.go`
- Modify: `service/recall_stripe_test.go`
- Create: `service/recall_revocation.go`
- Create: `service/recall_revocation_test.go`
- Modify: `service/recall_campaign.go`
- Modify: `service/recall_campaign_test.go`
- Modify: `service/recall_scheduler.go`
- Modify: `service/recall_worker.go`
- Modify: `service/recall_worker_test.go`

- [ ] **Step 1: Write failing model and worker tests**

```go
func TestCancelRecallCampaignAtomicallyQueuesUnredeemedPromotionRevocation(t *testing.T) {}
func TestCancelRecallCampaignAgainRequeuesFailedRevocations(t *testing.T) {}
func TestListDueRecallPromotionRevocationsFindsLegacyCancelledRows(t *testing.T) {}
func TestRecallRevocationWorkerLeasesAcrossCompetingWorkers(t *testing.T) {}
func TestRecallRevocationWorkerDeactivatesActiveUnredeemedCode(t *testing.T) {}
func TestRecallRevocationWorkerRetriesTransientAndRecordsPermanentFailure(t *testing.T) {}
func TestRecallWorkerQueuesPromotionCreatedDuringCancellation(t *testing.T) {}
```

- [ ] **Step 2: Verify RED**

Run: `go test ./model ./service -run 'Test(CancelRecallCampaign.*Revocation|ListDueRecallPromotionRevocations|RecallRevocationWorker|RecallWorkerQueuesPromotionCreatedDuringCancellation)' -count=1`

Expected: missing revocation columns, client method, and worker.

- [ ] **Step 3: Add portable revocation state and CAS methods**

```go
const (
	RecallPromotionRevocationPending = "pending"
	RecallPromotionRevocationCompleted = "completed"
	RecallPromotionRevocationFailed = "failed"
)

PromotionRevocationState string `json:"-" gorm:"type:varchar(16);index"`
PromotionRevocationAttemptCount int `json:"-"`
PromotionRevocationNextAttemptAt int64 `json:"-" gorm:"index"`
PromotionRevocationLeaseOwner string `json:"-" gorm:"type:varchar(96);index"`
PromotionRevocationLeaseExpiresAt int64 `json:"-" gorm:"index"`
PromotionRevokedAt int64 `json:"-"`
PromotionRevocationLastErrorCode string `json:"-" gorm:"type:varchar(64)"`
```

Implement bounded `ListDueRecallPromotionRevocationIDs`, `LeaseRecallPromotionRevocation`, `CompleteRecallPromotionRevocation`, `DeferRecallPromotionRevocation`, and `FailRecallPromotionRevocation`. Every settle compares recipient ID, lease owner, and exact lease expiry. The due query includes legacy cancelled recipients with empty revocation state, unexpired code identity, and non-converted state.

Extend `CancelRecallCampaignAndAdminEventWithContext` so the same transaction transitions status, cancels messages, queues usable codes, and writes the admin event. Repeated cancel leaves the campaign cancelled and requeues failed revocations.

- [ ] **Step 4: Add Stripe update and worker**

Extend `RecallStripeClient` and every fake:

```go
UpdatePromotionCode(context.Context, string, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error)
```

Implement with `promotioncode.Client.Update(id, params)` and `params.Active = stripe.Bool(false)`. Create `RecallPromotionRevocationWorker.RunBatch(ctx,limit)` with capped exponential backoff. Local expiry, Stripe resource-missing, inactive, and redeemed/max-redemptions reached complete; retryable errors defer; permanent/unknown errors fail with sanitized error codes only.

Add the worker to `RecallRuntime` and `RunRecallMaintenanceTick`. After `Campaigns.Cancel` commits, a bounded best-effort pass may run, but cancellation API success depends only on the durable local transaction.

- [ ] **Step 5: Fence Stripe creation races**

Persist promotion identity and issuance time transactionally with a campaign-status check. If already cancelled, mark revocation pending and do not advance delivery. If Stripe creation succeeded but lease persistence loses, best-effort deactivate immediately and leave sanitized reconciliation evidence.

- [ ] **Step 6: Verify GREEN**

Run: `go test ./model ./service ./controller -run 'TestRecall(Campaign|Revocation|Worker|Cancel)' -count=1`

Expected: PASS; the old “cancel preserves code” assertion becomes “identity retained, remote revocation pending/completed.”

- [ ] **Step 7: Commit with Lore**

```text
Fence cancelled Recall offers and revoke their Stripe codes

Constraint: Production is multi-node and Stripe may be unavailable during cancellation.
Rejected: Revoke synchronously inside the cancel transaction | External failure would make local eligibility ambiguous.
Confidence: high
Scope-risk: broad
Directive: Cancelled status is authoritative; revocation work must use CAS leases.
Tested: focused cancellation and revocation tests
```

### Task 6: Load account offers on normal wallet visits

**Files:**
- Modify: `web/default/src/features/wallet/types.ts`
- Modify: `web/default/src/features/wallet/lib/recall-claim.ts`
- Modify: `web/default/src/features/wallet/lib/recall-claim.test.ts`
- Modify: `web/default/src/features/wallet/index.tsx`
- Modify: `web/default/src/features/subscriptions/components/dialogs/subscription-purchase-dialog.tsx`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.tsx`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.test.tsx`

- [ ] **Step 1: Write failing selector and normal-entry tests**

```ts
test('selects largest actual discount then latest issue then lowest recipient id', () => {
  expect(selectBestRecallOffer(offers, {
    purchaseKind: 'topup', priceId: 'price_topup', currency: 'USD', subtotalMinor: 1000,
  })?.recipient_id).toBe(expectedRecipientId)
})

test('normal wallet account offers preview without a recall claim', async () => {
  // Mock GET /api/user/recall/offers, render without initialRecallClaim,
  // and assert the eligible discount appears without raw claim/code text.
})
```

Add a stale-link test: failed claim validation still refreshes offers and displays another valid account offer.

- [ ] **Step 2: Verify RED**

From `web/default`, run: `bun test src/features/wallet/lib/recall-claim.test.ts src/features/wallet/components/subscription-plans-card.test.tsx`

Expected: missing list types/fetch/selector and failed normal-entry assertion.

- [ ] **Step 3: Add safe types and pure selection**

```ts
export interface RecallOfferView extends RecallClaimView {
  campaign_id: number
  recipient_id: number
  issued_at: number
}

export type RecallOffersResponse = ApiResponse<RecallOfferView[]>
```

Add `listRecallOffers()` using `api.get('/api/user/recall/offers')` and `selectBestRecallOffer(offers,facts)`. Reuse `getRecallPriceDiscount`, then order discount minor DESC, `issued_at` DESC, `recipient_id` ASC. Never accept/store full Promotion Codes.

- [ ] **Step 4: Replace link-owned single context with account offers**

Fetch offers on every authenticated wallet mount. If a claim exists, validate for attribution, clean the URL exactly as today, then refresh offers in `finally`; claim failure cannot clear other offers.

```ts
interface RecallOfferContextValue {
  offers: RecallOfferView[]
  loading?: boolean
}
```

Select a preview independently for each top-up amount and subscription plan. Stop requiring a claim on normal checkout requests; backend resolution is authoritative. Keep link-claim forwarding only while a link claim is present. Reuse existing copy, so no locale change is expected.

- [ ] **Step 5: Verify GREEN**

From `web/default`, run:

`bun test src/features/wallet/lib/recall-claim.test.ts src/features/wallet/lib/stripe-payment-request.test.ts src/features/wallet/lib/subscription-plan-lifecycle.test.ts src/features/wallet/components/subscription-plans-card.test.tsx src/features/auth/lib/storage.test.ts src/lib/analytics/mixpanel.test.ts`

Then run: `bun run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit with Lore**

```text
Show account Recall offers without requiring an email link

Constraint: Link claims remain private attribution inputs and are removed from the URL.
Rejected: Persist browser-selected offers | Checkout resolution is authoritative.
Confidence: high
Scope-risk: moderate
Directive: Keep frontend per-product ordering aligned with the backend.
Tested: focused Bun tests and typecheck
```

### Task 7: Cross-path regression and release verification

**Files:**
- Modify only if verification exposes a defect in files already owned by Tasks 1-6.

- [ ] **Step 1: Format changed Go code**

Run `gofmt -w` on every changed `.go` file. Expected: no error and no unrelated file changes.

- [ ] **Step 2: Run complete Recall backend coverage**

Run: `go test ./model ./service ./controller ./router -run Recall -count=1`

Expected: PASS.

- [ ] **Step 3: Run affected Go packages without name filtering**

Run: `go test ./model ./service ./controller ./router -count=1`

Expected: PASS.

- [ ] **Step 4: Run frontend verification**

From `web/default` run:

```powershell
bun test src/features/wallet src/features/subscriptions src/features/auth/lib/storage.test.ts src/lib/analytics/mixpanel.test.ts
bun run typecheck
bun run build:check
```

Expected: PASS. Run `bun run i18n:sync` only if user-visible copy changed; then update all eight locales.

- [ ] **Step 5: Audit scope and secrets**

```powershell
git diff --check
git status --short
git diff --stat origin/main...HEAD
rg -n 'claim_token_hash|stripe_promotion_code_id|email_snapshot' web/default/src service/recall_claim.go controller/recall_campaign.go
```

Expected: planned scope only and no secret field in account-offer JSON.

- [ ] **Step 6: Request code review and fix only demonstrated defects**

Have a code-reviewer inspect `origin/main...HEAD` for account authorization, cancelled-status gaps, checkout authority, Stripe idempotency, CAS lease correctness, currency rounding, and frontend/backend ordering drift. Re-run the smallest proving test after every accepted finding.

- [ ] **Step 7: Commit review fixes if required**

```text
Close Recall account-offer verification gaps

Constraint: Fixes are limited to demonstrated defects in the approved Recall design.
Confidence: high
Scope-risk: narrow
Directive: Deploy all backend nodes before frontend and cancellation acceptance testing.
Tested: affected Go packages, focused frontend tests, typecheck, and build check
```

## Stop condition

Stop only with fresh evidence that normal wallet entry discovers offers; every supported checkout picks the largest actual discount with the required tie-breaks; cancelled campaigns are immediately excluded and codes are durably revoked; paused/completed codes remain usable until expiry; claims preserve attribution without controlling eligibility; existing Checkout Sessions are untouched; no secrets are exposed; affected Go tests, frontend tests, typecheck, and build checks pass.
