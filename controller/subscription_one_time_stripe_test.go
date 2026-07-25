package controller

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func oneTimeStripeOrderForTest(method string, currency string, amountMinor int64, months int) *model.SubscriptionOrder {
	if months <= 0 {
		months = 1
	}
	snapshot := `{"plan_id":901,"title":"Pro Local","price_amount":12.34,"currency":"` + currency + `","duration_unit":"month","duration_value":1,"total_amount":1234}`
	return &model.SubscriptionOrder{
		UserId:             501,
		PlanId:             901,
		Money:              float64(amountMinor) / 100,
		TradeNo:            "sub_one_time_" + method + "_" + strings.ToLower(currency),
		PaymentMethod:      method,
		PaymentProvider:    model.PaymentProviderStripe,
		Status:             common.TopUpStatusPending,
		CreateTime:         time.Now().Unix(),
		PurchaseMonths:     months,
		UnitPrice:          12.34,
		PaymentCurrency:    currency,
		PaymentAmountMinor: amountMinor,
		PlanSnapshot:       snapshot,
		PurchaseIntent:     model.SubscriptionChangeIntentKindPurchase,
		ProviderPayload:    "choice=" + method + ";months=" + strconv.Itoa(months) + ";contract_id=701;change_intent_id=801",
		ChangeIntentId:     801,
	}
}

func TestBuildOneTimePlanCheckoutUsesPaymentModeAndRequestedMethod(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceAlipay, "USD", 2468, 2)

	params, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501, Email: "buyer@example.com"})

	require.NoError(t, err)
	require.NotNil(t, params.Mode)
	require.Equal(t, string(stripe.CheckoutSessionModePayment), *params.Mode)
	require.Equal(t, []string{string(stripe.PaymentMethodTypeAlipay)}, stripeStringSliceValues(params.PaymentMethodTypes))
	require.NotNil(t, params.ClientReferenceID)
	require.Equal(t, order.TradeNo, *params.ClientReferenceID)
	require.Equal(t, order.TradeNo, params.Metadata["trade_no"])
	require.Equal(t, "purchase", params.Metadata["purchase_intent"])
	require.Equal(t, "2", params.Metadata["purchase_months"])
}

func TestBuildOneTimePlanCheckoutUsesQuantityOneAndFullOrderAmount(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceAlipay, "USD", 3702, 3)

	params, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501, Email: "buyer@example.com"})

	require.NoError(t, err)
	require.Len(t, params.LineItems, 1)
	item := params.LineItems[0]
	require.NotNil(t, item.Quantity)
	require.EqualValues(t, 1, *item.Quantity)
	require.NotNil(t, item.PriceData)
	require.NotNil(t, item.PriceData.UnitAmount)
	require.EqualValues(t, 3702, *item.PriceData.UnitAmount)
	require.NotNil(t, item.PriceData.Currency)
	require.Equal(t, "usd", *item.PriceData.Currency)
	require.NotNil(t, item.PriceData.ProductData)
	require.Contains(t, *item.PriceData.ProductData.Name, "Pro Local")
}

func TestBuildOneTimePlanCheckoutEmbeddedUsesReturnURLWithoutHostedURLs(t *testing.T) {
	originalPublishableKey := setting.StripePublishableKey
	setting.StripePublishableKey = "pk_test_embedded"
	t.Cleanup(func() { setting.StripePublishableKey = originalPublishableKey })
	presentation := service.ResolveStripeCheckoutPresentation("embedded")

	testCases := []struct {
		name        string
		method      string
		currency    string
		amountMinor int64
		stripeType  stripe.PaymentMethodType
	}{
		{
			name:        "alipay-usd",
			method:      service.SubscriptionPaymentChoiceAlipay,
			currency:    "USD",
			amountMinor: 2468,
			stripeType:  stripe.PaymentMethodTypeAlipay,
		},
		{
			name:        "pix-brl",
			method:      service.SubscriptionPaymentChoicePix,
			currency:    "BRL",
			amountMinor: 4990,
			stripeType:  stripe.PaymentMethodTypePix,
		},
		{
			name:        "upi-inr",
			method:      service.SubscriptionPaymentChoiceUPI,
			currency:    "INR",
			amountMinor: 89900,
			stripeType:  stripe.PaymentMethodTypeUpi,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			order := oneTimeStripeOrderForTest(tc.method, tc.currency, tc.amountMinor, 2)

			params, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501, Email: "buyer@example.com"}, presentation)

			require.NoError(t, err)
			require.NotNil(t, params.UIMode)
			require.Equal(t, string(stripe.CheckoutSessionUIModeEmbeddedPage), *params.UIMode)
			require.Nil(t, params.SuccessURL)
			require.Nil(t, params.CancelURL)
			require.NotNil(t, params.ReturnURL)
			require.Contains(t, *params.ReturnURL, "session_id={CHECKOUT_SESSION_ID}")
			require.Contains(t, *params.ReturnURL, "trade_no="+order.TradeNo)
			require.Equal(t, []string{string(tc.stripeType)}, stripeStringSliceValues(params.PaymentMethodTypes))
			require.Len(t, params.LineItems, 1)
			require.Equal(t, strings.ToLower(tc.currency), *params.LineItems[0].PriceData.Currency)
			require.Equal(t, tc.amountMinor, *params.LineItems[0].PriceData.UnitAmount)
		})
	}
}

