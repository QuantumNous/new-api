package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestFormatWaffoPancakeAmount_UsesDisplayPriceString(t *testing.T) {
	testCases := []struct {
		name     string
		amount   float64
		expected string
	}{
		{name: "whole amount", amount: 29, expected: "29.00"},
		{name: "decimal amount", amount: 29.9, expected: "29.90"},
		{name: "round half up to cents", amount: 29.999, expected: "30.00"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, formatWaffoPancakeAmount(tc.amount))
		})
	}
}

func TestGetWaffoPancakePayMoney(t *testing.T) {
	originalUnitPrice := setting.WaffoPancakeUnitPrice
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalDiscounts := make(map[int]float64, len(operation_setting.GetPaymentSetting().AmountDiscount))
	for k, v := range operation_setting.GetPaymentSetting().AmountDiscount {
		originalDiscounts[k] = v
	}
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()

	t.Cleanup(func() {
		setting.WaffoPancakeUnitPrice = originalUnitPrice
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	setting.WaffoPancakeUnitPrice = 2.5
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{
		10:                           0.8,
		int(common.QuotaPerUnit * 3): 0.5,
		20:                           0,
	}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"vip":1.2}`))

	testCases := []struct {
		name             string
		amount           int64
		group            string
		quotaDisplayType string
		expected         float64
	}{
		{
			name:             "currency display applies unit price group ratio and discount",
			amount:           10,
			group:            "vip",
			quotaDisplayType: operation_setting.QuotaDisplayTypeUSD,
			expected:         24,
		},
		{
			name:             "tokens display converts quota to display units before pricing",
			amount:           int64(common.QuotaPerUnit * 3),
			group:            "vip",
			quotaDisplayType: operation_setting.QuotaDisplayTypeTokens,
			expected:         4.5,
		},
		{
			name:             "non-positive discount falls back to no discount",
			amount:           20,
			group:            "default",
			quotaDisplayType: operation_setting.QuotaDisplayTypeUSD,
			expected:         50,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = tc.quotaDisplayType
			actual := getWaffoPancakePayMoney(tc.amount, tc.group)
			require.InDelta(t, tc.expected, actual, 0.000001)
		})
	}
}

func setupWaffoPancakeWebhookTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedis := common.RedisEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}))
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false

	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedis
	})
	return db
}

// An order.completed webhook must credit the buyer even when Pancake echoes the
// buyer identity back as the account email instead of the canonical
// new-api-user-<id> we sent at checkout (#6633). Before the fix the email form
// failed the strict identity check and the paid order was silently dropped.
func TestWaffoPancakeWebhookResolvesBuyerIdentityAndCreditsUser(t *testing.T) {
	const userID = 4242
	const userEmail = "buyer@example.com"
	const tradeNo = "WAFFO_PANCAKE-4242-1700000000000-abcdef"
	const topUpAmount = int64(10)

	expectedCredit, err := common.QuotaFromDecimalStrict(
		decimal.NewFromInt(topUpAmount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	)
	require.NoError(t, err)
	require.Greater(t, expectedCredit, 0)

	testCases := []struct {
		name          string
		buyerIdentity string
	}{
		{name: "canonical identity", buyerIdentity: service.WaffoPancakeBuyerIdentityFromUserID(userID)},
		{name: "email identity", buyerIdentity: userEmail},
		{name: "email identity different case", buyerIdentity: "BUYER@Example.com"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			db := setupWaffoPancakeWebhookTestDB(t)
			require.NoError(t, db.Create(&model.User{
				Id: userID, Username: "buyer", Email: userEmail,
				Status: common.UserStatusEnabled, Group: "default", Quota: 0,
			}).Error)
			require.NoError(t, db.Create(&model.TopUp{
				UserId: userID, Amount: topUpAmount, Money: 20, TradeNo: tradeNo,
				PaymentMethod: model.PaymentMethodWaffoPancake, PaymentProvider: model.PaymentProviderWaffoPancake,
				Status: common.TopUpStatusPending,
			}).Error)

			event := &service.WaffoPancakeWebhookEvent{
				EventType: "order.completed",
				Data: service.WaffoPancakeWebhookData{
					OrderMerchantExternalID:       tradeNo,
					MerchantProvidedBuyerIdentity: tc.buyerIdentity,
				},
			}

			resolved, err := service.ResolveWaffoPancakeTradeNo(event)
			require.NoError(t, err)
			require.Equal(t, tradeNo, resolved)

			require.NoError(t, model.RechargeWaffoPancake(resolved))

			var user model.User
			require.NoError(t, db.First(&user, "id = ?", userID).Error)
			assert.Equal(t, expectedCredit, user.Quota)

			var topUp model.TopUp
			require.NoError(t, db.First(&topUp, "trade_no = ?", tradeNo).Error)
			assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
		})
	}
}

// A genuinely unprocessable order.completed webhook (an unknown order or an
// identity that is neither the canonical id nor the order owner's email) must
// fail to resolve. WaffoPancakeWebhook turns that error into an HTTP 5xx so
// Waffo retries and the failure stays visible, instead of a 200 that silently
// drops a paid order (#6633).
func TestWaffoPancakeWebhookRejectsUnprocessableEvent(t *testing.T) {
	const userID = 5252
	const tradeNo = "WAFFO_PANCAKE-5252-1700000000000-zzzzzz"

	testCases := []struct {
		name  string
		event *service.WaffoPancakeWebhookEvent
	}{
		{
			name: "identity belongs to a different buyer",
			event: &service.WaffoPancakeWebhookEvent{
				EventType: "order.completed",
				Data: service.WaffoPancakeWebhookData{
					OrderMerchantExternalID:       tradeNo,
					MerchantProvidedBuyerIdentity: "someone-else@example.com",
				},
			},
		},
		{
			name: "order not found",
			event: &service.WaffoPancakeWebhookEvent{
				EventType: "order.completed",
				Data: service.WaffoPancakeWebhookData{
					OrderMerchantExternalID:       "WAFFO_PANCAKE-does-not-exist",
					MerchantProvidedBuyerIdentity: service.WaffoPancakeBuyerIdentityFromUserID(userID),
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			db := setupWaffoPancakeWebhookTestDB(t)
			require.NoError(t, db.Create(&model.User{
				Id: userID, Username: "owner", Email: "owner@example.com",
				Status: common.UserStatusEnabled, Group: "default", Quota: 0,
			}).Error)
			require.NoError(t, db.Create(&model.TopUp{
				UserId: userID, Amount: 5, Money: 10, TradeNo: tradeNo,
				PaymentMethod: model.PaymentMethodWaffoPancake, PaymentProvider: model.PaymentProviderWaffoPancake,
				Status: common.TopUpStatusPending,
			}).Error)

			_, err := service.ResolveWaffoPancakeTradeNo(tc.event)
			require.Error(t, err)

			// The order stays pending and the owner is not credited.
			var topUp model.TopUp
			require.NoError(t, db.First(&topUp, "trade_no = ?", tradeNo).Error)
			assert.Equal(t, common.TopUpStatusPending, topUp.Status)

			var user model.User
			require.NoError(t, db.First(&user, "id = ?", userID).Error)
			assert.Equal(t, 0, user.Quota)
		})
	}
}
