package service

import (
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAgentPurchaseTest(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalEnabled := operation_setting.GetAgentSetting().Enabled
	dsn := "file:" + filepath.Join(t.TempDir(), "agent-purchase.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.SubscriptionPlan{}, &model.AgentAccount{},
		&model.AgentCreditLog{}, &model.AgentPlanOffer{}, &model.AgentPurchaseOrder{},
		&model.Redemption{},
	))
	model.DB = db
	operation_setting.GetAgentSetting().Enabled = true
	t.Cleanup(func() {
		model.DB = originalDB
		operation_setting.GetAgentSetting().Enabled = originalEnabled
		require.NoError(t, sqlDB.Close())
	})
}

func createPurchasableAgentFixture(t *testing.T, userID int, balance int64, dailyLimit int) (model.SubscriptionPlan, model.AgentPlanOffer) {
	t.Helper()
	user := model.User{
		Id: userID, Username: fmt.Sprintf("purchase-agent-%d", userID),
		AffCode: fmt.Sprintf("purchase-aff-%d", userID), Status: common.UserStatusEnabled,
		Role: common.RoleCommonUser,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	account := model.AgentAccount{
		UserId: userID, Status: model.AgentAccountStatusActive,
		DailyCodeLimit: dailyLimit,
	}
	require.NoError(t, model.DB.Create(&account).Error)
	_, err := AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: userID, OperatorUserID: 1, Amount: balance,
		Direction: AgentCreditDirectionCredit, Reason: "test fixture funding",
		IdempotencyKey: fmt.Sprintf("purchase-fixture-funding-%d", userID),
	})
	require.NoError(t, err)
	plan := model.SubscriptionPlan{
		Title: "Monthly Pro", Subtitle: "Snapshot subtitle", Enabled: true,
		Currency: "CNY", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1,
		TotalAmount: 5000, QuotaResetPeriod: model.SubscriptionResetMonthly,
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	offer := model.AgentPlanOffer{
		PlanId: plan.Id, Enabled: true, UnitPrice: 6000,
		CodeValidDays: 365, RefundFeeBps: 500,
	}
	require.NoError(t, model.DB.Create(&offer).Error)
	return plan, offer
}

func TestPurchaseAgentCodesCommitsExactBalanceOrderCodesAndLedger(t *testing.T) {
	setupAgentPurchaseTest(t)
	plan, _ := createPurchasableAgentFixture(t, 20, 100000, 200)
	before := time.Now().Unix()

	result, err := PurchaseAgentCodes(AgentPurchaseInput{
		AgentUserID: 20, PlanID: plan.Id, Quantity: 10, IdempotencyKey: "buy-1",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(40000), result.BalanceAfter)
	assert.Equal(t, int64(60000), result.Order.TotalPrice)
	assert.Equal(t, int64(6000), result.Order.UnitPrice)
	assert.Equal(t, 10, result.Order.Quantity)
	assert.Equal(t, plan.Title, result.Order.PlanTitle)
	assert.Equal(t, model.AgentPurchaseOrderStatusCompleted, result.Order.Status)
	require.Len(t, result.Codes, 10)

	seen := make(map[string]struct{}, len(result.Codes))
	for _, code := range result.Codes {
		assert.Len(t, code.Key, 32)
		_, duplicate := seen[code.Key]
		assert.False(t, duplicate)
		seen[code.Key] = struct{}{}
		assert.Equal(t, common.RedemptionCodeTypeSubscription, code.Type)
		assert.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
		assert.Equal(t, 20, code.AgentUserId)
		assert.Equal(t, result.Order.Id, code.AgentOrderId)
		assert.Equal(t, plan.Id, code.SubscriptionPlanId)
		assert.GreaterOrEqual(t, code.ExpiredTime, before+365*24*60*60)
		assert.LessOrEqual(t, code.ExpiredTime, time.Now().Unix()+365*24*60*60)
	}

	snapshot, err := model.DecodeSubscriptionEntitlementSnapshot(result.Order.EntitlementSnapshot)
	require.NoError(t, err)
	assert.Equal(t, plan.Id, snapshot.PlanId)
	assert.Equal(t, plan.Title, snapshot.PlanTitle)
	assert.Equal(t, int64(5000), snapshot.TotalAmount)
	assert.Equal(t, model.SubscriptionResetMonthly, snapshot.QuotaResetPeriod)

	account, err := GetAgentAccount(20)
	require.NoError(t, err)
	assert.Equal(t, int64(40000), account.Balance)
	assert.Equal(t, 10, account.DailyCodeCount)
	assert.Equal(t, time.Now().In(time.Local).Format("2006-01-02"), account.DailyCountDate)
	assert.Equal(t, int64(2), account.Version)

	var orders int64
	require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orders).Error)
	assert.Equal(t, int64(1), orders)
	var codes int64
	require.NoError(t, model.DB.Model(&model.Redemption{}).Where("type = ?", common.RedemptionCodeTypeSubscription).Count(&codes).Error)
	assert.Equal(t, int64(10), codes)
	var ledger model.AgentCreditLog
	require.NoError(t, model.DB.Where("order_id = ?", result.Order.Id).First(&ledger).Error)
	assert.Equal(t, model.AgentCreditEventPurchase, ledger.EventType)
	assert.Equal(t, int64(-60000), ledger.Delta)
	assert.Equal(t, int64(100000), ledger.BalanceBefore)
	assert.Equal(t, int64(40000), ledger.BalanceAfter)
}

