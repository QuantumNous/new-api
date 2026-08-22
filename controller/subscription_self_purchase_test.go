package controller

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
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

func migrateSubscriptionControllerRecallLifecycle(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.RecallLifecycleEvent{}))
}

func migrateSubscriptionControllerQuotaLifecycle(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.QuotaLifecycleState{}))
}

func grantSubscriptionSelfPurchaseInvitationDiscount(t *testing.T, userID int, amountUSDMinor int64, key string) {
	t.Helper()
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.GrantSubscriptionDiscountTx(tx, model.SubscriptionDiscountGrantInput{
			UserID:          userID,
			USDMinor:        amountUSDMinor,
			EntryType:       model.SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:      "test_invitation",
			SourceKey:       key,
			IdempotencyKey:  key,
			PricingSnapshot: `{"source":"test"}`,
		})
		return err
	}))
}

func seedSubscriptionSelfPendingRecurringOrder(t *testing.T, userID int, requestID string, plan model.SubscriptionPlan, providerSessionID string, providerSessionURL string) model.SubscriptionOrder {
	t.Helper()
	contract := model.UserSubscriptionContract{
		UserId:      userID,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:    contract.Id,
		UserId:        userID,
		RequestId:     requestID,
		ChangeVersion: 1,
		Kind:          model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:      plan.Id,
		EffectiveAt:   common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
		"latest_change_intent_id": intent.Id,
		"change_version":          intent.ChangeVersion,
	}).Error)
	planSnapshot, err := common.Marshal(map[string]interface{}{
		"plan_id":            plan.Id,
		"title":              plan.Title,
		"price_amount":       plan.PriceAmount,
		"currency":           plan.Currency,
		"stripe_price_id":    strings.TrimSpace(plan.StripePriceId),
		"duration_unit":      plan.DurationUnit,
		"duration_value":     plan.DurationValue,
		"total_amount":       plan.TotalAmount,
		"quota_reset_period": plan.QuotaResetPeriod,
	})
	require.NoError(t, err)
	order := model.SubscriptionOrder{
		UserId:             userID,
		PlanId:             plan.Id,
		Money:              plan.PriceAmount,
		TradeNo:            "SUBSTRUSR" + strconv.Itoa(userID) + "INT" + strconv.FormatInt(intent.Id, 10) + "NOreplay",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		PaymentCurrency:    strings.ToUpper(strings.TrimSpace(plan.Currency)),
		PaymentAmountMinor: plan.TotalAmount,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		PurchaseMonths:     1,
		UnitPrice:          plan.PriceAmount,
		PlanSnapshot:       string(planSnapshot),
		ChangeIntentId:     intent.Id,
		ProviderSessionId:  providerSessionID,
		ProviderSessionURL: providerSessionURL,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	return order
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

func TestSubscriptionPurchasePlanRevisionIgnoresLegacyMediaCredits(t *testing.T) {
	plan := model.SubscriptionPlan{
		Id:               9202,
		Enabled:          true,
		PriceAmount:      10,
		Currency:         "USD",
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      4500000,
		QuotaResetPeriod: model.SubscriptionResetMonthly,
	}

	withoutLegacyMediaCredits := subscriptionPurchasePlanRevision(&plan)
	plan.MediaCreditsMonthly = 5000

	require.Equal(t, withoutLegacyMediaCredits, subscriptionPurchasePlanRevision(&plan))
}

func seedSubscriptionSelfRecallClaim(t *testing.T, userID int, priceID string, discount service.RecallDiscountConfig) (model.RecallCampaign, model.RecallRecipient, string) {
	t.Helper()
	discountJSON, err := common.Marshal(discount)
	require.NoError(t, err)
	productsJSON, err := common.Marshal(service.RecallProductScope{SubscriptionPriceIDs: []string{priceID}})
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		Name: "self purchase prepaid recall", Status: model.RecallCampaignRunning, AudienceTemplate: "first_purchase",
		AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic",
		DiscountConfig: string(discountJSON), ProductScope: string(productsJSON), EmailSequenceConfig: `[]`,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	promotionID := "promo_self_prepaid_recall"
	recipient := model.RecallRecipient{
		CampaignId: campaign.Id, UserId: userID, EligibilitySnapshot: `{}`, EmailSnapshot: "self-prepaid-recall@example.com",
		LanguageSnapshot: "en", State: model.RecallRecipientContacting,
		StripePromotionCodeId: &promotionID, PromotionCode: "FKPREPAID234", PromotionExpiresAt: time.Now().Add(time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	claim := strings.Repeat("q", 48)
	claimDigest := sha256.Sum256([]byte(claim))
	claimHash := hex.EncodeToString(claimDigest[:])
	require.NoError(t, model.DB.Create(&model.RecallMessage{
		RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: `{}`,
		State: model.RecallMessageAccepted, ClaimTokenHash: &claimHash,
	}).Error)
	return campaign, recipient, claim
}

func TestSubscriptionSelfQuoteRecallFirstMonthSignsOriginalUnitAndDiscount(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.RecallCampaign{}, &model.RecallRecipient{}, &model.RecallMessage{}, &model.RecallEvent{}))
	setRecallControllerEnabled(t, true)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-recall-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9121)
	plan := insertSubscriptionSelfPurchasePlan(t, 9221)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"price_amount":    1.00,
		"stripe_price_id": "price_subscription",
	}).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	campaign, recipient, claim := seedSubscriptionSelfRecallClaim(t, 9121, "price_subscription", service.RecallDiscountConfig{Type: "percent", PercentOff: 20})

	recorder := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9221,"payment_method":"balance","months":3,"request_id":"quote-recall-balance","recall_claim":"`+claim+`"}`,
		QuoteSubscriptionSelfPurchase,
		9121,
	)

	require.Equal(t, http.StatusOK, recorder.Code)
	var envelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &envelope))
	balanceQuote := envelope.Data.PaymentQuotes["balance"]
	require.Equal(t, float64(1), balanceQuote.UnitPrice)
	require.Equal(t, float64(3), balanceQuote.OriginalTotal)
	require.Equal(t, float64(0.20), balanceQuote.DiscountAmount)
	require.Equal(t, float64(2.80), balanceQuote.Total)

	claims, err := service.VerifySubscriptionPurchaseQuoteToken(balanceQuote.QuoteID, time.Now())
	require.NoError(t, err)
	require.Equal(t, int64(100), claims.UnitAmountMinor)
	require.Equal(t, int64(20), claims.DiscountAmountMinor)
	require.Equal(t, int64(280), claims.TotalAmountMinor)
	require.Equal(t, campaign.Id, claims.RecallCampaignID)
	require.Equal(t, recipient.Id, claims.RecallRecipientID)
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

func TestSubscriptionSelfQuoteEpayIsRejectedBeforeTokenAndPendingOrder(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	configureSubscriptionEpayAllowedMethod(t, model.SubscriptionPaymentMethodAlipay, true)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-epay-choice-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9126)
	insertSubscriptionSelfPurchasePlan(t, 9226)

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9226,"payment_choice":"epay","payment_method":"alipay","months":1,"request_id":"self-epay-choice"}`,
		QuoteSubscriptionSelfPurchase,
		9126,
	)
	require.Equal(t, http.StatusOK, quote.Code)
	var quoteEnvelope struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	require.False(t, quoteEnvelope.Success)
	require.Contains(t, quoteEnvelope.Message, "/api/subscription/epay/pay")
	require.Empty(t, quoteEnvelope.Data.PaymentQuotes)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ? AND plan_id = ?", 9126, 9226).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 9126).Count(&intentCount).Error)
	require.Zero(t, intentCount)
}

