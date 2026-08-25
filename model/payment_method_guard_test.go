package model

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func insertUserForPaymentGuardTest(t *testing.T, id int, quota int) *User {
	t.Helper()
	user := &User{
		Id:       id,
		Username: "payment_guard_user",
		Status:   common.UserStatusEnabled,
		Quota:    quota,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
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

func entitlementSnapshotForPaymentGuardTest(t *testing.T, plan *SubscriptionPlan) string {
	t.Helper()
	snapshot, err := NewSubscriptionEntitlementSnapshot(plan)
	require.NoError(t, err)
	data, err := snapshot.Marshal()
	require.NoError(t, err)
	return data
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

	err := RechargeWaffoPancake("waffo-pancake-guard", WaffoPancakeSettlement{
		Amount:   "9.99",
		Currency: "USD",
	})
	require.Error(t, err)

	topUp := GetTopUpByTradeNo("waffo-pancake-guard")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, 101))
}

func TestRechargeWaffoPancake_RejectsUnexpectedSettlementExpectation(t *testing.T) {
	testCases := []struct {
		name      string
		configure func(*TopUp)
		amount    string
		currency  string
	}{
		{name: "legacy version", configure: func(topUp *TopUp) { topUp.PaymentExpectationVersion = 0 }},
		{name: "missing expected amount", configure: func(topUp *TopUp) { topUp.ExpectedAmount = 0 }},
		{name: "different expected amount", configure: func(topUp *TopUp) { topUp.ExpectedAmount = 8.99 }},
		{name: "different currency", configure: func(topUp *TopUp) { topUp.ExpectedCurrency = "CNY" }},
		{name: "missing expected store", configure: func(topUp *TopUp) { topUp.ExpectedStoreID = "" }},
		{name: "different store", configure: func(topUp *TopUp) { topUp.ExpectedStoreID = "store-other" }},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			const userID = 404
			const tradeNo = "waffo-pancake-settlement-reject"
			insertUserForPaymentGuardTest(t, userID, 0)
			topUp := &TopUp{
				UserId:                    userID,
				Amount:                    2,
				Money:                     9.99,
				TradeNo:                   tradeNo,
				PaymentMethod:             PaymentMethodWaffoPancake,
				PaymentProvider:           PaymentProviderWaffoPancake,
				PaymentExpectationVersion: WaffoPancakePaymentExpectationVersion,
				ExpectedAmount:            9.99,
				ExpectedCurrency:          "USD",
				ExpectedStoreID:           "store-expected",
				Status:                    common.TopUpStatusPending,
				CreateTime:                time.Now().Unix(),
			}
			require.NoError(t, topUp.Insert())
			tc.configure(topUp)
			require.NoError(t, topUp.Update())

			err := RechargeWaffoPancake(tradeNo, WaffoPancakeSettlement{Amount: "9.99", Currency: "USD", StoreID: "store-expected"})
			require.Error(t, err)
			assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
			assert.Zero(t, getUserQuotaForPaymentGuardTest(t, userID))
		})
	}
}

