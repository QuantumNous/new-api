package controller

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

type subscriptionStripeRecordingBackend struct {
	stripe.Backend
	params       []*stripe.CheckoutSessionParams
	couponParams []*stripe.CouponParams
}

func (b *subscriptionStripeRecordingBackend) Call(_ string, _ string, _ string, params stripe.ParamsContainer, result stripe.LastResponseSetter) error {
	switch typed := params.(type) {
	case *stripe.CheckoutSessionParams:
		b.params = append(b.params, typed)
		session := result.(*stripe.CheckoutSession)
		session.ID = "cs_subscription_test"
		session.URL = "https://checkout.stripe.test/subscription"
	case *stripe.CouponParams:
		b.couponParams = append(b.couponParams, typed)
		coupon := result.(*stripe.Coupon)
		coupon.ID = fmt.Sprintf("coupon_subscription_test_%d", len(b.couponParams))
	default:
		return fmt.Errorf("unexpected Stripe params type %T", params)
	}
	return nil
}

func setupSubscriptionStripeRecordingBackend(t *testing.T) *subscriptionStripeRecordingBackend {
	t.Helper()
	originalBackend := stripe.GetBackend(stripe.APIBackend)
	originalSecret := setting.StripeApiSecret
	backend := &subscriptionStripeRecordingBackend{Backend: originalBackend}
	stripe.SetBackend(stripe.APIBackend, backend)
	setting.StripeApiSecret = "sk_test_subscription"
	t.Cleanup(func() {
		stripe.SetBackend(stripe.APIBackend, originalBackend)
		setting.StripeApiSecret = originalSecret
	})
	return backend
}

func TestSubscriptionStripeOrdinaryPromotionCodes(t *testing.T) {
	backend := setupSubscriptionStripeRecordingBackend(t)

	checkoutSession, err := genStripeSubscriptionLink("sub_ref_ordinary", "", "buyer@example.com", "price_subscription", 7, 11, 0, nil)

	require.NoError(t, err)
	require.Equal(t, "https://checkout.stripe.test/subscription", checkoutSession.URL)
	require.Len(t, backend.params, 1)
	params := backend.params[0]
	require.NotNil(t, params.AllowPromotionCodes)
	require.True(t, *params.AllowPromotionCodes)
	require.Empty(t, params.Discounts)
}

func TestSubscriptionStripeRecallPromotionCode(t *testing.T) {
	backend := setupSubscriptionStripeRecordingBackend(t)

	checkoutSession, err := genStripeSubscriptionLink("sub_ref_recall", "cus_123", "buyer@example.com", "price_subscription", 7, 11, 0, &service.RecallCheckoutDiscount{
		PromotionCodeID: "promo_subscription_recall",
		CampaignID:      42,
		RecipientID:     84,
	})

	require.NoError(t, err)
	require.Equal(t, "https://checkout.stripe.test/subscription", checkoutSession.URL)
	require.Len(t, backend.params, 1)
	params := backend.params[0]
	require.Nil(t, params.AllowPromotionCodes)
	require.Len(t, params.Discounts, 1)
	require.NotNil(t, params.Discounts[0].PromotionCode)
	require.Equal(t, "promo_subscription_recall", *params.Discounts[0].PromotionCode)
	require.Equal(t, "42", params.Metadata["recall_campaign_id"])
	require.Equal(t, "84", params.Metadata["recall_recipient_id"])
}

func TestSubscriptionStripeInviteCouponDisablesPromotionCodeEntry(t *testing.T) {
	backend := setupSubscriptionStripeRecordingBackend(t)

	checkoutSession, err := genStripeSubscriptionLink("sub_ref_invite", "", "buyer@example.com", "price_subscription", 7, 11, 5, nil)

	require.NoError(t, err)
	require.Equal(t, "https://checkout.stripe.test/subscription", checkoutSession.URL)
	require.Len(t, backend.params, 1)
	require.Len(t, backend.couponParams, 1)
	params := backend.params[0]
	require.Nil(t, params.AllowPromotionCodes)
	require.Len(t, params.Discounts, 1)
	require.Equal(t, "coupon_subscription_test_1", *params.Discounts[0].Coupon)
}