func TestSubscriptionSelfPurchaseEpayRejectsConcreteMethodMismatch(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	configureSubscriptionEpayAllowedMethod(t, model.SubscriptionPaymentMethodAlipay, true)
	operation_setting.PayMethods = []map[string]string{
		{"type": model.SubscriptionPaymentMethodAlipay},
		{"type": model.SubscriptionPaymentMethodPix},
	}
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-epay-mismatch-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9127)
	plan := insertSubscriptionSelfPurchasePlan(t, 9227)
	token, err := service.SignSubscriptionPurchaseQuoteToken(service.SubscriptionPurchaseQuoteTokenClaims{
		Version:          2,
		UserID:           9127,
		PlanID:           9227,
		PaymentChoice:    service.SubscriptionPaymentChoiceEpay,
		PaymentMethod:    model.SubscriptionPaymentMethodAlipay,
		Months:           1,
		RequestID:        "self-epay-mismatch",
		Currency:         "USD",
		UnitAmountMinor:  999,
		TotalAmountMinor: 999,
		DiscountKind:     service.SubscriptionDiscountKindNone,
		PlanRevision:     subscriptionPurchasePlanRevision(&plan),
		ExpiresAt:        time.Now().Add(subscriptionSelfQuoteTTL).Unix(),
	})
	require.NoError(t, err)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9227,"payment_choice":"epay","payment_method":"pix","months":1,"request_id":"self-epay-mismatch","quote_id":"`+token+`"}`,
		PurchaseSubscriptionSelf,
		9127,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	var purchaseEnvelope struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(purchase.Body.Bytes(), &purchaseEnvelope))
	require.False(t, purchaseEnvelope.Success)
	require.Contains(t, purchaseEnvelope.Message, "/api/subscription/epay/pay")
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9127).Count(&count).Error)
	require.Zero(t, count)
}

func TestSubscriptionSelfPurchaseEpayRejectsUnsupportedConcreteMethod(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	configureSubscriptionEpayAllowedMethod(t, model.SubscriptionPaymentMethodAlipay, true)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-epay-unsupported-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9128)
	insertSubscriptionSelfPurchasePlan(t, 9228)

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9228,"payment_choice":"epay","payment_method":"not-real","months":1,"request_id":"self-epay-unsupported"}`,
		QuoteSubscriptionSelfPurchase,
		9128,
	)
	require.Equal(t, http.StatusOK, quote.Code)
	var quoteEnvelope struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	require.False(t, quoteEnvelope.Success)
	require.Contains(t, quoteEnvelope.Message, "/api/subscription/epay/pay")
	require.Empty(t, quoteEnvelope.Data.PaymentQuotes)

	token, err := service.SignSubscriptionPurchaseQuoteToken(service.SubscriptionPurchaseQuoteTokenClaims{
		Version:          2,
		UserID:           9128,
		PlanID:           9228,
		PaymentChoice:    service.SubscriptionPaymentChoiceEpay,
		PaymentMethod:    "not-real",
		Months:           1,
		RequestID:        "self-epay-unsupported",
		Currency:         "USD",
		UnitAmountMinor:  999,
		TotalAmountMinor: 999,
		DiscountKind:     service.SubscriptionDiscountKindNone,
		PlanRevision:     subscriptionPurchasePlanRevision(&model.SubscriptionPlan{Id: 9228, Enabled: true, PriceAmount: 9.99, Currency: "USD", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000, QuotaResetPeriod: model.SubscriptionResetNever}),
		ExpiresAt:        time.Now().Add(subscriptionSelfQuoteTTL).Unix(),
	})
	require.NoError(t, err)
	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9228,"payment_choice":"epay","payment_method":"not-real","months":1,"request_id":"self-epay-unsupported","quote_id":"`+token+`"}`,
		PurchaseSubscriptionSelf,
		9128,
	)
	require.Equal(t, http.StatusOK, purchase.Code)
	var purchaseEnvelope struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(purchase.Body.Bytes(), &purchaseEnvelope))
	require.False(t, purchaseEnvelope.Success)
	require.Contains(t, purchaseEnvelope.Message, "/api/subscription/epay/pay")
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9128).Count(&count).Error)
	require.Zero(t, count)
}

func TestSubscriptionSelfPurchaseReconstructsZeroDecimalQuoteAmounts(t *testing.T) {
	quote := subscriptionPurchaseQuoteFromClaims(service.SubscriptionPurchaseQuoteTokenClaims{
		Currency:         "JPY",
		Months:           1,
		UnitAmountMinor:  1000,
		TotalAmountMinor: 1000,
	}, true)

	require.NotNil(t, quote)
	require.Equal(t, float64(1000), quote.UnitPrice)
	require.Equal(t, float64(1000), quote.OriginalTotal)
	require.Equal(t, float64(1000), quote.Total)
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

func TestSubscriptionSelfQuoteSignsRecurringZeroTotalInvitationQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-recurring-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9102)
	plan := insertSubscriptionSelfPurchasePlan(t, 9202)
	grantSubscriptionSelfPurchaseInvitationDiscount(t, 9102, 999, "controller-recurring-invitation")

	recorder := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9202,"payment_method":"stripe_recurring","months":1,"request_id":"stripe-recurring-quote"}`,
		QuoteSubscriptionSelfPurchase,
		9102,
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
	recurringQuote := envelope.Data.PaymentQuotes[service.SubscriptionPaymentChoiceStripeRecurring]
	require.Equal(t, "USD", recurringQuote.Currency)
	require.Equal(t, float64(9.99), recurringQuote.UnitPrice)
	require.Equal(t, float64(9.99), recurringQuote.OriginalTotal)
	require.Equal(t, float64(9.99), recurringQuote.DiscountAmount)
	require.Equal(t, service.SubscriptionDiscountKindInvitation, recurringQuote.DiscountKind)
	require.Equal(t, float64(9.99), recurringQuote.InvitationAvailableUSD)
	require.Equal(t, float64(9.99), recurringQuote.InvitationDiscountUSD)
	require.Equal(t, float64(9.99), recurringQuote.InvitationDiscountAmount)
	require.Zero(t, recurringQuote.InvitationRemainingUSD)
	require.Empty(t, recurringQuote.OtherDiscountKind)
	require.Zero(t, recurringQuote.OtherDiscountAmount)
	require.Zero(t, recurringQuote.Total)
	require.NotEmpty(t, recurringQuote.QuoteID)

	claims, err := service.VerifySubscriptionPurchaseQuoteToken(recurringQuote.QuoteID, time.Now())
	require.NoError(t, err)
	require.Equal(t, 2, claims.Version)
	require.Equal(t, 9102, claims.UserID)
	require.Equal(t, plan.Id, claims.PlanID)
	require.Equal(t, service.SubscriptionPaymentChoiceStripeRecurring, claims.PaymentChoice)
	require.Equal(t, service.SubscriptionDiscountKindInvitation, claims.DiscountKind)
	require.Equal(t, int64(999), claims.InvitationAvailableUSDMinor)
	require.Equal(t, int64(999), claims.InvitationDiscountUSDMinor)
	require.Equal(t, int64(999), claims.InvitationDiscountAmountMinor)
	require.Zero(t, claims.InvitationRemainingUSDMinor)
	require.Zero(t, claims.TotalAmountMinor)
	require.Zero(t, claims.RecallCampaignID)
	require.Zero(t, claims.RecallRecipientID)
	require.Equal(t, subscriptionPurchasePlanRevision(&plan), claims.PlanRevision)
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
	migrateSubscriptionControllerRecallLifecycle(t)
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

