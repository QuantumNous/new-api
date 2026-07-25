package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func insertSubscriptionSelfPurchasePlan(t *testing.T, id int) model.SubscriptionPlan {
	t.Helper()
	rank := 1
	pixPrice := 49.90
	upiPrice := 899.00
	plan := model.SubscriptionPlan{
		Id:                 id,
		Title:              "Self Purchase Plan",
		PriceAmount:        9.99,
		Currency:           "USD",
		PixPriceBRL:        &pixPrice,
		UpiPriceINR:        &upiPrice,
		DurationUnit:       model.SubscriptionDurationMonth,
		DurationValue:      1,
		Enabled:            true,
		TierRank:           &rank,
		AllowBalancePay:    common.GetPointer(true),
		TotalAmount:        1000,
		QuotaResetPeriod:   model.SubscriptionResetNever,
		MaxPurchasePerUser: 0,
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	return plan
}

func performSubscriptionSelfPurchaseRequest(body string, handler gin.HandlerFunc, userID int) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userID)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/purchase", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	handler(ctx)
	return recorder
}

func TestSubscriptionSelfQuoteSignsPixBRLQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9101)
	plan := insertSubscriptionSelfPurchasePlan(t, 9201)

	recorder := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9201,"payment_method":"pix","months":3,"request_id":"quote-pix-request"}`,
		QuoteSubscriptionSelfPurchase,
		9101,
	)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope struct {
		Message string `json:"message"`
		Data    struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.Empty(t, envelope.Message)
	pixQuote := envelope.Data.PaymentQuotes["pix"]
	require.NotEmpty(t, pixQuote.QuoteID)
	require.Equal(t, "BRL", pixQuote.Currency)
	require.Equal(t, float64(49.90), pixQuote.UnitPrice)
	require.Equal(t, float64(149.70), pixQuote.Total)
	require.Equal(t, 3, pixQuote.Months)
	require.Greater(t, pixQuote.ExpiresAt, time.Now().Unix())

	claims, err := service.VerifySubscriptionPurchaseQuoteToken(pixQuote.QuoteID, time.Now())
	require.NoError(t, err)
	require.Equal(t, 9101, claims.UserID)
	require.Equal(t, plan.Id, claims.PlanID)
	require.Equal(t, "quote-pix-request", claims.RequestID)
	require.Equal(t, subscriptionPurchasePlanRevision(&plan), claims.PlanRevision)
}

func TestSubscriptionSelfQuoteSignsUPIINRQuoteForTwelveMonths(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9112)
	plan := insertSubscriptionSelfPurchasePlan(t, 9212)

	recorder := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9212,"payment_method":"upi","months":12,"request_id":"quote-upi-twelve-request"}`,
		QuoteSubscriptionSelfPurchase,
		9112,
	)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope struct {
		Message string `json:"message"`
		Data    struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.Empty(t, envelope.Message)
	upiQuote := envelope.Data.PaymentQuotes["upi"]
	require.NotEmpty(t, upiQuote.QuoteID)
	require.Equal(t, "INR", upiQuote.Currency)
	require.Equal(t, float64(899), upiQuote.UnitPrice)
	require.Equal(t, float64(10788), upiQuote.Total)
	require.Equal(t, 12, upiQuote.Months)

	claims, err := service.VerifySubscriptionPurchaseQuoteToken(upiQuote.QuoteID, time.Now())
	require.NoError(t, err)
	require.Equal(t, 9112, claims.UserID)
	require.Equal(t, plan.Id, claims.PlanID)
	require.Equal(t, service.SubscriptionPaymentChoiceUPI, claims.PaymentChoice)
	require.Equal(t, int64(89900), claims.UnitAmountMinor)
	require.Equal(t, int64(1078800), claims.TotalAmountMinor)
	require.Equal(t, "quote-upi-twelve-request", claims.RequestID)
	require.Equal(t, subscriptionPurchasePlanRevision(&plan), claims.PlanRevision)
}

