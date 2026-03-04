package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/waffo-com/waffo-go/config"
	"github.com/waffo-com/waffo-go/core"
	"github.com/waffo-com/waffo-go/utils"
	"gorm.io/gorm"
)

// testKeyPair holds the RSA key pair generated once for all tests.
var testKeyPair *utils.KeyPair

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)

	// Initialize in-memory SQLite to prevent nil DB panics in model layer
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to open test database: " + err.Error())
	}
	db.AutoMigrate(&model.TopUp{}, &model.SubscriptionOrder{})
	model.DB = db

	kp, err := utils.GenerateKeyPair()
	if err != nil {
		panic("failed to generate test key pair: " + err.Error())
	}
	testKeyPair = kp
	os.Exit(m.Run())
}

// --- Helper function tests ---

func TestFormatWaffoAmount(t *testing.T) {
	tests := []struct {
		name     string
		amount   float64
		currency string
		want     string
	}{
		{"USD normal", 7.30, "USD", "7.30"},
		{"IDR zero decimal", 7.30, "IDR", "7"},
		{"JPY zero decimal", 100.0, "JPY", "100"},
		{"KRW zero decimal", 5500.0, "KRW", "5500"},
		{"VND zero decimal", 25000.0, "VND", "25000"},
		{"EUR two decimals", 0.99, "EUR", "0.99"},
		{"small amount", 0.01, "USD", "0.01"},
		{"whole number USD", 10.00, "USD", "10.00"},
		{"IDR large", 150000.0, "IDR", "150000"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatWaffoAmount(tt.amount, tt.currency)
			if got != tt.want {
				t.Errorf("formatWaffoAmount(%v, %q) = %q, want %q", tt.amount, tt.currency, got, tt.want)
			}
		})
	}
}

