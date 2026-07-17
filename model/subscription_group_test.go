package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseAndNormalizeSubscriptionAllowedGroups(t *testing.T) {
	assert.Empty(t, ParseSubscriptionAllowedGroups(""))
	assert.Empty(t, ParseSubscriptionAllowedGroups("  , , "))
	assert.Equal(t, []string{"vip", "pro"}, ParseSubscriptionAllowedGroups(" vip, pro,vip , "))
	assert.Equal(t, "", NormalizeSubscriptionAllowedGroups(" , "))
	assert.Equal(t, "vip,pro", NormalizeSubscriptionAllowedGroups(" vip, pro,vip "))
}

func TestSubscriptionCoversGroup(t *testing.T) {
	assert.True(t, SubscriptionCoversGroup("", "default"))
	assert.True(t, SubscriptionCoversGroup("", "vip"))
	assert.True(t, SubscriptionCoversGroup("vip,pro", "vip"))
	assert.True(t, SubscriptionCoversGroup("vip,pro", "pro"))
	assert.False(t, SubscriptionCoversGroup("vip,pro", "default"))
	assert.False(t, SubscriptionCoversGroup("vip", ""))
}

func TestHasActiveUserSubscriptionFiltersByAllowedGroups(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	seedSubscriptionResetSub(t, &UserSubscription{
		Id:            9401,
		UserId:        201,
		PlanId:        1,
		AmountTotal:   1000,
		AmountUsed:    0,
		StartTime:     now - 10,
		EndTime:       now + 3600,
		Status:        "active",
		AllowedGroups: "vip",
	})

	hasVip, err := HasActiveUserSubscription(201, "vip")
	require.NoError(t, err)
	assert.True(t, hasVip)

	hasDefault, err := HasActiveUserSubscription(201, "default")
	require.NoError(t, err)
	assert.False(t, hasDefault)

	seedSubscriptionResetSub(t, &UserSubscription{
		Id:            9402,
		UserId:        202,
		PlanId:        1,
		AmountTotal:   1000,
		AmountUsed:    0,
		StartTime:     now - 10,
		EndTime:       now + 3600,
		Status:        "active",
		AllowedGroups: "",
	})
	hasAll, err := HasActiveUserSubscription(202, "default")
	require.NoError(t, err)
	assert.True(t, hasAll)
}

func TestUserActiveSubscriptionsAllowWalletOverflowFiltersByGroup(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	seedSubscriptionResetSub(t, &UserSubscription{
		Id:                  9411,
		UserId:              301,
		PlanId:              1,
		AmountTotal:         1000,
		AmountUsed:          0,
		StartTime:           now - 10,
		EndTime:             now + 3600,
		Status:              "active",
		AllowedGroups:       "vip",
		AllowWalletOverflow: false,
	})
	seedSubscriptionResetSub(t, &UserSubscription{
		Id:                  9412,
		UserId:              301,
		PlanId:              2,
		AmountTotal:         1000,
		AmountUsed:          0,
		StartTime:           now - 10,
		EndTime:             now + 3600,
		Status:              "active",
		AllowedGroups:       "default",
		AllowWalletOverflow: true,
	})

	allowVip, err := UserActiveSubscriptionsAllowWalletOverflow(301, "vip")
	require.NoError(t, err)
	assert.False(t, allowVip)

	allowDefault, err := UserActiveSubscriptionsAllowWalletOverflow(301, "default")
	require.NoError(t, err)
	assert.True(t, allowDefault)

	allowOther, err := UserActiveSubscriptionsAllowWalletOverflow(301, "pro")
	require.NoError(t, err)
	assert.True(t, allowOther)
}

func TestPreConsumeUserSubscriptionRespectsAllowedGroups(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:            9501,
		Title:         "VIP Plan",
		PriceAmount:   10,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
		AllowedGroups: "vip",
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetSub(t, &UserSubscription{
		Id:            9511,
		UserId:        401,
		PlanId:        plan.Id,
		AmountTotal:   1000,
		AmountUsed:    0,
		StartTime:     now - 10,
		EndTime:       now + 3600,
		Status:        "active",
		AllowedGroups: "vip",
	})

	_, err := PreConsumeUserSubscription("req-default", 401, 100, "default")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no active subscription")

	result, err := PreConsumeUserSubscription("req-vip", 401, 100, "vip")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, 9511, result.UserSubscriptionId)
	assert.EqualValues(t, 100, result.PreConsumed)
	assert.EqualValues(t, 100, getSubscriptionResetSub(t, 9511).AmountUsed)
}

func TestCreateUserSubscriptionSnapshotsAllowedGroups(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:            9601,
		Title:         "Scoped",
		PriceAmount:   1,
		DurationUnit:  SubscriptionDurationDay,
		DurationValue: 1,
		TotalAmount:   500,
		AllowedGroups: " vip, default,vip ",
	}
	seedSubscriptionResetPlan(t, plan)

	// Pass DB directly (not nested Transaction): CreateUserSubscriptionFromPlanTx
	// calls GetDBTimestamp() on global DB; with MaxOpenConns(1) a nested
	// Transaction would deadlock.
	created, err := CreateUserSubscriptionFromPlanTx(DB, 501, plan, "admin")
	require.NoError(t, err)
	require.NotNil(t, created)
	assert.Equal(t, "vip,default", created.AllowedGroups)
}
