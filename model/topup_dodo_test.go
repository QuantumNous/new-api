package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRechargeDodoCreditsCapturedQuotaExactlyOnce(t *testing.T) {
	truncateTables(t)

	user := insertUserForPaymentGuardTest(t, 801, 10)
	order := &TopUp{
		UserId:          user.Id,
		Amount:          2,
		Money:           2,
		TradeNo:         "DODOTESTONCE",
		PaymentMethod:   PaymentMethodDodo,
		PaymentProvider: PaymentProviderDodo,
		ExpectedAmount:  200,
		CreditedQuota:   1234,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, order.Insert())

	alreadyDone, err := RechargeDodo(order.TradeNo, "pay_123", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 1244, getUserQuotaForPaymentGuardTest(t, user.Id))

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.Equal(t, "pay_123", reloaded.ProviderOrderID)
	assert.NotZero(t, reloaded.CompleteTime)

	alreadyDone, err = RechargeDodo(order.TradeNo, "pay_123", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	assert.Equal(t, 1244, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeDodoRejectsWrongProviderAndInvalidCapturedQuota(t *testing.T) {
	testCases := []struct {
		name          string
		provider      string
		creditedQuota int
		expectedError error
	}{
		{name: "wrong provider", provider: PaymentProviderStripe, creditedQuota: 100, expectedError: ErrPaymentMethodMismatch},
		{name: "zero captured quota", provider: PaymentProviderDodo, creditedQuota: 0, expectedError: ErrInvalidTopUpQuota},
	}

	for index, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			truncateTables(t)
			user := insertUserForPaymentGuardTest(t, 820+index, 0)
			order := &TopUp{
				UserId:          user.Id,
				Amount:          1,
				Money:           1,
				TradeNo:         "DODOTESTINVALID" + testCase.name,
				PaymentMethod:   PaymentMethodDodo,
				PaymentProvider: testCase.provider,
				ExpectedAmount:  100,
				CreditedQuota:   testCase.creditedQuota,
				CreateTime:      time.Now().Unix(),
				Status:          common.TopUpStatusPending,
			}
			require.NoError(t, order.Insert())

			_, err := RechargeDodo(order.TradeNo, "pay_invalid", "127.0.0.1")
			require.ErrorIs(t, err, testCase.expectedError)
			assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, user.Id))
			assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
		})
	}
}
