package model

import (
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

func setupPaymentGuardRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	mr := miniredis.RunT(t)
	previousRDB := common.RDB
	previousRedisEnabled := common.RedisEnabled
	previousSyncFrequency := common.SyncFrequency
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	common.SyncFrequency = 60
	t.Cleanup(func() {
		require.NoError(t, common.RDB.Close())
		common.RDB = previousRDB
		common.RedisEnabled = previousRedisEnabled
		common.SyncFrequency = previousSyncFrequency
	})
	return mr
}

func cachePaymentGuardUser(t *testing.T, userID int) {
	t.Helper()
	var user User
	require.NoError(t, DB.Where("id = ?", userID).First(&user).Error)
	require.NoError(t, updateUserCache(user))
}

func markPaymentGuardTopUpAnalytics(t *testing.T, tradeNo string) {
	t.Helper()
	require.NoError(t, DB.Model(&TopUp{}).Where("trade_no = ?", tradeNo).Updates(map[string]any{
		"ga_client_id":  "client." + tradeNo,
		"ga_session_id": "session." + tradeNo,
	}).Error)
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

func TestManualCompleteTopUpRefreshesQuotaCacheAfterCommit(t *testing.T) {
	truncateTables(t)
	setupPaymentGuardRedis(t)

	insertUserForPaymentGuardTest(t, 1801, 0)
	insertTopUpForPaymentGuardTest(t, "manual-cache-guard", 1801, PaymentProviderStripe)
	cachePaymentGuardUser(t, 1801)

	require.NoError(t, ManualCompleteTopUp("manual-cache-guard", "127.0.0.1"))

	cachedQuota, err := getUserQuotaCache(1801)
	require.NoError(t, err)
	require.Equal(t, int(2*common.QuotaPerUnit), cachedQuota)
}

func TestCreemRechargeRefreshesQuotaCacheAfterCommit(t *testing.T) {
	truncateTables(t)
	setupPaymentGuardRedis(t)

	insertUserForPaymentGuardTest(t, 1802, 0)
	insertTopUpForPaymentGuardTest(t, "creem-cache-guard", 1802, PaymentProviderCreem)
	cachePaymentGuardUser(t, 1802)

	require.NoError(t, RechargeCreem("creem-cache-guard", "", "", "127.0.0.1"))

	cachedQuota, err := getUserQuotaCache(1802)
	require.NoError(t, err)
	require.Equal(t, 2, cachedQuota)
}

func TestProviderRechargeRefreshesQuotaCacheAfterCommit(t *testing.T) {
	for _, tc := range []struct {
		name     string
		userID   int
		tradeNo  string
		provider string
		recharge func(string) (bool, error)
	}{
		{
			name:     "waffo",
			userID:   1803,
			tradeNo:  "waffo-cache-guard",
			provider: PaymentProviderWaffo,
			recharge: func(tradeNo string) (bool, error) {
				return RechargeWaffo(tradeNo, "127.0.0.1")
			},
		},
		{
			name:     "waffo_pancake",
			userID:   1804,
			tradeNo:  "waffo-pancake-cache-guard",
			provider: PaymentProviderWaffoPancake,
			recharge: func(tradeNo string) (bool, error) {
				return RechargeWaffoPancake(tradeNo)
			},
		},
		{
			name:     "paddle",
			userID:   1805,
			tradeNo:  "paddle-cache-guard",
			provider: PaymentProviderPaddle,
			recharge: func(tradeNo string) (bool, error) {
				return RechargePaddle(tradeNo, 1805, "gateway-cache-guard", "127.0.0.1")
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			setupPaymentGuardRedis(t)

			insertUserForPaymentGuardTest(t, tc.userID, 0)
			insertTopUpForPaymentGuardTest(t, tc.tradeNo, tc.userID, tc.provider)
			cachePaymentGuardUser(t, tc.userID)

			recharged, err := tc.recharge(tc.tradeNo)
			require.NoError(t, err)
			require.True(t, recharged)

			cachedQuota, err := getUserQuotaCache(tc.userID)
			require.NoError(t, err)
			require.Equal(t, int(2*common.QuotaPerUnit), cachedQuota)
		})
	}
}

func TestCompleteEpayTopUpCreditsWalletLifecycleCacheAndCycleOnce(t *testing.T) {
	truncateTables(t)
	setupPaymentGuardRedis(t)
	require.NoError(t, DB.AutoMigrate(&PaymentAnalyticsOutbox{}, &PaymentAnalyticsEventReceipt{}))

	insertUserForPaymentGuardTest(t, 1810, 0)
	insertTopUpForPaymentGuardTest(t, "epay-cache-cycle", 1810, PaymentProviderEpay)
	markPaymentGuardTopUpAnalytics(t, "epay-cache-cycle")
	cachePaymentGuardUser(t, 1810)

	credited, topUp, err := CompleteEpayTopUp("epay-cache-cycle", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, credited)
	require.NotNil(t, topUp)
	require.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	require.Equal(t, "alipay", topUp.PaymentMethod)
	require.Positive(t, topUp.CompleteTime)
	reloaded := GetTopUpByTradeNo("epay-cache-cycle")
	require.NotNil(t, reloaded)
	require.Equal(t, "alipay", reloaded.PaymentMethod)

	expectedQuota := int(2 * common.QuotaPerUnit)
	require.Equal(t, expectedQuota, getUserQuotaForPaymentGuardTest(t, 1810))
	cachedQuota, err := getUserQuotaCache(1810)
	require.NoError(t, err)
	require.Equal(t, expectedQuota, cachedQuota)

	state := lifecycleStateForTest(t, 1810, QuotaLifecycleScopeWallet, "1810")
	require.Equal(t, "topup:epay-cache-cycle", state.Cycle)
	require.EqualValues(t, expectedQuota, state.Balance)
	var logCount int64
	require.NoError(t, DB.Model(&Log{}).Where("user_id = ? AND type = ?", 1810, LogTypeTopup).Count(&logCount).Error)
	require.EqualValues(t, 1, logCount)
	var outboxCount int64
	require.NoError(t, DB.Model(&PaymentAnalyticsOutbox{}).Where("event_id = ?", "flatkey:ga4:purchase:topup:epay-cache-cycle").Count(&outboxCount).Error)
	require.EqualValues(t, 1, outboxCount)
}

func TestCompleteEpayTopUpReplayDoesNotRepeatOneTimeCreditEffects(t *testing.T) {
	truncateTables(t)
	setupPaymentGuardRedis(t)
	require.NoError(t, DB.AutoMigrate(&PaymentAnalyticsOutbox{}, &PaymentAnalyticsEventReceipt{}))

	insertUserForPaymentGuardTest(t, 1811, 0)
	insertTopUpForPaymentGuardTest(t, "epay-replay-once", 1811, PaymentProviderEpay)
	markPaymentGuardTopUpAnalytics(t, "epay-replay-once")
	cachePaymentGuardUser(t, 1811)

	firstCredited, _, err := CompleteEpayTopUp("epay-replay-once", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, firstCredited)
	secondCredited, _, err := CompleteEpayTopUp("epay-replay-once", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.False(t, secondCredited)

	expectedQuota := int(2 * common.QuotaPerUnit)
	require.Equal(t, expectedQuota, getUserQuotaForPaymentGuardTest(t, 1811))
	cachedQuota, err := getUserQuotaCache(1811)
	require.NoError(t, err)
	require.Equal(t, expectedQuota, cachedQuota)

	var stateCount int64
	require.NoError(t, DB.Model(&QuotaLifecycleState{}).Where("user_id = ? AND scope_type = ? AND scope_id = ?", 1811, QuotaLifecycleScopeWallet, "1811").Count(&stateCount).Error)
	require.EqualValues(t, 1, stateCount)
	var logCount int64
	require.NoError(t, DB.Model(&Log{}).Where("user_id = ? AND type = ?", 1811, LogTypeTopup).Count(&logCount).Error)
	require.EqualValues(t, 1, logCount)
	var outboxCount int64
	require.NoError(t, DB.Model(&PaymentAnalyticsOutbox{}).Where("event_id = ?", "flatkey:ga4:purchase:topup:epay-replay-once").Count(&outboxCount).Error)
	require.EqualValues(t, 1, outboxCount)
}

func TestCompleteEpayTopUpRollsBackOnProviderMismatch(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 1812, 0)
	insertTopUpForPaymentGuardTest(t, "epay-provider-mismatch", 1812, PaymentProviderStripe)

	credited, topUp, err := CompleteEpayTopUp("epay-provider-mismatch", "alipay", "127.0.0.1")
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)
	require.False(t, credited)
	require.Nil(t, topUp)

	stored := GetTopUpByTradeNo("epay-provider-mismatch")
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusPending, stored.Status)
	require.Equal(t, PaymentProviderStripe, stored.PaymentProvider)
	require.Zero(t, stored.CompleteTime)
	require.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, 1812))
	var stateCount int64
	require.NoError(t, DB.Model(&QuotaLifecycleState{}).Where("user_id = ?", 1812).Count(&stateCount).Error)
	require.EqualValues(t, 0, stateCount)
}

