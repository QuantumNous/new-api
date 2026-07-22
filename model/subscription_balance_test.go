package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPurchaseSubscriptionWithBalanceRejectsZeroPricePlan(t *testing.T) {
	truncateTables(t)

	user := &User{
		Username: "zero-price-user",
		Password: "password",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    1000,
	}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "Zero price plan",
		PriceAmount:   0,
		Currency:      "USD",
		DurationUnit:  "month",
		DurationValue: 1,
		Enabled:       true,
		UpgradeGroup:  "claude",
		TotalAmount:   1000,
	}
	require.NoError(t, DB.Create(plan).Error)

	err := PurchaseSubscriptionWithBalance(user.Id, plan.Id)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "必须大于 0")

	var subCount int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", user.Id).Count(&subCount).Error)
	assert.EqualValues(t, 0, subCount)

	var orderCount int64
	require.NoError(t, DB.Model(&SubscriptionOrder{}).Where("user_id = ?", user.Id).Count(&orderCount).Error)
	assert.EqualValues(t, 0, orderCount)

	var reloaded User
	require.NoError(t, DB.First(&reloaded, user.Id).Error)
	assert.Equal(t, "default", reloaded.Group)
	assert.Equal(t, 1000, reloaded.Quota)
}