func TestRechargeWaffoPancakeSettlementMatchIsIdempotent(t *testing.T) {
	truncateTables(t)
	const userID = 405
	const tradeNo = "waffo-pancake-settlement-match"
	insertUserForPaymentGuardTest(t, userID, 0)
	topUp := &TopUp{
		UserId:                    userID,
		Amount:                    2,
		Money:                     1,
		TradeNo:                   tradeNo,
		PaymentMethod:             PaymentMethodWaffoPancake,
		PaymentProvider:           PaymentProviderWaffoPancake,
		PaymentExpectationVersion: WaffoPancakePaymentExpectationVersion,
		ExpectedAmount:            9.99,
		ExpectedCurrency:          "USD",
		ExpectedStoreID:           "store-expected",
		Status:                    common.TopUpStatusPending,
		CreateTime:                time.Now().Unix(),
	}
	require.NoError(t, topUp.Insert())

	settlement := WaffoPancakeSettlement{Amount: "9.990", Currency: " usd ", StoreID: " store-expected "}
	require.NoError(t, RechargeWaffoPancake(tradeNo, settlement))
	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, tradeNo))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))
	require.NoError(t, RechargeWaffoPancake(tradeNo, settlement))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))
}
func insertStripeExpectedTopUpForPaymentGuardTest(t *testing.T, tradeNo string, userID int) {
	t.Helper()
	topUp := &TopUp{
		UserId:                    userID,
		Amount:                    2,
		Money:                     2,
		TradeNo:                   tradeNo,
		PaymentMethod:             PaymentMethodStripe,
		PaymentProvider:           PaymentProviderStripe,
		PaymentExpectationVersion: StripePaymentExpectationVersion,
		ExpectedAmount:            2,
		ExpectedAmountUnit:        200,
		ExpectedCurrency:          "USD",
		ExpectedCreditedQuota:     int64(2 * common.QuotaPerUnit),
		ExpectedSessionID:         "cs_expected",
		ExpectedBindingToken:      "stripe_binding_expected",
		Status:                    common.TopUpStatusPending,
		CreateTime:                time.Now().Unix(),
	}
	require.NoError(t, topUp.Insert())
}

func TestSetStripeTopUpExpectedSessionID_RejectsMissingCreditedQuotaSnapshot(t *testing.T) {
	truncateTables(t)

	const userID = 415
	const tradeNo = "stripe-session-missing-quota"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	topUp.ExpectedSessionID = ""
	topUp.ExpectedCreditedQuota = 0
	require.NoError(t, topUp.Update())

	require.ErrorIs(t, SetStripeTopUpExpectedSessionID(tradeNo, "cs_rejected"), ErrPaymentExpectationInvalid)
	stored := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, stored)
	assert.Empty(t, stored.ExpectedSessionID)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
}

func TestRechargeLegacyStripePathFailsClosed(t *testing.T) {
	truncateTables(t)

	const userID = 416
	const tradeNo = "stripe-legacy-recharge-disabled"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)

	err := Recharge(tradeNo, "cus_legacy", "127.0.0.1")
	require.ErrorIs(t, err, ErrPaymentExpectationInvalid)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
	assert.Zero(t, getUserQuotaForPaymentGuardTest(t, userID))
}

func TestRechargeStripeSettlement_RequiresExpectedSettlementAndIsIdempotent(t *testing.T) {
	truncateTables(t)

	const userID = 401
	const tradeNo = "stripe-settlement-match"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)

	settlement := StripeSettlement{
		SessionID:    "cs_expected",
		BindingToken: "stripe_binding_expected",
		AmountUnit:   200,
		Currency:     "usd",
		CustomerID:   "cus_expected",
		CallerIP:     "127.0.0.1",
	}
	require.NoError(t, RechargeStripeSettlement(tradeNo, settlement))
	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, tradeNo))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))

	require.NoError(t, RechargeStripeSettlement(tradeNo, settlement))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))
}

func TestRechargeStripeSettlement_UsesImmutableCreditedQuotaSnapshot(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	const userID = 410
	const tradeNo = "stripe-settlement-immutable-quota"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	topUp.Money = 24
	topUp.ExpectedAmount = 24
	topUp.ExpectedAmountUnit = 2400
	topUp.ExpectedCreditedQuota = 6_000_000
	require.NoError(t, topUp.Update())

	common.QuotaPerUnit = 7
	settlement := StripeSettlement{
		SessionID:    "cs_expected",
		BindingToken: "stripe_binding_expected",
		AmountUnit:   2400,
		Currency:     "USD",
	}
	require.NoError(t, RechargeStripeSettlement(tradeNo, settlement))
	assert.Equal(t, 6_000_000, getUserQuotaForPaymentGuardTest(t, userID))

	require.NoError(t, RechargeStripeSettlement(tradeNo, settlement))
	assert.Equal(t, 6_000_000, getUserQuotaForPaymentGuardTest(t, userID))
}

