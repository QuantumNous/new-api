package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
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

func countTopUpLogsForPaymentGuardTest(t *testing.T, userID int) int64 {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&Log{}).Where("user_id = ? AND type = ?", userID, LogTypeTopup).Count(&count).Error)
	return count
}

func insertRedemptionForPaymentGuardTest(t *testing.T, key string, quota int) {
	t.Helper()
	redemption := &Redemption{
		Key:    key,
		Status: common.RedemptionCodeStatusEnabled,
		Quota:  quota,
	}
	require.NoError(t, DB.Create(redemption).Error)
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

func TestRechargeStripe_IdempotentSuccessOnlyCreditsAndLogsOnce(t *testing.T) {
	truncateTables(t)

	userID := 904
	tradeNo := "stripe-idempotent-guard"
	insertUserForPaymentGuardTest(t, userID, 10)
	insertTopUpForPaymentGuardTest(t, tradeNo, userID, PaymentProviderStripe)

	expectedQuota := int(decimal.NewFromFloat(9.99).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())

	require.NoError(t, Recharge(tradeNo, "cus_guard", "127.0.0.1"))
	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, tradeNo))
	assert.Equal(t, 10+expectedQuota, getUserQuotaForPaymentGuardTest(t, userID))

	require.NoError(t, Recharge(tradeNo, "cus_guard", "127.0.0.1"))
	assert.Equal(t, 10+expectedQuota, getUserQuotaForPaymentGuardTest(t, userID))
	assert.Equal(t, int64(1), countTopUpLogsForPaymentGuardTest(t, userID))
}

func TestRechargeStripe_RollsBackWhenUserQuotaUpdateFails(t *testing.T) {
	truncateTables(t)

	tradeNo := "stripe-missing-user-guard"
	insertTopUpForPaymentGuardTest(t, tradeNo, 905, PaymentProviderStripe)

	err := Recharge(tradeNo, "cus_missing", "127.0.0.1")
	require.Error(t, err)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
}

func TestRechargeEpay_IdempotentSuccessOnlyCreditsOnce(t *testing.T) {
	truncateTables(t)

	userID := 901
	tradeNo := "epay-idempotent-guard"
	insertUserForPaymentGuardTest(t, userID, 10)
	insertTopUpForPaymentGuardTest(t, tradeNo, userID, PaymentProviderEpay)

	expectedQuota := int(decimal.NewFromInt(2).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())

	result, err := RechargeEpay(tradeNo, "alipay")
	require.NoError(t, err)
	require.NotNil(t, result)
	require.False(t, result.AlreadyProcessed)
	assert.Equal(t, expectedQuota, result.QuotaToAdd)
	assert.Equal(t, "alipay", result.PaymentMethod)
	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, tradeNo))
	assert.Equal(t, 10+expectedQuota, getUserQuotaForPaymentGuardTest(t, userID))

	result, err = RechargeEpay(tradeNo, "alipay")
	require.NoError(t, err)
	require.NotNil(t, result)
	require.True(t, result.AlreadyProcessed)
	assert.Equal(t, 10+expectedQuota, getUserQuotaForPaymentGuardTest(t, userID))
}

func TestRechargeEpay_RollsBackWhenUserQuotaUpdateFails(t *testing.T) {
	truncateTables(t)

	tradeNo := "epay-missing-user-guard"
	insertTopUpForPaymentGuardTest(t, tradeNo, 902, PaymentProviderEpay)

	_, err := RechargeEpay(tradeNo, "alipay")
	require.Error(t, err)

	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	assert.Equal(t, PaymentProviderEpay, topUp.PaymentMethod)
}

func TestRechargeEpay_RejectsMismatchedPaymentProvider(t *testing.T) {
	truncateTables(t)

	userID := 903
	tradeNo := "epay-provider-guard"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertTopUpForPaymentGuardTest(t, tradeNo, userID, PaymentProviderStripe)

	_, err := RechargeEpay(tradeNo, "alipay")
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, userID))
}

func TestRechargeCreem_RollsBackWhenUserQuotaUpdateFails(t *testing.T) {
	truncateTables(t)

	tradeNo := "creem-missing-user-guard"
	insertTopUpForPaymentGuardTest(t, tradeNo, 906, PaymentProviderCreem)

	err := RechargeCreem(tradeNo, "", "", "127.0.0.1")
	require.Error(t, err)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
}

func TestRechargeWaffo_RollsBackWhenUserQuotaUpdateFails(t *testing.T) {
	truncateTables(t)

	tradeNo := "waffo-missing-user-guard"
	insertTopUpForPaymentGuardTest(t, tradeNo, 907, PaymentProviderWaffo)

	err := RechargeWaffo(tradeNo, "127.0.0.1")
	require.Error(t, err)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
}

func TestRechargeWaffoPancake_RollsBackWhenUserQuotaUpdateFails(t *testing.T) {
	truncateTables(t)

	tradeNo := "waffo-pancake-missing-user-guard"
	insertTopUpForPaymentGuardTest(t, tradeNo, 908, PaymentProviderWaffoPancake)

	err := RechargeWaffoPancake(tradeNo)
	require.Error(t, err)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
}

func TestManualCompleteTopUp_RollsBackWhenUserQuotaUpdateFails(t *testing.T) {
	truncateTables(t)

	tradeNo := "manual-missing-user-guard"
	insertTopUpForPaymentGuardTest(t, tradeNo, 909, PaymentProviderEpay)

	err := ManualCompleteTopUp(tradeNo, "127.0.0.1")
	require.Error(t, err)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
}

func TestManualCompleteTopUp_IdempotentSuccessSkipsDuplicateLog(t *testing.T) {
	truncateTables(t)

	userID := 910
	tradeNo := "manual-idempotent-guard"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertTopUpForPaymentGuardTest(t, tradeNo, userID, PaymentProviderEpay)

	require.NoError(t, ManualCompleteTopUp(tradeNo, "127.0.0.1"))
	require.NoError(t, ManualCompleteTopUp(tradeNo, "127.0.0.1"))
	assert.Equal(t, int64(1), countTopUpLogsForPaymentGuardTest(t, userID))
}

func TestRedeem_RollsBackWhenUserQuotaUpdateFails(t *testing.T) {
	truncateTables(t)

	key := "redeem_missing_user_guard_0001"
	insertRedemptionForPaymentGuardTest(t, key, 100)

	_, err := Redeem(key, 911)
	require.Error(t, err)

	var redemption Redemption
	require.NoError(t, DB.Where("key = ?", key).First(&redemption).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, redemption.Status)
	assert.Equal(t, 0, redemption.UsedUserId)
}

func TestTransferAffQuotaToQuotaRejectsOverTransfer(t *testing.T) {
	truncateTables(t)

	quotaUnit := int(common.QuotaPerUnit)
	userID := 912
	user := &User{
		Id:       userID,
		Username: "aff_transfer_guard_user",
		Status:   common.UserStatusEnabled,
		Quota:    5,
		AffQuota: quotaUnit,
	}
	require.NoError(t, DB.Create(user).Error)

	err := (&User{Id: userID}).TransferAffQuotaToQuota(quotaUnit + 1)
	require.Error(t, err)

	var reloaded User
	require.NoError(t, DB.Where("id = ?", userID).First(&reloaded).Error)
	assert.Equal(t, 5, reloaded.Quota)
	assert.Equal(t, quotaUnit, reloaded.AffQuota)
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