func TestOneTimePlanCheckoutRejectsPixOutsideBRL(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "USD", 1234, 1)

	_, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501})

	require.Error(t, err)
	require.Contains(t, err.Error(), "Pix requires BRL")
}

func TestOneTimePlanCheckoutRejectsUPIOutsideINR(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceUPI, "USD", 1234, 1)

	_, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501})

	require.Error(t, err)
	require.Contains(t, err.Error(), "UPI requires INR")
}

func TestOneTimePlanCheckoutDoesNotSilentlyFallbackToCard(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceUPI, "INR", 89900, 1)

	params, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501})

	require.NoError(t, err)
	require.Equal(t, []string{string(stripe.PaymentMethodTypeUpi)}, stripeStringSliceValues(params.PaymentMethodTypes))
	require.NotContains(t, stripeStringSliceValues(params.PaymentMethodTypes), "card")
}

func TestOneTimePlanCheckoutRejectsMissingQuote(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "", 0, 1)

	_, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501})

	require.Error(t, err)
	require.Contains(t, err.Error(), "quote is unavailable")
}

func TestOneTimePlanWebhookRejectsAmountCurrencySessionAndMethodMismatch(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.ProviderSessionId = "cs_expected"

	testCases := []struct {
		name   string
		mutate func(map[string]interface{})
		want   string
	}{
		{name: "amount", mutate: func(object map[string]interface{}) { object["amount_total"] = float64(3990) }, want: "amount mismatch"},
		{name: "currency", mutate: func(object map[string]interface{}) { object["currency"] = "usd" }, want: "currency mismatch"},
		{name: "session", mutate: func(object map[string]interface{}) { object["id"] = "cs_other" }, want: "session mismatch"},
		{name: "method", mutate: func(object map[string]interface{}) { object["payment_method_types"] = []interface{}{"card"} }, want: "payment method mismatch"},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			object := oneTimeStripePaidSessionObject(order)
			tc.mutate(object)
			err := validateOneTimePlanStripeSessionEvent(stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: object}}, order)

			require.Error(t, err)
			require.Contains(t, err.Error(), tc.want)
		})
	}
}

func TestOneTimePlanWebhookRequiresCheckoutMetadata(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.ProviderSessionId = "cs_expected"
	object := oneTimeStripePaidSessionObject(order)
	object["metadata"] = map[string]interface{}{
		"trade_no":       order.TradeNo,
		"user_id":        strconv.Itoa(order.UserId),
		"plan_id":        strconv.Itoa(order.PlanId),
		"payment_method": order.PaymentMethod,
	}

	err := validateOneTimePlanStripeSessionEvent(stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: object}}, order)

	require.Error(t, err)
	require.Contains(t, err.Error(), "metadata change_intent_id")
}

func TestOneTimePlanWebhookReplayFulfillsOnce(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	insertStripeFulfillmentUser(t, 501)
	insertStripeFulfillmentSubscriptionPlan(t, 901)
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.ProviderSessionId = "cs_one_time_replay"
	require.NoError(t, model.DB.Create(order).Error)
	originalFulfill := fulfillOneTimeStripeSubscriptionPurchase
	t.Cleanup(func() { fulfillOneTimeStripeSubscriptionPurchase = originalFulfill })
	calls := 0
	fulfillOneTimeStripeSubscriptionPurchase = func(ctx context.Context, tradeNo string, providerPayload string) (*service.PurchaseSubscriptionResult, error) {
		calls++
		require.Equal(t, order.TradeNo, tradeNo)
		require.Contains(t, providerPayload, "cs_one_time_replay")
		return &service.PurchaseSubscriptionResult{}, nil
	}

	event := stripe.Event{ID: "evt_one_time_replay", Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: oneTimeStripePaidSessionObject(order)}}
	require.NoError(t, handleStripeOneTimePlanPaid(context.Background(), event, order.TradeNo, "127.0.0.1"))
	require.NoError(t, handleStripeOneTimePlanPaid(context.Background(), event, order.TradeNo, "127.0.0.1"))

	require.Equal(t, 1, calls)
}

