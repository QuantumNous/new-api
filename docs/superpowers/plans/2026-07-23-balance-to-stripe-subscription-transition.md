# Balance-to-Stripe Subscription Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an active one-period subscription to upgrade through a new Stripe recurring Checkout while preventing one-period contracts from offering or attempting scheduled downgrades.

**Architecture:** Keep the existing single-contract aggregate and reuse the first-subscription Checkout plus paid-invoice reconciliation path for one-period-to-Stripe upgrades. Distinguish recurring-to-recurring upgrades by their existing provider binding, so only that path updates the existing Stripe subscription. Make scheduled-downgrade eligibility backend-authoritative in the plan relation and add a wallet fail-closed guard based on the canonical contract payment mode.

**Tech Stack:** Go, GORM, Stripe Go v81, Gin, TypeScript, React, Bun test.

**Source of truth:** `docs/superpowers/specs/2026-07-22-single-subscription-lifecycle-design.md`, especially “余额一期升 Stripe recurring” and “期末降级”.

---

### Task 1: Route one-period upgrades through Stripe Checkout

**Files:**
- Create: `service/subscription_balance_to_stripe_transition_test.go`
- Modify: `service/subscription_contract.go:73-180`
- Modify: `service/subscription_contract.go:314-423`

- [ ] **Step 1: Write failing Checkout and replay tests**

Create `service/subscription_balance_to_stripe_transition_test.go` with a fixture that buys a lower plan from balance, configures a higher plan with `price_invoice_plan`, and captures the Checkout creator:

```go
package service

import (
	"context"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

type balanceToStripeTransitionFixture struct {
	userID             int
	currentPlan        model.SubscriptionPlan
	targetPlan         model.SubscriptionPlan
	currentContractID  int64
	currentEntitlement int
}

func seedBalanceToStripeTransition(t *testing.T, userID int) balanceToStripeTransitionFixture {
	t.Helper()
	setupSubscriptionInvoiceServiceTestDB(t)
	insertContractServiceUser(t, userID, 2000)
	currentPlan := insertContractServicePlan(t, userID+1000, 1, 5, 500)
	targetPlan := insertContractServicePlan(t, userID+1001, 2, 12.34, 1234)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).
		Where("id = ?", targetPlan.Id).
		Update("stripe_price_id", "price_invoice_plan").Error)
	targetPlan.StripePriceId = "price_invoice_plan"

	current, err := ChangeSubscriptionPlan(balanceChangeCommand(userID, currentPlan.Id, "balance-current"))
	require.NoError(t, err)
	return balanceToStripeTransitionFixture{
		userID:             userID,
		currentPlan:        currentPlan,
		targetPlan:         targetPlan,
		currentContractID:  current.Contract.Id,
		currentEntitlement: current.Contract.CurrentEntitlementId,
	}
}

func TestBalanceOnePeriodUpgradeToStripeRecurringCreatesAndReplaysCheckoutWithoutChangingCurrentEntitlement(t *testing.T) {
	fx := seedBalanceToStripeTransition(t, 8140)
	originalCreator := stripeSubscriptionCheckoutCreator
	checkoutCalls := 0
	stripeSubscriptionCheckoutCreator = func(_ context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
		checkoutCalls++
		require.Equal(t, fx.userID, input.UserID)
		require.Equal(t, fx.targetPlan.Id, input.PlanID)
		require.Equal(t, fx.currentContractID, input.ContractID)
		require.Equal(t, "price_invoice_plan", input.PriceID)
		return &StripeSubscriptionCheckoutSession{ID: "cs_balance_upgrade", URL: "https://checkout.example/balance-upgrade"}, nil
	}
	t.Cleanup(func() { stripeSubscriptionCheckoutCreator = originalCreator })

	command := ChangePlanCommand{
		UserID:      fx.userID,
		PlanID:      fx.targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "balance-to-stripe-upgrade",
	}
	first, err := ChangeSubscriptionPlan(command)
	require.NoError(t, err)
	second, err := ChangeSubscriptionPlan(command)
	require.NoError(t, err)

	require.Equal(t, ChangePlanStatusCheckoutRequired, first.Status)
	require.Equal(t, "https://checkout.example/balance-upgrade", first.CheckoutURL)
	require.Equal(t, first.Intent.Id, second.Intent.Id)
	require.Equal(t, first.CheckoutURL, second.CheckoutURL)
	require.Equal(t, 1, checkoutCalls)
	require.Equal(t, model.SubscriptionChangeIntentKindUpgrade, first.Intent.Kind)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, first.Intent.Status)
	require.Zero(t, first.Intent.ProviderBindingId)

	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contract, "id = ?", fx.currentContractID).Error)
	require.Equal(t, model.SubscriptionPaymentModeBalanceOnePeriod, contract.PaymentMode)
	require.Equal(t, fx.currentPlan.Id, contract.CurrentPlanId)
	require.Equal(t, fx.currentEntitlement, contract.CurrentEntitlementId)
	require.Zero(t, contract.CurrentProviderBindingId)

	var stripeOrders []model.SubscriptionOrder
	require.NoError(t, model.DB.Where("change_intent_id = ? AND payment_provider = ?", first.Intent.Id, model.PaymentProviderStripe).Find(&stripeOrders).Error)
	require.Len(t, stripeOrders, 1)
	require.Equal(t, common.TopUpStatusPending, stripeOrders[0].Status)
}
```