func TestSubscriptionStripeInviteAndRecallUsesRecallWhenStronger(t *testing.T) {
	backend := setupSubscriptionStripeRecordingBackend(t)
	setupSubscriptionRecallClaimDB(t)
	confirmPaymentComplianceForTest(t)
	enableRecallCampaignForControllerTest(t)
	enableInviteFirstSubscriptionDiscountForControllerTest(t, 5)
	originalGate := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = false
	t.Cleanup(func() { common.SubscriptionSingleContractEnabled = originalGate })

	originalWebhookSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = "whsec_subscription_test"
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalWebhookSecret
	})

	const inviterID = 710201
	const userID = 710202
	const planID = 910202
	require.NoError(t, model.DB.Create(&model.User{
		Id:       inviterID,
		Username: "subscription_inviter",
		Email:    "subscription-inviter@example.com",
		Status:   common.UserStatusEnabled,
		AffCode:  "subscription_inviter",
	}).Error)
	user := model.User{
		Id:        userID,
		Username:  "subscription_recall_beats_invite",
		Email:     "subscription-recall-beats-invite@example.com",
		Status:    common.UserStatusEnabled,
		InviterId: inviterID,
		AffCode:   "subscription_recall_beats_invite",
	}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            planID,
		Title:         "Subscription recall beats invite test",
		PriceAmount:   20,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		StripePriceId: "price_subscription",
	}).Error)
	model.InvalidateSubscriptionPlanCache(planID)
	strongerCampaign, strongerRecipient := seedControllerSubscriptionRecallOffer(t, user, "subscription recall stronger", service.RecallDiscountConfig{Type: "percent", PercentOff: 50}, "price_subscription", "promo_subscription_recall_stronger", model.RecallRecipientContacting)

	body, err := common.Marshal(SubscriptionStripePayRequest{PlanId: planID})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/subscription/stripe/pay", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", userID)

	SubscriptionRequestStripePay(ctx)

	require.Len(t, backend.params, 1)
	require.Empty(t, backend.couponParams)
	params := backend.params[0]
	require.Len(t, params.Discounts, 1)
	require.Equal(t, "promo_subscription_recall_stronger", *params.Discounts[0].PromotionCode)
	require.Equal(t, fmt.Sprintf("%d", strongerCampaign.Id), params.Metadata["recall_campaign_id"])
	require.Equal(t, fmt.Sprintf("%d", strongerRecipient.Id), params.Metadata["recall_recipient_id"])
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "user_id = ?", userID).Error)
	require.Zero(t, order.DiscountUSD)
}

func TestSubscriptionStripeInviteAndRecallUsesInviteOnStrongerOrTie(t *testing.T) {
	backend := setupSubscriptionStripeRecordingBackend(t)
	setupSubscriptionRecallClaimDB(t)
	confirmPaymentComplianceForTest(t)
	enableRecallCampaignForControllerTest(t)
	enableInviteFirstSubscriptionDiscountForControllerTest(t, 5)
	originalGate := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = false
	t.Cleanup(func() { common.SubscriptionSingleContractEnabled = originalGate })

	originalWebhookSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = "whsec_subscription_test"
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalWebhookSecret
	})

	for _, test := range []struct {
		name       string
		percentOff float64
	}{
		{name: "invite_stronger", percentOff: 10},
		{name: "invite_tie", percentOff: 25},
	} {
		t.Run(test.name, func(t *testing.T) {
			backend.params = nil
			backend.couponParams = nil
			userID := 710300 + len(test.name)
			planID := 910300 + len(test.name)
			inviterID := userID + 1000
			require.NoError(t, model.DB.Create(&model.User{
				Id:       inviterID,
				Username: "subscription_inviter_" + test.name,
				Email:    "subscription-inviter-" + test.name + "@example.com",
				Status:   common.UserStatusEnabled,
				AffCode:  "subscription_inviter_" + test.name,
			}).Error)
			user := model.User{
				Id:        userID,
				Username:  "subscription_invite_wins_" + test.name,
				Email:     "subscription-invite-wins-" + test.name + "@example.com",
				Status:    common.UserStatusEnabled,
				InviterId: inviterID,
				AffCode:   "subscription_invite_wins_" + test.name,
			}
			require.NoError(t, model.DB.Create(&user).Error)
			require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
				Id:            planID,
				Title:         "Subscription invite wins test",
				PriceAmount:   20,
				Currency:      "USD",
				DurationUnit:  model.SubscriptionDurationMonth,
				DurationValue: 1,
				Enabled:       true,
				StripePriceId: "price_subscription",
			}).Error)
			model.InvalidateSubscriptionPlanCache(planID)
			seedControllerSubscriptionRecallOffer(t, user, "subscription recall "+test.name, service.RecallDiscountConfig{Type: "percent", PercentOff: test.percentOff}, "price_subscription", "promo_subscription_recall_"+test.name, model.RecallRecipientContacting)

			body, err := common.Marshal(SubscriptionStripePayRequest{PlanId: planID})
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/subscription/stripe/pay", bytes.NewReader(body))
			ctx.Request.Header.Set("Content-Type", "application/json")
			ctx.Set("id", userID)

			SubscriptionRequestStripePay(ctx)

			require.Len(t, backend.params, 1)
			require.Len(t, backend.couponParams, 1)
			params := backend.params[0]
			require.Nil(t, params.AllowPromotionCodes)
			require.Len(t, params.Discounts, 1)
			require.Equal(t, "coupon_subscription_test_1", *params.Discounts[0].Coupon)
			require.Empty(t, params.Metadata["recall_campaign_id"])
			require.Empty(t, params.Metadata["recall_recipient_id"])
			require.Empty(t, params.SubscriptionData.Metadata["recall_campaign_id"])
			require.Empty(t, params.SubscriptionData.Metadata["recall_recipient_id"])
		})
	}
}