func TestPurchaseAgentCodesRejectsLedgerMismatchWithoutMutation(t *testing.T) {
	setupAgentPurchaseTest(t)
	plan, _ := createPurchasableAgentFixture(t, 1201, 100000, 200)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 1201).
		UpdateColumn("balance", int64(100001)).Error)
	var before model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", 1201).First(&before).Error)

	_, err := PurchaseAgentCodes(AgentPurchaseInput{
		AgentUserID: 1201, PlanID: plan.Id, Quantity: 1, IdempotencyKey: "purchase-mismatch",
	})
	assert.ErrorIs(t, err, ErrAgentLedgerMismatch)
	var after model.AgentAccount
	require.NoError(t, model.DB.Where("user_id = ?", 1201).First(&after).Error)
	assert.Equal(t, before, after)
	var orders, codes, purchases int64
	require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orders).Error)
	require.NoError(t, model.DB.Model(&model.Redemption{}).Where("type = ?", common.RedemptionCodeTypeSubscription).Count(&codes).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventPurchase).Count(&purchases).Error)
	assert.Zero(t, orders)
	assert.Zero(t, codes)
	assert.Zero(t, purchases)
}

func TestPurchaseAgentCodesValidatesServerStateAndLimits(t *testing.T) {
	tests := []struct {
		name  string
		edit  func(t *testing.T, plan model.SubscriptionPlan)
		input func(plan model.SubscriptionPlan) AgentPurchaseInput
		want  error
	}{
		{name: "zero quantity", input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 0, IdempotencyKey: "zero"}
		}, want: ErrAgentPurchaseInvalidQuantity},
		{name: "quantity above maximum", input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 101, IdempotencyKey: "large"}
		}, want: ErrAgentPurchaseInvalidQuantity},
		{name: "feature disabled", edit: func(t *testing.T, plan model.SubscriptionPlan) {
			operation_setting.GetAgentSetting().Enabled = false
		}, input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 1, IdempotencyKey: "feature"}
		}, want: ErrAgentFeatureDisabled},
		{name: "agent disabled", edit: func(t *testing.T, plan model.SubscriptionPlan) {
			require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 21).Update("status", model.AgentAccountStatusDisabled).Error)
		}, input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 1, IdempotencyKey: "agent-disabled"}
		}, want: ErrAgentAccountDisabled},
		{name: "offer disabled", edit: func(t *testing.T, plan model.SubscriptionPlan) {
			require.NoError(t, model.DB.Model(&model.AgentPlanOffer{}).Where("plan_id = ?", plan.Id).Update("enabled", false).Error)
		}, input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 1, IdempotencyKey: "offer-disabled"}
		}, want: ErrAgentOfferUnavailable},
		{name: "missing plan", edit: func(t *testing.T, plan model.SubscriptionPlan) {
			require.NoError(t, model.DB.Delete(&model.SubscriptionPlan{}, plan.Id).Error)
		}, input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 1, IdempotencyKey: "missing-plan"}
		}, want: ErrAgentPlanUnavailable},
		{name: "plan disabled", edit: func(t *testing.T, plan model.SubscriptionPlan) {
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("enabled", false).Error)
		}, input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 1, IdempotencyKey: "plan-disabled"}
		}, want: ErrAgentPlanUnavailable},
		{name: "insufficient balance", input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 100, IdempotencyKey: "balance"}
		}, want: ErrAgentInsufficientBalance},
		{name: "daily limit", edit: func(t *testing.T, plan model.SubscriptionPlan) {
			today := time.Now().In(time.Local).Format("2006-01-02")
			require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 21).Updates(map[string]interface{}{
				"daily_count_date": today, "daily_code_count": 199,
			}).Error)
		}, input: func(plan model.SubscriptionPlan) AgentPurchaseInput {
			return AgentPurchaseInput{AgentUserID: 21, PlanID: plan.Id, Quantity: 2, IdempotencyKey: "limit"}
		}, want: ErrAgentDailyLimitExceeded},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupAgentPurchaseTest(t)
			plan, _ := createPurchasableAgentFixture(t, 21, 100000, 200)
			if tt.edit != nil {
				tt.edit(t, plan)
			}
			_, err := PurchaseAgentCodes(tt.input(plan))
			assert.ErrorIs(t, err, tt.want)
			var orders int64
			require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orders).Error)
			assert.Zero(t, orders)
		})
	}
}

