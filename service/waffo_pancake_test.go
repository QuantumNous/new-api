package service

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
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

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.SubscriptionOrder{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestResolveWaffoPancakeTradeNo_UsesWebhookOrderIDWhenLocalOrderExists(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	topUp := &model.TopUp{
		UserId:        1,
		Amount:        10,
		Money:         29,
		TradeNo:       "ORD_5dXBtmF2HLlHfbPNm0Wcnz",
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	tradeNo, err := ResolveWaffoPancakeTradeNo(&WaffoPancakeWebhookEvent{
		Data: WaffoPancakeWebhookData{
			OrderID:                       "ORD_5dXBtmF2HLlHfbPNm0Wcnz",
			MerchantProvidedBuyerIdentity: WaffoPancakeBuyerIdentityFromUserID(topUp.UserId),
		},
	})
	require.NoError(t, err)
	require.Equal(t, "ORD_5dXBtmF2HLlHfbPNm0Wcnz", tradeNo)
}

func TestResolveWaffoPancakeTradeNo_RejectsBuyerIdentityMismatch(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	topUp := &model.TopUp{
		UserId:        42,
		Amount:        10,
		Money:         29,
		TradeNo:       "ORD_identity_mismatch_case",
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	// Webhook reports the right order but a different buyer — could be a
	// crossed-wires bug or a tampered payload. Either way: reject.
	tradeNo, err := ResolveWaffoPancakeTradeNo(&WaffoPancakeWebhookEvent{
		Data: WaffoPancakeWebhookData{
			OrderID:                       "ORD_identity_mismatch_case",
			MerchantProvidedBuyerIdentity: WaffoPancakeBuyerIdentityFromUserID(99), // wrong user
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
	require.Contains(t, err.Error(), "buyer identity mismatch")
}

func TestResolveWaffoPancakeTradeNo_RejectsMissingBuyerIdentity(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	topUp := &model.TopUp{
		UserId:        7,
		Amount:        10,
		Money:         29,
		TradeNo:       "ORD_missing_identity",
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	// An empty MerchantProvidedBuyerIdentity means the order was either created
	// via the (now-deprecated) anonymous flow or the field was stripped — also
	// reject so that we never credit anonymous orders to a specific user.
	tradeNo, err := ResolveWaffoPancakeTradeNo(&WaffoPancakeWebhookEvent{
		Data: WaffoPancakeWebhookData{
			OrderID: "ORD_missing_identity",
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
	require.Contains(t, err.Error(), "buyer identity mismatch")
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
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)

	tradeNo, err := ResolveWaffoPancakeTradeNo(&WaffoPancakeWebhookEvent{
		Data: WaffoPancakeWebhookData{
			OrderID:    "ORD_unknown",
			BuyerEmail: user.Email,
			Amount:     "29.00",
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
}

// Parity tests for ResolveWaffoPancakeSubscriptionTradeNo — same four cases
// as the TopUp resolver above, exercised against SubscriptionOrder records.
// Drift between the two webhook flows is a real risk because they share
// the same buyer-identity defence-in-depth pattern.

func TestResolveWaffoPancakeSubscriptionTradeNo_UsesWebhookOrderIDWhenLocalOrderExists(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	order := &model.SubscriptionOrder{
		UserId:          1,
		PlanId:          5,
		Money:           29,
		TradeNo:         "WAFFO_PANCAKE_SUB-1-1700000000-abc123",
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)

	tradeNo, err := ResolveWaffoPancakeSubscriptionTradeNo(&WaffoPancakeWebhookEvent{
		Data: WaffoPancakeWebhookData{
			OrderID:                       "WAFFO_PANCAKE_SUB-1-1700000000-abc123",
			MerchantProvidedBuyerIdentity: WaffoPancakeBuyerIdentityFromUserID(order.UserId),
		},
	})
	require.NoError(t, err)
	require.Equal(t, "WAFFO_PANCAKE_SUB-1-1700000000-abc123", tradeNo)
}

func TestResolveWaffoPancakeSubscriptionTradeNo_RejectsBuyerIdentityMismatch(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	order := &model.SubscriptionOrder{
		UserId:          42,
		PlanId:          5,
		Money:           29,
		TradeNo:         "WAFFO_PANCAKE_SUB-42-mismatch",
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)

	tradeNo, err := ResolveWaffoPancakeSubscriptionTradeNo(&WaffoPancakeWebhookEvent{
		Data: WaffoPancakeWebhookData{
			OrderID:                       "WAFFO_PANCAKE_SUB-42-mismatch",
			MerchantProvidedBuyerIdentity: WaffoPancakeBuyerIdentityFromUserID(99), // wrong user
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
	require.Contains(t, err.Error(), "buyer identity mismatch")
}

func TestResolveWaffoPancakeSubscriptionTradeNo_RejectsMissingBuyerIdentity(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	order := &model.SubscriptionOrder{
		UserId:          7,
		PlanId:          5,
		Money:           29,
		TradeNo:         "WAFFO_PANCAKE_SUB-7-missing-identity",
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)

	tradeNo, err := ResolveWaffoPancakeSubscriptionTradeNo(&WaffoPancakeWebhookEvent{
		Data: WaffoPancakeWebhookData{
			OrderID: "WAFFO_PANCAKE_SUB-7-missing-identity",
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
	require.Contains(t, err.Error(), "buyer identity mismatch")
}

func TestResolveWaffoPancakeSubscriptionTradeNo_FailsWhenWebhookOrderIDIsUnknown(t *testing.T) {
	db := setupWaffoPancakeTestDB(t)

	order := &model.SubscriptionOrder{
		UserId:          42,
		PlanId:          5,
		Money:           29,
		TradeNo:         "WAFFO_PANCAKE_SUB-42-real-order",
		PaymentMethod:   model.PaymentMethodWaffoPancake,
		PaymentProvider: model.PaymentProviderWaffoPancake,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(order).Error)

	tradeNo, err := ResolveWaffoPancakeSubscriptionTradeNo(&WaffoPancakeWebhookEvent{
		Data: WaffoPancakeWebhookData{
			OrderID: "WAFFO_PANCAKE_SUB-unknown",
		},
	})
	require.Error(t, err)
	require.Empty(t, tradeNo)
}