func TestSubscriptionSelfPurchaseReplaysExistingOneTimeWhenCurrentQuoteUnavailable(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	migrateSubscriptionControllerRecallLifecycle(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-replay-before-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9129)
	plan := insertSubscriptionSelfPurchasePlan(t, 9229)
	originalCreator := stripeOneTimeCheckoutSessionCreator
	t.Cleanup(func() { stripeOneTimeCheckoutSessionCreator = originalCreator })
	var createdTradeNos []string
	stripeOneTimeCheckoutSessionCreator = func(_ context.Context, order *model.SubscriptionOrder, _ *model.User, _ ...service.StripeCheckoutPresentation) (*oneTimeStripeCheckoutSession, error) {
		createdTradeNos = append(createdTradeNos, order.TradeNo)
		return &oneTimeStripeCheckoutSession{ID: "cs_test_replay_before_quote", URL: "https://checkout.example/replay-before-quote"}, nil
	}

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9229,"payment_method":"upi","months":1,"request_id":"replay-before-quote"}`,
		QuoteSubscriptionSelfPurchase,
		9129,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	body := `{"plan_id":9229,"payment_method":"upi","months":1,"request_id":"replay-before-quote","quote_id":"` + quoteEnvelope.Data.PaymentQuotes["upi"].QuoteID + `"}`

	first := performSubscriptionSelfPurchaseRequest(body, PurchaseSubscriptionSelf, 9129)
	require.Equal(t, http.StatusOK, first.Code)
	require.Contains(t, first.Body.String(), "https://checkout.example/replay-before-quote")

	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Update("upi_price_inr", nil).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	second := performSubscriptionSelfPurchaseRequest(body, PurchaseSubscriptionSelf, 9129)

	require.Equal(t, http.StatusOK, second.Code)
	require.Contains(t, second.Body.String(), `"success":true`)
	require.Contains(t, second.Body.String(), "https://checkout.example/replay-before-quote")
	require.Len(t, createdTradeNos, 1)
}

func TestSubscriptionSelfPurchaseOneTimeZeroTotalInvitationCompletesLocally(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	migrateSubscriptionControllerRecallLifecycle(t)
	migrateSubscriptionControllerQuotaLifecycle(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-zero-invitation-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9125)
	plan := insertSubscriptionSelfPurchasePlan(t, 9225)
	grantSubscriptionSelfPurchaseInvitationDiscount(t, 9125, 999, "controller-one-time-zero-invitation")
	originalCreator := stripeOneTimeCheckoutSessionCreator
	t.Cleanup(func() { stripeOneTimeCheckoutSessionCreator = originalCreator })
	stripeOneTimeCheckoutSessionCreator = func(_ context.Context, _ *model.SubscriptionOrder, _ *model.User, _ ...service.StripeCheckoutPresentation) (*oneTimeStripeCheckoutSession, error) {
		t.Fatalf("zero-final one-time purchase must complete locally without Stripe checkout")
		return nil, nil
	}

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9225,"payment_method":"alipay","months":1,"request_id":"one-time-zero-invitation"}`,
		QuoteSubscriptionSelfPurchase,
		9125,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	require.Zero(t, quoteEnvelope.Data.PaymentQuotes["alipay"].Total)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9225,"payment_method":"alipay","months":1,"request_id":"one-time-zero-invitation","quote_id":"`+quoteEnvelope.Data.PaymentQuotes["alipay"].QuoteID+`"}`,
		PurchaseSubscriptionSelf,
		9125,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"status":"applied"`)
	require.NotContains(t, purchase.Body.String(), "checkout_url")
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.Where("user_id = ? AND plan_id = ?", 9125, plan.Id).First(&order).Error)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	require.Zero(t, order.PaymentAmountMinor)
	require.Equal(t, service.SubscriptionDiscountKindInvitation, order.DiscountKind)
	require.Equal(t, int64(999), order.SubscriptionDiscountUSDMinor)
	account, err := model.GetSubscriptionDiscountAccount(9125)
	require.NoError(t, err)
	require.Zero(t, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type = ?", order.SubscriptionDiscountReservationKey, model.SubscriptionDiscountEntryTypeCommit).
		Count(&commitCount).Error)
	require.Equal(t, int64(1), commitCount)
}

