package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionOrderPersistsPaymentCurrencyAndMinorAmount(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}))

	order := &SubscriptionOrder{
		UserId:             10,
		PlanId:             20,
		TradeNo:            "payment-currency-minor",
		PaymentProvider:    PaymentProviderStripe,
		PaymentMethod:      SubscriptionPaymentMethodPix,
		PurchaseMonths:     2,
		UnitPrice:          11,
		Money:              22,
		PaymentCurrency:    "BRL",
		PaymentAmountMinor: 2200,
		Status:             common.TopUpStatusPending,
	}

	require.NoError(t, DB.Create(order).Error)

	var stored SubscriptionOrder
	require.NoError(t, DB.Where("trade_no = ?", order.TradeNo).First(&stored).Error)
	require.Equal(t, "BRL", stored.PaymentCurrency)
	require.Equal(t, int64(2200), stored.PaymentAmountMinor)
	require.Equal(t, float64(11), stored.UnitPrice)
	require.Equal(t, float64(22), stored.Money)
}