func TestGetWaffoUserEmail(t *testing.T) {
	tests := []struct {
		name string
		user *model.User
		want string
	}{
		{
			"has email",
			&model.User{Id: 1, Email: "alice@example.com"},
			"alice@example.com",
		},
		{
			"no email",
			&model.User{Id: 42, Email: ""},
			"user_42@noreply.local",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getWaffoUserEmail(tt.user)
			if got != tt.want {
				t.Errorf("getWaffoUserEmail() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestGetWaffoCurrency(t *testing.T) {
	original := setting.WaffoCurrency
	defer func() { setting.WaffoCurrency = original }()

	setting.WaffoCurrency = "IDR"
	if got := getWaffoCurrency(); got != "IDR" {
		t.Errorf("getWaffoCurrency() = %q, want %q", got, "IDR")
	}

	setting.WaffoCurrency = ""
	if got := getWaffoCurrency(); got != "USD" {
		t.Errorf("getWaffoCurrency() with empty config = %q, want %q", got, "USD")
	}
}

func TestWaffoPayRequest_Marshal(t *testing.T) {
	req := WaffoPayRequest{
		Amount:        100,
		PaymentMethod: "CREDIT_CARD",
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var decoded WaffoPayRequest
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if decoded.Amount != 100 {
		t.Errorf("expected amount 100, got %d", decoded.Amount)
	}
	if decoded.PaymentMethod != "CREDIT_CARD" {
		t.Errorf("expected CREDIT_CARD, got %s", decoded.PaymentMethod)
	}
}

// --- Webhook test infrastructure ---

// setupWaffoTestSettings temporarily sets global Waffo settings for testing.
// Returns a cleanup function to restore original values.
func setupWaffoTestSettings() func() {
	origEnabled := setting.WaffoEnabled
	origSandbox := setting.WaffoSandbox
	origApiKey := setting.WaffoApiKey
	origPrivateKey := setting.WaffoPrivateKey
	origPublicKey := setting.WaffoPublicKey
	origSandboxPublicKey := setting.WaffoSandboxPublicKey
	origSandboxApiKey := setting.WaffoSandboxApiKey
	origSandboxPrivateKey := setting.WaffoSandboxPrivateKey
	origMerchantId := setting.WaffoMerchantId

	setting.WaffoEnabled = true
	setting.WaffoSandbox = true
	setting.WaffoApiKey = "test-api-key"
	setting.WaffoPrivateKey = testKeyPair.PrivateKey
	setting.WaffoPublicKey = testKeyPair.PublicKey
	setting.WaffoSandboxPublicKey = testKeyPair.PublicKey
	setting.WaffoSandboxApiKey = "test-api-key"
	setting.WaffoSandboxPrivateKey = testKeyPair.PrivateKey
	setting.WaffoMerchantId = "TEST_MERCHANT"

	return func() {
		setting.WaffoEnabled = origEnabled
		setting.WaffoSandbox = origSandbox
		setting.WaffoApiKey = origApiKey
		setting.WaffoPrivateKey = origPrivateKey
		setting.WaffoPublicKey = origPublicKey
		setting.WaffoSandboxPublicKey = origSandboxPublicKey
		setting.WaffoSandboxApiKey = origSandboxApiKey
		setting.WaffoSandboxPrivateKey = origSandboxPrivateKey
		setting.WaffoMerchantId = origMerchantId
	}
}

// buildWebhookContext creates a gin test context with a signed webhook request.
func buildWebhookContext(body string, privateKey string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	signature := utils.MustSign(body, privateKey)

	req := httptest.NewRequest(http.MethodPost, "/api/waffo/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-SIGNATURE", signature)
	c.Request = req

	return c, w
}

// buildWebhookContextNoSign creates a gin test context without signature.
func buildWebhookContextNoSign(body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	req := httptest.NewRequest(http.MethodPost, "/api/waffo/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	return c, w
}

// buildWebhookContextWithSig creates a gin test context with a custom signature value.
func buildWebhookContextWithSig(body string, signature string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	req := httptest.NewRequest(http.MethodPost, "/api/waffo/webhook", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-SIGNATURE", signature)
	c.Request = req

	return c, w
}

// --- Webhook signature verification tests ---

func TestWaffoWebhook_SignatureVerification(t *testing.T) {
	cleanup := setupWaffoTestSettings()
	defer cleanup()

	paymentBody := `{"eventType":"PAYMENT_NOTIFICATION","result":{"merchantOrderId":"WAFFO-1-123-ABCD","orderStatus":"PAY_SUCCESS"}}`

	t.Run("valid signature", func(t *testing.T) {
		c, w := buildWebhookContext(paymentBody, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		// Should process the event (will fail at DB layer, but not at signature)
		body := w.Body.String()
		if strings.Contains(body, "signature verification failed") {
			t.Error("valid signature should not be rejected")
		}
	})

	t.Run("invalid signature", func(t *testing.T) {
		c, w := buildWebhookContextWithSig(paymentBody, "invalid-signature-data")
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		body := w.Body.String()
		if !strings.Contains(body, "failed") {
			t.Error("invalid signature should return failed response")
		}
	})

	t.Run("empty signature", func(t *testing.T) {
		c, w := buildWebhookContextNoSign(paymentBody)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		body := w.Body.String()
		if !strings.Contains(body, "failed") {
			t.Error("empty signature should return failed response")
		}
	})

	t.Run("tampered body", func(t *testing.T) {
		// Sign the original body, then send a different body
		signature := utils.MustSign(paymentBody, testKeyPair.PrivateKey)
		tamperedBody := `{"eventType":"PAYMENT_NOTIFICATION","result":{"merchantOrderId":"TAMPERED-ORDER","orderStatus":"PAY_SUCCESS"}}`
		c, w := buildWebhookContextWithSig(tamperedBody, signature)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		body := w.Body.String()
		if !strings.Contains(body, "failed") {
			t.Error("tampered body should return failed response")
		}
	})

	t.Run("wrong key signature", func(t *testing.T) {
		// Sign with a different key pair
		otherKP, err := utils.GenerateKeyPair()
		if err != nil {
			t.Fatalf("failed to generate other key pair: %v", err)
		}
		c, w := buildWebhookContext(paymentBody, otherKP.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		body := w.Body.String()
		if !strings.Contains(body, "failed") {
			t.Error("wrong key signature should return failed response")
		}
	})
}

// --- Webhook event routing tests ---

func TestWaffoWebhook_PaymentNotification(t *testing.T) {
	cleanup := setupWaffoTestSettings()
	defer cleanup()

	t.Run("PAY_SUCCESS without subscriptionInfo", func(t *testing.T) {
		body := `{"eventType":"PAYMENT_NOTIFICATION","result":{"merchantOrderId":"WAFFO-1-123-ABCD","orderStatus":"PAY_SUCCESS","orderAmount":"7","orderCurrency":"IDR"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		// Without DB, RechargeWaffo will fail → handler returns failed response with signature
		respBody := w.Body.String()
		sig := w.Header().Get("X-SIGNATURE")
		if sig == "" {
			t.Error("response should have X-SIGNATURE header")
		}
		// Verify the response signature
		if sig != "" && !utils.Verify(respBody, sig, testKeyPair.PublicKey) {
			t.Error("response signature should be verifiable with test public key")
		}
	})

	t.Run("PAY_FAILED", func(t *testing.T) {
		body := `{"eventType":"PAYMENT_NOTIFICATION","result":{"merchantOrderId":"WAFFO-1-456-EFGH","orderStatus":"PAY_FAILED"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		respBody := w.Body.String()
		if !strings.Contains(respBody, "success") {
			t.Error("PAY_FAILED should return success response (acknowledge receipt)")
		}
		sig := w.Header().Get("X-SIGNATURE")
		if sig == "" {
			t.Error("PAY_FAILED response should have X-SIGNATURE header")
		}
	})
}

func TestWaffoWebhook_SubscriptionPaymentNotification(t *testing.T) {
	cleanup := setupWaffoTestSettings()
	defer cleanup()

	t.Run("PAY_SUCCESS with subscriptionInfo", func(t *testing.T) {
		body := `{"eventType":"PAYMENT_NOTIFICATION","result":{"merchantOrderId":"WAFFO-SUB-1-123","orderStatus":"PAY_SUCCESS","acquiringOrderId":"ACQ-001","subscriptionInfo":{"period":"1","merchantRequest":"SR-1-123","subscriptionId":"SUB-EXT-001","subscriptionRequest":"SR-1-123"}}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		// Subscription payment with PAY_SUCCESS just logs and returns success
		respBody := w.Body.String()
		if !strings.Contains(respBody, "success") {
			t.Error("subscription payment PAY_SUCCESS should return success response")
		}
		sig := w.Header().Get("X-SIGNATURE")
		if sig == "" {
			t.Error("response should have X-SIGNATURE header")
		}
	})

	t.Run("PAY_FAILED with subscriptionInfo", func(t *testing.T) {
		body := `{"eventType":"PAYMENT_NOTIFICATION","result":{"merchantOrderId":"WAFFO-SUB-1-456","orderStatus":"PAY_FAILED","subscriptionInfo":{"period":"1","subscriptionId":"SUB-EXT-002"}}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		respBody := w.Body.String()
		if !strings.Contains(respBody, "success") {
			t.Error("subscription PAY_FAILED should return success response (acknowledge)")
		}
	})
}

func TestWaffoWebhook_SubscriptionStatusNotification(t *testing.T) {
	cleanup := setupWaffoTestSettings()
	defer cleanup()

	t.Run("ACTIVE status", func(t *testing.T) {
		body := `{"eventType":"SUBSCRIPTION_STATUS_NOTIFICATION","result":{"merchantSubscriptionId":"SUB-1-123-ABCD","subscriptionId":"EXT-SUB-001","subscriptionStatus":"ACTIVE","currency":"IDR","amount":"7"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		// CompleteSubscriptionOrder will fail (no DB) → returns failed or success (depends on ErrSubscriptionOrderNotFound)
		sig := w.Header().Get("X-SIGNATURE")
		if sig == "" {
			t.Error("response should have X-SIGNATURE header")
		}
		respBody := w.Body.String()
		if sig != "" && !utils.Verify(respBody, sig, testKeyPair.PublicKey) {
			t.Error("response signature should be verifiable")
		}
	})

	t.Run("CLOSE status", func(t *testing.T) {
		body := `{"eventType":"SUBSCRIPTION_STATUS_NOTIFICATION","result":{"merchantSubscriptionId":"SUB-1-456-EFGH","subscriptionId":"EXT-SUB-002","subscriptionStatus":"CLOSE"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		// ExpireSubscriptionOrder will fail (no DB) → returns success (errors are swallowed for CLOSE)
		respBody := w.Body.String()
		if !strings.Contains(respBody, "success") {
			t.Error("CLOSE status should return success response")
		}
	})

	t.Run("CANCELLED status", func(t *testing.T) {
		body := `{"eventType":"SUBSCRIPTION_STATUS_NOTIFICATION","result":{"merchantSubscriptionId":"SUB-1-789-IJKL","subscriptionStatus":"CANCELLED"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		respBody := w.Body.String()
		if !strings.Contains(respBody, "success") {
			t.Error("CANCELLED status should return success response")
		}
	})

	t.Run("EXPIRED status", func(t *testing.T) {
		body := `{"eventType":"SUBSCRIPTION_STATUS_NOTIFICATION","result":{"merchantSubscriptionId":"SUB-1-012-MNOP","subscriptionStatus":"EXPIRED"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		respBody := w.Body.String()
		if !strings.Contains(respBody, "success") {
			t.Error("EXPIRED status should return success response")
		}
	})

	t.Run("empty merchantSubscriptionId", func(t *testing.T) {
		body := `{"eventType":"SUBSCRIPTION_STATUS_NOTIFICATION","result":{"merchantSubscriptionId":"","subscriptionStatus":"ACTIVE"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		respBody := w.Body.String()
		if !strings.Contains(respBody, "success") {
			t.Error("empty merchantSubscriptionId should return success (skip processing)")
		}
	})
}

func TestWaffoWebhook_SubscriptionPeriodChanged(t *testing.T) {
	cleanup := setupWaffoTestSettings()
	defer cleanup()

	t.Run("renewal notification", func(t *testing.T) {
		body := `{"eventType":"SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION","result":{"merchantSubscriptionId":"SUB-1-123-RENEW","subscriptionId":"EXT-SUB-003","subscriptionStatus":"ACTIVE","currency":"IDR","amount":"7"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		sig := w.Header().Get("X-SIGNATURE")
		if sig == "" {
			t.Error("response should have X-SIGNATURE header")
		}
		respBody := w.Body.String()
		if sig != "" && !utils.Verify(respBody, sig, testKeyPair.PublicKey) {
			t.Error("response signature should be verifiable")
		}
	})

	t.Run("empty merchantSubscriptionId", func(t *testing.T) {
		body := `{"eventType":"SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION","result":{"merchantSubscriptionId":"","subscriptionStatus":"ACTIVE"}}`
		c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
		WaffoWebhook(c)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}
		respBody := w.Body.String()
		if !strings.Contains(respBody, "success") {
			t.Error("empty merchantSubscriptionId should return success (skip processing)")
		}
	})
}

func TestWaffoWebhook_RefundNotification(t *testing.T) {
	cleanup := setupWaffoTestSettings()
	defer cleanup()

	body := `{"eventType":"REFUND_NOTIFICATION","result":{"refundRequestId":"RF-001","merchantRefundOrderId":"MRF-001","acquiringOrderId":"ACQ-001","refundStatus":"REFUND_SUCCESS","refundAmount":"7"}}`
	c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
	WaffoWebhook(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	respBody := w.Body.String()
	if !strings.Contains(respBody, "success") {
		t.Error("refund notification should return success response")
	}
	sig := w.Header().Get("X-SIGNATURE")
	if sig == "" {
		t.Error("response should have X-SIGNATURE header")
	}
}

func TestWaffoWebhook_UnknownEvent(t *testing.T) {
	cleanup := setupWaffoTestSettings()
	defer cleanup()

	body := `{"eventType":"UNKNOWN_EVENT_TYPE","result":{}}`
	c, w := buildWebhookContext(body, testKeyPair.PrivateKey)
	WaffoWebhook(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	respBody := w.Body.String()
	if !strings.Contains(respBody, "success") {
		t.Error("unknown event should return success response (fault tolerance)")
	}
}

// --- Response format validation ---

func TestSendWaffoWebhookResponse(t *testing.T) {
	cfg := config.NewConfigBuilder().
		APIKey("test-api-key").
		PrivateKey(testKeyPair.PrivateKey).
		WaffoPublicKey(testKeyPair.PublicKey).
		MustBuild()
	wh := core.NewWebhookHandler(cfg)

	t.Run("success response", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

		sendWaffoWebhookResponse(c, wh, true, "")

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		respBody := w.Body.String()
		var resp map[string]string
		if err := json.Unmarshal([]byte(respBody), &resp); err != nil {
			t.Fatalf("failed to parse response: %v", err)
		}
		if resp["status"] != "success" {
			t.Errorf("expected status 'success', got %q", resp["status"])
		}

		sig := w.Header().Get("X-SIGNATURE")
		if sig == "" {
			t.Error("success response should have X-SIGNATURE header")
		}
		if !utils.Verify(respBody, sig, testKeyPair.PublicKey) {
			t.Error("success response signature should be verifiable")
		}
	})

	t.Run("failed response", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

		sendWaffoWebhookResponse(c, wh, false, "test error message")

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		respBody := w.Body.String()
		var resp map[string]string
		if err := json.Unmarshal([]byte(respBody), &resp); err != nil {
			t.Fatalf("failed to parse response: %v", err)
		}
		if resp["status"] != "failed" {
			t.Errorf("expected status 'failed', got %q", resp["status"])
		}
		if resp["message"] != "test error message" {
			t.Errorf("expected message 'test error message', got %q", resp["message"])
		}

		sig := w.Header().Get("X-SIGNATURE")
		if sig == "" {
			t.Error("failed response should have X-SIGNATURE header")
		}
		if !utils.Verify(respBody, sig, testKeyPair.PublicKey) {
			t.Error("failed response signature should be verifiable")
		}
	})
}

// --- Webhook payload struct tests ---

func TestWebhookPayloadWithSubInfo_Unmarshal(t *testing.T) {
	t.Run("with subscriptionInfo", func(t *testing.T) {
		payload := `{"eventType":"PAYMENT_NOTIFICATION","result":{"merchantOrderId":"ORD-001","orderStatus":"PAY_SUCCESS","acquiringOrderId":"ACQ-001","subscriptionInfo":{"period":"2","merchantRequest":"SR-1","subscriptionId":"SUB-EXT","subscriptionRequest":"SR-REQ"}}}`
		var parsed webhookPayloadWithSubInfo
		if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
			t.Fatalf("unmarshal failed: %v", err)
		}
		if parsed.EventType != "PAYMENT_NOTIFICATION" {
			t.Errorf("eventType = %q, want PAYMENT_NOTIFICATION", parsed.EventType)
		}
		if parsed.Result.MerchantOrderID != "ORD-001" {
			t.Errorf("merchantOrderId = %q, want ORD-001", parsed.Result.MerchantOrderID)
		}
		if parsed.Result.OrderStatus != "PAY_SUCCESS" {
			t.Errorf("orderStatus = %q, want PAY_SUCCESS", parsed.Result.OrderStatus)
		}
		if parsed.Result.SubscriptionInfo == nil {
			t.Fatal("subscriptionInfo should not be nil")
		}
		if parsed.Result.SubscriptionInfo.Period != "2" {
			t.Errorf("period = %q, want 2", parsed.Result.SubscriptionInfo.Period)
		}
		if parsed.Result.SubscriptionInfo.SubscriptionID != "SUB-EXT" {
			t.Errorf("subscriptionId = %q, want SUB-EXT", parsed.Result.SubscriptionInfo.SubscriptionID)
		}
	})

	t.Run("without subscriptionInfo", func(t *testing.T) {
		payload := `{"eventType":"PAYMENT_NOTIFICATION","result":{"merchantOrderId":"ORD-002","orderStatus":"PAY_SUCCESS"}}`
		var parsed webhookPayloadWithSubInfo
		if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
			t.Fatalf("unmarshal failed: %v", err)
		}
		if parsed.Result.SubscriptionInfo != nil {
			t.Error("subscriptionInfo should be nil for regular payment")
		}
	})
}
