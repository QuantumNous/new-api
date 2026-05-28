package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestVerifyPaddleSignature(t *testing.T) {
	payload := []byte(`{"event_type":"transaction.paid"}`)
	secret := "synthetic-paddle-webhook-signing-key"
	ts := strconv.FormatInt(time.Now().Unix(), 10)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts))
	mac.Write([]byte(":"))
	mac.Write(payload)
	header := "ts=" + ts + ";h1=" + hex.EncodeToString(mac.Sum(nil))

	require.NoError(t, verifyPaddleSignature(payload, header, secret))
	require.NoError(t, verifyPaddleSignature(payload, header, " "+secret+"\n"))
	require.NoError(t, verifyPaddleSignature(payload, "ts="+ts+";h1=bad;h1="+hex.EncodeToString(mac.Sum(nil)), secret))
	require.Error(t, verifyPaddleSignature(payload, header, "wrong-secret"))
	require.Error(t, verifyPaddleSignature([]byte(`{"changed":true}`), header, secret))

	oldTs := strconv.FormatInt(time.Now().Add(-paddleSignatureTolerance-time.Second).Unix(), 10)
	oldMac := hmac.New(sha256.New, []byte(secret))
	oldMac.Write([]byte(oldTs))
	oldMac.Write([]byte(":"))
	oldMac.Write(payload)
	require.Error(t, verifyPaddleSignature(payload, "ts="+oldTs+";h1="+hex.EncodeToString(oldMac.Sum(nil)), secret))
}

func TestPaddleMinorUnitAmount(t *testing.T) {
	amount, err := paddleMinorUnitAmount(12.345, "USD")
	require.NoError(t, err)
	require.Equal(t, "1235", amount)

	amount, err = paddleMinorUnitAmount(1234.56, "JPY")
	require.NoError(t, err)
	require.Equal(t, "1235", amount)
}

func TestValidatePaddleWebhookPaymentChecksCurrencyAndPreTaxSubtotal(t *testing.T) {
	topUp := &model.TopUp{
		Money:           12.34,
		PaymentCurrency: "USD",
	}
	event := paddleWebhookEvent{}
	event.Data.Currency = "usd"
	event.Data.Details.Totals.Subtotal = "1234"
	event.Data.Details.Totals.Total = "1500"
	event.Data.Details.Totals.CurrencyCode = "USD"
	event.Data.Details.LineItems = []paddleWebhookLineItem{
		{Totals: paddleWebhookTotals{Subtotal: "1234", Total: "1500"}},
	}

	require.NoError(t, validatePaddleWebhookPayment(topUp, event))

	event.Data.Details.Totals.Subtotal = "9999"
	event.Data.Details.LineItems = []paddleWebhookLineItem{
		{Totals: paddleWebhookTotals{Subtotal: "600"}},
		{Totals: paddleWebhookTotals{Subtotal: "634"}},
	}
	require.NoError(t, validatePaddleWebhookPayment(topUp, event))

	event.Data.Currency = ""
	event.Data.Details.Totals.Subtotal = float64(1234)
	event.Data.Details.Totals.Total = float64(1500)
	event.Data.Details.LineItems = nil
	require.NoError(t, validatePaddleWebhookPayment(topUp, event))

	event.Data.Currency = "EUR"
	require.Error(t, validatePaddleWebhookPayment(topUp, event))

	event.Data.Currency = "USD"
	event.Data.Details.Totals.CurrencyCode = "EUR"
	require.Error(t, validatePaddleWebhookPayment(topUp, event))

	event.Data.Details.Totals.CurrencyCode = "USD"
	event.Data.Details.Totals.Subtotal = "1234"
	event.Data.Details.Totals.Total = "1233"
	require.Error(t, validatePaddleWebhookPayment(topUp, event))

	event.Data.Details.Totals.Subtotal = "1233"
	event.Data.Details.Totals.Total = "1500"
	require.Error(t, validatePaddleWebhookPayment(topUp, event))

	event.Data.Details.Totals.Subtotal = "1234"
	event.Data.Details.LineItems = []paddleWebhookLineItem{
		{Totals: paddleWebhookTotals{Subtotal: "1233"}},
	}
	require.Error(t, validatePaddleWebhookPayment(topUp, event))
}

func TestPaddleAPIBaseURLUsesSandboxToggle(t *testing.T) {
	original := setting.PaddleSandbox
	t.Cleanup(func() {
		setting.PaddleSandbox = original
	})

	setting.PaddleSandbox = true
	require.Equal(t, paddleSandboxAPIBase, paddleAPIBaseURL())

	setting.PaddleSandbox = false
	require.Equal(t, paddleProdAPIBase, paddleAPIBaseURL())
}

