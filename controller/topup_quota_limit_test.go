package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestTopUpCashbackPreviewValidatesSelectionAndReturnsOnlyPayerEstimate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.CashbackReward{}))
	oldQuota, oldProducts, oldCreemKey := common.QuotaPerUnit, setting.CreemProducts, setting.CreemApiKey
	oldDisplay := operation_setting.GetGeneralSetting().QuotaDisplayType
	oldMin, oldStripeMin := operation_setting.MinTopUp, setting.StripeMinTopUp
	oldStripeKey, oldStripeWebhook, oldStripePrice := setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId
	oldPayAddress, oldEpayID, oldEpayKey := operation_setting.PayAddress, operation_setting.EpayId, operation_setting.EpayKey
	oldMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		common.QuotaPerUnit, setting.CreemProducts, setting.CreemApiKey = oldQuota, oldProducts, oldCreemKey
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplay
		operation_setting.MinTopUp, setting.StripeMinTopUp = oldMin, oldStripeMin
		setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = oldStripeKey, oldStripeWebhook, oldStripePrice
		operation_setting.PayAddress, operation_setting.EpayId, operation_setting.EpayKey = oldPayAddress, oldEpayID, oldEpayKey
		operation_setting.PayMethods = oldMethods
	})
	common.QuotaPerUnit = 500_000
	setting.StripeMinTopUp = 1
	setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = "test", "test", "test"
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	setting.CreemProducts = `[{"productId":"prod_test","name":"Bundle","quota":250,"price":1.00,"currency":"USD"}]`
	setting.CreemApiKey = "test-key"
	payer := model.User{Username: "preview-payer", AffCode: "preview-payer", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&payer).Error)
	now := time.Now().Unix()
	config := operation_setting.DefaultCashbackSetting()
	config.InviteeEnabled = true
	config.InviteeStrategy = operation_setting.CashbackStrategyPerHundred
	config.InviteeFixedPerHundred = 20
	config.MaxRewardQuota = 100_000_000
	config.DailyRewardQuota = 100_000_000
	config.FirstEnabledAt = now - 100
	require.NoError(t, model.SaveCashbackSetting(config))
	require.NoError(t, model.DB.Create(&model.CashbackCampaign{StartAt: now - 100, EndAt: now + 3600, MaxRewardsPerUser: 2, CreatedBy: 1}).Error)

	request := func(query string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/cashback-preview?"+query, nil)
		ctx.Set("id", payer.Id)
		PreviewTopUpCashback(ctx)
		return recorder
	}
	for _, query := range []string{"", "amount=-1", "amount=not-a-number", "amount=9999999999999999999", "amount=100&product_id=prod_test", "amount=1&amount=2", "product_id=unknown"} {
		assert.Equal(t, http.StatusBadRequest, request(query).Code, query)
	}
	response := request("amount=250")
	require.Equal(t, http.StatusOK, response.Code)
	var body struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "estimated", body.Data["status"])
	assert.Equal(t, float64(20_000_000), body.Data["reward_quota"])
	assert.NotContains(t, string(response.Body.Bytes()), "request_ip")
	assert.NotContains(t, string(response.Body.Bytes()), "risk")
	assert.NotContains(t, string(response.Body.Bytes()), "inviter")

	// Product quota, not the displayed Creem checkout price or standard amount.
	// The same product is only eligible while Creem checkout is enabled.
	response = request("product_id=prod_test")
	require.Equal(t, http.StatusOK, response.Code)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, float64(40), body.Data["reward_quota"])

	// Token-display checkout normalizes to whole quota units before applying
	// the fixed per-100 rule, while the Creem product still uses raw quota.
	common.QuotaPerUnit = 100
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	response = request("amount=250")
	require.Equal(t, http.StatusOK, response.Code)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, float64(40), body.Data["reward_quota"])
	assert.Equal(t, http.StatusBadRequest, request("amount=99").Code)

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	common.QuotaPerUnit = 500_000
	operation_setting.MinTopUp = 10
	operation_setting.PayAddress, operation_setting.EpayId, operation_setting.EpayKey = "https://example.test", "test", "test"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay", "name": "Alipay"}}
	response = request("amount=5") // Stripe permits this even though Epay requires 10.
	require.Equal(t, http.StatusOK, response.Code)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "below_minimum", body.Data["status"])
	setting.StripeMinTopUp = 20
	assert.Equal(t, http.StatusBadRequest, request("amount=5").Code) // Neither enabled checkout accepts 5.
	operation_setting.PayAddress = ""
	assert.Equal(t, http.StatusBadRequest, request("amount=10").Code) // Only Stripe remains, with minimum 20.
}

