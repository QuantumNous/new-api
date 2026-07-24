package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertUserForPaymentGuardTest(t *testing.T, id int, quota int) {
	t.Helper()
	user := &User{
		Id:       id,
		Username: "payment_guard_user",
		Status:   common.UserStatusEnabled,
		Quota:    quota,
	}
	require.NoError(t, DB.Create(user).Error)
}

func insertSubscriptionPlanForPaymentGuardTest(t *testing.T, id int) *SubscriptionPlan {
	t.Helper()
	plan := &SubscriptionPlan{
		Id:            id,
		Title:         "Guard Plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func insertSubscriptionOrderForPaymentGuardTest(t *testing.T, tradeNo string, userID int, planID int, paymentProvider string) {
	t.Helper()
	order := &SubscriptionOrder{
		UserId:          userID,
		PlanId:          planID,
		Money:           9.99,
		TradeNo:         tradeNo,
		PaymentMethod:   paymentProvider,
		PaymentProvider: paymentProvider,
		Status:          common.TopUpStatusPending,
		CreateTime:      time.Now().Unix(),
	}
	require.NoError(t, order.Insert())
}

func insertTopUpForPaymentGuardTest(t *testing.T, tradeNo string, userID int, paymentProvider string) {
	t.Helper()
	topUp := &TopUp{
		UserId:          userID,
		Amount:          2,
		Money:           9.99,
		TradeNo:         tradeNo,
		PaymentMethod:   paymentProvider,
		PaymentProvider: paymentProvider,
		Status:          common.TopUpStatusPending,
		CreateTime:      time.Now().Unix(),
	}
	require.NoError(t, topUp.Insert())
}

func getTopUpStatusForPaymentGuardTest(t *testing.T, tradeNo string) string {
	t.Helper()
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	return topUp.Status
}

func countUserSubscriptionsForPaymentGuardTest(t *testing.T, userID int) int64 {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", userID).Count(&count).Error)
	return count
}

func getUserQuotaForPaymentGuardTest(t *testing.T, userID int) int {
	t.Helper()
	var user User
	require.NoError(t, DB.Select("quota").Where("id = ?", userID).First(&user).Error)
	return user.Quota
}

func TestRechargeWaffoPancake_RejectsMismatchedPaymentMethod(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 101, 0)
	insertTopUpForPaymentGuardTest(t, "waffo-pancake-guard", 101, PaymentProviderStripe)

	err := RechargeWaffoPancake("waffo-pancake-guard")
	require.Error(t, err)

	topUp := GetTopUpByTradeNo("waffo-pancake-guard")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, 101))
}

func TestUpdatePendingTopUpStatus_RejectsMismatchedPaymentProvider(t *testing.T) {
	testCases := []struct {
		name                    string
		tradeNo                 string
		storedPaymentProvider   string
		expectedPaymentProvider string
		targetStatus            string
	}{
		{
			name:                    "stripe expire",
			tradeNo:                 "stripe-expire-guard",
			storedPaymentProvider:   PaymentProviderCreem,
			expectedPaymentProvider: PaymentProviderStripe,
			targetStatus:            common.TopUpStatusExpired,
		},
		{
			name:                    "waffo failed",
			tradeNo:                 "waffo-failed-guard",
			storedPaymentProvider:   PaymentProviderStripe,
			expectedPaymentProvider: PaymentProviderWaffo,
			targetStatus:            common.TopUpStatusFailed,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			insertUserForPaymentGuardTest(t, 150, 0)
			insertTopUpForPaymentGuardTest(t, tc.tradeNo, 150, tc.storedPaymentProvider)

			err := UpdatePendingTopUpStatus(tc.tradeNo, tc.expectedPaymentProvider, tc.targetStatus)
			require.ErrorIs(t, err, ErrPaymentMethodMismatch)
			assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tc.tradeNo))
		})
	}
}

func TestCompleteSubscriptionOrder_RejectsMismatchedPaymentProvider(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 202, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 301)
	insertSubscriptionOrderForPaymentGuardTest(t, "sub-guard-order", 202, plan.Id, PaymentProviderStripe)

	err := CompleteSubscriptionOrder("sub-guard-order", `{"provider":"epay"}`, PaymentProviderEpay, "alipay")
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)

	order := GetSubscriptionOrderByTradeNo("sub-guard-order")
	require.NotNil(t, order)
	assert.Equal(t, common.TopUpStatusPending, order.Status)
	assert.Zero(t, countUserSubscriptionsForPaymentGuardTest(t, 202))

	topUp := GetTopUpByTradeNo("sub-guard-order")
	assert.Nil(t, topUp)
}

