package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

type recallStripeFakeClient struct {
	createCouponFn        func(context.Context, *stripe.CouponParams) (*stripe.Coupon, error)
	getCouponFn           func(context.Context, string) (*stripe.Coupon, error)
	createCustomerFn      func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error)
	getCustomerFn         func(context.Context, string) (*stripe.Customer, error)
	updateCustomerFn      func(context.Context, string, *stripe.CustomerParams) (*stripe.Customer, error)
	createPromotionCodeFn func(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error)
	getPromotionCodeFn    func(context.Context, string) (*stripe.PromotionCode, error)
	getPriceFn            func(context.Context, string) (*stripe.Price, error)
	getCheckoutSessionFn  func(context.Context, string, ...string) (*stripe.CheckoutSession, error)
}

func recallTestCouponPromotion(couponID string) *stripe.PromotionCodePromotion {
	return &stripe.PromotionCodePromotion{
		Coupon: &stripe.Coupon{ID: couponID},
		Type:   stripe.PromotionCodePromotionTypeCoupon,
	}
}

type recallStripeRecordingBackend struct {
	stripe.Backend
	keys []string
}

func (b *recallStripeRecordingBackend) Call(_ string, _ string, key string, _ stripe.ParamsContainer, result stripe.LastResponseSetter) error {
	b.keys = append(b.keys, key)
	switch typed := result.(type) {
	case *stripe.Coupon:
		typed.ID = "coupon_test"
	case *stripe.Customer:
		typed.ID = "cus_test"
	case *stripe.PromotionCode:
		typed.ID = "promo_test"
	case *stripe.Price:
		typed.ID = "price_test"
	case *stripe.CheckoutSession:
		typed.ID = "cs_test"
	}
	return nil
}

func (f *recallStripeFakeClient) CreateCoupon(ctx context.Context, params *stripe.CouponParams) (*stripe.Coupon, error) {
	return f.createCouponFn(ctx, params)
}

func (f *recallStripeFakeClient) GetCoupon(ctx context.Context, id string) (*stripe.Coupon, error) {
	return f.getCouponFn(ctx, id)
}

func (f *recallStripeFakeClient) CreateCustomer(ctx context.Context, params *stripe.CustomerParams) (*stripe.Customer, error) {
	return f.createCustomerFn(ctx, params)
}

func (f *recallStripeFakeClient) GetCustomer(ctx context.Context, id string) (*stripe.Customer, error) {
	return f.getCustomerFn(ctx, id)
}

func (f *recallStripeFakeClient) UpdateCustomer(ctx context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
	if f.updateCustomerFn != nil {
		return f.updateCustomerFn(ctx, id, params)
	}
	return &stripe.Customer{ID: id}, nil
}

func (f *recallStripeFakeClient) CreatePromotionCode(ctx context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
	return f.createPromotionCodeFn(ctx, params)
}

func (f *recallStripeFakeClient) GetPromotionCode(ctx context.Context, id string) (*stripe.PromotionCode, error) {
	return f.getPromotionCodeFn(ctx, id)
}

func (f *recallStripeFakeClient) GetPrice(ctx context.Context, id string) (*stripe.Price, error) {
	return f.getPriceFn(ctx, id)
}

func (f *recallStripeFakeClient) GetCheckoutSession(ctx context.Context, id string, expand ...string) (*stripe.CheckoutSession, error) {
	return f.getCheckoutSessionFn(ctx, id, expand...)
}

func TestRecallStripeClientUsesScopedKeyWithoutMutatingGlobal(t *testing.T) {
	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalGlobalKey := stripe.Key
	originalConfiguredKey := setting.StripeApiSecret
	recordingBackend := &recallStripeRecordingBackend{}
	stripe.SetBackend(stripe.APIBackend, recordingBackend)
	stripe.Key = "global-sentinel"
	setting.StripeApiSecret = "scoped-secret"
	t.Cleanup(func() {
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		stripe.Key = originalGlobalKey
		setting.StripeApiSecret = originalConfiguredKey
	})

	client := &StripeRecallClient{}
	ctx := context.Background()
	_, err := client.CreateCoupon(ctx, &stripe.CouponParams{})
	require.NoError(t, err)
	_, err = client.GetCoupon(ctx, "coupon_test")
	require.NoError(t, err)
	_, err = client.CreateCustomer(ctx, &stripe.CustomerParams{})
	require.NoError(t, err)
	_, err = client.GetCustomer(ctx, "cus_test")
	require.NoError(t, err)
	_, err = client.UpdateCustomer(ctx, "cus_test", &stripe.CustomerParams{})
	require.NoError(t, err)
	_, err = client.CreatePromotionCode(ctx, &stripe.PromotionCodeParams{})
	require.NoError(t, err)
	_, err = client.GetPromotionCode(ctx, "promo_test")
	require.NoError(t, err)
	_, err = client.GetPrice(ctx, "price_test")
	require.NoError(t, err)
	_, err = client.GetCheckoutSession(ctx, "cs_test", "line_items")
	require.NoError(t, err)

	require.Equal(t, "global-sentinel", stripe.Key)
	require.Equal(t, []string{
		"scoped-secret", "scoped-secret", "scoped-secret", "scoped-secret",
		"scoped-secret", "scoped-secret", "scoped-secret", "scoped-secret",
		"scoped-secret",
	}, recordingBackend.keys)
}

func TestRecallStripePercentCouponParams(t *testing.T) {
	t.Parallel()

	var captured *stripe.CouponParams
	client := &recallStripeFakeClient{
		createCouponFn: func(_ context.Context, params *stripe.CouponParams) (*stripe.Coupon, error) {
			captured = params
			return &stripe.Coupon{ID: "coupon_recall"}, nil
		},
	}
	service := NewRecallStripeService(client)
	products := RecallResolvedProductScope{
		TopUpPriceIDs: []string{"price_topup"},
		ProductIDs:    []string{"prod_topup"},
	}
	discount := RecallDiscountConfig{
		Type:           "percent",
		PercentOff:     25,
		CouponRedeemBy: 1_900_000_000,
		MinimumSpend: &RecallMinimumSpendConfig{
			Enabled: true,
			Amounts: map[string]int64{"usd": 2_500, "inr": 200_000, "brl": 12_500, "jpy": 3_750},
		},
	}

	coupon, normalized, err := service.EnsureCoupon(context.Background(), 42, 1, "automatic", "", discount, products, 50)
	require.NoError(t, err)
	require.Equal(t, "coupon_recall", coupon.ID)
	discount.CurrencyOptions = map[string]int64{}
	discount.MinimumAmount = 2_500
	discount.MinimumAmountCurrency = "usd"
	require.Equal(t, discount, normalized)
	require.NotNil(t, captured)
	require.Equal(t, 25.0, *captured.PercentOff)
	require.Nil(t, captured.AmountOff)
	require.Nil(t, captured.Currency)
	require.Equal(t, string(stripe.CouponDurationOnce), *captured.Duration)
	require.Equal(t, int64(1_900_000_000), *captured.RedeemBy)
	require.Equal(t, int64(50), *captured.MaxRedemptions)
	require.Equal(t, []*string{stripe.String("prod_topup")}, captured.AppliesTo.Products)
	require.Equal(t, "42", captured.Metadata["recall_campaign_id"])
	require.Equal(t, "automatic", captured.Metadata["recall_source"])
	require.Equal(t, "recall_coupon:42:1", *captured.IdempotencyKey)
}

func TestRecallStripeFixedCouponParams(t *testing.T) {
	t.Parallel()

	var captured *stripe.CouponParams
	client := &recallStripeFakeClient{
		createCouponFn: func(_ context.Context, params *stripe.CouponParams) (*stripe.Coupon, error) {
			captured = params
			return &stripe.Coupon{ID: "coupon_fixed"}, nil
		},
	}
	service := NewRecallStripeService(client)
	discount := RecallDiscountConfig{
		Type:      "fixed",
		AmountOff: 500,
		Currency:  " USD ",
		CurrencyOptions: map[string]int64{
			" INR ": 45_000,
			"brl":   2_500,
			"JPY":   750,
		},
		MinimumSpend: &RecallMinimumSpendConfig{
			Enabled: true,
			Amounts: map[string]int64{
				" USD ": 2_500,
				"INR":   200_000,
				"brl":   12_500,
				"JPY":   3_750,
			},
		},
	}

	_, normalized, err := service.EnsureCoupon(context.Background(), 43, 1, "automatic", "", discount, RecallResolvedProductScope{
		SubscriptionPriceIDs: []string{"price_subscription"},
		ProductIDs:           []string{"prod_subscription"},
	}, 0)
	require.NoError(t, err)
	require.Equal(t, "usd", normalized.Currency)
	require.Equal(t, map[string]int64{"inr": 45_000, "brl": 2_500, "jpy": 750}, normalized.CurrencyOptions)
	require.Equal(t, &RecallMinimumSpendConfig{
		Enabled: true,
		Amounts: map[string]int64{"usd": 2_500, "inr": 200_000, "brl": 12_500, "jpy": 3_750},
	}, normalized.MinimumSpend)
	require.Equal(t, int64(2_500), normalized.MinimumAmount)
	require.Equal(t, "usd", normalized.MinimumAmountCurrency)
	require.Equal(t, int64(500), *captured.AmountOff)
	require.Equal(t, "usd", *captured.Currency)
	require.Equal(t, int64(45_000), *captured.CurrencyOptions["inr"].AmountOff)
	require.Equal(t, int64(2_500), *captured.CurrencyOptions["brl"].AmountOff)
	require.Equal(t, int64(750), *captured.CurrencyOptions["jpy"].AmountOff)
	require.Nil(t, captured.PercentOff)
	require.Nil(t, captured.MaxRedemptions)
}

