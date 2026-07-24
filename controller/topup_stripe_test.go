package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	stripewebhook "github.com/stripe/stripe-go/v86/webhook"
	"gorm.io/gorm"
)

func TestNormalizeStripeTopUpAmountUsesDisplayTokens(t *testing.T) {
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens

	require.Equal(t, int64(2), normalizeStripeTopUpAmount(int64(2*common.QuotaPerUnit)))
	require.Equal(t, int64(1), normalizeStripeTopUpAmount(1))
}

func TestStripeMinorUnitAmount(t *testing.T) {
	amount, err := stripeMinorUnitAmount(12.345, "USD")
	require.NoError(t, err)
	require.Equal(t, int64(1235), amount)

	amount, err = stripeMinorUnitAmount(1234.56, "JPY")
	require.NoError(t, err)
	require.Equal(t, int64(1235), amount)
}

func TestBuildStripeTopUpLineItemUsesConfiguredMultiCurrencyPrice(t *testing.T) {
	lineItem := buildStripeTopUpLineItem("price_multi_currency", 20)

	require.NotNil(t, lineItem.Price)
	require.Equal(t, "price_multi_currency", *lineItem.Price)
	require.NotNil(t, lineItem.Quantity)
	require.Equal(t, int64(20), *lineItem.Quantity)
	require.Nil(t, lineItem.PriceData)
}

func TestResolveStripeTopUpCheckoutUsesTierMultiCurrencyPrice(t *testing.T) {
	originalPriceId := setting.StripePriceId
	originalPriceId20 := setting.StripePriceId20
	originalPriceId200 := setting.StripePriceId200
	originalTopUpPriceIds := setting.StripeTopUpPriceIds
	paymentSetting := operation_setting.GetPaymentSetting()
	originalAmountOptions := append([]int(nil), paymentSetting.AmountOptions...)
	originalPriceAmount := stripePriceAmountMinorForCheckoutCurrency
	t.Cleanup(func() {
		setting.StripePriceId = originalPriceId
		setting.StripePriceId20 = originalPriceId20
		setting.StripePriceId200 = originalPriceId200
		setting.StripeTopUpPriceIds = originalTopUpPriceIds
		paymentSetting.AmountOptions = originalAmountOptions
		stripePriceAmountMinorForCheckoutCurrency = originalPriceAmount
	})
	setting.StripeTopUpPriceIds = `{"10":"price_multi_currency_10","20":"price_multi_currency_20","200":"price_multi_currency_200"}`
	paymentSetting.AmountOptions = []int{10, 20, 200}
	checkedCurrencies := map[string]string{}
	stripePriceAmountMinorForCheckoutCurrency = func(priceId string, requestedCurrency string) (int64, error) {
		checkedCurrencies[priceId] = requestedCurrency
		switch priceId + ":" + requestedCurrency {
		case "price_multi_currency_10:JPY":
			return 1500, nil
		case "price_multi_currency_20:JPY":
			return 3000, nil
		case "price_multi_currency_200:USD":
			return 20000, nil
		case "price_multi_currency_200:BRL":
			return 99000, nil
		case "price_multi_currency_10:INR":
			return 89900, nil
		default:
			return 0, errors.New("unexpected price lookup")
		}
	}

	checkout, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         10,
		StripeCurrency: "jpy",
	}, 10, "default")
	require.NoError(t, err)
	require.Equal(t, "price_multi_currency_10", checkout.PriceId)
	require.Equal(t, "JPY", checkedCurrencies["price_multi_currency_10"])
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "JPY", checkout.PaymentCurrency)
	require.Equal(t, int64(1500), checkout.AmountMinor)
	require.Equal(t, 10.0, checkout.Money)

	checkout, err = resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         20,
		StripeCurrency: "JPY",
	}, 20, "default")
	require.NoError(t, err)
	require.Equal(t, "price_multi_currency_20", checkout.PriceId)
	require.Equal(t, "JPY", checkedCurrencies["price_multi_currency_20"])
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "JPY", checkout.PaymentCurrency)
	require.Equal(t, int64(3000), checkout.AmountMinor)
	require.Equal(t, 20.0, checkout.Money)

	checkout, err = resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         200,
		StripeCurrency: "USD",
	}, 200, "default")
	require.NoError(t, err)
	require.Equal(t, "price_multi_currency_200", checkout.PriceId)
	require.Equal(t, "USD", checkedCurrencies["price_multi_currency_200"])
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "USD", checkout.PaymentCurrency)
	require.Equal(t, int64(20000), checkout.AmountMinor)
	require.Equal(t, 200.0, checkout.Money)

	checkout, err = resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         200,
		StripeCurrency: "BRL",
	}, 200, "default")
	require.NoError(t, err)
	require.Equal(t, "price_multi_currency_200", checkout.PriceId)
	require.Equal(t, "BRL", checkedCurrencies["price_multi_currency_200"])
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "BRL", checkout.PaymentCurrency)
	require.Equal(t, int64(99000), checkout.AmountMinor)
	require.Equal(t, 200.0, checkout.Money)

	checkout, err = resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         10,
		StripeCurrency: "INR",
	}, 10, "default")
	require.NoError(t, err)
	require.Equal(t, "price_multi_currency_10", checkout.PriceId)
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "INR", checkout.PaymentCurrency)
	require.Equal(t, int64(89900), checkout.AmountMinor)
	require.Equal(t, 10.0, checkout.Money)
}

func TestResolveStripeTopUpCheckoutRejectsPriceAmountNotMatchingPackage(t *testing.T) {
	originalTopUpPriceIds := setting.StripeTopUpPriceIds
	paymentSetting := operation_setting.GetPaymentSetting()
	originalAmountOptions := append([]int(nil), paymentSetting.AmountOptions...)
	originalPriceAmount := stripePriceAmountMinorForCheckoutCurrency
	t.Cleanup(func() {
		setting.StripeTopUpPriceIds = originalTopUpPriceIds
		paymentSetting.AmountOptions = originalAmountOptions
		stripePriceAmountMinorForCheckoutCurrency = originalPriceAmount
	})
	setting.StripeTopUpPriceIds = `{"10":"price_multi_currency_10","20":"price_multi_currency_20","200":"price_multi_currency_200"}`
	paymentSetting.AmountOptions = []int{10, 20, 200}
	stripePriceAmountMinorForCheckoutCurrency = func(priceId string, requestedCurrency string) (int64, error) {
		require.Equal(t, "price_multi_currency_20", priceId)
		require.Equal(t, "USD", requestedCurrency)
		return 1000, nil
	}

	_, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         20,
		StripeCurrency: "usd",
	}, 20, "default")

	require.EqualError(t, err, "Stripe Price price_multi_currency_20 has invalid USD amount for 20 package: expected 2000 got 1000")
}

func TestResolveStripeTopUpCheckoutRejectsMissingCurrency(t *testing.T) {
	_, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount: 10,
	}, 10, "default")

	require.EqualError(t, err, "Stripe checkout currency is required")
}

func TestResolveStripeTopUpCheckoutReturnsPriceCurrencyValidationError(t *testing.T) {
	originalTopUpPriceIds := setting.StripeTopUpPriceIds
	paymentSetting := operation_setting.GetPaymentSetting()
	originalAmountOptions := append([]int(nil), paymentSetting.AmountOptions...)
	originalPriceAmount := stripePriceAmountMinorForCheckoutCurrency
	t.Cleanup(func() {
		setting.StripeTopUpPriceIds = originalTopUpPriceIds
		paymentSetting.AmountOptions = originalAmountOptions
		stripePriceAmountMinorForCheckoutCurrency = originalPriceAmount
	})
	setting.StripeTopUpPriceIds = `{"10":"price_multi_currency_10"}`
	paymentSetting.AmountOptions = []int{10}
	stripePriceAmountMinorForCheckoutCurrency = func(priceId string, requestedCurrency string) (int64, error) {
		require.Equal(t, "price_multi_currency_10", priceId)
		require.Equal(t, "BRL", requestedCurrency)
		return 0, errors.New("Stripe Price price_multi_currency_10 does not support BRL")
	}

	_, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         10,
		StripeCurrency: "brl",
	}, 10, "default")

	require.EqualError(t, err, "Stripe Price price_multi_currency_10 does not support BRL")
}

func TestStripePriceSupportsCurrency(t *testing.T) {
	price := &stripe.Price{
		Currency: stripe.CurrencyUSD,
		CurrencyOptions: map[string]*stripe.PriceCurrencyOptions{
			"jpy": {},
			"brl": {},
		},
	}

	require.True(t, stripePriceSupportsCurrency(price, "USD"))
	require.True(t, stripePriceSupportsCurrency(price, "jpy"))
	require.True(t, stripePriceSupportsCurrency(price, "BRL"))
	require.False(t, stripePriceSupportsCurrency(price, "EUR"))
	require.False(t, stripePriceSupportsCurrency(nil, "USD"))
}

