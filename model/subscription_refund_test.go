package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedRefundPlan(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, DB.Create(&SubscriptionPlan{
		Id:               id,
		Title:            "plan",
		PriceAmount:      1,
		Currency:         "USD",
		DurationUnit:     "month",
		DurationValue:    1,
		Enabled:          true,
		TotalAmount:      10000,
		QuotaResetPeriod: SubscriptionResetNever,
	}).Error)
}

func seedRefundSubscription(t *testing.T, id, userID, planID int, used int64) {
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

func refundSubscriptionUsed(t *testing.T, id int) int64 {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Select("amount_used").Where("id = ?", id).First(&sub).Error)
	return sub.AmountUsed
}

func TestRefundSubscriptionPreConsumeIsIdempotentAndUpdatesRecord(t *testing.T) {
	truncateTables(t)

	const userID = 6201
	seedRefundPlan(t, 6201)
	seedRefundSubscription(t, 6201, userID, 6201, 100)

	_, err := PreConsumeUserSubscription("req-refund", userID, "deepseek-v4", 0, 300)
	require.NoError(t, err)
	assert.EqualValues(t, 400, refundSubscriptionUsed(t, 6201))

	require.NoError(t, RefundSubscriptionPreConsume("req-refund"))
	require.NoError(t, RefundSubscriptionPreConsume("req-refund"))

	assert.EqualValues(t, 100, refundSubscriptionUsed(t, 6201))

	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", "req-refund").First(&record).Error)
	assert.Equal(t, "refunded", record.Status)
}
