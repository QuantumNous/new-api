package service

import (
	"fmt"
	"path/filepath"
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

func TestAgentPointsWorkflowAcceptance(t *testing.T) {
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalAgentEnabled := operation_setting.GetAgentSetting().Enabled

	dsn := "file:" + filepath.Join(t.TempDir(), "agent-acceptance.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.SubscriptionPlan{},
		&model.UserSubscription{},
		&model.AgentAccount{},
		&model.AgentCreditLog{},
		&model.AgentPlanOffer{},
		&model.AgentPurchaseOrder{},
		&model.AgentRefundRequest{},
		&model.Redemption{},
	))
	model.DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Setenv("LOG_SQL_DSN", "")
	require.NoError(t, model.InitLogDB())
	common.RedisEnabled = false
	operation_setting.GetAgentSetting().Enabled = true
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		operation_setting.GetAgentSetting().Enabled = originalAgentEnabled
		require.NoError(t, sqlDB.Close())
	})

	const (
		rootUserID   = 1
		agentUserID  = 13001
		firstUserID  = 13002
		secondUserID = 13003
	)
	for id, username := range map[int]string{
		agentUserID:  "acceptance-agent",
		firstUserID:  "acceptance-user-one",
		secondUserID: "acceptance-user-two",
	} {
		require.NoError(t, model.DB.Create(&model.User{
			Id: id, Username: username, AffCode: fmt.Sprintf("acceptance-aff-%d", id),
			Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "starter",
		}).Error)
	}

	// 1. Root enables the agent and credits exactly 1000.00 points.
	account, err := EnableAgent(agentUserID)
	require.NoError(t, err)
	assert.Equal(t, model.AgentAccountStatusActive, account.Status)
	credit, err := AdjustAgentCredit(AgentCreditAdjustment{
		AgentUserID: agentUserID, OperatorUserID: rootUserID, Amount: 100000,
		Direction: AgentCreditDirectionCredit, Reason: "acceptance funding",
		IdempotencyKey: "acceptance-credit-1000",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(100000), credit.Account.Balance)

	// 2. Root configures the 60.00 offer, 365-day code validity, and 5% refund fee.
	plan := model.SubscriptionPlan{
		Title: "Acceptance Pro", Enabled: true, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationCustom, CustomSeconds: 7200,
		TotalAmount: 5000, QuotaResetPeriod: model.SubscriptionResetNever,
		UpgradeGroup: "pro",
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	validDays := 365
	offer, err := UpsertAgentPlanOffer(AgentPlanOfferInput{
		PlanID: plan.Id, Enabled: true, UnitPrice: 6000,
		CodeValidDays: &validDays, RefundFeeBps: 500,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(6000), offer.UnitPrice)
	assert.Equal(t, 365, offer.CodeValidDays)
	assert.Equal(t, 500, offer.RefundFeeBps)

	// 3. Buying ten codes leaves 400.00 and creates one immutable purchase set.
	purchaseInput := AgentPurchaseInput{
		AgentUserID: agentUserID, PlanID: plan.Id, Quantity: 10,
		IdempotencyKey: "acceptance-purchase-ten",
	}
	purchase, err := PurchaseAgentCodes(purchaseInput)
	require.NoError(t, err)
	assert.Equal(t, int64(40000), purchase.BalanceAfter)
	require.Len(t, purchase.Codes, 10)
	var orderCount, codeCount, purchaseLogCount int64
	require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orderCount).Error)
	require.NoError(t, model.DB.Model(&model.Redemption{}).
		Where("type = ?", common.RedemptionCodeTypeSubscription).Count(&codeCount).Error)
	require.NoError(t, model.DB.Model(&model.AgentCreditLog{}).
		Where("event_type = ?", model.AgentCreditEventPurchase).Count(&purchaseLogCount).Error)
	assert.Equal(t, int64(1), orderCount)
	assert.Equal(t, int64(10), codeCount)
	assert.Equal(t, int64(1), purchaseLogCount)

	// 4. Replaying the same idempotency key returns the original immutable result.
	replayed, err := PurchaseAgentCodes(purchaseInput)
	require.NoError(t, err)
	assert.Equal(t, purchase.Order.Id, replayed.Order.Id)
	assert.Equal(t, purchase.Codes, replayed.Codes)
	assert.Equal(t, int64(40000), replayed.BalanceAfter)
	require.NoError(t, model.DB.Model(&model.AgentPurchaseOrder{}).Count(&orderCount).Error)
	require.NoError(t, model.DB.Model(&model.Redemption{}).
		Where("type = ?", common.RedemptionCodeTypeSubscription).Count(&codeCount).Error)
	assert.Equal(t, int64(1), orderCount)
	assert.Equal(t, int64(10), codeCount)
	replayedAccount, err := GetAgentAccount(agentUserID)
	require.NoError(t, err)
	assert.Equal(t, 10, replayedAccount.DailyCodeCount)

	// Change the live plan and offer: sold codes must continue using purchase snapshots.
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"title": "Changed Live Plan", "custom_seconds": int64(60), "total_amount": int64(1),
	}).Error)
	require.NoError(t, model.DB.Model(&model.AgentPlanOffer{}).Where("plan_id = ?", plan.Id).Updates(map[string]interface{}{
		"unit_price": int64(9999), "refund_fee_bps": 1000,
	}).Error)

	// 5. One user redeems one sold code into exactly one snapshot-correct subscription.
	redeemed, err := RedeemCode(firstUserID, purchase.Codes[0].Key)
	require.NoError(t, err)
	assert.Equal(t, RedemptionResultTypeSubscription, redeemed.Type)
	assert.Equal(t, "Acceptance Pro", redeemed.PlanTitle)
	var subscription model.UserSubscription
	require.NoError(t, model.DB.First(&subscription, redeemed.SubscriptionID).Error)
	assert.Equal(t, int64(5000), subscription.AmountTotal)
	assert.Equal(t, int64(7200), subscription.EndTime-subscription.StartTime)
	var subscriptionCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("user_id = ?", firstUserID).Count(&subscriptionCount).Error)
	assert.Equal(t, int64(1), subscriptionCount)

	// 6. Refunding one unused code uses the sold 60.00/5% snapshot and leaves 457.00.
	refunded, err := RefundAgentCodes(AgentRefundInput{
		AgentUserID: agentUserID, RedemptionIDs: []int{purchase.Codes[1].Id},
		IdempotencyKey: "acceptance-refund-one", RequestedBy: agentUserID,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(300), refunded.Fee)
	assert.Equal(t, int64(5700), refunded.Refunded)
	assert.Equal(t, int64(45700), refunded.BalanceAfter)

	// 7. Used, refunded, and expired codes are all unavailable for refund.
	invalidRefunds := []struct {
		name string
		code model.Redemption
	}{
		{name: "used", code: purchase.Codes[0]},
		{name: "refunded", code: purchase.Codes[1]},
		{name: "expired", code: purchase.Codes[2]},
	}
	require.NoError(t, model.DB.Model(&model.Redemption{}).Where("id = ?", purchase.Codes[2].Id).
		Update("expired_time", time.Now().Unix()-1).Error)
	for _, invalid := range invalidRefunds {
		t.Run("reject refund for "+invalid.name+" code", func(t *testing.T) {
			_, refundErr := RefundAgentCodes(AgentRefundInput{
				AgentUserID: agentUserID, RedemptionIDs: []int{invalid.code.Id},
				IdempotencyKey: "acceptance-invalid-" + invalid.name, RequestedBy: agentUserID,
			})
			assert.ErrorIs(t, refundErr, ErrAgentRefundUnavailable)
		})
	}

	// 8. A disabled agent cannot buy or self-refund, while an already sold code remains deliverable.
	_, err = DisableAgent(agentUserID)
	require.NoError(t, err)
	_, err = PurchaseAgentCodes(AgentPurchaseInput{
		AgentUserID: agentUserID, PlanID: plan.Id, Quantity: 1,
		IdempotencyKey: "acceptance-disabled-purchase",
	})
	assert.ErrorIs(t, err, ErrAgentAccountDisabled)
	_, err = RefundAgentCodes(AgentRefundInput{
		AgentUserID: agentUserID, RedemptionIDs: []int{purchase.Codes[3].Id},
		IdempotencyKey: "acceptance-disabled-refund", RequestedBy: agentUserID,
	})
	assert.ErrorIs(t, err, ErrAgentAccountDisabled)
	operation_setting.GetAgentSetting().Enabled = false
	deliveredAfterDisable, err := RedeemCode(secondUserID, purchase.Codes[4].Key)
	require.NoError(t, err)
	assert.Equal(t, RedemptionResultTypeSubscription, deliveredAfterDisable.Type)

	// Disabling only the global switch is the operational rollback: preparation remains
	// possible, but active agents still cannot create new financial mutations.
	_, err = EnableAgent(agentUserID)
	require.NoError(t, err)
	_, err = PurchaseAgentCodes(AgentPurchaseInput{
		AgentUserID: agentUserID, PlanID: plan.Id, Quantity: 1,
		IdempotencyKey: "acceptance-switch-disabled-purchase",
	})
	assert.ErrorIs(t, err, ErrAgentFeatureDisabled)
	_, err = RefundAgentCodes(AgentRefundInput{
		AgentUserID: agentUserID, RedemptionIDs: []int{purchase.Codes[3].Id},
		IdempotencyKey: "acceptance-switch-disabled-refund", RequestedBy: agentUserID,
	})
	assert.ErrorIs(t, err, ErrAgentFeatureDisabled)

	// 9. The immutable ledger reconciles to the final 457.00 balance.
	reconciliation, err := ReconcileAgentAccount(agentUserID)
	require.NoError(t, err)
	assert.True(t, reconciliation.Matches)
	assert.True(t, reconciliation.LedgerContinuous)
	assert.Equal(t, int64(45700), reconciliation.Balance)
	assert.Equal(t, reconciliation.Balance, reconciliation.LedgerSum)
	assert.Zero(t, reconciliation.Difference)
}
