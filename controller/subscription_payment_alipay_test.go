package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionAlipayTestDB(t *testing.T) {
	t.Helper()

	dsn := fmt.Sprintf("file:test_subscription_alipay_%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.TopUp{}, &model.SubscriptionPlan{}, &model.SubscriptionOrder{}, &model.UserSubscription{}, &model.AlipayPendingTask{}))

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(5)

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL
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
}

func TestSubscriptionRequestAlipayPayRejectsUnsupportedMethod(t *testing.T) {
	require.NoError(t, i18n.Init())
	confirmPaymentComplianceForTest(t)
	gin.SetMode(gin.TestMode)

	originalAppID := setting.AlipayAppID
	originalEnabled := setting.AlipayEnabled
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	t.Cleanup(func() {
		setting.AlipayAppID = originalAppID
		setting.AlipayEnabled = originalEnabled
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
	})
	setting.AlipayEnabled = true
	setting.AlipayAppID = "2026000000000000"
	setting.AlipayPrivateKey = "private"
	setting.AlipayPublicKey = "public"
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 1)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/alipay/pay", bytes.NewBufferString(`{"plan_id":1,"payment_method":"stripe"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestAlipayPay(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), i18n.T(c, i18n.MsgPaymentChannelNotSupported))
}

func TestSubscriptionRequestAlipayNotifyRejectsWhenWebhookConfigIncomplete(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/alipay/notify", nil)

	SubscriptionRequestAlipayNotify(c)

	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.Empty(t, recorder.Body.String())
}

func TestGetSubscriptionAlipayMoneyUsesConfiguredExchangeRate(t *testing.T) {
	originalRate := operation_setting.USDExchangeRate
	t.Cleanup(func() {
		operation_setting.USDExchangeRate = originalRate
	})

	operation_setting.USDExchangeRate = 7.2
	require.InEpsilon(t, 72.0, getSubscriptionAlipayMoney(10), 0.0001)
}

func TestSubscriptionRequestAlipayNotifyCompletesSubscriptionOrder(t *testing.T) {
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	setupSubscriptionAlipayTestDB(t)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	originalSellerID := setting.AlipaySellerID
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
		setting.AlipaySellerID = originalSellerID
	})

	privateKeyPEM, _, publicKeyRaw := mustGenerateAlipayNotifyTestKeys(t)
	setting.AlipayEnabled = true
	setting.AlipayAppID = "2021000000000000"
	setting.AlipayPrivateKey = privateKeyPEM
	setting.AlipayPublicKey = publicKeyRaw
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	setting.AlipaySellerID = ""

	require.NoError(t, model.DB.Create(&model.User{
		Id:       77,
		Username: "subscription-success-user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            88,
		Title:         "Pro Plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
		UpgradeGroup:  "",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          77,
		PlanId:          88,
		Money:           9.99,
		TradeNo:         "sub_ref_success_77",
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		Status:          common.TopUpStatusPending,
		CreateTime:      1,
	}).Error)

	form := url.Values{}
	form.Set("app_id", setting.AlipayAppID)
	form.Set("out_trade_no", "sub_ref_success_77")
	form.Set("trade_no", "2026063000000001")
	form.Set("trade_status", "TRADE_SUCCESS")
	form.Set("total_amount", "9.99")
	form.Set("receipt_amount", "9.99")
	signature, err := service.SignAlipayContent(service.BuildAlipaySignContent(service.NormalizeAlipayParams(form)), privateKeyPEM)
	require.NoError(t, err)
	form.Set("sign", signature)

	c, recorder := newPOSTFormContext("/api/subscription/alipay/notify", form)
	SubscriptionRequestAlipayNotify(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "success", recorder.Body.String())

	order := model.GetSubscriptionOrderByTradeNo("sub_ref_success_77")
	require.NotNil(t, order)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)

	var sub model.UserSubscription
	require.NoError(t, model.DB.Where("user_id = ? AND plan_id = ?", 77, 88).First(&sub).Error)
	require.Equal(t, int64(1000), sub.AmountTotal)
	require.Equal(t, "active", sub.Status)
}