func TestOneTimePlanAsyncPaymentSucceededFulfillsPendingOrder(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	insertStripeFulfillmentUser(t, 502)
	insertStripeFulfillmentSubscriptionPlan(t, 902)
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceUPI, "INR", 89900, 1)
	order.UserId = 502
	order.PlanId = 902
	order.TradeNo = "sub_one_time_async_success"
	order.ProviderSessionId = "cs_one_time_async_success"
	require.NoError(t, model.DB.Create(order).Error)
	originalFulfill := fulfillOneTimeStripeSubscriptionPurchase
	t.Cleanup(func() { fulfillOneTimeStripeSubscriptionPurchase = originalFulfill })
	called := false
	fulfillOneTimeStripeSubscriptionPurchase = func(ctx context.Context, tradeNo string, providerPayload string) (*service.PurchaseSubscriptionResult, error) {
		called = true
		require.Equal(t, order.TradeNo, tradeNo)
		return &service.PurchaseSubscriptionResult{}, nil
	}

	event := stripe.Event{ID: "evt_one_time_async_success", Type: stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded, Data: &stripe.EventData{Object: oneTimeStripePaidSessionObject(order)}}

	require.NoError(t, sessionAsyncPaymentSucceeded(context.Background(), event, "127.0.0.1"))
	require.True(t, called)
}

func TestOneTimePlanTerminalCheckoutMarksPendingOrder(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.UserSubscriptionContract{}, &model.SubscriptionChangeIntent{}))
	insertStripeFulfillmentUser(t, 503)
	insertStripeFulfillmentSubscriptionPlan(t, 903)
	contract := model.UserSubscriptionContract{
		UserId: 503,
		Status: model.SubscriptionContractStatusEnded,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		Id:         801,
		ContractId: contract.Id,
		UserId:     503,
		Kind:       model.SubscriptionChangeIntentKindPurchase,
		Status:     model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:   903,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("latest_change_intent_id", intent.Id).Error)
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.UserId = 503
	order.PlanId = 903
	order.TradeNo = "sub_one_time_terminal"
	order.ProviderSessionId = "cs_one_time_terminal"
	require.NoError(t, model.DB.Create(order).Error)

	expired := stripe.Event{ID: "evt_one_time_expired", Type: stripe.EventTypeCheckoutSessionExpired, Data: &stripe.EventData{Object: map[string]interface{}{
		"id":                  "cs_one_time_terminal",
		"mode":                string(stripe.CheckoutSessionModePayment),
		"status":              "expired",
		"client_reference_id": order.TradeNo,
	}}}
	require.NoError(t, sessionExpired(context.Background(), expired))
	var reloaded model.SubscriptionOrder
	require.NoError(t, model.DB.First(&reloaded, "trade_no = ?", order.TradeNo).Error)
	require.Equal(t, common.TopUpStatusExpired, reloaded.Status)

	order2 := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceUPI, "INR", 89900, 1)
	order2.UserId = 503
	order2.PlanId = 903
	order2.TradeNo = "sub_one_time_failed"
	order2.ProviderSessionId = "cs_one_time_failed"
	order2.ChangeIntentId = 801
	require.NoError(t, model.DB.Create(order2).Error)
	failed := stripe.Event{ID: "evt_one_time_failed", Type: stripe.EventTypeCheckoutSessionAsyncPaymentFailed, Data: &stripe.EventData{Object: map[string]interface{}{
		"id":                  "cs_one_time_failed",
		"mode":                string(stripe.CheckoutSessionModePayment),
		"client_reference_id": order2.TradeNo,
	}}}
	require.NoError(t, sessionAsyncPaymentFailed(context.Background(), failed, "127.0.0.1"))
	reloaded = model.SubscriptionOrder{}
	require.NoError(t, model.DB.First(&reloaded, "trade_no = ?", order2.TradeNo).Error)
	require.Equal(t, common.TopUpStatusFailed, reloaded.Status)
}

