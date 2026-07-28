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

func TestBuildOneTimePlanCheckoutRecallMetadataUsesDiscountedOrderWithoutRawClaim(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceAlipay, "USD", 280, 3)
	order.RecallCampaignId = 41
	order.RecallRecipientId = 82
	order.RecallPromotionCodeId = "promo_local"
	order.RecallDiscountAmountMinor = 20

	params, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501, Email: "buyer@example.com"})

	require.NoError(t, err)
	require.EqualValues(t, 300, *params.LineItems[0].PriceData.UnitAmount)
	require.Len(t, params.Discounts, 1)
	require.NotNil(t, params.Discounts[0].PromotionCode)
	require.Equal(t, "promo_local", *params.Discounts[0].PromotionCode)
	require.Equal(t, "41", params.Metadata["recall_campaign_id"])
	require.Equal(t, "82", params.Metadata["recall_recipient_id"])
	require.Equal(t, "promo_local", params.Metadata["recall_promotion_code_id"])
	require.Equal(t, "20", params.Metadata["recall_discount_amount_minor"])
	require.Equal(t, params.Metadata, params.PaymentIntentData.Metadata)
	for key, value := range params.Metadata {
		require.NotContains(t, strings.ToLower(key), "claim")
		require.NotContains(t, strings.ToLower(value), "claim")
		require.NotContains(t, value, "FKSECRET234")
	}
}

func TestBuildOneTimePlanCheckoutFullyDiscountedRecallUsesOriginalAmountAndPromotion(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceAlipay, "USD", 0, 1)
	order.RecallCampaignId = 41
	order.RecallRecipientId = 82
	order.RecallPromotionCodeId = "promo_full_discount"
	order.RecallDiscountAmountMinor = 1234

	params, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501, Email: "buyer@example.com"})

	require.NoError(t, err)
	require.EqualValues(t, 1234, *params.LineItems[0].PriceData.UnitAmount)
	require.Len(t, params.Discounts, 1)
	require.NotNil(t, params.Discounts[0].PromotionCode)
	require.Equal(t, "promo_full_discount", *params.Discounts[0].PromotionCode)
}

func TestBuildOneTimePlanCheckoutRejectsIncompleteRecallAttributionTuple(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(*model.SubscriptionOrder)
	}{
		{name: "discount missing campaign", mutate: func(order *model.SubscriptionOrder) {
			order.RecallRecipientId = 82
			order.RecallPromotionCodeId = "promo_local"
			order.RecallDiscountAmountMinor = 20
		}},
		{name: "discount missing recipient", mutate: func(order *model.SubscriptionOrder) {
			order.RecallCampaignId = 41
			order.RecallPromotionCodeId = "promo_local"
			order.RecallDiscountAmountMinor = 20
		}},
		{name: "discount missing promotion", mutate: func(order *model.SubscriptionOrder) {
			order.RecallCampaignId = 41
			order.RecallRecipientId = 82
			order.RecallDiscountAmountMinor = 20
		}},
		{name: "zero discount with campaign", mutate: func(order *model.SubscriptionOrder) {
			order.RecallCampaignId = 41
		}},
		{name: "zero discount with recipient", mutate: func(order *model.SubscriptionOrder) {
			order.RecallRecipientId = 82
		}},
		{name: "zero discount with promotion", mutate: func(order *model.SubscriptionOrder) {
			order.RecallPromotionCodeId = "promo_local"
		}},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoiceAlipay, "USD", 280, 3)
			tc.mutate(order)

			_, err := buildOneTimePlanCheckoutSessionParams(order, &model.User{Id: 501, Email: "buyer@example.com"})

			require.Error(t, err)
			require.Contains(t, err.Error(), "recall attribution tuple")
		})
	}
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