func TestSubscriptionStripeRecallAvoidsCrossCurrencyInviteComparison(t *testing.T) {
	setupSubscriptionRecallClaimDB(t)
	plan := model.SubscriptionPlan{
		Id:            910401,
		Title:         "Cross-currency recall selection",
		PriceAmount:   20,
		Currency:      "EUR",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		StripePriceId: "price_cross_currency",
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	order := model.SubscriptionOrder{
		UserId:      710401,
		PlanId:      plan.Id,
		Money:       15,
		DiscountUSD: 5,
		TradeNo:     "subscription_cross_currency_discount",
		Status:      common.TopUpStatusPending,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	recall := service.RecallCheckoutDiscount{
		CampaignID:          41,
		RecipientID:         42,
		PromotionCodeID:     "promo_cross_currency_recall",
		DiscountAmountMinor: 200,
	}

	require.NoError(t, applySubscriptionCheckoutDiscountSelection(&order, &plan, &recall))

	require.Zero(t, order.DiscountUSD)
	require.Equal(t, plan.PriceAmount, order.Money)
	require.Equal(t, recall.CampaignID, order.RecallCampaignId)
	require.Equal(t, recall.RecipientID, order.RecallRecipientId)
	require.Equal(t, recall.PromotionCodeID, order.RecallPromotionCodeId)
	require.Equal(t, recall.DiscountAmountMinor, order.RecallDiscountAmountMinor)
}

func TestSubscriptionStripeNoClaimAppliesBestAccountRecallOffer(t *testing.T) {
	backend := setupSubscriptionStripeRecordingBackend(t)
	setupSubscriptionRecallClaimDB(t)
	confirmPaymentComplianceForTest(t)
	enableRecallCampaignForControllerTest(t)
	originalGate := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = false
	t.Cleanup(func() { common.SubscriptionSingleContractEnabled = originalGate })

	originalWebhookSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = "whsec_subscription_test"
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalWebhookSecret
	})

	const userID = 710101
	const planID = 910101
	user := model.User{
		Id:       userID,
		Username: "subscription_best_offer_user",
		Email:    "subscription-best-offer@example.com",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            planID,
		Title:         "Subscription best offer test",
		PriceAmount:   29,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		StripePriceId: "price_subscription",
	}).Error)
	model.InvalidateSubscriptionPlanCache(planID)
	seedControllerSubscriptionRecallOffer(t, user, "subscription weak", service.RecallDiscountConfig{Type: "percent", PercentOff: 10}, "price_subscription", "promo_subscription_weak", model.RecallRecipientContacting)
	strongerCampaign, strongerRecipient := seedControllerSubscriptionRecallOffer(t, user, "subscription strong", service.RecallDiscountConfig{Type: "percent", PercentOff: 25}, "price_subscription", "promo_subscription_strong", model.RecallRecipientContacting)
	resolved, err := service.GetRecallRuntime().Claims.ResolveBestRecallOffer(
		context.Background(),
		userID,
		service.RecallPurchaseKindSubscription,
		"price_subscription",
		"USD",
		2900,
	)
	require.NoError(t, err)
	require.NotNil(t, resolved)
	require.Equal(t, strongerRecipient.Id, resolved.View.RecipientID)
	handlerPlan, err := model.GetSubscriptionPlanById(planID)
	require.NoError(t, err)
	handlerSubtotal, err := stripeMinorUnitAmount(handlerPlan.PriceAmount, handlerPlan.Currency)
	require.NoError(t, err)
	handlerResolved, err := service.GetRecallRuntime().Claims.ResolveBestRecallOffer(
		context.Background(),
		userID,
		service.RecallPurchaseKindSubscription,
		strings.TrimSpace(handlerPlan.StripePriceId),
		strings.ToUpper(strings.TrimSpace(handlerPlan.Currency)),
		handlerSubtotal,
	)
	require.NoError(t, err)
	require.NotNil(t, handlerResolved)
	require.Equal(t, strongerRecipient.Id, handlerResolved.View.RecipientID)

	body, err := common.Marshal(SubscriptionStripePayRequest{PlanId: planID})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/subscription/stripe/pay", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", userID)

	SubscriptionRequestStripePay(ctx)

	require.Len(t, backend.params, 1)
	params := backend.params[0]
	require.Len(t, params.Discounts, 1)
	require.Equal(t, "promo_subscription_strong", *params.Discounts[0].PromotionCode)
	require.Equal(t, fmt.Sprintf("%d", strongerCampaign.Id), params.Metadata["recall_campaign_id"])
	require.Equal(t, fmt.Sprintf("%d", strongerRecipient.Id), params.Metadata["recall_recipient_id"])
	require.Equal(t, params.Metadata["recall_campaign_id"], params.SubscriptionData.Metadata["recall_campaign_id"])
	require.Equal(t, params.Metadata["recall_recipient_id"], params.SubscriptionData.Metadata["recall_recipient_id"])
}