func TestSubscriptionSelfPurchaseStripeRecurringRecallFailsClosedBeforeCheckout(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(
		&model.TopUp{},
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
		&model.RecallLifecycleEvent{},
	))
	setRecallControllerEnabled(t, true)
	insertSubscriptionControllerUser(t, 9117)
	plan := insertSubscriptionSelfPurchasePlan(t, 9217)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription").Error)
	discountJSON, err := common.Marshal(service.RecallDiscountConfig{Type: "percent", PercentOff: 20})
	require.NoError(t, err)
	productsJSON, err := common.Marshal(service.RecallProductScope{SubscriptionPriceIDs: []string{"price_subscription"}})
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		Name: "self purchase recall", Status: model.RecallCampaignRunning, AudienceTemplate: "first_purchase",
		AudienceConfig: `{}`, ExecutionMode: "manual", CouponSource: "automatic",
		DiscountConfig: string(discountJSON), ProductScope: string(productsJSON), EmailSequenceConfig: `[]`,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	promotionID := "promo_self_purchase_recall"
	recipient := model.RecallRecipient{
		CampaignId: campaign.Id, UserId: 9117, EligibilitySnapshot: `{}`, EmailSnapshot: "self-recall@example.com",
		LanguageSnapshot: "en", State: model.RecallRecipientContacting,
		StripePromotionCodeId: &promotionID, PromotionCode: "FKSELF234", PromotionExpiresAt: time.Now().Add(time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	claim := strings.Repeat("r", 48)
	claimDigest := sha256.Sum256([]byte(claim))
	claimHash := hex.EncodeToString(claimDigest[:])
	require.NoError(t, model.DB.Create(&model.RecallMessage{
		RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: `{}`,
		State: model.RecallMessageAccepted, ClaimTokenHash: &claimHash,
	}).Error)

	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalSecret := setting.StripeApiSecret
	originalKey := stripe.Key
	var form url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/checkout/sessions", r.URL.Path)
		require.NoError(t, r.ParseForm())
		form = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"cs_self_recall","object":"checkout.session","url":"https://checkout.example/self-recall"}`))
	}))
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:               stripe.String(server.URL),
		HTTPClient:        server.Client(),
		MaxNetworkRetries: stripe.Int64(0),
		LeveledLogger:     &stripe.LeveledLogger{Level: stripe.LevelNull},
	}))
	setting.StripeApiSecret = "sk_test_self_recall"
	t.Cleanup(func() {
		server.Close()
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		setting.StripeApiSecret = originalSecret
		stripe.Key = originalKey
	})

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9217,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recall","recall_claim":"`+claim+`"}`,
		QuoteSubscriptionSelfPurchase,
		9117,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	recurringQuote := quoteEnvelope.Data.PaymentQuotes[service.SubscriptionPaymentChoiceStripeRecurring]
	require.NotEmpty(t, recurringQuote.QuoteID)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9217,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recall","recall_claim":"`+claim+`","quote_id":"`+recurringQuote.QuoteID+`"}`,
		PurchaseSubscriptionSelf,
		9117,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"success":true`)
	require.Contains(t, purchase.Body.String(), "https://checkout.example/self-recall")
	require.NotNil(t, form)
	require.Equal(t, "promo_self_purchase_recall", form.Get("discounts[0][promotion_code]"))
	require.Empty(t, form.Get("allow_promotion_codes"))
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9117).Count(&count).Error)
	require.Equal(t, int64(1), count)
	require.NoError(t, model.DB.Model(&model.TopUp{}).Where("user_id = ?", 9117).Count(&count).Error)
	require.Equal(t, int64(1), count)
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 9117).Count(&count).Error)
	require.Equal(t, int64(1), count)
}

func TestSubscriptionSelfPurchaseStripeRecurringNoDiscountCreatesCheckout(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	migrateSubscriptionControllerRecallLifecycle(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-recurring-no-discount-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9123)
	plan := insertSubscriptionSelfPurchasePlan(t, 9223)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription_no_discount").Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)

	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalSecretKey := setting.StripeApiSecret
	originalKey := stripe.Key
	var form url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/checkout/sessions", r.URL.Path)
		require.NoError(t, r.ParseForm())
		form = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"cs_self_recurring_no_discount","object":"checkout.session","url":"https://checkout.example/self-recurring-no-discount"}`))
	}))
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:               stripe.String(server.URL),
		HTTPClient:        server.Client(),
		MaxNetworkRetries: stripe.Int64(0),
		LeveledLogger:     &stripe.LeveledLogger{Level: stripe.LevelNull},
	}))
	setting.StripeApiSecret = "sk_test_self_recurring_no_discount"
	t.Cleanup(func() {
		server.Close()
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		setting.StripeApiSecret = originalSecretKey
		stripe.Key = originalKey
	})

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9223,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recurring-no-discount"}`,
		QuoteSubscriptionSelfPurchase,
		9123,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	recurringQuote := quoteEnvelope.Data.PaymentQuotes[service.SubscriptionPaymentChoiceStripeRecurring]
	require.NotEmpty(t, recurringQuote.QuoteID)
	require.Zero(t, recurringQuote.DiscountAmount)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9223,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recurring-no-discount","quote_id":"`+recurringQuote.QuoteID+`"}`,
		PurchaseSubscriptionSelf,
		9123,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"success":true`)
	require.Contains(t, purchase.Body.String(), "https://checkout.example/self-recurring-no-discount")
	require.NotNil(t, form)
	require.Empty(t, form.Get("discounts[0][promotion_code]"))
	require.Empty(t, form.Get("discounts[0][coupon]"))
	require.Empty(t, form.Get("allow_promotion_codes"))
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9123).Count(&count).Error)
	require.Equal(t, int64(1), count)
	require.NoError(t, model.DB.Model(&model.TopUp{}).Where("user_id = ?", 9123).Count(&count).Error)
	require.Equal(t, int64(1), count)
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 9123).Count(&count).Error)
	require.Equal(t, int64(1), count)
}

func TestSubscriptionSelfPurchaseStripeRecurringReplayWithStoredSessionAllowsMissingQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	insertSubscriptionControllerUser(t, 9132)
	plan := insertSubscriptionSelfPurchasePlan(t, 9232)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription_replay_stored_session_no_quote").Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	plan.StripePriceId = "price_subscription_replay_stored_session_no_quote"
	order := seedSubscriptionSelfPendingRecurringOrder(
		t,
		9132,
		"self-recurring-replay-stored-session-no-quote",
		plan,
		"cs_self_recurring_replay_no_quote",
		"https://checkout.example/self-recurring-replay-no-quote",
	)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9232,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recurring-replay-stored-session-no-quote"}`,
		PurchaseSubscriptionSelf,
		9132,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"success":true`)
	require.Contains(t, purchase.Body.String(), "https://checkout.example/self-recurring-replay-no-quote")
	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, order.Id).Error)
	require.Equal(t, "cs_self_recurring_replay_no_quote", stored.ProviderSessionId)
	require.Equal(t, "https://checkout.example/self-recurring-replay-no-quote", stored.ProviderSessionURL)
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9132).Count(&count).Error)
	require.Equal(t, int64(1), count)
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 9132).Count(&count).Error)
	require.Equal(t, int64(1), count)
}

func TestSubscriptionSelfPurchaseStripeRecurringReplayWithStoredSessionAllowsExpiredQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-recurring-replay-expired-quote-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9133)
	plan := insertSubscriptionSelfPurchasePlan(t, 9233)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription_replay_stored_session_expired_quote").Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	plan.StripePriceId = "price_subscription_replay_stored_session_expired_quote"
	order := seedSubscriptionSelfPendingRecurringOrder(
		t,
		9133,
		"self-recurring-replay-stored-session-expired-quote",
		plan,
		"cs_self_recurring_replay_expired_quote",
		"https://checkout.example/self-recurring-replay-expired-quote",
	)
	token, err := service.SignSubscriptionPurchaseQuoteToken(service.SubscriptionPurchaseQuoteTokenClaims{
		Version:          2,
		UserID:           9133,
		PlanID:           plan.Id,
		PaymentChoice:    service.SubscriptionPaymentChoiceStripeRecurring,
		Months:           1,
		RequestID:        "self-recurring-replay-stored-session-expired-quote",
		Currency:         "USD",
		UnitAmountMinor:  999,
		TotalAmountMinor: 999,
		DiscountKind:     service.SubscriptionDiscountKindNone,
		PlanRevision:     subscriptionPurchasePlanRevision(&plan),
		ExpiresAt:        time.Now().Add(-time.Minute).Unix(),
	})
	require.NoError(t, err)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9233,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recurring-replay-stored-session-expired-quote","quote_id":"`+token+`"}`,
		PurchaseSubscriptionSelf,
		9133,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"success":true`)
	require.Contains(t, purchase.Body.String(), "https://checkout.example/self-recurring-replay-expired-quote")
	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, order.Id).Error)
	require.Equal(t, "cs_self_recurring_replay_expired_quote", stored.ProviderSessionId)
	require.Equal(t, "https://checkout.example/self-recurring-replay-expired-quote", stored.ProviderSessionURL)
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9133).Count(&count).Error)
	require.Equal(t, int64(1), count)
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 9133).Count(&count).Error)
	require.Equal(t, int64(1), count)
}

func TestSubscriptionSelfPurchaseStripeRecurringReplayWithMissingSessionUsesSignedQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-recurring-replay-missing-session-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9130)
	plan := insertSubscriptionSelfPurchasePlan(t, 9230)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription_replay_missing_session").Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9230,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recurring-replay-missing-session"}`,
		QuoteSubscriptionSelfPurchase,
		9130,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	recurringQuote := quoteEnvelope.Data.PaymentQuotes[service.SubscriptionPaymentChoiceStripeRecurring]
	require.NotEmpty(t, recurringQuote.QuoteID)

	contract := model.UserSubscriptionContract{
		UserId:      9130,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:    contract.Id,
		UserId:        9130,
		RequestId:     "self-recurring-replay-missing-session",
		ChangeVersion: 1,
		Kind:          model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:      plan.Id,
		EffectiveAt:   common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
		"latest_change_intent_id": intent.Id,
		"change_version":          intent.ChangeVersion,
	}).Error)
	planSnapshot, err := common.Marshal(map[string]interface{}{
		"plan_id":            plan.Id,
		"title":              plan.Title,
		"price_amount":       plan.PriceAmount,
		"currency":           plan.Currency,
		"stripe_price_id":    "price_subscription_replay_missing_session",
		"duration_unit":      plan.DurationUnit,
		"duration_value":     plan.DurationValue,
		"total_amount":       plan.TotalAmount,
		"quota_reset_period": plan.QuotaResetPeriod,
	})
	require.NoError(t, err)
	order := model.SubscriptionOrder{
		UserId:             9130,
		PlanId:             plan.Id,
		Money:              9.99,
		TradeNo:            "SUBSTRUSR9130INT1NOreplaymiss",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		PaymentCurrency:    "USD",
		PaymentAmountMinor: 999,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		PurchaseMonths:     1,
		UnitPrice:          9.99,
		PlanSnapshot:       string(planSnapshot),
		ChangeIntentId:     intent.Id,
	}
	require.NoError(t, model.DB.Create(&order).Error)

	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).Updates(map[string]interface{}{
		"price_amount":    19.99,
		"total_amount":    1999,
		"stripe_price_id": "price_subscription_replay_missing_session_current",
	}).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	_, err = validateSubscriptionSelfPurchaseQuote(SubscriptionSelfPurchaseRequest{
		PlanID:        plan.Id,
		PaymentChoice: service.SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     "self-recurring-replay-missing-session",
		QuoteID:       recurringQuote.QuoteID,
	}, 9130, service.SubscriptionPaymentChoiceStripeRecurring, "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "stale")

	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalSecretKey := setting.StripeApiSecret
	originalKey := stripe.Key
	var form url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/checkout/sessions", r.URL.Path)
		require.NoError(t, r.ParseForm())
		form = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"cs_self_recurring_replay_missing_session","object":"checkout.session","url":"https://checkout.example/self-recurring-replay-missing-session"}`))
	}))
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:               stripe.String(server.URL),
		HTTPClient:        server.Client(),
		MaxNetworkRetries: stripe.Int64(0),
		LeveledLogger:     &stripe.LeveledLogger{Level: stripe.LevelNull},
	}))
	setting.StripeApiSecret = "sk_test_self_recurring_replay_missing_session"
	t.Cleanup(func() {
		server.Close()
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		setting.StripeApiSecret = originalSecretKey
		stripe.Key = originalKey
	})

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9230,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recurring-replay-missing-session","quote_id":"`+recurringQuote.QuoteID+`"}`,
		PurchaseSubscriptionSelf,
		9130,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"success":true`)
	require.Contains(t, purchase.Body.String(), "https://checkout.example/self-recurring-replay-missing-session")
	require.NotNil(t, form)
	require.Equal(t, "price_subscription_replay_missing_session", form.Get("line_items[0][price]"))
	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, order.Id).Error)
	require.Equal(t, "cs_self_recurring_replay_missing_session", stored.ProviderSessionId)
	require.Equal(t, "https://checkout.example/self-recurring-replay-missing-session", stored.ProviderSessionURL)
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9130).Count(&count).Error)
	require.Equal(t, int64(1), count)
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 9130).Count(&count).Error)
	require.Equal(t, int64(1), count)
}

func TestSubscriptionSelfPurchaseStripeRecurringDiscountReplayWithMissingSessionReusesReservation(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-recurring-discount-replay-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9131)
	plan := insertSubscriptionSelfPurchasePlan(t, 9231)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription_discount_replay_missing_session").Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	grantSubscriptionSelfPurchaseInvitationDiscount(t, 9131, 500, "controller-recurring-discount-replay")

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9231,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recurring-discount-replay"}`,
		QuoteSubscriptionSelfPurchase,
		9131,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	recurringQuote := quoteEnvelope.Data.PaymentQuotes[service.SubscriptionPaymentChoiceStripeRecurring]
	require.NotEmpty(t, recurringQuote.QuoteID)
	require.Equal(t, service.SubscriptionDiscountKindInvitation, recurringQuote.DiscountKind)
	require.Equal(t, float64(5), recurringQuote.DiscountAmount)

	contract := model.UserSubscriptionContract{
		UserId:      9131,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	intent := model.SubscriptionChangeIntent{
		ContractId:    contract.Id,
		UserId:        9131,
		RequestId:     "self-recurring-discount-replay",
		ChangeVersion: 1,
		Kind:          model.SubscriptionChangeIntentKindPurchase,
		PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
		Status:        model.SubscriptionChangeIntentStatusAwaitingPayment,
		ToPlanId:      plan.Id,
		EffectiveAt:   common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	require.NoError(t, model.DB.Model(&contract).Updates(map[string]interface{}{
		"latest_change_intent_id": intent.Id,
		"change_version":          intent.ChangeVersion,
	}).Error)
	planSnapshot, err := common.Marshal(map[string]interface{}{
		"plan_id":            plan.Id,
		"title":              plan.Title,
		"price_amount":       plan.PriceAmount,
		"currency":           plan.Currency,
		"stripe_price_id":    "price_subscription_discount_replay_missing_session",
		"duration_unit":      plan.DurationUnit,
		"duration_value":     plan.DurationValue,
		"total_amount":       plan.TotalAmount,
		"quota_reset_period": plan.QuotaResetPeriod,
	})
	require.NoError(t, err)
	tradeNo := "SUBSTRUSR9131INT1NOdiscountreplay"
	reservationKey := "subscription-order:" + tradeNo + ":reserve"
	pricingSnapshot, err := common.Marshal(map[string]interface{}{
		"discount_kind":                         service.SubscriptionDiscountKindInvitation,
		"currency":                              "USD",
		"unit_amount_minor":                     int64(999),
		"original_total_amount_minor":           int64(999),
		"payment_amount_minor":                  int64(499),
		"discount_amount_minor":                 int64(500),
		"invitation_available_usd_minor":        int64(500),
		"invitation_discount_usd_minor":         int64(500),
		"invitation_discount_amount_minor":      int64(500),
		"invitation_remaining_usd_minor":        int64(0),
		"subscription_discount_reservation_key": reservationKey,
	})
	require.NoError(t, err)
	order := model.SubscriptionOrder{
		UserId:                             9131,
		PlanId:                             plan.Id,
		Money:                              4.99,
		TradeNo:                            tradeNo,
		PaymentMethod:                      model.PaymentMethodStripe,
		PaymentProvider:                    model.PaymentProviderStripe,
		PaymentCurrency:                    "USD",
		PaymentAmountMinor:                 499,
		Status:                             common.TopUpStatusPending,
		CreateTime:                         common.GetTimestamp(),
		PurchaseMonths:                     1,
		UnitPrice:                          9.99,
		PlanSnapshot:                       string(planSnapshot),
		ChangeIntentId:                     intent.Id,
		DiscountKind:                       service.SubscriptionDiscountKindInvitation,
		SubscriptionDiscountUSDMinor:       500,
		SubscriptionDiscountAmountMinor:    500,
		SubscriptionDiscountReservationKey: reservationKey,
		DiscountPricingSnapshot:            string(pricingSnapshot),
	}
	require.NoError(t, model.DB.Create(&order).Error)
	created, err := model.ReserveSubscriptionDiscountTx(model.DB, model.SubscriptionDiscountReservationInput{
		UserID:             9131,
		USDMinor:           500,
		OrderID:            order.Id,
		TradeNo:            tradeNo,
		PaymentCurrency:    "USD",
		AppliedAmountMinor: 500,
		PricingSnapshot:    string(pricingSnapshot),
		IdempotencyKey:     reservationKey,
		ExpiresAt:          time.Now().Add(time.Hour).Unix(),
	})
	require.NoError(t, err)
	require.True(t, created)

	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalSecretKey := setting.StripeApiSecret
	originalKey := stripe.Key
	var couponForm url.Values
	var sessionForm url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.NoError(t, r.ParseForm())
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/coupons":
			couponForm = r.PostForm
			_, _ = w.Write([]byte(`{"id":"coupon_discount_replay","object":"coupon","valid":true}`))
		case "/v1/checkout/sessions":
			sessionForm = r.PostForm
			_, _ = w.Write([]byte(`{"id":"cs_self_recurring_discount_replay","object":"checkout.session","url":"https://checkout.example/self-recurring-discount-replay"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:               stripe.String(server.URL),
		HTTPClient:        server.Client(),
		MaxNetworkRetries: stripe.Int64(0),
		LeveledLogger:     &stripe.LeveledLogger{Level: stripe.LevelNull},
	}))
	setting.StripeApiSecret = "sk_test_self_recurring_discount_replay"
	t.Cleanup(func() {
		server.Close()
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		setting.StripeApiSecret = originalSecretKey
		stripe.Key = originalKey
	})

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9231,"payment_choice":"stripe_recurring","months":1,"request_id":"self-recurring-discount-replay","quote_id":"`+recurringQuote.QuoteID+`"}`,
		PurchaseSubscriptionSelf,
		9131,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"success":true`)
	require.Contains(t, purchase.Body.String(), "https://checkout.example/self-recurring-discount-replay")
	require.NotNil(t, couponForm)
	require.Equal(t, "500", couponForm.Get("amount_off"))
	require.NotNil(t, sessionForm)
	require.Equal(t, "coupon_discount_replay", sessionForm.Get("discounts[0][coupon]"))
	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, order.Id).Error)
	require.Equal(t, "cs_self_recurring_discount_replay", stored.ProviderSessionId)
	require.Equal(t, reservationKey, stored.SubscriptionDiscountReservationKey)
	var reserveCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("user_id = ? AND entry_type = ? AND idempotency_key = ?", 9131, model.SubscriptionDiscountEntryTypeReserve, reservationKey).
		Count(&reserveCount).Error)
	require.Equal(t, int64(1), reserveCount)
	var terminalCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).
		Where("terminal_reservation_key = ? AND entry_type IN ?", reservationKey, []string{model.SubscriptionDiscountEntryTypeCommit, model.SubscriptionDiscountEntryTypeRelease}).
		Count(&terminalCount).Error)
	require.Zero(t, terminalCount)
	account, err := model.GetSubscriptionDiscountAccount(9131)
	require.NoError(t, err)
	require.Zero(t, account.AvailableUSDMinor)
	require.Equal(t, int64(500), account.ReservedUSDMinor)
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
	migrateSubscriptionControllerRecallLifecycle(t)
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

func TestSubscriptionSelfPurchaseResponseOmitsProviderBindingIDs(t *testing.T) {
	response := subscriptionSelfPurchaseResponse(&service.PurchaseSubscriptionResult{
		Status: service.ChangePlanStatusApplied,
		Contract: &model.UserSubscriptionContract{
			Id:                       12,
			CurrentProviderBindingId: 34,
		},
		Intent: &model.SubscriptionChangeIntent{
			Id:                56,
			ContractId:        12,
			ProviderBindingId: 34,
		},
	}, "")

	body, err := common.Marshal(response)
	require.NoError(t, err)
	bodyText := string(body)
	require.Contains(t, bodyText, `"contract_id":12`)
	require.Contains(t, bodyText, `"intent_id":56`)
	require.NotContains(t, bodyText, "current_provider_binding_id")
	require.NotContains(t, bodyText, "provider_binding_id")
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
		Version:          2,
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

func TestSubscriptionSelfPurchaseBalanceRequiresQuote(t *testing.T) {
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
	require.Contains(t, purchase.Body.String(), "quote_id")
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9107).Count(&count).Error)
	require.Zero(t, count)
}

func TestSubscriptionSelfPurchaseStripeRecurringRequiresQuote(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 9118)
	insertSubscriptionSelfPurchasePlan(t, 9218)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9218,"payment_method":"stripe_recurring","months":1,"request_id":"recurring-no-quote"}`,
		PurchaseSubscriptionSelf,
		9118,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), "quote_id")
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9118).Count(&count).Error)
	require.Zero(t, count)
}

