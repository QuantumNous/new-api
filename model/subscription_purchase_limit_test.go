package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestCheckSubscriptionPurchaseLimitTx_PeriodLimit(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       901,
		Username: "period-limit-user",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Id:                  902,
		Title:               "Period Limit Plan",
		PriceAmount:         1,
		Currency:            "USD",
		DurationUnit:        SubscriptionDurationMonth,
		DurationValue:       1,
		Enabled:             true,
		TotalAmount:         100,
		PeriodPurchaseLimit: 2,
		PeriodPurchaseUnit:  SubscriptionDurationDay,
		PeriodPurchaseValue: 1,
	}
	require.NoError(t, DB.Create(plan).Error)

	now := GetDBTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:    user.Id,
		PlanId:    plan.Id,
		StartTime: now - 2*24*3600,
		EndTime:   now + 3600,
		Status:    "active",
		Source:    "order",
	}).Error)
	require.NoError(t, CheckSubscriptionPurchaseLimitTx(DB, user.Id, plan))

	for i := 0; i < 2; i++ {
		require.NoError(t, DB.Create(&UserSubscription{
			UserId:    user.Id,
			PlanId:    plan.Id,
			StartTime: now - int64(i+1)*60,
			EndTime:   now + 3600,
			Status:    "active",
			Source:    "order",
		}).Error)
	}

	require.ErrorContains(t, CheckSubscriptionPurchaseLimitTx(DB, user.Id, plan), "已达到该套餐周期购买上限")
}