func TestOneTimePlanWebhookRequiresRecallMetadataForDiscountedOrder(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.ProviderSessionId = "cs_expected"
	order.RecallCampaignId = 41
	order.RecallRecipientId = 82
	order.RecallPromotionCodeId = "promo_local"
	order.RecallDiscountAmountMinor = 20
	object := oneTimeStripePaidSessionObject(order)
	metadata := object["metadata"].(map[string]interface{})
	delete(metadata, "recall_campaign_id")

	err := validateOneTimePlanStripeSessionEvent(stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: object}}, order)

	require.Error(t, err)
	require.Contains(t, err.Error(), "metadata recall_campaign_id")

	object = oneTimeStripePaidSessionObject(order)
	object["metadata"].(map[string]interface{})["recall_discount_amount_minor"] = "21"
	err = validateOneTimePlanStripeSessionEvent(stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: object}}, order)
	require.Error(t, err)
	require.Contains(t, err.Error(), "metadata recall_discount_amount_minor")
}

func TestOneTimePlanWebhookRejectsRecallMetadataForUndiscountedOrder(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.ProviderSessionId = "cs_expected"
	object := oneTimeStripePaidSessionObject(order)
	object["metadata"].(map[string]interface{})["recall_campaign_id"] = "41"

	err := validateOneTimePlanStripeSessionEvent(stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: object}}, order)

	require.Error(t, err)
	require.Contains(t, err.Error(), "metadata recall_campaign_id")
}

func TestOneTimePlanPaidWebhookDoesNotFulfillRecallMetadataMismatch(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	insertStripeFulfillmentUser(t, 506)
	insertStripeFulfillmentSubscriptionPlan(t, 906)
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.UserId = 506
	order.PlanId = 906
	order.TradeNo = "sub_one_time_recall_metadata_mismatch"
	order.ProviderSessionId = "cs_one_time_recall_metadata_mismatch"
	order.RecallCampaignId = 41
	order.RecallRecipientId = 82
	order.RecallPromotionCodeId = "promo_local"
	order.RecallDiscountAmountMinor = 20
	require.NoError(t, model.DB.Create(order).Error)
	originalFulfill := fulfillOneTimeStripeSubscriptionPurchase
	t.Cleanup(func() { fulfillOneTimeStripeSubscriptionPurchase = originalFulfill })
	fulfillCalls := 0
	fulfillOneTimeStripeSubscriptionPurchase = func(ctx context.Context, tradeNo string, providerPayload string) (*service.PurchaseSubscriptionResult, error) {
		fulfillCalls++
		return &service.PurchaseSubscriptionResult{}, nil
	}
	object := oneTimeStripePaidSessionObject(order)
	object["metadata"].(map[string]interface{})["recall_recipient_id"] = "83"

	err := handleStripeOneTimePlanPaid(context.Background(), stripe.Event{ID: "evt_one_time_recall_metadata_mismatch", Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Object: object}}, order.TradeNo, "127.0.0.1")

	require.Error(t, err)
	require.False(t, isRetryableStripeWebhookProcessingError(err))
	require.Zero(t, fulfillCalls)
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

func TestOneTimePlanStripeProviderPayloadUsesCanonicalCheckoutSessionID(t *testing.T) {
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.ProviderSessionId = "cs_one_time_payload"
	payload := oneTimePlanStripeProviderPayload(stripe.Event{
		ID:   "evt_one_time_payload",
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{Object: oneTimeStripePaidSessionObject(order)},
	})

	require.Contains(t, payload, `"checkout_session_id":"cs_one_time_payload"`)
	require.NotContains(t, payload, `"session_id"`)
}

