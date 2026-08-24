# Invitation Subscription Discount Credit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace subscription-mode invitation rewards with permanent, cumulative, package-only discount credit that is granted to the invitee at referred registration, granted to the inviter after the invitee's first successful paid package, and consumed safely by every supported package purchase and Stripe renewal path.

**Architecture:** Add a user-level USD-minor discount account and immutable entry ledger; every grant, reservation, commit, release, and migration runs in a database transaction with row locking and a globally unique business idempotency key. Subscription quotes remain read-only, signed, and backend-authoritative; order creation revalidates the quote under the account lock, reserves only the selected invitation discount, and payment completion or terminal failure commits or releases that reservation. Stripe Checkout receives exactly one selected discount, while draft renewal invoices receive an idempotent negative invoice item before `auto_advance` resumes.

**Tech Stack:** Go 1.25, GORM, SQLite/MySQL/PostgreSQL, Stripe Go v86, Gin, React 19, TypeScript 6, TanStack Query, Bun test, i18next.

---

## File ownership and boundaries

- `model/subscription_discount_credit.go`: account/ledger schema and the only mutation API for package discount credit.
- `model/subscription_discount_credit_test.go`: account invariants, idempotency, concurrent reservations, and terminal-state tests.
- `model/invite_subscription_reward.go`: invitation relationship conversion record and immediate inviter grant; no unlocker or refund clawback in subscription mode.
- `model/user.go`: referred-registration invitee grant in the existing registration transaction.
- `model/invite_reward_migration.go`: idempotent migration of untransferred `aff_quota` and pending subscription rewards into the new ledger.
- `model/main.go`: cross-database schema registration and startup migration call.
- `service/subscription_discount_quote.go`: currency conversion, competing-offer selection, and pricing snapshots.
- `service/subscription_purchase.go`: authoritative quote construction, order-time revalidation, reservation, balance commit, and persisted order pricing.
- `service/subscription_purchase_quote_token.go`: signed quote contract including discount source and invitation-credit facts.
- `service/subscription_contract.go`: recurring Checkout order/reservation preparation and replay.
- `service/subscription_invoice.go`: initial/one-time payment commits, terminal releases, paid-renewal commit, and renewal invoice adjustment orchestration.
- `service/subscription_discount_invoice.go`: Stripe draft-invoice pause, reserve, negative Invoice Item, metadata, resume, and terminal release.
- `service/subscription_reconciliation_task.go`: missed-terminal-event reservation cleanup.
- `controller/subscription_self_purchase.go`: one quote/purchase contract for all five payment choices.
- `controller/subscription_payment_stripe.go`: legacy recurring entry delegates to the authoritative purchase service; one-time Checkout metadata carries the reservation snapshot.
- `controller/topup_stripe.go`: routes `invoice.created`, `invoice.voided`, and `invoice.marked_uncollectible`, and calls commit/release around existing reconciliation.
- `controller/invitation.go` and `model/invitation.go`: package-credit summary and immediate/pending/limit record states.
- `web/default/src/features/invitations/**`: invitation page removes transfer/lock semantics and displays available/lifetime package credit.
- `web/default/src/features/wallet/components/plan-purchase-dialog.tsx`: displays backend quote breakdown and remaining credit.
- `web/default/src/features/wallet/lib/subscription-plan-lifecycle.ts`: requires signed quotes for recurring Checkout as well as one-time choices.
- `web/default/src/features/subscriptions/types.ts`: shared quote and invitation-discount response types.
- `web/default/src/features/system-settings/general/quota-settings-section.tsx`: admin wording for package discount grants and unlimited count.
- `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`: complete localized user/admin copy.

### Task 1: Add the package-discount account and immutable ledger

**Files:**
- Create: `model/subscription_discount_credit.go`
- Create: `model/subscription_discount_credit_test.go`
- Modify: `model/main.go:270-405`

- [ ] **Step 1: Write failing schema and grant tests**

```go
func TestSubscriptionDiscountGrantCreatesAccountAndImmutableEntry(t *testing.T) {
	setupSubscriptionDiscountTestDB(t)
	var granted bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		granted, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID: 11, USDMinor: 500, EntryType: SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType: "invitee_registration", SourceKey: "11", IdempotencyKey: "invitee:11",
			PricingSnapshot: `{"invite_first_sub_discount_usd":"5"}`,
		})
		return err
	})
	require.NoError(t, err)
	require.True(t, granted)
	account, err := GetSubscriptionDiscountAccount(11)
	require.NoError(t, err)
	require.EqualValues(t, 500, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)

	var again bool
	err = DB.Transaction(func(tx *gorm.DB) error {
		var err error
		again, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID: 11, USDMinor: 500, EntryType: SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType: "invitee_registration", SourceKey: "11", IdempotencyKey: "invitee:11",
		})
		return err
	})
	require.NoError(t, err)
	require.False(t, again)
	var count int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ?", 11).Count(&count).Error)
	require.EqualValues(t, 1, count)
}
```

- [ ] **Step 2: Run the focused test and confirm the missing symbols fail**

Run: `go test ./model -run '^TestSubscriptionDiscountGrantCreatesAccountAndImmutableEntry$' -count=1`

Expected: FAIL because `SubscriptionDiscountAccount`, `SubscriptionDiscountEntry`, and `GrantSubscriptionDiscountTx` do not exist.

- [ ] **Step 3: Add the schema and mutation contracts**

```go
const (
	SubscriptionDiscountEntryTypeGrantInvitee = "grant_invitee"
	SubscriptionDiscountEntryTypeGrantInviter = "grant_inviter"
	SubscriptionDiscountEntryTypeMigration    = "migration"
	SubscriptionDiscountEntryTypeReserve      = "reserve"
	SubscriptionDiscountEntryTypeCommit       = "commit"
	SubscriptionDiscountEntryTypeRelease      = "release"
)

type SubscriptionDiscountAccount struct {
	UserID            int   `json:"user_id" gorm:"primaryKey"`
	AvailableUSDMinor int64 `json:"available_usd_minor" gorm:"type:bigint;not null;default:0"`
	ReservedUSDMinor  int64 `json:"reserved_usd_minor" gorm:"type:bigint;not null;default:0"`
	CreatedAt         int64 `json:"created_at" gorm:"type:bigint;not null"`
	UpdatedAt         int64 `json:"updated_at" gorm:"type:bigint;not null"`
}

type SubscriptionDiscountEntry struct {
	ID                     int64  `json:"id"`
	UserID                 int    `json:"user_id" gorm:"index;not null"`
	EntryType              string `json:"entry_type" gorm:"type:varchar(32);index;not null"`
	AvailableDeltaUSDMinor int64  `json:"available_delta_usd_minor" gorm:"type:bigint;not null"`
	ReservedDeltaUSDMinor  int64  `json:"reserved_delta_usd_minor" gorm:"type:bigint;not null"`
	AvailableAfterUSDMinor int64  `json:"available_after_usd_minor" gorm:"type:bigint;not null"`
	ReservedAfterUSDMinor  int64  `json:"reserved_after_usd_minor" gorm:"type:bigint;not null"`
	SourceType             string `json:"source_type" gorm:"type:varchar(64);index;not null"`
	SourceKey              string `json:"source_key" gorm:"type:varchar(191);index;not null"`
	OrderID                int    `json:"order_id" gorm:"index"`
	TradeNo                string `json:"trade_no" gorm:"type:varchar(255);index"`
	PaymentCurrency        string `json:"payment_currency" gorm:"type:varchar(8)"`
	AppliedAmountMinor     int64  `json:"applied_amount_minor" gorm:"type:bigint;not null;default:0"`
	PricingSnapshot        string `json:"pricing_snapshot" gorm:"type:text"`
	IdempotencyKey         string `json:"idempotency_key" gorm:"type:varchar(191);uniqueIndex;not null"`
	ExpiresAt              int64  `json:"expires_at" gorm:"type:bigint;default:0;index"`
	CreatedAt              int64  `json:"created_at" gorm:"type:bigint;not null;index"`
}

type SubscriptionDiscountGrantInput struct {
	UserID int; USDMinor int64; EntryType, SourceType, SourceKey, IdempotencyKey, PricingSnapshot string
}

type SubscriptionDiscountReservationInput struct {
	UserID int; USDMinor int64; OrderID int; TradeNo, PaymentCurrency string
	AppliedAmountMinor int64; PricingSnapshot, IdempotencyKey string; ExpiresAt int64
}

func GetSubscriptionDiscountAccount(userID int) (*SubscriptionDiscountAccount, error)
func GrantSubscriptionDiscountTx(tx *gorm.DB, input SubscriptionDiscountGrantInput) (bool, error)
func ReserveSubscriptionDiscountTx(tx *gorm.DB, input SubscriptionDiscountReservationInput) (bool, error)
func CommitSubscriptionDiscountTx(tx *gorm.DB, reservationKey string) (bool, error)
func ReleaseSubscriptionDiscountTx(tx *gorm.DB, reservationKey string) (bool, error)
```

