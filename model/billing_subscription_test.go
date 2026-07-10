package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBillingSubscription_CreateAndFindByProviderSubscriptionID(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Title:                  "Pro Auto Renew",
		PriceAmount:            19.99,
		Currency:               "USD",
		DurationUnit:           SubscriptionDurationMonth,
		DurationValue:          1,
		TotalAmount:            500000,
		BillingMode:            "auto_renew",
		StripeRecurringPriceId: "price_recurring_pro",
		Enabled:                true,
	}
	require.NoError(t, DB.Create(plan).Error)

	sub := &BillingSubscription{
		UserId:                 101,
		PlanId:                 plan.Id,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_123",
		ProviderCustomerId:     "cus_123",
		ProviderPriceId:        "price_recurring_pro",
		Status:                 "active",
		CurrentPeriodStart:     1761955200,
		CurrentPeriodEnd:       1764547200,
	}
	require.NoError(t, DB.Create(sub).Error)

	got, err := GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_123")
	require.NoError(t, err)
	require.Equal(t, sub.UserId, got.UserId)
	require.Equal(t, "active", got.Status)
}