func TestRecallStripeAutomaticFixedCouponValidation(t *testing.T) {
	t.Parallel()

	valid := func() RecallDiscountConfig {
		return RecallDiscountConfig{
			Type:      "fixed",
			AmountOff: 500,
			Currency:  "usd",
			CurrencyOptions: map[string]int64{
				"inr": 45_000,
				"brl": 2_500,
				"jpy": 750,
			},
		}
	}
	tests := []struct {
		name    string
		mutate  func(*RecallDiscountConfig)
		wantErr string
	}{
		{name: "non usd base", mutate: func(d *RecallDiscountConfig) { d.Currency = "eur" }, wantErr: "base currency"},
		{name: "missing currency", mutate: func(d *RecallDiscountConfig) { delete(d.CurrencyOptions, "jpy") }, wantErr: "exactly"},
		{name: "extra currency", mutate: func(d *RecallDiscountConfig) { d.CurrencyOptions["eur"] = 500 }, wantErr: "exactly"},
		{name: "zero option", mutate: func(d *RecallDiscountConfig) { d.CurrencyOptions["brl"] = 0 }, wantErr: "positive brl"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			discount := valid()
			tt.mutate(&discount)
			created := false
			client := &recallStripeFakeClient{createCouponFn: func(_ context.Context, _ *stripe.CouponParams) (*stripe.Coupon, error) {
				created = true
				return &stripe.Coupon{ID: "coupon_invalid"}, nil
			}}

			_, _, err := NewRecallStripeService(client).EnsureCoupon(
				context.Background(),
				44,
				1,
				"automatic",
				"",
				discount,
				RecallResolvedProductScope{ProductIDs: []string{"prod_topup"}},
				0,
			)

			require.ErrorContains(t, err, tt.wantErr)
			require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
			require.False(t, created)
		})
	}
}

func TestRecallStripeMinimumSpendNormalization(t *testing.T) {
	t.Parallel()

	validAmounts := func() map[string]int64 {
		return map[string]int64{"usd": 2_500, "inr": 200_000, "brl": 12_500, "jpy": 3_750}
	}
	tests := []struct {
		name     string
		discount RecallDiscountConfig
		want     *RecallMinimumSpendConfig
		wantErr  string
	}{
		{
			name: "nil preserves legacy exact currency",
			discount: RecallDiscountConfig{
				Type:                  "percent",
				PercentOff:            20,
				MinimumAmount:         2_500,
				MinimumAmountCurrency: " EUR ",
			},
			want: nil,
		},
		{
			name: "enabled requires exact four positive amounts",
			discount: RecallDiscountConfig{
				Type:       "percent",
				PercentOff: 20,
				MinimumSpend: &RecallMinimumSpendConfig{
					Enabled: true,
					Amounts: map[string]int64{" USD ": 2_500, "INR": 200_000, "brl": 12_500, "JPY": 3_750},
				},
			},
			want: &RecallMinimumSpendConfig{Enabled: true, Amounts: validAmounts()},
		},
		{
			name: "disabled clears canonical and legacy minimums",
			discount: RecallDiscountConfig{
				Type:                  "percent",
				PercentOff:            20,
				MinimumAmount:         2_500,
				MinimumAmountCurrency: "eur",
				MinimumSpend:          &RecallMinimumSpendConfig{Enabled: false, Amounts: validAmounts()},
			},
			want: &RecallMinimumSpendConfig{},
		},
		{
			name: "duplicate normalized key",
			discount: RecallDiscountConfig{
				Type:       "percent",
				PercentOff: 20,
				MinimumSpend: &RecallMinimumSpendConfig{
					Enabled: true,
					Amounts: map[string]int64{"USD": 2_500, " usd ": 2_600, "inr": 200_000, "brl": 12_500, "jpy": 3_750},
				},
			},
			wantErr: "minimum spend currency usd is duplicated",
		},
		{
			name: "partial amounts",
			discount: RecallDiscountConfig{
				Type:         "percent",
				PercentOff:   20,
				MinimumSpend: &RecallMinimumSpendConfig{Enabled: true, Amounts: map[string]int64{"usd": 2_500}},
			},
			wantErr: "exactly",
		},
		{
			name: "extra amount",
			discount: RecallDiscountConfig{
				Type:       "percent",
				PercentOff: 20,
				MinimumSpend: &RecallMinimumSpendConfig{
					Enabled: true,
					Amounts: map[string]int64{"usd": 2_500, "inr": 200_000, "brl": 12_500, "jpy": 3_750, "eur": 2_500},
				},
			},
			wantErr: "exactly",
		},
		{
			name: "non positive amount",
			discount: RecallDiscountConfig{
				Type:       "percent",
				PercentOff: 20,
				MinimumSpend: &RecallMinimumSpendConfig{
					Enabled: true,
					Amounts: map[string]int64{"usd": 2_500, "inr": 200_000, "brl": 0, "jpy": 3_750},
				},
			},
			wantErr: "positive brl",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			normalized, err := normalizeRecallDiscount(tt.discount)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, normalized.MinimumSpend)
			if tt.want != nil && tt.want.Enabled {
				require.Equal(t, tt.want.Amounts["usd"], normalized.MinimumAmount)
				require.Equal(t, "usd", normalized.MinimumAmountCurrency)
			}
		})
	}
}

func TestRecallStripeDiscountRejectsMixedModes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		discount RecallDiscountConfig
	}{
		{name: "percent with amount off", discount: RecallDiscountConfig{Type: "percent", PercentOff: 20, AmountOff: 500}},
		{name: "percent with currency", discount: RecallDiscountConfig{Type: "percent", PercentOff: 20, Currency: "usd"}},
		{name: "percent with currency options", discount: RecallDiscountConfig{Type: "percent", PercentOff: 20, CurrencyOptions: map[string]int64{"inr": 45_000}}},
		{name: "fixed with percent off", discount: RecallDiscountConfig{Type: "fixed", PercentOff: 20, AmountOff: 500, Currency: "usd"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := normalizeRecallDiscount(tt.discount)
			require.ErrorContains(t, err, "cannot set")
			require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
		})
	}
}

func TestRecallStripeDiscountRejectsDuplicateNormalizedCurrencyOptions(t *testing.T) {
	t.Parallel()

	_, err := normalizeRecallDiscount(RecallDiscountConfig{
		Type:      "fixed",
		AmountOff: 500,
		Currency:  "usd",
		CurrencyOptions: map[string]int64{
			"INR":   45_000,
			" inr ": 44_000,
		},
	})

	require.ErrorContains(t, err, "duplicated")
	require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
}