func TestRechargeStripeSettlement_RejectsMissingCreditedQuotaSnapshot(t *testing.T) {
	truncateTables(t)

	const userID = 411
	const tradeNo = "stripe-settlement-missing-quota"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	topUp.ExpectedCreditedQuota = 0
	require.NoError(t, topUp.Update())

	err := RechargeStripeSettlement(tradeNo, StripeSettlement{
		SessionID:    "cs_expected",
		BindingToken: "stripe_binding_expected",
		AmountUnit:   200,
		Currency:     "USD",
	})
	require.ErrorIs(t, err, ErrPaymentExpectationInvalid)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
	assert.Zero(t, getUserQuotaForPaymentGuardTest(t, userID))
}

func TestRechargeStripeSettlement_EnforcesFinalWalletQuotaLimit(t *testing.T) {
	testCases := []struct {
		name         string
		currentQuota int
		wantErr      bool
		wantQuota    int
		wantStatus   string
	}{
		{
			name:         "allows exact highest representable wallet balance",
			currentQuota: common.MaxQuota - 1 - 1_000_000,
			wantQuota:    common.MaxQuota - 1,
			wantStatus:   common.TopUpStatusSuccess,
		},
		{
			name:         "rejects balance above int32 quota domain",
			currentQuota: common.MaxQuota - 1_000_000,
			wantErr:      true,
			wantQuota:    common.MaxQuota - 1_000_000,
			wantStatus:   common.TopUpStatusPending,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			const userID = 412
			const tradeNo = "stripe-settlement-wallet-limit"
			insertUserForPaymentGuardTest(t, userID, tc.currentQuota)
			insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
			topUp := GetTopUpByTradeNo(tradeNo)
			require.NotNil(t, topUp)
			topUp.ExpectedCreditedQuota = 1_000_000
			require.NoError(t, topUp.Update())

			err := RechargeStripeSettlement(tradeNo, StripeSettlement{
				SessionID:    "cs_expected",
				BindingToken: "stripe_binding_expected",
				AmountUnit:   200,
				Currency:     "USD",
			})
			if tc.wantErr {
				require.ErrorIs(t, err, ErrTopUpQuotaLimitExceeded)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tc.wantQuota, getUserQuotaForPaymentGuardTest(t, userID))
			assert.Equal(t, tc.wantStatus, getTopUpStatusForPaymentGuardTest(t, tradeNo))
		})
	}
}

func TestRechargeStripeSettlement_BindsEmptySessionWithMatchingToken(t *testing.T) {
	truncateTables(t)
	const userID = 406
	const tradeNo = "stripe-settlement-binding-recovery"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	topUp.ExpectedSessionID = ""
	require.NoError(t, topUp.Update())

	settlement := StripeSettlement{
		SessionID:    "cs_recovered",
		BindingToken: "stripe_binding_expected",
		AmountUnit:   200,
		Currency:     "USD",
	}
	require.NoError(t, RechargeStripeSettlement(tradeNo, settlement))
	stored := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, stored)
	assert.Equal(t, "cs_recovered", stored.ExpectedSessionID)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))

	require.NoError(t, RechargeStripeSettlement(tradeNo, settlement))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))
	settlement.SessionID = "cs_other"
	require.ErrorIs(t, RechargeStripeSettlement(tradeNo, settlement), ErrPaymentSettlementMismatch)
}

func TestRechargeStripeSettlement_RejectsRecoveryMismatchWithoutBindingSession(t *testing.T) {
	testCases := []struct {
		name       string
		settlement StripeSettlement
	}{
		{
			name:       "different amount",
			settlement: StripeSettlement{SessionID: "cs_rejected", BindingToken: "stripe_binding_expected", AmountUnit: 201, Currency: "USD"},
		},
		{
			name:       "different currency",
			settlement: StripeSettlement{SessionID: "cs_rejected", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "CNY"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			const userID = 408
			const tradeNo = "stripe-settlement-recovery-rollback"
			insertUserForPaymentGuardTest(t, userID, 0)
			insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
			topUp := GetTopUpByTradeNo(tradeNo)
			require.NotNil(t, topUp)
			topUp.ExpectedSessionID = ""
			require.NoError(t, topUp.Update())

			require.ErrorIs(t, RechargeStripeSettlement(tradeNo, tc.settlement), ErrPaymentSettlementMismatch)
			stored := GetTopUpByTradeNo(tradeNo)
			require.NotNil(t, stored)
			assert.Empty(t, stored.ExpectedSessionID)
			assert.Equal(t, common.TopUpStatusPending, stored.Status)
			assert.Zero(t, getUserQuotaForPaymentGuardTest(t, userID))
		})
	}
}

