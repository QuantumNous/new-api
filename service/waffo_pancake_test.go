package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupWaffoPancakeTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestWaffoPancakeCreateSessionResponseParsesDocumentedPayload(t *testing.T) {
	var result waffoPancakeCreateSessionResponse
	err := common.Unmarshal([]byte(`{
		"data": {
			"sessionId": "cs_550e8400-e29b-41d4-a716-446655440000",
			"checkoutUrl": "https://checkout.waffo.ai/my-store-abc123/checkout/cs_550e8400-e29b-41d4-a716-446655440000",
			"expiresAt": "2026-01-22T10:30:00.000Z"
		}
	}`), &result)
	require.NoError(t, err)
	require.NotNil(t, result.Data)
	require.Equal(t, "cs_550e8400-e29b-41d4-a716-446655440000", result.Data.SessionID)
	require.Empty(t, result.Data.OrderID)
}

func TestResolveWaffoPancakeTradeNo_RejectsWebhookOrderIDOnly(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	topUp := &model.TopUp{
		UserId:        1,
		Amount:        10,
		Money:         29,
		TradeNo:       "ORD_5dXBtmF2HLlHfbPNm0Wcnz",
		PaymentMethod: model.PaymentMethodWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	tradeNo, err := ResolveWaffoPancakeTradeNo(&waffoPancakeWebhookEvent{
		Data: waffoPancakeWebhookData{
			OrderID: "ORD_5dXBtmF2HLlHfbPNm0Wcnz",
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
}

func TestResolveWaffoPancakeTradeNo_UsesOrderMetadataTradeNo(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	topUp := &model.TopUp{
		UserId:        42,
		Amount:        10,
		Money:         29,
		TradeNo:       "WAFFO_PANCAKE-42-123456-abc123",
		PaymentMethod: model.PaymentMethodWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	var event waffoPancakeWebhookEvent
	require.NoError(t, common.Unmarshal([]byte(`{
		"storeId": "store_123",
		"mode": "test",
		"data": {
			"orderId": "ORD_remote_123",
			"currency": "USD",
			"amount": "29.00",
			"orderMetadata": {
				"trade_no": "WAFFO_PANCAKE-42-123456-abc123",
				"user_id": 42,
				"payment_method": "waffo_pancake",
				"stored_amount": 10,
				"money": "29.00",
				"currency": "USD",
				"store_id": "store_123",
				"product_id": "product_456",
				"mode": "test"
			}
		}
	}`), &event))

	tradeNo, err := ResolveWaffoPancakeTradeNo(&event)
	require.NoError(t, err)
	require.Equal(t, "WAFFO_PANCAKE-42-123456-abc123", tradeNo)
}

func TestResolveWaffoPancakeTradeNo_RejectsMetadataUserMismatch(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	topUp := &model.TopUp{
		UserId:        42,
		Amount:        10,
		Money:         29,
		TradeNo:       "WAFFO_PANCAKE-42-123456-abc123",
		PaymentMethod: model.PaymentMethodWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	var event waffoPancakeWebhookEvent
	require.NoError(t, common.Unmarshal([]byte(`{
		"storeId": "store_123",
		"mode": "test",
		"data": {
			"orderId": "WAFFO_PANCAKE-42-123456-abc123",
			"currency": "USD",
			"amount": "29.00",
			"orderMetadata": {
				"trade_no": "WAFFO_PANCAKE-42-123456-abc123",
				"user_id": 99,
				"payment_method": "waffo_pancake",
				"stored_amount": 10,
				"money": "29.00",
				"currency": "USD",
				"store_id": "store_123",
				"product_id": "product_456",
				"mode": "test"
			}
		}
	}`), &event))

	tradeNo, err := ResolveWaffoPancakeTradeNo(&event)
	require.Error(t, err)
	require.Empty(t, tradeNo)
}

func TestResolveWaffoPancakeTradeNo_RejectsWebhookWithoutMetadata(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	topUp := &model.TopUp{
		UserId:        42,
		Amount:        10,
		Money:         29,
		TradeNo:       "WAFFO_PANCAKE-42-123456-abc123",
		PaymentMethod: model.PaymentMethodWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	tradeNo, err := ResolveWaffoPancakeTradeNo(&waffoPancakeWebhookEvent{
		Data: waffoPancakeWebhookData{
			OrderID: "WAFFO_PANCAKE-42-123456-abc123",
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
}

func TestResolveWaffoPancakeTradeNo_FailsWhenMetadataTradeNoIsUnknown(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	user := &model.User{
		Id:       42,
		Email:    "buyer@example.com",
		Username: "buyer",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(user).Error)

	topUp := &model.TopUp{
		UserId:        user.Id,
		Amount:        10,
		Money:         29,
		TradeNo:       "WAFFO_PANCAKE-42-123456-abc123",
		PaymentMethod: model.PaymentMethodWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	tradeNo, err := ResolveWaffoPancakeTradeNo(&waffoPancakeWebhookEvent{
		StoreID: "store_123",
		Mode:    "test",
		Data: waffoPancakeWebhookData{
			OrderID:    "ORD_remote_123",
			BuyerEmail: user.Email,
			Currency:   "USD",
			Amount:     "29.00",
			OrderMetadata: WaffoPancakeOrderMetadata{
				TradeNo:       "WAFFO_PANCAKE-42-unknown",
				UserID:        42,
				PaymentMethod: model.PaymentMethodWaffoPancake,
				StoredAmount:  int64(10),
				Money:         "29.00",
				Currency:      "USD",
				StoreID:       "store_123",
				ProductID:     "product_456",
				Mode:          "test",
			},
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
}

func TestResolveWaffoPancakeWebhookEnvironment(t *testing.T) {
	originalSandbox := setting.WaffoPancakeSandbox
	t.Cleanup(func() {
		setting.WaffoPancakeSandbox = originalSandbox
	})

	testCases := []struct {
		name     string
		payload  string
		expected string
		sandbox  bool
	}{
		{
			name:     "test mode",
			payload:  `{"mode":"test"}`,
			expected: "test",
		},
		{
			name:     "prod mode",
			payload:  `{"mode":"prod"}`,
			expected: "prod",
		},
		{
			name:     "missing mode falls back to sandbox",
			payload:  `{}`,
			expected: "test",
			sandbox:  true,
		},
		{
			name:     "invalid mode falls back to prod",
			payload:  `{"mode":"staging"}`,
			expected: "prod",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setting.WaffoPancakeSandbox = tc.sandbox
			environment := resolveWaffoPancakeWebhookEnvironment(tc.payload)
			require.Equal(t, tc.expected, environment)
		})
	}
}

func TestVerifyConfiguredWaffoPancakeWebhook_VerifiesXWaffoSignature(t *testing.T) {
	privateKey, publicKey := generateWaffoPancakeWebhookKeyPair(t)
	restoreWaffoPancakeWebhookSettings(t)
	setting.WaffoPancakeSandbox = false
	setting.WaffoPancakeWebhookPublicKey = publicKey

	payload := testWaffoPancakeWebhookPayload()
	signature := signWaffoPancakeWebhookPayload(t, payload, privateKey, strconv.FormatInt(time.Now().UnixMilli(), 10))

	event, err := VerifyConfiguredWaffoPancakeWebhook(payload, signature)
	require.NoError(t, err)
	require.NotNil(t, event)
	require.Equal(t, "order.completed", event.EventType)
	require.Equal(t, "WAFFO_PANCAKE-42-123456-abc123", event.Data.OrderMetadata.TradeNo)
}

func TestVerifyConfiguredWaffoPancakeWebhook_RejectsMissingSignature(t *testing.T) {
	_, publicKey := generateWaffoPancakeWebhookKeyPair(t)
	restoreWaffoPancakeWebhookSettings(t)
	setting.WaffoPancakeSandbox = false
	setting.WaffoPancakeWebhookPublicKey = publicKey

	event, err := VerifyConfiguredWaffoPancakeWebhook(testWaffoPancakeWebhookPayload(), "")
	require.Error(t, err)
	require.Nil(t, event)
	require.Contains(t, err.Error(), "missing X-Waffo-Signature header")
}

func TestVerifyConfiguredWaffoPancakeWebhook_RejectsTamperedPayload(t *testing.T) {
	privateKey, publicKey := generateWaffoPancakeWebhookKeyPair(t)
	restoreWaffoPancakeWebhookSettings(t)
	setting.WaffoPancakeSandbox = false
	setting.WaffoPancakeWebhookPublicKey = publicKey

	payload := testWaffoPancakeWebhookPayload()
	signature := signWaffoPancakeWebhookPayload(t, payload, privateKey, strconv.FormatInt(time.Now().UnixMilli(), 10))
	tamperedPayload := strings.Replace(payload, "WAFFO_PANCAKE-42-123456-abc123", "WAFFO_PANCAKE-42-tampered", 1)

	event, err := VerifyConfiguredWaffoPancakeWebhook(tamperedPayload, signature)
	require.Error(t, err)
	require.Nil(t, event)
	require.Contains(t, err.Error(), "invalid webhook signature")
}

func TestVerifyConfiguredWaffoPancakeWebhook_RejectsWrongWebhookPublicKey(t *testing.T) {
	privateKey, _ := generateWaffoPancakeWebhookKeyPair(t)
	_, wrongPublicKey := generateWaffoPancakeWebhookKeyPair(t)
	restoreWaffoPancakeWebhookSettings(t)
	setting.WaffoPancakeSandbox = false
	setting.WaffoPancakeWebhookPublicKey = wrongPublicKey

	payload := testWaffoPancakeWebhookPayload()
	signature := signWaffoPancakeWebhookPayload(t, payload, privateKey, strconv.FormatInt(time.Now().UnixMilli(), 10))

	event, err := VerifyConfiguredWaffoPancakeWebhook(payload, signature)
	require.Error(t, err)
	require.Nil(t, event)
	require.Contains(t, err.Error(), "invalid webhook signature")
}

func TestVerifyConfiguredWaffoPancakeWebhook_RejectsInvalidWebhookPublicKey(t *testing.T) {
	privateKey, _ := generateWaffoPancakeWebhookKeyPair(t)
	restoreWaffoPancakeWebhookSettings(t)
	setting.WaffoPancakeSandbox = false
	setting.WaffoPancakeWebhookPublicKey = "not-a-public-key"

	payload := testWaffoPancakeWebhookPayload()
	signature := signWaffoPancakeWebhookPayload(t, payload, privateKey, strconv.FormatInt(time.Now().UnixMilli(), 10))

	event, err := VerifyConfiguredWaffoPancakeWebhook(payload, signature)
	require.Error(t, err)
	require.Nil(t, event)
	require.Contains(t, err.Error(), "invalid webhook signature")
}

func TestVerifyConfiguredWaffoPancakeWebhook_RejectsExpiredTimestamp(t *testing.T) {
	privateKey, publicKey := generateWaffoPancakeWebhookKeyPair(t)
	restoreWaffoPancakeWebhookSettings(t)
	setting.WaffoPancakeSandbox = false
	setting.WaffoPancakeWebhookPublicKey = publicKey

	payload := testWaffoPancakeWebhookPayload()
	oldTimestamp := strconv.FormatInt(time.Now().Add(-waffoPancakeDefaultTolerance-time.Minute).UnixMilli(), 10)
	signature := signWaffoPancakeWebhookPayload(t, payload, privateKey, oldTimestamp)

	event, err := VerifyConfiguredWaffoPancakeWebhook(payload, signature)
	require.Error(t, err)
	require.Nil(t, event)
	require.Contains(t, err.Error(), "webhook timestamp outside tolerance window")
}

func TestVerifyConfiguredWaffoPancakeWebhook_RejectsSandboxModeMismatch(t *testing.T) {
	privateKey, publicKey := generateWaffoPancakeWebhookKeyPair(t)
	restoreWaffoPancakeWebhookSettings(t)
	setting.WaffoPancakeSandbox = false
	setting.WaffoPancakeWebhookTestKey = publicKey

	payload := strings.Replace(testWaffoPancakeWebhookPayload(), `"mode": "prod"`, `"mode": "test"`, 2)
	signature := signWaffoPancakeWebhookPayload(t, payload, privateKey, strconv.FormatInt(time.Now().UnixMilli(), 10))

	event, err := VerifyConfiguredWaffoPancakeWebhook(payload, signature)
	require.Error(t, err)
	require.Nil(t, event)
	require.Contains(t, err.Error(), "webhook environment mismatch")
}

func generateWaffoPancakeWebhookKeyPair(t *testing.T) (*rsa.PrivateKey, string) {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	publicKeyDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	require.NoError(t, err)

	publicKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyDER,
	})
	require.NotEmpty(t, publicKeyPEM)

	return privateKey, string(publicKeyPEM)
}

func signWaffoPancakeWebhookPayload(t *testing.T, payload string, privateKey *rsa.PrivateKey, timestamp string) string {
	t.Helper()

	signatureInput := fmt.Sprintf("%s.%s", timestamp, payload)
	digest := sha256.Sum256([]byte(signatureInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, digest[:])
	require.NoError(t, err)

	return fmt.Sprintf("t=%s,v1=%s", timestamp, base64.StdEncoding.EncodeToString(signature))
}

func restoreWaffoPancakeWebhookSettings(t *testing.T) {
	t.Helper()

	originalSandbox := setting.WaffoPancakeSandbox
	originalWebhookPublicKey := setting.WaffoPancakeWebhookPublicKey
	originalWebhookTestKey := setting.WaffoPancakeWebhookTestKey
	t.Cleanup(func() {
		setting.WaffoPancakeSandbox = originalSandbox
		setting.WaffoPancakeWebhookPublicKey = originalWebhookPublicKey
		setting.WaffoPancakeWebhookTestKey = originalWebhookTestKey
	})
}

func testWaffoPancakeWebhookPayload() string {
	return `{
		"id": "evt_123",
		"eventType": "order.completed",
		"storeId": "store_123",
		"mode": "prod",
		"data": {
			"orderId": "ORD_remote_123",
			"currency": "USD",
			"amount": "29.00",
			"orderMetadata": {
				"trade_no": "WAFFO_PANCAKE-42-123456-abc123",
				"user_id": 42,
				"payment_method": "waffo_pancake",
				"requested_amount": 10,
				"stored_amount": 10,
				"money": "29.00",
				"currency": "USD",
				"store_id": "store_123",
				"product_id": "product_456",
				"mode": "prod"
			}
		}
	}`
}
