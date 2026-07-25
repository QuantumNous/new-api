package controller

import (
	"bytes"
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
	params []*stripe.CheckoutSessionParams
}

func (b *subscriptionStripeRecordingBackend) Call(_ string, _ string, _ string, params stripe.ParamsContainer, result stripe.LastResponseSetter) error {
	b.params = append(b.params, params.(*stripe.CheckoutSessionParams))
	session := result.(*stripe.CheckoutSession)
	session.ID = "cs_subscription_test"
	session.URL = "https://checkout.stripe.test/subscription"
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

func TestSubscriptionStripeWrongScopePromotionClaimStopsBeforeCheckout(t *testing.T) {
	for _, tc := range []struct {
		language string
		message  string
	}{
		{language: "en", message: "This discount is invalid or no longer available for this purchase."},
		{language: "zh-CN", message: "此优惠无效、已过期或不适用于本次购买。"},
	} {
		t.Run(tc.language, func(t *testing.T) {
			testSubscriptionStripeWrongScopePromotionClaimStopsBeforeCheckout(t, tc.language, tc.message)
		})
	}
}

func testSubscriptionStripeWrongScopePromotionClaimStopsBeforeCheckout(t *testing.T, language string, expectedMessage string) {
	t.Helper()
	require.NoError(t, i18n.Init())
	backend := setupSubscriptionStripeRecordingBackend(t)
	setupSubscriptionRecallClaimDB(t)
	confirmPaymentComplianceForTest(t)
	enableRecallCampaignForControllerTest(t)

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

	require.Empty(t, backend.params, "a wrong-scope recall claim must stop before Stripe Checkout creation")
	responseBody := recorder.Body.String()
	require.Contains(t, responseBody, `"message":"error"`)
	require.Contains(t, responseBody, expectedMessage)
	require.NotContains(t, responseBody, service.ErrRecallClaimWrongPrice.Error())
	require.NotContains(t, responseBody, claim)
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
