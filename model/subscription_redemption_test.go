package model

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func subscriptionRedemptionPlan(id int, title string) *SubscriptionPlan {
	allowWalletOverflow := true
	return &SubscriptionPlan{
		Id:                  id,
		Title:               title,
		PriceAmount:         19,
		Currency:            "USD",
		DurationUnit:        SubscriptionDurationMonth,
		DurationValue:       1,
		Enabled:             true,
		MaxActivePerUser:    1,
		TotalAmount:         80_000_000,
		WeeklyAmount:        40_000_000,
		QuotaResetPeriod:    SubscriptionResetNever,
		AllowWalletOverflow: &allowWalletOverflow,
	}
}

func subscriptionRedemptionUser(t *testing.T, username string) *User {
	t.Helper()
	user := &User{Username: username, Password: "password", Status: common.UserStatusEnabled, AffCode: username}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func TestSubscriptionRedemptionUsesFrozenPlanSnapshot(t *testing.T) {
	truncateTables(t)
	plan := subscriptionRedemptionPlan(81_001, "Starter")
	require.NoError(t, DB.Create(plan).Error)
	user := subscriptionRedemptionUser(t, "subscription-redemption-snapshot")

	created, err := CreateSubscriptionRedemptions(1, "store-starter-2026-08", plan.Id, 1, common.GetTimestamp()+180*24*3600)
	require.NoError(t, err)
	require.Len(t, created.Codes, 1)
	assert.True(t, strings.HasPrefix(created.Codes[0], SubscriptionRedemptionPrefix))

	var stored SubscriptionRedemption
	require.NoError(t, DB.Where("plan_id = ?", plan.Id).First(&stored).Error)
	assert.NotEqual(t, created.Codes[0], stored.KeyHash, "plaintext bearer code must not be stored")
	assert.Contains(t, stored.KeyHint, created.Codes[0][len(created.Codes[0])-6:])

	// Selling terms are those from code issuance, not whatever the plan happens
	// to say when the buyer activates it later.
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"title":         "Starter v2",
		"total_amount":  1,
		"weekly_amount": 1,
	}).Error)

	before := common.GetTimestamp()
	result, err := RedeemSubscription(created.Codes[0], user.Id)
	after := common.GetTimestamp()
	require.NoError(t, err)
	require.NotNil(t, result.Subscription)
	assert.Equal(t, "Starter", result.PlanTitle)
	assert.EqualValues(t, 80_000_000, result.Subscription.AmountTotal)
	assert.EqualValues(t, 40_000_000, result.Subscription.WeeklyAmountTotal)
	assert.Equal(t, "redemption", result.Subscription.Source)
	assert.Equal(t, fmt.Sprintf("subscription_redemption:%d", stored.Id), result.Subscription.SourceRef)
	assert.GreaterOrEqual(t, result.Subscription.StartTime, before)
	assert.LessOrEqual(t, result.Subscription.StartTime, after)
	assert.Equal(t, time.Unix(result.Subscription.StartTime, 0).AddDate(0, 1, 0).Unix(), result.Subscription.EndTime)

	require.NoError(t, DB.First(&stored, stored.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, stored.Status)
	assert.Equal(t, user.Id, stored.UsedUserId)
	_, err = RedeemSubscription(created.Codes[0], user.Id)
	require.Error(t, err)

	var subscriptionCount int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).Count(&subscriptionCount).Error)
	assert.EqualValues(t, 1, subscriptionCount)
}

func TestSubscriptionRedemptionActiveLimitLeavesCodeUnused(t *testing.T) {
	truncateTables(t)
	plan := subscriptionRedemptionPlan(81_002, "Pro")
	require.NoError(t, DB.Create(plan).Error)
	user := subscriptionRedemptionUser(t, "subscription-redemption-active")
	created, err := CreateSubscriptionRedemptions(1, "store-pro-2026-08", plan.Id, 1, 0)
	require.NoError(t, err)

	now := common.GetTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId: user.Id, PlanId: plan.Id, AmountTotal: 10, StartTime: now - 10, EndTime: now + 3600, Status: "active",
	}).Error)

	_, err = RedeemSubscription(created.Codes[0], user.Id)
	require.Error(t, err)

	var stored SubscriptionRedemption
	require.NoError(t, DB.Where("plan_id = ?", plan.Id).First(&stored).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, stored.Status)
	assert.Zero(t, stored.UsedUserId)
	assert.Zero(t, stored.RedeemedTime)
}

func TestDisableSubscriptionRedemptionsOnlyDisablesUnusedCodes(t *testing.T) {
	truncateTables(t)
	plan := subscriptionRedemptionPlan(81_003, "Scale")
	require.NoError(t, DB.Create(plan).Error)
	user := subscriptionRedemptionUser(t, "subscription-redemption-disable")
	created, err := CreateSubscriptionRedemptions(1, "store-scale-2026-08", plan.Id, 2, 0)
	require.NoError(t, err)
	require.Len(t, created.Codes, 2)
	_, err = RedeemSubscription(created.Codes[0], user.Id)
	require.NoError(t, err)

	disabled, err := DisableSubscriptionRedemptions(created.Codes)
	require.NoError(t, err)
	assert.EqualValues(t, 1, disabled)

	_, err = RedeemSubscription(created.Codes[1], subscriptionRedemptionUser(t, "subscription-redemption-disabled-user").Id)
	require.Error(t, err)
}