func TestStripePriceAmountMinorForCurrency(t *testing.T) {
	price := &stripe.Price{
		Currency:   stripe.CurrencyUSD,
		UnitAmount: 1000,
		CurrencyOptions: map[string]*stripe.PriceCurrencyOptions{
			"jpy": {UnitAmount: 1500},
			"brl": {UnitAmount: 4990},
			"eur": nil,
		},
	}

	amount, ok := stripePriceAmountMinorForCurrency(price, "USD")
	require.True(t, ok)
	require.Equal(t, int64(1000), amount)

	amount, ok = stripePriceAmountMinorForCurrency(price, "jpy")
	require.True(t, ok)
	require.Equal(t, int64(1500), amount)

	amount, ok = stripePriceAmountMinorForCurrency(price, "BRL")
	require.True(t, ok)
	require.Equal(t, int64(4990), amount)

	_, ok = stripePriceAmountMinorForCurrency(price, "EUR")
	require.False(t, ok)
}

func TestGetStripePriceAmountMinorForCurrencyExpandsCurrencyOptions(t *testing.T) {
	originalAPISecret := setting.StripeApiSecret
	originalPriceGetter := stripePriceGetter
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		stripePriceGetter = originalPriceGetter
	})
	setting.StripeApiSecret = "sk_test_123"
	var expands []string
	stripePriceGetter = func(priceId string, params *stripe.PriceParams) (*stripe.Price, error) {
		require.Equal(t, "price_multi_currency", priceId)
		require.NotNil(t, params)
		for _, expand := range params.Expand {
			if expand != nil {
				expands = append(expands, *expand)
			}
		}
		return &stripe.Price{
			Currency:   stripe.CurrencyUSD,
			UnitAmount: 1000,
			CurrencyOptions: map[string]*stripe.PriceCurrencyOptions{
				"jpy": {UnitAmount: 1500},
			},
		}, nil
	}

	amountMinor, err := getStripePriceAmountMinorForCurrency(" price_multi_currency ", "JPY")

	require.NoError(t, err)
	require.Equal(t, int64(1500), amountMinor)
	require.Contains(t, expands, "currency_options")
}

func TestResolveStripeTopUpCheckoutRejectsUnsupportedCurrencyPackage(t *testing.T) {
	_, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         10,
		StripeCurrency: "eur",
	}, 10, "default")

	require.EqualError(t, err, "unsupported Stripe checkout currency")
}

func TestResolveStripeTopUpCheckoutRejectsUnsupportedPackageAmount(t *testing.T) {
	originalPriceId := setting.StripePriceId
	originalTopUpPriceIds := setting.StripeTopUpPriceIds
	paymentSetting := operation_setting.GetPaymentSetting()
	originalAmountOptions := append([]int(nil), paymentSetting.AmountOptions...)
	t.Cleanup(func() {
		setting.StripePriceId = originalPriceId
		setting.StripeTopUpPriceIds = originalTopUpPriceIds
		paymentSetting.AmountOptions = originalAmountOptions
	})
	setting.StripeTopUpPriceIds = `{"10":"price_usd_package"}`
	paymentSetting.AmountOptions = []int{10}

	_, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         15,
		StripeCurrency: "USD",
	}, 15, "default")

	require.EqualError(t, err, "Stripe checkout package requires one of configured preset amounts: 10 USD credits")
}

func TestStripeCheckoutSessionKeepsAccountEmailVerbatim(t *testing.T) {
	params := buildStripeCheckoutSessionParams(
		"trade_123",
		"",
		"buyer+location_JP@example.com",
		"price_123",
		1,
		"USD",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
		false,
		"",
	)

	require.NotNil(t, params.CustomerEmail)
	require.Equal(t, "buyer+location_JP@example.com", *params.CustomerEmail)
	require.Nil(t, params.AllowPromotionCodes, "promotion code field must stay hidden on checkout")
	require.NotNil(t, params.PaymentIntentData)
	require.Equal(t, "trade_123", params.PaymentIntentData.Metadata["trade_no"])
}

func TestStripeCheckoutSessionRequestsThreeDSecure(t *testing.T) {
	params := buildStripeCheckoutSessionParams(
		"trade_3ds",
		"",
		"buyer@example.com",
		"price_123",
		1,
		"USD",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
		false,
		"",
	)

	require.NotNil(t, params.PaymentMethodOptions, "card options must always be set for the 3DS request")
	require.NotNil(t, params.PaymentMethodOptions.Card)
	require.NotNil(t, params.PaymentMethodOptions.Card.RequestThreeDSecure)
	require.Equal(t, "any", *params.PaymentMethodOptions.Card.RequestThreeDSecure)
	require.Nil(t, params.PaymentMethodOptions.Card.SetupFutureUsage, "plain top-ups must not bind the card")

	// saveCard top-ups keep the off-session binding alongside the 3DS request.
	params = buildStripeCheckoutSessionParams(
		"trade_3ds_save",
		"",
		"buyer@example.com",
		"price_123",
		1,
		"USD",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		true,
		false,
		"",
	)

	require.NotNil(t, params.PaymentMethodOptions)
	require.NotNil(t, params.PaymentMethodOptions.Card)
	require.NotNil(t, params.PaymentMethodOptions.Card.RequestThreeDSecure)
	require.Equal(t, "any", *params.PaymentMethodOptions.Card.RequestThreeDSecure)
	require.NotNil(t, params.PaymentMethodOptions.Card.SetupFutureUsage)
	require.Equal(t, "off_session", *params.PaymentMethodOptions.Card.SetupFutureUsage)
}

func TestStripeCheckoutSessionCarriesSubmitMessage(t *testing.T) {
	params := buildStripeCheckoutSessionParams(
		"trade_bonus",
		"",
		"buyer@example.com",
		"price_123",
		1,
		"USD",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
		false,
		"$27 in credits ($20 + $7 bonus) will be added to your account immediately after payment.",
	)

	require.NotNil(t, params.CustomText)
	require.NotNil(t, params.CustomText.Submit)
	require.Equal(t, "$27 in credits ($20 + $7 bonus) will be added to your account immediately after payment.", *params.CustomText.Submit.Message)

	params = buildStripeCheckoutSessionParams(
		"trade_nomsg",
		"",
		"buyer@example.com",
		"price_123",
		1,
		"USD",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
		false,
		"",
	)
	require.Nil(t, params.CustomText)
}

func TestStripeCheckoutSessionEmbeddedModeUsesReturnURL(t *testing.T) {
	params := buildStripeCheckoutSessionParams(
		"trade_embedded",
		"",
		"buyer@example.com",
		"price_123",
		1,
		"USD",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
		true,
		"",
	)

	require.NotNil(t, params.UIMode)
	require.Equal(t, string(stripe.CheckoutSessionUIModeEmbeddedPage), *params.UIMode)
	require.NotNil(t, params.ReturnURL, "redirect payment methods need a landing page")
	require.Equal(t, "https://example.com/success?session_id={CHECKOUT_SESSION_ID}&trade_no=trade_embedded", *params.ReturnURL)
	require.Nil(t, params.SuccessURL, "embedded sessions reject success_url")
	require.Nil(t, params.CancelURL, "embedded sessions reject cancel_url")

	params = buildStripeCheckoutSessionParams(
		"trade_hosted",
		"",
		"buyer@example.com",
		"price_123",
		1,
		"USD",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
		false,
		"",
	)
	require.Nil(t, params.UIMode)
	require.NotNil(t, params.SuccessURL)
	require.NotNil(t, params.CancelURL)
}

func TestResumeStripeTopUpCheckoutReturnsExistingHostedSession(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalSecret := setting.StripeApiSecret
	originalKey := stripe.Key
	originalGetter := stripeCheckoutSessionGetter
	t.Cleanup(func() {
		setting.StripeApiSecret = originalSecret
		stripe.Key = originalKey
		stripeCheckoutSessionGetter = originalGetter
	})
	setting.StripeApiSecret = "sk_test_resume"
	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId: 41, TradeNo: "resume_hosted", GatewayTradeNo: "cs_resume_hosted",
		PaymentProvider: model.PaymentProviderStripe, Status: common.TopUpStatusPending,
	}).Error)
	stripeCheckoutSessionGetter = func(id string, _ *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
		require.Equal(t, "cs_resume_hosted", id)
		return &stripe.CheckoutSession{
			Status:        stripe.CheckoutSessionStatusOpen,
			PaymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid,
			URL:           "https://checkout.stripe.test/resume",
		}, nil
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/user/topup/:trade_no/resume", func(c *gin.Context) {
		c.Set("id", 41)
		ResumeStripeTopUpCheckout(c)
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/topup/resume_hosted/resume", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"success":true,"message":"success","data":{"pay_link":"https://checkout.stripe.test/resume"}}`, recorder.Body.String())
}

func TestResumeStripeTopUpCheckoutRejectsAnotherUsersOrderBeforeStripeLookup(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalGetter := stripeCheckoutSessionGetter
	t.Cleanup(func() { stripeCheckoutSessionGetter = originalGetter })
	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId: 42, TradeNo: "resume_owned", GatewayTradeNo: "cs_resume_owned",
		PaymentProvider: model.PaymentProviderStripe, Status: common.TopUpStatusPending,
	}).Error)
	lookedUp := false
	stripeCheckoutSessionGetter = func(_ string, _ *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
		lookedUp = true
		return nil, errors.New("must not be called")
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/user/topup/:trade_no/resume", func(c *gin.Context) {
		c.Set("id", 99)
		ResumeStripeTopUpCheckout(c)
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/topup/resume_owned/resume", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.False(t, lookedUp)
	require.Contains(t, recorder.Body.String(), `"success":false`)
}

