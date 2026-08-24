# Single Subscription Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce one subscription contract and one current entitlement per user, with immediate full-price upgrades, end-of-period downgrades, Stripe recurring renewal, one-period balance purchases, cancellation, grace handling, and a single-plan wallet UI.

**Architecture:** Reuse the provider-neutral recurring binding, webhook lease, cancellation, and reconciliation code from `feat/stripe-subscription-cancellation`. Add a user-unique contract as the aggregate root, rotate immutable entitlement snapshots transactionally, and serialize plan-change intents by contract version. Stripe objects are confirmed with provider GET calls before local state changes; only a paid invoice or an atomic balance debit grants a fresh entitlement.

**Tech Stack:** Go 1.22, Gin, GORM, SQLite/MySQL/PostgreSQL, stripe-go v81, React/TypeScript, TanStack Query, shadcn/ui, Bun/Vite, YAML i18n.

---

### Task 1: Integrate the recurring cancellation foundation

**Files:**
- Merge commits: `47fd4aa6a..24f5123cf`
- Verify: `model/subscription_recurring_test.go`
- Verify: `service/stripe_subscription_lifecycle_test.go`
- Verify: `controller/subscription_stripe_lifecycle_test.go`

- [ ] **Step 1: Cherry-pick the reviewed cancellation series**

```powershell
git cherry-pick 47fd4aa6a 6a2e7a9f4 fd18c3dc7 1b57388b6 153b0ba00 4570c2297 b618a064b 24f5123cf
```

Expected: eight commits apply without introducing a second provider-binding model.

- [ ] **Step 2: Run the focused foundation tests**

Run: `go test ./model ./service ./controller ./router`

Expected: PASS.

- [ ] **Step 3: Verify the frontend contract**

Run: `cd web/default; bun run typecheck`

Expected: exit code 0 and no Stripe subscription ID exposed in user-facing types.

### Task 2: Add the contract, change-intent, tier reservation, and entitlement constraints

**Files:**
- Create: `model/subscription_contract.go`
- Create: `model/subscription_contract_test.go`
- Modify: `model/subscription.go`
- Modify: `model/main.go`

- [ ] **Step 1: Write failing migration and uniqueness tests**

```go
func TestSubscriptionContractConstraints(t *testing.T) {
    withTestDB(t, func(db *gorm.DB) {
        require.NoError(t, migrateSubscriptionLifecycle(db))
        c1 := UserSubscriptionContract{UserID: 7, Status: ContractStatusEnded}
        c2 := UserSubscriptionContract{UserID: 7, Status: ContractStatusEnded}
        require.NoError(t, db.Create(&c1).Error)
        require.Error(t, db.Create(&c2).Error)
    })
}

func TestOnlyOneCurrentEntitlementPerContract(t *testing.T) {
    one := 1
    first := UserSubscription{ContractId: 11, CurrentSlot: &one}
    second := UserSubscription{ContractId: 11, CurrentSlot: &one}
    require.NoError(t, DB.Create(&first).Error)
    require.Error(t, DB.Create(&second).Error)
}
```

- [ ] **Step 2: Run the tests and observe the missing schema**

Run: `go test ./model -run 'TestSubscriptionContractConstraints|TestOnlyOneCurrentEntitlementPerContract' -count=1`

Expected: FAIL because the lifecycle tables/fields do not exist.

- [ ] **Step 3: Define the aggregate and intent types**

```go
type UserSubscriptionContract struct {
    Id                       int64  `gorm:"primaryKey"`
    UserID                   int    `gorm:"uniqueIndex;not null"`
    Status                   string `gorm:"index;not null"`
    PaymentMode              string `gorm:"not null"`
    CurrentPlanID            int64
    CurrentEntitlementID     int64
    CurrentProviderBindingID int64
    LatestChangeIntentID     int64
    PendingPlanID            int64
    PendingEffectiveAt       int64
    CurrentPeriodStart       int64
    CurrentPeriodEnd         int64
    GracePeriodEnd           int64
    ChangeVersion            int64
    BaseUserGroup            string
    CreatedAt                int64
    UpdatedAt                int64
}

type SubscriptionChangeIntent struct {
    Id                       int64 `gorm:"primaryKey"`
    ContractID               int64 `gorm:"index;not null"`
    UserID                   int   `gorm:"uniqueIndex:idx_change_request,priority:1"`
    RequestID                string `gorm:"uniqueIndex:idx_change_request,priority:2;size:128"`
    ChangeVersion            int64
    Kind, PaymentMode, Status string
    FromPlanID, ToPlanID      int64
    ProviderBindingID         int64
    ProviderInvoiceID         string
    ProviderScheduleID        string
    ProviderIdempotencyKey    string
    PreviousScheduleSnapshot  string
    WalletDebitTradeNo        string
    EffectiveAt, SupersededByID int64
    LastError                 string
    CreatedAt, UpdatedAt      int64
}

type SubscriptionTierRankReservation struct {
    TierRank int `gorm:"primaryKey;type:int"`
    ActivePlanId int `gorm:"uniqueIndex;not null"`
}
```

Persist only the accepted lifecycle vocabulary:

```go
const (
    ContractActive = "active"
    ContractGrace = "grace"
    ContractEnded = "ended"
    ContractNeedsAttention = "needs_attention"
    PaymentStripeRecurring = "stripe_recurring"
    PaymentBalanceOnePeriod = "balance_one_period"
    PaymentExternalOnePeriod = "external_one_period"
)
```

Intent kinds are `purchase`, `upgrade`, `downgrade`, `cancel`, `resume`, and `terminate`; statuses are `created`, `syncing`, `awaiting_payment`, `scheduled`, `applied`, `failed`, `expired`, `superseded`, and `compensation_required`.