func TestSubscriptionStripeWrongScopePromotionClaimStopsBeforeCheckout(t *testing.T) {
	for _, tc := range []struct {
		language string
		message  string
	}{
		{language: "en", message: "This discount is invalid or no longer available for this purchase."},
		{language: "zh-CN", message: "此优惠无效、已过期或不适用于本次购买。"},
	} {
		t.Run(tc.language, func(t *testing.T) {
			testSubscriptionStripeWrongScopePromotionClaimStopsBeforeCheckout(t, tc.language)
		})
	}
}

func testSubscriptionStripeWrongScopePromotionClaimStopsBeforeCheckout(t *testing.T, language string) {
	t.Helper()
	require.NoError(t, i18n.Init())
	originalSingleContractEnabled := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = false
	t.Cleanup(func() { common.SubscriptionSingleContractEnabled = originalSingleContractEnabled })
	backend := setupSubscriptionStripeRecordingBackend(t)
	setupSubscriptionRecallClaimDB(t)
	confirmPaymentComplianceForTest(t)
	enableRecallCampaignForControllerTest(t)
	originalGate := common.SubscriptionSingleContractEnabled
	common.SubscriptionSingleContractEnabled = false
	t.Cleanup(func() { common.SubscriptionSingleContractEnabled = originalGate })

	originalWebhookSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = "whsec_subscription_test"
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalWebhookSecret
	})

	const userID = 710001
	const planID = 910001
	require.NoError(t, model.DB.Create(&model.User{
		Id:       userID,
		Username: "subscription_recall_user",
		Email:    "subscription-recall@example.com",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            planID,
		Title:         "Subscription recall scope test",
		PriceAmount:   29,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		StripePriceId: "price_subscription",
	}).Error)
	model.InvalidateSubscriptionPlanCache(planID)

	claim := strings.Repeat("c", 48)
	claimDigest := sha256.Sum256([]byte(claim))
	claimHash := fmt.Sprintf("%x", claimDigest)
	campaign := model.RecallCampaign{
		Name:                "top-up only",
		Status:              model.RecallCampaignRunning,
		AudienceTemplate:    "first_purchase",
		AudienceConfig:      `{}`,
		ExecutionMode:       "manual",
		CouponSource:        "automatic",
		DiscountConfig:      `{"type":"percent","percent_off":20}`,
		ProductScope:        `{"topup_price_ids":["price_topup"],"subscription_price_ids":[]}`,
		EmailSequenceConfig: `[]`,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	promotionCodeID := "promo_topup_only"
	require.NoError(t, model.DB.Create(&model.RecallRecipient{
		CampaignId:            campaign.Id,
		UserId:                userID,
		EligibilitySnapshot:   `{}`,
		EmailSnapshot:         "subscription-recall@example.com",
		LanguageSnapshot:      "en",
		State:                 model.RecallRecipientContacting,
		StripePromotionCodeId: &promotionCodeID,
		PromotionCode:         "FKTOPUP234",
		PromotionExpiresAt:    time.Now().Add(time.Hour).Unix(),
		ClaimTokenHash:        &claimHash,
	}).Error)

	body, err := common.Marshal(SubscriptionStripePayRequest{PlanId: planID, RecallClaim: claim})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/subscription/stripe/pay", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Accept-Language", language)
	ctx.Set("id", userID)

	SubscriptionRequestStripePay(ctx)

	require.Len(t, backend.params, 1)
	require.Empty(t, backend.params[0].Discounts)
	responseBody := recorder.Body.String()
	require.Contains(t, responseBody, `"message":"success"`)
	require.NotContains(t, responseBody, service.ErrRecallClaimWrongPrice.Error())
	require.NotContains(t, responseBody, claim)
}

