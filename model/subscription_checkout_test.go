package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedCheckoutPlan(t *testing.T, userId int, planId int) *SubscriptionPlan {
	t.Helper()
	require.NoError(t, DB.Create(&User{Id: userId, Username: "checkout-user", Password: "password1", Group: "default"}).Error)
	allow := true
	plan := &SubscriptionPlan{
		Id:                  planId,
		Title:               "Checkout plan",
		PriceAmount:         19,
		Currency:            "USD",
		DurationUnit:        SubscriptionDurationMonth,
		DurationValue:       1,
		Enabled:             true,
		TotalAmount:         80_000_000,
		WeeklyAmount:        40_000_000,
		MaxActivePerUser:    1,
		AllowWalletOverflow: &allow,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func TestSubscriptionCheckoutReservationSerializesAcrossProviders(t *testing.T) {
	truncateTables(t)
	plan := seedCheckoutPlan(t, 9301, 7301)

	first := &SubscriptionOrder{UserId: 9301, PlanId: plan.Id, Money: plan.PriceAmount, TradeNo: "sub_epay_first", PaymentMethod: "nowpayments", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, ReserveSubscriptionCheckout(9301, first))
	second := &SubscriptionOrder{UserId: 9301, PlanId: plan.Id, Money: plan.PriceAmount, TradeNo: "sub_stripe_second", PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe, Status: common.TopUpStatusPending}
	require.ErrorIs(t, ReserveSubscriptionCheckout(9301, second), ErrSubscriptionCheckoutPending)

	var orders, reservations int64
	require.NoError(t, DB.Model(&SubscriptionOrder{}).Where("user_id = ?", 9301).Count(&orders).Error)
	require.NoError(t, DB.Model(&SubscriptionCheckoutReservation{}).Where("user_id = ?", 9301).Count(&reservations).Error)
	assert.EqualValues(t, 1, orders)
	assert.EqualValues(t, 1, reservations)
}

func TestSettledSubscriptionOrderAlwaysDeliversReservedEntitlement(t *testing.T) {
	truncateTables(t)
	plan := seedCheckoutPlan(t, 9302, 7302)
	order := &SubscriptionOrder{UserId: 9302, PlanId: plan.Id, Money: plan.PriceAmount, TradeNo: "sub_paid_reserved", PaymentMethod: "nowpayments", PaymentProvider: PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, ReserveSubscriptionCheckout(9302, order))

	now := GetDBTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{UserId: 9302, PlanId: plan.Id, AmountTotal: plan.TotalAmount, StartTime: now - 60, EndTime: now + 3600, Status: "active"}).Error)
	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "{}", PaymentProviderEpay, "nowpayments"))

	var subscriptions, reservations int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 9302).Count(&subscriptions).Error)
	require.NoError(t, DB.Model(&SubscriptionCheckoutReservation{}).Where("user_id = ?", 9302).Count(&reservations).Error)
	assert.EqualValues(t, 2, subscriptions)
	assert.Zero(t, reservations)
	require.NoError(t, DB.Where("trade_no = ?", order.TradeNo).First(order).Error)
	assert.Equal(t, common.TopUpStatusSuccess, order.Status)
}