Add nullable rank to `SubscriptionPlan`; legacy/unconfigured plans must persist SQL `NULL`, not `0`:

```go
TierRank *int `json:"tier_rank" gorm:"type:int;index"`
```

Add to `UserSubscription`:

```go
ContractId       int64   `gorm:"uniqueIndex:idx_contract_current_slot,priority:1"`
ProviderBindingId int64
GrantKey         *string `gorm:"type:varchar(255);uniqueIndex"`
CurrentSlot      *int    `gorm:"type:int;uniqueIndex:idx_contract_current_slot,priority:2"`
AccessEndTime    int64
EndReason        string
```

Extend the cancellation branch's provider binding so contract routing and same-item Stripe upgrades are explicit:

```go
ContractId                    int64  `json:"contract_id" gorm:"index"`
ProviderSubscriptionItemId    string `json:"-" gorm:"type:varchar(128);default:''"`
ProviderScheduleId            string `json:"-" gorm:"type:varchar(128);default:''"`
```

Extend `ProviderSubscriptionSnapshot` with the same item and schedule IDs and populate them only from a freshly retrieved Stripe Subscription/Schedule. These provider IDs remain excluded from authenticated user DTOs.

- [ ] **Step 4: Register all lifecycle models in the existing AutoMigrate path**

```go
err := DB.AutoMigrate(
    &UserSubscriptionContract{},
    &SubscriptionChangeIntent{},
    &SubscriptionTierRankReservation{},
    &SubscriptionProviderBinding{},
    &PaymentWebhookEvent{},
)
```

- [ ] **Step 5: Run model tests across SQLite and configured MySQL/PostgreSQL suites**

Run: `go test ./model -run 'TestSubscriptionContractConstraints|TestOnlyOneCurrentEntitlementPerContract' -count=1`

Expected: PASS; nullable unique columns persist `NULL`, never `0` or empty strings.

- [ ] **Step 6: Commit**

```text
Reserve one subscription aggregate per user

Constraint: Current entitlement uniqueness must work on SQLite, MySQL, and PostgreSQL.
Rejected: Partial unique indexes | unsupported consistently across the three target databases
Confidence: high
Scope-risk: moderate
Directive: Keep current_slot and grant_key nullable at the SQL boundary.
Tested: go test ./model -run TestSubscriptionContract -count=1
```

### Task 3: Make plan rank and lifecycle-critical fields immutable

**Files:**
- Modify: `model/subscription.go`
- Modify: `controller/subscription.go`
- Create: `model/subscription_plan_lifecycle_test.go`

- [ ] **Step 1: Write failing plan validation tests**

```go
func TestReferencedPlanCannotChangeLifecycleFields(t *testing.T) {
    plan, contract := seedReferencedPlan(t, 10)
    update := *plan
    update.TierRank = 20
    err := UpdateSubscriptionPlan(&update)
    require.ErrorIs(t, err, ErrSubscriptionPlanLifecycleFieldsImmutable)
    require.NotZero(t, contract.Id)
}

func TestTierRankReservationMovesBetweenActivePlanVersions(t *testing.T) {
    old := seedPlan(t, 10, false)
    require.NoError(t, SetSubscriptionPlanEnabled(old.Id, true))
    staged := seedPlan(t, 10, false)
    require.ErrorIs(t, SetSubscriptionPlanEnabled(staged.Id, true), ErrSubscriptionTierRankReserved)
    require.NoError(t, SetSubscriptionPlanEnabled(old.Id, false))
    require.NoError(t, SetSubscriptionPlanEnabled(staged.Id, true))
}
```

- [ ] **Step 2: Run and verify the tests fail**

Run: `go test ./model -run 'TestReferencedPlan|TestTierRankReservation' -count=1`

Expected: FAIL because plans currently have neither `tier_rank` nor reservation validation.

- [ ] **Step 3: Add rank and immutable-field comparison**

```go
func lifecycleFieldsChanged(before, after *SubscriptionPlan) bool {
    return before.TierRank != after.TierRank ||
        before.Duration != after.Duration ||
        before.DurationUnit != after.DurationUnit ||
        before.TotalAmount != after.TotalAmount ||
        before.StripePriceId != after.StripePriceId ||
        before.UpgradeGroup != after.UpgradeGroup
}
```

For enabled plans, occupy `SubscriptionTierRankReservation` in the same transaction as creation/enabling; disabling releases only the reservation owned by that plan. Disabled historical and staged versions may share a rank, while only one enabled plan can own its reservation. Reject lifecycle-field edits when any contract, entitlement, order, or intent references the plan. Keep name, description, display price, ordering, and enabled state editable.

- [ ] **Step 4: Run tests and commit**

Run: `go test ./model ./controller -run 'Plan|Subscription' -count=1`

Expected: PASS.

```text
Protect plan identity across subscription history

Constraint: Rank determines upgrade and downgrade semantics for the life of a contract.
Rejected: Permanently reserving disabled ranks | prevents version replacement required by the accepted design
Confidence: high
Scope-risk: narrow
Tested: go test ./model ./controller -run Plan -count=1
```

### Task 4: Rotate the single current entitlement transactionally

**Files:**
- Create: `model/subscription_entitlement.go`
- Create: `model/subscription_entitlement_test.go`
- Modify: `model/subscription.go`
- Modify: `service/funding_source.go`
- Modify: `service/billing_session.go`

- [ ] **Step 1: Write failing rotation and consumption tests**