- [ ] **Step 2: Run the Checkout test and verify RED**

Run:

```powershell
go test ./service -run '^TestBalanceOnePeriodUpgradeToStripeRecurringCreatesAndReplaysCheckoutWithoutChangingCurrentEntitlement$' -count=1
```

Expected: FAIL with `current subscription is not Stripe recurring`.

- [ ] **Step 3: Distinguish binding-based recurring upgrades from new-subscription upgrades**

In `ChangeSubscriptionPlan`, require `existing.ProviderBindingId > 0` before entering the existing-subscription replay branch:

```go
if existing.Kind == model.SubscriptionChangeIntentKindUpgrade &&
	existing.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
	existing.ProviderBindingId > 0 &&
	(existing.Status == model.SubscriptionChangeIntentStatusSyncing ||
		existing.Status == model.SubscriptionChangeIntentStatusAwaitingPayment) {
	// Existing recurring-to-recurring replay remains unchanged.
}
```

Gate the current Stripe subscription update path on a complete current recurring binding. Permit an active one-period contract with no current provider binding to fall through to the existing Checkout order creation block:

```go
isCurrentStripeRecurring := contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
	contract.CurrentProviderBindingId > 0
isCurrentOnePeriod := contract.Status == model.SubscriptionContractStatusActive &&
	contract.CurrentProviderBindingId == 0 &&
	(contract.PaymentMode == model.SubscriptionPaymentModeBalanceOnePeriod ||
		contract.PaymentMode == model.SubscriptionPaymentModeExternalOnePeriod)

if kind == model.SubscriptionChangeIntentKindUpgrade && isCurrentStripeRecurring {
	// Existing binding lookup and stripeSubscriptionUpgradeExecutor preparation remain unchanged.
	return nil
}
if kind == model.SubscriptionChangeIntentKindUpgrade && !isCurrentOnePeriod {
	return errors.New("current subscription cannot start a new Stripe recurring upgrade")
}
if kind != model.SubscriptionChangeIntentKindPurchase && kind != model.SubscriptionChangeIntentKindUpgrade {
	return ErrStripeCheckoutPendingMigration
}
```

Do not change the shared order, idempotency key, Checkout metadata, or `TerminatePendingStripePurchase` calls. The intent remains `upgrade`, its status becomes `awaiting_payment`, and the current entitlement remains active until a paid invoice is reconciled.