func TestSubscriptionSelfQuoteRoundsMonthlyLocalPriceBeforeMultiplyingMonths(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9108)
	plan := insertSubscriptionSelfPurchasePlan(t, 9208)
	priceWithSixDecimals := 49.905001
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("pix_price_brl", priceWithSixDecimals).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)

	recorder := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9208,"payment_method":"pix","months":3,"request_id":"quote-rounded-pix-request"}`,
		QuoteSubscriptionSelfPurchase,
		9108,
	)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope struct {
		Message string `json:"message"`
		Data    struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.Empty(t, envelope.Message)
	pixQuote := envelope.Data.PaymentQuotes["pix"]
	require.Equal(t, float64(49.91), pixQuote.UnitPrice)
	require.Equal(t, float64(149.73), pixQuote.Total)

	claims, err := service.VerifySubscriptionPurchaseQuoteToken(pixQuote.QuoteID, time.Now())
	require.NoError(t, err)
	require.Equal(t, int64(4991), claims.UnitAmountMinor)
	require.Equal(t, int64(14973), claims.TotalAmountMinor)
}

func TestSubscriptionSelfQuoteReturnsUnavailableWhenLocalPriceMissing(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 9113)
	plan := insertSubscriptionSelfPurchasePlan(t, 9213)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"pix_price_brl": nil,
		"upi_price_inr": nil,
	}).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)

	tests := []struct {
		name   string
		method string
		reason string
	}{
		{name: "pix", method: "pix", reason: "Pix local quote is not configured"},
		{name: "upi", method: "upi", reason: "UPI local quote is not configured"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := performSubscriptionSelfPurchaseRequest(
				`{"plan_id":9213,"payment_method":"`+test.method+`","months":1,"request_id":"missing-`+test.method+`-quote"}`,
				QuoteSubscriptionSelfPurchase,
				9113,
			)

			require.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), "subscription purchase quote unavailable")
			require.Contains(t, recorder.Body.String(), test.reason)
			require.NotContains(t, recorder.Body.String(), `"currency":"USD"`)
			require.NotContains(t, recorder.Body.String(), `"quote_id"`)
		})
	}
}

func TestSubscriptionSelfQuoteRejectsStripeRecurringQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 9102)
	insertSubscriptionSelfPurchasePlan(t, 9202)

	recorder := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9202,"payment_method":"stripe_recurring","months":1,"request_id":"stripe-recurring-quote"}`,
		QuoteSubscriptionSelfPurchase,
		9102,
	)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "recurring")
}