```go
func TestRotateCurrentEntitlementArchivesOldRow(t *testing.T) {
    old := seedCurrentEntitlement(t, 3, 1000, 200)
    next, err := RotateCurrentEntitlement(GrantEntitlementInput{
        ContractID: 3, PlanID: 9, GrantKey: "stripe:in_2",
        AmountTotal: 2000, PeriodStart: 200, PeriodEnd: 300,
        EndReasonForPrevious: "renewed",
    })
    require.NoError(t, err)
    require.EqualValues(t, 0, next.AmountUsed)
    require.Nil(t, reloadEntitlement(t, old.Id).CurrentSlot)
    require.Equal(t, "renewed", reloadEntitlement(t, old.Id).EndReason)
}

func TestGraceUsesAccessEndWithoutChangingPaidPeriod(t *testing.T) {
    ent := seedEntitlement(t, 100, 103)
    require.True(t, entitlementUsableAt(ent, 102))
    require.EqualValues(t, 100, ent.EndTime)
}
```

- [ ] **Step 2: Run and observe failures**

Run: `go test ./model ./service -run 'RotateCurrentEntitlement|GraceUsesAccessEnd' -count=1`

Expected: FAIL because consumption still scans active subscriptions and checks `end_time` only.

- [ ] **Step 3: Implement one transaction for entitlement rotation**

```go
func RotateCurrentEntitlement(in GrantEntitlementInput) (*UserSubscription, error) {
    var created UserSubscription
    err := DB.Transaction(func(tx *gorm.DB) error {
        var contract UserSubscriptionContract
        if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&contract, in.ContractID).Error; err != nil { return err }
        if in.GrantKey != "" {
            var existing UserSubscription
            if err := tx.Where("grant_key = ?", in.GrantKey).First(&existing).Error; err == nil { created = existing; return nil }
        }
        if contract.CurrentEntitlementID != 0 {
            if err := tx.Model(&UserSubscription{}).Where("id = ?", contract.CurrentEntitlementID).
                Updates(map[string]any{"current_slot": nil, "end_reason": in.EndReasonForPrevious}).Error; err != nil { return err }
        }
        slot, grant := 1, in.GrantKey
        created = UserSubscription{ContractId: in.ContractID, PlanId: in.PlanID, GrantKey: &grant, CurrentSlot: &slot, AmountTotal: in.AmountTotal, StartTime: in.PeriodStart, EndTime: in.PeriodEnd, AccessEndTime: in.PeriodEnd}
        if err := tx.Create(&created).Error; err != nil { return err }
        return tx.Model(&contract).Updates(map[string]any{"current_entitlement_id": created.Id, "current_plan_id": in.PlanID, "current_period_start": in.PeriodStart, "current_period_end": in.PeriodEnd}).Error
    })
    return &created, err
}
```

- [ ] **Step 4: Read funding from the contract pointer**

Replace active-list accumulation with a locked/read-only lookup of `contract.current_entitlement_id`, and accept it only when `access_end_time > now`. Preserve the existing billing preference ordering between the one subscription source and wallet balance. Existing and newly created API keys use the same user-level funding lookup; no key recreation is required.

- [ ] **Step 5: Run tests and commit**

Run: `go test ./model ./service -run 'Subscription|Funding|BillingSession' -count=1`

Expected: PASS and no path sums two subscription entitlements.

```text
Make one entitlement the subscription funding source

Constraint: In-flight reservations remain attached to the entitlement ID they pre-consumed.
Rejected: Mutating the existing entitlement on renewal | destroys period-level audit history
Confidence: high
Scope-risk: broad
Directive: Never infer a new grant from elapsed time; require a paid invoice or atomic balance debit.
Tested: go test ./model ./service -run Subscription -count=1
```

### Task 5: Implement the single-contract command service and balance one-period purchase

**Files:**
- Create: `service/subscription_contract.go`
- Create: `service/subscription_contract_test.go`
- Modify: `controller/subscription.go`
- Modify: `router/api-router.go`

- [ ] **Step 1: Write failing idempotency and balance purchase tests**

```go
func TestBalancePurchaseCreatesOnePeriodWithoutBinding(t *testing.T) {
    result, err := ChangeSubscriptionPlan(ChangePlanCommand{UserID: 7, PlanID: 2, PaymentMode: PaymentModeBalanceOnePeriod, RequestID: "req-1"})
    require.NoError(t, err)
    require.Equal(t, ContractStatusActive, result.Contract.Status)
    require.Zero(t, result.Contract.CurrentProviderBindingID)
}

func TestSameRequestReturnsSameIntent(t *testing.T) {
    a, _ := ChangeSubscriptionPlan(command("stable-id"))
    b, _ := ChangeSubscriptionPlan(command("stable-id"))
    require.Equal(t, a.Intent.Id, b.Intent.Id)
}
```

- [ ] **Step 2: Run and observe missing command service**

Run: `go test ./service -run 'BalancePurchase|SameRequest' -count=1`

Expected: FAIL because `ChangeSubscriptionPlan` is undefined.

- [ ] **Step 3: Define the command and response contract**

```go
type ChangePlanCommand struct { UserID, PlanID int; PaymentMode, RequestID string }
type ChangePlanResult struct {
    Status string
    Contract *model.UserSubscriptionContract
    Intent *model.SubscriptionChangeIntent
    CheckoutURL string
    HostedInvoiceURL string
}
```

Route all purchase/upgrade/downgrade requests through `ChangeSubscriptionPlan`. Lock the user row and contract, return the existing intent for `(user_id, request_id)`, reject equal rank, and reject a second unresolved purchase/upgrade. For balance purchase, debit the full plan price, create the success order, rotate the entitlement, set `payment_mode=balance_one_period`, and never create a provider binding.

- [ ] **Step 4: Add the authenticated command route**

```go
self.POST("/change-plan", controller.ChangeSubscriptionPlan)
```

