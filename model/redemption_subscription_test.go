package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertUserForRedemptionTest(t *testing.T, id int, quota int) {
	t.Helper()
	user := &User{
		Id:       id,
		Username: "redemption_user",
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		Group:    "default",
	}
	require.NoError(t, DB.Create(user).Error)
}

func insertSubscriptionPlanForRedemptionTest(t *testing.T, id int) *SubscriptionPlan {
	t.Helper()
	plan := &SubscriptionPlan{
		Id:            id,
		Title:         "Redemption Plan",
		PriceAmount:   0,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   12345,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func TestRedeemSubscriptionCodeCreatesUserSubscription(t *testing.T) {
	truncateTables(t)

	insertUserForRedemptionTest(t, 501, 99)
	plan := insertSubscriptionPlanForRedemptionTest(t, 601)
	code := &Redemption{
		UserId:             1,
		Key:                "subscription-redemption-code",
		Status:             common.RedemptionCodeStatusEnabled,
		Name:               "Plan Code",
		RedemptionType:     RedemptionTypeSubscription,
		SubscriptionPlanId: plan.Id,
		CreatedTime:        common.GetTimestamp(),
	}
	require.NoError(t, code.Insert())

	result, err := Redeem(code.Key, 501)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, RedemptionTypeSubscription, result.RedemptionType)
	assert.Equal(t, plan.Id, result.SubscriptionPlanId)
	assert.Equal(t, plan.Title, result.SubscriptionPlanTitle)
	assert.Greater(t, result.SubscriptionId, 0)
	assert.Zero(t, result.Quota)

	var sub UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", 501, plan.Id).First(&sub).Error)
	assert.Equal(t, "redemption", sub.Source)
	assert.Equal(t, "active", sub.Status)
	assert.Equal(t, plan.TotalAmount, sub.AmountTotal)

	var user User
	require.NoError(t, DB.Select("quota").Where("id = ?", 501).First(&user).Error)
	assert.Equal(t, 99, user.Quota)

	var redeemed Redemption
	require.NoError(t, DB.Where("id = ?", code.Id).First(&redeemed).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, redeemed.Status)
	assert.Equal(t, 501, redeemed.UsedUserId)
	assert.Greater(t, redeemed.RedeemedTime, int64(0))
}

func TestRedeemQuotaCodeKeepsQuotaBehavior(t *testing.T) {
	truncateTables(t)

	insertUserForRedemptionTest(t, 502, 99)
	code := &Redemption{
		UserId:         1,
		Key:            "quota-redemption-code",
		Status:         common.RedemptionCodeStatusEnabled,
		Name:           "Quota Code",
		RedemptionType: RedemptionTypeQuota,
		Quota:          123,
		CreatedTime:    common.GetTimestamp(),
	}
	require.NoError(t, code.Insert())

	result, err := Redeem(code.Key, 502)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, RedemptionTypeQuota, result.RedemptionType)
	assert.Equal(t, 123, result.Quota)
	assert.Zero(t, result.SubscriptionPlanId)
	assert.Zero(t, result.SubscriptionId)

	var user User
	require.NoError(t, DB.Select("quota").Where("id = ?", 502).First(&user).Error)
	assert.Equal(t, 222, user.Quota)

	var subCount int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 502).Count(&subCount).Error)
	assert.Zero(t, subCount)

	var redeemed Redemption
	require.NoError(t, DB.Where("id = ?", code.Id).First(&redeemed).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, redeemed.Status)
	assert.Equal(t, 502, redeemed.UsedUserId)
	assert.Greater(t, redeemed.RedeemedTime, int64(0))
}