func TestResumeStripeTopUpCheckoutExpiresStaleLocalOrder(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalSecret := setting.StripeApiSecret
	originalKey := stripe.Key
	originalGetter := stripeCheckoutSessionGetter
	t.Cleanup(func() {
		setting.StripeApiSecret = originalSecret
		stripe.Key = originalKey
		stripeCheckoutSessionGetter = originalGetter
	})
	setting.StripeApiSecret = "sk_test_resume"
	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId: 43, TradeNo: "resume_expired", GatewayTradeNo: "cs_resume_expired",
		PaymentProvider: model.PaymentProviderStripe, Status: common.TopUpStatusPending,
	}).Error)
	stripeCheckoutSessionGetter = func(_ string, _ *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
		return &stripe.CheckoutSession{
			Status:        stripe.CheckoutSessionStatusOpen,
			PaymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid,
			ExpiresAt:     time.Now().Add(-time.Minute).Unix(),
		}, nil
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/user/topup/:trade_no/resume", func(c *gin.Context) {
		c.Set("id", 43)
		ResumeStripeTopUpCheckout(c)
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/user/topup/resume_expired/resume", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	reloaded := model.GetTopUpByTradeNo("resume_expired")
	require.NotNil(t, reloaded)
	require.Equal(t, common.TopUpStatusExpired, reloaded.Status)
}

func TestStripeCheckoutSessionPassesSelectedCurrency(t *testing.T) {
	params := buildStripeCheckoutSessionParams(
		"trade_inr",
		"",
		"buyer@example.com",
		"price_123",
		1,
		"INR",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
		false,
		"",
	)

	require.NotNil(t, params.Currency, "non-USD selection must be sent to Stripe")
	require.Equal(t, "inr", *params.Currency)

	// USD (the Price default) stays unset so Stripe adaptive pricing keeps working.
	params = buildStripeCheckoutSessionParams(
		"trade_usd",
		"",
		"buyer@example.com",
		"price_123",
		1,
		"USD",
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
		false,
		"",
	)
	require.Nil(t, params.Currency)
}

func TestStripePaymentSnapshotFromEventUsesCurrencyMinorUnits(t *testing.T) {
	event := stripe.Event{Data: &stripe.EventData{Object: map[string]interface{}{
		"amount_total": float64(12345),
		"currency":     "brl",
	}}}

	snapshot := stripePaymentSnapshotFromEvent(event)
	require.Equal(t, 123.45, snapshot.Money)
	require.Equal(t, "BRL", snapshot.Currency)

	event = stripe.Event{Data: &stripe.EventData{Object: map[string]interface{}{
		"amount_total": float64(5000),
		"currency":     "jpy",
	}}}

	snapshot = stripePaymentSnapshotFromEvent(event)
	require.Equal(t, 5000.0, snapshot.Money)
	require.Equal(t, "JPY", snapshot.Currency)
}

func TestStripePaymentSnapshotFromEventKeepsZeroAmount(t *testing.T) {
	event := stripe.Event{Data: &stripe.EventData{Object: map[string]interface{}{
		"amount_total": float64(0),
		"currency":     "usd",
	}}}

	snapshot := stripePaymentSnapshotFromEvent(event)
	require.Equal(t, 0.0, snapshot.Money)
	require.Equal(t, "USD", snapshot.Currency)
}

func TestStripePaymentSnapshotFromEventRequiresAmountAndCurrency(t *testing.T) {
	for _, event := range []stripe.Event{
		{Data: &stripe.EventData{Object: map[string]interface{}{
			"currency": "usd",
		}}},
		{Data: &stripe.EventData{Object: map[string]interface{}{
			"amount_total": "not-a-number",
			"currency":     "usd",
		}}},
		{Data: &stripe.EventData{Object: map[string]interface{}{
			"amount_total": float64(1234),
		}}},
	} {
		require.Equal(t, model.PaymentSnapshot{}, stripePaymentSnapshotFromEvent(event))
	}
}

func TestChargeRefundedQueuesCumulativeRevenueAdjustment(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	user := &model.User{
		Id:             905,
		Username:       "stripe_refund_attribution",
		Status:         common.UserStatusEnabled,
		AdsAttribution: `{"gclid":"CLICK_REFUND_12345"}`,
	}
	require.NoError(t, model.DB.Create(user).Error)
	topUp := &model.TopUp{
		UserId:          user.Id,
		TradeNo:         "ref_stripe_refund",
		Money:           10,
		PaymentCurrency: "USD",
		PaymentProvider: model.PaymentProviderStripe,
		CompleteTime:    1_800_000_000,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, model.DB.Create(topUp).Error)
	require.NoError(t, model.EnqueueAdsPurchaseInTx(model.DB, topUp))

	event := stripe.Event{
		ID:      "evt_refund_partial",
		Type:    stripe.EventTypeChargeRefunded,
		Created: 1_800_000_100,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"metadata":        map[string]interface{}{"trade_no": topUp.TradeNo},
			"currency":        "usd",
			"amount_refunded": float64(350),
		}},
	}
	require.NoError(t, chargeReversed(
		context.Background(), event, model.InviteSubRewardReasonRefunded, "127.0.0.1",
	))
	require.NoError(t, chargeReversed(
		context.Background(), event, model.InviteSubRewardReasonRefunded, "127.0.0.1",
	), "Stripe webhook replay must be idempotent")

	var refunds []model.AdsAttributionOutbox
	require.NoError(t, model.DB.Where("event_type = ?", "refund").Find(&refunds).Error)
	require.Len(t, refunds, 1)
	var payload map[string]any
	require.NoError(t, json.Unmarshal([]byte(refunds[0].Payload), &payload))
	require.Equal(t, "restatement", payload["adjustment_type"])
	require.Equal(t, 3.5, payload["value"])
	require.Equal(t, 6.5, payload["adjusted_value"])
	require.Equal(t, "USD", payload["currency"])
}

func TestFulfillOrderRejectsMismatchedStripePaymentContract(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalContractFromEvent := stripeCheckoutPaymentContractFromEvent
	t.Cleanup(func() {
		stripeCheckoutPaymentContractFromEvent = originalContractFromEvent
	})

	insertStripeFulfillmentUser(t, 901)
	topUp := &model.TopUp{
		UserId:             901,
		Amount:             200,
		Money:              200,
		PaymentCurrency:    "USD",
		PaymentPriceId:     "price_200",
		PaymentAmountMinor: 20000,
		TradeNo:            "ref_stripe_contract_mismatch",
		GatewayTradeNo:     "cs_contract_mismatch",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	stripeCheckoutPaymentContractFromEvent = func(event stripe.Event) (stripeCheckoutPaymentContract, error) {
		return stripeCheckoutPaymentContract{
			SessionId:           "cs_contract_mismatch",
			PriceId:             "price_10",
			Quantity:            1,
			AmountSubtotalMinor: 1000,
			AmountTotalMinor:    1000,
			Currency:            "USD",
		}, nil
	}

	event := stripe.Event{Data: &stripe.EventData{Object: map[string]interface{}{
		"id":                  "cs_contract_mismatch",
		"amount_total":        float64(1000),
		"currency":            "usd",
		"client_reference_id": "ref_stripe_contract_mismatch",
	}}}
	require.Error(t, fulfillOrder(context.Background(), event, "ref_stripe_contract_mismatch", "cus_contract", "127.0.0.1"))

	reloaded := model.GetTopUpByTradeNo("ref_stripe_contract_mismatch")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusPending, reloaded.Status)
	assert.Equal(t, 0, stripeFulfillmentUserQuota(t, 901))
}