The handler validates UUID-like `request_id`, authenticated user ownership, enabled target plan, and an explicit payment mode; it returns `applied`, `scheduled`, `checkout_required`, `payment_action_required`, or the prior terminal intent result.

- [ ] **Step 5: Run tests and commit**

Run: `go test ./service ./controller ./router -run 'Subscription|ChangePlan|BalancePurchase' -count=1`

Expected: PASS.

```text
Serialize subscription purchases through one contract

Constraint: Wallet payment buys exactly one period and never renews automatically.
Rejected: Reusing legacy direct purchase handlers | they allow independent active entitlements
Confidence: high
Scope-risk: broad
Tested: go test ./service ./controller ./router -run ChangePlan -count=1
```

### Task 6: Close Stripe Checkout purchase and first-invoice races

**Files:**
- Modify: `controller/subscription_payment_stripe.go`
- Modify: `controller/topup_stripe.go`
- Modify: `model/subscription.go`
- Create: `service/subscription_invoice.go`
- Create: `service/subscription_invoice_test.go`

- [ ] **Step 1: Write failing invoice-first and expired-session tests**

```go
func TestInvoicePaidLocatesPurchaseFromSubscriptionMetadata(t *testing.T) {
    stripeStub.Subscription.Metadata = map[string]string{"contract_id":"12", "change_intent_id":"34", "trade_no":"T1", "plan_id":"8", "user_id":"7"}
    require.NoError(t, ReconcilePaidInvoice(context.Background(), "in_first"))
    require.Equal(t, "stripe:in_first", deref(reloadCurrentEntitlement(t, 12).GrantKey))
}

func TestExpiredCheckoutReleasesPendingPurchase(t *testing.T) {
    require.NoError(t, ReconcileExpiredCheckout(context.Background(), "cs_expired"))
    require.Equal(t, IntentStatusExpired, reloadIntent(t).Status)
    require.Zero(t, reloadContract(t).LatestChangeIntentID)
}
```

- [ ] **Step 2: Run and observe failures**

Run: `go test ./service ./controller -run 'InvoicePaidLocatesPurchase|ExpiredCheckout' -count=1`

Expected: FAIL because the old flow depends on Checkout completion order.

- [ ] **Step 3: Attach authoritative metadata to Session and Subscription**

```go
metadata := map[string]string{
    "trade_no": order.TradeNo, "user_id": strconv.Itoa(userID),
    "plan_id": strconv.FormatInt(plan.Id, 10),
    "contract_id": strconv.FormatInt(contract.Id, 10),
    "change_intent_id": strconv.FormatInt(intent.Id, 10),
}
params.Metadata = metadata
params.SubscriptionData = &stripe.CheckoutSessionSubscriptionDataParams{Metadata: metadata}
```

- [ ] **Step 4: Reconcile both webhook paths through one paid-invoice function**

`invoice.paid` fetches Invoice and Subscription, validates paid status, customer, user, plan, price, amount, currency, livemode, contract, intent, and binding, then calls `RotateCurrentEntitlement` with `grant_key=stripe:<invoice_id>`. `checkout.session.completed` resolves its invoice and invokes the same function. `checkout.session.expired` and `checkout.session.async_payment_failed` atomically terminate the pending order/intent and release the contract pointer.

- [ ] **Step 5: Run race/idempotency tests and commit**

Run: `go test ./model ./service ./controller -run 'Checkout|Invoice|Webhook|GrantKey' -count=1`

Expected: PASS under duplicate and reversed delivery order.

```text
Grant Stripe subscriptions from paid invoice facts

Constraint: invoice.paid may arrive before checkout.session.completed.
Rejected: Using Checkout Session as the mandatory grant input | delivery order is not guaranteed
Confidence: high
Scope-risk: broad
Directive: Always GET Subscription and Invoice before granting.
Tested: go test ./model ./service ./controller -run 'Checkout|Invoice|Webhook' -count=1
```

### Task 7: Harden webhook processing leases and recurring reconciliation

**Files:**
- Modify: `model/subscription_recurring.go`
- Modify: `service/subscription_reconciliation_task.go`
- Modify: `controller/topup_stripe.go`
- Modify: `model/subscription_recurring_test.go`

- [ ] **Step 1: Add a failing expired-lease takeover test**

```go
func TestExpiredWebhookLeaseCanBeClaimedByOneWorker(t *testing.T) {
    seedProcessingEvent(t, "evt_1", time.Now().Add(-time.Minute))
    a, _ := ClaimPaymentWebhookEventProcessing("stripe", "evt_1", "worker-a", time.Now().Add(time.Minute))
    b, _ := ClaimPaymentWebhookEventProcessing("stripe", "evt_1", "worker-b", time.Now().Add(time.Minute))
    require.True(t, a)
    require.False(t, b)
}
```

- [ ] **Step 2: Run the test**

Run: `go test ./model -run TestExpiredWebhookLeaseCanBeClaimedByOneWorker -count=1`

Expected: FAIL if claim is not a single conditional update.

- [ ] **Step 3: Claim with one conditional update and reconcile stuck work**

```go
result := tx.Model(&PaymentWebhookEvent{}).
    Where("provider = ? AND event_id = ? AND status <> ? AND (processing_until IS NULL OR processing_until < ?)", provider, eventID, WebhookProcessed, now).
    Updates(map[string]any{"status": WebhookProcessing, "processing_token": token, "processing_until": until, "attempt_count": gorm.Expr("attempt_count + 1")})
claimed := result.Error == nil && result.RowsAffected == 1
```

Reconciliation scans expired leases, unresolved intents, inconsistent binding/contract pointers, pending purchases, grace deadlines, and schedule drift. It chooses a result only after Stripe GET calls.

- [ ] **Step 4: Run and commit**

