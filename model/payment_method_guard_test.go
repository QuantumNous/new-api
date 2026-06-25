package model

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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

	_, err := RechargeWaffoPancake("waffo-pancake-guard")
	require.Error(t, err)

	topUp := GetTopUpByTradeNo("waffo-pancake-guard")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, 101))
}

func TestRechargeWaffoReportsOnlyActualPendingTransition(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 102, 0)
	insertTopUpForPaymentGuardTest(t, "waffo-transition-guard", 102, PaymentProviderWaffo)

	recharged, err := RechargeWaffo("waffo-transition-guard", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)

	recharged, err = RechargeWaffo("waffo-transition-guard", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, recharged)
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 102))
}

func TestRechargeWaffoPancakeReportsOnlyActualPendingTransition(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 103, 0)
	insertTopUpForPaymentGuardTest(t, "waffo-pancake-transition-guard", 103, PaymentProviderWaffoPancake)

	recharged, err := RechargeWaffoPancake("waffo-pancake-transition-guard")
	require.NoError(t, err)
	assert.True(t, recharged)

	recharged, err = RechargeWaffoPancake("waffo-pancake-transition-guard")
	require.NoError(t, err)
	assert.False(t, recharged)
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 103))
}

func TestRechargePaddle_DuplicateWebhookAddsQuotaOnce(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 111, 0)
	insertTopUpForPaymentGuardTest(t, "paddle-duplicate-guard", 111, PaymentProviderPaddle)

	recharged, err := RechargePaddle("paddle-duplicate-guard", 111, "txn_duplicate_guard", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)
	recharged, err = RechargePaddle("paddle-duplicate-guard", 111, "txn_duplicate_guard", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, recharged)

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

	recharged, err := Recharge("stripe-amount-guard", "cus_guard", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)
	recharged, err = Recharge("stripe-amount-guard", "cus_guard", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, recharged)

	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, "stripe-amount-guard"))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 113))

	var user User
	require.NoError(t, DB.Select("stripe_customer").Where("id = ?", 113).First(&user).Error)
	assert.Equal(t, "cus_guard", user.StripeCustomer)
}

func TestRechargeStripePersistsPaymentSnapshotWithoutChangingCreditedAmount(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 123, 0)
	insertTopUpForPaymentGuardTest(t, "stripe-snapshot-guard", 123, PaymentProviderStripe)

	recharged, err := RechargeWithPaymentSnapshot("stripe-snapshot-guard", "cus_snapshot", "127.0.0.1", PaymentSnapshot{
		Money:    5000,
		Currency: "jpy",
	})
	require.NoError(t, err)
	assert.True(t, recharged)

	recharged, err = RechargeWithPaymentSnapshot("stripe-snapshot-guard", "cus_snapshot", "127.0.0.1", PaymentSnapshot{
		Money:    9999,
		Currency: "brl",
	})
	require.NoError(t, err)
	assert.False(t, recharged)

	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 123))
	topUp := GetTopUpByTradeNo("stripe-snapshot-guard")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	assert.Equal(t, 5000.0, topUp.Money)
	assert.Equal(t, "JPY", topUp.PaymentCurrency)
}

func TestRechargeStripeCreditsStoredTotalAmountWithoutRuntimeBonus(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 118, 0)
	// No configured bonus is persisted on this order, so fulfillment credits the stored total.
	topUp := &TopUp{
		UserId:          118,
		Amount:          20,
		BonusAmount:     0,
		Money:           20,
		TradeNo:         "stripe-bonus-tier-guard",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	recharged, err := Recharge("stripe-bonus-tier-guard", "cus_bonus", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)

	expected := int(20 * int64(common.QuotaPerUnit))
	assert.Equal(t, expected, getUserQuotaForPaymentGuardTest(t, 118))
}

func TestRechargeStripeCreditsBasePlusBonusOnCallback(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 119, 0)
	// New semantics: Amount is base-only, BonusAmount is the pending bonus the callback
	// grants on top when the per-tier limit (here unconfigured = unlimited) allows it.
	topUp := &TopUp{
		UserId:          119,
		Amount:          20,
		BonusAmount:     5,
		BonusTier:       20,
		Money:           20,
		TradeNo:         "stripe-bonus-custom-guard",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	recharged, err := Recharge("stripe-bonus-custom-guard", "cus_custom", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)

	assert.Equal(t, int((20+5)*int64(common.QuotaPerUnit)), getUserQuotaForPaymentGuardTest(t, 119))
}