`GrantSubscriptionDiscountTx` must lock or safely create the account row, reject negative amounts, return `(false, nil)` when the unique idempotency key exists, update the account, and append the after-value snapshot in the same transaction. No other package may update the two account balance columns directly.

- [ ] **Step 4: Add failing reservation lifecycle and concurrency tests**

```go
func TestSubscriptionDiscountReservationCommitAndReleaseAreMutuallyExclusive(t *testing.T) {
	setupSubscriptionDiscountTestDB(t)
	grantSubscriptionDiscount(t, 12, 900, "grant:12")
	var reserved bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		reserved, err = ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
			UserID: 12, USDMinor: 700, AppliedAmountMinor: 5600, PaymentCurrency: "BRL",
			TradeNo: "order-12", IdempotencyKey: "subscription-order:order-12:reserve",
		})
		return err
	})
	require.NoError(t, err)
	require.True(t, reserved)
	var committed bool
	err = DB.Transaction(func(tx *gorm.DB) error {
		var err error
		committed, err = CommitSubscriptionDiscountTx(tx, "subscription-order:order-12:reserve")
		return err
	})
	require.NoError(t, err)
	require.True(t, committed)
	var released bool
	err = DB.Transaction(func(tx *gorm.DB) error {
		var err error
		released, err = ReleaseSubscriptionDiscountTx(tx, "subscription-order:order-12:reserve")
		return err
	})
	require.NoError(t, err)
	require.False(t, released)
	account, _ := GetSubscriptionDiscountAccount(12)
	require.EqualValues(t, 200, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
}

func TestConcurrentSubscriptionDiscountReservationsCannotOverspend(t *testing.T) {
	setupSubscriptionDiscountFileDB(t)
	grantSubscriptionDiscount(t, 13, 500, "grant:13")

	type result struct {
		reserved bool
		err      error
	}
	start := make(chan struct{})
	results := make(chan result, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		key := fmt.Sprintf("subscription-order:concurrent-%d:reserve", i)
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			var reserved bool
			err := DB.Transaction(func(tx *gorm.DB) error {
				var err error
				reserved, err = ReserveSubscriptionDiscountTx(tx, SubscriptionDiscountReservationInput{
					UserID: 13, USDMinor: 400, TradeNo: key,
					PaymentCurrency: "USD", AppliedAmountMinor: 400,
					IdempotencyKey: key,
				})
				return err
			})
			results <- result{reserved: reserved, err: err}
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	successes := 0
	insufficient := 0
	for got := range results {
		switch {
		case got.err == nil && got.reserved:
			successes++
		case errors.Is(got.err, ErrSubscriptionDiscountInsufficient):
			insufficient++
		default:
			require.NoError(t, got.err)
			require.True(t, got.reserved)
		}
	}
	require.Equal(t, 1, successes)
	require.Equal(t, 1, insufficient)
	account, err := GetSubscriptionDiscountAccount(13)
	require.NoError(t, err)
	require.EqualValues(t, 100, account.AvailableUSDMinor)
	require.EqualValues(t, 400, account.ReservedUSDMinor)
}
```

- [ ] **Step 5: Implement reserve/commit/release with account-row serialization**

```go
func subscriptionDiscountReserveDeltas(amount int64) (availableDelta, reservedDelta int64, err error) {
	if amount <= 0 {
		return 0, 0, ErrSubscriptionDiscountInvalidAmount
	}
	return -amount, amount, nil
}

func subscriptionDiscountTerminalDeltas(reserve SubscriptionDiscountEntry, entryType string) (availableDelta, reservedDelta int64, err error) {
	reservedAmount := -reserve.AvailableDeltaUSDMinor
	if reserve.EntryType != SubscriptionDiscountEntryTypeReserve || reservedAmount <= 0 || reserve.ReservedDeltaUSDMinor != reservedAmount {
		return 0, 0, ErrSubscriptionDiscountReservationInvalid
	}
	switch entryType {
	case SubscriptionDiscountEntryTypeCommit:
		return 0, -reservedAmount, nil
	case SubscriptionDiscountEntryTypeRelease:
		return reservedAmount, -reservedAmount, nil
	default:
		return 0, 0, ErrSubscriptionDiscountReservationInvalid
	}
}
```

For each mutation, first insert or load the account, lock it with `clause.Locking{Strength: "UPDATE"}` on MySQL/PostgreSQL, and perform the balance update plus immutable entry insert in the caller's transaction. Preserve SQLite transaction compatibility and use `clause.OnConflict{DoNothing: true}` only for account bootstrap and idempotency inserts. Before applying a terminal entry, query by `source_key = reservation.idempotency_key` and `entry_type IN (commit, release)`; return `(false, nil)` when either terminal entry already exists. If the requested reservation exceeds current available credit, return typed `ErrSubscriptionDiscountInsufficient` rather than making either balance negative.

- [ ] **Step 6: Register both tables in full and fast migrations**

Add `&SubscriptionDiscountAccount{}` and `&SubscriptionDiscountEntry{}` to both the `DB.AutoMigrate(...)` list and `migrateDBFast()` model list in `model/main.go`.

- [ ] **Step 7: Run the model tests**

Run: `go test ./model -run 'TestSubscriptionDiscount' -count=1`

Expected: PASS, including duplicate grant/reserve, partial reservation, commit, release, terminal mutual exclusion, and concurrent overspend protection.

- [ ] **Step 8: Commit the ledger foundation**

```bash
git add model/subscription_discount_credit.go model/subscription_discount_credit_test.go model/main.go
git commit -m "Make invitation value spendable only on packages" -m "Constraint: preserve SQLite, MySQL, PostgreSQL, and multi-node correctness
Rejected: reuse users.quota | API traffic would consume invitation value
Confidence: high
Scope-risk: moderate
Directive: mutate subscription discount balances only through the transactional ledger API
Tested: go test ./model -run TestSubscriptionDiscount -count=1"
```

### Task 2: Grant invitee credit in the registration transaction

**Files:**
- Modify: `model/user.go:559-656`
- Modify: `model/invite_reward_test.go:119-188`
- Test: `model/subscription_discount_credit_test.go`

- [ ] **Step 1: Replace registration expectations with a failing package-credit grant test**

```go
func TestInvitedUserInsertGrantsConfiguredPackageCreditInSameTransaction(t *testing.T) {
	setupInviteRewardTestDB(t)
	common.InviteRewardSubscriptionMode = true
	common.InviteFirstSubDiscountUSD = 5.25
	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := User{Username: "invitee", Email: "invitee@example.com", Role: common.RoleCommonUser}
	require.NoError(t, invitee.Insert(inviter.Id))
	account, err := GetSubscriptionDiscountAccount(invitee.Id)
	require.NoError(t, err)
	require.EqualValues(t, 525, account.AvailableUSDMinor)
	var entry SubscriptionDiscountEntry
	require.NoError(t, DB.Where("idempotency_key = ?", fmt.Sprintf("invitee:%d", invitee.Id)).First(&entry).Error)
	require.Contains(t, entry.PricingSnapshot, `"invite_first_sub_discount_usd":"5.25"`)
}
```

- [ ] **Step 2: Run the registration test and confirm it fails**

Run: `go test ./model -run 'TestInvitedUserInsertGrantsConfiguredPackageCreditInSameTransaction|TestOAuthUserInsertWithTx' -count=1`

Expected: FAIL because registration currently records only `invite_reward_status=pending`.

- [ ] **Step 3: Add exact USD conversion and registration grant helpers**