Run: `go test ./model ./service ./controller -run 'Webhook|Reconciliation|Lease' -count=1`

Expected: PASS.

```text
Let one worker recover stalled subscription events

Constraint: Providers retry events and workers can die after claiming them.
Rejected: Permanent event-ID locks | a crashed worker would block recovery forever
Confidence: high
Scope-risk: moderate
Tested: go test ./model ./service ./controller -run 'Webhook|Reconciliation|Lease' -count=1
```

### Task 8: Apply renewals and the three-day payment-failure grace period

**Files:**
- Modify: `service/subscription_invoice.go`
- Modify: `service/subscription_reconciliation_task.go`
- Modify: `controller/topup_stripe.go`
- Create: `service/subscription_grace_test.go`

- [ ] **Step 1: Write failing renewal and grace tests**

```go
func TestPaidRenewalGrantsFullFreshEntitlement(t *testing.T) {
    old := seedCurrentEntitlement(t, 12, 1000, 700)
    require.NoError(t, ReconcilePaidInvoice(ctx, "in_renew"))
    current := reloadContractEntitlement(t, 12)
    require.EqualValues(t, 0, current.AmountUsed)
    require.EqualValues(t, 1000, current.AmountTotal)
    require.Equal(t, "renewed", reloadEntitlement(t, old.Id).EndReason)
}

func TestPaymentFailureExtendsAccessOnly(t *testing.T) {
    oldEnd := current.EndTime
    require.NoError(t, ReconcileFailedInvoice(ctx, "in_failed"))
    current = reloadEntitlement(t, current.Id)
    require.EqualValues(t, oldEnd, current.EndTime)
    require.EqualValues(t, oldEnd+3*24*3600, current.AccessEndTime)
}
```

- [ ] **Step 2: Run and observe failures**

Run: `go test ./service ./controller -run 'PaidRenewal|PaymentFailure' -count=1`

Expected: FAIL until paid and failed invoices share the contract lifecycle.

- [ ] **Step 3: Implement verified renewal and grace transitions**

For `invoice.paid`, GET the Invoice and Subscription and rotate a complete target-plan grant. For `invoice.payment_failed`, GET both objects, retain the old `amount_used` and `end_time`, set `access_end_time=end_time+72h`, and mark the contract `grace`. At grace deadline, GET again: if paid, use the paid path; otherwise cancel the exact subscription, stop collection for its invoices, archive the entitlement, and end the contract.

- [ ] **Step 4: Run and commit**

Run: `go test ./service ./controller -run 'Renewal|Grace|PaymentFailed|InvoicePaid' -count=1`

Expected: PASS.

```text
Bound failed renewals to a three-day grace window

Constraint: Grace may spend only the prior period's remaining entitlement.
Rejected: Creating provisional renewal credit | permits unpaid quota consumption
Confidence: high
Scope-risk: broad
Tested: go test ./service ./controller -run 'Renewal|Grace|PaymentFailed' -count=1
```

### Task 9: Upgrade the same Stripe subscription immediately

**Files:**
- Create: `service/subscription_upgrade.go`
- Create: `service/subscription_upgrade_test.go`
- Modify: `service/subscription_contract.go`
- Modify: `service/stripe_subscription_lifecycle.go`

- [ ] **Step 1: Write failing parameter and pending-payment tests**

```go
func TestStripeUpgradeReplacesExistingItemAndResetsCycle(t *testing.T) {
    stripeClient.ExpectSubscriptionUpdate("sub_1", func(p *stripe.SubscriptionParams) {
        require.Equal(t, stripe.Bool(true), p.BillingCycleAnchorNow)
        require.Equal(t, stripe.String("pending_if_incomplete"), p.PaymentBehavior)
        require.Equal(t, stripe.String("none"), p.ProrationBehavior)
        require.Equal(t, "si_1", stripe.StringValue(p.Items[0].ID))
        require.Equal(t, "price_high", stripe.StringValue(p.Items[0].Price))
    })
    _, err := UpgradeStripeContract(ctx, contractID, targetPlanID, intentID)
    require.NoError(t, err)
}
```

- [ ] **Step 2: Run and observe the missing upgrade service**

Run: `go test ./service -run TestStripeUpgradeReplacesExistingItemAndResetsCycle -count=1`

Expected: FAIL because `UpgradeStripeContract` is undefined.

- [ ] **Step 3: Update the existing item with the approved Stripe parameters**

```go
params := &stripe.SubscriptionParams{
    BillingCycleAnchorNow: stripe.Bool(true),
    PaymentBehavior: stripe.String("pending_if_incomplete"),
    ProrationBehavior: stripe.String("none"),
    Items: []*stripe.SubscriptionItemsParams{{
        ID: stripe.String(binding.ProviderSubscriptionItemID),
        Price: stripe.String(target.StripePriceId),
        Quantity: stripe.Int64(1),
    }},
}
params.SetIdempotencyKey(fmt.Sprintf("subscription-upgrade:%d:%d:%d", contract.Id, intent.ChangeVersion, target.Id))
```

Never omit the current item ID. Save and release any pending downgrade schedule before updating. A verified paid upgrade rotates to a full target entitlement and resets the period; `pending_update`/3DS returns an authenticated hosted invoice URL and leaves the old plan untouched. Expired pending updates restore the saved schedule or set `needs_attention` until reconciliation succeeds.

- [ ] **Step 4: Run and commit**

Run: `go test ./service ./controller -run 'Upgrade|PendingUpdate|ChangePlan' -count=1`

Expected: PASS including cancellation-at-period-end restoration only after successful upgrade.