func TestPurchaseAgentCodesIdempotentReplayIsStableAndRejectsParameterDrift(t *testing.T) {
	setupAgentPurchaseTest(t)
	plan, _ := createPurchasableAgentFixture(t, 22, 100000, 200)
	input := AgentPurchaseInput{AgentUserID: 22, PlanID: plan.Id, Quantity: 2, IdempotencyKey: "stable"}

	first, err := PurchaseAgentCodes(input)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AgentPlanOffer{}).Where("plan_id = ?", plan.Id).Updates(map[string]interface{}{
		"unit_price": 9999, "code_valid_days": 1, "refund_fee_bps": 10000,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"title": "Changed", "total_amount": 1, "enabled": false,
	}).Error)
	require.NoError(t, model.DB.Model(&model.AgentPlanOffer{}).Where("plan_id = ?", plan.Id).Update("enabled", false).Error)
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 22).Update("status", model.AgentAccountStatusDisabled).Error)
	operation_setting.GetAgentSetting().Enabled = false

	replayed, err := PurchaseAgentCodes(input)
	require.NoError(t, err)
	assert.Equal(t, first.Order, replayed.Order)
	assert.Equal(t, first.Codes, replayed.Codes)
	assert.Equal(t, first.BalanceAfter, replayed.BalanceAfter)

	drifted := input
	drifted.Quantity = 3
	_, err = PurchaseAgentCodes(drifted)
	assert.ErrorIs(t, err, ErrAgentIdempotencyConflict)
	drifted = input
	drifted.PlanID++
	_, err = PurchaseAgentCodes(drifted)
	assert.ErrorIs(t, err, ErrAgentIdempotencyConflict)

	account, err := GetAgentAccount(22)
	require.NoError(t, err)
	assert.Equal(t, int64(88000), account.Balance)
	assert.Equal(t, 2, account.DailyCodeCount)
	var orderCount, ledgerCount int64
	require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orderCount).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventPurchase).Count(&ledgerCount).Error)
	assert.Equal(t, int64(1), orderCount)
	assert.Equal(t, int64(1), ledgerCount)
}

func TestPurchaseAgentCodesRejectsUndeliverablePlanBeforeAnyMutation(t *testing.T) {
	tests := []struct {
		name   string
		update map[string]interface{}
	}{
		{name: "invalid duration", update: map[string]interface{}{"duration_unit": "fortnight"}},
		{name: "negative amount", update: map[string]interface{}{"total_amount": -1}},
		{name: "negative purchase limit", update: map[string]interface{}{"max_purchase_per_user": -1}},
		{name: "invalid custom reset", update: map[string]interface{}{
			"quota_reset_period": model.SubscriptionResetCustom, "quota_reset_custom_seconds": 0,
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupAgentPurchaseTest(t)
			plan, _ := createPurchasableAgentFixture(t, 26, 100000, 200)
			require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(tt.update).Error)
			var accountUpdates atomic.Int32
			callbackName := "test:invalid_plan_account_update:" + t.Name()
			require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table == "agent_accounts" {
					accountUpdates.Add(1)
				}
			}))
			t.Cleanup(func() {
				require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
			})

			_, err := PurchaseAgentCodes(AgentPurchaseInput{
				AgentUserID: 26, PlanID: plan.Id, Quantity: 1, IdempotencyKey: "invalid-plan",
			})
			assert.ErrorIs(t, err, ErrAgentPlanUnavailable)

			account, err := GetAgentAccount(26)
			require.NoError(t, err)
			assert.Equal(t, int64(100000), account.Balance)
			assert.Zero(t, account.DailyCodeCount)
			assert.Equal(t, int64(1), account.Version)
			var orderCount, codeCount, ledgerCount int64
			require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orderCount).Error)
			require.NoError(t, model.DB.Model(&model.Redemption{}).Where("type = ?", common.RedemptionCodeTypeSubscription).Count(&codeCount).Error)
			require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventPurchase).Count(&ledgerCount).Error)
			assert.Zero(t, orderCount)
			assert.Zero(t, codeCount)
			assert.Zero(t, ledgerCount)
			assert.Zero(t, accountUpdates.Load())
			offers, err := ListPurchasableAgentOffers(26)
			require.NoError(t, err)
			assert.Empty(t, offers)
		})
	}
}

