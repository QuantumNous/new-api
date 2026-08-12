package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertDogPayTopUpTestFixture(t *testing.T, tradeNo string) {
	t.Helper()
	insertUserForPaymentGuardTest(t, 901, 0)
	topUp := &TopUp{
		UserId:                 901,
		Money:                  10,
		QuotaToCredit:          500,
		DogPayOrderAmount:      10.50,
		DogPayCurrencyConfigID: "currency-config-usdt",
		DogPayPayChannel:       "pay_002",
		TradeNo:                tradeNo,
		PaymentMethod:          PaymentMethodDogPay,
		PaymentProvider:        PaymentProviderDogPay,
		CreateTime:             time.Now().Unix(),
		Status:                 common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
}

func TestRechargeDogPayCreditsMatchingPaymentOnce(t *testing.T) {
	truncateTables(t)
	insertDogPayTopUpTestFixture(t, "dogpay-settle-once")

	topUp, quotaToAdd, credited, err := RechargeDogPay(
		"dogpay-settle-once",
		"dogpay-tx-1",
		"10.50",
		"USDT",
		"currency-config-usdt",
		"pay_002",
		"127.0.0.1",
	)
	require.NoError(t, err)
	require.NotNil(t, topUp)
	assert.True(t, credited)
	assert.Equal(t, 500, quotaToAdd)
	assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	assert.Equal(t, "dogpay-tx-1", topUp.ThirdPartyTxId)
	assert.Equal(t, 500, getUserQuotaForPaymentGuardTest(t, 901))

	_, quotaToAdd, credited, err = RechargeDogPay(
		"dogpay-settle-once",
		"dogpay-tx-1",
		"10.50",
		"USDT",
		"currency-config-usdt",
		"pay_002",
		"127.0.0.1",
	)
	require.NoError(t, err)
	assert.False(t, credited)
	assert.Zero(t, quotaToAdd)
	assert.Equal(t, 500, getUserQuotaForPaymentGuardTest(t, 901))
}

func TestRechargeDogPayRejectsPaymentAmountMismatch(t *testing.T) {
	truncateTables(t)
	insertDogPayTopUpTestFixture(t, "dogpay-settle-amount")

	_, _, credited, err := RechargeDogPay(
		"dogpay-settle-amount",
		"dogpay-tx-2",
		"10.49",
		"USDT",
		"currency-config-usdt",
		"pay_002",
		"127.0.0.1",
	)
	require.ErrorIs(t, err, ErrDogPayAmountMismatch)
	assert.False(t, credited)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, "dogpay-settle-amount"))
	assert.Zero(t, getUserQuotaForPaymentGuardTest(t, 901))
}

func TestRechargeDogPayRejectsMissingPaymentAmount(t *testing.T) {
	truncateTables(t)
	insertDogPayTopUpTestFixture(t, "dogpay-settle-missing-amount")

	_, _, credited, err := RechargeDogPay(
		"dogpay-settle-missing-amount",
		"dogpay-tx-missing-amount",
		"",
		"USDT",
		"currency-config-usdt",
		"pay_002",
		"127.0.0.1",
	)
	require.ErrorIs(t, err, ErrDogPayAmountMismatch)
	assert.False(t, credited)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, "dogpay-settle-missing-amount"))
	assert.Zero(t, getUserQuotaForPaymentGuardTest(t, 901))
}

func TestRechargeDogPayRejectsQuotaOverflow(t *testing.T) {
	truncateTables(t)
	insertDogPayTopUpTestFixture(t, "dogpay-settle-overflow")
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 901).Update("quota", common.MaxQuota-100).Error)

	_, _, credited, err := RechargeDogPay(
		"dogpay-settle-overflow",
		"dogpay-tx-3",
		"10.50",
		"USDT",
		"currency-config-usdt",
		"pay_002",
		"127.0.0.1",
	)
	require.ErrorIs(t, err, ErrDogPayQuotaOverflow)
	assert.False(t, credited)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, "dogpay-settle-overflow"))
	assert.Equal(t, common.MaxQuota-100, getUserQuotaForPaymentGuardTest(t, 901))
}