```text
Restart the billing cycle on full-price upgrades

Constraint: Upgrade replaces the only existing Stripe item and charges a complete target period.
Rejected: Creating a second Stripe subscription | can double-renew one user
Confidence: high
Scope-risk: broad
Directive: Keep pending updates local-state neutral until a paid invoice is verified.
Tested: go test ./service ./controller -run 'Upgrade|PendingUpdate' -count=1
```

### Task 10: Schedule end-of-period downgrade with last-choice-wins semantics

**Files:**
- Create: `service/subscription_downgrade.go`
- Create: `service/subscription_downgrade_test.go`
- Modify: `service/subscription_contract.go`
- Modify: `service/subscription_reconciliation_task.go`

- [ ] **Step 1: Write failing schedule and supersession tests**

```go
func TestLatestDowngradeSelectionWins(t *testing.T) {
    first, _ := ScheduleDowngrade(ctx, contractID, proPlanID, "req-1")
    second, _ := ScheduleDowngrade(ctx, contractID, goPlanID, "req-2")
    require.Equal(t, IntentStatusSuperseded, reloadIntent(t, first.Id).Status)
    require.EqualValues(t, goPlanID, reloadContract(t).PendingPlanID)
    require.EqualValues(t, second.Id, reloadContract(t).LatestChangeIntentID)
}
```

- [ ] **Step 2: Run and observe failure**

Run: `go test ./service -run TestLatestDowngradeSelectionWins -count=1`

Expected: FAIL because schedule orchestration is absent.

- [ ] **Step 3: Create/update one Subscription Schedule**

```go
params := &stripe.SubscriptionScheduleParams{
    EndBehavior: stripe.String("release"),
    Phases: []*stripe.SubscriptionSchedulePhaseParams{
        {StartDate: stripe.Int64(currentStart), EndDate: stripe.Int64(currentEnd), Items: []*stripe.SubscriptionSchedulePhaseItemParams{{Price: stripe.String(currentPrice), Quantity: stripe.Int64(1)}}},
        {StartDate: stripe.Int64(currentEnd), EndDate: stripe.Int64(currentEnd+targetDuration), Items: []*stripe.SubscriptionSchedulePhaseItemParams{{Price: stripe.String(targetPrice), Quantity: stripe.Int64(1)}}},
    },
}
```

Lock the contract, increment `change_version`, supersede the prior downgrade intent, update the sole pending plan/effective time, and serialize Stripe writes. Re-read the version before and after each write; if stale, converge the schedule to the newest plan. Do not rotate entitlement when the schedule changes price; wait for the target invoice to be paid.

- [ ] **Step 4: Run and commit**

Run: `go test ./service ./controller -run 'Downgrade|Schedule|Superseded' -count=1`

Expected: PASS under concurrent different target selections.

```text
Apply only the latest requested downgrade at renewal

Constraint: Current-period quota and price remain unchanged until the paid renewal invoice.
Rejected: Stacking downgrade purchases | violates one-contract ownership
Confidence: high
Scope-risk: broad
Tested: go test ./service ./controller -run 'Downgrade|Schedule' -count=1
```

### Task 11: Coordinate cancel/resume and Stripe-to-balance compensation

**Files:**
- Modify: `service/stripe_subscription_lifecycle.go`
- Modify: `service/subscription_contract.go`
- Create: `service/subscription_compensation.go`
- Create: `service/subscription_compensation_test.go`

- [ ] **Step 1: Write failing cancellation and compensation tests**

```go
func TestCancelReleasesPendingDowngradeBeforePeriodEndCancel(t *testing.T) {
    require.NoError(t, CancelContractRecurring(ctx, userID, contractID))
    require.Empty(t, stripeStub.SubscriptionScheduleID)
    require.True(t, stripeStub.CancelAtPeriodEnd)
    require.Zero(t, reloadContract(t).PendingPlanID)
}

func TestStripeToBalanceUnknownCancelDoesNotRefundOrGrant(t *testing.T) {
    result, err := UpgradeStripeToBalance(ctx, command)
    require.ErrorIs(t, err, ErrProviderResultUnknown)
    require.Equal(t, ContractStatusNeedsAttention, result.Contract.Status)
    require.False(t, walletRefunded(t, result.Intent.WalletDebitTradeNo))
    require.Equal(t, oldEntitlementID, result.Contract.CurrentEntitlementID)
}
```

- [ ] **Step 2: Run and observe failures**

Run: `go test ./service -run 'CancelReleasesPending|StripeToBalanceUnknown' -count=1`

Expected: FAIL until cancellation owns schedule coordination and the compensation saga exists.

- [ ] **Step 3: Extend precise binding cancellation**

Only operate when `binding.contract_id`, `contract.current_provider_binding_id`, and authenticated `user_id` match. Save and release downgrade schedule before `cancel_at_period_end=true`; clear local pending downgrade only after Stripe confirms. Resume clears period-end cancellation, but does not recreate a deliberately canceled downgrade.

- [ ] **Step 4: Implement Stripe-to-balance upgrade as a reconciled saga**

Debit balance first under a unique trade number without rotating entitlement. Release schedule, cancel the exact Stripe subscription immediately with `invoice_now=false` and `prorate=false`, then GET the subscription. If still active, restore the schedule and idempotently refund. If canceled, never refund; retry local rotation to the high balance plan. Unknown results set `needs_attention` and reconciliation alone selects one terminal branch.

- [ ] **Step 5: Run and commit**

Run: `go test ./service ./controller -run 'Cancel|Resume|Compensation|StripeToBalance' -count=1`

Expected: PASS.

```text
Keep cancellation and payment conversion convergent

Constraint: Only Stripe recurring subscriptions support user cancellation and automatic renewal.
Rejected: Refunding on cancel timeout | may leave a free balance entitlement after a successful remote cancel
Confidence: high
Scope-risk: broad
Tested: go test ./service ./controller -run 'Cancel|Resume|Compensation' -count=1
```

