package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestRedeemSubscriptionCreatesUserSubscription(t *testing.T) {
	truncateTables(t)

	user := &User{
		Username:    "trial-user",
		Password:    "password123",
		DisplayName: "trial-user",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
	}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "7 day trial",
		PriceAmount:   0,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationDay,
		DurationValue: 7,
		Enabled:       false,
		TotalAmount:   1500000,
	}
	require.NoError(t, DB.Create(plan).Error)

	redemption := &Redemption{
		UserId:      1,
		Key:         "subscription-code",
		Status:      common.RedemptionCodeStatusEnabled,
		Name:        "trial",
		Type:        RedemptionTypeSubscription,
		PlanId:      plan.Id,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem("subscription-code", user.Id)
	require.NoError(t, err)
	require.Equal(t, RedemptionTypeSubscription, result.Type)
	require.Equal(t, plan.Id, result.PlanId)
	require.Equal(t, plan.Title, result.PlanTitle)
	require.NotZero(t, result.SubscriptionId)

	var updatedRedemption Redemption
	require.NoError(t, DB.First(&updatedRedemption, redemption.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusUsed, updatedRedemption.Status)
	require.Equal(t, user.Id, updatedRedemption.UsedUserId)

	var subscription UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).First(&subscription).Error)
	require.Equal(t, "active", subscription.Status)
	require.EqualValues(t, plan.TotalAmount, subscription.AmountTotal)
	require.Greater(t, subscription.EndTime, subscription.StartTime)

	var updatedUser User
	require.NoError(t, DB.First(&updatedUser, user.Id).Error)
	require.Zero(t, updatedUser.Quota)
}

func TestRedeemLegacyQuotaCodeKeepsBalanceBehavior(t *testing.T) {
	truncateTables(t)

	user := &User{
		Username:    "quota-user",
		Password:    "password123",
		DisplayName: "quota-user",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
	}
	require.NoError(t, DB.Create(user).Error)

	redemption := &Redemption{
		UserId:      1,
		Key:         "quota-code",
		Status:      common.RedemptionCodeStatusEnabled,
		Name:        "quota",
		Quota:       1234,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem("quota-code", user.Id)
	require.NoError(t, err)
	require.Equal(t, RedemptionTypeQuota, result.Type)
	require.Equal(t, 1234, result.Quota)

	var updatedUser User
	require.NoError(t, DB.First(&updatedUser, user.Id).Error)
	require.Equal(t, 1234, updatedUser.Quota)
}