func TestRechargeStripeSettlement_RecoversAfterExpectedSessionPersistenceFailure(t *testing.T) {
	truncateTables(t)
	const userID = 409
	const tradeNo = "stripe-settlement-persistence-recovery"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	topUp.ExpectedSessionID = ""
	require.NoError(t, topUp.Update())

	forcedErr := errors.New("forced Stripe session persistence failure")
	callbackName := "test:fail_stripe_session_persistence"
	callbackRegistered := true
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "top_ups" {
			tx.AddError(forcedErr)
		}
	}))
	t.Cleanup(func() {
		if callbackRegistered {
			_ = DB.Callback().Update().Remove(callbackName)
		}
	})

	const sessionID = "cs_recovered_after_failure"
	require.ErrorIs(t, SetStripeTopUpExpectedSessionID(tradeNo, sessionID), forcedErr)
	stored := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, stored)
	assert.Empty(t, stored.ExpectedSessionID)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
	assert.Zero(t, getUserQuotaForPaymentGuardTest(t, userID))

	require.NoError(t, DB.Callback().Update().Remove(callbackName))
	callbackRegistered = false
	settlement := StripeSettlement{
		SessionID:    sessionID,
		BindingToken: "stripe_binding_expected",
		AmountUnit:   200,
		Currency:     "USD",
	}
	require.NoError(t, RechargeStripeSettlement(tradeNo, settlement))
	stored = GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, stored)
	assert.Equal(t, sessionID, stored.ExpectedSessionID)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))
}

func TestRechargeStripeSettlement_RejectsBindingExpectationFailures(t *testing.T) {
	testCases := []struct {
		name       string
		configure  func(*TopUp)
		settlement StripeSettlement
		expected   error
	}{
		{
			name:       "missing stored token",
			configure:  func(topUp *TopUp) { topUp.ExpectedBindingToken = "" },
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentExpectationInvalid,
		},
		{
			name:       "missing event token",
			settlement: StripeSettlement{SessionID: "cs_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentExpectationInvalid,
		},
		{
			name:       "mismatched event token",
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_other", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentSettlementMismatch,
		},
		{
			name:       "unsupported version one",
			configure:  func(topUp *TopUp) { topUp.PaymentExpectationVersion = 1 },
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentExpectationInvalid,
		},
		{
			name:       "legacy version two without quota snapshot contract",
			configure:  func(topUp *TopUp) { topUp.PaymentExpectationVersion = 2 },
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentExpectationInvalid,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			const userID = 407
			const tradeNo = "stripe-settlement-binding-reject"
			insertUserForPaymentGuardTest(t, userID, 0)
			insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
			if tc.configure != nil {
				topUp := GetTopUpByTradeNo(tradeNo)
				require.NotNil(t, topUp)
				tc.configure(topUp)
				require.NoError(t, topUp.Update())
			}

			err := RechargeStripeSettlement(tradeNo, tc.settlement)
			require.ErrorIs(t, err, tc.expected)
			stored := GetTopUpByTradeNo(tradeNo)
			require.NotNil(t, stored)
			assert.Equal(t, common.TopUpStatusPending, stored.Status)
			assert.Zero(t, getUserQuotaForPaymentGuardTest(t, userID))
		})
	}
}