### Task 12: Migrate legacy conflicts behind an audit and feature gate

**Files:**
- Create: `service/subscription_migration.go`
- Create: `service/subscription_migration_test.go`
- Modify: `common/option.go`
- Modify: `controller/subscription.go`

- [ ] **Step 1: Write failing classification tests**

```go
func TestLegacyMigrationQuarantinesMultipleRecurring(t *testing.T) {
    seedLegacyRecurring(t, userID, "sub_a")
    seedLegacyRecurring(t, userID, "sub_b")
    result, err := AuditLegacySubscriptions(userID)
    require.NoError(t, err)
    require.Equal(t, MigrationConflictMultipleRecurring, result.Classification)
    require.Empty(t, result.CreatedContractID)
}
```

- [ ] **Step 2: Run and observe failure**

Run: `go test ./service -run TestLegacyMigrationQuarantinesMultipleRecurring -count=1`

Expected: FAIL because the migration classifier is undefined.

- [ ] **Step 3: Implement audit, safe backfill, and explicit conflict resolution**

Classify no-active, one verified recurring, one one-period entitlement, multiple active entitlements, multiple recurring bindings, missing binding, and group ambiguity. Auto-backfill only the unique verified cases. Conflict users keep the precise `binding_id` cancellation UI but cannot use the new plan-change command until an administrator selects the retained binding/entitlement and handles the others. Gate the write path with `SubscriptionSingleContractEnabled` and emit counters per classification.

- [ ] **Step 4: Run and commit**

Run: `go test ./service ./controller -run 'Migration|Legacy|FeatureGate' -count=1`

Expected: PASS.

```text
Quarantine ambiguous legacy subscriptions before cutover

Constraint: Existing multiple-recurring users cannot be collapsed without an explicit business decision.
Rejected: Selecting the newest row automatically | can cancel or discard paid access silently
Confidence: high
Scope-risk: moderate
Tested: go test ./service ./controller -run 'Migration|Legacy' -count=1
```

### Task 13: Expose the single-contract API and capability model

**Files:**
- Modify: `controller/subscription.go`
- Modify: `router/api-router.go`
- Modify: `docs/openapi/api.json`
- Modify: `i18n/keys.go`
- Modify: `i18n/locales/en.yaml`
- Modify: `i18n/locales/zh-CN.yaml`
- Modify: `i18n/locales/zh-TW.yaml`

- [ ] **Step 1: Write failing response-shape tests**

```go
func TestSubscriptionSelfReturnsOneContractAndCapabilities(t *testing.T) {
    body := getSubscriptionSelf(t, userID)
    require.EqualValues(t, contractID, body.Contract.ID)
    require.Equal(t, "downgrade", body.Contract.PendingChange.Kind)
    require.True(t, body.Capabilities.CanCancel)
    require.NotContains(t, string(body.Raw), "sub_")
}
```

- [ ] **Step 2: Run and observe the old multi-subscription shape**

Run: `go test ./controller ./router -run 'SubscriptionSelf|Capabilities' -count=1`

Expected: FAIL until the new fields exist.

- [ ] **Step 3: Return the canonical DTO while retaining legacy fields during migration**

```go
type SubscriptionSelfResponse struct {
    Contract *SubscriptionContractDTO `json:"contract"`
    Capabilities SubscriptionCapabilitiesDTO `json:"capabilities"`
    Migration *SubscriptionMigrationDTO `json:"migration,omitempty"`
    Subscriptions []model.SubscriptionSummary `json:"subscriptions"`
    AllSubscriptions []model.SubscriptionSummary `json:"all_subscriptions"`
    RecurringSubscriptions []RecurringSubscriptionDTO `json:"recurring_subscriptions"`
}
```

Add `tier_rank` and `relation` (`current`, `upgrade`, `downgrade`, `unavailable`) to plan responses. Return local contract, binding, and intent IDs only. Document `POST /api/subscription/self/change-plan` request/response variants and existing cancel/resume routes in OpenAPI.

- [ ] **Step 4: Run and commit**

Run: `go test ./controller ./router -run 'Subscription|Plan' -count=1`

Expected: PASS and the response JSON never contains a Stripe subscription ID.

```text
Describe subscription choices from one current contract

Constraint: Legacy fields remain temporarily for a staged frontend migration.
Rejected: Exposing Stripe IDs | users operate through authenticated local identifiers
Confidence: high
Scope-risk: moderate
Tested: go test ./controller ./router -run Subscription -count=1
```

### Task 14: Render the wallet as one subscription lifecycle

**Files:**
- Modify: `web/default/src/features/subscriptions/types.ts`
- Modify: `web/default/src/features/subscriptions/api.ts`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.tsx`
- Create: `web/default/src/features/subscriptions/components/dialogs/change-subscription-plan-dialog.tsx`
- Modify: `web/default/src/features/subscriptions/components/dialogs/recurring-subscription-action-dialog.tsx`
- Create: `web/default/src/features/subscriptions/single-contract.typecheck.ts`

- [ ] **Step 1: Add a failing compile-time contract**

```ts
const state: SubscriptionSelf = {} as SubscriptionSelf
state.contract?.entitlement?.amount_total satisfies number
state.contract?.pending_change?.kind satisfies 'downgrade' | undefined
state.capabilities.can_upgrade satisfies boolean
const command: ChangePlanRequest = { plan_id: 3, payment_mode: 'stripe_recurring', request_id: crypto.randomUUID() }
void command
```

- [ ] **Step 2: Run typecheck and observe missing types**

Run: `cd web/default; bun run typecheck`

Expected: FAIL on `contract`, `capabilities`, and `ChangePlanRequest`.

- [ ] **Step 3: Add typed API methods**

```ts
export const changeSubscriptionPlan = (input: ChangePlanRequest) =>
  api.post<ChangePlanResponse>('/api/subscription/self/change-plan', input)
