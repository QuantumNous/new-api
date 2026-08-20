package controller

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/stripe/stripe-go/v86"
	"golang.org/x/sync/singleflight"
)

const (
	subscriptionPlanCurrencyPriceCacheTTL    = 5 * time.Minute
	subscriptionPlanCurrencyPriceMaxStaleAge = 30 * time.Minute
)

var subscriptionPlanSupportedCurrencies = [...]string{"USD", "JPY", "BRL", "INR"}

type subscriptionPlanCurrencyPriceCacheEntry struct {
	prices     map[string]float64
	expiresAt  time.Time
	staleUntil time.Time
}

var subscriptionPlanCurrencyPriceCache = struct {
	sync.RWMutex
	entries map[string]subscriptionPlanCurrencyPriceCacheEntry
}{entries: make(map[string]subscriptionPlanCurrencyPriceCacheEntry)}

var subscriptionPlanCurrencyPriceNow = time.Now
var subscriptionPlanCurrencyPriceSingleflight singleflight.Group

func subscriptionPlanCurrencyPrices(plan *model.SubscriptionPlan) (map[string]float64, error) {
	prices := make(map[string]float64)
	if plan == nil {
		return prices, nil
	}

	canonicalCurrency := strings.ToUpper(strings.TrimSpace(plan.Currency))
	if canonicalCurrency == "" {
		canonicalCurrency = "USD"
	}
	if plan.PriceAmount > 0 {
		prices[canonicalCurrency] = plan.PriceAmount
	}

	var lookupErr error
	if priceID := strings.TrimSpace(plan.StripePriceId); priceID != "" {
		var stripePrices map[string]float64
		stripePrices, lookupErr = cachedSubscriptionPlanStripeCurrencyPrices(priceID)
		for currency, amount := range stripePrices {
			if amount > 0 {
				prices[currency] = amount
			}
		}
	}

	if plan.PixPriceBRL != nil && *plan.PixPriceBRL > 0 {
		prices["BRL"] = *plan.PixPriceBRL
	}
	if plan.UpiPriceINR != nil && *plan.UpiPriceINR > 0 {
		prices["INR"] = *plan.UpiPriceINR
	}
	return prices, lookupErr
}

func cachedSubscriptionPlanStripeCurrencyPrices(priceID string) (map[string]float64, error) {
	priceID = strings.TrimSpace(priceID)
	if priceID == "" {
		return map[string]float64{}, nil
	}
	pricesAny, err, _ := subscriptionPlanCurrencyPriceSingleflight.Do(priceID, func() (any, error) {
		now := subscriptionPlanCurrencyPriceNow()
		subscriptionPlanCurrencyPriceCache.RLock()
		entry, ok := subscriptionPlanCurrencyPriceCache.entries[priceID]
		subscriptionPlanCurrencyPriceCache.RUnlock()
		if ok && now.Before(entry.expiresAt) {
			return cloneSubscriptionPlanCurrencyPrices(entry.prices), nil
		}

		prices, err := fetchSubscriptionPlanStripeCurrencyPrices(priceID)
		if err != nil {
			if ok && len(entry.prices) > 0 && now.Before(entry.staleUntil) {
				return cloneSubscriptionPlanCurrencyPrices(entry.prices), fmt.Errorf(
					"refresh Stripe Price %s: %w (using stale prices)",
					priceID,
					err,
				)
			}
			return nil, err
		}
		subscriptionPlanCurrencyPriceCache.Lock()
		subscriptionPlanCurrencyPriceCache.entries[priceID] = subscriptionPlanCurrencyPriceCacheEntry{
			prices:     cloneSubscriptionPlanCurrencyPrices(prices),
			expiresAt:  now.Add(subscriptionPlanCurrencyPriceCacheTTL),
			staleUntil: now.Add(subscriptionPlanCurrencyPriceMaxStaleAge),
		}
		subscriptionPlanCurrencyPriceCache.Unlock()
		return cloneSubscriptionPlanCurrencyPrices(prices), nil
	})
	prices, ok := pricesAny.(map[string]float64)
	if !ok {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("invalid cached Stripe currency prices")
	}
	return cloneSubscriptionPlanCurrencyPrices(prices), err
}

func fetchSubscriptionPlanStripeCurrencyPrices(priceID string) (map[string]float64, error) {
	if strings.TrimSpace(priceID) == "" {
		return nil, errors.New("Stripe Price ID is not configured")
	}
	if err := ensureStripeKey(); err != nil {
		return nil, err
	}
	params := &stripe.PriceParams{}
	params.AddExpand("currency_options")
	price, err := stripePriceGetter(priceID, params)
	if err != nil {
		return nil, err
	}
	prices := make(map[string]float64)
	for _, currency := range subscriptionPlanSupportedCurrencies {
		minor, ok := stripePriceAmountMinorForCurrency(price, currency)
		if !ok || minor <= 0 {
			continue
		}
		prices[currency] = service.SubscriptionPurchaseAmountFromMinor(minor, currency)
	}
	return prices, nil
}

func cloneSubscriptionPlanCurrencyPrices(prices map[string]float64) map[string]float64 {
	cloned := make(map[string]float64, len(prices))
	for currency, amount := range prices {
		cloned[currency] = amount
	}
	return cloned
}