func TestExpireSubscriptionOrder_RejectsMismatchedPaymentProvider(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 303, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 401)
	insertSubscriptionOrderForPaymentGuardTest(t, "sub-expire-guard", 303, plan.Id, PaymentProviderStripe)

	err := ExpireSubscriptionOrder("sub-expire-guard", PaymentProviderCreem)
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)

	order := GetSubscriptionOrderByTradeNo("sub-expire-guard")
	require.NotNil(t, order)
	assert.Equal(t, common.TopUpStatusPending, order.Status)
}

func createSubscriptionExpiryUser(t *testing.T, username string, group string) int {
	t.Helper()
	user := &User{
		Username: username,
		Password: "password",
		Group:    group,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)
	return user.Id
}

func createSubscriptionExpirySub(t *testing.T, sub UserSubscription) {
	t.Helper()
	require.NoError(t, DB.Create(&sub).Error)
}

func getSubscriptionExpiryUserGroup(t *testing.T, userId int) string {
	t.Helper()
	var group string
	require.NoError(t, DB.Model(&User{}).Where("id = ?", userId).Select(commonGroupCol).Find(&group).Error)
	return group
}

func TestExpireDueSubscriptionsRevertsExpiredChainToBaseGroup(t *testing.T) {
	truncateTables(t)

	userId := createSubscriptionExpiryUser(t, "chain-user", "enterprise")
	now := GetDBTimestamp()
	createSubscriptionExpirySub(t, UserSubscription{
		UserId:        userId,
		PlanId:        1,
		EndTime:       now - 60,
		Status:        "active",
		UpgradeGroup:  "pro",
		PrevUserGroup: "basic",
	})
	createSubscriptionExpirySub(t, UserSubscription{
		UserId:        userId,
		PlanId:        2,
		EndTime:       now - 30,
		Status:        "active",
		UpgradeGroup:  "enterprise",
		PrevUserGroup: "pro",
	})

	expired, err := ExpireDueSubscriptions(200)
	require.NoError(t, err)
	assert.Equal(t, 2, expired)
	assert.Equal(t, "basic", getSubscriptionExpiryUserGroup(t, userId))
}

func TestExpireDueSubscriptionsKeepsGroupWhenActiveUpgradeRemains(t *testing.T) {
	truncateTables(t)

	userId := createSubscriptionExpiryUser(t, "active-upgrade-user", "enterprise")
	now := GetDBTimestamp()
	createSubscriptionExpirySub(t, UserSubscription{
		UserId:        userId,
		PlanId:        1,
		EndTime:       now - 60,
		Status:        "active",
		UpgradeGroup:  "pro",
		PrevUserGroup: "basic",
	})
	createSubscriptionExpirySub(t, UserSubscription{
		UserId:        userId,
		PlanId:        2,
		EndTime:       now + 3600,
		Status:        "active",
		UpgradeGroup:  "enterprise",
		PrevUserGroup: "pro",
	})

	expired, err := ExpireDueSubscriptions(200)
	require.NoError(t, err)
	assert.Equal(t, 1, expired)
	assert.Equal(t, "enterprise", getSubscriptionExpiryUserGroup(t, userId))
}

func TestExpireDueSubscriptionsUsesLatestExplicitDowngradeGroup(t *testing.T) {
	truncateTables(t)

	userId := createSubscriptionExpiryUser(t, "explicit-downgrade-user", "enterprise")
	now := GetDBTimestamp()
	createSubscriptionExpirySub(t, UserSubscription{
		UserId:         userId,
		PlanId:         1,
		EndTime:        now - 60,
		Status:         "active",
		UpgradeGroup:   "pro",
		PrevUserGroup:  "basic",
		DowngradeGroup: "basic",
	})
	createSubscriptionExpirySub(t, UserSubscription{
		UserId:         userId,
		PlanId:         2,
		EndTime:        now - 30,
		Status:         "active",
		UpgradeGroup:   "enterprise",
		PrevUserGroup:  "pro",
		DowngradeGroup: "vip",
	})

	expired, err := ExpireDueSubscriptions(200)
	require.NoError(t, err)
	assert.Equal(t, 2, expired)
	assert.Equal(t, "vip", getSubscriptionExpiryUserGroup(t, userId))
}

func TestExpireDueSubscriptionsKeepsGroupForIncompleteChain(t *testing.T) {
	truncateTables(t)

	userId := createSubscriptionExpiryUser(t, "broken-chain-user", "enterprise")
	now := GetDBTimestamp()
	createSubscriptionExpirySub(t, UserSubscription{
		UserId:        userId,
		PlanId:        1,
		EndTime:       now - 60,
		Status:        "active",
		UpgradeGroup:  "pro",
		PrevUserGroup: "basic",
	})

	expired, err := ExpireDueSubscriptions(200)
	require.NoError(t, err)
	assert.Equal(t, 1, expired)
	assert.Equal(t, "enterprise", getSubscriptionExpiryUserGroup(t, userId))
}