func TestRechargeStripeSettlement_RejectsUnexpectedSettlement(t *testing.T) {
	testCases := []struct {
		name       string
		configure  func(*TopUp)
		settlement StripeSettlement
		expected   error
	}{
		{
			name:       "different session",
			settlement: StripeSettlement{SessionID: "cs_other", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentSettlementMismatch,
		},
		{
			name:       "different amount",
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_expected", AmountUnit: 201, Currency: "USD"},
			expected:   ErrPaymentSettlementMismatch,
		},
		{
			name:       "different currency",
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "CNY"},
			expected:   ErrPaymentSettlementMismatch,
		},
		{
			name:       "legacy expectation",
			configure:  func(topUp *TopUp) { topUp.PaymentExpectationVersion = 0 },
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrLegacyPaymentExpectation,
		},
		{
			name:       "missing settlement session",
			settlement: StripeSettlement{BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentExpectationInvalid,
		},
		{
			name:       "invalid expectation amount",
			configure:  func(topUp *TopUp) { topUp.ExpectedAmountUnit = 0 },
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentExpectationInvalid,
		},
		{
			name:       "missing expectation currency",
			configure:  func(topUp *TopUp) { topUp.ExpectedCurrency = "" },
			settlement: StripeSettlement{SessionID: "cs_expected", BindingToken: "stripe_binding_expected", AmountUnit: 200, Currency: "USD"},
			expected:   ErrPaymentExpectationInvalid,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			const userID = 402
			const tradeNo = "stripe-settlement-reject"
			insertUserForPaymentGuardTest(t, userID, 0)
			insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
			if tc.configure != nil {
				topUp := GetTopUpByTradeNo(tradeNo)
				require.NotNil(t, topUp)
				tc.configure(topUp)
				require.NoError(t, topUp.Update())
			}

			err := RechargeStripeSettlement(tradeNo, tc.settlement)
			require.ErrorIs(t, err, tc.expected)
			assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
			assert.Zero(t, getUserQuotaForPaymentGuardTest(t, userID))
		})
	}
}

func TestSetStripeTopUpExpectedSessionID_WebhookFirstSuccessIsIdempotent(t *testing.T) {
	truncateTables(t)

	const userID = 403
	const tradeNo = "stripe-session"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)

	settlement := StripeSettlement{
		SessionID:    "cs_expected",
		BindingToken: "stripe_binding_expected",
		AmountUnit:   200,
		Currency:     "USD",
	}
	require.NoError(t, RechargeStripeSettlement(tradeNo, settlement))
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))

	require.NoError(t, SetStripeTopUpExpectedSessionID(tradeNo, "cs_expected"))
	require.ErrorIs(t, SetStripeTopUpExpectedSessionID(tradeNo, "cs_other"), ErrPaymentSettlementMismatch)

	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	assert.Equal(t, "cs_expected", topUp.ExpectedSessionID)
	assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	assert.Equal(t, int(2*common.QuotaPerUnit), getUserQuotaForPaymentGuardTest(t, userID))
}

func TestManualCompleteTopUp_StripeUsesCreditedQuotaSnapshot(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	const userID = 413
	const tradeNo = "stripe-manual-completion-snapshot"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	topUp.Money = 24
	topUp.ExpectedAmount = 24
	topUp.ExpectedAmountUnit = 2400
	topUp.ExpectedCreditedQuota = 6_000_000
	require.NoError(t, topUp.Update())

	common.QuotaPerUnit = 7
	require.NoError(t, ManualCompleteTopUp(tradeNo, "127.0.0.1"))
	assert.Equal(t, 6_000_000, getUserQuotaForPaymentGuardTest(t, userID))
	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, tradeNo))

	require.NoError(t, ManualCompleteTopUp(tradeNo, "127.0.0.1"))
	assert.Equal(t, 6_000_000, getUserQuotaForPaymentGuardTest(t, userID))
}

func TestManualCompleteTopUp_StripeRejectsLegacyQuotaExpectation(t *testing.T) {
	truncateTables(t)

	const userID = 414
	const tradeNo = "stripe-manual-completion-legacy"
	insertUserForPaymentGuardTest(t, userID, 0)
	insertStripeExpectedTopUpForPaymentGuardTest(t, tradeNo, userID)
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	topUp.PaymentExpectationVersion = 2
	topUp.ExpectedCreditedQuota = 0
	require.NoError(t, topUp.Update())

	err := ManualCompleteTopUp(tradeNo, "127.0.0.1")
	require.ErrorIs(t, err, ErrPaymentExpectationInvalid)
	assert.Zero(t, getUserQuotaForPaymentGuardTest(t, userID))
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tradeNo))
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

