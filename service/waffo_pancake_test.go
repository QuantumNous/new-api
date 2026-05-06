package service

import (
	"fmt"
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

func TestResolveWaffoPancakeTradeNo_UsesWebhookOrderIDWhenLocalOrderExists(t *testing.T) {
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
	require.NoError(t, err)
	require.Equal(t, "ORD_5dXBtmF2HLlHfbPNm0Wcnz", tradeNo)
}

func TestResolveWaffoPancakeTradeNo_FailsWhenWebhookOrderIDIsUnknown(t *testing.T) {
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
		Data: waffoPancakeWebhookData{
			OrderID:    "ORD_unknown",
			BuyerEmail: user.Email,
			Amount:     "29.00",
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