func TestPurchaseAgentCodesRollsBackAccountOrderAndCodesWhenLedgerFails(t *testing.T) {
	setupAgentPurchaseTest(t)
	plan, _ := createPurchasableAgentFixture(t, 25, 100000, 200)
	callbackName := "test:agent_purchase_ledger_failure"
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "agent_credit_logs" {
			tx.AddError(errors.New("injected purchase ledger failure"))
		}
	}))

	_, err := PurchaseAgentCodes(AgentPurchaseInput{
		AgentUserID: 25, PlanID: plan.Id, Quantity: 2, IdempotencyKey: "ledger-failure",
	})
	require.ErrorContains(t, err, "injected purchase ledger failure")

	account, err := GetAgentAccount(25)
	require.NoError(t, err)
	assert.Equal(t, int64(100000), account.Balance)
	assert.Zero(t, account.DailyCodeCount)
	assert.Equal(t, int64(1), account.Version)
	var orderCount, codeCount, ledgerCount int64
	require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orderCount).Error)
	require.NoError(t, model.DB.Model(&model.Redemption{}).Where("type = ?", common.RedemptionCodeTypeSubscription).Count(&codeCount).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventPurchase).Count(&ledgerCount).Error)
	assert.Zero(t, orderCount)
	assert.Zero(t, codeCount)
	assert.Zero(t, ledgerCount)

	require.NoError(t, model.DB.Callback().Create().Remove(callbackName))
	result, err := PurchaseAgentCodes(AgentPurchaseInput{
		AgentUserID: 25, PlanID: plan.Id, Quantity: 2, IdempotencyKey: "ledger-failure",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(88000), result.BalanceAfter)
	assert.Len(t, result.Codes, 2)
}

func registerAgentPurchaseVersionBarrier(t *testing.T, participants int) (<-chan struct{}, chan<- struct{}) {
	t.Helper()
	arrived := make(chan struct{}, participants)
	release := make(chan struct{})
	var entered atomic.Int32
	callbackName := "test:agent_purchase_version_barrier:" + t.Name()
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "agent_accounts" || entered.Add(1) > int32(participants) {
			return
		}
		arrived <- struct{}{}
		<-release
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})
	return arrived, release
}

func TestPurchaseAgentCodesConcurrentRequestsCannotOverspendOrExceedDailyLimit(t *testing.T) {
	tests := []struct {
		name       string
		balance    int64
		dailyLimit int
		wantErr    error
	}{
		{name: "balance", balance: 6000, dailyLimit: 10, wantErr: ErrAgentInsufficientBalance},
		{name: "daily limit", balance: 12000, dailyLimit: 1, wantErr: ErrAgentDailyLimitExceeded},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupAgentPurchaseTest(t)
			plan, _ := createPurchasableAgentFixture(t, 23, tt.balance, tt.dailyLimit)
			arrived, release := registerAgentPurchaseVersionBarrier(t, 2)
			results := make(chan *AgentPurchaseResult, 2)
			errors := make(chan error, 2)
			var wg sync.WaitGroup
			for i := 0; i < 2; i++ {
				wg.Add(1)
				go func(index int) {
					defer wg.Done()
					result, err := PurchaseAgentCodes(AgentPurchaseInput{
						AgentUserID: 23, PlanID: plan.Id, Quantity: 1,
						IdempotencyKey: fmt.Sprintf("concurrent-%d", index),
					})
					if err != nil {
						errors <- err
						return
					}
					results <- result
				}(i)
			}
			<-arrived
			<-arrived
			close(release)
			wg.Wait()
			close(results)
			close(errors)

			require.Len(t, results, 1)
			require.Len(t, errors, 1)
			for err := range errors {
				assert.ErrorIs(t, err, tt.wantErr)
			}
			account, err := GetAgentAccount(23)
			require.NoError(t, err)
			assert.Equal(t, tt.balance-6000, account.Balance)
			assert.Equal(t, 1, account.DailyCodeCount)
			var orderCount, codeCount, ledgerCount int64
			require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orderCount).Error)
			require.NoError(t, model.DB.Model(&model.Redemption{}).Where("type = ?", common.RedemptionCodeTypeSubscription).Count(&codeCount).Error)
			require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventPurchase).Count(&ledgerCount).Error)
			assert.Equal(t, int64(1), orderCount)
			assert.Equal(t, int64(1), codeCount)
			assert.Equal(t, int64(1), ledgerCount)
		})
	}
}