func TestAlipayNotifyCompletesSubscriptionOrderAndCreatesSubscription(t *testing.T) {
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	setupSubscriptionAlipayTestDB(t)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	originalSellerID := setting.AlipaySellerID
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
		setting.AlipaySellerID = originalSellerID
	})

	privateKeyPEM, _, publicKeyRaw := mustGenerateAlipayNotifyTestKeys(t)
	setting.AlipayEnabled = true
	setting.AlipayAppID = "2021000000000000"
	setting.AlipayPrivateKey = privateKeyPEM
	setting.AlipayPublicKey = publicKeyRaw
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	setting.AlipaySellerID = ""

	require.NoError(t, model.DB.Create(&model.User{
		Id:       91,
		Username: "subscription-real-callback-user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            92,
		Title:         "Starter",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   500,
		UpgradeGroup:  "",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          91,
		PlanId:          92,
		Money:           70,
		TradeNo:         "sub_ref_real_callback_91",
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		Status:          common.TopUpStatusPending,
		CreateTime:      1,
	}).Error)

	form := url.Values{}
	form.Set("app_id", setting.AlipayAppID)
	form.Set("out_trade_no", "sub_ref_real_callback_91")
	form.Set("trade_no", "2026063000000002")
	form.Set("trade_status", "TRADE_SUCCESS")
	form.Set("total_amount", "70.00")
	form.Set("receipt_amount", "70.00")
	signature, err := service.SignAlipayContent(service.BuildAlipaySignContent(service.NormalizeAlipayParams(form)), privateKeyPEM)
	require.NoError(t, err)
	form.Set("sign", signature)

	c, recorder := newPOSTFormContext("/api/alipay/notify", form)
	AlipayNotify(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "success", recorder.Body.String())

	order := model.GetSubscriptionOrderByTradeNo("sub_ref_real_callback_91")
	require.NotNil(t, order)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)

	var sub model.UserSubscription
	require.NoError(t, model.DB.Where("user_id = ? AND plan_id = ?", 91, 92).First(&sub).Error)
	require.Equal(t, int64(500), sub.AmountTotal)
	require.Equal(t, "active", sub.Status)
}

func TestAlipayNotifyIsIdempotentForDuplicateSubscriptionCallbacks(t *testing.T) {
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	setupSubscriptionAlipayTestDB(t)

	originalEnabled := setting.AlipayEnabled
	originalAppID := setting.AlipayAppID
	originalPrivateKey := setting.AlipayPrivateKey
	originalPublicKey := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	originalSellerID := setting.AlipaySellerID
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalAppID
		setting.AlipayPrivateKey = originalPrivateKey
		setting.AlipayPublicKey = originalPublicKey
		setting.AlipayGateway = originalGateway
		setting.AlipaySellerID = originalSellerID
	})

	privateKeyPEM, _, publicKeyRaw := mustGenerateAlipayNotifyTestKeys(t)
	setting.AlipayEnabled = true
	setting.AlipayAppID = "2021000000000000"
	setting.AlipayPrivateKey = privateKeyPEM
	setting.AlipayPublicKey = publicKeyRaw
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"
	setting.AlipaySellerID = ""

	require.NoError(t, model.DB.Create(&model.User{
		Id:       95,
		Username: "subscription-duplicate-user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            96,
		Title:         "Duplicate Guard",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   300,
		UpgradeGroup:  "",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          95,
		PlanId:          96,
		Money:           10,
		TradeNo:         "sub_ref_duplicate_95",
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		Status:          common.TopUpStatusPending,
		CreateTime:      1,
	}).Error)

	form := url.Values{}
	form.Set("app_id", setting.AlipayAppID)
	form.Set("out_trade_no", "sub_ref_duplicate_95")
	form.Set("trade_no", "2026063000000003")
	form.Set("trade_status", "TRADE_SUCCESS")
	form.Set("total_amount", "10.00")
	form.Set("receipt_amount", "10.00")
	signature, err := service.SignAlipayContent(service.BuildAlipaySignContent(service.NormalizeAlipayParams(form)), privateKeyPEM)
	require.NoError(t, err)
	form.Set("sign", signature)

	for i := 0; i < 2; i++ {
		c, recorder := newPOSTFormContext("/api/alipay/notify", form)
		AlipayNotify(c)
		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, "success", recorder.Body.String())
	}

	order := model.GetSubscriptionOrderByTradeNo("sub_ref_duplicate_95")
	require.NotNil(t, order)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)

	var subCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ? AND plan_id = ?", 95, 96).Count(&subCount).Error)
	require.Equal(t, int64(1), subCount)
}

func TestCompleteSubscriptionOrder_IsIdempotent(t *testing.T) {
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	setupSubscriptionAlipayTestDB(t)

	require.NoError(t, model.DB.Create(&model.User{
		Id:       101,
		Username: "subscription-idempotent-user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            102,
		Title:         "Idempotent",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   600,
		UpgradeGroup:  "",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{
		UserId:          101,
		PlanId:          102,
		Money:           10,
		TradeNo:         "sub_ref_idempotent_101",
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		Status:          common.TopUpStatusPending,
		CreateTime:      1,
	}).Error)

	require.NoError(t, model.CompleteSubscriptionOrder("sub_ref_idempotent_101", `{"trade_no":"2026063000000004"}`, model.PaymentProviderAlipay, model.PaymentMethodAlipay))
	require.NoError(t, model.CompleteSubscriptionOrder("sub_ref_idempotent_101", `{"trade_no":"2026063000000004"}`, model.PaymentProviderAlipay, model.PaymentMethodAlipay))

	var subCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ? AND plan_id = ?", 101, 102).Count(&subCount).Error)
	require.Equal(t, int64(1), subCount)
}