func seedControllerSubscriptionRecallOffer(t *testing.T, user model.User, name string, discount service.RecallDiscountConfig, subscriptionPriceID string, promotionCodeID string, state string) (model.RecallCampaign, model.RecallRecipient) {
	t.Helper()
	discountJSON, err := common.Marshal(discount)
	require.NoError(t, err)
	productsJSON, err := common.Marshal(service.RecallProductScope{SubscriptionPriceIDs: []string{subscriptionPriceID}})
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		Name:                name,
		Status:              model.RecallCampaignRunning,
		AudienceTemplate:    "specified_users",
		AudienceConfig:      `{}`,
		ExecutionMode:       "manual",
		CouponSource:        "automatic",
		DiscountConfig:      string(discountJSON),
		ProductScope:        string(productsJSON),
		EmailSequenceConfig: `[]`,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	recipient := model.RecallRecipient{
		CampaignId:            campaign.Id,
		UserId:                user.Id,
		EligibilitySnapshot:   `{}`,
		EmailSnapshot:         user.Email,
		LanguageSnapshot:      "en",
		State:                 state,
		StripePromotionCodeId: &promotionCodeID,
		PromotionCode:         "FK" + strings.ToUpper(strings.ReplaceAll(name, " ", "")) + "234",
		PromotionExpiresAt:    time.Now().Add(time.Hour).Unix(),
		PromotionIssuedAt:     time.Now().Add(-time.Minute).Unix(),
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	return campaign, recipient
}

func setupSubscriptionRecallClaimDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/subscription-recall.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
	))
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})
}

func enableRecallCampaignForControllerTest(t *testing.T) {
	t.Helper()
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.enabled":      "true",
		"recall_campaign_setting.batch_size":   "100",
		"recall_campaign_setting.tick_seconds": "30",
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"recall_campaign_setting.enabled":      "false",
			"recall_campaign_setting.batch_size":   "100",
			"recall_campaign_setting.tick_seconds": "30",
		}))
	})
}

func enableInviteFirstSubscriptionDiscountForControllerTest(t *testing.T, discountUSD float64) {
	t.Helper()
	originalMode := common.InviteRewardSubscriptionMode
	originalDiscount := common.InviteFirstSubDiscountUSD
	common.InviteRewardSubscriptionMode = true
	common.InviteFirstSubDiscountUSD = discountUSD
	t.Cleanup(func() {
		common.InviteRewardSubscriptionMode = originalMode
		common.InviteFirstSubDiscountUSD = originalDiscount
	})
}