func TestSubscriptionSelfPurchaseResultQuoteRejectsOrderMismatchWithoutMutation(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 9120)
	insertSubscriptionSelfPurchasePlan(t, 9220)
	intent := model.SubscriptionChangeIntent{
		UserId:      9120,
		ToPlanId:    9220,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		Status:      model.SubscriptionChangeIntentStatusAwaitingPayment,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	order := model.SubscriptionOrder{
		UserId:             9120,
		PlanId:             9220,
		Money:              9.99,
		TradeNo:            "SUBSTRUSR9120INT1",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		PaymentCurrency:    "USD",
		PaymentAmountMinor: 999,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		ChangeIntentId:     intent.Id,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	claims := service.SubscriptionPurchaseQuoteTokenClaims{
		Version:             2,
		UserID:              9120,
		PlanID:              9220,
		PaymentChoice:       service.SubscriptionPaymentChoiceStripeRecurring,
		Months:              1,
		RequestID:           "recurring-recall-mismatch",
		Currency:            "USD",
		UnitAmountMinor:     999,
		DiscountKind:        service.SubscriptionDiscountKindRecall,
		DiscountAmountMinor: 200,
		TotalAmountMinor:    799,
		RecallCampaignID:    42,
		RecallRecipientID:   99,
	}

	err := validateSubscriptionSelfPurchaseResultQuote(&service.PurchaseSubscriptionResult{
		Status: service.ChangePlanStatusCheckoutRequired,
		Order:  &order,
	}, claims)

	require.Error(t, err)
	require.Contains(t, err.Error(), "quote mismatch")
	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, order.Id).Error)
	require.Equal(t, int64(999), stored.PaymentAmountMinor)
	require.Equal(t, float64(9.99), stored.Money)
	require.Zero(t, stored.RecallCampaignId)
	require.Zero(t, stored.RecallRecipientId)
	require.Zero(t, stored.RecallDiscountAmountMinor)
}

