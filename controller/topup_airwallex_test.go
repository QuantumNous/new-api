package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestVerifyAirwallexSignature(t *testing.T) {
	secret := "whsec_test_airwallex_42"
	timestamp := "1716257260"
	body := `{"name":"payment_intent.succeeded","data":{"object":{"id":"int_x","merchant_order_id":"axw_abc","amount":12.34,"currency":"AUD","status":"SUCCEEDED"}}}`

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write([]byte(body))
	good := hex.EncodeToString(mac.Sum(nil))

	t.Run("happy path", func(t *testing.T) {
		require.True(t, verifyAirwallexSignature(timestamp, body, good, secret))
	})

	t.Run("tampered body fails", func(t *testing.T) {
		require.False(t, verifyAirwallexSignature(timestamp, body+" ", good, secret))
	})

	t.Run("tampered timestamp fails", func(t *testing.T) {
		require.False(t, verifyAirwallexSignature(timestamp+"0", body, good, secret))
	})

	t.Run("wrong secret fails", func(t *testing.T) {
		require.False(t, verifyAirwallexSignature(timestamp, body, good, "different_secret"))
	})

	t.Run("missing secret rejects", func(t *testing.T) {
		require.False(t, verifyAirwallexSignature(timestamp, body, good, ""))
	})

	t.Run("missing signature rejects", func(t *testing.T) {
		require.False(t, verifyAirwallexSignature(timestamp, body, "", secret))
	})

	t.Run("missing timestamp rejects", func(t *testing.T) {
		require.False(t, verifyAirwallexSignature("", body, good, secret))
	})
}

func TestParseAirwallexCurrencies(t *testing.T) {
	original := setting.AirwallexCurrencies
	t.Cleanup(func() { setting.AirwallexCurrencies = original })

	t.Run("empty string falls back to AUD", func(t *testing.T) {
		setting.AirwallexCurrencies = ""
		out := parseAirwallexCurrencies()
		require.Len(t, out, 1)
		require.Equal(t, "AUD", out[0].Currency)
		require.Equal(t, 1.5, out[0].UnitPrice)
		require.Equal(t, 5, out[0].MinTopUp)
	})

	t.Run("empty array falls back to AUD", func(t *testing.T) {
		setting.AirwallexCurrencies = "[]"
		out := parseAirwallexCurrencies()
		require.Len(t, out, 1)
		require.Equal(t, "AUD", out[0].Currency)
	})

	t.Run("malformed JSON falls back to AUD", func(t *testing.T) {
		setting.AirwallexCurrencies = `{not valid json`
		out := parseAirwallexCurrencies()
		require.Len(t, out, 1)
		require.Equal(t, "AUD", out[0].Currency)
	})

	t.Run("valid JSON parses every row", func(t *testing.T) {
		setting.AirwallexCurrencies = `[{"currency":"AUD","unit_price":1.5,"min_topup":5},{"currency":"USD","unit_price":1.0,"min_topup":5},{"currency":"CNY","unit_price":7.2,"min_topup":40}]`
		out := parseAirwallexCurrencies()
		require.Len(t, out, 3)
		require.Equal(t, "CNY", out[2].Currency)
		require.InDelta(t, 7.2, out[2].UnitPrice, 1e-9)
		require.Equal(t, 40, out[2].MinTopUp)
	})
}

func TestFindAirwallexCurrency(t *testing.T) {
	original := setting.AirwallexCurrencies
	t.Cleanup(func() { setting.AirwallexCurrencies = original })

	setting.AirwallexCurrencies = `[{"currency":"AUD","unit_price":1.5,"min_topup":5},{"currency":"USD","unit_price":1.0,"min_topup":5}]`

	t.Run("case insensitive lookup", func(t *testing.T) {
		got := findAirwallexCurrency("aud")
		require.NotNil(t, got)
		require.Equal(t, "AUD", got.Currency)
	})

	t.Run("whitespace tolerant", func(t *testing.T) {
		got := findAirwallexCurrency("  USD  ")
		require.NotNil(t, got)
		require.Equal(t, "USD", got.Currency)
	})

	t.Run("unknown returns nil", func(t *testing.T) {
		require.Nil(t, findAirwallexCurrency("JPY"))
	})

	t.Run("empty returns nil", func(t *testing.T) {
		require.Nil(t, findAirwallexCurrency(""))
	})
}

func TestComputeAirwallexPayMoney(t *testing.T) {
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalDiscounts := make(map[int]float64, len(operation_setting.GetPaymentSetting().AmountDiscount))
	for k, v := range operation_setting.GetPaymentSetting().AmountDiscount {
		originalDiscounts[k] = v
	}
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()

	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"vip":1.2}`))
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{
		10: 0.8,
		20: 0,
	}

	aud := &AirwallexCurrencyConfig{Currency: "AUD", UnitPrice: 1.5, MinTopUp: 5}
	usd := &AirwallexCurrencyConfig{Currency: "USD", UnitPrice: 1.0, MinTopUp: 5}

	t.Run("currency display applies unit price group ratio and discount", func(t *testing.T) {
		operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
		// 10 * 1.5 (unit_price) * 1.2 (vip group) * 0.8 (discount @ amount=10) = 14.4
		require.InDelta(t, 14.4, computeAirwallexPayMoney(10, "vip", aud), 1e-9)
	})

	t.Run("non-positive discount falls back to no discount", func(t *testing.T) {
		operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
		// 20 * 1.0 * 1.0 * 1.0 (discount=0 → fallback 1.0) = 20
		require.InDelta(t, 20.0, computeAirwallexPayMoney(20, "default", usd), 1e-9)
	})

	t.Run("tokens display converts quota to display units before pricing", func(t *testing.T) {
		operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
		amount := float64(common.QuotaPerUnit) * 3 // 3 USD-equivalent quota units
		// 3 * 1.5 * 1 * 1 = 4.5 (no matching discount key for 3*QuotaPerUnit)
		require.InDelta(t, 4.5, computeAirwallexPayMoney(amount, "default", aud), 1e-9)
	})

	t.Run("missing group ratio falls back to 1", func(t *testing.T) {
		operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
		// Unknown group "ghost" → ratio fallback 1.0. 50 * 1.5 * 1 * 1 = 75
		require.InDelta(t, 75.0, computeAirwallexPayMoney(50, "ghost", aud), 1e-9)
	})
}

func TestAirwallexApiBaseURL(t *testing.T) {
	original := setting.AirwallexSandbox
	t.Cleanup(func() { setting.AirwallexSandbox = original })

	setting.AirwallexSandbox = true
	require.Equal(t, "https://api-demo.airwallex.com", setting.AirwallexApiBaseURL())

	setting.AirwallexSandbox = false
	require.Equal(t, "https://api.airwallex.com", setting.AirwallexApiBaseURL())
}