func TestTopUpPersistsSaveCardFlag(t *testing.T) {
	truncateTables(t)

	topUp := &TopUp{
		UserId:          1,
		Amount:          20,
		Money:           20,
		TradeNo:         "save-card-flag-guard",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		SaveCard:        true,
	}
	require.NoError(t, topUp.Insert())

	stored := GetTopUpByTradeNo("save-card-flag-guard")
	require.NotNil(t, stored)
	assert.True(t, stored.SaveCard)
}

func getUserCardBoundForTest(t *testing.T, userID int) bool {
	t.Helper()
	var user User
	require.NoError(t, DB.Select("stripe_card_bound").Where("id = ?", userID).First(&user).Error)
	return user.StripeCardBound
}

func TestRechargeStripeBindsCardAtomicallyForSaveCardTopUp(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 120, 0)
	topUp := &TopUp{
		UserId:          120,
		Amount:          20,
		Money:           20,
		TradeNo:         "save-card-bind-guard",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		SaveCard:        true,
	}
	require.NoError(t, topUp.Insert())

	// First fulfillment: credits the stored amount and marks the card bound, in one transaction.
	recharged, err := Recharge("save-card-bind-guard", "cus_bind", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)
	assert.True(t, getUserCardBoundForTest(t, 120), "save-card top-up must set stripe_card_bound")
	assert.Equal(t, int(20*int64(common.QuotaPerUnit)), getUserQuotaForPaymentGuardTest(t, 120))

	// Webhook redelivery: order already Success → no re-credit, binding unchanged (idempotent).
	recharged, err = Recharge("save-card-bind-guard", "cus_bind", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, recharged)
	assert.True(t, getUserCardBoundForTest(t, 120))
	assert.Equal(t, int(20*int64(common.QuotaPerUnit)), getUserQuotaForPaymentGuardTest(t, 120))

	var user User
	require.NoError(t, DB.Select("stripe_customer").Where("id = ?", 120).First(&user).Error)
	assert.Equal(t, "cus_bind", user.StripeCustomer)
}

func TestRechargeStripeDoesNotBindForNonSaveCardTopUp(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 121, 0)
	topUp := &TopUp{
		UserId:          121,
		Amount:          50,
		Money:           50,
		TradeNo:         "no-save-card-guard",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		SaveCard:        false,
	}
	require.NoError(t, topUp.Insert())

	recharged, err := Recharge("no-save-card-guard", "cus_plain", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)
	// Plain wallet top-up credits the stored amount but must NOT bind the card.
	assert.False(t, getUserCardBoundForTest(t, 121), "non-save-card top-up must not bind the card")
	assert.Equal(t, int(50*int64(common.QuotaPerUnit)), getUserQuotaForPaymentGuardTest(t, 121))
}

func TestRechargeStripeSkipsBindWhenCustomerMissing(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 122, 0)
	topUp := &TopUp{
		UserId:          122,
		Amount:          20,
		Money:           20,
		TradeNo:         "save-card-nocustomer-guard",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		SaveCard:        true,
	}
	require.NoError(t, topUp.Insert())

	// Empty customer id: bind is skipped (no unchargeable card_bound=true), credit still applies.
	recharged, err := Recharge("save-card-nocustomer-guard", "", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)
	assert.False(t, getUserCardBoundForTest(t, 122), "must not bind without a customer to charge")
	assert.Equal(t, int(20*int64(common.QuotaPerUnit)), getUserQuotaForPaymentGuardTest(t, 122))
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
	rechargedResults := make(chan bool, 8)
	for i := 0; i < cap(errs); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			recharged, err := RechargePaddle("paddle-concurrent-guard", 112, "txn_concurrent_guard", "127.0.0.1")
			rechargedResults <- recharged
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	close(rechargedResults)

	for err := range errs {
		require.NoError(t, err)
	}
	actualRecharges := 0
	for recharged := range rechargedResults {
		if recharged {
			actualRecharges++
		}
	}
	assert.Equal(t, 1, actualRecharges)
	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, "paddle-concurrent-guard"))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 112))
}

