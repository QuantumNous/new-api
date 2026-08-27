package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// RechargeNativeQR 结算被前端轮询和异步回调共用，必须保证：同一订单最多充值一次、
// 渠道不匹配时拒绝、金额溢出时在完成订单前失败且不扣不加。以下用例直接守护这些不变量。

func TestRechargeNativeQRCreditsQuotaExactlyOnce(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 601, 0)
	order := createEpayTestOrder(t, user.Id, "NATIVEONCE", PaymentProviderWechatNative, common.TopUpStatusPending)

	alreadyDone, err := RechargeNativeQR(order.TradeNo, PaymentProviderWechatNative, "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.NotZero(t, reloaded.CompleteTime)

	// 重复调用（回调 + 轮询同时到达）必须幂等，不再二次充值
	alreadyDone, err = RechargeNativeQR(order.TradeNo, PaymentProviderWechatNative, "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeNativeQRRejectsMismatchedProvider(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 602, 7)
	// 订单实际属于支付宝渠道，却用微信渠道来结算，必须拒绝
	order := createEpayTestOrder(t, user.Id, "NATIVEMISMATCH", PaymentProviderAlipayNative, common.TopUpStatusPending)

	_, err := RechargeNativeQR(order.TradeNo, PaymentProviderWechatNative, "127.0.0.1")
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)
	assert.Equal(t, 7, getUserQuotaForPaymentGuardTest(t, user.Id))
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
}

func TestRechargeNativeQRRejectsQuotaOverflowBeforeCompletingOrder(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = float64(common.MaxWalletQuota + 1)
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 603, 3)
	order := createEpayTestOrder(t, user.Id, "NATIVEOVERFLOW", PaymentProviderAlipayNative, common.TopUpStatusPending)

	_, err := RechargeNativeQR(order.TradeNo, PaymentProviderAlipayNative, "127.0.0.1")
	require.Error(t, err)
	assert.Equal(t, 3, getUserQuotaForPaymentGuardTest(t, user.Id))
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
}