func TestFulfillOrderAcceptsDiscountedStripePaymentContract(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalContractFromEvent := stripeCheckoutPaymentContractFromEvent
	t.Cleanup(func() {
		stripeCheckoutPaymentContractFromEvent = originalContractFromEvent
	})

	insertStripeFulfillmentUser(t, 902)
	topUp := &model.TopUp{
		UserId:             902,
		Amount:             200,
		Money:              200,
		PaymentCurrency:    "USD",
		PaymentPriceId:     "price_200",
		PaymentAmountMinor: 20000,
		TradeNo:            "ref_stripe_contract_discount",
		GatewayTradeNo:     "cs_contract_discount",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	stripeCheckoutPaymentContractFromEvent = func(event stripe.Event) (stripeCheckoutPaymentContract, error) {
		return stripeCheckoutPaymentContract{
			SessionId:           "cs_contract_discount",
			PriceId:             "price_200",
			Quantity:            1,
			AmountSubtotalMinor: 20000,
			AmountTotalMinor:    1000,
			Currency:            "USD",
		}, nil
	}

	event := stripe.Event{Data: &stripe.EventData{Object: map[string]interface{}{
		"id":                  "cs_contract_discount",
		"amount_total":        float64(1000),
		"currency":            "usd",
		"client_reference_id": "ref_stripe_contract_discount",
	}}}
	require.NoError(t, fulfillOrder(context.Background(), event, "ref_stripe_contract_discount", "cus_contract", "127.0.0.1"))

	reloaded := model.GetTopUpByTradeNo("ref_stripe_contract_discount")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.Equal(t, int(200*common.QuotaPerUnit), stripeFulfillmentUserQuota(t, 902))
}

func TestFulfillOrderAcceptsStripeLineItemAmountDriftWhenPriceMatches(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalContractFromEvent := stripeCheckoutPaymentContractFromEvent
	originalNotifier := notifyStripePaymentProcessingFailure
	t.Cleanup(func() {
		stripeCheckoutPaymentContractFromEvent = originalContractFromEvent
		notifyStripePaymentProcessingFailure = originalNotifier
	})
	notifyStripePaymentProcessingFailure = func(alert service.DingTalkPaymentProcessingAlert) error {
		t.Fatalf("unexpected payment processing alert: %+v", alert)
		return nil
	}

	insertStripeFulfillmentUser(t, 905)
	topUp := &model.TopUp{
		UserId:             905,
		Amount:             20,
		Money:              20,
		PaymentCurrency:    "USD",
		PaymentPriceId:     "price_20",
		PaymentAmountMinor: 2000,
		TradeNo:            "ref_stripe_amount_drift",
		GatewayTradeNo:     "cs_amount_drift",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	stripeCheckoutPaymentContractFromEvent = func(event stripe.Event) (stripeCheckoutPaymentContract, error) {
		return stripeCheckoutPaymentContract{
			SessionId:           "cs_amount_drift",
			PriceId:             "price_20",
			Quantity:            1,
			AmountSubtotalMinor: 1999,
			AmountTotalMinor:    999,
			Currency:            "USD",
		}, nil
	}

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_amount_drift",
			"amount_total":        float64(999),
			"currency":            "usd",
			"client_reference_id": "ref_stripe_amount_drift",
		}},
	}
	require.NoError(t, fulfillOrder(context.Background(), event, "ref_stripe_amount_drift", "cus_amount_drift", "127.0.0.1"))

	reloaded := model.GetTopUpByTradeNo("ref_stripe_amount_drift")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.Equal(t, 9.99, reloaded.Money)
	assert.Equal(t, "USD", reloaded.PaymentCurrency)
	assert.Equal(t, int(20*common.QuotaPerUnit), stripeFulfillmentUserQuota(t, 905))
}

func TestFulfillOrderAlertsOnStripePaymentContractFailure(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalContractFromEvent := stripeCheckoutPaymentContractFromEvent
	originalNotifier := notifyStripePaymentProcessingFailure
	t.Cleanup(func() {
		stripeCheckoutPaymentContractFromEvent = originalContractFromEvent
		notifyStripePaymentProcessingFailure = originalNotifier
	})

	var alerts []service.DingTalkPaymentProcessingAlert
	notifyStripePaymentProcessingFailure = func(alert service.DingTalkPaymentProcessingAlert) error {
		alerts = append(alerts, alert)
		return nil
	}

	insertStripeFulfillmentUser(t, 903)
	topUp := &model.TopUp{
		UserId:             903,
		Amount:             20,
		Money:              20,
		PaymentCurrency:    "USD",
		PaymentPriceId:     "price_20",
		PaymentAmountMinor: 2000,
		TradeNo:            "ref_stripe_contract_alert",
		GatewayTradeNo:     "cs_contract_alert",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	stripeCheckoutPaymentContractFromEvent = func(event stripe.Event) (stripeCheckoutPaymentContract, error) {
		return stripeCheckoutPaymentContract{
			SessionId:           "cs_contract_alert",
			PriceId:             "price_other",
			Quantity:            1,
			AmountSubtotalMinor: 1999,
			AmountTotalMinor:    1999,
			Currency:            "USD",
		}, nil
	}

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_contract_alert",
			"amount_total":        float64(1999),
			"currency":            "usd",
			"client_reference_id": "ref_stripe_contract_alert",
			"customer":            "cus_contract_alert",
			"customer_details": map[string]interface{}{
				"email": "kurebarr.h@gmail.com",
			},
		}},
	}
	err := fulfillOrder(context.Background(), event, "ref_stripe_contract_alert", "cus_contract_alert", "127.0.0.1")

	require.Error(t, err)
	require.Len(t, alerts, 1)
	assert.Equal(t, model.PaymentProviderStripe, alerts[0].Provider)
	assert.Equal(t, "ref_stripe_contract_alert", alerts[0].TradeNo)
	assert.Equal(t, string(stripe.EventTypeCheckoutSessionCompleted), alerts[0].EventType)
	assert.Equal(t, "cus_contract_alert", alerts[0].CustomerID)
	assert.Equal(t, "kurebarr.h@gmail.com", alerts[0].CustomerEmail)
	assert.Equal(t, "USD", alerts[0].ExpectedCurrency)
	assert.Equal(t, int64(2000), alerts[0].ExpectedAmountMinor)
	assert.Equal(t, "USD", alerts[0].ActualCurrency)
	assert.Equal(t, int64(1999), alerts[0].ActualAmountMinor)
	assert.Equal(t, "contract_mismatch", alerts[0].ErrorClass)
	assert.Contains(t, alerts[0].Error, "price mismatch")

	reloaded := model.GetTopUpByTradeNo("ref_stripe_contract_alert")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusPending, reloaded.Status)
	assert.Equal(t, 0, stripeFulfillmentUserQuota(t, 903))
}

func TestFulfillOrderSendsPaymentProcessingAlertAfterUnlock(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalContractFromEvent := stripeCheckoutPaymentContractFromEvent
	originalNotifier := notifyStripePaymentProcessingFailure
	t.Cleanup(func() {
		stripeCheckoutPaymentContractFromEvent = originalContractFromEvent
		notifyStripePaymentProcessingFailure = originalNotifier
	})

	insertStripeFulfillmentUser(t, 906)
	topUp := &model.TopUp{
		UserId:             906,
		Amount:             20,
		Money:              20,
		PaymentCurrency:    "USD",
		PaymentPriceId:     "price_20",
		PaymentAmountMinor: 2000,
		TradeNo:            "ref_stripe_alert_unlock",
		GatewayTradeNo:     "cs_alert_unlock",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	stripeCheckoutPaymentContractFromEvent = func(event stripe.Event) (stripeCheckoutPaymentContract, error) {
		return stripeCheckoutPaymentContract{
			SessionId: "cs_alert_unlock",
			PriceId:   "price_other",
			Quantity:  1,
			Currency:  "USD",
		}, nil
	}

	alertCanLockOrder := make(chan struct{})
	notifyStripePaymentProcessingFailure = func(alert service.DingTalkPaymentProcessingAlert) error {
		LockOrder("ref_stripe_alert_unlock")
		UnlockOrder("ref_stripe_alert_unlock")
		close(alertCanLockOrder)
		return nil
	}

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_alert_unlock",
			"amount_total":        float64(1999),
			"currency":            "usd",
			"client_reference_id": "ref_stripe_alert_unlock",
			"customer":            "cus_alert_unlock",
		}},
	}

	done := make(chan error, 1)
	go func() {
		done <- fulfillOrder(context.Background(), event, "ref_stripe_alert_unlock", "cus_alert_unlock", "127.0.0.1")
	}()

	select {
	case err := <-done:
		require.Error(t, err)
	case <-time.After(250 * time.Millisecond):
		t.Fatal("fulfillOrder held the order lock while sending the payment alert")
	}

	select {
	case <-alertCanLockOrder:
	case <-time.After(250 * time.Millisecond):
		t.Fatal("payment alert notifier could not acquire the order lock")
	}
}

func TestStripeWebhookAcknowledgesPermanentPaymentContractFailure(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	confirmPaymentComplianceForTest(t)
	originalSecret := setting.StripeWebhookSecret
	originalContractFromEvent := stripeCheckoutPaymentContractFromEvent
	originalNotifier := notifyStripePaymentProcessingFailure
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalSecret
		stripeCheckoutPaymentContractFromEvent = originalContractFromEvent
		notifyStripePaymentProcessingFailure = originalNotifier
	})
	setting.StripeWebhookSecret = "whsec_test_pr334"

	insertStripeFulfillmentUser(t, 907)
	topUp := &model.TopUp{
		UserId:             907,
		Amount:             20,
		Money:              20,
		PaymentCurrency:    "USD",
		PaymentPriceId:     "price_20",
		PaymentAmountMinor: 2000,
		TradeNo:            "ref_stripe_webhook_permanent",
		GatewayTradeNo:     "cs_webhook_permanent",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	stripeCheckoutPaymentContractFromEvent = func(event stripe.Event) (stripeCheckoutPaymentContract, error) {
		return stripeCheckoutPaymentContract{
			SessionId: "cs_webhook_permanent",
			PriceId:   "price_other",
			Quantity:  1,
			Currency:  "USD",
		}, nil
	}

	var alerts int32
	notifyStripePaymentProcessingFailure = func(alert service.DingTalkPaymentProcessingAlert) error {
		atomic.AddInt32(&alerts, 1)
		return nil
	}

	payload := []byte(`{
		"id": "evt_webhook_permanent",
		"object": "event",
		"type": "checkout.session.completed",
		"data": {
			"object": {
				"id": "cs_webhook_permanent",
				"object": "checkout.session",
				"status": "complete",
				"payment_status": "paid",
				"amount_total": 1999,
				"currency": "usd",
				"client_reference_id": "ref_stripe_webhook_permanent",
				"customer": "cus_webhook_permanent"
			}
		}
	}`)
	signedPayload := stripewebhook.GenerateTestSignedPayload(&stripewebhook.UnsignedPayload{
		Payload: payload,
		Secret:  setting.StripeWebhookSecret,
	})
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/stripe/webhook", bytes.NewReader(signedPayload.Payload))
	ctx.Request.Header.Set("Stripe-Signature", signedPayload.Header)

	StripeWebhook(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, int32(1), atomic.LoadInt32(&alerts))
}

