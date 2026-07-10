package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedPreConsumePlan(t *testing.T, id int, upgradeGroup string) {
	t.Helper()
	require.NoError(t, DB.Create(&SubscriptionPlan{
		Id:               id,
		Title:            "plan",
		PriceAmount:      1,
		Currency:         "USD",
		DurationUnit:     "month",
		DurationValue:    1,
		Enabled:          true,
		UpgradeGroup:     upgradeGroup,
		TotalAmount:      10000,
		QuotaResetPeriod: SubscriptionResetNever,
	}).Error)
}

func seedPreConsumeSubscription(t *testing.T, id, userID, planID int, used int64) {
	t.Helper()
	require.NoError(t, DB.Create(&UserSubscription{
		Id:          id,
		UserId:      userID,
		PlanId:      planID,
		AmountTotal: 10000,
		AmountUsed:  used,
		StartTime:   time.Now().Add(-time.Hour).Unix(),
		EndTime:     time.Now().Add(time.Hour).Unix(),
		Status:      "active",
	}).Error)
}

func getPreConsumeSubscriptionUsed(t *testing.T, id int) int64 {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Select("amount_used").Where("id = ?", id).First(&sub).Error)
	return sub.AmountUsed
}

func TestPreConsumeUserSubscriptionForGroupSkipsMismatchedPlanGroup(t *testing.T) {
	truncateTables(t)

	const userID = 6101
	seedPreConsumePlan(t, 6101, "MiniMax")
	seedPreConsumePlan(t, 6102, "default")
	seedPreConsumeSubscription(t, 6101, userID, 6101, 0)
	seedPreConsumeSubscription(t, 6102, userID, 6102, 0)

	res, err := PreConsumeUserSubscriptionForGroup("req-group-match", userID, "deepseek-v4", "default", 0, 300)
	require.NoError(t, err)

	assert.Equal(t, 6102, res.UserSubscriptionId)
	assert.EqualValues(t, 0, getPreConsumeSubscriptionUsed(t, 6101))
	assert.EqualValues(t, 300, getPreConsumeSubscriptionUsed(t, 6102))
}

func TestRefundSubscriptionPreConsumeIsIdempotentAndUpdatesRecord(t *testing.T) {
	truncateTables(t)

	const userID = 6201
	seedPreConsumePlan(t, 6201, "default")
	seedPreConsumeSubscription(t, 6201, userID, 6201, 100)

	_, err := PreConsumeUserSubscriptionForGroup("req-refund", userID, "deepseek-v4", "default", 0, 300)
	require.NoError(t, err)
	assert.EqualValues(t, 400, getPreConsumeSubscriptionUsed(t, 6201))

	require.NoError(t, RefundSubscriptionPreConsume("req-refund"))
	require.NoError(t, RefundSubscriptionPreConsume("req-refund"))

	assert.EqualValues(t, 100, getPreConsumeSubscriptionUsed(t, 6201))

	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", "req-refund").First(&record).Error)
	assert.Equal(t, "refunded", record.Status)
}