func TestOneTimePlanPaidWebhookRetriesRecallAttributionAfterFulfillment(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
		&model.SubscriptionTermSegment{},
		&model.WalletLedgerEntry{},
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
	))
	insertStripeFulfillmentUser(t, 508)
	insertStripeFulfillmentSubscriptionPlan(t, 908)
	contract := model.UserSubscriptionContract{
		UserId:      508,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModePrepaid,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:  contract.Id,
		UserId:      508,
		RequestId:   "one-time-recall-retry",
		Kind:        model.SubscriptionChangeIntentKindPurchase,
		PaymentMode: model.SubscriptionPaymentModePrepaid,
		Status:      model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:    908,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("latest_change_intent_id", intent.Id).Error)
	_, recipient := createStripeWebhookRecallRecipient(t, 508, "promo_one_time_retry")
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.UserId = 508
	order.PlanId = 908
	order.TradeNo = "sub_one_time_recall_retry"
	order.ProviderSessionId = "cs_one_time_recall_retry"
	order.ChangeIntentId = intent.Id
	order.PlanSnapshot = `{"plan_id":908,"title":"Stripe Subscription Plan","price_amount":9.99,"currency":"BRL","duration_unit":"month","duration_value":1,"total_amount":1000}`
	order.RecallCampaignId = recipient.CampaignId
	order.RecallRecipientId = recipient.Id
	order.RecallPromotionCodeId = "promo_one_time_retry"
	order.RecallDiscountAmountMinor = 200
	require.NoError(t, model.DB.Create(order).Error)
	fetchFails := true
	fetches := 0
	runtime := service.GetRecallRuntime()
	originalAttribution := runtime.Attribution
	runtime.Attribution = service.NewRecallAttributionService(&stripeWebhookRecallClient{getCheckoutSessionFn: func(_ context.Context, id string, _ ...string) (*stripe.CheckoutSession, error) {
		fetches++
		if fetchFails {
			return nil, errors.New("temporary recall attribution lookup failure")
		}
		return &stripe.CheckoutSession{
			ID: id, AmountTotal: 4790, Currency: stripe.CurrencyBRL,
			Discounts:    []*stripe.CheckoutSessionDiscount{{PromotionCode: &stripe.PromotionCode{ID: "promo_one_time_retry"}}},
			TotalDetails: &stripe.CheckoutSessionTotalDetails{AmountDiscount: 200},
		}, nil
	}})
	t.Cleanup(func() { runtime.Attribution = originalAttribution })
	event := stripeRecallWebhookEvent("evt_one_time_recall_retry", "cs_one_time_recall_retry", order.TradeNo, 4790, 200, recipient, true)
	event.Type = stripe.EventTypeCheckoutSessionCompleted
	event.Data.Object = oneTimeStripePaidSessionObject(order)

	err := handleStripeOneTimePlanPaid(context.Background(), event, order.TradeNo, "127.0.0.1")

	require.Error(t, err)
	require.True(t, isRetryableStripeWebhookProcessingError(err))
	require.Equal(t, 1, fetches)
	assertStripeWebhookRecipientNotConverted(t, recipient.Id)
	assertOneTimeRetryCounts(t, 508, order.TradeNo, common.TopUpStatusSuccess, 1, 1, 1, model.PaymentWebhookEventStatusFailed)

	fetchFails = false
	require.NoError(t, handleStripeOneTimePlanPaid(context.Background(), event, order.TradeNo, "127.0.0.1"))

	require.Equal(t, 2, fetches)
	assertStripeWebhookRecipientConverted(t, recipient.Id, order.TradeNo)
	assertOneTimeRetryCounts(t, 508, order.TradeNo, common.TopUpStatusSuccess, 1, 1, 1, model.PaymentWebhookEventStatusProcessed)
}