```go
func SubscriptionDiscountUSDToMinor(amount float64) (int64, error) {
	if math.IsNaN(amount) || math.IsInf(amount, 0) || amount < 0 { return 0, ErrSubscriptionDiscountInvalidAmount }
	return decimal.NewFromFloat(amount).Mul(decimal.NewFromInt(100)).Round(0).IntPart(), nil
}

func grantInviteeSubscriptionDiscountTx(tx *gorm.DB, user *User) error {
	if !common.InviteRewardSubscriptionMode || user == nil || user.Id <= 0 || user.InviterId <= 0 { return nil }
	minor, err := SubscriptionDiscountUSDToMinor(common.InviteFirstSubDiscountUSD)
	if err != nil || minor == 0 { return err }
	snapshot := fmt.Sprintf(`{"invite_first_sub_discount_usd":%q}`, decimal.NewFromFloat(common.InviteFirstSubDiscountUSD).String())
	_, err = GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
		UserID: user.Id, USDMinor: minor, EntryType: SubscriptionDiscountEntryTypeGrantInvitee,
		SourceType: "invitee_registration", SourceKey: strconv.Itoa(user.Id),
		IdempotencyKey: fmt.Sprintf("invitee:%d", user.Id), PricingSnapshot: snapshot,
	})
	return err
}
```

Call the helper immediately after `tx.Create(user)` and before `claimRegistrationIPNewUserBonusInTx`; this covers password and OAuth flows because both use `insertWithTx`.

- [ ] **Step 4: Add a rollback test**

Inject a ledger insert failure inside `InsertWithTx` and assert neither the user nor a partial discount account remains. This proves the invitation relationship and invitee grant share one transaction.

- [ ] **Step 5: Run the registration suite and commit**

Run: `go test ./model -run 'TestInvitedUserInsert|TestOAuthUserInsertWithTx|TestNonInvitedUserInsert' -count=1`

```bash
git add model/user.go model/invite_reward_test.go model/subscription_discount_credit.go model/subscription_discount_credit_test.go
git commit -m "Give referred users package credit at registration" -m "Constraint: a referred registration must not succeed without its configured package-credit grant
Rejected: post-commit grant | a crash could permanently lose the invitee benefit
Confidence: high
Scope-risk: narrow
Tested: go test ./model -run TestInvitedUserInsert\|TestOAuthUserInsertWithTx\|TestNonInvitedUserInsert -count=1"
```

### Task 3: Grant inviter credit immediately in the paid-order transaction

**Files:**
- Modify: `model/invite_subscription_reward.go`
- Modify: `model/invite_subscription_reward_test.go`
- Modify: `model/subscription.go:1031-1105,1244-1418`
- Modify: `service/subscription_purchase.go:430-620`
- Modify: `service/subscription_invoice.go:286-420,1418-1660`

- [ ] **Step 1: Rewrite inviter reward tests for immediate package credit**

```go
func TestInviteSubRewardImmediatelyGrantsPackageCreditOnce(t *testing.T) {
	setupInviteSubscriptionRewardDB(t)
	common.InviteRewardSubscriptionMode = true
	common.QuotaForInviter = int(7.5 * common.QuotaPerUnit)
	inviter, invitee, order := createCompletedInvitedSubscriptionOrder(t)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return GrantInviteSubscriptionDiscountAfterPaidOrderTx(tx, &order)
	}))
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return GrantInviteSubscriptionDiscountAfterPaidOrderTx(tx, &order)
	}))
	account, _ := GetSubscriptionDiscountAccount(inviter.Id)
	require.EqualValues(t, 750, account.AvailableUSDMinor)
	require.Equal(t, InviteRewardStatusGranted, loadUser(t, invitee.Id).InviteRewardStatus)
	require.EqualValues(t, 1, countDiscountEntries(t, "inviter:"+strconv.Itoa(invitee.Id)+":first-paid-subscription"))
}
```

Add separate cases for zero configured amount, `QuotaForInviterMaxCount == 0`, a positive limit already reached, a missing inviter, and two concurrent successful orders for the same invitee.

- [ ] **Step 2: Run the rewritten tests and observe old locked-balance behavior fail**

Run: `go test ./model -run 'TestInviteSubReward' -count=1`

Expected: FAIL because the current code creates `pending` rewards, waits for `UnlockAt`, and later credits `users.quota`.

- [ ] **Step 3: Replace unlock/clawback behavior with the paid-order transaction API**

```go
func GrantInviteSubscriptionDiscountAfterPaidOrderTx(tx *gorm.DB, order *SubscriptionOrder) error
```

The implementation must:

1. Return without mutation when subscription invitation mode is disabled, the order is not successful, or the payer has no inviter.
2. Lock invitee and inviter rows.
3. Insert one `InviteSubscriptionReward` per invitee with `status=granted`, `unlock_at=0`, and the configured quota snapshot; insert `status=blocked` with reason `inviter_limit_reached` when the positive cap is exhausted.
4. Treat `QuotaForInviterMaxCount == 0` as unlimited.
5. Convert `QuotaForInviter / QuotaPerUnit` to USD minor units and call `GrantSubscriptionDiscountTx` with `inviter:{invitee_id}:first-paid-subscription`.
6. Increment `users.aff_count` only for an actual grant and mark the invitee conversion as granted even when the inviter is capped.
7. Never modify `users.quota`, `users.aff_quota`, or `users.aff_history_quota` for new subscription-mode rewards.

Delete `UnlockDueInviteSubscriptionRewards`, `RevokeInviteSubscriptionRewardByTradeNo`, and `StartInviteSubscriptionRewardUnlocker` callers for subscription mode. Leave the legacy top-up invitation implementation intact behind its existing mode condition.

- [ ] **Step 4: Move every paid-package hook inside its existing transaction**

Add the call before each transaction commits:

```go
if err := model.GrantInviteSubscriptionDiscountAfterPaidOrderTx(tx, order); err != nil { return err }
```

Apply it in:

- `model.CompleteSubscriptionOrder`
- `model.PurchaseSubscriptionWithBalance`
- `service.applyBalancePrepaidPurchaseTx`
- first-purchase branch of `service.ReconcilePaidInvoice`
- `service.CompleteOneTimeStripeSubscriptionPurchase`

Remove the current post-commit `TryGrantInviteSubscriptionRewardAfterOrderCompleted` calls. A ledger failure must cause local payment reconciliation to retry; it must not silently acknowledge a paid webhook without the inviter grant.

- [ ] **Step 5: Run all affected paid-path tests**

Run: `go test ./model ./service -run 'InviteSubReward|BalancePurchaseGrantsInvite|CompleteOneTimeStripeSubscriptionPurchase|ReconcilePaidInvoiceGrantsInvoiceFirstPurchase' -count=1`

Expected: PASS and no inviter package reward appears in `users.quota`.

- [ ] **Step 6: Commit immediate inviter grants**

```bash
git add model/invite_subscription_reward.go model/invite_subscription_reward_test.go model/subscription.go service/subscription_purchase.go service/subscription_invoice.go
git commit -m "Settle inviter value when the first package payment succeeds" -m "Constraint: no refund observation period and no first-version clawback
Rejected: asynchronous unlocker | product requires immediate availability after successful payment
Confidence: high
Scope-risk: moderate
Directive: every new paid-package completion path must call the grant helper inside its transaction
Tested: go test ./model ./service -run InviteSubReward\|BalancePurchaseGrantsInvite\|CompleteOneTimeStripeSubscriptionPurchase\|ReconcilePaidInvoiceGrantsInvoiceFirstPurchase -count=1"
```

### Task 4: Migrate remaining legacy invitation value without double granting

**Files:**
- Modify: `model/invite_reward_migration.go`
- Modify: `model/invite_reward_migration_test.go`
- Modify: `model/main.go:342,427`
- Modify: `controller/invitation.go:136-151`

- [ ] **Step 1: Write failing migration tests**

Cover these exact rows:

```go
func TestMigrateInvitationValueMovesOnlyUntransferredSources(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)
	require.NoError(t, db.AutoMigrate(
		&InviteSubscriptionReward{}, &SubscriptionOrder{},
		&SubscriptionDiscountAccount{}, &SubscriptionDiscountEntry{},
	))
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	users := []User{
		{Id: 301, Username: "aff-pending", Password: "password123", AffCode: "aff-pending-code", AffQuota: 250_000},
		{Id: 302, Username: "reward-pending", Password: "password123", AffCode: "reward-pending-code"},
		{Id: 303, Username: "already-transferred", Password: "password123", AffCode: "already-transferred-code", Quota: 900_000},
		{Id: 304, Username: "discount-used", Password: "password123", AffCode: "discount-used-code", InviterId: 301},
	}
	require.NoError(t, db.Create(&users).Error)
	reward := InviteSubscriptionReward{
		InviteeId: users[1].Id, InviterId: users[0].Id,
		TradeNo: "legacy-pending-reward", RewardQuota: 500_000,
		Status: InviteSubRewardStatusPending, UnlockAt: time.Now().Add(24 * time.Hour).Unix(),
	}
	require.NoError(t, db.Create(&reward).Error)
	require.NoError(t, db.Create(&SubscriptionOrder{
		UserId: users[3].Id, PlanId: 1, TradeNo: "legacy-discount-used",
		Status: common.TopUpStatusSuccess, DiscountUSD: 5,
	}).Error)

	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())
	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	var affUser, transferredUser User
	require.NoError(t, db.First(&affUser, users[0].Id).Error)
	require.Zero(t, affUser.AffQuota)
	require.NoError(t, db.First(&transferredUser, users[2].Id).Error)
	require.Equal(t, 900_000, transferredUser.Quota)

	var migratedReward InviteSubscriptionReward
	require.NoError(t, db.First(&migratedReward, reward.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, migratedReward.Status)
	require.Zero(t, migratedReward.UnlockAt)

	var entries []SubscriptionDiscountEntry
	require.NoError(t, db.Order("id ASC").Find(&entries).Error)
	require.Len(t, entries, 2)
	require.EqualValues(t, 250, entries[0].AvailableDeltaUSDMinor)
	require.EqualValues(t, 500, entries[1].AvailableDeltaUSDMinor)
	require.Contains(t, entries[0].PricingSnapshot, `"source_quota":250000`)
	require.Contains(t, entries[1].PricingSnapshot, `"source_quota":500000`)

	var inviteeRegrantCount int64
	require.NoError(t, db.Model(&SubscriptionDiscountEntry{}).
		Where("idempotency_key = ?", fmt.Sprintf("invitee:%d", users[3].Id)).
		Count(&inviteeRegrantCount).Error)
	require.Zero(t, inviteeRegrantCount)
}
```

Assert each migration entry stores the original quota and conversion ratio in `pricing_snapshot`, and that the sum of new USD-minor entries equals the source total converted with the historical `QuotaPerUnit` value read in that run.

- [ ] **Step 2: Run migration tests and confirm current quota transfer fails the new contract**

Run: `go test ./model -run 'TestMigrateInvitationValue' -count=1`

Expected: FAIL because `MigrateLegacyAffQuotaToQuota` currently mixes `aff_quota` into `users.quota`.

- [ ] **Step 3: Replace startup and per-user migrations**

```go
func MigrateLegacyInvitationValueToSubscriptionDiscount() error
func MigrateUserLegacyInvitationValueToSubscriptionDiscount(userID int) error
```

For each user with `aff_quota > 0`, run one transaction that locks the user, grants a `migration` entry keyed `migration:invite-discount-v1:aff-quota:{user_id}`, then sets only `aff_quota=0`. For each `InviteSubscriptionReward` still `pending`, grant a `migration` entry keyed `migration:invite-discount-v1:invite-subscription-reward:{reward_id}`, update the legacy row to `granted`, set `granted_at`, and clear `unlock_at`. Do not inspect or subtract `users.quota`.

Replace both `migrateDB` and `migrateDBFast` calls, and replace the invitation endpoint's per-user reconciliation call.

- [ ] **Step 4: Add MySQL/PostgreSQL migration smoke cases**

Reuse the repository's environment-gated DB smoke pattern and assert the GORM operations do not rely on SQLite-only SQL. The default local run may skip external databases with a clear skip message.

- [ ] **Step 5: Run and commit migration behavior**

Run: `go test ./model -run 'TestMigrateInvitationValue|TestSubscriptionDiscount.*Migration' -count=1`

```bash
git add model/invite_reward_migration.go model/invite_reward_migration_test.go model/main.go controller/invitation.go
git commit -m "Preserve only invitation value that has not entered API balance" -m "Constraint: historical rewards already mixed into users.quota cannot be separated safely
Rejected: reconstruct old balance transfers | source attribution is no longer recoverable
Confidence: high
Scope-risk: moderate
Directive: migration keys are permanent and must not be renamed after rollout
Tested: go test ./model -run TestMigrateInvitationValue\|TestSubscriptionDiscount.*Migration -count=1"
```

### Task 5: Build authoritative package-credit quotes and competing-offer selection

**Files:**
- Create: `service/subscription_discount_quote.go`
- Create: `service/subscription_discount_quote_test.go`
- Modify: `service/subscription_purchase.go:18-160,650-1040`

- [ ] **Step 1: Write failing conversion and selection table tests**

```go
func TestBuildSubscriptionDiscountQuoteSelectsLargestActualReduction(t *testing.T) {
	tests := []struct {
		name, currency string
		originalLocal, originalUSD, availableUSD, otherDiscount int64
		wantKind string; wantInvitationLocal, wantFinal int64
	}{
		{"usd invitation wins", "USD", 2000, 2000, 700, 500, SubscriptionDiscountKindInvitation, 700, 1300},
		{"brl conversion", "BRL", 8000, 2000, 500, 0, SubscriptionDiscountKindInvitation, 2000, 6000},
		{"inr partial credit", "INR", 83000, 1000, 250, 0, SubscriptionDiscountKindInvitation, 20750, 62250},
		{"other promotion wins", "USD", 2000, 2000, 700, 800, SubscriptionDiscountKindRecall, 700, 1200},
		{"tie preserves invitation credit", "USD", 2000, 2000, 700, 700, SubscriptionDiscountKindRecall, 700, 1300},
		{"credit caps at zero order", "USD", 400, 400, 900, 0, SubscriptionDiscountKindInvitation, 400, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			quote, err := BuildSubscriptionDiscountQuote(SubscriptionDiscountQuoteInput{
				Currency: tt.currency,
				OriginalAmountMinor: tt.originalLocal,
				OriginalUSDMinor: tt.originalUSD,
				AvailableUSDMinor: tt.availableUSD,
				OtherDiscountAmountMinor: tt.otherDiscount,
				OtherDiscountKind: SubscriptionDiscountKindRecall,
			})
			require.NoError(t, err)
			require.Equal(t, tt.wantKind, quote.SelectedKind)
			require.Equal(t, tt.wantInvitationLocal, quote.InvitationDiscountAmountMinor)
			require.Equal(t, tt.wantFinal, quote.FinalAmountMinor)
			if tt.wantKind == SubscriptionDiscountKindInvitation {
				require.Equal(t, tt.originalLocal-tt.wantFinal, quote.SelectedDiscountAmountMinor)
				require.Equal(t, tt.availableUSD-quote.InvitationDiscountUSDMinor, quote.InvitationRemainingUSDMinor)
			} else {
				require.Equal(t, tt.availableUSD, quote.InvitationRemainingUSDMinor)
			}
		})
	}
}
```

- [ ] **Step 2: Run the quote test and confirm missing pricing module failure**

Run: `go test ./service -run '^TestBuildSubscriptionDiscountQuote' -count=1`

Expected: FAIL because the quote selection module does not exist.

- [ ] **Step 3: Implement exact quote contracts**

```go
const (
	SubscriptionDiscountKindNone       = "none"
	SubscriptionDiscountKindInvitation = "invitation"
	SubscriptionDiscountKindRecall     = "recall"
)

type SubscriptionDiscountQuoteInput struct {
	Currency string
	OriginalAmountMinor int64
	OriginalUSDMinor int64
	AvailableUSDMinor int64
	OtherDiscountAmountMinor int64
	OtherDiscountKind string
}

type SubscriptionDiscountQuote struct {
	SelectedKind string
	SelectedDiscountAmountMinor int64
	FinalAmountMinor int64
	InvitationAvailableUSDMinor int64
	InvitationDiscountUSDMinor int64
	InvitationDiscountAmountMinor int64
	InvitationRemainingUSDMinor int64
	OtherDiscountKind string
	OtherDiscountAmountMinor int64
}

func BuildSubscriptionDiscountQuote(input SubscriptionDiscountQuoteInput) (SubscriptionDiscountQuote, error)
```

Use `shopspring/decimal` for `available USD × local original / USD original`, round once to the payment currency's minor unit with `Round(0)`, and cap at the original local amount. Select the other promotion when its reduction is greater than or equal to the invitation reduction so equal value preserves permanent invitation credit. A zero or invalid canonical USD package price must return an error before checkout.