func TestSubscriptionSelfPurchaseResultQuoteDoesNotUseIntentDBFallback(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 9124)
	insertSubscriptionSelfPurchasePlan(t, 9224)
	intent := model.SubscriptionChangeIntent{
		UserId:      9124,
		ToPlanId:    9224,
		PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
		Status:      model.SubscriptionChangeIntentStatusAwaitingPayment,
	}
	require.NoError(t, model.DB.Create(&intent).Error)
	order := model.SubscriptionOrder{
		UserId:             9124,
		PlanId:             9224,
		Money:              9.99,
		TradeNo:            "SUBSTRUSR9124INT1",
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		PaymentCurrency:    "USD",
		PaymentAmountMinor: 999,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		ChangeIntentId:     intent.Id,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	claims := service.SubscriptionPurchaseQuoteTokenClaims{
		Version:             2,
		UserID:              9124,
		PlanID:              9224,
		PaymentChoice:       service.SubscriptionPaymentChoiceStripeRecurring,
		Months:              1,
		RequestID:           "recurring-no-fallback",
		Currency:            "USD",
		UnitAmountMinor:     999,
		DiscountKind:        service.SubscriptionDiscountKindRecall,
		DiscountAmountMinor: 200,
		TotalAmountMinor:    799,
		RecallCampaignID:    42,
		RecallRecipientID:   99,
	}

	err := validateSubscriptionSelfPurchaseResultQuote(&service.PurchaseSubscriptionResult{
		Status: service.ChangePlanStatusCheckoutRequired,
		Intent: &intent,
	}, claims)

	require.NoError(t, err)
	var stored model.SubscriptionOrder
	require.NoError(t, model.DB.First(&stored, order.Id).Error)
	require.Equal(t, int64(999), stored.PaymentAmountMinor)
	require.Equal(t, float64(9.99), stored.Money)
	require.Zero(t, stored.RecallCampaignId)
	require.Zero(t, stored.RecallRecipientId)
	require.Zero(t, stored.RecallDiscountAmountMinor)
}