func TestRecallStripeExistingCouponValidation(t *testing.T) {
	t.Parallel()

	now := time.Now().Unix()
	validPercent := func() *stripe.Coupon {
		return &stripe.Coupon{
			ID:             "coupon_existing",
			Valid:          true,
			Duration:       stripe.CouponDurationOnce,
			PercentOff:     20,
			RedeemBy:       now + 3600,
			MaxRedemptions: 100,
			TimesRedeemed:  10,
			AppliesTo:      &stripe.CouponAppliesTo{Products: []string{"prod_a", "prod_b"}},
		}
	}
	validFixed := func() *stripe.Coupon {
		coupon := validPercent()
		coupon.PercentOff = 0
		coupon.AmountOff = 500
		coupon.Currency = stripe.CurrencyUSD
		return coupon
	}

	tests := []struct {
		name       string
		coupon     *stripe.Coupon
		discount   RecallDiscountConfig
		products   []string
		enrollment int
		wantErr    string
	}{
		{name: "deleted", coupon: func() *stripe.Coupon { c := validPercent(); c.Deleted = true; return c }(), discount: RecallDiscountConfig{Type: "percent", PercentOff: 20}, products: []string{"prod_a", "prod_b"}, enrollment: 50, wantErr: "deleted"},
		{name: "invalid", coupon: func() *stripe.Coupon { c := validPercent(); c.Valid = false; return c }(), discount: RecallDiscountConfig{Type: "percent", PercentOff: 20}, products: []string{"prod_a", "prod_b"}, enrollment: 50, wantErr: "invalid"},
		{name: "expired", coupon: func() *stripe.Coupon { c := validPercent(); c.RedeemBy = now - 1; return c }(), discount: RecallDiscountConfig{Type: "percent", PercentOff: 20}, products: []string{"prod_a", "prod_b"}, enrollment: 50, wantErr: "expired"},
		{name: "wrong duration", coupon: func() *stripe.Coupon { c := validPercent(); c.Duration = stripe.CouponDurationForever; return c }(), discount: RecallDiscountConfig{Type: "percent", PercentOff: 20}, products: []string{"prod_a", "prod_b"}, enrollment: 50, wantErr: "duration"},
		{name: "currency options", coupon: func() *stripe.Coupon {
			c := validPercent()
			c.CurrencyOptions = map[string]*stripe.CouponCurrencyOptions{"usd": {AmountOff: 500}}
			return c
		}(), discount: RecallDiscountConfig{Type: "percent", PercentOff: 20}, products: []string{"prod_a", "prod_b"}, enrollment: 50, wantErr: "currency options"},
		{name: "wrong currency", coupon: func() *stripe.Coupon { c := validFixed(); c.Currency = stripe.CurrencyEUR; return c }(), discount: RecallDiscountConfig{Type: "fixed", AmountOff: 500, Currency: "usd"}, products: []string{"prod_a", "prod_b"}, enrollment: 50, wantErr: "currency"},
		{name: "insufficient remaining capacity", coupon: func() *stripe.Coupon { c := validPercent(); c.MaxRedemptions = 59; return c }(), discount: RecallDiscountConfig{Type: "percent", PercentOff: 20}, products: []string{"prod_a", "prod_b"}, enrollment: 50, wantErr: "capacity"},
		{name: "product mismatch", coupon: validPercent(), discount: RecallDiscountConfig{Type: "percent", PercentOff: 20}, products: []string{"prod_a"}, enrollment: 50, wantErr: "product"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &recallStripeFakeClient{
				getCouponFn: func(_ context.Context, id string) (*stripe.Coupon, error) {
					require.Equal(t, "coupon_existing", id)
					return tt.coupon, nil
				},
			}
			_, _, err := NewRecallStripeService(client).EnsureCoupon(context.Background(), 42, 1, "existing", "coupon_existing", tt.discount, RecallResolvedProductScope{ProductIDs: tt.products}, tt.enrollment)
			require.ErrorContains(t, err, tt.wantErr)
			require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
		})
	}

	t.Run("accepts unlimited capacity and normalizes fixed coupon", func(t *testing.T) {
		coupon := validFixed()
		coupon.MaxRedemptions = 0
		client := &recallStripeFakeClient{getCouponFn: func(context.Context, string) (*stripe.Coupon, error) { return coupon, nil }}
		resolved, normalized, err := NewRecallStripeService(client).EnsureCoupon(context.Background(), 42, 1, "existing", "coupon_existing", RecallDiscountConfig{
			Type: "fixed", AmountOff: 500, Currency: "USD", MinimumSpend: &RecallMinimumSpendConfig{
				Enabled: true,
				Amounts: map[string]int64{"usd": 1000, "inr": 80000, "brl": 5000, "jpy": 1500},
			},
		}, RecallResolvedProductScope{ProductIDs: []string{"prod_b", "prod_a"}}, 500)
		require.NoError(t, err)
		require.Same(t, coupon, resolved)
		require.Equal(t, "fixed", normalized.Type)
		require.Equal(t, int64(500), normalized.AmountOff)
		require.Equal(t, "usd", normalized.Currency)
		require.Equal(t, int64(1000), normalized.MinimumAmount)
		require.Equal(t, "usd", normalized.MinimumAmountCurrency)
		require.Equal(t, &RecallMinimumSpendConfig{
			Enabled: true,
			Amounts: map[string]int64{"usd": 1000, "inr": 80000, "brl": 5000, "jpy": 1500},
		}, normalized.MinimumSpend)
	})
}

func TestRecallStripeListSubscriptionPrices(t *testing.T) {
	setupRecallStripeDB(t)
	require.NoError(t, model.DB.Create(&[]model.SubscriptionPlan{
		{Id: 1, Title: "enabled-a", Enabled: true, StripePriceId: " price_sub_a "},
		{Id: 2, Title: "disabled", Enabled: true, StripePriceId: "price_disabled"},
		{Id: 3, Title: "blank", Enabled: true, StripePriceId: "   "},
		{Id: 4, Title: "duplicate", Enabled: true, StripePriceId: "price_sub_a"},
		{Id: 5, Title: "enabled-b", Enabled: true, StripePriceId: "price_sub_b"},
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", 2).Update("enabled", false).Error)

	prices, err := model.ListRecallStripeSubscriptionPricesWithContext(context.Background())
	require.NoError(t, err)
	require.Equal(t, []string{"price_sub_a", "price_sub_b"}, prices)

	prices, err = model.ListRecallStripeSubscriptionPrices()
	require.NoError(t, err)
	require.Equal(t, []string{"price_sub_a", "price_sub_b"}, prices)

	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = model.ListRecallStripeSubscriptionPricesWithContext(cancelled)
	require.ErrorIs(t, err, context.Canceled)
}

func TestRecallStripeValidateAndResolveProducts(t *testing.T) {
	setupRecallStripeDB(t)
	setupRecallStripeSettings(t)
	setting.StripeTopUpPriceIds = `{"10":"price_top_a","20":"price_top_b"}`
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{Id: 10, Title: "sub", Enabled: true, StripePriceId: "price_sub"}).Error)

	prices := map[string]*stripe.Price{
		"price_top_a": recallStripePrice("price_top_a", "prod_top", stripe.PriceTypeOneTime),
		"price_top_b": recallStripePrice("price_top_b", "prod_top", stripe.PriceTypeOneTime),
		"price_sub":   recallStripePrice("price_sub", "prod_sub", stripe.PriceTypeRecurring),
	}
	client := &recallStripeFakeClient{getPriceFn: func(_ context.Context, id string) (*stripe.Price, error) { return prices[id], nil }}

	resolved, err := NewRecallStripeService(client).ValidateAndResolveProducts(context.Background(), RecallProductScope{
		TopUpPriceIDs:        []string{"price_top_a", "price_top_b"},
		SubscriptionPriceIDs: []string{"price_sub"},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"price_top_a", "price_top_b"}, resolved.TopUpPriceIDs)
	require.Equal(t, []string{"price_sub"}, resolved.SubscriptionPriceIDs)
	require.Equal(t, []string{"prod_top", "prod_sub"}, resolved.ProductIDs)
}

func TestRecallStripeRejectsInvalidPrices(t *testing.T) {
	setupRecallStripeDB(t)
	setupRecallStripeSettings(t)

	tests := []struct {
		name      string
		price     *stripe.Price
		scope     RecallProductScope
		wantError string
	}{
		{name: "nil", price: nil, scope: RecallProductScope{TopUpPriceIDs: []string{"price_bad"}}, wantError: "unavailable"},
		{name: "deleted", price: func() *stripe.Price {
			p := recallStripePrice("price_bad", "prod", stripe.PriceTypeOneTime)
			p.Deleted = true
			return p
		}(), scope: RecallProductScope{TopUpPriceIDs: []string{"price_bad"}}, wantError: "deleted"},
		{name: "inactive", price: func() *stripe.Price {
			p := recallStripePrice("price_bad", "prod", stripe.PriceTypeOneTime)
			p.Active = false
			return p
		}(), scope: RecallProductScope{TopUpPriceIDs: []string{"price_bad"}}, wantError: "inactive"},
		{name: "missing product", price: recallStripePrice("price_bad", "", stripe.PriceTypeOneTime), scope: RecallProductScope{TopUpPriceIDs: []string{"price_bad"}}, wantError: "product"},
		{name: "topup recurring", price: recallStripePrice("price_bad", "prod", stripe.PriceTypeRecurring), scope: RecallProductScope{TopUpPriceIDs: []string{"price_bad"}}, wantError: "one_time"},
		{name: "subscription one time", price: recallStripePrice("price_bad", "prod", stripe.PriceTypeOneTime), scope: RecallProductScope{SubscriptionPriceIDs: []string{"price_bad"}}, wantError: "recurring"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &recallStripeFakeClient{getPriceFn: func(context.Context, string) (*stripe.Price, error) { return tt.price, nil }}
			_, err := NewRecallStripeService(client).ValidateAndResolveProducts(context.Background(), tt.scope)
			require.ErrorContains(t, err, tt.wantError)
		})
	}
}