func TestCompleteEpayTopUpRollsBackOrderWhenLifecycleCreditFails(t *testing.T) {
	truncateTables(t)
	setupPaymentGuardRedis(t)
	require.NoError(t, DB.AutoMigrate(&PaymentAnalyticsOutbox{}, &PaymentAnalyticsEventReceipt{}))

	initialQuota := int(testMaxInt64 - int64(common.QuotaPerUnit) + 1)
	insertUserForPaymentGuardTest(t, 1814, initialQuota)
	insertTopUpForPaymentGuardTest(t, "epay-overflow-rollback", 1814, PaymentProviderEpay)
	cachePaymentGuardUser(t, 1814)

	credited, topUp, err := CompleteEpayTopUp("epay-overflow-rollback", "alipay", "127.0.0.1")
	require.ErrorIs(t, err, ErrLifecycleQuotaBalanceOverflow)
	require.False(t, credited)
	require.Nil(t, topUp)

	stored := GetTopUpByTradeNo("epay-overflow-rollback")
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusPending, stored.Status)
	require.Equal(t, PaymentProviderEpay, stored.PaymentProvider)
	require.Equal(t, PaymentProviderEpay, stored.PaymentMethod)
	require.Zero(t, stored.CompleteTime)
	require.Equal(t, initialQuota, getUserQuotaForPaymentGuardTest(t, 1814))
	cachedQuota, cacheErr := getUserQuotaCache(1814)
	require.NoError(t, cacheErr)
	require.Equal(t, initialQuota, cachedQuota)

	var stateCount int64
	require.NoError(t, DB.Model(&QuotaLifecycleState{}).Where("user_id = ?", 1814).Count(&stateCount).Error)
	require.EqualValues(t, 0, stateCount)
	var logCount int64
	require.NoError(t, DB.Model(&Log{}).Where("user_id = ? AND type = ?", 1814, LogTypeTopup).Count(&logCount).Error)
	require.EqualValues(t, 0, logCount)
	var outboxCount int64
	require.NoError(t, DB.Model(&PaymentAnalyticsOutbox{}).Where("event_id = ?", "flatkey:ga4:purchase:topup:epay-overflow-rollback").Count(&outboxCount).Error)
	require.EqualValues(t, 0, outboxCount)
}