- [ ] **Step 4: Integrate account facts into `SubscriptionPurchaseQuote`**

Add these fields to both `SubscriptionPurchaseQuote` and `SubscriptionPurchaseQuoteResult`:

```go
DiscountKind                    string
InvitationAvailableUSDMinor     int64
InvitationDiscountUSDMinor      int64
InvitationDiscountAmountMinor   int64
InvitationRemainingUSDMinor     int64
OtherDiscountKind               string
OtherDiscountAmountMinor        int64
```

`QuoteSubscriptionPurchase` must first idempotently repair a missing invitee registration grant, then read the account without reserving it. Resolve the existing recall candidate, pass both candidates into `BuildSubscriptionDiscountQuote`, and expose only the selected reduction as `DiscountAmountMinor`/`PaymentAmountMinor`. Remove the one-time-only assumption that every nonzero discount requires recall IDs.

- [ ] **Step 5: Add quote read-only and configuration-snapshot tests**

Assert repeated quote calls do not change available/reserved balances or append reservation entries, and that changing `InviteFirstSubDiscountUSD` after registration does not change the already-granted account amount.

- [ ] **Step 6: Run and commit the pricing module**

Run: `go test ./service -run 'SubscriptionDiscountQuote|QuoteSubscriptionPurchase' -count=1`

```bash
git add service/subscription_discount_quote.go service/subscription_discount_quote_test.go service/subscription_purchase.go
git commit -m "Quote the strongest package discount from durable account facts" -m "Constraint: invitation credit and recall offers cannot stack
Rejected: frontend currency conversion | payment rounding and offer selection must be authoritative on the server
Confidence: high
Scope-risk: moderate
Directive: ties select the other promotion and leave invitation credit untouched
Tested: go test ./service -run SubscriptionDiscountQuote\|QuoteSubscriptionPurchase -count=1"
```

### Task 6: Sign every payment quote, including recurring Checkout

**Files:**
- Modify: `service/subscription_purchase_quote_token.go`
- Modify: `service/subscription_purchase_quote_token_test.go`
- Modify: `controller/subscription_self_purchase.go`
- Modify: `controller/subscription_self_purchase_test.go`

- [ ] **Step 1: Write failing signed-quote tests for invitation and recurring choices**

Add a round-trip claim with `PaymentChoice=stripe_recurring`, `DiscountKind=invitation`, invitation USD/local fields, zero recall IDs, and a final amount of zero. Add a tampering case that changes the invitation reservation amount without changing the signature.

- [ ] **Step 2: Run the tests and confirm recurring/zero/invitation claims are rejected**

Run: `go test ./service ./controller -run 'SubscriptionPurchaseQuoteToken|SubscriptionSelfQuote' -count=1`

- [ ] **Step 3: Version and extend the signed claim**

```go
type SubscriptionPurchaseQuoteTokenClaims struct {
	Version                         int    `json:"v"`
	UserID                          int    `json:"uid"`
	PlanID                          int    `json:"pid"`
	PaymentChoice                   string `json:"payment_choice"`
	Months                          int    `json:"months"`
	RequestID                       string `json:"request_id"`
	Currency                        string `json:"currency"`
	UnitAmountMinor                 int64  `json:"unit_amount_minor"`
	TotalAmountMinor                int64  `json:"total_amount_minor"`
	DiscountAmountMinor             int64  `json:"discount_amount_minor,omitempty"`
	RecallCampaignID                int64  `json:"recall_campaign_id,omitempty"`
	RecallRecipientID               int64  `json:"recall_recipient_id,omitempty"`
	PlanRevision                    int64  `json:"plan_revision"`
	ExpiresAt                       int64  `json:"expires_at"`
	DiscountKind                   string `json:"discount_kind"`
	InvitationAvailableUSDMinor    int64  `json:"invitation_available_usd_minor,omitempty"`
	InvitationDiscountUSDMinor     int64  `json:"invitation_discount_usd_minor,omitempty"`
	InvitationDiscountAmountMinor  int64  `json:"invitation_discount_amount_minor,omitempty"`
	InvitationRemainingUSDMinor    int64  `json:"invitation_remaining_usd_minor,omitempty"`
	OtherDiscountKind              string `json:"other_discount_kind,omitempty"`
	OtherDiscountAmountMinor       int64  `json:"other_discount_amount_minor,omitempty"`
}
```

Bump the token version, accept `stripe_recurring`, allow zero total, require recall IDs only when `DiscountKind == recall`, and require invitation USD/local fields only when `DiscountKind == invitation`.

- [ ] **Step 4: Make `/self/quote` and `/self/purchase` use the quote for all five choices**

Remove the recurring quote rejection. Set `requiresQuote := true`, sign all new fields, reconstruct all fields in `subscriptionPurchaseQuoteFromClaims`, and require the purchase result's order snapshot to match the signed currency, final amount, selected kind, and invitation reservation amount.

- [ ] **Step 5: Run and commit the controller contract**

Run: `go test ./service ./controller -run 'SubscriptionPurchaseQuoteToken|SubscriptionSelfQuote|SubscriptionSelfPurchaseRejects' -count=1`

```bash
git add service/subscription_purchase_quote_token.go service/subscription_purchase_quote_token_test.go controller/subscription_self_purchase.go controller/subscription_self_purchase_test.go
git commit -m "Bind every package checkout to a signed discount quote" -m "Constraint: recurring Checkout must display and charge the same backend-selected reduction
Rejected: unsigned recurring price preview | credit can change across tabs and nodes
Confidence: high
Scope-risk: moderate
Directive: quote claims must bind user, plan, months, choice, request, revision, discount source, and expiry
Tested: go test ./service ./controller -run SubscriptionPurchaseQuoteToken\|SubscriptionSelfQuote\|SubscriptionSelfPurchaseRejects -count=1"
```

### Task 7: Reserve on order creation and commit/release one-time payments

**Files:**
- Modify: `model/subscription.go:561-598`
- Modify: `service/subscription_purchase.go:170-620`
- Modify: `service/subscription_purchase_test.go`
- Modify: `service/subscription_invoice.go:1418-1660`
- Modify: `service/subscription_invoice_test.go`
- Modify: `controller/subscription_payment_stripe.go:239-520`
- Modify: `controller/subscription_one_time_stripe_test.go`

- [ ] **Step 1: Add persisted order snapshot fields and failing tests**

```go
DiscountKind                  string `json:"discount_kind" gorm:"type:varchar(32);default:'none';index"`
SubscriptionDiscountUSDMinor int64  `json:"subscription_discount_usd_minor" gorm:"type:bigint;not null;default:0"`
SubscriptionDiscountAmountMinor int64 `json:"subscription_discount_amount_minor" gorm:"type:bigint;not null;default:0"`
SubscriptionDiscountReservationKey string `json:"subscription_discount_reservation_key" gorm:"type:varchar(191);default:'';index"`
DiscountPricingSnapshot      string `json:"discount_pricing_snapshot" gorm:"type:text"`
```

Test that a pending one-time order atomically moves invitation credit from available to reserved, stores the exact signed quote facts, and rejects a concurrent second order when the signed available amount is stale.

- [ ] **Step 2: Run the purchase test and observe no reservation**

Run: `go test ./service -run 'TestPurchaseSubscription.*Invitation' -count=1`

- [ ] **Step 3: Revalidate and reserve inside the order transaction**

Add:

```go
func reserveSubscriptionDiscountForOrderTx(tx *gorm.DB, order *model.SubscriptionOrder, quote SubscriptionPurchaseQuote, expiresAt int64) error
```

It must lock the account, rebuild the invitation candidate from current available credit and the order's canonical/local price snapshot, compare every signed discount field, then reserve with `subscription-order:{trade_no}:reserve` only when invitation wins. If recall wins, persist recall IDs and no reservation. Store the complete pricing snapshot JSON on the order.

Call it from `createPendingOneTimePurchaseOrderTx`, recurring order preparation, and the balance order path. A quote mismatch returns `ErrSubscriptionPurchaseQuoteInvalid` and creates neither order nor reservation.

- [ ] **Step 4: Commit the reservation in the balance transaction**

After the balance debit and successful order/entitlement records, call `CommitSubscriptionDiscountTx(tx, order.SubscriptionDiscountReservationKey)`. Calculate `requiredQuota` from the final quoted amount, including a zero final amount, and preserve any unused invitation credit.

