package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
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
	"github.com/stripe/stripe-go/v81"
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
		"https://example.com/success",
		"https://example.com/cancel",
		false,
		false,
	)

	require.NotNil(t, params.CustomerEmail)
	require.Equal(t, "buyer+location_JP@example.com", *params.CustomerEmail)
	require.NotNil(t, params.AllowPromotionCodes)
	require.True(t, *params.AllowPromotionCodes)
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
	assert.Contains(t, alerts[0].Error, "price mismatch")

	reloaded := model.GetTopUpByTradeNo("ref_stripe_contract_alert")
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusPending, reloaded.Status)
	assert.Equal(t, 0, stripeFulfillmentUserQuota(t, 903))
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
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
	})
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.TopUp{},
		&model.TopUpBonusClaim{},
		&model.Log{},
		&model.PaymentInvoice{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
	))
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

func TestGetStripePayMoneyAppliesDisplayGroupAndDiscount(t *testing.T) {
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

	require.Equal(t, 3.0, getStripePayMoney(2*common.QuotaPerUnit, "vip"))
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
