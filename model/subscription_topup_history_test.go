package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestSyncSubscriptionOrderTopUpHistoryCreatesPendingFromOrderSession(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
	order := &SubscriptionOrder{
		UserId:             101,
		PlanId:             201,
		Money:              12.34,
		TradeNo:            "history-pending-order",
		PaymentMethod:      SubscriptionPaymentMethodPix,
		PaymentProvider:    PaymentProviderStripe,
		Status:             common.TopUpStatusPending,
		CreateTime:         12345,
		PaymentCurrency:    "BRL",
		PaymentAmountMinor: 1234,
		ProviderSessionId:  "cs_pending_history",
	}
	require.NoError(t, DB.Create(order).Error)

	require.NoError(t, SyncSubscriptionOrderTopUpHistory(order.TradeNo))
	require.NoError(t, SyncSubscriptionOrderTopUpHistory(order.TradeNo))

	var topUps []TopUp
	require.NoError(t, DB.Where("trade_no = ?", order.TradeNo).Find(&topUps).Error)
	require.Len(t, topUps, 1)
	require.Equal(t, order.UserId, topUps[0].UserId)
	require.Equal(t, order.Money, topUps[0].Money)
	require.Equal(t, order.PaymentMethod, topUps[0].PaymentMethod)
	require.Equal(t, order.PaymentProvider, topUps[0].PaymentProvider)
	require.Equal(t, order.PaymentCurrency, topUps[0].PaymentCurrency)
	require.Equal(t, order.PaymentAmountMinor, topUps[0].PaymentAmountMinor)
	require.Equal(t, order.ProviderSessionId, topUps[0].GatewayTradeNo)
	require.Equal(t, order.CreateTime, topUps[0].CreateTime)
	require.Zero(t, topUps[0].CompleteTime)
	require.Equal(t, common.TopUpStatusPending, topUps[0].Status)
}

func TestSyncSubscriptionOrderTopUpHistoryDoesNotDowngradeSuccessfulTopUpToPending(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
	order := &SubscriptionOrder{
		UserId:            102,
		PlanId:            202,
		Money:             20,
		TradeNo:           "history-terminal-preserve",
		PaymentMethod:     PaymentMethodStripe,
		PaymentProvider:   PaymentProviderStripe,
		Status:            common.TopUpStatusPending,
		CreateTime:        22222,
		PaymentCurrency:   "USD",
		ProviderSessionId: "cs_new_pending",
	}
	require.NoError(t, DB.Create(order).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId:          order.UserId,
		Money:           20,
		TradeNo:         order.TradeNo,
		GatewayTradeNo:  "cs_paid_existing",
		PaymentMethod:   order.PaymentMethod,
		PaymentProvider: order.PaymentProvider,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      11111,
		CompleteTime:    11112,
	}).Error)

	require.NoError(t, SyncSubscriptionOrderTopUpHistory(order.TradeNo))

	topUp := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, topUp)
	require.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	require.Equal(t, "cs_paid_existing", topUp.GatewayTradeNo)
	require.Equal(t, int64(11112), topUp.CompleteTime)
}

func TestSyncSubscriptionOrderTopUpHistorySyncsTerminalOrderStatus(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
	order := &SubscriptionOrder{
		UserId:             103,
		PlanId:             203,
		Money:              9.99,
		TradeNo:            "history-expired-order",
		PaymentMethod:      SubscriptionPaymentMethodUPI,
		PaymentProvider:    PaymentProviderStripe,
		Status:             common.TopUpStatusExpired,
		CreateTime:         33333,
		CompleteTime:       33344,
		PaymentCurrency:    "INR",
		PaymentAmountMinor: 999,
		ProviderSessionId:  "cs_expired_history",
	}
	require.NoError(t, DB.Create(order).Error)

	require.NoError(t, SyncSubscriptionOrderTopUpHistory(order.TradeNo))

	topUp := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, topUp)
	require.Equal(t, common.TopUpStatusExpired, topUp.Status)
	require.Equal(t, order.CompleteTime, topUp.CompleteTime)
	require.Equal(t, order.ProviderSessionId, topUp.GatewayTradeNo)
}

func TestSyncSubscriptionOrderTopUpHistoryRejectsOwnershipConflict(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
	order := &SubscriptionOrder{
		UserId:            104,
		PlanId:            204,
		Money:             8,
		TradeNo:           "history-owner-conflict",
		PaymentMethod:     PaymentMethodStripe,
		PaymentProvider:   PaymentProviderStripe,
		Status:            common.TopUpStatusSuccess,
		CreateTime:        44444,
		CompleteTime:      44455,
		PaymentCurrency:   "USD",
		ProviderSessionId: "cs_owner_conflict",
	}
	require.NoError(t, DB.Create(order).Error)
	require.NoError(t, DB.Create(&TopUp{
		UserId:          999,
		TradeNo:         order.TradeNo,
		PaymentMethod:   order.PaymentMethod,
		PaymentProvider: order.PaymentProvider,
		Status:          common.TopUpStatusPending,
	}).Error)

	err := SyncSubscriptionOrderTopUpHistory(order.TradeNo)

	require.ErrorIs(t, err, ErrPaymentMethodMismatch)
	topUp := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, topUp)
	require.Equal(t, 999, topUp.UserId)
	require.Equal(t, common.TopUpStatusPending, topUp.Status)
}

func TestSyncSubscriptionOrderTopUpHistoryRequiresGatewayTradeNoForPending(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}, &TopUp{}))
	order := &SubscriptionOrder{
		UserId:          105,
		PlanId:          205,
		Money:           7,
		TradeNo:         "history-pending-missing-session",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      55555,
		PaymentCurrency: "USD",
	}
	require.NoError(t, DB.Create(order).Error)

	err := SyncSubscriptionOrderTopUpHistory(order.TradeNo)

	require.Error(t, err)
	require.False(t, errors.Is(err, ErrSubscriptionOrderNotFound))
	require.Nil(t, GetTopUpByTradeNo(order.TradeNo))
}