func TestCompleteEpayTopUpConcurrentReplayCreditsOnce(t *testing.T) {
	truncateTables(t)
	setupPaymentGuardRedis(t)

	insertUserForPaymentGuardTest(t, 1813, 0)
	insertTopUpForPaymentGuardTest(t, "epay-concurrent-once", 1813, PaymentProviderEpay)
	cachePaymentGuardUser(t, 1813)

	start := make(chan struct{})
	results := make(chan struct {
		credited bool
		err      error
	}, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			credited, _, err := CompleteEpayTopUp("epay-concurrent-once", "alipay", "127.0.0.1")
			results <- struct {
				credited bool
				err      error
			}{credited: credited, err: err}
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	var creditedCount int
	for result := range results {
		require.NoError(t, result.err)
		if result.credited {
			creditedCount++
		}
	}
	require.Equal(t, 1, creditedCount)
	expectedQuota := int(2 * common.QuotaPerUnit)
	require.Equal(t, expectedQuota, getUserQuotaForPaymentGuardTest(t, 1813))
	state := lifecycleStateForTest(t, 1813, QuotaLifecycleScopeWallet, "1813")
	require.Equal(t, "topup:epay-concurrent-once", state.Cycle)
	require.EqualValues(t, expectedQuota, state.Balance)
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

func TestRechargeStripeCorrectedSuccessPersistsPaymentSnapshot(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 125, 0)
	insertTopUpForPaymentGuardTest(t, "stripe-corrected-snapshot", 125, PaymentProviderStripe)
	require.NoError(t, UpdatePendingTopUpStatus("stripe-corrected-snapshot", PaymentProviderStripe, common.TopUpStatusFailed))

	recharged, err := RechargeWithPaymentSnapshot("stripe-corrected-snapshot", "cus_corrected", "127.0.0.1", PaymentSnapshot{
		Money:    1299,
		Currency: "jpy",
	})
	require.NoError(t, err)
	require.True(t, recharged)

	recharged, err = RechargeWithPaymentSnapshot("stripe-corrected-snapshot", "cus_corrected", "127.0.0.1", PaymentSnapshot{
		Money:    9999,
		Currency: "brl",
	})
	require.NoError(t, err)
	require.False(t, recharged)

	stored := GetTopUpByTradeNo("stripe-corrected-snapshot")
	require.NotNil(t, stored)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
	require.Equal(t, 1299.0, stored.Money)
	require.Equal(t, "JPY", stored.PaymentCurrency)
	require.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 125))

	var user User
	require.NoError(t, DB.Select("stripe_customer").Where("id = ?", 125).First(&user).Error)
	require.Equal(t, "cus_corrected", user.StripeCustomer)
	event := requireTopUpLifecycleEvent(t, 125, RecallLifecycleTriggerPaymentSucceeded, "stripe-corrected-snapshot")
	var payload map[string]any
	require.NoError(t, common.Unmarshal([]byte(event.EventData), &payload))
	require.Equal(t, 1299.0, payload["money"])
	require.Equal(t, "JPY", payload["currency"])
}