- [ ] **Step 5: Commit or release hosted one-time reservations**

Inside `CompleteOneTimeStripeSubscriptionPurchase`, commit before the transaction returns. Inside `TerminatePendingStripePurchase`, release when the order becomes failed/expired. Duplicate success and terminal callbacks must return the existing terminal result without changing the account twice.

- [ ] **Step 6: Carry audit metadata to one-time Stripe Checkout**

Add `discount_kind`, `subscription_discount_reservation_key`, `subscription_discount_usd_minor`, and `subscription_discount_amount_minor` to `oneTimePlanMetadata`. The Checkout line item already uses `order.PaymentAmountMinor`; keep it as the only charged amount and allow the local zero-total branch to complete without creating a positive-money payment Session.

- [ ] **Step 7: Test all one-time payment choices and zero orders**

Run: `go test ./service ./controller -run 'PurchaseSubscription.*(Balance|Alipay|Pix|UPI|Invitation)|CompleteOneTimeStripeSubscriptionPurchase|OneTimePlan.*Discount' -count=1`

Expected: PASS for partial discount, zero final amount, success commit, expired/failed release, replay, and BRL/INR rounding.

- [ ] **Step 8: Commit one-time consumption**

```bash
git add model/subscription.go service/subscription_purchase.go service/subscription_purchase_test.go service/subscription_invoice.go service/subscription_invoice_test.go controller/subscription_payment_stripe.go controller/subscription_one_time_stripe_test.go
git commit -m "Reserve package credit before one-time payment begins" -m "Constraint: quotes are read-only but order creation must prevent cross-node double spend
Rejected: deduct on webhook only | concurrent pending checkouts could promise the same credit
Confidence: high
Scope-risk: broad
Directive: every terminal hosted-payment path must commit or release the persisted reservation key
Tested: go test ./service ./controller -run PurchaseSubscription.*\(Balance\|Alipay\|Pix\|UPI\|Invitation\)\|CompleteOneTimeStripeSubscriptionPurchase\|OneTimePlan.*Discount -count=1"
```

### Task 8: Apply the selected invitation discount to initial Stripe subscription Checkout

**Files:**
- Modify: `service/subscription_contract.go:32-540,1093-1160`
- Modify: `service/subscription_invoice.go:24-240`
- Modify: `service/subscription_invoice_test.go:67-130,1088-1210`
- Modify: `service/subscription_purchase.go:162-215`
- Modify: `controller/subscription_payment_stripe.go:35-178`

- [ ] **Step 1: Add a failing Checkout parameter test**

Assert `createStripeSubscriptionCheckout` receives a recurring order whose selected invitation reduction is 525 cents and sends exactly one `discounts[0][coupon]`, `duration=once`, matching currency/amount, and reservation metadata on the Session and Subscription. Add a competing recall case asserting one promotion code and no invitation coupon.

- [ ] **Step 2: Run the focused Checkout tests**

Run: `go test ./service ./controller -run 'CreateStripeSubscriptionCheckout.*Discount|StripeRecurring.*Invitation' -count=1`

Expected: FAIL because the new recurring path currently only supports a recall promotion code.

- [ ] **Step 3: Extend recurring Checkout inputs with the persisted selection**

```go
type StripeSubscriptionCheckoutInput struct {
	TradeNo                       string
	UserID                        int
	PlanID                        int
	ContractID                    int64
	ChangeIntentID                int64
	CustomerID                    string
	Email                         string
	PriceID                       string
	IdempotencyKey                string
	Presentation                  StripeCheckoutPresentation
	DiscountKind                  string
	DiscountAmountMinor           int64
	DiscountCurrency              string
	DiscountReservationKey string
	RecallDiscount                *RecallCheckoutDiscount
}
```

`ChangePlanCommand` receives the verified quote. `prepareStripeSubscriptionCheckoutPaymentTx` creates the order, stores pricing facts, and reserves credit before returning the input. Replay reloads those fields from the order rather than recalculating from current configuration.

- [ ] **Step 4: Create one exact, idempotent Stripe coupon when invitation wins**

Add injectable wrappers for tests around `coupon.New` and `session.New`. Use:

```go
couponParams := &stripe.CouponParams{
	AmountOff: stripe.Int64(input.DiscountAmountMinor),
	Currency: stripe.String(strings.ToLower(input.DiscountCurrency)),
	Duration: stripe.String(string(stripe.CouponDurationOnce)),
	Name: stripe.String("Flatkey invitation package credit"),
}
couponParams.SetIdempotencyKey(input.IdempotencyKey + ":invitation-coupon")
```

When recall wins, use only its promotion code. When neither wins, omit `Discounts`. Never set `AllowPromotionCodes` for a quoted order because the backend has already selected the one allowed promotion.

- [ ] **Step 5: Release on Checkout creation/session terminal failure**

Any error after reservation calls `TerminatePendingStripePurchase`, whose transaction releases the reservation. `checkout.session.expired` and `checkout.session.async_payment_failed` keep using that same terminal function. `invoice.paid` commits during paid reconciliation.

- [ ] **Step 6: Route the legacy `/subscription/stripe/pay` entry through the authoritative service**

Replace its direct `CreateSubscriptionOrderWithInviteDiscount` path with an internal quote followed by `PurchaseSubscription` using a generated request ID and verified quote. Preserve its existing response shape (`data.pay_link`) for compatibility, but ensure it creates the same signed/priced/reserved order as `/self/purchase`.

- [ ] **Step 7: Run and commit recurring Checkout**

Run: `go test ./service ./controller -run 'StripeRecurring|CreateStripeSubscriptionCheckout|SubscriptionStripe' -count=1`

```bash
git add service/subscription_contract.go service/subscription_invoice.go service/subscription_invoice_test.go service/subscription_purchase.go controller/subscription_payment_stripe.go controller/subscription_payment_stripe_test.go
git commit -m "Show invitation package credit on initial Stripe Checkout" -m "Constraint: Stripe Checkout accepts one discount and must display the actual amount charged
Rejected: customer balance mirror | it can leak credit onto unrelated invoices
Confidence: high
Scope-risk: broad
Directive: create the exact once coupon from persisted order facts, never current config
Tested: go test ./service ./controller -run StripeRecurring\|CreateStripeSubscriptionCheckout\|SubscriptionStripe -count=1"
```

### Task 9: Adjust automatic renewal invoices and settle their reservations

**Files:**
- Create: `service/subscription_discount_invoice.go`
- Create: `service/subscription_discount_invoice_test.go`
- Modify: `service/subscription_invoice.go:286-445,1070-1325`
- Modify: `controller/topup_stripe.go:820-844,1150-1530`
- Modify: `controller/topup_stripe_test.go:1838-2035`
- Modify: `service/subscription_reconciliation_task.go`
- Modify: `service/subscription_reconciliation_task_test.go`

- [ ] **Step 1: Write failing draft-invoice adjustment tests**

Test `PrepareStripeSubscriptionDiscountInvoice` with injected Stripe accessors:

1. `invoice.created` for a draft renewal pauses `auto_advance`.
2. It compares existing invoice discount to invitation value; an equal or larger existing discount leaves invitation credit untouched.
3. When invitation wins, it reserves the full selected USD credit and creates one negative Invoice Item for only the incremental reduction needed after existing discounts.
4. It writes reservation metadata and restores `auto_advance=true`.
5. Duplicate event/API retries reuse DB and Stripe idempotency keys.
6. A Stripe mutation failure leaves the invoice draft and returns an error for webhook retry.

- [ ] **Step 2: Run the invoice tests and confirm the handler is absent**

Run: `go test ./service -run 'TestPrepareStripeSubscriptionDiscountInvoice' -count=1`

- [ ] **Step 3: Implement the renewal adjustment service**

```go
func PrepareStripeSubscriptionDiscountInvoice(ctx context.Context, invoiceID string) error
func CommitStripeSubscriptionDiscountInvoiceTx(tx *gorm.DB, invoiceID string) error
func ReleaseStripeSubscriptionDiscountInvoice(ctx context.Context, invoiceID string) error
```

The prepare function must accept only a draft Flatkey-managed subscription invoice that is not the initial `subscription_create` invoice. It loads the binding/plan snapshot, calculates original USD and local minor amounts, pauses `auto_advance`, reserves with `stripe-invoice:{invoice_id}:reserve`, creates the negative Invoice Item with Stripe idempotency key `stripe-invoice:{invoice_id}:adjustment`, writes metadata, and resumes automatic advancement. The pricing snapshot records invoice subtotal, existing discount, selected total invitation reduction, incremental negative item, currency, canonical USD price, and account amounts.