func TestRecallStripeAllowsAnyNonEmptyProductScope(t *testing.T) {
	t.Run("rejects empty selection", func(t *testing.T) {
		setupRecallStripeDB(t)
		setupRecallStripeSettings(t)

		_, err := NewRecallStripeService(&recallStripeFakeClient{}).ValidateAndResolveProducts(context.Background(), RecallProductScope{})
		require.ErrorContains(t, err, "at least one Stripe Price is required")
	})

	t.Run("selected topup and subscription share product", func(t *testing.T) {
		setupRecallStripeDB(t)
		setupRecallStripeSettings(t)
		setting.StripeTopUpPriceIds = `{"10":"price_top"}`
		require.NoError(t, model.DB.Create(&model.SubscriptionPlan{Id: 1, Title: "sub", Enabled: true, StripePriceId: "price_sub"}).Error)
		prices := map[string]*stripe.Price{
			"price_top": recallStripePrice("price_top", "prod_shared", stripe.PriceTypeOneTime),
			"price_sub": recallStripePrice("price_sub", "prod_shared", stripe.PriceTypeRecurring),
		}
		client := &recallStripeFakeClient{getPriceFn: func(_ context.Context, id string) (*stripe.Price, error) { return prices[id], nil }}
		resolved, err := NewRecallStripeService(client).ValidateAndResolveProducts(context.Background(), RecallProductScope{
			TopUpPriceIDs: []string{"price_top"}, SubscriptionPriceIDs: []string{"price_sub"},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"price_top"}, resolved.TopUpPriceIDs)
		require.Equal(t, []string{"price_sub"}, resolved.SubscriptionPriceIDs)
		require.Equal(t, []string{"prod_shared"}, resolved.ProductIDs)
	})

	t.Run("unselected configured topup price may share selected subscription product", func(t *testing.T) {
		setupRecallStripeDB(t)
		setupRecallStripeSettings(t)
		setting.StripeTopUpPriceIds = `{"20":"price_unselected_topup"}`
		require.NoError(t, model.DB.Create(&model.SubscriptionPlan{Id: 1, Title: "sub", Enabled: true, StripePriceId: "price_selected_sub"}).Error)
		prices := map[string]*stripe.Price{
			"price_unselected_topup": recallStripePrice("price_unselected_topup", "prod_shared", stripe.PriceTypeOneTime),
			"price_selected_sub":     recallStripePrice("price_selected_sub", "prod_shared", stripe.PriceTypeRecurring),
		}
		client := &recallStripeFakeClient{getPriceFn: func(_ context.Context, id string) (*stripe.Price, error) { return prices[id], nil }}
		resolved, err := NewRecallStripeService(client).ValidateAndResolveProducts(context.Background(), RecallProductScope{SubscriptionPriceIDs: []string{"price_selected_sub"}})
		require.NoError(t, err)
		require.Equal(t, []string{"price_selected_sub"}, resolved.SubscriptionPriceIDs)
		require.Equal(t, []string{"prod_shared"}, resolved.ProductIDs)
	})

	t.Run("topup only ignores unselected configured subscription sharing product", func(t *testing.T) {
		setupRecallStripeDB(t)
		setupRecallStripeSettings(t)
		setting.StripeTopUpPriceIds = `{"10":"price_selected"}`
		require.NoError(t, model.DB.Create(&model.SubscriptionPlan{Id: 1, Title: "sub", Enabled: true, StripePriceId: "price_unselected_sub"}).Error)
		prices := map[string]*stripe.Price{
			"price_selected":       recallStripePrice("price_selected", "prod_shared", stripe.PriceTypeOneTime),
			"price_unselected_sub": recallStripePrice("price_unselected_sub", "prod_shared", stripe.PriceTypeRecurring),
		}
		client := &recallStripeFakeClient{getPriceFn: func(_ context.Context, id string) (*stripe.Price, error) { return prices[id], nil }}
		resolved, err := NewRecallStripeService(client).ValidateAndResolveProducts(context.Background(), RecallProductScope{TopUpPriceIDs: []string{"price_selected"}})
		require.NoError(t, err)
		require.Equal(t, []string{"price_selected"}, resolved.TopUpPriceIDs)
		require.Empty(t, resolved.SubscriptionPriceIDs)
		require.Equal(t, []string{"prod_shared"}, resolved.ProductIDs)
	})
}

func TestRecallStripeUnselectedStaleConfiguredPrices(t *testing.T) {
	t.Run("unrelated inactive configured price does not block", func(t *testing.T) {
		setupRecallStripeDB(t)
		setupRecallStripeSettings(t)
		setting.StripeTopUpPriceIds = `{"10":"price_selected","20":"price_inactive"}`
		prices := map[string]*stripe.Price{
			"price_selected": recallStripePrice("price_selected", "prod_selected", stripe.PriceTypeOneTime),
			"price_inactive": func() *stripe.Price {
				price := recallStripePrice("price_inactive", "prod_other", stripe.PriceTypeOneTime)
				price.Active = false
				return price
			}(),
		}
		client := &recallStripeFakeClient{getPriceFn: func(_ context.Context, id string) (*stripe.Price, error) { return prices[id], nil }}

		resolved, err := NewRecallStripeService(client).ValidateAndResolveProducts(context.Background(), RecallProductScope{TopUpPriceIDs: []string{"price_selected"}})
		require.NoError(t, err)
		require.Equal(t, []string{"prod_selected"}, resolved.ProductIDs)
	})

	t.Run("shared inactive unselected configured price does not block", func(t *testing.T) {
		setupRecallStripeDB(t)
		setupRecallStripeSettings(t)
		setting.StripeTopUpPriceIds = `{"10":"price_selected","20":"price_inactive"}`
		prices := map[string]*stripe.Price{
			"price_selected": recallStripePrice("price_selected", "prod_shared", stripe.PriceTypeOneTime),
			"price_inactive": func() *stripe.Price {
				price := recallStripePrice("price_inactive", "prod_shared", stripe.PriceTypeOneTime)
				price.Active = false
				return price
			}(),
		}
		client := &recallStripeFakeClient{getPriceFn: func(_ context.Context, id string) (*stripe.Price, error) { return prices[id], nil }}

		resolved, err := NewRecallStripeService(client).ValidateAndResolveProducts(context.Background(), RecallProductScope{TopUpPriceIDs: []string{"price_selected"}})
		require.NoError(t, err)
		require.Equal(t, []string{"prod_shared"}, resolved.ProductIDs)
	})
}

func TestRecallStripeLegacyTopUpCatalog(t *testing.T) {
	t.Run("enumerates all legacy fields with trim and deduplication", func(t *testing.T) {
		setupRecallStripeSettings(t)
		setting.StripeTopUpPriceIds = ""
		setting.StripePriceId = " price_10 "
		setting.StripePriceId20 = "price_20"
		setting.StripePriceId200 = "price_10"

		configured, err := recallConfiguredTopUpPriceIDs()
		require.NoError(t, err)
		require.Equal(t, []string{"price_10", "price_20"}, configured)
	})

	t.Run("json map remains authoritative", func(t *testing.T) {
		setupRecallStripeSettings(t)
		setting.StripeTopUpPriceIds = `{"50":"price_map"}`
		setting.StripePriceId = "price_legacy_10"
		setting.StripePriceId20 = "price_legacy_20"
		setting.StripePriceId200 = "price_legacy_200"

		configured, err := recallConfiguredTopUpPriceIDs()
		require.NoError(t, err)
		require.Equal(t, []string{"price_map"}, configured)
	})

	t.Run("allows selected legacy price sharing product with another legacy price", func(t *testing.T) {
		setupRecallStripeDB(t)
		setupRecallStripeSettings(t)
		setting.StripeTopUpPriceIds = ""
		setting.StripePriceId = "price_10"
		setting.StripePriceId20 = "price_20"
		prices := map[string]*stripe.Price{
			"price_10": recallStripePrice("price_10", "prod_shared", stripe.PriceTypeOneTime),
			"price_20": recallStripePrice("price_20", "prod_shared", stripe.PriceTypeOneTime),
		}
		client := &recallStripeFakeClient{getPriceFn: func(_ context.Context, id string) (*stripe.Price, error) { return prices[id], nil }}

		resolved, err := NewRecallStripeService(client).ValidateAndResolveProducts(context.Background(), RecallProductScope{TopUpPriceIDs: []string{"price_10"}})
		require.NoError(t, err)
		require.Equal(t, []string{"price_10"}, resolved.TopUpPriceIDs)
		require.Equal(t, []string{"prod_shared"}, resolved.ProductIDs)
	})
}

