package controller

import (
	"errors"
	"sync"
	"sync/atomic"
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

func TestSubscriptionPlanCurrencyPricesFallsBackToStaleStripePricesWhenRefreshFails(t *testing.T) {
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
	setting.StripeApiSecret = "sk_test_subscription_plan_currency_stale"
	now := time.Unix(1_700_000_000, 0)
	subscriptionPlanCurrencyPriceNow = func() time.Time { return now }
	stripePriceGetter = func(string, *stripe.PriceParams) (*stripe.Price, error) {
		return &stripe.Price{
			Currency:   stripe.CurrencyUSD,
			UnitAmount: 1_000,
			CurrencyOptions: map[string]*stripe.PriceCurrencyOptions{
				"jpy": {UnitAmount: 1_500},
			},
		}, nil
	}

	plan := &model.SubscriptionPlan{PriceAmount: 10, Currency: "USD", StripePriceId: "price_plan_stale"}
	prices, err := subscriptionPlanCurrencyPrices(plan)
	require.NoError(t, err)
	require.Equal(t, map[string]float64{"USD": 10, "JPY": 1_500}, prices)

	now = now.Add(subscriptionPlanCurrencyPriceCacheTTL + time.Second)
	stripePriceGetter = func(string, *stripe.PriceParams) (*stripe.Price, error) {
		return nil, errors.New("stripe unavailable")
	}

	prices, err = subscriptionPlanCurrencyPrices(plan)
	require.EqualError(t, err, "refresh Stripe Price price_plan_stale: stripe unavailable (using stale prices)")
	require.Equal(t, map[string]float64{"USD": 10, "JPY": 1_500}, prices)

	now = time.Unix(1_700_000_000, 0).Add(subscriptionPlanCurrencyPriceMaxStaleAge + time.Second)
	prices, err = subscriptionPlanCurrencyPrices(plan)
	require.EqualError(t, err, "stripe unavailable")
	require.Equal(t, map[string]float64{"USD": 10}, prices)
}

func TestSubscriptionPlanCurrencyPricesMergesConcurrentStripeRefreshes(t *testing.T) {
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
	setting.StripeApiSecret = "sk_test_subscription_plan_currency_singleflight"
	subscriptionPlanCurrencyPriceNow = func() time.Time { return time.Unix(1_700_000_000, 0) }

	var calls atomic.Int32
	release := make(chan struct{})
	var releaseOnce sync.Once
	stripePriceGetter = func(string, *stripe.PriceParams) (*stripe.Price, error) {
		calls.Add(1)
		<-release
		return &stripe.Price{
			Currency:   stripe.CurrencyUSD,
			UnitAmount: 1_000,
			CurrencyOptions: map[string]*stripe.PriceCurrencyOptions{
				"jpy": {UnitAmount: 1_500},
			},
		}, nil
	}

	const callers = 8
	results := make(chan map[string]float64, callers)
	errs := make(chan error, callers)
	var wg sync.WaitGroup
	for i := 0; i < callers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			prices, err := cachedSubscriptionPlanStripeCurrencyPrices("price_plan_singleflight")
			results <- prices
			errs <- err
		}()
	}

	deadline := time.NewTimer(time.Second)
	for calls.Load() == 0 {
		select {
		case <-deadline.C:
			t.Fatal("Stripe refresh did not start")
		default:
			time.Sleep(time.Millisecond)
		}
	}
	if !deadline.Stop() {
		<-deadline.C
	}
	releaseOnce.Do(func() { close(release) })
	wg.Wait()
	close(results)
	close(errs)

	require.Equal(t, int32(1), calls.Load())
	for err := range errs {
		require.NoError(t, err)
	}
	for prices := range results {
		require.Equal(t, map[string]float64{"USD": 10, "JPY": 1_500}, prices)
	}
}