func TestCompleteSubscriptionOrder_WaffoPancakeSettlementMismatchLeavesOrderPending(t *testing.T) {
	truncateTables(t)
	insertUserForPaymentGuardTest(t, 204, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 302)
	order := &SubscriptionOrder{
		UserId: 204, PlanId: plan.Id, Money: 9.99,
		PaymentExpectationVersion: 1, ExpectedAmount: 9.99, ExpectedCurrency: "USD", ExpectedStoreID: "store-expected",
		EntitlementSnapshotVersion: SubscriptionEntitlementSnapshotVersion,
		EntitlementSnapshot:        entitlementSnapshotForPaymentGuardTest(t, plan),
		TradeNo:                    "sub-pancake-guard", PaymentMethod: PaymentMethodWaffoPancake,
		PaymentProvider: PaymentProviderWaffoPancake, Status: common.TopUpStatusPending,
		CreateTime: time.Now().Unix(),
	}
	require.NoError(t, order.Insert())

	err := CompleteSubscriptionOrder("sub-pancake-guard", "{}", PaymentProviderWaffoPancake, "", SubscriptionPaymentSettlement{Amount: "8.99", Currency: "USD", StoreID: "store-expected"})
	require.ErrorIs(t, err, ErrPaymentSettlementMismatch)
	stored := GetSubscriptionOrderByTradeNo("sub-pancake-guard")
	require.NotNil(t, stored)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
	assert.Zero(t, countUserSubscriptionsForPaymentGuardTest(t, 204))
}

func TestCompleteSubscriptionOrder_WaffoPancakeSettlementMatchCompletes(t *testing.T) {
	truncateTables(t)
	insertUserForPaymentGuardTest(t, 205, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 303)
	order := &SubscriptionOrder{
		UserId: 205, PlanId: plan.Id, Money: 9.99,
		PaymentExpectationVersion: 1, ExpectedAmount: 9.99, ExpectedCurrency: "USD", ExpectedStoreID: "store-expected",
		EntitlementSnapshotVersion: SubscriptionEntitlementSnapshotVersion,
		EntitlementSnapshot:        entitlementSnapshotForPaymentGuardTest(t, plan),
		TradeNo:                    "sub-pancake-ok", PaymentMethod: PaymentMethodWaffoPancake,
		PaymentProvider: PaymentProviderWaffoPancake, Status: common.TopUpStatusPending,
		CreateTime: time.Now().Unix(),
	}
	require.NoError(t, order.Insert())

	require.NoError(t, CompleteSubscriptionOrder("sub-pancake-ok", "{}", PaymentProviderWaffoPancake, "", SubscriptionPaymentSettlement{Amount: "9.990", Currency: " usd ", StoreID: " store-expected "}))
	stored := GetSubscriptionOrderByTradeNo("sub-pancake-ok")
	require.NotNil(t, stored)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	assert.Equal(t, int64(1), countUserSubscriptionsForPaymentGuardTest(t, 205))
	require.NoError(t, CompleteSubscriptionOrder("sub-pancake-ok", "{}", PaymentProviderWaffoPancake, "", SubscriptionPaymentSettlement{Amount: "9.990", Currency: " usd ", StoreID: " store-expected "}))
	assert.Equal(t, int64(1), countUserSubscriptionsForPaymentGuardTest(t, 205))
}