func TestRecallStripeEnsureCustomer(t *testing.T) {
	t.Run("reuses non-deleted customer", func(t *testing.T) {
		created := false
		existing := &stripe.Customer{ID: "cus_existing"}
		client := &recallStripeFakeClient{
			getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
				require.Equal(t, "cus_existing", id)
				return existing, nil
			},
			createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
				created = true
				return nil, nil
			},
		}
		customer, err := NewRecallStripeService(client).EnsureCustomer(context.Background(), model.User{Id: 7, StripeCustomer: "cus_existing"})
		require.NoError(t, err)
		require.Same(t, existing, customer)
		require.False(t, created)
	})

	t.Run("rejects_mismatched_existing_customer", func(t *testing.T) {
		created := false
		client := &recallStripeFakeClient{
			getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
				require.Equal(t, "cus_expected", id)
				return &stripe.Customer{ID: "cus_other"}, nil
			},
			createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
				created = true
				return nil, nil
			},
		}

		_, err := NewRecallStripeService(client).EnsureCustomer(context.Background(), model.User{Id: 7, StripeCustomer: "cus_expected"})
		require.ErrorContains(t, err, "does not match")
		require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
		require.False(t, created)
	})

	t.Run("rejects_mismatched_deleted_customer", func(t *testing.T) {
		created := false
		client := &recallStripeFakeClient{
			getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
				require.Equal(t, "cus_expected", id)
				return &stripe.Customer{ID: "cus_other", Deleted: true}, nil
			},
			createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
				created = true
				return &stripe.Customer{ID: "cus_new"}, nil
			},
		}

		_, err := NewRecallStripeService(client).EnsureCustomer(context.Background(), model.User{Id: 7, StripeCustomer: "cus_expected"})
		require.ErrorContains(t, err, "does not match")
		require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
		require.False(t, created)
	})

	for _, tc := range []struct {
		name string
		get  func(context.Context, string) (*stripe.Customer, error)
	}{
		{name: "rebuilds missing customer", get: func(context.Context, string) (*stripe.Customer, error) { return nil, recallStripeMissingError() }},
		{name: "rebuilds deleted customer", get: func(context.Context, string) (*stripe.Customer, error) {
			return &stripe.Customer{ID: "cus_old", Deleted: true}, nil
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var captured []*stripe.CustomerParams
			client := &recallStripeFakeClient{
				getCustomerFn: tc.get,
				createCustomerFn: func(_ context.Context, params *stripe.CustomerParams) (*stripe.Customer, error) {
					captured = append(captured, params)
					if len(captured) == 1 {
						return nil, recallStripeTimeout{}
					}
					return &stripe.Customer{ID: "cus_new"}, nil
				},
			}
			customer, err := NewRecallStripeService(client).EnsureCustomer(context.Background(), model.User{
				Id: 7, Email: " user@example.com ", Username: " Ada ", StripeCustomer: "cus_old",
			})
			require.NoError(t, err)
			require.Equal(t, "cus_new", customer.ID)
			require.Len(t, captured, 2)
			require.Same(t, captured[0], captured[1])
			require.Nil(t, captured[0].Email)
			require.Nil(t, captured[0].Name)
			require.Equal(t, "7", captured[0].Metadata["flatkey_user_id"])
			require.Equal(t, "recall_customer:7", *captured[0].IdempotencyKey)
		})
	}
}

func TestRecallStripeCustomerCreateParamsIgnoreMutableProfile(t *testing.T) {
	var calls []*stripe.CustomerParams
	client := &recallStripeFakeClient{createCustomerFn: func(_ context.Context, params *stripe.CustomerParams) (*stripe.Customer, error) {
		calls = append(calls, params)
		return &stripe.Customer{ID: "cus_7"}, nil
	}}
	service := NewRecallStripeService(client)

	_, firstErr := service.EnsureCustomer(context.Background(), model.User{Id: 7, Email: "first@example.com", Username: "First", DisplayName: "First Display"})
	_, secondErr := service.EnsureCustomer(context.Background(), model.User{Id: 7, Email: "second@example.com", Username: "Second", DisplayName: "Second Display"})
	require.NoError(t, firstErr)
	require.NoError(t, secondErr)
	require.Len(t, calls, 2)
	require.Equal(t, calls[0], calls[1])
	require.Nil(t, calls[0].Email)
	require.Nil(t, calls[0].Name)
	require.Equal(t, map[string]string{"flatkey_user_id": "7"}, calls[0].Metadata)
	require.Equal(t, "recall_customer:7", *calls[0].IdempotencyKey)
}

func TestRecallStripeCustomerEmailUpdateIsSeparateAndVersioned(t *testing.T) {
	var created *stripe.CustomerParams
	var updated *stripe.CustomerParams
	client := &recallStripeFakeClient{
		createCustomerFn: func(_ context.Context, params *stripe.CustomerParams) (*stripe.Customer, error) {
			created = params
			return &stripe.Customer{ID: "cus_7"}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			require.Equal(t, "cus_7", id)
			updated = params
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
	}

	user := model.User{
		Id: 7, Email: " Current@Example.COM ", Username: "mutable-name", DisplayName: "mutable-display",
	}
	service := NewRecallStripeService(client)
	customer, err := service.EnsureCustomer(context.Background(), user)
	require.NoError(t, err)
	require.Equal(t, "cus_7", customer.ID)
	require.NotNil(t, created)
	require.Nil(t, created.Email)
	require.Nil(t, created.Name)
	require.Nil(t, created.Description)
	require.Equal(t, map[string]string{"flatkey_user_id": "7"}, created.Metadata)
	require.Equal(t, "recall_customer:7", *created.IdempotencyKey)
	require.Nil(t, updated)
	customer, err = service.syncCustomerEmail(context.Background(), user, customer)
	require.NoError(t, err)
	require.Equal(t, "cus_7", customer.ID)
	require.NotNil(t, updated)
	require.Equal(t, "current@example.com", *updated.Email)
	require.Nil(t, updated.Name)
	require.Nil(t, updated.Description)
	require.Empty(t, updated.Metadata)
	normalizedHash := sha256.Sum256([]byte("current@example.com"))
	require.Equal(t, "recall_customer_email:v1:7:"+fmt.Sprintf("%x", normalizedHash), *updated.IdempotencyKey)
}

func TestRecallStripeCustomerEmailUpdateKeyChangesOnlyWithNormalizedEmail(t *testing.T) {
	keys := make([]string, 0, 3)
	payloads := make([]string, 0, 3)
	client := &recallStripeFakeClient{
		getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
			return &stripe.Customer{ID: "cus_7"}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			keys = append(keys, *params.IdempotencyKey)
			payloads = append(payloads, *params.Email)
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
	}
	service := NewRecallStripeService(client)

	for _, email := range []string{" User@Example.com ", "user@example.COM", "changed@example.com"} {
		user := model.User{Id: 7, Email: email, StripeCustomer: "cus_7"}
		customer, err := service.EnsureCustomer(context.Background(), user)
		require.NoError(t, err)
		_, err = service.syncCustomerEmail(context.Background(), user, customer)
		require.NoError(t, err)
	}
	require.Len(t, keys, 3)
	require.Equal(t, keys[0], keys[1])
	require.NotEqual(t, keys[1], keys[2])
	require.Equal(t, []string{"user@example.com", "user@example.com", "changed@example.com"}, payloads)
}

func TestRecallStripeCustomerEmailUpdateRetriesWithStableKey(t *testing.T) {
	var calls []*stripe.CustomerParams
	client := &recallStripeFakeClient{
		getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
			return &stripe.Customer{ID: "cus_7"}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			require.Equal(t, "cus_7", id)
			calls = append(calls, params)
			if len(calls) == 1 {
				return nil, recallStripeTimeout{}
			}
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
	}

	user := model.User{
		Id: 7, Email: " User@Example.com ", StripeCustomer: "cus_7",
	}
	service := NewRecallStripeService(client)
	customer, err := service.EnsureCustomer(context.Background(), user)
	require.NoError(t, err)
	customer, err = service.syncCustomerEmail(context.Background(), user, customer)
	require.NoError(t, err)
	require.Equal(t, "cus_7", customer.ID)
	require.Len(t, calls, 2)
	require.Same(t, calls[0], calls[1])
	require.Equal(t, *calls[0].IdempotencyKey, *calls[1].IdempotencyKey)
	normalizedHash := sha256.Sum256([]byte("user@example.com"))
	require.Equal(t, "recall_customer_email:v1:7:"+fmt.Sprintf("%x", normalizedHash), *calls[0].IdempotencyKey)
}

func TestRecallStripeCustomerEmailUpdateRejectsMismatchedCustomer(t *testing.T) {
	updateCalls := 0
	client := &recallStripeFakeClient{
		getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
			return &stripe.Customer{ID: "cus_7"}, nil
		},
		updateCustomerFn: func(context.Context, string, *stripe.CustomerParams) (*stripe.Customer, error) {
			updateCalls++
			return &stripe.Customer{ID: "cus_other"}, nil
		},
	}

	user := model.User{
		Id: 7, Email: "user@example.com", StripeCustomer: "cus_7",
	}
	service := NewRecallStripeService(client)
	customer, err := service.EnsureCustomer(context.Background(), user)
	require.NoError(t, err)
	_, err = service.syncCustomerEmail(context.Background(), user, customer)
	require.ErrorContains(t, err, "unavailable Customer")
	require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
	require.Equal(t, 1, updateCalls)
}