- [ ] **Step 4: Run the Checkout and existing recurring-upgrade tests and verify GREEN**

Run:

```powershell
go test ./service -run 'TestBalanceOnePeriodUpgradeToStripeRecurringCreatesAndReplaysCheckoutWithoutChangingCurrentEntitlement|TestStripeSubscriptionUpgrade|TestStripeUpgradeReplay' -count=1
```

Expected: PASS.

- [ ] **Step 5: Add the paid-invoice transition test**

Append this test to the new test file:

```go
func TestPaidInvoiceForBalanceToStripeUpgradeAtomicallySwitchesContract(t *testing.T) {
	fx := seedBalanceToStripeTransition(t, 8141)
	restoreCheckout := replaceStripeCheckoutCreator(t, "cs_balance_paid", "https://checkout.example/balance-paid")
	defer restoreCheckout()

	pending, err := ChangeSubscriptionPlan(ChangePlanCommand{
		UserID:      fx.userID,
		PlanID:      fx.targetPlan.Id,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		RequestID:   "balance-to-stripe-paid",
	})
	require.NoError(t, err)

	var order model.SubscriptionOrder
	require.NoError(t, model.DB.Where("change_intent_id = ? AND payment_provider = ?", pending.Intent.Id, model.PaymentProviderStripe).First(&order).Error)
	metadata := map[string]string{
		"trade_no":         order.TradeNo,
		"user_id":          strconv.Itoa(fx.userID),
		"plan_id":          strconv.Itoa(fx.targetPlan.Id),
		"contract_id":      strconv.FormatInt(fx.currentContractID, 10),
		"change_intent_id": strconv.FormatInt(pending.Intent.Id, 10),
	}
	restoreReconcile := replaceStripeInvoiceReconcilers(
		t,
		stripeInvoiceFixture("in_balance_upgrade", "sub_balance_upgrade"),
		stripeSubscriptionFixture("sub_balance_upgrade", metadata),
	)
	defer restoreReconcile()

	result, err := ReconcilePaidInvoice(context.Background(), "in_balance_upgrade")
	require.NoError(t, err)
	require.True(t, result.Applied)

	var contract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&contract, "id = ?", fx.currentContractID).Error)
	require.Equal(t, model.SubscriptionPaymentModeStripeRecurring, contract.PaymentMode)
	require.Equal(t, fx.targetPlan.Id, contract.CurrentPlanId)
	require.NotZero(t, contract.CurrentProviderBindingId)
	require.NotEqual(t, fx.currentEntitlement, contract.CurrentEntitlementId)

	var entitlements []model.UserSubscription
	require.NoError(t, model.DB.Where("contract_id = ?", fx.currentContractID).Order("id asc").Find(&entitlements).Error)
	require.Len(t, entitlements, 2)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, entitlements[0].Status)
	require.Equal(t, model.SubscriptionEntitlementEndReasonUpgraded, entitlements[0].EndReason)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, entitlements[1].Status)
	require.Equal(t, model.SubscriptionPaymentModeStripeRecurring, entitlements[1].PaymentMode)
	require.Equal(t, fx.targetPlan.Id, entitlements[1].PlanId)
}
```

- [ ] **Step 6: Run the paid-invoice test and verify GREEN without adding a second reconciliation path**

Run:

```powershell
go test ./service -run 'TestPaidInvoiceForBalanceToStripeUpgradeAtomicallySwitchesContract|TestReconcilePaidInvoiceGrantsInvoiceFirstPurchase|TestStripeUpgradePaidInvoiceRotatesTargetEntitlement' -count=1
```

Expected: PASS. The existing no-binding paid-invoice branch must handle `intent.Kind == upgrade`; do not create a parallel webhook implementation.

- [ ] **Step 7: Commit Task 1**

