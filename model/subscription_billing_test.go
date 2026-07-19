package model

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostConsumeUserSubscriptionDeltaRejectsOverflow(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:            9701,
		Title:         "Overflow Plan",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   math.MaxInt64,
	}
	require.NoError(t, DB.Create(plan).Error)
	subscription := &UserSubscription{
		Id:          9702,
		UserId:      9703,
		PlanId:      plan.Id,
		AmountTotal: math.MaxInt64,
		AmountUsed:  math.MaxInt64 - 1,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)

	err := PostConsumeUserSubscriptionDelta(subscription.Id, 2)
	require.ErrorContains(t, err, "integer adjustment is out of range")

	var stored UserSubscription
	require.NoError(t, DB.First(&stored, subscription.Id).Error)
	assert.EqualValues(t, math.MaxInt64-1, stored.AmountUsed)
}

func TestPreConsumeUserSubscriptionRejectsUnlimitedLedgerOverflow(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:            9704,
		Title:         "Unlimited Overflow Plan",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   0,
	}
	require.NoError(t, DB.Create(plan).Error)
	subscription := &UserSubscription{
		Id:          9705,
		UserId:      9706,
		PlanId:      plan.Id,
		AmountTotal: 0,
		AmountUsed:  math.MaxInt64 - 1,
		EndTime:     GetDBTimestamp() + 3600,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)

	_, err := PreConsumeUserSubscription("subscription-overflow", subscription.UserId, "test", 0, 2)
	require.ErrorContains(t, err, "integer adjustment is out of range")

	var stored UserSubscription
	require.NoError(t, DB.First(&stored, subscription.Id).Error)
	assert.EqualValues(t, math.MaxInt64-1, stored.AmountUsed)

	var records int64
	require.NoError(t, DB.Model(&SubscriptionPreConsumeRecord{}).
		Where("request_id = ?", "subscription-overflow").
		Count(&records).Error)
	assert.Zero(t, records)
}

func TestPurchaseSubscriptionWithBalanceSucceedsWhenOutboxAcknowledgementIsQueued(t *testing.T) {
	truncateTables(t)

	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	user := &User{
		Id:       9711,
		Username: "subscription_ack_user",
		Status:   common.UserStatusEnabled,
		Quota:    500,
	}
	require.NoError(t, DB.Create(user).Error)
	plan := &SubscriptionPlan{
		Id:              9712,
		Title:           "Queued Ack Plan",
		PriceAmount:     1,
		DurationUnit:    SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TotalAmount:     1000,
		AllowBalancePay: nil,
	}
	require.NoError(t, DB.Create(plan).Error)
	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_billing_adjustment_ack
		BEFORE UPDATE ON billing_adjustment_outboxes
		BEGIN
			SELECT RAISE(FAIL, 'forced acknowledgement failure');
		END
	`).Error)
	t.Cleanup(func() {
		DB.Exec("DROP TRIGGER IF EXISTS fail_billing_adjustment_ack")
	})

	require.NoError(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 400, storedUser.Quota)

	var subscriptions int64
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).
		Count(&subscriptions).Error)
	assert.EqualValues(t, 1, subscriptions)

	var outbox BillingAdjustmentOutbox
	require.NoError(t, DB.Where("user_id = ? AND leg = ?", user.Id, BillingAdjustmentLegWallet).First(&outbox).Error)
	assert.True(t, outbox.DBApplied)
	assert.False(t, outbox.CacheApplied)
}

func TestPurchaseSubscriptionWithBalanceRejectsQuotaOverflow(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       9721,
		Username: "subscription_overflow_user",
		Status:   common.UserStatusEnabled,
		Quota:    500,
	}
	require.NoError(t, DB.Create(user).Error)
	plan := &SubscriptionPlan{
		Id:              9722,
		Title:           "Overflow Price Plan",
		PriceAmount:     math.MaxFloat64,
		DurationUnit:    SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TotalAmount:     1000,
		AllowBalancePay: nil,
	}
	require.NoError(t, DB.Create(plan).Error)

	err := PurchaseSubscriptionWithBalance(user.Id, plan.Id)
	require.ErrorContains(t, err, "套餐价格对应额度超出允许范围")

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 500, storedUser.Quota)

	var subscriptions int64
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).
		Count(&subscriptions).Error)
	assert.Zero(t, subscriptions)
}

func TestPurchaseSubscriptionWithBalanceAllowsFreePlan(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       9731,
		Username: "subscription_free_user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}
	require.NoError(t, DB.Create(user).Error)
	plan := &SubscriptionPlan{
		Id:              9732,
		Title:           "Free Plan",
		PriceAmount:     0,
		DurationUnit:    SubscriptionDurationMonth,
		DurationValue:   1,
		Enabled:         true,
		TotalAmount:     1000,
		AllowBalancePay: nil,
	}
	require.NoError(t, DB.Create(plan).Error)

	require.NoError(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))

	var subscriptions int64
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).
		Count(&subscriptions).Error)
	assert.EqualValues(t, 1, subscriptions)

	var outboxes int64
	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).Count(&outboxes).Error)
	assert.Zero(t, outboxes)
}
