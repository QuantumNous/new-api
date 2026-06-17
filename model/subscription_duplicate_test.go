package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateUserSubscriptionFromPlanTxRejectsDuplicateActivePlan(t *testing.T) {
	truncateTables(t)

	user := &User{
		Username: "duplicate-sub-user",
		Password: "password",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "Duplicate guarded plan",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  "month",
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
	}
	require.NoError(t, DB.Create(plan).Error)

	_, err := CreateUserSubscriptionFromPlanTx(DB, user.Id, plan, PaymentMethodBalance)
	require.NoError(t, err)

	_, err = CreateUserSubscriptionFromPlanTx(DB, user.Id, plan, PaymentMethodBalance)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "已存在有效订阅")

	var subCount int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", user.Id, plan.Id).Count(&subCount).Error)
	assert.EqualValues(t, 1, subCount)
}