```powershell
git add service/subscription_contract.go service/subscription_balance_to_stripe_transition_test.go
git commit -m "Allow one-period subscribers to enter Stripe recurring safely" -m "Constraint: Preserve the current entitlement until a verified paid Stripe invoice rotates the contract." -m "Rejected: Updating a nonexistent Stripe subscription | one-period contracts have no provider binding." -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Keep recurring-to-recurring upgrades on the existing subscription item path." -m "Tested: Targeted service Checkout, replay, paid-invoice, and recurring-upgrade tests." -m "Not-tested: Live Stripe Test Clock transition."
```

### Task 2: Make one-period downgrade rejection accurate and backend-authoritative

**Files:**
- Modify: `service/subscription_contract.go:24-29`
- Modify: `service/subscription_contract.go:688-697`
- Modify: `service/subscription_contract_test.go:260-284`
- Modify: `controller/subscription.go:586-603`
- Modify: `controller/subscription_self_response_test.go:170-243`

- [ ] **Step 1: Write failing service error assertions**

Replace the old sentinel assertion in `TestBalanceDowngradeDoesNotApplyImmediately` and assert the user-facing message:

```go
require.ErrorIs(t, err, ErrSubscriptionDowngradeUnsupported)
require.Equal(t, "subscription downgrade scheduling is only supported for active Stripe recurring subscriptions", err.Error())
```

Keep a compatibility alias for callers that still reference `ErrSubscriptionDowngradeDeferred`.

- [ ] **Step 2: Run the service downgrade test and verify RED**

Run:

```powershell
go test ./service -run '^TestBalanceDowngradeDoesNotApplyImmediately$' -count=1
```

Expected: FAIL because `ErrSubscriptionDowngradeUnsupported` is not defined and the current message says `not implemented`.

- [ ] **Step 3: Define the accurate error and retain source compatibility**

In `service/subscription_contract.go` define and return:

```go
ErrSubscriptionDowngradeUnsupported = errors.New("subscription downgrade scheduling is only supported for active Stripe recurring subscriptions")

// ErrSubscriptionDowngradeDeferred is retained for callers compiled against the previous sentinel name.
ErrSubscriptionDowngradeDeferred = ErrSubscriptionDowngradeUnsupported
```

Return `ErrSubscriptionDowngradeUnsupported` for `balance_one_period` and `external_one_period` contracts in `prepareStripeSubscriptionDowngradeTx`.

- [ ] **Step 4: Add failing plan-relation coverage**

Extend `TestGetSubscriptionPlansAnnotatesTierRankAndRelation` with a lower-rank plan while the current contract is `balance_one_period`, and assert:

```go
require.Equal(t, "unavailable", relations[lowerPlanID])
require.Equal(t, "current", relations[currentPlanID])
require.Equal(t, "upgrade", relations[higherPlanID])
```

Add a direct invariant test:

```go
func TestSubscriptionPlanRelationOnlyOffersDowngradeForActiveStripeRecurring(t *testing.T) {
	currentRank := 20
	lowerRank := 10
	lower := &model.SubscriptionPlan{Id: 2, TierRank: &lowerRank}
	tests := []struct {
		name     string
		contract model.UserSubscriptionContract
		want     string
	}{
		{name: "balance one period", contract: model.UserSubscriptionContract{Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod, CurrentPlanId: 1}, want: "unavailable"},
		{name: "external one period", contract: model.UserSubscriptionContract{Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod, CurrentPlanId: 1}, want: "unavailable"},
		{name: "Stripe recurring", contract: model.UserSubscriptionContract{Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, CurrentPlanId: 1, CurrentProviderBindingId: 9}, want: "downgrade"},
		{name: "Stripe recurring missing binding", contract: model.UserSubscriptionContract{Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModeStripeRecurring, CurrentPlanId: 1}, want: "unavailable"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, subscriptionPlanRelation(&tc.contract, &currentRank, lower))
		})
	}
}
```

- [ ] **Step 5: Run the controller tests and verify RED**

Run:

```powershell
go test ./controller -run 'TestGetSubscriptionPlansAnnotatesTierRankAndRelation|TestSubscriptionPlanRelationOnlyOffersDowngradeForActiveStripeRecurring' -count=1
```