func TestGetPaddleMinTopUpUsesDisplayUnits(t *testing.T) {
	originalMinTopUp := setting.PaddleMinTopUp
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	t.Cleanup(func() {
		setting.PaddleMinTopUp = originalMinTopUp
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
	})

	setting.PaddleMinTopUp = 3
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	require.Equal(t, int64(3), getPaddleMinTopUp())

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	require.Equal(t, int64(3*common.QuotaPerUnit), getPaddleMinTopUp())
}

func TestNormalizePaddleCheckoutURLDowngradesLocalhostInSandbox(t *testing.T) {
	original := setting.PaddleSandbox
	t.Cleanup(func() {
		setting.PaddleSandbox = original
	})

	setting.PaddleSandbox = true
	require.Equal(
		t,
		"http://localhost:3001/wallet?_ptxn=txn_test",
		normalizePaddleCheckoutURL("https://localhost:3001/console/topup?_ptxn=txn_test"),
	)

	setting.PaddleSandbox = false
	require.Equal(
		t,
		"https://localhost:3001/console/topup?_ptxn=txn_test",
		normalizePaddleCheckoutURL("https://localhost:3001/console/topup?_ptxn=txn_test"),
	)
}

func TestPaddleCheckoutReturnURLUsesTrustedHTTPSOrLocalSandbox(t *testing.T) {
	originalSandbox := setting.PaddleSandbox
	originalServerAddress := system_setting.ServerAddress
	originalTheme := common.GetTheme()
	t.Cleanup(func() {
		setting.PaddleSandbox = originalSandbox
		system_setting.ServerAddress = originalServerAddress
		common.SetTheme(originalTheme)
	})

	common.SetTheme("classic")
	setting.PaddleSandbox = false
	system_setting.ServerAddress = "https://example.com"
	require.Empty(t, paddleCheckoutReturnURL())

	system_setting.ServerAddress = "http://example.com"
	require.Empty(t, paddleCheckoutReturnURL())

	setting.PaddleSandbox = true
	system_setting.ServerAddress = "http://localhost:8081"
	require.Equal(t, "http://localhost:8081/console/topup", paddleCheckoutReturnURL())

	common.SetTheme("default")
	system_setting.ServerAddress = "https://example.com"
	require.Equal(t, "https://example.com/wallet", paddleCheckoutReturnURL())
}

func TestParsePaddleWebhookCustomDataRequiresWalletTopupFields(t *testing.T) {
	customData := parsePaddleWebhookCustomData(map[string]interface{}{
		"kind":     "wallet_topup",
		"trade_no": " PADDLE-1 ",
		"user_id":  "42",
	})

	require.Equal(t, "wallet_topup", customData.Kind)
	require.Equal(t, "PADDLE-1", customData.TradeNo)
	require.Equal(t, 42, customData.UserID)

	customData = parsePaddleWebhookCustomData(map[string]interface{}{
		"kind":     "subscription",
		"trade_no": "PADDLE-2",
		"user_id":  float64(43),
	})
	require.Equal(t, "subscription", customData.Kind)
	require.Equal(t, "PADDLE-2", customData.TradeNo)
	require.Equal(t, 43, customData.UserID)

	customData = parsePaddleWebhookCustomData(map[string]interface{}{
		"kind":     "wallet_topup",
		"trade_no": "PADDLE-3",
		"user_id":  "not-a-number",
	})
	require.Zero(t, customData.UserID)
}

func TestSanitizePaddleErrorDetailTruncatesLongDetails(t *testing.T) {
	longDetail := "validation failed: " + string(make([]byte, 300))
	sanitized := sanitizePaddleErrorDetail(longDetail)

	require.LessOrEqual(t, len(sanitized), 243)
	require.Contains(t, sanitized, "...")
}

func TestPaddleAPIErrorDetailExplainsMissingDefaultPaymentLink(t *testing.T) {
	detail := paddleAPIErrorDetail(&paddleAPIError{
		Code:   "transaction_default_checkout_url_not_set",
		Detail: "A Default Payment Link has not yet been defined within the Paddle Dashboard for this account, find this under checkout settings.",
	})

	require.Contains(t, detail, "Default Payment Link")
	require.Contains(t, detail, "Paddle Dashboard")
	require.Contains(t, detail, "/console/topup")
}
