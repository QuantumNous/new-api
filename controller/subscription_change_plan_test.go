package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func enablePaymentComplianceForSubscriptionControllerTest(t *testing.T) {
	t.Helper()
	paymentSetting := operation_setting.GetPaymentSetting()
	originalConfirmed := paymentSetting.ComplianceConfirmed
	originalVersion := paymentSetting.ComplianceTermsVersion
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalConfirmed
		paymentSetting.ComplianceTermsVersion = originalVersion
	})
}

func setupSubscriptionControllerTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL

	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

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
		require.NoError(t, sqlDB.Close())
	})

	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
		&model.SubscriptionProviderBinding{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
		&model.SubscriptionTermSegment{},
		&model.WalletLedgerEntry{},
	))
}

func insertSubscriptionControllerUser(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "subscription_controller_user",
		Email:    "subscription-controller@example.com",
		Status:   common.UserStatusEnabled,
		Group:    "plg",
		AffCode:  "subscription_controller_aff",
	}).Error)
}

func insertSubscriptionControllerPlan(t *testing.T, id int) {
	t.Helper()
	rank := 1
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:                    id,
		Title:                 "Legacy Subscription Plan",
		PriceAmount:           9.99,
		Currency:              "USD",
		DurationUnit:          model.SubscriptionDurationMonth,
		DurationValue:         1,
		Enabled:               true,
		TierRank:              &rank,
		TotalAmount:           1000,
		CreemProductId:        "creem_product",
		WaffoPancakeProductId: "waffo_product",
		AllowBalancePay:       common.GetPointer(true),
		MaxPurchasePerUser:    0,
		QuotaResetPeriod:      model.SubscriptionResetNever,
	}).Error)
}

func TestChangeSubscriptionPlanRejectsInvalidRequestID(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 901)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/self/change-plan",
		strings.NewReader(`{"plan_id":1,"payment_mode":"balance_one_period","request_id":"bad id"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	ChangeSubscriptionPlan(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "request_id")
}

func TestChangeSubscriptionPlanRejectsNonCanonicalStableRequestID(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 905)
	insertSubscriptionControllerPlan(t, 9905)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 905)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/self/change-plan",
		strings.NewReader(`{"plan_id":9905,"payment_mode":"balance_one_period","request_id":"stable-request-id"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	ChangeSubscriptionPlan(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "request_id")
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 905).Count(&intentCount).Error)
	require.Zero(t, intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 905).Count(&orderCount).Error)
	require.Zero(t, orderCount)
}

func TestStableSubscriptionRequestIDRequiresCanonicalUUID(t *testing.T) {
	require.True(t, isStableSubscriptionRequestID("550e8400-e29b-41d4-a716-446655440000"))
	require.False(t, isStableSubscriptionRequestID("stable-request-id"))
	require.False(t, isStableSubscriptionRequestID("550E8400-E29B-41D4-A716-446655440000"))
	require.False(t, isStableSubscriptionRequestID("550e8400e29b41d4a716446655440000"))
	require.False(t, isStableSubscriptionRequestID("{550e8400-e29b-41d4-a716-446655440000}"))
}

func TestSubscriptionStripePayReturnsUnsupportedWithoutLegacyState(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	rank := 1
	require.NoError(t, model.DB.Create(&model.User{
		Id:       902,
		Username: "stripe_change_user",
		Status:   common.UserStatusEnabled,
		Group:    "plg",
		AffCode:  "stripe_change_aff",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            9902,
		Title:         "Stripe Change Plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TierRank:      &rank,
		TotalAmount:   1000,
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 902)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/stripe/pay",
		strings.NewReader(`{"plan_id":9902,"request_id":"stripe-request-1"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestStripePay(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "pending migration")
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 902).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 902).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 902).Count(&intentCount).Error)
	require.Zero(t, intentCount)
}

func TestChangeSubscriptionPlanStripeRecurringRequiresStripePriceBeforePersistingState(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 903)
	insertSubscriptionControllerPlan(t, 9903)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 903)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/self/change-plan",
		strings.NewReader(`{"plan_id":9903,"payment_mode":"stripe_recurring","request_id":"550e8400-e29b-41d4-a716-446655440001"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	ChangeSubscriptionPlan(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "Stripe price id")
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 903).Error)
	require.Zero(t, user.Quota)
	var contractCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("user_id = ?", 903).Count(&contractCount).Error)
	require.Zero(t, contractCount)
	var intentCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 903).Count(&intentCount).Error)
	require.Zero(t, intentCount)
	var orderCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 903).Count(&orderCount).Error)
	require.Zero(t, orderCount)
	var entitlementCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 903).Count(&entitlementCount).Error)
	require.Zero(t, entitlementCount)
}

func TestLegacySubscriptionPurchaseInitiationHandlersAreBlockedBeforeOrderCreation(t *testing.T) {
	enablePaymentComplianceForSubscriptionControllerTest(t)
	setupSubscriptionControllerTestDB(t)
	insertSubscriptionControllerUser(t, 904)
	insertSubscriptionControllerPlan(t, 9904)
	configureLegacySubscriptionPaymentSettingsForBlockTest(t)

	tests := []struct {
		name    string
		body    string
		handler func(*gin.Context)
	}{
		{
			name:    "epay",
			body:    `{"plan_id":9904,"payment_method":"alipay"}`,
			handler: SubscriptionRequestEpay,
		},
		{
			name:    "creem",
			body:    `{"plan_id":9904}`,
			handler: SubscriptionRequestCreemPay,
		},
		{
			name:    "waffo_pancake",
			body:    `{"plan_id":9904}`,
			handler: SubscriptionRequestWaffoPancakePay,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Set("id", 904)
			ctx.Request = httptest.NewRequest(
				http.MethodPost,
				"/api/subscription/"+strings.ReplaceAll(tt.name, "_", "-")+"/pay",
				strings.NewReader(tt.body),
			)
			ctx.Request.Header.Set("Content-Type", "application/json")

			tt.handler(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), `"success":false`)
			require.Contains(t, recorder.Body.String(), "subscription purchase initiation is pending migration")
			var orderCount int64
			require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("user_id = ?", 904).Count(&orderCount).Error)
			require.Zero(t, orderCount)
			var intentCount int64
			require.NoError(t, model.DB.Model(&model.SubscriptionChangeIntent{}).Where("user_id = ?", 904).Count(&intentCount).Error)
			require.Zero(t, intentCount)
			var entitlementCount int64
			require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", 904).Count(&entitlementCount).Error)
			require.Zero(t, entitlementCount)
		})
	}
}

func configureLegacySubscriptionPaymentSettingsForBlockTest(t *testing.T) {
	t.Helper()
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	originalCreemAPIKey := setting.CreemApiKey
	originalCreemTestMode := setting.CreemTestMode
	originalCreemWebhookSecret := setting.CreemWebhookSecret
	originalWaffoMerchantID := setting.WaffoPancakeMerchantID
	originalWaffoPrivateKey := setting.WaffoPancakePrivateKey
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
		setting.CreemApiKey = originalCreemAPIKey
		setting.CreemTestMode = originalCreemTestMode
		setting.CreemWebhookSecret = originalCreemWebhookSecret
		setting.WaffoPancakeMerchantID = originalWaffoMerchantID
		setting.WaffoPancakePrivateKey = originalWaffoPrivateKey
	})
	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = "epay_key"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	setting.CreemApiKey = ""
	setting.CreemTestMode = true
	setting.CreemWebhookSecret = ""
	setting.WaffoPancakeMerchantID = "merchant"
	setting.WaffoPancakePrivateKey = "private"
}
