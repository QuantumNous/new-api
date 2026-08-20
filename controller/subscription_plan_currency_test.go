package controller

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func resetSubscriptionPlanCurrencyPriceCacheForTest() {
	subscriptionPlanCurrencyPriceCache.Lock()
	subscriptionPlanCurrencyPriceCache.entries = make(map[string]subscriptionPlanCurrencyPriceCacheEntry)
	subscriptionPlanCurrencyPriceCache.Unlock()
}

func TestSubscriptionPlanCurrencyPricesUsesStripeOptionsAndConfiguredLocalOverrides(t *testing.T) {
	originalGetter := stripePriceGetter
	originalSecret := setting.StripeApiSecret
	originalNow := subscriptionPlanCurrencyPriceNow
	t.Cleanup(func() {
		stripePriceGetter = originalGetter
		setting.StripeApiSecret = originalSecret
		subscriptionPlanCurrencyPriceNow = originalNow
		resetSubscriptionPlanCurrencyPriceCacheForTest()
	})
	resetSubscriptionPlanCurrencyPriceCacheForTest()
	setting.StripeApiSecret = "sk_test_subscription_plan_currency"
	subscriptionPlanCurrencyPriceNow = func() time.Time { return time.Unix(1_700_000_000, 0) }
	stripePriceGetter = func(priceID string, params *stripe.PriceParams) (*stripe.Price, error) {
		require.Equal(t, "price_plan_go", priceID)
		require.NotNil(t, params)
		return &stripe.Price{
			Currency:   stripe.CurrencyUSD,
			UnitAmount: 1_000,
			CurrencyOptions: map[string]*stripe.PriceCurrencyOptions{
				"jpy": {UnitAmount: 1_500},
				"brl": {UnitAmount: 4_000},
				"eur": {UnitAmount: 900},
			},
		}, nil
	}
	pixPrice := 49.9

	prices, err := subscriptionPlanCurrencyPrices(&model.SubscriptionPlan{
		PriceAmount:   10,
		Currency:      "USD",
		PixPriceBRL:   &pixPrice,
		StripePriceId: "price_plan_go",
	})

	require.NoError(t, err)
	require.Equal(t, map[string]float64{
		"USD": 10,
		"JPY": 1_500,
		"BRL": 49.9,
	}, prices)
}

func TestSubscriptionPlanCurrencyPricesFallsBackToDatabasePricesWhenStripeFails(t *testing.T) {
	originalGetter := stripePriceGetter
	originalSecret := setting.StripeApiSecret
	t.Cleanup(func() {
		stripePriceGetter = originalGetter
		setting.StripeApiSecret = originalSecret
		resetSubscriptionPlanCurrencyPriceCacheForTest()
	})
	resetSubscriptionPlanCurrencyPriceCacheForTest()
	setting.StripeApiSecret = "sk_test_subscription_plan_currency"
	stripePriceGetter = func(string, *stripe.PriceParams) (*stripe.Price, error) {
		return nil, errors.New("stripe unavailable")
	}
	upiPrice := 899.0

	prices, err := subscriptionPlanCurrencyPrices(&model.SubscriptionPlan{
		PriceAmount:   10,
		Currency:      "USD",
		UpiPriceINR:   &upiPrice,
		StripePriceId: "price_plan_go_failure",
	})

	require.EqualError(t, err, "stripe unavailable")
	require.Equal(t, map[string]float64{
		"USD": 10,
		"INR": 899,
	}, prices)
}