- [ ] **Step 4: Commit in paid reconciliation and release only on final terminal states**

Inside the existing `ReconcilePaidInvoice` transaction, call `CommitStripeSubscriptionDiscountInvoiceTx` before entitlement/binding success returns. Do not release on `invoice.payment_failed`. Release on `invoice.voided`, `invoice.marked_uncollectible`, a definitively terminated Checkout, or the reconciliation cleanup proving the invoice/order cannot pay.

- [ ] **Step 5: Route and deduplicate the new Stripe events**

Add dispatcher cases and handlers for:

```go
stripe.EventTypeInvoiceCreated
stripe.EventTypeInvoiceVoided
stripe.EventTypeInvoiceMarkedUncollectible
```

Use the existing `recordStripeSubscriptionWebhookEvent` lease and `finishStripeSubscriptionWebhookEvent` status transitions. Missing invoice IDs are permanent errors; Stripe/DB mutation failures are retryable. Preserve current `invoice.payment_failed` grace behavior and reservation.

- [ ] **Step 6: Add stale reservation reconciliation**

Extend the existing reconciliation task to find expired `reserve` entries with no commit/release, authenticate the associated pending order/invoice state, and call the appropriate terminal function. Claim work through account-row locking and terminal ledger checks so multiple nodes can scan safely.

- [ ] **Step 7: Run renewal and webhook tests**

Run: `go test ./service ./controller -run 'SubscriptionDiscountInvoice|StripeInvoice(Created|Paid|Voided|MarkedUncollectible|PaymentFailed)|SubscriptionReconciliation.*Discount' -count=1`

Expected: PASS for duplicate/out-of-order events, restart-safe retry, no release on payment failure, commit on paid, and release on final terminal status.

- [ ] **Step 8: Commit renewal support**

```bash
git add service/subscription_discount_invoice.go service/subscription_discount_invoice_test.go service/subscription_invoice.go controller/topup_stripe.go controller/topup_stripe_test.go service/subscription_reconciliation_task.go service/subscription_reconciliation_task_test.go
git commit -m "Apply package credit to Stripe renewals before collection" -m "Constraint: renewals must reduce the invoice before Stripe charges it
Rejected: Stripe customer balance | it cannot be scoped safely to package invoices
Confidence: high
Scope-risk: broad
Directive: invoice.payment_failed retains the reservation; only final terminal states release it
Tested: go test ./service ./controller -run SubscriptionDiscountInvoice\|StripeInvoice\(Created\|Paid\|Voided\|MarkedUncollectible\|PaymentFailed\)\|SubscriptionReconciliation.*Discount -count=1"
```

### Task 10: Replace invitation API and page semantics

**Files:**
- Modify: `model/invitation.go`
- Modify: `model/invitation_test.go`
- Modify: `controller/invitation.go`
- Modify: `controller/invitation_test.go`
- Modify: `web/default/src/features/invitations/types.ts`
- Modify: `web/default/src/features/invitations/components/invitation-stats.tsx`
- Modify: `web/default/src/features/invitations/components/invitation-reward-summary.tsx`
- Modify: `web/default/src/features/invitations/components/reward-steps-card.tsx`
- Modify: `web/default/src/features/invitations/components/invitation-records-card.tsx`
- Modify: `web/default/src/features/invitations/components/invitation-faq.tsx`
- Modify: `web/default/src/features/invitations/components/invitation-view.test.tsx`

- [ ] **Step 1: Write failing API response tests**

Require the subscription-mode summary to contain:

```json
{
  "reward_mode": "subscription",
  "available_discount_usd": 12.5,
  "lifetime_discount_usd": 20,
  "inviter_reward_usd": 7.5,
  "invitee_reward_usd": 5,
  "inviter_reward_max_count": 0,
  "granted_count": 2,
  "pending_count": 1
}
```

Assert it omits transfer and unlock concepts, and records expose only `pending`, `granted`, `blocked` with `inviter_limit_reached` or `unavailable` reasons.

- [ ] **Step 2: Run backend invitation tests**

Run: `go test ./model ./controller -run 'Invitation' -count=1`

- [ ] **Step 3: Make the ledger authoritative for summary totals**

Add `GetSubscriptionDiscountSummary(userID)` that reads current available/reserved account values and sums positive grant/migration entry deltas for lifetime earned. In subscription mode, set invitee reward from `InviteFirstSubDiscountUSD`, not `QuotaForInvitee`; remove unlock, locked, transferable, and transfer-enabled fields. Keep top-up mode response behavior unchanged behind `reward_mode=topup`.

- [ ] **Step 4: Simplify invitation record normalization**

New invitation rewards are immediately `granted`; pending means waiting for the invitee's first paid package, and blocked means the configured inviter count cap prevented the grant. Remove subscription-mode `locked`, `revoked`, `unlock_at`, `refunded`, and `disputed` display mappings.

- [ ] **Step 5: Update frontend types and component tests first**

Change `InvitationSummary` to `available_discount_usd` and `lifetime_discount_usd`; narrow subscription statuses; assert the UI renders “Available package discount”, “Lifetime package discount”, “Waiting for first paid package”, “Reward received”, and “Reward limit reached”, and renders no transfer, locked, unlock date, or API balance text.

- [ ] **Step 6: Implement the invitation UI copy and fields**

The three steps must read: share the link; friend registers and immediately receives package credit; inviter receives package credit immediately after the friend's first successful paid package. State permanently valid and limited to package purchases/renewals.

- [ ] **Step 7: Run and commit the invitation surface**

Run: `go test ./model ./controller -run 'Invitation' -count=1`

Run: `bun test src/features/invitations` from `web/default`

```bash
git add model/invitation.go model/invitation_test.go controller/invitation.go controller/invitation_test.go web/default/src/features/invitations
git commit -m "Explain invitation rewards as permanent package discounts" -m "Constraint: subscription-mode value cannot be transferred to API balance
Rejected: retain locked and transferable UI | those states no longer exist
Confidence: high
Scope-risk: moderate
Directive: invitation page totals come from the package-credit ledger
Tested: go test ./model ./controller -run Invitation -count=1; bun test src/features/invitations"
```

### Task 11: Show authoritative discount pricing and update admin/i18n copy

**Files:**
- Modify: `web/default/src/features/subscriptions/types.ts`
- Modify: `web/default/src/features/wallet/lib/subscription-plan-lifecycle.ts`
- Modify: `web/default/src/features/wallet/lib/subscription-plan-lifecycle.test.ts`
- Modify: `web/default/src/features/wallet/components/plan-purchase-dialog.tsx`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.tsx`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.test.tsx`
- Modify: `web/default/src/features/system-settings/general/quota-settings-section.tsx`
- Modify: `web/default/src/features/system-settings/types.ts`
- Modify: `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`
- Modify: `web/default/src/features/invitations/invitations-i18n.test.ts`
- Modify: `web/default/src/features/subscriptions/subscription-admin-i18n.test.ts`

- [ ] **Step 1: Add failing quote rendering and request tests**

Extend `SubscriptionPaymentQuote` with:

```ts
discount_kind?: 'none' | 'invitation' | 'recall'
invitation_available_usd?: number
invitation_discount_usd?: number
invitation_discount_amount?: number
invitation_remaining_usd?: number
other_discount_kind?: 'recall' | ''
other_discount_amount?: number
```

Assert `requiresSignedCheckoutQuote('stripe_recurring') === true`, recurring confirm includes `quote_id`, and the dialog renders original price, invitation reduction, selected other offer when larger, final amount, projected remaining credit, and the “invitation credit was not consumed” notice.

- [ ] **Step 2: Run the focused frontend tests and confirm failures**

Run from `web/default`: `bun test src/features/wallet/lib/subscription-plan-lifecycle.test.ts src/features/wallet/components/subscription-plans-card.test.tsx`

- [ ] **Step 3: Use backend quotes for every payment choice**

Remove the separate `stripeRecallDiscount` price path from `plan-purchase-dialog.tsx`. `getMatchingPaymentQuote` must require an unexpired signed quote for all choices. On dialog open and every plan/month/payment change, `subscription-plans-card.tsx` requests a fresh quote and disables Continue while it is missing, loading, stale, or failed.

- [ ] **Step 4: Render the full pricing breakdown without frontend arithmetic**