func TestPurchaseAgentCodesConcurrentSameIdempotencyKeyChargesOnceAndReplaysStableResult(t *testing.T) {
	setupAgentPurchaseTest(t)
	plan, _ := createPurchasableAgentFixture(t, 27, 100000, 200)
	arrived, release := registerAgentPurchaseVersionBarrier(t, 2)
	results := make(chan *AgentPurchaseResult, 2)
	errors := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result, err := PurchaseAgentCodes(AgentPurchaseInput{
				AgentUserID: 27, PlanID: plan.Id, Quantity: 2, IdempotencyKey: "same-key",
			})
			if err != nil {
				errors <- err
				return
			}
			results <- result
		}()
	}
	<-arrived
	<-arrived
	close(release)
	wg.Wait()
	close(results)
	close(errors)
	require.Empty(t, errors)
	require.Len(t, results, 2)
	first := <-results
	second := <-results
	assert.Equal(t, first.Order, second.Order)
	assert.Equal(t, first.Codes, second.Codes)
	assert.Equal(t, first.BalanceAfter, second.BalanceAfter)

	account, err := GetAgentAccount(27)
	require.NoError(t, err)
	assert.Equal(t, int64(88000), account.Balance)
	assert.Equal(t, 2, account.DailyCodeCount)
	var orderCount, codeCount, ledgerCount int64
	require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orderCount).Error)
	require.NoError(t, model.DB.Model(&model.Redemption{}).Where("type = ?", common.RedemptionCodeTypeSubscription).Count(&codeCount).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).Where("event_type = ?", model.AgentCreditEventPurchase).Count(&ledgerCount).Error)
	assert.Equal(t, int64(1), orderCount)
	assert.Equal(t, int64(2), codeCount)
	assert.Equal(t, int64(1), ledgerCount)
}

func TestAgentOverviewAndOffersRequireEnabledActiveAgent(t *testing.T) {
	setupAgentPurchaseTest(t)
	plan, _ := createPurchasableAgentFixture(t, 24, 100000, 200)

	overview, err := GetAgentOverview(24)
	require.NoError(t, err)
	assert.Equal(t, int64(100000), overview.Account.Balance)
	assert.Equal(t, 200, overview.DailyRemaining)
	assert.Zero(t, overview.DailyCodeCount)
	assert.Greater(t, overview.NextDailyResetAt, time.Now().Unix())

	today := time.Now().In(time.Local).Format("2006-01-02")
	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 24).Updates(map[string]interface{}{
		"daily_count_date": today, "daily_code_count": 7, "daily_code_limit": 5,
	}).Error)
	overview, err = GetAgentOverview(24)
	require.NoError(t, err)
	assert.Equal(t, 7, overview.DailyCodeCount)
	assert.Zero(t, overview.DailyRemaining)

	offers, err := ListPurchasableAgentOffers(24)
	require.NoError(t, err)
	require.Len(t, offers, 1)
	assert.Equal(t, plan.Id, offers[0].Offer.PlanId)

	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("enabled", false).Error)
	offers, err = ListPurchasableAgentOffers(24)
	require.NoError(t, err)
	assert.Empty(t, offers)

	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 24).Update("status", model.AgentAccountStatusDisabled).Error)
	_, err = GetAgentOverview(24)
	assert.ErrorIs(t, err, ErrAgentAccountDisabled)
	_, err = ListPurchasableAgentOffers(24)
	assert.ErrorIs(t, err, ErrAgentAccountDisabled)

	require.NoError(t, model.DB.Model(&model.AgentAccount{}).Where("user_id = ?", 24).Update("status", model.AgentAccountStatusActive).Error)
	operation_setting.GetAgentSetting().Enabled = false
	_, err = GetAgentOverview(24)
	assert.ErrorIs(t, err, ErrAgentFeatureDisabled)
}