func TestSubscriptionSelfPurchaseAcceptsLegacyNoDiscountQuoteAfterNormalization(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-legacy-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9122)
	plan := insertSubscriptionSelfPurchasePlan(t, 9222)
	legacyPayload, err := common.Marshal(map[string]any{
		"v":                  1,
		"uid":                9122,
		"pid":                9222,
		"payment_choice":     service.SubscriptionPaymentChoicePix,
		"months":             1,
		"request_id":         "legacy-no-discount",
		"currency":           "BRL",
		"unit_amount_minor":  4990,
		"total_amount_minor": 4990,
		"plan_revision":      subscriptionPurchasePlanRevision(&plan),
		"expires_at":         time.Now().Add(time.Minute).Unix(),
	})
	require.NoError(t, err)
	encodedPayload := base64.RawURLEncoding.EncodeToString(legacyPayload)
	token := encodedPayload + "." + common.GenerateHMAC(encodedPayload)

	claims, err := validateSubscriptionSelfPurchaseQuote(SubscriptionSelfPurchaseRequest{
		PlanID:        9222,
		PaymentMethod: service.SubscriptionPaymentChoicePix,
		PaymentChoice: service.SubscriptionPaymentChoicePix,
		Months:        1,
		RequestID:     "legacy-no-discount",
		QuoteID:       token,
	}, 9122, service.SubscriptionPaymentChoicePix, "")

	require.NoError(t, err)
	require.Equal(t, service.SubscriptionDiscountKindNone, claims.DiscountKind)
}