Display values exactly from the selected quote:

- original package total;
- invitation package discount when selected;
- other selected offer when it wins;
- final amount due;
- projected remaining invitation package credit;
- explicit non-consumption message when another offer wins.

Do not recompute exchange rates, caps, or remaining credit in TypeScript.

- [ ] **Step 5: Update the admin invitation settings wording**

In subscription mode, label `QuotaForInviter` as inviter package discount, `InviteFirstSubDiscountUSD` as invitee registration package discount, and `QuotaForInviterMaxCount` as reward count limit with zero meaning unlimited. Add help text that reward arrives immediately after a first paid package and that credit never expires and applies only to package purchase/renewal. Keep `InviteRewardUnlockDelaySeconds` hidden or explicitly legacy-only in this mode.

- [ ] **Step 6: Add real translations in all eight locales**

Update `en`, `zh`, `fr`, `ru`, `ja`, `vi`, `es`, and `pt`; do not copy English values into non-English locale files. Extend the existing i18n tests with every new key and assert non-English values differ from the English source except the established invariant-key allowlist.

- [ ] **Step 7: Run frontend checks and commit**

Run from `web/default`:

```bash
bun test src/features/invitations src/features/wallet/lib/subscription-plan-lifecycle.test.ts src/features/wallet/components/subscription-plans-card.test.tsx src/features/subscriptions/subscription-admin-i18n.test.ts
bun run typecheck
bun run lint
bun run format:check
```

```bash
git add web/default/src/features/subscriptions/types.ts web/default/src/features/wallet web/default/src/features/system-settings web/default/src/features/invitations/invitations-i18n.test.ts web/default/src/features/subscriptions/subscription-admin-i18n.test.ts web/default/src/i18n/locales
git commit -m "Show package credit in checkout and invitation settings" -m "Constraint: frontend must display server pricing without recreating currency math
Rejected: Stripe-only recall preview | every payment choice now uses the same authoritative quote
Confidence: high
Scope-risk: moderate
Directive: add every user-visible package-credit key to all eight locales and i18n tests
Tested: bun test targeted invitation/wallet/i18n suites; bun run typecheck; bun run lint; bun run format:check"
```

### Task 12: Remove obsolete unlock/refund behavior and verify the complete feature

**Files:**
- Modify: `common/constants.go:156-166`
- Modify: `model/option.go:180-190,640-655,880-895`
- Modify: `controller/topup_stripe.go` only where subscription-mode refund callbacks currently revoke rewards
- Modify: affected tests under `model/`, `service/`, `controller/`, and `web/default/src/`

- [ ] **Step 1: Add regression assertions for explicit non-goals**

Add tests proving a refund/dispute does not claw back inviter package credit and does not restore consumed invitee credit; API requests still debit only `users.quota`; top-up invitation mode retains its old behavior when subscription mode is disabled.

- [ ] **Step 2: Remove dead subscription-mode observation-period wiring**

Keep `InviteRewardUnlockDelaySeconds` only for legacy compatibility reads if required by stored options, but remove it from subscription-mode runtime paths, schedulers, logs, API responses, and UI. Remove refund/dispute calls into subscription reward revocation while preserving unrelated payment/refund handling.

- [ ] **Step 3: Format and run targeted backend suites**

Run:

```bash
gofmt -w model/subscription_discount_credit.go model/subscription_discount_credit_test.go model/invite_subscription_reward.go model/invite_reward_migration.go service/subscription_discount_quote.go service/subscription_discount_quote_test.go service/subscription_discount_invoice.go service/subscription_discount_invoice_test.go service/subscription_purchase.go service/subscription_purchase_quote_token.go service/subscription_contract.go service/subscription_invoice.go controller/subscription_self_purchase.go controller/subscription_payment_stripe.go controller/topup_stripe.go controller/invitation.go
go test ./model ./service ./controller -count=1
```

Expected: PASS with no race-sensitive duplicate grant/reservation failures.

- [ ] **Step 4: Run frontend validation**

Run from `web/default`:

```bash
bun test
bun run typecheck
bun run lint
bun run format:check
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Run repository-wide static and scope checks**

Run from repository root:

```bash
go vet ./model ./service ./controller
git diff --check
git status --short
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

Confirm no `website/` file, new dependency, generated artifact, or unrelated feature is included.

- [ ] **Step 6: Run the broad Go suite with a bounded timeout**

Run: `go test -p 1 ./... -count=1` with a 10-minute timeout.

Expected: PASS. If the command times out after the targeted suites pass, capture the last completed package and report the timeout as a validation gap without claiming the broad suite passed.

- [ ] **Step 7: Review the final diff against the approved design**

Check each design section explicitly: grants, configuration snapshots, permanent partial balance, non-stacking/tie rule, five purchase choices, initial Checkout, renewal invoices, terminal release, migration, refund non-goal, invitation UI, checkout UI, admin copy, eight locales, and multi-node idempotency.

- [ ] **Step 8: Commit final cleanup and verification evidence**

```bash
git add common model service controller web/default
git commit -m "Finish permanent invitation credit across package billing" -m "Constraint: first version intentionally ignores refund restoration and reward clawback
Rejected: broaden into campaign creation or API-credit changes | invitation package billing is the approved scope
Confidence: high
Scope-risk: broad
Directive: do not merge or push main; promote only after test-environment validation
Tested: targeted Go suites; frontend tests/typecheck/lint/format/build; go vet; git diff --check; bounded go test -p 1 ./...
Not-tested: live Stripe renewal webhook until staging credentials and test clock are available"
```

## Design coverage self-review

| Approved design section | Implemented by |
| --- | --- |
| 1-3. Goal, product rules, and selected account-ledger architecture | Tasks 1-12; no campaign/activity creation and no `users.quota` reuse |
| 4. Account, immutable entries, USD-minor storage, and idempotency keys | Task 1 |
| 5. Invitee-at-registration and inviter-at-first-paid grants with configuration snapshots | Tasks 2-3 |
| 6. Read-only quote, non-stacking/tie selection, transactional reservation, commit, release, and zero-total orders | Tasks 5-7 |
| 7. Initial Stripe Checkout coupon and automatic renewal invoice adjustment | Tasks 8-9 |
| 8. Existing configuration semantics and removal of the observation period | Tasks 3, 11-12 |
| 9. Invitation, package checkout, admin copy, and eight locales | Tasks 10-11 |
| 10. Untransferred `aff_quota` and pending reward migration without reversing API balance | Task 4 |
| 11. Cross-node consistency, retry behavior, account locks, and unique business keys | Tasks 1, 3-4, 7, 9 |
| 12. Explicit first-version refund/clawback non-goal | Task 12 |
| 13. Backend, payment, Stripe, migration, frontend, and i18n tests | Every task uses red-green tests; Task 12 runs the combined suites |
| 14. Rollout and observability | Immutable entries provide grant/reserve/commit/release/migration counters and amount totals; Tasks 4, 7, 9, and 12 preserve retry/terminal logs and verify reconciliation |
| 15. Non-goals | File boundaries exclude activity creation, API-credit changes, new dependencies, and `website/` |
| 16. Expected implementation surface | File ownership section plus Tasks 1-12 |
| 17. Completion criteria | Completion evidence checklist and Task 12 verification commands |

## Completion evidence checklist

- [ ] New credit never changes `users.quota`, `aff_quota`, or withdrawable/general balance outside the one-time legacy migration cleanup.
- [ ] Invitee registration and inviter first-paid grant are transactional and idempotent.
- [ ] Amount and reward-count decisions use configuration snapshots; zero cap is unlimited.
- [ ] Quote is read-only; order/invoice creation reserves; success commits; final failure releases.
- [ ] Invitation and other promotion never produce a reduction larger than the selected maximum; ties preserve invitation credit.
- [ ] Balance, Alipay, Pix, UPI, Stripe initial Checkout, upgrades/later purchases, and automatic renewals use the same backend price authority.
- [ ] Duplicate requests, duplicate/out-of-order webhook events, process restarts, and concurrent nodes do not double grant or double spend.
- [ ] Untransferred legacy values migrate once; values already mixed into API balance remain unchanged.
- [ ] Refunds do not claw back grants or restore consumed credit in this version.
- [ ] Invitation, package checkout, and admin settings use package-discount wording in all eight locales.
- [ ] Targeted tests and frontend checks pass; broad-suite gaps, if any, are recorded precisely.