func TestTopUpQuotaValidation(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	oldDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	common.QuotaPerUnit = 500000
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplayType
	})

	testCases := []struct {
		name        string
		displayType string
		amount      int64
		wantQuota   int
		wantErr     bool
	}{
		{
			name:        "currency amount below limit",
			displayType: operation_setting.QuotaDisplayTypeUSD,
			amount:      4294,
			wantQuota:   2_147_000_000,
		},
		{
			name:        "currency amount above limit",
			displayType: operation_setting.QuotaDisplayTypeUSD,
			amount:      4295,
			wantQuota:   2_147_500_000,
		},
		{
			name:        "token amount preserves settlement truncation",
			displayType: operation_setting.QuotaDisplayTypeTokens,
			amount:      2_147_500_000,
			wantQuota:   2_147_500_000,
		},
		{
			name:        "token amount above legacy int32 range",
			displayType: operation_setting.QuotaDisplayTypeTokens,
			amount:      4_294_500_000,
			wantQuota:   4_294_500_000,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = tc.displayType
			quota, err := getTopUpQuota(tc.amount)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantQuota, quota)
		})
	}
}

func TestCashbackBaseQuotaUsesFaceValueAcrossOnlineProviders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupCashbackConfigControllerTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.CashbackDeviceLink{}))
	oldQuotaPerUnit := common.QuotaPerUnit
	oldDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	common.QuotaPerUnit = 500000
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplayType
	})

	for _, provider := range []string{"epay", "stripe", "waffo", "waffo_pancake"} {
		t.Run(provider, func(t *testing.T) {
			quota, err := cashbackBaseQuotaFromTopUpAmount(100)
			require.NoError(t, err)
			assert.Equal(t, 50_000_000, quota)
		})
	}
	creemQuota, err := cashbackBaseQuotaFromWalletQuota(100)
	require.NoError(t, err)
	assert.Equal(t, 100, creemQuota)

	for _, tc := range []struct {
		name, displayType, provider, factor string
		amount, base, face                  int64
		productQuota                        bool
	}{
		{"epay", operation_setting.QuotaDisplayTypeUSD, model.PaymentProviderEpay, "500000", 250, 125_000_000, 250, false},
		{"stripe", operation_setting.QuotaDisplayTypeUSD, model.PaymentProviderStripe, "500000", 250, 125_000_000, 250, false},
		{"waffo", operation_setting.QuotaDisplayTypeUSD, model.PaymentProviderWaffo, "500000", 250, 125_000_000, 250, false},
		{"pancake", operation_setting.QuotaDisplayTypeUSD, model.PaymentProviderWaffoPancake, "500000", 250, 125_000_000, 250, false},
		{"token_normalized", operation_setting.QuotaDisplayTypeTokens, model.PaymentProviderEpay, "1", 125_000_001, 125_000_000, 125_000_000, false},
		{"creem", operation_setting.QuotaDisplayTypeTokens, model.PaymentProviderCreem, "1", 250, 250, 250, true},
	} {
		t.Run(tc.name+" checkout evidence", func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = tc.displayType
			order := model.TopUp{UserId: 1, TradeNo: "face-basis-" + tc.name,
				PaymentProvider: tc.provider, CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending}
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/pay", nil)
			require.NoError(t, insertOnlineTopUpWithCashbackContext(ctx, &order, int(tc.base), tc.amount, tc.productQuota))
			var evidence model.CashbackOrderContext
			require.NoError(t, model.DB.Where("top_up_id = ?", order.Id).First(&evidence).Error)
			assert.Equal(t, tc.face, evidence.FaceAmount)
			assert.Equal(t, tc.factor, evidence.QuotaPerFaceUnit)
			assert.Equal(t, int(tc.base), evidence.BaseQuota)
		})
	}
}