func TestSubscriptionSelfPurchaseRecurringInvitationQuoteCreatesReservedCheckout(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	migrateSubscriptionControllerRecallLifecycle(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "controller-subscription-recurring-invitation-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })
	insertSubscriptionControllerUser(t, 9119)
	plan := insertSubscriptionSelfPurchasePlan(t, 9219)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", plan.Id).
		Update("stripe_price_id", "price_subscription_invitation").Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	grantSubscriptionSelfPurchaseInvitationDiscount(t, 9119, 999, "controller-recurring-invitation-purchase")

	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalSecretKey := setting.StripeApiSecret
	originalKey := stripe.Key
	var couponForm url.Values
	var sessionForm url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.NoError(t, r.ParseForm())
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/coupons":
			couponForm = r.PostForm
			_, _ = w.Write([]byte(`{"id":"coupon_self_invitation","object":"coupon","valid":true}`))
		case "/v1/checkout/sessions":
			sessionForm = r.PostForm
			_, _ = w.Write([]byte(`{"id":"cs_self_recurring_invitation","object":"checkout.session","url":"https://checkout.example/self-recurring-invitation"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:               stripe.String(server.URL),
		HTTPClient:        server.Client(),
		MaxNetworkRetries: stripe.Int64(0),
		LeveledLogger:     &stripe.LeveledLogger{Level: stripe.LevelNull},
	}))
	setting.StripeApiSecret = "sk_test_self_recurring_invitation"
	t.Cleanup(func() {
		server.Close()
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		setting.StripeApiSecret = originalSecretKey
		stripe.Key = originalKey
	})

	quote := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9219,"payment_method":"stripe_recurring","months":1,"request_id":"recurring-invitation"}`,
		QuoteSubscriptionSelfPurchase,
		9119,
	)
	var quoteEnvelope struct {
		Data struct {
			PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &quoteEnvelope))
	recurringQuote := quoteEnvelope.Data.PaymentQuotes[service.SubscriptionPaymentChoiceStripeRecurring]
	require.NotEmpty(t, recurringQuote.QuoteID)

	purchase := performSubscriptionSelfPurchaseRequest(
		`{"plan_id":9219,"payment_method":"stripe_recurring","months":1,"request_id":"recurring-invitation","quote_id":"`+recurringQuote.QuoteID+`"}`,
		PurchaseSubscriptionSelf,
		9119,
	)

	require.Equal(t, http.StatusOK, purchase.Code)
	require.Contains(t, purchase.Body.String(), `"success":true`)
	require.Contains(t, purchase.Body.String(), "https://checkout.example/self-recurring-invitation")
	require.Equal(t, "999", couponForm.Get("amount_off"))
	require.Equal(t, "coupon_self_invitation", sessionForm.Get("discounts[0][coupon]"))
	require.Empty(t, sessionForm.Get("allow_promotion_codes"))
	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 9119).Count(&count).Error)
	require.Equal(t, int64(1), count)
	account, err := model.GetSubscriptionDiscountAccount(9119)
	require.NoError(t, err)
	require.Zero(t, account.AvailableUSDMinor)
	require.Equal(t, int64(999), account.ReservedUSDMinor)
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
