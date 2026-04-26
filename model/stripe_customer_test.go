package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetStripeCustomerIDSeparatesLiveAndTest(t *testing.T) {
	user := &User{
		StripeCustomer:     "cus_legacy",
		StripeCustomerTest: "cus_test",
		StripeCustomerLive: "cus_live",
	}

	assert.Equal(t, "cus_live", GetStripeCustomerID(user, true))
	assert.Equal(t, "cus_test", GetStripeCustomerID(user, false))
	assert.Equal(t, "", GetStripeCustomerID(&User{StripeCustomer: "cus_legacy"}, true))
	assert.Equal(t, "cus_legacy", GetStripeCustomerID(&User{StripeCustomer: "cus_legacy"}, false))
	assert.Equal(t, "", GetStripeCustomerID(nil, false))
}

func TestRechargeStoresStripeCustomerByLivemode(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       601,
		Username: "stripe_customer_user",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)

	insertStripeTopUpForCustomerTest(t, "stripe-test-customer", user.Id)
	require.NoError(t, Recharge("stripe-test-customer", "cus_test_123", false, "127.0.0.1"))

	var stored User
	require.NoError(t, DB.First(&stored, "id = ?", user.Id).Error)
	assert.Equal(t, "cus_test_123", stored.StripeCustomer)
	assert.Equal(t, "cus_test_123", stored.StripeCustomerTest)
	assert.Empty(t, stored.StripeCustomerLive)

	insertStripeTopUpForCustomerTest(t, "stripe-live-customer", user.Id)
	require.NoError(t, Recharge("stripe-live-customer", "cus_live_123", true, "127.0.0.1"))

	require.NoError(t, DB.First(&stored, "id = ?", user.Id).Error)
	assert.Equal(t, "cus_test_123", stored.StripeCustomer)
	assert.Equal(t, "cus_test_123", stored.StripeCustomerTest)
	assert.Equal(t, "cus_live_123", stored.StripeCustomerLive)
}

func TestCompleteStripeSubscriptionOrderStoresCustomerByLivemode(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       602,
		Username: "stripe_subscription_user",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 702)
	insertSubscriptionOrderForPaymentGuardTest(t, "sub-stripe-customer", user.Id, plan.Id, PaymentProviderStripe)

	err := CompleteStripeSubscriptionOrder("sub-stripe-customer", `{"customer":"cus_live_sub"}`, "cus_live_sub", true)
	require.NoError(t, err)

	var stored User
	require.NoError(t, DB.First(&stored, "id = ?", user.Id).Error)
	assert.Empty(t, stored.StripeCustomer)
	assert.Empty(t, stored.StripeCustomerTest)
	assert.Equal(t, "cus_live_sub", stored.StripeCustomerLive)
}

func insertStripeTopUpForCustomerTest(t *testing.T, tradeNo string, userID int) {
	t.Helper()
	topUp := &TopUp{
		UserId:          userID,
		Amount:          1,
		Money:           1,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      time.Now().Unix(),
	}
	require.NoError(t, topUp.Insert())
}