func TestRecallStripeCustomerBlankEmailDoesNotClearStripe(t *testing.T) {
	updated := false
	client := &recallStripeFakeClient{
		getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
			return &stripe.Customer{ID: "cus_7"}, nil
		},
		updateCustomerFn: func(context.Context, string, *stripe.CustomerParams) (*stripe.Customer, error) {
			updated = true
			return nil, nil
		},
	}

	user := model.User{Id: 7, Email: "  ", StripeCustomer: "cus_7"}
	service := NewRecallStripeService(client)
	customer, err := service.EnsureCustomer(context.Background(), user)
	require.NoError(t, err)
	_, err = service.syncCustomerEmail(context.Background(), user, customer)
	require.NoError(t, err)
	require.False(t, updated)
}

func TestRecallStripePromotionParamsAndRetries(t *testing.T) {
	campaign := model.RecallCampaign{Id: 11, PromotionValidSeconds: 3600}
	recipient := model.RecallRecipient{Id: 22, UserId: 7, StripeCustomerId: "cus_7", PromotionCode: "FKBASE234", PromotionExpiresAt: 1_900_000_000}
	user := model.User{Id: 7, StripeCustomer: "cus_other"}
	coupon := &stripe.Coupon{ID: "coupon_11", Valid: true}
	discount := RecallDiscountConfig{MinimumAmount: 2500, MinimumAmountCurrency: " USD "}

	t.Run("sets customer-bound single-use contract", func(t *testing.T) {
		var captured *stripe.PromotionCodeParams
		client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			captured = params
			return &stripe.PromotionCode{ID: "promo_11_22", Code: *params.Code}, nil
		}}
		service := NewRecallStripeService(client)
		service.codeGenerator = func(int) (string, error) { return "O0Il1-abc234", nil }
		generatedCode, err := service.GenerateRecipientPromotionCode()
		require.NoError(t, err)
		requestRecipient := recipient
		requestRecipient.PromotionCode = generatedCode

		promotion, err := service.CreateRecipientPromotion(context.Background(), campaign, requestRecipient, user, coupon, discount)
		require.NoError(t, err)
		require.Equal(t, "promo_11_22", promotion.ID)
		require.NotNil(t, captured.Promotion)
		require.Equal(t, "coupon_11", *captured.Promotion.Coupon)
		require.Equal(t, "cus_7", *captured.Customer)
		require.Equal(t, int64(1_900_000_000), *captured.ExpiresAt)
		require.Equal(t, int64(1), *captured.MaxRedemptions)
		require.Equal(t, int64(2500), *captured.Restrictions.MinimumAmount)
		require.Equal(t, "usd", *captured.Restrictions.MinimumAmountCurrency)
		require.Equal(t, "11", captured.Metadata["recall_campaign_id"])
		require.Equal(t, "22", captured.Metadata["recall_recipient_id"])
		require.Equal(t, "7", captured.Metadata["flatkey_user_id"])
		require.Equal(t, "recall_promotion:11:22:1", *captured.IdempotencyKey)
		require.Equal(t, generatedCode, *captured.Code)
		require.True(t, strings.HasPrefix(*captured.Code, "FK"))
		require.Regexp(t, regexp.MustCompile(`^[A-Za-z0-9]+$`), *captured.Code)
		require.NotRegexp(t, regexp.MustCompile(`[0OIl1]`), strings.TrimPrefix(*captured.Code, "FK"))
	})

	t.Run("confirmed collision changes code and attempt key", func(t *testing.T) {
		var calls []*stripe.PromotionCodeParams
		client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			calls = append(calls, params)
			if len(calls) == 1 {
				return nil, &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Param: "code", Code: stripe.ErrorCode("parameter_invalid_string_blank"), Msg: "This code is already active."}
			}
			return &stripe.PromotionCode{ID: "promo_after_collision", Code: *params.Code}, nil
		}}
		service := NewRecallStripeService(client)

		_, err := service.CreateRecipientPromotion(context.Background(), campaign, recipient, user, coupon, discount)
		require.NoError(t, err)
		require.Len(t, calls, 2)
		require.NotEqual(t, *calls[0].Code, *calls[1].Code)
		require.Equal(t, "recall_promotion:11:22:1", *calls[0].IdempotencyKey)
		require.Equal(t, "recall_promotion:11:22:2", *calls[1].IdempotencyKey)
	})

	t.Run("transient retry reuses parameters code and key", func(t *testing.T) {
		var calls []*stripe.PromotionCodeParams
		client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			calls = append(calls, params)
			if len(calls) == 1 {
				return nil, recallStripeTimeout{}
			}
			return &stripe.PromotionCode{ID: "promo_after_timeout", Code: *params.Code}, nil
		}}
		service := NewRecallStripeService(client)
		generatorCalls := 0
		service.codeGenerator = func(int) (string, error) { generatorCalls++; return "unused234", nil }

		_, err := service.CreateRecipientPromotion(context.Background(), campaign, recipient, user, coupon, discount)
		require.NoError(t, err)
		require.Len(t, calls, 2)
		require.Same(t, calls[0], calls[1])
		require.Zero(t, generatorCalls)
		require.Equal(t, *calls[0].Code, *calls[1].Code)
		require.Equal(t, *calls[0].IdempotencyKey, *calls[1].IdempotencyKey)
	})

	for _, tc := range []struct {
		name string
		err  error
	}{
		{name: "ordinary invalid request", err: &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Param: "customer", Msg: "No such customer"}},
		{name: "code format error is not collision", err: &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Param: "code", Msg: "The code contains invalid characters"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			client := &recallStripeFakeClient{createPromotionCodeFn: func(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
				calls++
				return nil, tc.err
			}}
			service := NewRecallStripeService(client)
			_, err := service.CreateRecipientPromotion(context.Background(), campaign, recipient, user, coupon, discount)
			require.Error(t, err)
			require.Equal(t, 1, calls)
		})
	}
}

func TestCreateRecipientPromotionEmailOnlyAllowsCustomerlessPromotion(t *testing.T) {
	campaign := model.RecallCampaign{Id: 11, PromotionValidSeconds: 3600}
	recipient := model.RecallRecipient{Id: 22, UserId: 0, PromotionCode: "FKBASE234", PromotionExpiresAt: 1_900_000_000}
	coupon := &stripe.Coupon{ID: "coupon_11", Valid: true}
	discount := RecallDiscountConfig{MinimumAmount: 2500, MinimumAmountCurrency: "usd"}
	var captured *stripe.PromotionCodeParams
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		captured = params
		return &stripe.PromotionCode{ID: "promo_email_only", Code: *params.Code}, nil
	}}

	promotion, err := NewRecallStripeService(client).CreateRecipientPromotion(context.Background(), campaign, recipient, model.User{}, coupon, discount)

	require.NoError(t, err)
	require.Equal(t, "promo_email_only", promotion.ID)
	require.NotNil(t, captured)
	require.Nil(t, captured.Customer)
	require.Equal(t, int64(1), *captured.MaxRedemptions)
	require.Equal(t, "11", captured.Metadata["recall_campaign_id"])
	require.Equal(t, "22", captured.Metadata["recall_recipient_id"])
	require.NotContains(t, captured.Metadata, "flatkey_user_id")
}