func TestSubscriptionSelfPurchaseRejectsTamperedQuotePayload(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9103)
	insertSubscriptionSelfPurchasePlan(t, 9203)
	recorder := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9203,"payment_method":"pix","months":2,"request_id":"quote-for-tamper"}`,
		QuoteSubscriptionSelfPurchase,
		9103,
	)
	var envelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	parts := strings.Split(envelope.Data.PaymentQuotes["pix"].QuoteID, ".")
	require.Len(t, parts, 2)
	tampered := parts[0][:len(parts[0])-1] + "A." + parts[1]

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9203,"payment_method":"pix","months":2,"request_id":"quote-for-tamper","quote_id":"`+tampered+`"}`,
		PurchaseSubscriptionSelf,
		9103,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), "quote")
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestSubscriptionSelfPurchaseCreatesOneTimeStripeCheckoutAndReplaysURL(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9104)
	insertSubscriptionSelfPurchasePlan(t, 9204)
	originalCreator := stripeOneTimeCheckoutSessionCreator
	originalGetter := stripeOneTimeCheckoutSessionGetter
	var createdTradeNos []string
	t.Cleanup(func() {
		stripeOneTimeCheckoutSessionCreator = originalCreator
		stripeOneTimeCheckoutSessionGetter = originalGetter
	})
	stripeOneTimeCheckoutSessionCreator = func(_ context.Context, order *model.SubscriptionOrder, _ *model.User, _ ...service.StripeCheckoutPresentation) (*oneTimeStripeCheckoutSession, error) {
		createdTradeNos = append(createdTradeNos, order.TradeNo)
		return &oneTimeStripeCheckoutSession{ID: "cs_test_self_purchase", URL: "https://checkout.example/self-purchase"}, nil
	}
	stripeOneTimeCheckoutSessionGetter = func(_ context.Context, sessionID string) (*oneTimeStripeCheckoutSession, error) {
		require.Equal(t, "cs_test_self_purchase", sessionID)
		return &oneTimeStripeCheckoutSession{ID: sessionID, URL: "https://checkout.example/self-purchase"}, nil
	}
	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9204,"payment_method":"upi","months":1,"request_id":"one-time-checkout"}`,
		QuoteSubscriptionSelfPurchase,
		9104,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	body := `{"plan_id":9204,"payment_method":"upi","months":1,"request_id":"one-time-checkout","quote_id":"` + quoteEnvelope.Data.PaymentQuotes["upi"].QuoteID + `"}`

	first := performSubscriptionSelfPurchaseRequest(body, PurchaseSubscriptionSelf, 9104)
	second := performSubscriptionSelfPurchaseRequest(body, PurchaseSubscriptionSelf, 9104)

	require.Equal(t, http.StatusOK, first.Code)
	require.Equal(t, http.StatusOK, second.Code)
	require.Contains(t, first.Body.String(), "https://checkout.example/self-purchase")
	require.Contains(t, second.Body.String(), "https://checkout.example/self-purchase")
	require.Len(t, createdTradeNos, 1)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.Where("user_id = ?", 9104).First(&order).Error)
	require.Equal(t, service.SubscriptionPaymentChoiceUPI, order.PaymentMethod)
	require.Equal(t, "INR", order.PaymentCurrency)
	require.Equal(t, int64(89900), order.PaymentAmountMinor)
	require.Equal(t, "https://checkout.example/self-purchase", order.ProviderSessionURL)

	var topUps []model.TopUp
	require.NoError(t, model.DB.Where("trade_no = ?", order.TradeNo).Find(&topUps).Error)
	require.Len(t, topUps, 1)
	require.Equal(t, 9104, topUps[0].UserId)
	require.Equal(t, service.SubscriptionPaymentChoiceUPI, topUps[0].PaymentMethod)
	require.Equal(t, model.PaymentProviderStripe, topUps[0].PaymentProvider)
	require.Equal(t, "INR", topUps[0].PaymentCurrency)
	require.Equal(t, int64(89900), topUps[0].PaymentAmountMinor)
	require.Equal(t, float64(899), topUps[0].Money)
	require.Equal(t, common.TopUpStatusPending, topUps[0].Status)
	require.Equal(t, "cs_test_self_purchase", topUps[0].GatewayTradeNo)
}

func TestSubscriptionSelfOneTimeReplayRejectsSessionWithoutURLOrClientSecret(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertSubscriptionControllerUser(t, 9114)
	insertSubscriptionSelfPurchasePlan(t, 9214)
	order := model.SubscriptionOrder{
		UserId:             9114,
		PlanId:             9214,
		Money:              9.99,
		TradeNo:            "SUBPURUSR9114INT1NOreplay",
		PaymentMethod:      service.SubscriptionPaymentChoiceAlipay,
		PaymentProvider:    model.PaymentProviderStripe,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		PurchaseMonths:     1,
		UnitPrice:          9.99,
		PaymentCurrency:    "USD",
		PaymentAmountMinor: 999,
		ChangeIntentId:     1,
		ProviderSessionId:  "cs_one_time_missing_secret",
	}
	require.NoError(t, model.DB.Create(&order).Error)
	originalGetter := stripeOneTimeCheckoutSessionGetter
	t.Cleanup(func() { stripeOneTimeCheckoutSessionGetter = originalGetter })
	stripeOneTimeCheckoutSessionGetter = func(_ context.Context, sessionID string) (*oneTimeStripeCheckoutSession, error) {
		require.Equal(t, "cs_one_time_missing_secret", sessionID)
		return &oneTimeStripeCheckoutSession{ID: sessionID}, nil
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/purchase", strings.NewReader(`{}`))

	checkoutURL, err := ensureSubscriptionSelfOneTimeCheckout(ctx, &service.PurchaseSubscriptionResult{
		Status: service.ChangePlanStatusCheckoutRequired,
		Order:  &order,
	}, "embedded")

	require.Error(t, err)
	require.Empty(t, checkoutURL)
	require.Contains(t, err.Error(), "missing url or client secret")
}

func TestSubscriptionSelfPurchaseReplacesPendingOneTimeStripeCheckoutForNewRequest(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-replace-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9109)
	firstPlan := insertSubscriptionSelfPurchasePlan(t, 9209)
	secondPlan := insertSubscriptionSelfPurchasePlan(t, 9211)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", secondPlan.Id).Updates(map[string]interface{}{
		"title":        "Replacement Plan",
		"price_amount": 19.99,
	}).Error)
	model.InvalidateSubscriptionPlanCache(firstPlan.Id)
	model.InvalidateSubscriptionPlanCache(secondPlan.Id)
	originalCreator := stripeOneTimeCheckoutSessionCreator
	var createdTradeNos []string
	t.Cleanup(func() { stripeOneTimeCheckoutSessionCreator = originalCreator })
	var expiredSessionIDs []string
	restoreStripeAccessors := service.ReplaceStripeCheckoutSessionAccessorsForTest(
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusOpen}, nil
		},
		func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
			expiredSessionIDs = append(expiredSessionIDs, sessionID)
			return &stripe.CheckoutSession{ID: sessionID, Status: stripe.CheckoutSessionStatusExpired}, nil
		},
	)
	t.Cleanup(restoreStripeAccessors)
	stripeOneTimeCheckoutSessionCreator = func(_ context.Context, order *model.SubscriptionOrder, _ *model.User, _ ...service.StripeCheckoutPresentation) (*oneTimeStripeCheckoutSession, error) {
		createdTradeNos = append(createdTradeNos, order.TradeNo)
		return &oneTimeStripeCheckoutSession{
			ID:  "cs_replace_" + strconv.Itoa(len(createdTradeNos)),
			URL: "https://checkout.example/replace/" + strconv.Itoa(len(createdTradeNos)),
		}, nil
	}

	firstQuote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9209,"payment_method":"alipay","months":1,"request_id":"replace-first"}`,
		QuoteSubscriptionSelfPurchase,
		9109,
	)
	var firstQuoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(firstQuote.Body.Bytes(), &firstQuoteEnvelope))
	firstBody := `{"plan_id":9209,"payment_method":"alipay","months":1,"request_id":"replace-first","quote_id":"` + firstQuoteEnvelope.Data.PaymentQuotes["alipay"].QuoteID + `"}`
	firstPurchase := performSubscriptionSelfPurchaseRequest(firstBody, PurchaseSubscriptionSelf, 9109)
	require.Equal(t, http.StatusOK, firstPurchase.Code)
	require.Contains(t, firstPurchase.Body.String(), "https://checkout.example/replace/1")

	secondQuote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9211,"payment_method":"alipay","months":1,"request_id":"replace-second"}`,
		QuoteSubscriptionSelfPurchase,
		9109,
	)
	var secondQuoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(secondQuote.Body.Bytes(), &secondQuoteEnvelope))
	secondBody := `{"plan_id":9211,"payment_method":"alipay","months":1,"request_id":"replace-second","quote_id":"` + secondQuoteEnvelope.Data.PaymentQuotes["alipay"].QuoteID + `"}`
	secondPurchase := performSubscriptionSelfPurchaseRequest(secondBody, PurchaseSubscriptionSelf, 9109)

	require.Equal(t, http.StatusOK, secondPurchase.Code)
	require.Contains(t, secondPurchase.Body.String(), "https://checkout.example/replace/2")
	require.Len(t, createdTradeNos, 2)
	require.Equal(t, []string{"cs_replace_1"}, expiredSessionIDs)

	var firstIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.Where("user_id = ? AND request_id = ?", 9109, "replace-first").First(&firstIntent).Error)
	var secondIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.Where("user_id = ? AND request_id = ?", 9109, "replace-second").First(&secondIntent).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusSuperseded, firstIntent.Status)
	require.Equal(t, secondIntent.Id, firstIntent.SupersededById)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, secondIntent.Status)

	var oldOrder model.SubscriptionOrder
	require.NoError(t, model.DB.Where("trade_no = ?", createdTradeNos[0]).First(&oldOrder).Error)
	require.Equal(t, common.TopUpStatusExpired, oldOrder.Status)
	require.Equal(t, "cs_replace_1", oldOrder.ProviderSessionId)
	var newOrder model.SubscriptionOrder
	require.NoError(t, model.DB.Where("trade_no = ?", createdTradeNos[1]).First(&newOrder).Error)
	require.Equal(t, common.TopUpStatusPending, newOrder.Status)
	require.Equal(t, "cs_replace_2", newOrder.ProviderSessionId)
}

func TestSyncSubscriptionSelfRecurringCheckoutHistoryCreatesPendingTopUp(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertSubscriptionControllerUser(t, 9110)
	insertSubscriptionSelfPurchasePlan(t, 9210)

	intent := model.SubscriptionChangeIntent{
		UserId:      9110,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		Status:      model.SubscriptionChangeIntentStatusAwaitingPayment,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	order := model.SubscriptionOrder{
		UserId:             9110,
		PlanId:             9210,
		Money:              19.99,
		TradeNo:            "SUBSTRUSR9110INT1",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		PaymentCurrency:    "USD",
		PaymentAmountMinor: 1999,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		ChangeIntentId:     intent.Id,
		ProviderSessionId:  "cs_recurring_history",
		ProviderSessionURL: "https://checkout.example/recurring-history",
	}
	require.NoError(t, model.DB.Create(&order).Error)

	err := syncSubscriptionSelfRecurringCheckoutHistory(&service.PurchaseSubscriptionResult{
		Status: service.ChangePlanStatusCheckoutRequired,
		Intent: &intent,
	})

	require.NoError(t, err)
	var topUp model.TopUp
	require.NoError(t, model.DB.Where("trade_no = ?", order.TradeNo).First(&topUp).Error)
	require.Equal(t, common.TopUpStatusPending, topUp.Status)
	require.Equal(t, "cs_recurring_history", topUp.GatewayTradeNo)
}

func TestSubscriptionSelfPurchaseResponseUsesRecurringCheckoutURL(t *testing.T) {
	response := subscriptionSelfPurchaseResponse(&service.PurchaseSubscriptionResult{
		Status:      service.ChangePlanStatusCheckoutRequired,
		CheckoutURL: "https://checkout.example/recurring-purchase",
	}, "")

	require.Equal(t, "https://checkout.example/recurring-purchase", response.CheckoutURL)
}

func TestSubscriptionSelfPurchaseResponseIncludesClientSecretAndPublishableKey(t *testing.T) {
	originalPublishableKey := setting.StripePublishableKey
	setting.StripePublishableKey = "pk_test_embedded"
	t.Cleanup(func() { setting.StripePublishableKey = originalPublishableKey })

	response := subscriptionSelfPurchaseResponse(&service.PurchaseSubscriptionResult{
		Status:       service.ChangePlanStatusCheckoutRequired,
		ClientSecret: "cs_secret_self_purchase",
	}, "")

	require.Equal(t, "cs_secret_self_purchase", response.ClientSecret)
	require.Equal(t, "pk_test_embedded", response.PublishableKey)
	require.Empty(t, response.CheckoutURL)
}

func TestSubscriptionSelfPurchaseResponseOmitsPublishableKeyWithoutClientSecret(t *testing.T) {
	originalPublishableKey := setting.StripePublishableKey
	setting.StripePublishableKey = "pk_test_hosted"
	t.Cleanup(func() { setting.StripePublishableKey = originalPublishableKey })

	response := subscriptionSelfPurchaseResponse(&service.PurchaseSubscriptionResult{
		Status:      service.ChangePlanStatusApplied,
		CheckoutURL: "https://checkout.example/hosted",
	}, "")

	require.Empty(t, response.ClientSecret)
	require.Empty(t, response.PublishableKey)
	require.Equal(t, "https://checkout.example/hosted", response.CheckoutURL)
}

func TestSubscriptionSelfPurchaseResponseUsesRecurringHostedInvoiceURL(t *testing.T) {
	response := subscriptionSelfPurchaseResponse(&service.PurchaseSubscriptionResult{
		Status:           service.ChangePlanStatusPaymentActionRequired,
		HostedInvoiceURL: "https://invoice.example/recurring-upgrade",
	}, "")

	require.Equal(t, "https://invoice.example/recurring-upgrade", response.HostedInvoiceURL)
}

func TestSubscriptionSelfPurchaseRejectsExpiredQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9105)
	insertSubscriptionSelfPurchasePlan(t, 9205)
	token, err := service.SignSubscriptionPurchaseQuoteToken(service.SubscriptionPurchaseQuoteTokenClaims{
		Version:          1,
		UserID:           9105,
		PlanID:           9205,
		PaymentChoice:    service.SubscriptionPaymentChoicePix,
		Months:           1,
		RequestID:        "expired-quote",
		Currency:         "BRL",
		UnitAmountMinor:  4990,
		TotalAmountMinor: 4990,
		PlanRevision:     1,
		ExpiresAt:        time.Now().Add(-time.Minute).Unix(),
	})
	require.NoError(t, err)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9205,"payment_method":"pix","months":1,"request_id":"expired-quote","quote_id":"`+token+`"}`,
		PurchaseSubscriptionSelf,
		9105,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), "expired")
}

