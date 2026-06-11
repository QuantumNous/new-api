package model

import (
	"sync"
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

func TestRechargePaddle_DuplicateWebhookAddsQuotaOnce(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 111, 0)
	insertTopUpForPaymentGuardTest(t, "paddle-duplicate-guard", 111, PaymentProviderPaddle)

	require.NoError(t, RechargePaddle("paddle-duplicate-guard", 111, "txn_duplicate_guard", "127.0.0.1"))
	require.NoError(t, RechargePaddle("paddle-duplicate-guard", 111, "txn_duplicate_guard", "127.0.0.1"))

	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, "paddle-duplicate-guard"))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 111))
	topUp := GetTopUpByTradeNo("paddle-duplicate-guard")
	require.NotNil(t, topUp)
	assert.Equal(t, "txn_duplicate_guard", topUp.GatewayTradeNo)
}

func TestRechargeStripeCreditsPurchasedAmountAndIsIdempotent(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 113, 0)
	insertTopUpForPaymentGuardTest(t, "stripe-amount-guard", 113, PaymentProviderStripe)

	require.NoError(t, Recharge("stripe-amount-guard", "cus_guard", "127.0.0.1"))
	require.NoError(t, Recharge("stripe-amount-guard", "cus_guard", "127.0.0.1"))

	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, "stripe-amount-guard"))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 113))

	var user User
	require.NoError(t, DB.Select("stripe_customer").Where("id = ?", 113).First(&user).Error)
	assert.Equal(t, "cus_guard", user.StripeCustomer)
}

func TestTopUpPersistsGAIdentifiers(t *testing.T) {
	truncateTables(t)

	topUp := &TopUp{
		UserId:          1,
		Amount:          2,
		Money:           3.5,
		TradeNo:         "ga-identifiers-guard",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      123,
		Status:          common.TopUpStatusPending,
		GAClientID:      "123.456",
		GASessionID:     "789",
	}
	require.NoError(t, topUp.Insert())

	stored := GetTopUpByTradeNo("ga-identifiers-guard")
	require.NotNil(t, stored)
	assert.Equal(t, "123.456", stored.GAClientID)
	assert.Equal(t, "789", stored.GASessionID)
}

func TestRechargePaddle_ConcurrentWebhookAddsQuotaOnce(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 112, 0)
	insertTopUpForPaymentGuardTest(t, "paddle-concurrent-guard", 112, PaymentProviderPaddle)

	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < cap(errs); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- RechargePaddle("paddle-concurrent-guard", 112, "txn_concurrent_guard", "127.0.0.1")
		}()
	}
	wg.Wait()
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}
	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, "paddle-concurrent-guard"))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 112))
}

func TestRechargePaddle_RejectsMismatchedUser(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 113, 0)
	insertTopUpForPaymentGuardTest(t, "paddle-user-guard", 113, PaymentProviderPaddle)

	err := RechargePaddle("paddle-user-guard", 114, "txn_user_guard", "127.0.0.1")
	require.Error(t, err)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, "paddle-user-guard"))
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, 113))
}

func TestRechargePaddle_RejectsMismatchedGatewayTradeNo(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 114, 0)
	insertTopUpForPaymentGuardTest(t, "paddle-gateway-guard", 114, PaymentProviderPaddle)
	require.NoError(t, DB.Model(&TopUp{}).
		Where("trade_no = ?", "paddle-gateway-guard").
		Update("gateway_trade_no", "txn_expected_guard").Error)

	err := RechargePaddle("paddle-gateway-guard", 114, "txn_other_guard", "127.0.0.1")
	require.Error(t, err)

	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, "paddle-gateway-guard"))
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, 114))
}

func TestAttachPaddleGatewayTradeNoOnlyUpdatesPendingPaddleOrder(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 117, 0)
	insertTopUpForPaymentGuardTest(t, "paddle-attach-guard", 117, PaymentProviderPaddle)

	require.NoError(t, AttachPaddleGatewayTradeNo("paddle-attach-guard", 117, "txn_attach_guard"))
	topUp := GetTopUpByTradeNo("paddle-attach-guard")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	assert.Equal(t, "txn_attach_guard", topUp.GatewayTradeNo)

	require.NoError(t, AttachPaddleGatewayTradeNo("paddle-attach-guard", 117, "txn_attach_guard"))
	require.Error(t, AttachPaddleGatewayTradeNo("paddle-attach-guard", 117, "txn_other_guard"))

	require.NoError(t, RechargePaddle("paddle-attach-guard", 117, "txn_attach_guard", "127.0.0.1"))
	require.NoError(t, AttachPaddleGatewayTradeNo("paddle-attach-guard", 117, "txn_attach_guard"))
	require.Error(t, AttachPaddleGatewayTradeNo("paddle-attach-guard", 117, "txn_other_guard"))
}

func TestGetUserPaddleTopUpByIdentifiers(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 115, 0)
	insertTopUpForPaymentGuardTest(t, "paddle-lookup-guard", 115, PaymentProviderPaddle)
	require.NoError(t, DB.Model(&TopUp{}).
		Where("trade_no = ?", "paddle-lookup-guard").
		Update("gateway_trade_no", "txn_lookup_guard").Error)

	topUp, err := GetUserPaddleTopUpByIdentifiers(115, "", "txn_lookup_guard")
	require.NoError(t, err)
	assert.Equal(t, "paddle-lookup-guard", topUp.TradeNo)

	topUp, err = GetUserPaddleTopUpByIdentifiers(115, "paddle-lookup-guard", "")
	require.NoError(t, err)
	assert.Equal(t, "txn_lookup_guard", topUp.GatewayTradeNo)

	topUp, err = GetUserPaddleTopUpByIdentifiers(115, "paddle-lookup-guard", "txn_lookup_guard")
	require.NoError(t, err)
	assert.Equal(t, "paddle-lookup-guard", topUp.TradeNo)

	_, err = GetUserPaddleTopUpByIdentifiers(115, "paddle-lookup-guard", "txn_other_guard")
	require.ErrorIs(t, err, ErrTopUpNotFound)

	_, err = GetUserPaddleTopUpByIdentifiers(116, "", "txn_lookup_guard")
	require.ErrorIs(t, err, ErrTopUpNotFound)
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