func TestRechargePaddle_RejectsMismatchedUser(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 113, 0)
	insertTopUpForPaymentGuardTest(t, "paddle-user-guard", 113, PaymentProviderPaddle)

	_, err := RechargePaddle("paddle-user-guard", 114, "txn_user_guard", "127.0.0.1")
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

	_, err := RechargePaddle("paddle-gateway-guard", 114, "txn_other_guard", "127.0.0.1")
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

	recharged, err := RechargePaddle("paddle-attach-guard", 117, "txn_attach_guard", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)
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

// TestRechargeBonusRespectsPerTierLimit 验证「每用户每档位限领次数」在真实回调入账路径上生效：
// 配置 tier=20 限领 2 次，连续 3 笔同档充值，前 2 笔含赠送、第 3 笔仅本金。
func TestRechargeBonusRespectsPerTierLimit(t *testing.T) {
	truncateTables(t)
	paymentSetting := operation_setting.GetPaymentSetting()
	originalLimit := paymentSetting.AmountBonusLimit
	t.Cleanup(func() { paymentSetting.AmountBonusLimit = originalLimit })
	paymentSetting.AmountBonusLimit = map[int]int{20: 2}

	insertUserForPaymentGuardTest(t, 130, 0)
	base := int64(common.QuotaPerUnit)
	for i, trade := range []string{"limit-1", "limit-2", "limit-3"} {
		topUp := &TopUp{
			UserId:          130,
			Amount:          20,
			BonusAmount:     5,
			BonusTier:       20,
			Money:           20,
			TradeNo:         trade,
			PaymentMethod:   PaymentMethodStripe,
			PaymentProvider: PaymentProviderStripe,
			CreateTime:      time.Now().Unix(),
			Status:          common.TopUpStatusPending,
		}
		require.NoError(t, topUp.Insert())
		recharged, err := Recharge(trade, "cus_limit", "127.0.0.1")
		require.NoError(t, err)
		assert.True(t, recharged, "order %d should credit", i+1)
	}

	// 前两笔各 20+5，第三笔仅 20 → 总计 20+5 + 20+5 + 20 = 70
	assert.Equal(t, int((20+5+20+5+20)*base), getUserQuotaForPaymentGuardTest(t, 130))

	// 第三笔订单的 BonusAmount 应被归零（未发放）
	var third TopUp
	require.NoError(t, DB.Where("trade_no = ?", "limit-3").First(&third).Error)
	assert.Equal(t, int64(0), third.BonusAmount)
}

// TestRechargeBonusUnlimitedWhenNoLimitConfigured 验证未配置 limit 的档位不限次发放。
func TestRechargeBonusUnlimitedWhenNoLimitConfigured(t *testing.T) {
	truncateTables(t)
	paymentSetting := operation_setting.GetPaymentSetting()
	originalLimit := paymentSetting.AmountBonusLimit
	t.Cleanup(func() { paymentSetting.AmountBonusLimit = originalLimit })
	paymentSetting.AmountBonusLimit = map[int]int{} // 不配置即不限

	insertUserForPaymentGuardTest(t, 131, 0)
	base := int64(common.QuotaPerUnit)
	for _, trade := range []string{"nolimit-1", "nolimit-2", "nolimit-3"} {
		topUp := &TopUp{
			UserId:          131,
			Amount:          20,
			BonusAmount:     5,
			BonusTier:       20,
			Money:           20,
			TradeNo:         trade,
			PaymentMethod:   PaymentMethodStripe,
			PaymentProvider: PaymentProviderStripe,
			CreateTime:      time.Now().Unix(),
			Status:          common.TopUpStatusPending,
		}
		require.NoError(t, topUp.Insert())
		recharged, err := Recharge(trade, "cus_nolimit", "127.0.0.1")
		require.NoError(t, err)
		assert.True(t, recharged)
	}

	// 三笔都含赠送 → 3 × (20+5) = 75
	assert.Equal(t, int(3*(20+5)*base), getUserQuotaForPaymentGuardTest(t, 131))
}