func TestRecallStripePromotionCollisionStopsAfterFiveCodes(t *testing.T) {
	calls := 0
	client := &recallStripeFakeClient{createPromotionCodeFn: func(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		calls++
		return nil, &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Param: "code", Msg: "promotion code must be unique among active codes"}
	}}
	service := NewRecallStripeService(client)
	_, err := service.CreateRecipientPromotion(context.Background(), model.RecallCampaign{Id: 1}, model.RecallRecipient{
		Id: 2, UserId: 3, StripeCustomerId: "cus_3", PromotionCode: "FKBASE234", PromotionExpiresAt: 1_900_000_000,
	}, model.User{Id: 3}, &stripe.Coupon{ID: "coupon"}, RecallDiscountConfig{})
	require.ErrorContains(t, err, "collision")
	require.Equal(t, 5, calls)
}

func TestRecallStripeExistingPromotionIsReconciledWithoutCreate(t *testing.T) {
	promotionID := "promo_existing"
	recipient := model.RecallRecipient{
		Id: 2, UserId: 3, StripeCustomerId: "cus_3", StripePromotionCodeId: &promotionID,
		PromotionCode: "FKABC234", PromotionExpiresAt: 1_900_000_000,
	}
	existing := &stripe.PromotionCode{
		ID: "promo_existing", Active: true, Code: "FKABC234", Promotion: recallTestCouponPromotion("coupon"), Customer: &stripe.Customer{ID: "cus_3"},
		ExpiresAt: 1_900_000_000, MaxRedemptions: 1, Restrictions: &stripe.PromotionCodeRestrictions{},
	}
	created := false
	client := &recallStripeFakeClient{
		getPromotionCodeFn: func(_ context.Context, id string) (*stripe.PromotionCode, error) {
			require.Equal(t, promotionID, id)
			return existing, nil
		},
		createPromotionCodeFn: func(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			created = true
			return nil, nil
		},
	}
	promotion, err := NewRecallStripeService(client).CreateRecipientPromotion(context.Background(), model.RecallCampaign{Id: 1}, recipient, model.User{Id: 3}, &stripe.Coupon{ID: "coupon"}, RecallDiscountConfig{})
	require.NoError(t, err)
	require.Same(t, existing, promotion)
	require.False(t, created)
}

func TestValidateExistingRecallPromotionEmailOnlyRequiresCustomerlessPromotion(t *testing.T) {
	recipient := model.RecallRecipient{
		Id: 2, UserId: 0, PromotionCode: "FKABC234", PromotionExpiresAt: 1_900_000_000,
	}
	existing := &stripe.PromotionCode{
		ID: "promo_existing", Active: true, Code: "FKABC234", Promotion: recallTestCouponPromotion("coupon"),
		ExpiresAt: 1_900_000_000, MaxRedemptions: 1, Restrictions: &stripe.PromotionCodeRestrictions{},
	}

	require.NoError(t, validateExistingRecallPromotion(existing, recipient, "coupon", "", 1_900_000_000, RecallDiscountConfig{}))

	existing.Customer = &stripe.Customer{ID: "cus_unexpected"}
	err := validateExistingRecallPromotion(existing, recipient, "coupon", "", 1_900_000_000, RecallDiscountConfig{})
	require.ErrorContains(t, err, "customer")
	require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
}

func TestRecallStripeExistingPromotionRequiresExactRestrictions(t *testing.T) {
	t.Parallel()

	recipient := model.RecallRecipient{PromotionCode: "FKABC234"}
	validPromotion := func() *stripe.PromotionCode {
		return &stripe.PromotionCode{
			ID: "promo_existing", Active: true, Code: "FKABC234", Promotion: recallTestCouponPromotion("coupon"), Customer: &stripe.Customer{ID: "cus_3"},
			ExpiresAt: 1_900_000_000, MaxRedemptions: 1,
		}
	}
	tests := []struct {
		name         string
		restrictions *stripe.PromotionCodeRestrictions
		discount     RecallDiscountConfig
		remoteCode   string
		wantErr      string
	}{
		{name: "no requested minimum rejects remote minimum", restrictions: &stripe.PromotionCodeRestrictions{MinimumAmount: 1000, MinimumAmountCurrency: stripe.CurrencyUSD}, wantErr: "minimum restriction"},
		{name: "rejects first time transaction", restrictions: &stripe.PromotionCodeRestrictions{FirstTimeTransaction: true}, wantErr: "first-time"},
		{name: "rejects currency options", restrictions: &stripe.PromotionCodeRestrictions{CurrencyOptions: map[string]*stripe.PromotionCodeRestrictionsCurrencyOptions{"usd": {MinimumAmount: 1000}}}, wantErr: "currency options"},
		{name: "nonzero minimum requires exact amount", restrictions: &stripe.PromotionCodeRestrictions{MinimumAmount: 999, MinimumAmountCurrency: stripe.CurrencyUSD}, discount: RecallDiscountConfig{MinimumAmount: 1000, MinimumAmountCurrency: "usd"}, wantErr: "minimum restriction"},
		{name: "nonzero minimum requires exact currency", restrictions: &stripe.PromotionCodeRestrictions{MinimumAmount: 1000, MinimumAmountCurrency: stripe.CurrencyEUR}, discount: RecallDiscountConfig{MinimumAmount: 1000, MinimumAmountCurrency: "usd"}, wantErr: "minimum restriction"},
		{name: "nonzero minimum still rejects other restrictions", restrictions: &stripe.PromotionCodeRestrictions{MinimumAmount: 1000, MinimumAmountCurrency: stripe.CurrencyUSD, FirstTimeTransaction: true}, discount: RecallDiscountConfig{MinimumAmount: 1000, MinimumAmountCurrency: "usd"}, wantErr: "first-time"},
		{name: "remote code must match canonical persisted code", restrictions: &stripe.PromotionCodeRestrictions{}, remoteCode: "fkabc234", wantErr: "code does not match"},
		{name: "empty restrictions pass", restrictions: &stripe.PromotionCodeRestrictions{}},
		{name: "nil restrictions pass"},
		{name: "exact minimum passes", restrictions: &stripe.PromotionCodeRestrictions{MinimumAmount: 1000, MinimumAmountCurrency: stripe.CurrencyUSD}, discount: RecallDiscountConfig{MinimumAmount: 1000, MinimumAmountCurrency: "usd"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			existing := validPromotion()
			existing.Restrictions = tt.restrictions
			if tt.remoteCode != "" {
				existing.Code = tt.remoteCode
			}
			err := validateExistingRecallPromotion(existing, recipient, "coupon", "cus_3", 1_900_000_000, tt.discount)
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, tt.wantErr)
			require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
		})
	}
}

func TestRecallStripePromotionRequiresPersistedBaseCode(t *testing.T) {
	createCalls := 0
	client := &recallStripeFakeClient{createPromotionCodeFn: func(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		createCalls++
		return &stripe.PromotionCode{ID: "promo_unstable"}, nil
	}}
	service := NewRecallStripeService(client)
	generatorCalls := 0
	service.codeGenerator = func(int) (string, error) {
		generatorCalls++
		return "abc234", nil
	}

	_, err := service.CreateRecipientPromotion(context.Background(), model.RecallCampaign{Id: 1}, model.RecallRecipient{
		Id: 2, UserId: 3, StripeCustomerId: "cus_3", PromotionExpiresAt: 1_900_000_000,
	}, model.User{Id: 3}, &stripe.Coupon{ID: "coupon"}, RecallDiscountConfig{})
	require.ErrorContains(t, err, "persisted promotion code")
	require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
	require.Zero(t, createCalls)
	require.Zero(t, generatorCalls)
}

func TestRecallStripePromotionRejectsNonCanonicalPersistedCode(t *testing.T) {
	tests := []string{
		" FKABC234",
		"fkabc234",
		"FKABC-234",
		"FKABC0",
		"FKABCO",
		"FKABCI",
		"FKABCl",
		"FKABC1",
	}
	for _, persistedCode := range tests {
		t.Run(persistedCode, func(t *testing.T) {
			createCalls := 0
			client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
				createCalls++
				return &stripe.PromotionCode{ID: "promo_noncanonical", Code: *params.Code}, nil
			}}
			_, err := NewRecallStripeService(client).CreateRecipientPromotion(context.Background(), model.RecallCampaign{Id: 11}, model.RecallRecipient{
				Id: 22, UserId: 7, StripeCustomerId: "cus_7", PromotionCode: persistedCode, PromotionExpiresAt: 1_900_000_000,
			}, model.User{Id: 7}, &stripe.Coupon{ID: "coupon_11"}, RecallDiscountConfig{})
			require.ErrorContains(t, err, "canonical")
			require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
			require.Zero(t, createCalls)
		})
	}
}