func TestRechargeStripePersistsZeroPaymentSnapshot(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 124, 0)
	insertTopUpForPaymentGuardTest(t, "stripe-zero-snapshot", 124, PaymentProviderStripe)

	recharged, err := RechargeWithPaymentSnapshot("stripe-zero-snapshot", "cus_zero", "127.0.0.1", PaymentSnapshot{
		Money:    0,
		Currency: "usd",
	})
	require.NoError(t, err)
	assert.True(t, recharged)

	topUp := GetTopUpByTradeNo("stripe-zero-snapshot")
	require.NotNil(t, topUp)
	assert.Equal(t, 0.0, topUp.Money)
	assert.Equal(t, "USD", topUp.PaymentCurrency)
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 124))
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

func TestRechargeStripeCASLoserSkipsBonusAdsLifecycleWalletAndLogs(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&PaymentAnalyticsOutbox{}, &PaymentAnalyticsEventReceipt{}))
	paymentSetting := operation_setting.GetPaymentSetting()
	originalLimit := paymentSetting.AmountBonusLimit
	t.Cleanup(func() { paymentSetting.AmountBonusLimit = originalLimit })
	paymentSetting.AmountBonusLimit = map[int]int{20: 1}

	insertUserForPaymentGuardTest(t, 126, 0)
	topUp := &TopUp{
		UserId:          126,
		Amount:          20,
		BonusAmount:     5,
		BonusTier:       20,
		Money:           20,
		TradeNo:         "stripe-cas-loser-bonus",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		GAClientID:      "client.casloser",
		GASessionID:     "session.casloser",
	}
	require.NoError(t, topUp.Insert())

	callbackName := "test:force_stripe_recharge_cas_loss"
	fired := false
	var callbackErr error
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement == nil || tx.Statement.Table != "top_ups" {
			return
		}
		if _, ok := tx.Statement.Dest.(map[string]any); !ok {
			return
		}
		fired = true
		callbackErr = tx.Exec("UPDATE top_ups SET status = ?, complete_time = ? WHERE id = ?", common.TopUpStatusSuccess, common.GetTimestamp(), topUp.Id).Error
	}))
	defer func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	}()

	recharged, err := Recharge("stripe-cas-loser-bonus", "cus_cas_loser", "127.0.0.1")
	require.NoError(t, callbackErr)
	require.NoError(t, err)
	require.True(t, fired)
	require.False(t, recharged)

	require.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, 126))
	requireTopUpLifecycleEventCount(t, "stripe-cas-loser-bonus", RecallLifecycleTriggerPaymentSucceeded, 0)
	var bonusClaims int64
	require.NoError(t, DB.Model(&TopUpBonusClaim{}).Where("trade_no = ?", "stripe-cas-loser-bonus").Count(&bonusClaims).Error)
	require.EqualValues(t, 0, bonusClaims)
	var outboxCount int64
	require.NoError(t, DB.Model(&PaymentAnalyticsOutbox{}).Where("event_id = ?", "flatkey:ga4:purchase:topup:stripe-cas-loser-bonus").Count(&outboxCount).Error)
	require.EqualValues(t, 0, outboxCount)
	var logCount int64
	require.NoError(t, DB.Model(&Log{}).Where("user_id = ? AND type = ?", 126, LogTypeTopup).Count(&logCount).Error)
	require.EqualValues(t, 0, logCount)

	winner := &TopUp{
		UserId:          126,
		Amount:          20,
		BonusAmount:     5,
		BonusTier:       20,
		Money:           20,
		TradeNo:         "stripe-cas-winner-bonus",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, winner.Insert())
	recharged, err = Recharge("stripe-cas-winner-bonus", "cus_cas_winner", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, recharged)
	require.Equal(t, int((20+5)*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, 126))
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

func TestRechargeStripeDoesNotBindCardForSaveCardTopUp(t *testing.T) {
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

	// First fulfillment: credits the stored amount and persists the customer, but must NOT
	// set stripe_card_bound — a save-card Checkout can complete via a local payment method
	// with no card saved. Binding happens later, after the Stripe API confirms a saved card.
	recharged, err := Recharge("save-card-bind-guard", "cus_bind", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, recharged)
	assert.False(t, getUserCardBoundForTest(t, 120), "Recharge alone must not set stripe_card_bound")
	assert.Equal(t, int(20*int64(common.QuotaPerUnit)), getUserQuotaForPaymentGuardTest(t, 120))

	// Webhook redelivery: order already Success → no re-credit, still unbound (idempotent).
	recharged, err = Recharge("save-card-bind-guard", "cus_bind", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, recharged)
	assert.False(t, getUserCardBoundForTest(t, 120))
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
