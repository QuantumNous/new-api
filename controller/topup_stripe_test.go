package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stripe/stripe-go/v81/webhook"
	"gorm.io/gorm"
)

func setupStripeWebhookTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.QuotaPerUnit = 500000

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db

	if err := db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}, &model.SubscriptionOrder{}); err != nil {
		t.Fatalf("failed to migrate test tables: %v", err)
	}

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func signedStripeEventPayload(t *testing.T, eventType string, object map[string]any, secret string) (payload []byte, signature string) {
	t.Helper()

	body, err := common.Marshal(map[string]any{
		"id":          "evt_test_checkout",
		"object":      "event",
		"api_version": "2025-02-24.acacia",
		"type":        eventType,
		"data": map[string]any{
			"object": object,
		},
	})
	if err != nil {
		t.Fatalf("failed to marshal stripe event: %v", err)
	}

	signed := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{
		Payload:   body,
		Secret:    secret,
		Timestamp: time.Now(),
	})
	return signed.Payload, signed.Header
}

func signedStripeCheckoutCompletedPayload(t *testing.T, referenceId string, amountTotal int64, secret string) (payload []byte, signature string) {
	t.Helper()

	return signedStripeEventPayload(t, "checkout.session.completed", map[string]any{
		"id":                  "cs_test_checkout",
		"object":              "checkout.session",
		"customer":            "cus_test",
		"client_reference_id": referenceId,
		"status":              "complete",
		"payment_status":      "paid",
		"amount_total":        amountTotal,
		"currency":            "usd",
	}, secret)
}

func performStripeWebhook(t *testing.T, payload []byte, signature string) *httptest.ResponseRecorder {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/stripe/webhook", bytes.NewReader(payload))
	ctx.Request.Header.Set("Stripe-Signature", signature)

	StripeWebhook(ctx)
	return recorder
}

func TestStripeWebhookDoesNotCompleteNonStripeTopUp(t *testing.T) {
	db := setupStripeWebhookTestDB(t)
	oldSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = "whsec_test"
	t.Cleanup(func() {
		setting.StripeWebhookSecret = oldSecret
	})

	user := model.User{
		Username: "alipay-user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	topUp := model.TopUp{
		UserId:        user.Id,
		Amount:        2664,
		Money:         1332,
		TradeNo:       "USR59NOtest",
		PaymentMethod: "alipay",
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := db.Create(&topUp).Error; err != nil {
		t.Fatalf("failed to create top-up: %v", err)
	}

	payload, signature := signedStripeCheckoutCompletedPayload(t, topUp.TradeNo, 133200, setting.StripeWebhookSecret)
	recorder := performStripeWebhook(t, payload, signature)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected webhook endpoint to acknowledge signed event, got status %d", recorder.Code)
	}

	var reloadedTopUp model.TopUp
	if err := db.First(&reloadedTopUp, topUp.Id).Error; err != nil {
		t.Fatalf("failed to reload top-up: %v", err)
	}
	if reloadedTopUp.Status != common.TopUpStatusPending {
		t.Fatalf("expected non-stripe top-up to remain pending, got status %q", reloadedTopUp.Status)
	}

	var reloadedUser model.User
	if err := db.First(&reloadedUser, user.Id).Error; err != nil {
		t.Fatalf("failed to reload user: %v", err)
	}
	if reloadedUser.Quota != 0 {
		t.Fatalf("expected user quota to stay unchanged, got %d", reloadedUser.Quota)
	}
}

func TestStripeWebhookCompletesStripeTopUp(t *testing.T) {
	db := setupStripeWebhookTestDB(t)
	oldSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = "whsec_test"
	t.Cleanup(func() {
		setting.StripeWebhookSecret = oldSecret
	})

	user := model.User{
		Username: "stripe-user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	topUp := model.TopUp{
		UserId:        user.Id,
		Amount:        10,
		Money:         80,
		TradeNo:       "ref_stripe_test",
		PaymentMethod: PaymentMethodStripe,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := db.Create(&topUp).Error; err != nil {
		t.Fatalf("failed to create top-up: %v", err)
	}

	payload, signature := signedStripeCheckoutCompletedPayload(t, topUp.TradeNo, 8000, setting.StripeWebhookSecret)
	recorder := performStripeWebhook(t, payload, signature)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected webhook endpoint to acknowledge signed event, got status %d", recorder.Code)
	}

	var reloadedTopUp model.TopUp
	if err := db.First(&reloadedTopUp, topUp.Id).Error; err != nil {
		t.Fatalf("failed to reload top-up: %v", err)
	}
	if reloadedTopUp.Status != common.TopUpStatusSuccess {
		t.Fatalf("expected stripe top-up to be completed, got status %q", reloadedTopUp.Status)
	}

	var reloadedUser model.User
	if err := db.First(&reloadedUser, user.Id).Error; err != nil {
		t.Fatalf("failed to reload user: %v", err)
	}
	expectedQuota := int(topUp.Money * common.QuotaPerUnit)
	if reloadedUser.Quota != expectedQuota {
		t.Fatalf("expected user quota %d, got %d", expectedQuota, reloadedUser.Quota)
	}
}