func TestOneTimePlanPaidWebhookAttributesRecallAfterFulfillment(t *testing.T) {
	setupStripeFulfillmentTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.RecallCampaign{}, &model.RecallRecipient{}, &model.RecallMessage{}, &model.RecallEvent{}))
	insertStripeFulfillmentUser(t, 507)
	insertStripeFulfillmentSubscriptionPlan(t, 907)
	_, recipient := createStripeWebhookRecallRecipient(t, 507, "promo_one_time_webhook")
	order := oneTimeStripeOrderForTest(service.SubscriptionPaymentChoicePix, "BRL", 4990, 1)
	order.UserId = 507
	order.PlanId = 907
	order.TradeNo = "sub_one_time_recall_attribute"
	order.ProviderSessionId = "cs_one_time_recall_attribute"
	order.RecallCampaignId = recipient.CampaignId
	order.RecallRecipientId = recipient.Id
	order.RecallPromotionCodeId = "promo_one_time_webhook"
	order.RecallDiscountAmountMinor = 200
	require.NoError(t, model.DB.Create(order).Error)
	originalFulfill := fulfillOneTimeStripeSubscriptionPurchase
	t.Cleanup(func() { fulfillOneTimeStripeSubscriptionPurchase = originalFulfill })
	fulfillOneTimeStripeSubscriptionPurchase = func(ctx context.Context, tradeNo string, providerPayload string) (*service.PurchaseSubscriptionResult, error) {
		require.Equal(t, order.TradeNo, tradeNo)
		return &service.PurchaseSubscriptionResult{}, nil
	}
	runtime := service.GetRecallRuntime()
	originalAttribution := runtime.Attribution
	runtime.Attribution = service.NewRecallAttributionService(&stripeWebhookRecallClient{getCheckoutSessionFn: func(_ context.Context, id string, _ ...string) (*stripe.CheckoutSession, error) {
		return &stripe.CheckoutSession{
			ID: id, AmountTotal: 4790, Currency: stripe.CurrencyBRL,
			Discounts:    []*stripe.CheckoutSessionDiscount{{PromotionCode: &stripe.PromotionCode{ID: "promo_one_time_webhook"}}},
			TotalDetails: &stripe.CheckoutSessionTotalDetails{AmountDiscount: 200},
		}, nil
	}})
	t.Cleanup(func() { runtime.Attribution = originalAttribution })
	event := stripeRecallWebhookEvent("evt_one_time_recall_attribute", "cs_one_time_recall_attribute", order.TradeNo, 4790, 200, recipient, true)
	event.Type = stripe.EventTypeCheckoutSessionCompleted
	event.Data.Object = oneTimeStripePaidSessionObject(order)

	require.NoError(t, handleStripeOneTimePlanPaid(context.Background(), event, order.TradeNo, "127.0.0.1"))

	assertStripeWebhookRecipientConverted(t, recipient.Id, order.TradeNo)
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
	metadata := map[string]interface{}{
		"trade_no":         order.TradeNo,
		"user_id":          strconv.Itoa(order.UserId),
		"plan_id":          strconv.Itoa(order.PlanId),
		"change_intent_id": strconv.FormatInt(order.ChangeIntentId, 10),
		"purchase_intent":  order.PurchaseIntent,
		"payment_method":   order.PaymentMethod,
		"purchase_months":  strconv.Itoa(order.PurchaseMonths),
	}
	if order.RecallDiscountAmountMinor > 0 {
		metadata["recall_campaign_id"] = strconv.FormatInt(order.RecallCampaignId, 10)
		metadata["recall_recipient_id"] = strconv.FormatInt(order.RecallRecipientId, 10)
		metadata["recall_promotion_code_id"] = strings.TrimSpace(order.RecallPromotionCodeId)
		metadata["recall_discount_amount_minor"] = strconv.FormatInt(order.RecallDiscountAmountMinor, 10)
	}
	return map[string]interface{}{
		"id":                   order.ProviderSessionId,
		"mode":                 string(stripe.CheckoutSessionModePayment),
		"status":               "complete",
		"payment_status":       "paid",
		"client_reference_id":  order.TradeNo,
		"amount_total":         float64(order.PaymentAmountMinor),
		"currency":             strings.ToLower(strings.TrimSpace(order.PaymentCurrency)),
		"livemode":             false,
		"payment_method_types": []interface{}{order.PaymentMethod},
		"metadata":             metadata,
	}
}

func assertOneTimeRetryCounts(t *testing.T, userID int, tradeNo string, orderStatus string, entitlementCount int64, termCount int64, webhookCount int64, webhookStatus string) {
	t.Helper()
	var storedOrder model.SubscriptionOrder
	require.NoError(t, model.DB.Where("trade_no = ?", tradeNo).First(&storedOrder).Error)
	require.Equal(t, orderStatus, storedOrder.Status)
	require.Equal(t, "cs_one_time_recall_retry", model.StripeCheckoutSessionIDFromProviderPayload(storedOrder.ProviderPayload))
	var count int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", userID).Count(&count).Error)
	require.Equal(t, entitlementCount, count)
	require.NoError(t, model.DB.Model(&model.SubscriptionTermSegment{}).Where("order_id = ?", storedOrder.Id).Count(&count).Error)
	require.Equal(t, termCount, count)
	require.NoError(t, model.DB.Model(&model.PaymentWebhookEvent{}).Where("event_id = ?", "evt_one_time_recall_retry").Count(&count).Error)
	require.Equal(t, webhookCount, count)
	var webhook model.PaymentWebhookEvent
	require.NoError(t, model.DB.Where("event_id = ?", "evt_one_time_recall_retry").First(&webhook).Error)
	require.Equal(t, webhookStatus, webhook.Status)
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
