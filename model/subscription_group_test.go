package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedGroupPlan(t *testing.T, id int, upgradeGroup string) {
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

func seedGroupSubscription(t *testing.T, id, userID, planID int, used int64) {
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

func groupSubscriptionUsed(t *testing.T, id int) int64 {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Select("amount_used").Where("id = ?", id).First(&sub).Error)
	return sub.AmountUsed
}

func TestPreConsumeUserSubscriptionForGroupSkipsMismatchedPlanGroup(t *testing.T) {
	truncateTables(t)

	const userID = 6101
	seedGroupPlan(t, 6101, "MiniMax")
	seedGroupPlan(t, 6102, "default")
	seedGroupSubscription(t, 6101, userID, 6101, 0)
	seedGroupSubscription(t, 6102, userID, 6102, 0)

	res, err := PreConsumeUserSubscriptionForGroup("req-group-match", userID, "deepseek-v4", "default", 0, 300)
	require.NoError(t, err)

	assert.Equal(t, 6102, res.UserSubscriptionId)
	assert.EqualValues(t, 0, groupSubscriptionUsed(t, 6101))
	assert.EqualValues(t, 300, groupSubscriptionUsed(t, 6102))
}