Expected: FAIL because lower rank currently maps to `downgrade` using rank alone.

- [ ] **Step 6: Enforce the downgrade invariant in the plan relation**

Change only the lower-rank branch in `subscriptionPlanRelation`:

```go
if *plan.TierRank < *currentTierRank {
	if contract.Status != model.SubscriptionContractStatusActive ||
		contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring ||
		contract.CurrentProviderBindingId <= 0 {
		return "unavailable"
	}
	return "downgrade"
}
```

Do not alter upgrade relations; active one-period contracts must still be able to choose a higher plan.

- [ ] **Step 7: Run service, controller, and existing Stripe downgrade tests and verify GREEN**

Run:

```powershell
go test ./service -run 'TestBalanceDowngradeDoesNotApplyImmediately|TestStripeDowngrade' -count=1
go test ./controller -run 'TestGetSubscriptionPlansAnnotatesTierRankAndRelation|TestSubscriptionPlanRelationOnlyOffersDowngradeForActiveStripeRecurring' -count=1
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```powershell
git add service/subscription_contract.go service/subscription_contract_test.go controller/subscription.go controller/subscription_self_response_test.go
git commit -m "Prevent one-period contracts from promising deferred downgrades" -m "Constraint: Scheduled downgrade exists only for an active Stripe recurring binding." -m "Rejected: Rank-only downgrade actions | they expose an operation the contract cannot perform." -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: Keep higher-rank one-period upgrades available." -m "Tested: Targeted service, controller relation, and Stripe downgrade tests." -m "Not-tested: Browser-level wallet rendering."
```

### Task 3: Fail closed in the wallet for stale downgrade relations

**Files:**
- Modify: `web/default/src/features/wallet/lib/subscription-plan-lifecycle.ts:198-223`
- Modify: `web/default/src/features/wallet/lib/subscription-plan-lifecycle.test.ts:220-296`

- [ ] **Step 1: Write the failing wallet invariant test**

Add a helper that supplies a canonical contract, then test both one-period modes:

```ts
function createContractLifecycle(paymentMode: 'stripe_recurring' | 'balance_one_period' | 'external_one_period') {
  return normalizeSelfSubscriptionData({
    ...createBackendSelfData(false, false),
    contract: {
      contract_id: 10,
      status: 'active',
      payment_mode: paymentMode,
      current_plan_id: 1,
      current_entitlement_id: 11,
      current_provider_binding_id: paymentMode === 'stripe_recurring' ? 12 : 0,
      latest_change_intent_id: 0,
      pending_plan_id: 0,
      pending_effective_at: 0,
      change_version: 1,
    },
  })
}

test('fails closed on stale downgrade relations for one-period contracts', () => {
  const lowerPlan = {
    plan: { ...basePlan, id: 2, tier_rank: 1, payment_modes: ['stripe_recurring'] },
    relation: 'downgrade',
  }
  for (const paymentMode of ['balance_one_period', 'external_one_period'] as const) {
    expect(
      getDisplayedPlanAction(lowerPlan, 1, ['stripe_recurring'], createContractLifecycle(paymentMode))
    ).toBe('unavailable')
  }
  expect(
    getDisplayedPlanAction(lowerPlan, 1, ['stripe_recurring'], createContractLifecycle('stripe_recurring'))
  ).toBe('downgrade_next_period')
})
```

- [ ] **Step 2: Run the wallet test and verify RED**

Run from `web/default`:

```powershell
bun test src/features/wallet/lib/subscription-plan-lifecycle.test.ts
```

Expected: FAIL because the current function trusts every `downgrade` relation.

- [ ] **Step 3: Add a canonical-contract fail-closed guard**

Extend the full lifecycle argument to include `contract` and block only an impossible scheduled downgrade:

```ts
lifecycle:
  | WalletSelfSubscriptionData['capabilities']
  | Pick<WalletSelfSubscriptionData, 'capabilities' | 'migration' | 'contract'>