func TestRecallStripePromotionRequiresPersistedExpiryWithinCoupon(t *testing.T) {
	now := time.Now().Unix()
	tests := []struct {
		name       string
		campaign   model.RecallCampaign
		expiresAt  int64
		redeemBy   int64
		wantErrMsg string
	}{
		{name: "missing persisted expiry", campaign: model.RecallCampaign{Id: 11, PromotionValidSeconds: 3600}, expiresAt: 0, wantErrMsg: "persisted promotion expiration"},
		{name: "expired persisted expiry", campaign: model.RecallCampaign{Id: 11}, expiresAt: now - 1, wantErrMsg: "future"},
		{name: "expiry exceeds coupon redeem by", campaign: model.RecallCampaign{Id: 11}, expiresAt: now + 3600, redeemBy: now + 1800, wantErrMsg: "redeem_by"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			createCalls := 0
			client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
				createCalls++
				return &stripe.PromotionCode{ID: "promo_unstable_expiry", Code: *params.Code}, nil
			}}
			_, err := NewRecallStripeService(client).CreateRecipientPromotion(context.Background(), tt.campaign, model.RecallRecipient{
				Id: 22, UserId: 7, StripeCustomerId: "cus_7", PromotionCode: "FKSTABXE234", PromotionExpiresAt: tt.expiresAt,
			}, model.User{Id: 7}, &stripe.Coupon{ID: "coupon_11", RedeemBy: tt.redeemBy}, RecallDiscountConfig{})
			require.ErrorContains(t, err, tt.wantErrMsg)
			require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err))
			require.Zero(t, createCalls)
		})
	}
}

func TestRecallStripePromotionAttemptOneIsStableAcrossCalls(t *testing.T) {
	var calls []*stripe.PromotionCodeParams
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		calls = append(calls, params)
		return nil, recallStripeTimeout{}
	}}
	service := NewRecallStripeService(client)
	recipient := model.RecallRecipient{
		Id: 22, UserId: 7, StripeCustomerId: "cus_7", PromotionCode: "FKSTABXE234", PromotionExpiresAt: 1_900_000_000,
	}

	_, firstErr := service.CreateRecipientPromotion(context.Background(), model.RecallCampaign{Id: 11}, recipient, model.User{Id: 7}, &stripe.Coupon{ID: "coupon_11"}, RecallDiscountConfig{})
	_, secondErr := service.CreateRecipientPromotion(context.Background(), model.RecallCampaign{Id: 11}, recipient, model.User{Id: 7}, &stripe.Coupon{ID: "coupon_11"}, RecallDiscountConfig{})
	require.Error(t, firstErr)
	require.Error(t, secondErr)
	require.Len(t, calls, 6)
	require.Equal(t, *calls[0].Code, *calls[3].Code)
	require.Equal(t, *calls[0].IdempotencyKey, *calls[3].IdempotencyKey)
	require.Equal(t, *calls[0].ExpiresAt, *calls[3].ExpiresAt)
	require.Equal(t, "recall_promotion:11:22:1", *calls[0].IdempotencyKey)
}

func TestRecallStripePromotionAttemptAfterCollisionIsStableAcrossCalls(t *testing.T) {
	var calls []*stripe.PromotionCodeParams
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		calls = append(calls, params)
		switch len(calls) {
		case 1, 5:
			return nil, &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Param: "code", Msg: "promotion code must be unique among active codes"}
		case 2, 3, 4:
			return nil, recallStripeTimeout{}
		case 6:
			return &stripe.PromotionCode{ID: "promo_stable_attempt_2", Code: *params.Code}, nil
		default:
			return nil, errors.New("unexpected Stripe create call")
		}
	}}
	service := NewRecallStripeService(client)
	generated := []string{"first234", "second567"}
	service.codeGenerator = func(int) (string, error) {
		value := generated[0]
		generated = generated[1:]
		return value, nil
	}
	recipient := model.RecallRecipient{
		Id: 22, UserId: 7, StripeCustomerId: "cus_7", PromotionCode: "FKBASE234", PromotionExpiresAt: 1_900_000_000,
	}

	_, firstErr := service.CreateRecipientPromotion(context.Background(), model.RecallCampaign{Id: 11}, recipient, model.User{Id: 7}, &stripe.Coupon{ID: "coupon_11"}, RecallDiscountConfig{})
	require.Error(t, firstErr)
	require.True(t, IsRecallStripeRetryable(firstErr))
	promotion, secondErr := service.CreateRecipientPromotion(context.Background(), model.RecallCampaign{Id: 11}, recipient, model.User{Id: 7}, &stripe.Coupon{ID: "coupon_11"}, RecallDiscountConfig{})
	require.NoError(t, secondErr)
	require.Equal(t, "promo_stable_attempt_2", promotion.ID)
	require.Len(t, calls, 6)
	require.NotEqual(t, *calls[0].Code, *calls[1].Code)
	require.Equal(t, *calls[1].Code, *calls[5].Code)
	require.Equal(t, *calls[1].IdempotencyKey, *calls[5].IdempotencyKey)
	require.Equal(t, "recall_promotion:11:22:2", *calls[1].IdempotencyKey)
}

func TestRecallStripeErrorClassification(t *testing.T) {
	t.Parallel()

	retryable := []error{
		&stripe.Error{HTTPStatusCode: 429, Type: stripe.ErrorTypeAPI},
		&stripe.Error{HTTPStatusCode: 500, Type: stripe.ErrorTypeAPI},
		recallStripeTimeout{},
		context.DeadlineExceeded,
		context.Canceled,
	}
	for _, err := range retryable {
		require.Equal(t, RecallStripeErrorRetryable, ClassifyRecallStripeError(err), err.Error())
		require.True(t, IsRecallStripeRetryable(err), err.Error())
	}

	permanent := []error{
		&stripe.Error{Type: stripe.ErrorTypeInvalidRequest},
		recallStripeMissingError(),
	}
	for _, err := range permanent {
		require.Equal(t, RecallStripeErrorPermanent, ClassifyRecallStripeError(err), err.Error())
		require.False(t, IsRecallStripeRetryable(err), err.Error())
	}

	require.Equal(t, RecallStripeErrorUnknown, ClassifyRecallStripeError(errors.New("unclassified")))
}

func TestRecallStripeCanceledCreateIsRetryableWithoutLocalLoop(t *testing.T) {
	createCalls := 0
	client := &recallStripeFakeClient{createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
		createCalls++
		return nil, context.Canceled
	}}

	_, err := NewRecallStripeService(client).EnsureCustomer(context.Background(), model.User{Id: 7})
	require.Error(t, err)
	require.Equal(t, RecallStripeErrorRetryable, ClassifyRecallStripeError(err))
	require.True(t, IsRecallStripeRetryable(err))
	require.Equal(t, 1, createCalls)
}

type recallStripeTimeout struct{}

func (recallStripeTimeout) Error() string   { return "stripe timeout" }
func (recallStripeTimeout) Timeout() bool   { return true }
func (recallStripeTimeout) Temporary() bool { return true }

func recallStripeMissingError() error {
	return &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Code: stripe.ErrorCodeResourceMissing, Msg: "No such resource"}
}

func recallStripePrice(id string, productID string, priceType stripe.PriceType) *stripe.Price {
	var product *stripe.Product
	if productID != "" {
		product = &stripe.Product{ID: productID, Active: true}
	}
	return &stripe.Price{ID: id, Active: true, Type: priceType, Product: product}
}

func setupRecallStripeDB(t *testing.T) {
	t.Helper()
	original := model.DB
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/recall-stripe.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = original
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})
}

func setupRecallStripeSettings(t *testing.T) {
	t.Helper()
	originalTopUps := setting.StripeTopUpPriceIds
	originalPrice := setting.StripePriceId
	originalPrice20 := setting.StripePriceId20
	originalPrice200 := setting.StripePriceId200
	setting.StripeTopUpPriceIds = ""
	setting.StripePriceId = ""
	setting.StripePriceId20 = ""
	setting.StripePriceId200 = ""
	t.Cleanup(func() {
		setting.StripeTopUpPriceIds = originalTopUps
		setting.StripePriceId = originalPrice
		setting.StripePriceId20 = originalPrice20
		setting.StripePriceId200 = originalPrice200
	})
}

var _ RecallStripeClient = (*recallStripeFakeClient)(nil)
var _ RecallStripeClient = NewStripeRecallClient()