func TestCompleteSubscriptionOrder_WaffoPancakeLegacyEntitlementSnapshotLeavesOrderPending(t *testing.T) {
	truncateTables(t)
	insertUserForPaymentGuardTest(t, 206, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 304)
	order := &SubscriptionOrder{
		UserId: 206, PlanId: plan.Id, Money: 9.99,
		PaymentExpectationVersion: 1, ExpectedAmount: 9.99, ExpectedCurrency: "USD", ExpectedStoreID: "store-expected",
		TradeNo: "sub-pancake-legacy-entitlement", PaymentMethod: PaymentMethodWaffoPancake,
		PaymentProvider: PaymentProviderWaffoPancake, Status: common.TopUpStatusPending,
		CreateTime: time.Now().Unix(),
	}
	require.NoError(t, order.Insert())

	err := CompleteSubscriptionOrder("sub-pancake-legacy-entitlement", "{}", PaymentProviderWaffoPancake, "", SubscriptionPaymentSettlement{Amount: "9.99", Currency: "USD", StoreID: "store-expected"})
	require.ErrorIs(t, err, ErrSubscriptionEntitlementInvalid)
	stored := GetSubscriptionOrderByTradeNo("sub-pancake-legacy-entitlement")
	require.NotNil(t, stored)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
	assert.Zero(t, countUserSubscriptionsForPaymentGuardTest(t, 206))
}

func TestCompleteSubscriptionOrder_WaffoPancakeUsesImmutableEntitlementSnapshot(t *testing.T) {
	truncateTables(t)
	insertUserForPaymentGuardTest(t, 207, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 305)
	allowOverflow := false
	plan.Title = "Purchased Plan"
	plan.DurationUnit = SubscriptionDurationCustom
	plan.DurationValue = 0
	plan.CustomSeconds = 7200
	plan.TotalAmount = 2345
	plan.QuotaResetPeriod = SubscriptionResetCustom
	plan.QuotaResetCustomSeconds = 600
	plan.UpgradeGroup = "vip"
	plan.DowngradeGroup = "default"
	plan.AllowWalletOverflow = &allowOverflow
	plan.MaxPurchasePerUser = 3
	require.NoError(t, DB.Save(plan).Error)

	order := &SubscriptionOrder{
		UserId: 207, PlanId: plan.Id, Money: 9.99,
		PaymentExpectationVersion: 1, ExpectedAmount: 9.99, ExpectedCurrency: "USD", ExpectedStoreID: "store-expected",
		EntitlementSnapshotVersion: SubscriptionEntitlementSnapshotVersion,
		EntitlementSnapshot:        entitlementSnapshotForPaymentGuardTest(t, plan),
		TradeNo:                    "sub-pancake-immutable-entitlement", PaymentMethod: PaymentMethodWaffoPancake,
		PaymentProvider: PaymentProviderWaffoPancake, Status: common.TopUpStatusPending,
		CreateTime: time.Now().Unix(),
	}
	require.NoError(t, order.Insert())

	require.NoError(t, DB.Delete(plan).Error)
	require.NoError(t, CompleteSubscriptionOrder("sub-pancake-immutable-entitlement", "{}", PaymentProviderWaffoPancake, "", SubscriptionPaymentSettlement{Amount: "9.99", Currency: "USD", StoreID: "store-expected"}))

	var subscription UserSubscription
	require.NoError(t, DB.Where("user_id = ?", 207).First(&subscription).Error)
	assert.Equal(t, plan.Id, subscription.PlanId)
	assert.Equal(t, int64(2345), subscription.AmountTotal)
	assert.Equal(t, int64(7200), subscription.EndTime-subscription.StartTime)
	assert.Equal(t, int64(600), subscription.NextResetTime-subscription.StartTime)
	assert.Equal(t, "vip", subscription.UpgradeGroup)
	assert.Equal(t, "default", subscription.DowngradeGroup)
	assert.False(t, subscription.AllowWalletOverflow)
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

func createEpayTestOrder(t *testing.T, userId int, tradeNo string, provider string, status string) TopUp {
	t.Helper()
	topUp := TopUp{
		UserId:          userId,
		Amount:          2,
		Money:           10.0,
		TradeNo:         tradeNo,
		PaymentMethod:   "alipay",
		PaymentProvider: provider,
		CreateTime:      common.GetTimestamp(),
		Status:          status,
	}
	require.NoError(t, DB.Create(&topUp).Error)
	return topUp
}

func TestRechargeEpayCreditsQuotaExactlyOnce(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 501, 0)
	order := createEpayTestOrder(t, user.Id, "EPAYTESTONCE", PaymentProviderEpay, common.TopUpStatusPending)

	alreadyDone, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.NotZero(t, reloaded.CompleteTime)

	alreadyDone, err = RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeEpayKeepsRedisAndDatabaseCreditInSync(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 5
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 502, 7)
	require.NoError(t, populateUserCache(*user))
	order := createEpayTestOrder(t, user.Id, "EPAYTESTREDISSYNC", PaymentProviderEpay, common.TopUpStatusPending)

	alreadyDone, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 17, getUserQuotaForPaymentGuardTest(t, user.Id))
	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 17, cached.Quota)

	alreadyDone, err = RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	cached, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 17, cached.Quota)
}