func TestValidateStripeTopUpPaymentContractTreatsDatabaseErrorsAsRetryable(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	db, err := model.DB.DB()
	require.NoError(t, err)
	require.NoError(t, db.Close())

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_db_error",
			"client_reference_id": "ref_db_error",
		}},
	}

	err = validateStripeTopUpPaymentContract(event, "ref_db_error")

	require.Error(t, err)
	require.True(t, isRetryableStripeWebhookProcessingError(err))
}

func TestFulfillOrderAcceptsAdaptivePresentmentCurrency(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalContractFromEvent := stripeCheckoutPaymentContractFromEvent
	t.Cleanup(func() {
		stripeCheckoutPaymentContractFromEvent = originalContractFromEvent
	})

	insertStripeFulfillmentUser(t, 902)
	topUp := &model.TopUp{
		UserId:             902,
		Amount:             20,
		Money:              20,
		PaymentCurrency:    "USD",
		PaymentPriceId:     "price_20",
		PaymentAmountMinor: 2000,
		TradeNo:            "ref_stripe_adaptive_jpy",
		GatewayTradeNo:     "cs_adaptive_jpy",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	stripeCheckoutPaymentContractFromEvent = func(event stripe.Event) (stripeCheckoutPaymentContract, error) {
		return stripeCheckoutPaymentContract{
			SessionId:           "cs_adaptive_jpy",
			PriceId:             "price_20",
			Quantity:            1,
			AmountSubtotalMinor: 2999,
			AmountTotalMinor:    2999,
			Currency:            "JPY",
		}, nil
	}

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_adaptive_jpy",
			"amount_total":        float64(2999),
			"currency":            "jpy",
			"client_reference_id": "ref_stripe_adaptive_jpy",
		}},
	}
	require.NoError(t, fulfillOrder(context.Background(), event, "ref_stripe_adaptive_jpy", "cus_adaptive", "127.0.0.1"))

	reloaded := model.GetTopUpByTradeNo("ref_stripe_adaptive_jpy")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.Equal(t, 2999.0, reloaded.Money)
	assert.Equal(t, "JPY", reloaded.PaymentCurrency)
	assert.Equal(t, int(20*common.QuotaPerUnit), stripeFulfillmentUserQuota(t, 902))
}

func TestFulfillOrderAcceptsGlobalAdaptivePresentmentCurrency(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalContractFromEvent := stripeCheckoutPaymentContractFromEvent
	originalNotifier := notifyStripePaymentProcessingFailure
	t.Cleanup(func() {
		stripeCheckoutPaymentContractFromEvent = originalContractFromEvent
		notifyStripePaymentProcessingFailure = originalNotifier
	})
	notifyStripePaymentProcessingFailure = func(alert service.DingTalkPaymentProcessingAlert) error {
		t.Fatalf("unexpected payment processing alert: %+v", alert)
		return nil
	}

	insertStripeFulfillmentUser(t, 904)
	topUp := &model.TopUp{
		UserId:             904,
		Amount:             20,
		Money:              20,
		PaymentCurrency:    "USD",
		PaymentPriceId:     "price_20",
		PaymentAmountMinor: 2000,
		TradeNo:            "ref_stripe_adaptive_eur",
		GatewayTradeNo:     "cs_adaptive_eur",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	stripeCheckoutPaymentContractFromEvent = func(event stripe.Event) (stripeCheckoutPaymentContract, error) {
		return stripeCheckoutPaymentContract{
			SessionId:           "cs_adaptive_eur",
			PriceId:             "price_20",
			Quantity:            1,
			AmountSubtotalMinor: 1850,
			AmountTotalMinor:    1850,
			Currency:            "EUR",
		}, nil
	}

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_adaptive_eur",
			"amount_total":        float64(1850),
			"currency":            "eur",
			"client_reference_id": "ref_stripe_adaptive_eur",
		}},
	}
	require.NoError(t, fulfillOrder(context.Background(), event, "ref_stripe_adaptive_eur", "cus_adaptive", "127.0.0.1"))

	reloaded := model.GetTopUpByTradeNo("ref_stripe_adaptive_eur")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.Equal(t, 18.5, reloaded.Money)
	assert.Equal(t, "EUR", reloaded.PaymentCurrency)
	assert.Equal(t, int(20*common.QuotaPerUnit), stripeFulfillmentUserQuota(t, 904))
}

func setupStripeFulfillmentTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.UsingMySQL = originalUsingMySQL
	})
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.TopUp{},
		&model.AdsAttributionOutbox{},
		&model.InviteSubscriptionReward{},
		&model.TopUpBonusClaim{},
		&model.Log{},
		&model.PaymentInvoice{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
		&model.SubscriptionProviderBinding{},
		&model.PaymentWebhookEvent{},
	))
}

func insertStripeFulfillmentSubscriptionPlan(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            id,
		Title:         "Stripe Subscription Plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
		StripePriceId: "price_subscription",
	}).Error)
}

func insertStripeFulfillmentSubscriptionOrder(t *testing.T, tradeNo string, userID int, planID int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          userID,
		PlanId:          planID,
		Money:           9.99,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}).Error)
}

func insertStripeFulfillmentSubscriptionBinding(t *testing.T, userID int, providerSubscriptionID string, status string, cancelAtPeriodEnd bool) *model.SubscriptionProviderBinding {
	t.Helper()
	insertStripeFulfillmentUser(t, userID)
	insertStripeFulfillmentSubscriptionPlan(t, 800+userID)
	binding := &model.SubscriptionProviderBinding{
		UserId:                 userID,
		PlanId:                 800 + userID,
		InitialOrderId:         1000 + userID,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: providerSubscriptionID,
		ProviderCustomerId:     "cus_subscription",
		ProviderPriceId:        "price_subscription",
		ProviderStatus:         status,
		CancelAtPeriodEnd:      cancelAtPeriodEnd,
		CurrentPeriodStart:     1000,
		CurrentPeriodEnd:       2000,
	}
	require.NoError(t, model.DB.Create(binding).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		UserId:            userID,
		PlanId:            binding.PlanId,
		ProviderBindingId: binding.Id,
		AmountTotal:       1000,
		StartTime:         1000,
		EndTime:           2000,
		Status:            "active",
		Source:            "order",
	}).Error)
	return binding
}

func TestBuildStripeSubscriptionCheckoutSessionParamsIncludesNewAPIMetadata(t *testing.T) {
	params := buildStripeSubscriptionCheckoutSessionParams("sub_ref_metadata", "cus_123", "buyer@example.com", "price_subscription", 701, 801)

	require.NotNil(t, params.ClientReferenceID)
	require.Equal(t, "sub_ref_metadata", *params.ClientReferenceID)
	require.Equal(t, "sub_ref_metadata", params.Metadata["newapi_trade_no"])
	require.Equal(t, "701", params.Metadata["newapi_user_id"])
	require.Equal(t, "801", params.Metadata["newapi_plan_id"])
	require.NotNil(t, params.SubscriptionData)
	require.Equal(t, "sub_ref_metadata", params.SubscriptionData.Metadata["newapi_trade_no"])
	require.Equal(t, "701", params.SubscriptionData.Metadata["newapi_user_id"])
	require.Equal(t, "801", params.SubscriptionData.Metadata["newapi_plan_id"])
}

func TestStripeInvoicePaidWebhookCallsPaidInvoiceReconcile(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalReconcile := reconcilePaidStripeInvoice
	t.Cleanup(func() { reconcilePaidStripeInvoice = originalReconcile })
	var reconciledInvoiceID string
	reconcilePaidStripeInvoice = func(ctx context.Context, invoiceID string) (*service.PaidInvoiceReconcileResult, error) {
		reconciledInvoiceID = invoiceID
		return &service.PaidInvoiceReconcileResult{}, nil
	}

	event := stripe.Event{
		ID:   "evt_invoice_paid",
		Type: stripe.EventTypeInvoicePaid,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id": "in_route_paid",
		}},
	}

	require.NoError(t, handleStripeInvoicePaid(context.Background(), event))
	require.Equal(t, "in_route_paid", reconciledInvoiceID)
}