func TestSubscriptionSelfPurchaseBalanceDoesNotRequireQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 9107)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 9107).Update("quota", 1_000_000_000).Error)
	insertSubscriptionSelfPurchasePlan(t, 9207)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9207,"payment_method":"balance","months":2,"request_id":"balance-no-quote"}`,
		PurchaseSubscriptionSelf,
		9107,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"status":"applied"`)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.Where("user_id = ? AND payment_method = ?", 9107, model.PaymentMethodBalance).First(&order).Error)
	require.Equal(t, "USD", order.PaymentCurrency)
	require.Equal(t, int64(1998), order.PaymentAmountMinor)
}

func TestSubscriptionSelfPurchaseRejectsSameSecondPlanPriceChange(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9106)
	plan := insertSubscriptionSelfPurchasePlan(t, 9206)
	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9206,"payment_method":"pix","months":1,"request_id":"same-second-price"}`,
		QuoteSubscriptionSelfPurchase,
		9106,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	require.NotEmpty(t, quoteEnvelope.Data.PaymentQuotes["pix"].QuoteID)
	newPixPrice := 59.90
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("pix_price_brl", newPixPrice).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).UpdateColumn("updated_at", plan.UpdatedAt).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9206,"payment_method":"pix","months":1,"request_id":"same-second-price","quote_id":"`+quoteEnvelope.Data.PaymentQuotes["pix"].QuoteID+`"}`,
		PurchaseSubscriptionSelf,
		9106,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), "stale")
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9106).Count(&count).Error)
	require.Zero(t, count)
}