func TestValidateTopUpQuotaReturnsMaximumAmount(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	oldDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	common.QuotaPerUnit = 500000
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplayType
	})

	maxAmount := decimal.NewFromInt(common.MaxWalletQuota).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		Floor().IntPart()

	_, err := validateTopUpQuota(maxAmount)
	require.NoError(t, err)
	_, err = validateTopUpQuota(maxAmount + 1)
	require.EqualError(t, err, fmt.Sprintf("Top-up amount cannot exceed %d", maxAmount))
}

func TestRequestAmountRejectsTopUpThatCannotBeSettled(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	oldDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	common.QuotaPerUnit = 500000
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplayType
	})

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	maxAmount := decimal.NewFromInt(common.MaxWalletQuota).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		Floor().IntPart()
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/user/amount",
		strings.NewReader(fmt.Sprintf(`{"amount":%d}`, maxAmount+1)),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	RequestAmount(ctx)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, fmt.Sprintf(`{"message":"error","data":"Top-up amount cannot exceed %d","message_key":"Top-up amount cannot exceed {{max}}","message_params":{"max":%d}}`, maxAmount, maxAmount), recorder.Body.String())
}

func TestRequestAmountRejectsTopUpThatWouldOverflowWallet(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	oldDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	oldDB := model.DB
	common.QuotaPerUnit = 500000
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	model.DB = db
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
		operation_setting.GetGeneralSetting().QuotaDisplayType = oldDisplayType
		model.DB = oldDB
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	require.NoError(t, model.DB.Create(&model.User{
		Id:       42,
		Username: "topup_capacity_user",
		Quota:    common.MaxWalletQuota - 100_000,
		Status:   common.UserStatusEnabled,
	}).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", 42)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/user/amount",
		strings.NewReader(`{"amount":1}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	RequestAmount(ctx)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, `{"message":"error","data":"Top-up quota limit exceeded","message_key":"Top-up quota limit exceeded"}`, recorder.Body.String())
}

func TestValidateCreditedQuotaRejectsOverflow(t *testing.T) {
	_, err := validateCreditedQuota(decimal.NewFromInt(int64(common.MaxWalletQuota / 2)))
	require.NoError(t, err)
	_, err = validateCreditedQuota(decimal.Zero)
	require.EqualError(t, err, "Top-up quota must be greater than 0")
	_, err = validateCreditedQuota(decimal.NewFromInt(common.MaxWalletQuota + 1))
	require.EqualError(
		t,
		err,
		"Top-up quota exceeds the range the system can represent",
	)
}

func TestStripeCreditedQuotaIncludesGroupRatio(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	oldTopupGroupRatio := common.TopupGroupRatio2JSONString()
	common.QuotaPerUnit = 500000
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"vip":2}`))
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(oldTopupGroupRatio))
	})

	_, err := validateCreditedQuota(getStripeCreditedQuota(2147, "vip"))
	require.NoError(t, err)
	_, err = validateCreditedQuota(getStripeCreditedQuota(2148, "vip"))
	require.NoError(t, err)
	_, err = validateCreditedQuota(getStripeCreditedQuota(int64(common.MaxWalletQuota), "vip"))
	require.Error(t, err)

	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"free":0}`))
	assert.True(t, decimal.NewFromInt(500000).Equal(getStripeCreditedQuota(1, "free")))
}