func TestOneTimePlanPaidWebhookReturnsPermanentErrorForValidationMismatch(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	insertStripeFulfillmentUser(t, 504)
	insertStripeFulfillmentSubscriptionPlan(t, 904)
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.UserId = 504
	order.PlanId = 904
	order.TradeNo = "sub_one_time_permanent"
	order.ProviderSessionId = "cs_one_time_permanent"
	require.NoError(t, model.DB.Create(order).Error)
	originalFulfill := fulfillOneTimeStripeSubscriptionPurchase
	t.Cleanup(func() { fulfillOneTimeStripeSubscriptionPurchase = originalFulfill })
	fulfillOneTimeStripeSubscriptionPurchase = func(ctx context.Context, tradeNo string, providerPayload string) (*service.PurchaseSubscriptionResult, error) {
		return nil, errors.New("must not fulfill mismatched event")
	}
	object := oneTimeStripePaidSessionObject(order)
	object["amount_total"] = float64(3990)

	err := handleStripeOneTimePlanPaid(context.Background(), stripe.Event{ID: "evt_one_time_permanent", Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: object}}, order.TradeNo, "127.0.0.1")

	require.Error(t, err)
	require.False(t, isRetryableStripeWebhookProcessingError(err))
}

func TestOneTimePlanPaidWebhookDoesNotFulfillSupersededCheckout(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.UserSubscriptionContract{}, &model.SubscriptionChangeIntent{}))
	insertStripeFulfillmentUser(t, 505)
	insertStripeFulfillmentSubscriptionPlan(t, 905)
	contract := model.UserSubscriptionContract{
		UserId:      505,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModePrepaid,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:     contract.Id,
		UserId:         505,
		RequestId:      "superseded-one-time",
		Kind:           model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:    model.SubscriptionPaymentModePrepaid,
		Status:         model.SubscriptionChangeIntentStatusSuperseded,
		ToPlanId:       905,
		SupersededById: 999,
		ChangeVersion:  1,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.UserId = 505
	order.PlanId = 905
	order.TradeNo = "sub_one_time_superseded"
	order.ProviderSessionId = "cs_one_time_superseded"
	order.ChangeIntentId = intent.Id
	order.Status = common.TopUpStatusExpired
	require.NoError(t, model.DB.Create(order).Error)
	originalFulfill := fulfillOneTimeStripeSubscriptionPurchase
	t.Cleanup(func() { fulfillOneTimeStripeSubscriptionPurchase = originalFulfill })
	fulfillCalls := 0
	fulfillOneTimeStripeSubscriptionPurchase = func(ctx context.Context, tradeNo string, providerPayload string) (*service.PurchaseSubscriptionResult, error) {
		fulfillCalls++
		return &service.PurchaseSubscriptionResult{}, nil
	}

	err := handleStripeOneTimePlanPaid(
		context.Background(),
		stripe.Event{ID: "evt_one_time_superseded", Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: oneTimeStripePaidSessionObject(order)}},
		order.TradeNo,
		"127.0.0.1",
	)

	require.NoError(t, err)
	require.Zero(t, fulfillCalls)
}

func oneTimeStripePaidSessionObject(order *model.SubscriptionOrder) map[string]interface{} {
	quote, _ := oneTimePlanQuoteFromOrder(order)
	return map[string]interface{}{
		"id":                   order.ProviderSessionId,
		"mode":                 string(stripe.CheckoutSessionModePayment),
		"status":               "complete",
		"payment_status":       "paid",
		"client_reference_id":  order.TradeNo,
		"amount_total":         float64(quote.TotalAmountMinor),
		"currency":             strings.ToLower(quote.Currency),
		"livemode":             false,
		"payment_method_types": []interface{}{order.PaymentMethod},
		"metadata": map[string]interface{}{
			"trade_no":         order.TradeNo,
			"user_id":          strconv.Itoa(order.UserId),
			"plan_id":          strconv.Itoa(order.PlanId),
			"change_intent_id": strconv.FormatInt(order.ChangeIntentId, 10),
			"purchase_intent":  order.PurchaseIntent,
			"payment_method":   order.PaymentMethod,
			"purchase_months":  strconv.Itoa(order.PurchaseMonths),
		},
	}
}

func stripeStringSliceValues(values []*string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value != nil {
			out = append(out, *value)
		}
	}
	return out
}