func TestStripeInvoicePaidDuplicateActiveLeaseRetriesWithoutReconcile(t *testing.T) {
	testCases := []struct {
		name   string
		status string
	}{
		{name: "processing", status: model.PaymentWebhookEventStatusProcessing},
		{name: "failed with active lease", status: model.PaymentWebhookEventStatusFailed},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setupStripeFulfillmentTestDB(t)
			originalReconcile := reconcilePaidStripeInvoice
			t.Cleanup(func() { reconcilePaidStripeInvoice = originalReconcile })
			called := false
			reconcilePaidStripeInvoice = func(ctx context.Context, invoiceID string) (*service.PaidInvoiceReconcileResult, error) {
				called = true
				return &service.PaidInvoiceReconcileResult{}, nil
			}
			require.NoError(t, model.DB.Create(&model.PaymentWebhookEvent{
				Provider:         model.PaymentProviderStripe,
				EventId:          "evt_invoice_paid_active_" + tc.name,
				EventType:        string(stripe.EventTypeInvoicePaid),
				ProviderObjectId: "in_active_lease",
				Status:           tc.status,
				ProcessingToken:  "worker-a",
				ProcessingUntil:  common.GetTimestamp() + 300,
				AttemptCount:     1,
			}).Error)

			err := handleStripeInvoicePaid(context.Background(), stripe.Event{
				ID:   "evt_invoice_paid_active_" + tc.name,
				Type: stripe.EventTypeInvoicePaid,
				Data: &stripe.EventData{Object: map[string]interface{}{
					"id": "in_active_lease",
				}},
			})

			require.Error(t, err)
			require.False(t, called)
		})
	}
}

func TestStripeInvoicePaidDuplicateProcessedAckWithoutReconcile(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalReconcile := reconcilePaidStripeInvoice
	t.Cleanup(func() { reconcilePaidStripeInvoice = originalReconcile })
	called := false
	reconcilePaidStripeInvoice = func(ctx context.Context, invoiceID string) (*service.PaidInvoiceReconcileResult, error) {
		called = true
		return &service.PaidInvoiceReconcileResult{}, nil
	}
	require.NoError(t, model.DB.Create(&model.PaymentWebhookEvent{
		Provider:         model.PaymentProviderStripe,
		EventId:          "evt_invoice_paid_processed",
		EventType:        string(stripe.EventTypeInvoicePaid),
		ProviderObjectId: "in_processed_duplicate",
		Status:           model.PaymentWebhookEventStatusProcessed,
		ProcessedAt:      common.GetTimestamp(),
		AttemptCount:     1,
	}).Error)

	err := handleStripeInvoicePaid(context.Background(), stripe.Event{
		ID:   "evt_invoice_paid_processed",
		Type: stripe.EventTypeInvoicePaid,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id": "in_processed_duplicate",
		}},
	})

	require.NoError(t, err)
	require.False(t, called)
}

func TestStripeInvoicePaymentFailedWebhookCallsFailedInvoiceReconcile(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalReconcile := reconcileFailedStripeInvoice
	t.Cleanup(func() { reconcileFailedStripeInvoice = originalReconcile })
	var reconciledInvoiceID string
	reconcileFailedStripeInvoice = func(ctx context.Context, invoiceID string) error {
		reconciledInvoiceID = invoiceID
		return nil
	}

	event := stripe.Event{
		ID:   "evt_invoice_failed",
		Type: stripe.EventTypeInvoicePaymentFailed,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id": "in_route_failed",
		}},
	}

	require.NoError(t, handleStripeInvoicePaymentFailed(context.Background(), event))
	require.Equal(t, "in_route_failed", reconciledInvoiceID)
}

func TestStripeWebhookRoutesInvoicePaymentFailedToRetryableReconcile(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	confirmPaymentComplianceForTest(t)
	originalSecret := setting.StripeWebhookSecret
	originalReconcile := reconcileFailedStripeInvoice
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalSecret
		reconcileFailedStripeInvoice = originalReconcile
	})
	setting.StripeWebhookSecret = "whsec_test_invoice_failed"
	reconcileFailedStripeInvoice = func(ctx context.Context, invoiceID string) error {
		require.Equal(t, "in_signed_failed", invoiceID)
		return errors.New("retry failed invoice")
	}
	payload := []byte(`{
		"id": "evt_invoice_failed_signed",
		"object": "event",
		"type": "invoice.payment_failed",
		"data": {
			"object": {
				"id": "in_signed_failed",
				"object": "invoice"
			}
		}
	}`)

	recorder := performSignedStripeWebhookRequest(t, payload, setting.StripeWebhookSecret)

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	require.Equal(t, "retry", recorder.Body.String())
}

func TestStripeWebhookAcksInvoicePaidNoOpReconcile(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	confirmPaymentComplianceForTest(t)
	originalSecret := setting.StripeWebhookSecret
	originalReconcile := reconcilePaidStripeInvoice
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalSecret
		reconcilePaidStripeInvoice = originalReconcile
	})
	setting.StripeWebhookSecret = "whsec_test_invoice_paid_noop"
	reconcilePaidStripeInvoice = func(ctx context.Context, invoiceID string) (*service.PaidInvoiceReconcileResult, error) {
		require.Equal(t, "in_signed_paid_noop", invoiceID)
		return &service.PaidInvoiceReconcileResult{Applied: false}, nil
	}
	payload := []byte(`{
		"id": "evt_invoice_paid_noop",
		"object": "event",
		"type": "invoice.paid",
		"data": {
			"object": {
				"id": "in_signed_paid_noop",
				"object": "invoice"
			}
		}
	}`)

	recorder := performSignedStripeWebhookRequest(t, payload, setting.StripeWebhookSecret)

	require.Equal(t, http.StatusOK, recorder.Code)
}

func TestStripeWebhookAcksInvoicePaymentFailedNoOpReconcile(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	confirmPaymentComplianceForTest(t)
	originalSecret := setting.StripeWebhookSecret
	originalReconcile := reconcileFailedStripeInvoice
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalSecret
		reconcileFailedStripeInvoice = originalReconcile
	})
	setting.StripeWebhookSecret = "whsec_test_invoice_failed_noop"
	reconcileFailedStripeInvoice = func(ctx context.Context, invoiceID string) error {
		require.Equal(t, "in_signed_failed_noop", invoiceID)
		return nil
	}
	payload := []byte(`{
		"id": "evt_invoice_failed_noop",
		"object": "event",
		"type": "invoice.payment_failed",
		"data": {
			"object": {
				"id": "in_signed_failed_noop",
				"object": "invoice"
			}
		}
	}`)

	recorder := performSignedStripeWebhookRequest(t, payload, setting.StripeWebhookSecret)

	require.Equal(t, http.StatusOK, recorder.Code)
}

func TestStripeRecurringCheckoutCompletedUsesInvoiceReconcile(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalReconcile := reconcilePaidStripeInvoice
	t.Cleanup(func() { reconcilePaidStripeInvoice = originalReconcile })
	var reconciledInvoiceID string
	reconcilePaidStripeInvoice = func(ctx context.Context, invoiceID string) (*service.PaidInvoiceReconcileResult, error) {
		reconciledInvoiceID = invoiceID
		return &service.PaidInvoiceReconcileResult{}, nil
	}

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_recurring",
			"mode":                string(stripe.CheckoutSessionModeSubscription),
			"status":              "complete",
			"payment_status":      "paid",
			"client_reference_id": "sub_recurring_route",
			"invoice":             "in_from_checkout",
		}},
	}

	require.NoError(t, sessionCompleted(context.Background(), event, "127.0.0.1"))
	require.Equal(t, "in_from_checkout", reconciledInvoiceID)
}

func TestStripeRecurringTerminalCheckoutUsesPendingPurchaseTerminator(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalTerminate := terminatePendingStripePurchase
	t.Cleanup(func() { terminatePendingStripePurchase = originalTerminate })
	var tradeNo string
	var status string
	terminatePendingStripePurchase = func(ctx context.Context, referenceID string, intentStatus string) error {
		tradeNo = referenceID
		status = intentStatus
		return nil
	}

	expired := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionExpired,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_expired",
			"mode":                string(stripe.CheckoutSessionModeSubscription),
			"status":              "expired",
			"client_reference_id": "sub_expired_route",
		}},
	}
	sessionExpired(context.Background(), expired)
	require.Equal(t, "sub_expired_route", tradeNo)
	require.Equal(t, model.SubscriptionChangeIntentStatusExpired, status)

	failed := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionAsyncPaymentFailed,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_failed",
			"mode":                string(stripe.CheckoutSessionModeSubscription),
			"client_reference_id": "sub_failed_route",
		}},
	}
	sessionAsyncPaymentFailed(context.Background(), failed, "127.0.0.1")
	require.Equal(t, "sub_failed_route", tradeNo)
	require.Equal(t, model.SubscriptionChangeIntentStatusFailed, status)
}

func TestStripeRecurringTerminalCheckoutPropagatesTerminatorError(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalTerminate := terminatePendingStripePurchase
	t.Cleanup(func() { terminatePendingStripePurchase = originalTerminate })
	terminatePendingStripePurchase = func(ctx context.Context, referenceID string, intentStatus string) error {
		return errors.New("terminator unavailable")
	}

	expired := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionExpired,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_expired_error",
			"mode":                string(stripe.CheckoutSessionModeSubscription),
			"status":              "expired",
			"client_reference_id": "sub_expired_error",
		}},
	}
	require.ErrorContains(t, sessionExpired(context.Background(), expired), "terminator unavailable")

	failed := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionAsyncPaymentFailed,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_failed_error",
			"mode":                string(stripe.CheckoutSessionModeSubscription),
			"client_reference_id": "sub_failed_error",
		}},
	}
	require.ErrorContains(t, sessionAsyncPaymentFailed(context.Background(), failed, "127.0.0.1"), "terminator unavailable")
}