func TestStripeWebhookRejectsEmptyWebhookSecret(t *testing.T) {
	oldSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = ""
	t.Cleanup(func() {
		setting.StripeWebhookSecret = oldSecret
	})

	payload, signature := signedStripeCheckoutCompletedPayload(t, "ref_empty_secret", 8000, "")
	recorder := performStripeWebhook(t, payload, signature)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected empty webhook secret to be rejected, got status %d", recorder.Code)
	}
}

func TestStripeWebhookDefersUnpaidSessionUntilAsyncSuccess(t *testing.T) {
	db := setupStripeWebhookTestDB(t)
	oldSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = "whsec_test"
	t.Cleanup(func() {
		setting.StripeWebhookSecret = oldSecret
	})

	user := model.User{
		Username: "stripe-async-user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	topUp := model.TopUp{
		UserId:        user.Id,
		Amount:        10,
		Money:         80,
		TradeNo:       "ref_stripe_async_success",
		PaymentMethod: PaymentMethodStripe,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := db.Create(&topUp).Error; err != nil {
		t.Fatalf("failed to create top-up: %v", err)
	}

	completedPayload, completedSignature := signedStripeEventPayload(t, "checkout.session.completed", map[string]any{
		"id":                  "cs_test_async_pending",
		"object":              "checkout.session",
		"customer":            "cus_test",
		"client_reference_id": topUp.TradeNo,
		"status":              "complete",
		"payment_status":      "unpaid",
		"amount_total":        8000,
		"currency":            "usd",
	}, setting.StripeWebhookSecret)
	recorder := performStripeWebhook(t, completedPayload, completedSignature)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected unpaid completed session to be acknowledged, got status %d", recorder.Code)
	}

	var pendingTopUp model.TopUp
	if err := db.First(&pendingTopUp, topUp.Id).Error; err != nil {
		t.Fatalf("failed to reload pending top-up: %v", err)
	}
	if pendingTopUp.Status != common.TopUpStatusPending {
		t.Fatalf("expected top-up to remain pending before async success, got status %q", pendingTopUp.Status)
	}

	asyncPayload, asyncSignature := signedStripeEventPayload(t, "checkout.session.async_payment_succeeded", map[string]any{
		"id":                  "cs_test_async_success",
		"object":              "checkout.session",
		"customer":            "cus_test",
		"client_reference_id": topUp.TradeNo,
		"amount_total":        8000,
		"currency":            "usd",
	}, setting.StripeWebhookSecret)
	recorder = performStripeWebhook(t, asyncPayload, asyncSignature)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected async success event to be acknowledged, got status %d", recorder.Code)
	}

	var reloadedTopUp model.TopUp
	if err := db.First(&reloadedTopUp, topUp.Id).Error; err != nil {
		t.Fatalf("failed to reload top-up: %v", err)
	}
	if reloadedTopUp.Status != common.TopUpStatusSuccess {
		t.Fatalf("expected async success to complete stripe top-up, got status %q", reloadedTopUp.Status)
	}

	var reloadedUser model.User
	if err := db.First(&reloadedUser, user.Id).Error; err != nil {
		t.Fatalf("failed to reload user: %v", err)
	}
	expectedQuota := int(topUp.Money * common.QuotaPerUnit)
	if reloadedUser.Quota != expectedQuota {
		t.Fatalf("expected user quota %d after async success, got %d", expectedQuota, reloadedUser.Quota)
	}
}

func TestStripeWebhookAsyncPaymentFailedMarksTopUpFailed(t *testing.T) {
	db := setupStripeWebhookTestDB(t)
	oldSecret := setting.StripeWebhookSecret
	setting.StripeWebhookSecret = "whsec_test"
	t.Cleanup(func() {
		setting.StripeWebhookSecret = oldSecret
	})

	user := model.User{
		Username: "stripe-async-fail-user",
		Status:   common.UserStatusEnabled,
		Quota:    0,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	topUp := model.TopUp{
		UserId:        user.Id,
		Amount:        10,
		Money:         80,
		TradeNo:       "ref_stripe_async_failed",
		PaymentMethod: PaymentMethodStripe,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := db.Create(&topUp).Error; err != nil {
		t.Fatalf("failed to create top-up: %v", err)
	}

	payload, signature := signedStripeEventPayload(t, "checkout.session.async_payment_failed", map[string]any{
		"id":                  "cs_test_async_failed",
		"object":              "checkout.session",
		"client_reference_id": topUp.TradeNo,
	}, setting.StripeWebhookSecret)
	recorder := performStripeWebhook(t, payload, signature)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected async failure event to be acknowledged, got status %d", recorder.Code)
	}

	var reloadedTopUp model.TopUp
	if err := db.First(&reloadedTopUp, topUp.Id).Error; err != nil {
		t.Fatalf("failed to reload top-up: %v", err)
	}
	if reloadedTopUp.Status != common.TopUpStatusFailed {
		t.Fatalf("expected async failure to mark top-up failed, got status %q", reloadedTopUp.Status)
	}
}
