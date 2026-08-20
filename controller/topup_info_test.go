package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestBuildStripeTopUpPriceIDsUsesConfiguredAmountOptions(t *testing.T) {
	originalPriceIDs := setting.StripeTopUpPriceIds
	t.Cleanup(func() { setting.StripeTopUpPriceIds = originalPriceIDs })
	setting.StripeTopUpPriceIds = `{"20":"price_topup_20","200":"price_topup_200"}`

	require.Equal(t, map[int]string{
		20: "price_topup_20",
	}, buildStripeTopUpPriceIDs([]int{20, 50}))
}

func TestBuildStripeTopUpCurrencyPricesFiltersUnconfiguredTiers(t *testing.T) {
	original := setting.StripeTopUpPriceIds
	t.Cleanup(func() { setting.StripeTopUpPriceIds = original })
	setting.StripeTopUpPriceIds = `{"20":"price_topup_20"}`

	require.Equal(t, map[string]map[int]int64{
		"USD": {20: 2000},
		"JPY": {20: 3000},
		"BRL": {20: 9990},
		"INR": {20: 179900},
	}, buildStripeTopUpCurrencyPrices([]int{20, 50}))
}

func TestGetTopUpInfoExposesStripePriceIDsByAmount(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	originalAmountOptions := paymentSetting.AmountOptions
	originalBonusLimit := paymentSetting.AmountBonusLimit
	originalPriceIDs := setting.StripeTopUpPriceIds
	t.Cleanup(func() {
		paymentSetting.AmountOptions = originalAmountOptions
		paymentSetting.AmountBonusLimit = originalBonusLimit
		setting.StripeTopUpPriceIds = originalPriceIDs
	})
	paymentSetting.AmountOptions = []int{20, 50}
	paymentSetting.AmountBonusLimit = map[int]int{}
	setting.StripeTopUpPriceIds = `{"20":"price_topup_20","50":"price_topup_50"}`

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)

	GetTopUpInfo(ctx)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			StripePriceIDs       map[string]string           `json:"stripe_price_ids"`
			StripeCurrencyPrices map[string]map[string]int64 `json:"stripe_currency_prices"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, map[string]string{
		"20": "price_topup_20",
		"50": "price_topup_50",
	}, response.Data.StripePriceIDs)
	require.Equal(t, map[string]map[string]int64{
		"USD": {"20": 2000, "50": 5000},
		"JPY": {"20": 3000, "50": 7500},
		"BRL": {"20": 9990, "50": 24990},
		"INR": {"20": 179900, "50": 449900},
	}, response.Data.StripeCurrencyPrices)
}