func TestStripeWebhookRetriesRecurringTerminalTerminatorError(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	confirmPaymentComplianceForTest(t)
	originalSecret := setting.StripeWebhookSecret
	originalTerminate := terminatePendingStripePurchase
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalSecret
		terminatePendingStripePurchase = originalTerminate
	})
	setting.StripeWebhookSecret = "whsec_test_recurring_terminal_retry"
	terminatePendingStripePurchase = func(ctx context.Context, referenceID string, intentStatus string) error {
		return errors.New("terminator unavailable")
	}

	testCases := []struct {
		name    string
		payload []byte
	}{
		{
			name: "expired",
			payload: []byte(`{
				"id": "evt_recurring_expired_retry",
				"object": "event",
				"type": "checkout.session.expired",
				"data": {
					"object": {
						"id": "cs_recurring_expired_retry",
						"object": "checkout.session",
						"mode": "subscription",
						"status": "expired",
						"client_reference_id": "sub_recurring_expired_retry"
					}
				}
			}`),
		},
		{
			name: "async_failed",
			payload: []byte(`{
				"id": "evt_recurring_async_failed_retry",
				"object": "event",
				"type": "checkout.session.async_payment_failed",
				"data": {
					"object": {
						"id": "cs_recurring_async_failed_retry",
						"object": "checkout.session",
						"mode": "subscription",
						"client_reference_id": "sub_recurring_async_failed_retry"
					}
				}
			}`),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := performSignedStripeWebhookRequest(t, tc.payload, setting.StripeWebhookSecret)

			require.Equal(t, http.StatusInternalServerError, recorder.Code)
			require.Equal(t, "retry", recorder.Body.String())
		})
	}
}

func TestFulfillSubscriptionOrderRequiresCheckoutSubscriptionID(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	insertStripeFulfillmentUser(t, 701)
	insertStripeFulfillmentSubscriptionPlan(t, 801)
	insertStripeFulfillmentSubscriptionOrder(t, "sub_ref_missing_subscription", 701, 801)

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_missing_subscription",
			"status":              "complete",
			"payment_status":      "paid",
			"client_reference_id": "sub_ref_missing_subscription",
			"customer":            "cus_subscription",
		}},
	}
	err := fulfillOrder(context.Background(), event, "sub_ref_missing_subscription", "cus_subscription", "127.0.0.1")

	require.Error(t, err)
	var count int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 701).Count(&count).Error)
	require.EqualValues(t, 0, count)
}

func TestFulfillSubscriptionOrderBindsCheckoutSubscriptionOnce(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	originalSnapshot := stripeSubscriptionSnapshotFromCheckoutSession
	t.Cleanup(func() {
		stripeSubscriptionSnapshotFromCheckoutSession = originalSnapshot
	})
	stripeSubscriptionSnapshotFromCheckoutSession = func(event stripe.Event, order *model.SubscriptionOrder) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, "sub_ref_bind_once", order.TradeNo)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:  "sub_bind_once",
			ProviderCustomerId:      "cus_subscription",
			ProviderPriceId:         "price_subscription",
			ProviderLatestInvoiceId: "in_subscription",
			ProviderStatus:          "active",
			CurrentPeriodStart:      1000,
			CurrentPeriodEnd:        2000,
			Livemode:                false,
		}, nil
	}
	insertStripeFulfillmentUser(t, 702)
	insertStripeFulfillmentSubscriptionPlan(t, 802)
	insertStripeFulfillmentSubscriptionOrder(t, "sub_ref_bind_once", 702, 802)

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                  "cs_bind_once",
			"status":              "complete",
			"payment_status":      "paid",
			"client_reference_id": "sub_ref_bind_once",
			"customer":            "cus_subscription",
			"subscription":        "sub_bind_once",
		}},
	}

	require.NoError(t, fulfillOrder(context.Background(), event, "sub_ref_bind_once", "cus_subscription", "127.0.0.1"))
	require.NoError(t, fulfillOrder(context.Background(), event, "sub_ref_bind_once", "cus_subscription", "127.0.0.1"))

	var bindingCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("provider_subscription_id = ?", "sub_bind_once").Count(&bindingCount).Error)
	require.EqualValues(t, 1, bindingCount)
	var subCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 702).Count(&subCount).Error)
	require.EqualValues(t, 1, subCount)
}

func TestStripeSubscriptionWebhookUpdatedAppliesSnapshotOnce(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	binding := insertStripeFulfillmentSubscriptionBinding(t, 703, "sub_webhook_update", "active", false)
	originalSnapshot := stripeSubscriptionSnapshotFromSubscriptionEvent
	t.Cleanup(func() { stripeSubscriptionSnapshotFromSubscriptionEvent = originalSnapshot })
	var calls int
	stripeSubscriptionSnapshotFromSubscriptionEvent = func(event stripe.Event) (model.ProviderSubscriptionSnapshot, error) {
		calls++
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: "sub_webhook_update",
			ProviderCustomerId:     "cus_subscription",
			ProviderPriceId:        "price_subscription",
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}
	event := stripe.Event{
		ID:   "evt_subscription_update",
		Type: stripe.EventTypeCustomerSubscriptionUpdated,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id": "sub_webhook_update",
		}},
	}

	require.NoError(t, handleStripeSubscriptionUpdated(context.Background(), event))
	require.NoError(t, handleStripeSubscriptionUpdated(context.Background(), event))

	require.Equal(t, 1, calls)
	var updated model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updated, binding.Id).Error)
	require.True(t, updated.CancelAtPeriodEnd)
}

func TestStripeSubscriptionWebhookDeletedTerminatesBinding(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	binding := insertStripeFulfillmentSubscriptionBinding(t, 704, "sub_webhook_deleted", "active", false)
	event := stripe.Event{
		ID:   "evt_subscription_deleted",
		Type: stripe.EventTypeCustomerSubscriptionDeleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":                   "sub_webhook_deleted",
			"customer":             "cus_subscription",
			"status":               "canceled",
			"current_period_start": float64(1000),
			"current_period_end":   float64(2000),
			"ended_at":             float64(1500),
		}},
	}

	require.NoError(t, handleStripeSubscriptionDeleted(context.Background(), event))

	var updated model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updated, binding.Id).Error)
	require.Equal(t, "canceled", updated.ProviderStatus)
	var sub model.UserSubscription
	require.NoError(t, model.DB.Where("provider_binding_id = ?", binding.Id).First(&sub).Error)
	require.Equal(t, "cancelled", sub.Status)
}

func TestStripeSubscriptionWebhookDeletedUsesItemCurrentPeriod(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	binding := insertStripeFulfillmentSubscriptionBinding(t, 705, "sub_webhook_deleted_v86", "active", false)
	event := stripe.Event{
		ID:   "evt_subscription_deleted_v86",
		Type: stripe.EventTypeCustomerSubscriptionDeleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":       "sub_webhook_deleted_v86",
			"customer": "cus_subscription",
			"status":   "canceled",
			"ended_at": float64(2500),
			"items": map[string]interface{}{
				"data": []interface{}{
					map[string]interface{}{
						"id":                   "si_deleted_v86",
						"current_period_start": float64(3000),
						"current_period_end":   float64(4000),
					},
				},
			},
		}},
	}

	require.NoError(t, handleStripeSubscriptionDeleted(context.Background(), event))

	var updated model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updated, binding.Id).Error)
	require.Equal(t, int64(3000), updated.CurrentPeriodStart)
	require.Equal(t, int64(4000), updated.CurrentPeriodEnd)
}

func TestStripeSubscriptionWebhookAcknowledgesUnrelatedSignedEvent(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	confirmPaymentComplianceForTest(t)
	originalSecret := setting.StripeWebhookSecret
	originalSnapshot := stripeSubscriptionSnapshotFromSubscriptionEvent
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalSecret
		stripeSubscriptionSnapshotFromSubscriptionEvent = originalSnapshot
	})
	setting.StripeWebhookSecret = "whsec_test_subscription_unrelated"
	stripeSubscriptionSnapshotFromSubscriptionEvent = func(event stripe.Event) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: "sub_unrelated",
			ProviderStatus:         "active",
		}, nil
	}
	payload := []byte(`{
		"id": "evt_subscription_unrelated",
		"object": "event",
		"type": "customer.subscription.updated",
		"data": {
			"object": {
				"id": "sub_unrelated",
				"object": "subscription"
			}
		}
	}`)

	recorder := performSignedStripeWebhookRequest(t, payload, setting.StripeWebhookSecret)

	require.Equal(t, http.StatusOK, recorder.Code)
}

