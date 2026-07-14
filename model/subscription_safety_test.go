package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func prepareSubscriptionSafetyTest(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))
	t.Cleanup(func() {
		DB.Where("request_id LIKE ?", "subscription-safety-%").Delete(&SubscriptionPreConsumeRecord{})
		DB.Where("id >= ? AND id < ?", 710000, 711000).Delete(&UserSubscription{})
		DB.Where("id >= ? AND id < ?", 710000, 711000).Delete(&SubscriptionPlan{})
	})
}

func createSubscriptionSafetyPlan(t *testing.T, id int, upgradeGroup string) {
	t.Helper()
	require.NoError(t, DB.Create(&SubscriptionPlan{
		Id:               id,
		Title:            "subscription safety plan",
		PriceAmount:      1,
		Currency:         "USD",
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		UpgradeGroup:     upgradeGroup,
		TotalAmount:      10_000,
		QuotaResetPeriod: SubscriptionResetNever,
	}).Error)
}

func createSubscriptionSafetySubscription(t *testing.T, id, userId, planId int, upgradeGroup string, amountUsed int64, allowWalletOverflow bool) {
	t.Helper()
	now := time.Now()
	require.NoError(t, DB.Create(&UserSubscription{
		Id:                  id,
		UserId:              userId,
		PlanId:              planId,
		AmountTotal:         10_000,
		AmountUsed:          amountUsed,
		StartTime:           now.Add(-time.Hour).Unix(),
		EndTime:             now.Add(time.Hour).Unix(),
		Status:              "active",
		UpgradeGroup:        upgradeGroup,
		AllowWalletOverflow: allowWalletOverflow,
	}).Error)
}

func subscriptionSafetyUsed(t *testing.T, id int) int64 {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Select("amount_used").First(&sub, id).Error)
	return sub.AmountUsed
}

func TestPreConsumeUserSubscriptionForGroupSkipsMismatchedPlan(t *testing.T) {
	prepareSubscriptionSafetyTest(t)

	const userId = 710001
	createSubscriptionSafetyPlan(t, 710001, "premium")
	createSubscriptionSafetyPlan(t, 710002, "default")
	createSubscriptionSafetySubscription(t, 710001, userId, 710001, "premium", 0, false)
	createSubscriptionSafetySubscription(t, 710002, userId, 710002, "default", 0, false)

	result, err := PreConsumeUserSubscriptionForGroup("subscription-safety-group", userId, "test-model", "default", 0, 300)
	require.NoError(t, err)

	assert.Equal(t, 710002, result.UserSubscriptionId)
	assert.EqualValues(t, 0, subscriptionSafetyUsed(t, 710001))
	assert.EqualValues(t, 300, subscriptionSafetyUsed(t, 710002))
}

func TestPreConsumeUserSubscriptionForGroupAllowsUnscopedPlan(t *testing.T) {
	prepareSubscriptionSafetyTest(t)

	const userId = 710005
	createSubscriptionSafetyPlan(t, 710005, "")
	createSubscriptionSafetySubscription(t, 710005, userId, 710005, "", 0, true)

	result, err := PreConsumeUserSubscriptionForGroup("subscription-safety-unscoped", userId, "test-model", "internal", 0, 300)
	require.NoError(t, err)
	assert.Equal(t, 710005, result.UserSubscriptionId)
	assert.EqualValues(t, 300, subscriptionSafetyUsed(t, 710005))
}

func TestPreConsumeUserSubscriptionForGroupUsesPurchasedGroupSnapshot(t *testing.T) {
	prepareSubscriptionSafetyTest(t)

	createSubscriptionSafetyPlan(t, 710006, "")
	createSubscriptionSafetySubscription(t, 710006, 710006, 710006, "premium", 0, true)

	_, err := PreConsumeUserSubscriptionForGroup("subscription-safety-snapshot-reject", 710006, "test-model", "default", 0, 300)
	require.Error(t, err)
	assert.EqualValues(t, 0, subscriptionSafetyUsed(t, 710006))

	result, err := PreConsumeUserSubscriptionForGroup("subscription-safety-snapshot-match", 710006, "test-model", "premium", 0, 300)
	require.NoError(t, err)
	assert.Equal(t, "premium", result.UpgradeGroup)
	assert.EqualValues(t, 300, subscriptionSafetyUsed(t, 710006))

	createSubscriptionSafetyPlan(t, 710007, "premium")
	createSubscriptionSafetySubscription(t, 710007, 710007, 710007, "", 0, true)

	result, err = PreConsumeUserSubscriptionForGroup("subscription-safety-snapshot-unscoped", 710007, "test-model", "default", 0, 300)
	require.NoError(t, err)
	assert.Empty(t, result.UpgradeGroup)
	assert.EqualValues(t, 300, subscriptionSafetyUsed(t, 710007))
}

func TestUserActiveSubscriptionsAllowWalletOverflowForGroupIgnoresMismatchedPlan(t *testing.T) {
	prepareSubscriptionSafetyTest(t)

	const userId = 710003
	createSubscriptionSafetyPlan(t, 710003, "premium")
	createSubscriptionSafetySubscription(t, 710003, userId, 710003, "premium", 0, false)

	allowed, err := UserActiveSubscriptionsAllowWalletOverflowForGroup(userId, "default")
	require.NoError(t, err)
	assert.True(t, allowed)

	allowed, err = UserActiveSubscriptionsAllowWalletOverflowForGroup(userId, "premium")
	require.NoError(t, err)
	assert.False(t, allowed)
}

func TestRefundSubscriptionPreConsumeIsIdempotent(t *testing.T) {
	prepareSubscriptionSafetyTest(t)

	const userId = 710004
	createSubscriptionSafetyPlan(t, 710004, "")
	createSubscriptionSafetySubscription(t, 710004, userId, 710004, "", 100, true)

	_, err := PreConsumeUserSubscription("subscription-safety-refund", userId, "test-model", 0, 300)
	require.NoError(t, err)
	assert.EqualValues(t, 400, subscriptionSafetyUsed(t, 710004))

	require.NoError(t, RefundSubscriptionPreConsume("subscription-safety-refund"))
	require.NoError(t, RefundSubscriptionPreConsume("subscription-safety-refund"))
	assert.EqualValues(t, 100, subscriptionSafetyUsed(t, 710004))

	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", "subscription-safety-refund").First(&record).Error)
	assert.Equal(t, "refunded", record.Status)
}