func TestRechargeEpayUpdatesPaymentMethodToActual(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 503, 0)
	order := createEpayTestOrder(t, user.Id, "EPAYTESTMETHOD", PaymentProviderEpay, common.TopUpStatusPending)

	alreadyDone, err := RechargeEpay(order.TradeNo, "wxpay", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, "wxpay", reloaded.PaymentMethod)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeEpayRejectsForeignAndNonPendingOrders(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 504, 7)

	t.Run("order from another payment provider", func(t *testing.T) {
		order := createEpayTestOrder(t, user.Id, "EPAYTESTSTRIPE", PaymentProviderStripe, common.TopUpStatusPending)
		_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
		assert.ErrorIs(t, err, ErrPaymentMethodMismatch)
		assert.Equal(t, 7, getUserQuotaForPaymentGuardTest(t, user.Id))
	})

	t.Run("order that is not pending", func(t *testing.T) {
		order := createEpayTestOrder(t, user.Id, "EPAYTESTEXPIRED", PaymentProviderEpay, common.TopUpStatusExpired)
		_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
		assert.ErrorIs(t, err, ErrTopUpStatusInvalid)
		assert.Equal(t, 7, getUserQuotaForPaymentGuardTest(t, user.Id))
	})

	t.Run("missing order", func(t *testing.T) {
		_, err := RechargeEpay("EPAYTESTMISSING", "alipay", "127.0.0.1")
		assert.ErrorIs(t, err, ErrTopUpNotFound)
	})
}

func TestRechargeEpayRejectsQuotaOverflowBeforeCompletingOrder(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = float64(common.MaxQuota)
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 505, 3)
	order := createEpayTestOrder(t, user.Id, "EPAYTESTOVERFLOW", PaymentProviderEpay, common.TopUpStatusPending)

	_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.Error(t, err)
	assert.Equal(t, 3, getUserQuotaForPaymentGuardTest(t, user.Id))
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
}

func TestRechargeEpayEnforcesFinalWalletQuotaLimit(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	testCases := []struct {
		name         string
		currentQuota int
		wantErr      bool
		wantQuota    int
		wantStatus   string
	}{
		{
			name:         "allows exact highest representable wallet balance",
			currentQuota: common.MaxQuota - 1 - 1_000_000,
			wantQuota:    common.MaxQuota - 1,
			wantStatus:   common.TopUpStatusSuccess,
		},
		{
			name:         "rejects balance above int32 quota domain",
			currentQuota: common.MaxQuota - 1_000_000,
			wantErr:      true,
			wantQuota:    common.MaxQuota - 1_000_000,
			wantStatus:   common.TopUpStatusPending,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			user := insertUserForPaymentGuardTest(t, 506, tc.currentQuota)
			order := createEpayTestOrder(t, user.Id, "EPAYTESTWALLETLIMIT", PaymentProviderEpay, common.TopUpStatusPending)

			_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
			if tc.wantErr {
				require.ErrorIs(t, err, ErrTopUpQuotaLimitExceeded)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tc.wantQuota, getUserQuotaForPaymentGuardTest(t, user.Id))
			assert.Equal(t, tc.wantStatus, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
		})
	}
}