```

Generate a fresh `request_id` only when starting a new user action; retain it for retries/polling. Poll `/self` after Checkout or hosted-invoice return; never update quota optimistically.

- [ ] **Step 4: Render the approved single-plan states**

The wallet card shows current plan, remaining/current-period quota, renewal/end time, payment mode, pending downgrade, and grace warning. Each plan renders exactly one relation action: current (disabled), upgrade now, downgrade next period, or unavailable. Balance copy says “one period, no automatic renewal”; Stripe copy says “renews automatically” with cancel/resume controls. A 3DS response navigates only to the authenticated hosted invoice URL.

- [ ] **Step 5: Run and commit**

Run: `cd web/default; bun run typecheck; bun run lint; bun run build:check`

Expected: all commands exit 0.

```text
Show one current plan and one pending subscription action

Constraint: UI must not imply that balance purchases renew or that downgrade changes current quota.
Rejected: Displaying every active legacy row as purchasable | preserves the stacking mental model
Confidence: high
Scope-risk: moderate
Tested: bun run typecheck; bun run lint; bun run build:check
```

### Task 15: Finish administrator controls and all locales

**Files:**
- Modify: `web/default/src/features/subscriptions/types.ts`
- Modify: `web/default/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx`
- Modify: `web/default/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx`
- Modify: `web/default/src/i18n/static-keys.ts`
- Modify: `i18n/locales/en.yaml`
- Modify: `i18n/locales/zh-CN.yaml`
- Modify: `i18n/locales/zh-TW.yaml`
- Modify: `i18n/locales/es.yaml`
- Modify: `i18n/locales/fr.yaml`
- Modify: `i18n/locales/ja.yaml`
- Modify: `i18n/locales/pt.yaml`
- Modify: `i18n/locales/ru.yaml`
- Modify: `i18n/locales/vi.yaml`

- [ ] **Step 1: Add administrator form validation**

```ts
if (!Number.isInteger(values.tier_rank) || values.tier_rank <= 0) {
  throw new Error(t('subscription.plan.tier_rank_invalid'))
}
if (values.stripe_price_id && values.payment_modes.length === 0) {
  throw new Error(t('subscription.plan.payment_mode_required'))
}
```

Disable lifecycle-critical inputs when the backend reports the plan is referenced; direct administrators to disable/version the plan. Show the one current entitlement plus read-only history, current binding state, pending intent, grace, and migration conflict. Never offer “reactivate historical entitlement.”

- [ ] **Step 2: Synchronize and validate locale keys**

Run: `cd web/default; bun run i18n:sync`

Expected: no missing or stale keys in any locale.

- [ ] **Step 3: Run frontend verification and commit**

Run: `cd web/default; bun run typecheck; bun run lint; bun run build:check`

Expected: all commands exit 0.

```text
Keep subscription administration aligned with immutable plans

Constraint: All shipped locales must contain the new wallet and lifecycle copy.
Rejected: Allowing rank edits after sale | changes the meaning of existing contracts
Confidence: high
Scope-risk: moderate
Tested: bun run i18n:sync; bun run typecheck; bun run lint; bun run build:check
```

### Task 16: Verify three databases and the remote Stripe sandbox lifecycle

**Files:**
- Create: `docs/superpowers/test-results/2026-07-22-single-subscription-lifecycle.md`
- Verify: all files changed by Tasks 1-15

- [ ] **Step 1: Run the complete local backend suite**

Run: `go test ./...`

Expected: PASS.

- [ ] **Step 2: Run race-sensitive lifecycle packages**

Run: `go test -race ./model ./service ./controller -run 'Subscription|Webhook|Invoice|Checkout|Grace|Migration' -count=1`

Expected: PASS with no race detector findings.

- [ ] **Step 3: Run all frontend gates**

Run: `cd web/default; bun run i18n:sync; bun run typecheck; bun run lint; bun run build:check`

Expected: all commands exit 0.

- [ ] **Step 4: Run migration tests against SQLite, MySQL, and PostgreSQL**

Run the repository's database matrix with each configured DSN, then assert: one user contract, nullable unique `current_slot`, nullable unique `grant_key`, repeatable migrations, and safe legacy classification.

Expected: PASS on all three engines; record engine versions and exact commands in the test-results file.

- [ ] **Step 5: Run remote Sandbox/Test Clock E2E without starting a local user service**

Using the deployed test environment and configured sandbox credentials, test Go/Pro/Max: first Stripe purchase, automatic renewal, full-price immediate upgrade on the same `sub_xxx`, last-choice-wins scheduled downgrade, cancel/resume, failed renewal plus 72-hour grace, balance one-period expiry, duplicate/reordered webhooks, and existing/new API keys using the same current entitlement. Confirm `upgrade_group` empty preserves the user's PLG group and a configured 1.0 group removes the PLG discount.

Expected: each transition has contract/intent/binding/entitlement IDs, Stripe request/object evidence, before/after quota, and no second current entitlement or recurring binding.

- [ ] **Step 6: Record any environment-only gap and commit evidence**

```text
Prove the single-subscription lifecycle across supported environments

Constraint: Sandbox validation runs against the deployed test environment, not a locally started service.
Confidence: high
Scope-risk: broad
Tested: go test ./...; go test -race ./model ./service ./controller; bun run typecheck; bun run lint; bun run build:check; remote Stripe Test Clock matrix
Not-tested: Only entries explicitly recorded in docs/superpowers/test-results/2026-07-22-single-subscription-lifecycle.md
```