```

After `hasLifecycle` is calculated and before returning a relation action:

```ts
if (
  hasLifecycle &&
  planRecord.relation === 'downgrade' &&
  lifecycle.contract?.payment_mode !== 'stripe_recurring'
) {
  return 'unavailable'
}
```

This is a defense-in-depth check on the backend-provided contract invariant, not a client-side rank calculation. Capability-only callers retain their existing behavior.

- [ ] **Step 4: Run wallet tests, typecheck, and formatting checks and verify GREEN**

Run from `web/default`:

```powershell
bun test src/features/wallet/lib/subscription-plan-lifecycle.test.ts
bun run typecheck
bun run format:check -- src/features/wallet/lib/subscription-plan-lifecycle.ts src/features/wallet/lib/subscription-plan-lifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add web/default/src/features/wallet/lib/subscription-plan-lifecycle.ts web/default/src/features/wallet/lib/subscription-plan-lifecycle.test.ts
git commit -m "Keep one-period subscribers out of the downgrade flow" -m "Constraint: Only canonical Stripe recurring contracts can schedule a next-period plan." -m "Rejected: Trusting stale rank relations alone | mixed-version deployments can still expose an invalid action." -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: Do not reintroduce client-side rank comparison." -m "Tested: Wallet lifecycle unit tests, TypeScript typecheck, and formatting checks." -m "Not-tested: Manual browser interaction."
```

### Task 4: Verify the integrated change and prepare the PR

**Files:**
- Verify only: all files changed by Tasks 1-3

- [ ] **Step 1: Run focused regression tests**

```powershell
go test ./service -run 'TestBalanceOnePeriodUpgradeToStripeRecurring|TestPaidInvoiceForBalanceToStripeUpgrade|TestBalanceDowngradeDoesNotApplyImmediately|TestStripeDowngrade|TestStripeSubscriptionUpgrade|TestStripeUpgradeReplay' -count=1
go test ./controller -run 'TestGetSubscriptionPlansAnnotatesTierRankAndRelation|TestSubscriptionPlanRelationOnlyOffersDowngradeForActiveStripeRecurring' -count=1
Set-Location web/default
bun test src/features/wallet/lib/subscription-plan-lifecycle.test.ts
bun run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 2: Run package-level and static verification**

```powershell
Set-Location ../..
go test ./service ./controller -count=1
go vet ./service ./controller
Set-Location web/default
bun run lint
bun run format:check
Set-Location ../..
git diff --check origin/main...HEAD
git status --short
```

Expected: tests, vet, lint, formatting, and diff checks exit 0; status contains only intended committed changes.

- [ ] **Step 3: Review the diff against lifecycle invariants**

Confirm all of the following from code and test evidence:

- One-period-to-Stripe upgrade creates one pending Stripe order and one Checkout session per request.
- Replaying the same request returns the same intent and persisted Checkout URL.
- The old entitlement and payment mode remain unchanged until a verified paid invoice.
- Paid invoice reconciliation archives the old entitlement as `upgraded`, creates the Stripe binding, and rotates the contract.
- Recurring-to-recurring upgrades still update the existing bound subscription item.
- One-period lower tiers are `unavailable`; active bound Stripe recurring lower tiers remain `downgrade`.
- Direct one-period downgrade requests are rejected before side effects with an accurate message.

- [ ] **Step 4: Request code review and fix every Critical or Important issue**

Dispatch a `code-reviewer` with `origin/main` as the base and `HEAD` as the review target. Re-run the affected focused tests after every accepted change.

- [ ] **Step 5: Push and create a separate PR**

Push `fix/subscription-balance-stripe-transition` and create a PR against `main`. The PR body must include the production symptoms, the distinction from #496, the RED/GREEN tests, and the remaining gap that live Stripe Test Clock was not executed.