func TestStripeSubscriptionWebhookNewAPIMetadataMissingOrderRetries(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	confirmPaymentComplianceForTest(t)
	originalSecret := setting.StripeWebhookSecret
	originalSnapshot := stripeSubscriptionSnapshotFromSubscriptionEvent
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalSecret
		stripeSubscriptionSnapshotFromSubscriptionEvent = originalSnapshot
	})
	setting.StripeWebhookSecret = "whsec_test_subscription_missing_order"
	stripeSubscriptionSnapshotFromSubscriptionEvent = func(event stripe.Event) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: "sub_missing_order",
			ProviderCustomerId:     "cus_subscription",
			ProviderPriceId:        "price_subscription",
			ProviderStatus:         "active",
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       2000,
		}, nil
	}
	payload := []byte(`{
		"id": "evt_subscription_missing_order",
		"object": "event",
		"type": "customer.subscription.updated",
		"data": {
			"object": {
				"id": "sub_missing_order",
				"object": "subscription",
				"metadata": {
					"newapi_trade_no": "missing_subscription_order",
					"newapi_user_id": "705",
					"newapi_plan_id": "1505"
				}
			}
		}
	}`)

	recorder := performSignedStripeWebhookRequest(t, payload, setting.StripeWebhookSecret)

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
}

func TestStripeSubscriptionWebhookUpdatedDoesNotReviveDeletedBinding(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	binding := insertStripeFulfillmentSubscriptionBinding(t, 706, "sub_late_update", "active", false)
	deletedEvent := stripe.Event{
		ID:   "evt_subscription_deleted_before_update",
		Type: stripe.EventTypeCustomerSubscriptionDeleted,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id":     "sub_late_update",
			"status": "canceled",
		}},
	}
	require.NoError(t, handleStripeSubscriptionDeleted(context.Background(), deletedEvent))

	originalSnapshot := stripeSubscriptionSnapshotFromSubscriptionEvent
	t.Cleanup(func() { stripeSubscriptionSnapshotFromSubscriptionEvent = originalSnapshot })
	var calls int
	stripeSubscriptionSnapshotFromSubscriptionEvent = func(event stripe.Event) (model.ProviderSubscriptionSnapshot, error) {
		calls++
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: "sub_late_update",
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     1000,
			CurrentPeriodEnd:       3000,
		}, nil
	}
	updatedEvent := stripe.Event{
		ID:   "evt_subscription_late_update",
		Type: stripe.EventTypeCustomerSubscriptionUpdated,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"id": "sub_late_update",
		}},
	}

	require.NoError(t, handleStripeSubscriptionUpdated(context.Background(), updatedEvent))

	require.Equal(t, 1, calls)
	var updated model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updated, binding.Id).Error)
	require.Equal(t, "canceled", updated.ProviderStatus)
	require.Greater(t, updated.EndedAt, int64(0))
}

func performSignedStripeWebhookRequest(t *testing.T, payload []byte, secret string) *httptest.ResponseRecorder {
	t.Helper()
	signedPayload := stripewebhook.GenerateTestSignedPayload(&stripewebhook.UnsignedPayload{
		Payload: payload,
		Secret:  secret,
	})
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/stripe/webhook", bytes.NewReader(signedPayload.Payload))
	ctx.Request.Header.Set("Stripe-Signature", signedPayload.Header)
	StripeWebhook(ctx)
	return recorder
}

func insertStripeFulfillmentUser(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "stripe_contract_guard",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}).Error)
}

func stripeFulfillmentUserQuota(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", id).First(&user).Error)
	return user.Quota
}

func TestValidateStripeRedirectURLAllowsSameRequestHost(t *testing.T) {
	originalDomains := constant.TrustedRedirectDomains
	t.Cleanup(func() {
		constant.TrustedRedirectDomains = originalDomains
	})
	constant.TrustedRedirectDomains = nil

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "https://flatkey.ai/api/user/stripe/pay", nil)

	require.NoError(t, validateStripeRedirectURL(ctx, "https://flatkey.ai/wallet?show_history=true"))
	require.Error(t, validateStripeRedirectURL(ctx, "https://evil.example/wallet"))
}

func TestValidateStripeRedirectURLAllowsForwardedAndOriginHosts(t *testing.T) {
	originalDomains := constant.TrustedRedirectDomains
	t.Cleanup(func() {
		constant.TrustedRedirectDomains = originalDomains
	})
	constant.TrustedRedirectDomains = nil

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "https://router.flatkey.ai/api/user/stripe/pay", nil)
	ctx.Request.Header.Set("Origin", "https://flatkey.ai")
	ctx.Request.Header.Set("X-Forwarded-Host", "flatkey.ai")

	require.NoError(t, validateStripeRedirectURL(ctx, "https://flatkey.ai/wallet?show_history=true"))
	require.NoError(t, validateStripeRedirectURL(ctx, "https://router.flatkey.ai/wallet"))
	require.Error(t, validateStripeRedirectURL(ctx, "https://evil.example/wallet"))
}

func TestGetStripePayMoneyIgnoresRechargeGroupAndDiscount(t *testing.T) {
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	originalUnitPrice := setting.StripeUnitPrice
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()
	paymentSetting := operation_setting.GetPaymentSetting()
	originalDiscounts := make(map[int]float64, len(paymentSetting.AmountDiscount))
	for key, value := range paymentSetting.AmountDiscount {
		originalDiscounts[key] = value
	}
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		setting.StripeUnitPrice = originalUnitPrice
		_ = common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio)
		paymentSetting.AmountDiscount = originalDiscounts
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	setting.StripeUnitPrice = 2
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"vip":1.5}`))
	paymentSetting.AmountDiscount = map[int]float64{int(2 * common.QuotaPerUnit): 0.5}

	require.Equal(t, 4.0, getStripePayMoney(2*common.QuotaPerUnit, "vip"))
}

func TestMapStripeInvoiceStatusUsesLocalStatuses(t *testing.T) {
	require.Equal(t, model.PaymentInvoiceStatusPaid, mapStripeInvoiceStatus(stripe.InvoiceStatusPaid))
	require.Equal(t, model.PaymentInvoiceStatusPending, mapStripeInvoiceStatus(stripe.InvoiceStatusOpen))
	require.Equal(t, model.PaymentInvoiceStatusPending, mapStripeInvoiceStatus(stripe.InvoiceStatusDraft))
	require.Equal(t, model.PaymentInvoiceStatusFailed, mapStripeInvoiceStatus(stripe.InvoiceStatusVoid))
	require.Equal(t, model.PaymentInvoiceStatusFailed, mapStripeInvoiceStatus(stripe.InvoiceStatusUncollectible))
	require.Equal(t, model.PaymentInvoiceStatusPending, mapStripeInvoiceStatus(stripe.InvoiceStatus("")))
}

func TestValidateInvoiceProfileNormalizesAndReturnsTranslationKeys(t *testing.T) {
	fields, err := validateInvoiceProfile(model.InvoiceProfileFields{
		CompanyName:  " Acme Inc ",
		BillingEmail: " request@example.com ",
		TaxIDType:    " EU_VAT ",
		Country:      " us ",
		AddressLine1: " 1 Main St ",
	})
	require.NoError(t, err)
	require.Equal(t, "Acme Inc", fields.CompanyName)
	require.Empty(t, fields.BillingEmail)
	require.Equal(t, "eu_vat", fields.TaxIDType)
	require.Equal(t, "US", fields.Country)
	require.Equal(t, "1 Main St", fields.AddressLine1)

	_, err = validateInvoiceProfile(model.InvoiceProfileFields{
		Country:      "US",
		AddressLine1: "1 Main St",
	})
	require.EqualError(t, err, "Company name is required")

	fields, err = validateInvoiceProfile(model.InvoiceProfileFields{
		CompanyName:  "Acme Inc",
		Country:      "US",
		AddressLine1: "1 Main St",
	})
	require.NoError(t, err)
	require.Empty(t, fields.BillingEmail)
}

func TestStripeCustomerParamsForInvoiceUsesAccountEmail(t *testing.T) {
	params := stripeCustomerParamsForInvoice(&model.User{Email: " account@example.com "}, model.InvoiceProfileFields{
		CompanyName:  "Acme Inc",
		BillingEmail: "request@example.com",
		Country:      "US",
		AddressLine1: "1 Main St",
	})

	require.NotNil(t, params.Email)
	require.Equal(t, "account@example.com", *params.Email)
	require.Equal(t, "account@example.com", params.Metadata["user_email"])
}

func TestStripeInvoiceProfileForUserRequiresAccountEmail(t *testing.T) {
	_, err := stripeInvoiceProfileForUser(model.InvoiceProfileFields{
		CompanyName:  "Acme Inc",
		Country:      "US",
		AddressLine1: "1 Main St",
	}, &model.User{})

	require.EqualError(t, err, invoiceAccountEmailRequired)
}

func TestStripeInvoiceProfileForUserInjectsAccountEmail(t *testing.T) {
	fields, err := stripeInvoiceProfileForUser(model.InvoiceProfileFields{
		CompanyName:  "Acme Inc",
		BillingEmail: "request@example.com",
		Country:      "US",
		AddressLine1: "1 Main St",
	}, &model.User{Email: " account@example.com "})

	require.NoError(t, err)
	require.Equal(t, "account@example.com", fields.BillingEmail)
}
