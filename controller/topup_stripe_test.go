package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v81"
)

func TestNormalizeStripeTopUpAmountUsesDisplayTokens(t *testing.T) {
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens

	require.Equal(t, int64(2), normalizeStripeTopUpAmount(int64(2*common.QuotaPerUnit)))
	require.Equal(t, int64(1), normalizeStripeTopUpAmount(1))
}

func TestStripeMinorUnitAmount(t *testing.T) {
	amount, err := stripeMinorUnitAmount(12.345, "USD")
	require.NoError(t, err)
	require.Equal(t, int64(1235), amount)

	amount, err = stripeMinorUnitAmount(1234.56, "JPY")
	require.NoError(t, err)
	require.Equal(t, int64(1235), amount)
}

func TestBuildStripeTopUpLineItemUsesConfiguredMultiCurrencyPrice(t *testing.T) {
	lineItem := buildStripeTopUpLineItem("price_multi_currency", 20)

	require.NotNil(t, lineItem.Price)
	require.Equal(t, "price_multi_currency", *lineItem.Price)
	require.NotNil(t, lineItem.Quantity)
	require.Equal(t, int64(20), *lineItem.Quantity)
	require.Nil(t, lineItem.PriceData)
}

func TestBuildStripeCheckoutSessionParamsAlwaysAllowsPromotionCodes(t *testing.T) {
	originalPriceId := setting.StripePriceId
	t.Cleanup(func() {
		setting.StripePriceId = originalPriceId
	})
	setting.StripePriceId = "price_multi_currency"

	params := buildStripeCheckoutSessionParams(
		"ref_123",
		"",
		"user@example.com",
		setting.StripePriceId,
		20,
		"https://flatkey.ai/wallet?show_history=true",
		"https://flatkey.ai/wallet",
		false,
		false,
	)

	require.NotNil(t, params.AllowPromotionCodes)
	require.True(t, *params.AllowPromotionCodes)
	require.Len(t, params.LineItems, 1)
	require.NotNil(t, params.LineItems[0].Price)
	require.Equal(t, setting.StripePriceId, *params.LineItems[0].Price)
	require.Nil(t, params.LineItems[0].PriceData)
}

func TestResolveStripeTopUpCheckoutUsesRequestedCurrencyPackage(t *testing.T) {
	originalPriceId := setting.StripePriceId
	originalPriceId20 := setting.StripePriceId20
	originalPriceId200 := setting.StripePriceId200
	originalJpyPriceId := setting.StripePriceIdJPY
	originalJpyPriceId20 := setting.StripePriceIdJPY20
	originalJpyPriceId200 := setting.StripePriceIdJPY200
	originalBrlPriceId := setting.StripePriceIdBRL
	originalBrlPriceId20 := setting.StripePriceIdBRL20
	originalBrlPriceId200 := setting.StripePriceIdBRL200
	t.Cleanup(func() {
		setting.StripePriceId = originalPriceId
		setting.StripePriceId20 = originalPriceId20
		setting.StripePriceId200 = originalPriceId200
		setting.StripePriceIdJPY = originalJpyPriceId
		setting.StripePriceIdJPY20 = originalJpyPriceId20
		setting.StripePriceIdJPY200 = originalJpyPriceId200
		setting.StripePriceIdBRL = originalBrlPriceId
		setting.StripePriceIdBRL20 = originalBrlPriceId20
		setting.StripePriceIdBRL200 = originalBrlPriceId200
	})
	setting.StripePriceId = "price_usd_package"
	setting.StripePriceId20 = "price_usd_20_package"
	setting.StripePriceId200 = "price_usd_200_package"
	setting.StripePriceIdJPY = "price_jpy_package"
	setting.StripePriceIdJPY20 = "price_jpy_20_package"
	setting.StripePriceIdJPY200 = "price_jpy_200_package"
	setting.StripePriceIdBRL = "price_brl_package"
	setting.StripePriceIdBRL20 = "price_brl_20_package"
	setting.StripePriceIdBRL200 = "price_brl_200_package"

	checkout, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         10,
		StripeCurrency: "jpy",
	}, 10, "default")
	require.NoError(t, err)
	require.Equal(t, "price_jpy_package", checkout.PriceId)
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "JPY", checkout.PaymentCurrency)
	require.Equal(t, 1500.0, checkout.Money)

	checkout, err = resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         20,
		StripeCurrency: "JPY",
	}, 20, "default")
	require.NoError(t, err)
	require.Equal(t, "price_jpy_20_package", checkout.PriceId)
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "JPY", checkout.PaymentCurrency)
	require.Equal(t, 3000.0, checkout.Money)

	checkout, err = resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         200,
		StripeCurrency: "USD",
	}, 200, "default")
	require.NoError(t, err)
	require.Equal(t, "price_usd_200_package", checkout.PriceId)
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "USD", checkout.PaymentCurrency)
	require.Equal(t, 200.0, checkout.Money)

	checkout, err = resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         200,
		StripeCurrency: "BRL",
	}, 200, "default")
	require.NoError(t, err)
	require.Equal(t, "price_brl_200_package", checkout.PriceId)
	require.Equal(t, int64(1), checkout.Quantity)
	require.Equal(t, "BRL", checkout.PaymentCurrency)
	require.InEpsilon(t, 1998.00, checkout.Money, 0.0001)
}

func TestResolveStripeTopUpCheckoutRejectsUnsupportedCurrencyPackage(t *testing.T) {
	_, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         10,
		StripeCurrency: "eur",
	}, 10, "default")

	require.EqualError(t, err, "unsupported Stripe checkout currency")
}

func TestResolveStripeTopUpCheckoutRejectsUnsupportedPackageAmount(t *testing.T) {
	originalPriceId := setting.StripePriceId
	t.Cleanup(func() {
		setting.StripePriceId = originalPriceId
	})
	setting.StripePriceId = "price_usd_package"

	_, err := resolveStripeTopUpCheckout(&StripePayRequest{
		Amount:         15,
		StripeCurrency: "USD",
	}, 15, "default")

	require.EqualError(t, err, "Stripe checkout package requires one of: 10, 20, 200 USD credits")
}

func TestStripePaymentSnapshotFromEventUsesCurrencyMinorUnits(t *testing.T) {
	event := stripe.Event{Data: &stripe.EventData{Object: map[string]interface{}{
		"amount_total": float64(12345),
		"currency":     "brl",
	}}}

	snapshot := stripePaymentSnapshotFromEvent(event)
	require.Equal(t, 123.45, snapshot.Money)
	require.Equal(t, "BRL", snapshot.Currency)

	event = stripe.Event{Data: &stripe.EventData{Object: map[string]interface{}{
		"amount_total": float64(5000),
		"currency":     "jpy",
	}}}

	snapshot = stripePaymentSnapshotFromEvent(event)
	require.Equal(t, 5000.0, snapshot.Money)
	require.Equal(t, "JPY", snapshot.Currency)
}

func TestValidateStripeRedirectURLAllowsSameRequestHost(t *testing.T) {
	originalDomains := constant.TrustedRedirectDomains
	t.Cleanup(func() {
		constant.TrustedRedirectDomains = originalDomains
	})
	constant.TrustedRedirectDomains = nil

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "https://flatkey.ai/api/user/stripe/pay", nil)

	require.NoError(t, validateStripeRedirectURL(ctx, "https://flatkey.ai/wallet?show_history=true"))
	require.Error(t, validateStripeRedirectURL(ctx, "https://evil.example/wallet"))
}

func TestValidateStripeRedirectURLAllowsForwardedAndOriginHosts(t *testing.T) {
	originalDomains := constant.TrustedRedirectDomains
	t.Cleanup(func() {
		constant.TrustedRedirectDomains = originalDomains
	})
	constant.TrustedRedirectDomains = nil

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "https://router.flatkey.ai/api/user/stripe/pay", nil)
	ctx.Request.Header.Set("Origin", "https://flatkey.ai")
	ctx.Request.Header.Set("X-Forwarded-Host", "flatkey.ai")

	require.NoError(t, validateStripeRedirectURL(ctx, "https://flatkey.ai/wallet?show_history=true"))
	require.NoError(t, validateStripeRedirectURL(ctx, "https://router.flatkey.ai/wallet"))
	require.Error(t, validateStripeRedirectURL(ctx, "https://evil.example/wallet"))
}

func TestGetStripePayMoneyAppliesDisplayGroupAndDiscount(t *testing.T) {
	originalDisplayType := operation_setting.GetQuotaDisplayType()
	originalUnitPrice := setting.StripeUnitPrice
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()
	paymentSetting := operation_setting.GetPaymentSetting()
	originalDiscounts := make(map[int]float64, len(paymentSetting.AmountDiscount))
	for key, value := range paymentSetting.AmountDiscount {
		originalDiscounts[key] = value
	}
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		setting.StripeUnitPrice = originalUnitPrice
		_ = common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio)
		paymentSetting.AmountDiscount = originalDiscounts
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	setting.StripeUnitPrice = 2
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"vip":1.5}`))
	paymentSetting.AmountDiscount = map[int]float64{int(2 * common.QuotaPerUnit): 0.5}

	require.Equal(t, 3.0, getStripePayMoney(2*common.QuotaPerUnit, "vip"))
}

func TestMapStripeInvoiceStatusUsesLocalStatuses(t *testing.T) {
	require.Equal(t, model.PaymentInvoiceStatusPaid, mapStripeInvoiceStatus(stripe.InvoiceStatusPaid))
	require.Equal(t, model.PaymentInvoiceStatusPending, mapStripeInvoiceStatus(stripe.InvoiceStatusOpen))
	require.Equal(t, model.PaymentInvoiceStatusPending, mapStripeInvoiceStatus(stripe.InvoiceStatusDraft))
	require.Equal(t, model.PaymentInvoiceStatusFailed, mapStripeInvoiceStatus(stripe.InvoiceStatusVoid))
	require.Equal(t, model.PaymentInvoiceStatusFailed, mapStripeInvoiceStatus(stripe.InvoiceStatusUncollectible))
	require.Equal(t, model.PaymentInvoiceStatusPending, mapStripeInvoiceStatus(stripe.InvoiceStatus("")))
}

func TestValidateInvoiceProfileNormalizesAndReturnsTranslationKeys(t *testing.T) {
	fields, err := validateInvoiceProfile(model.InvoiceProfileFields{
		CompanyName:  " Acme Inc ",
		BillingEmail: " request@example.com ",
		TaxIDType:    " EU_VAT ",
		Country:      " us ",
		AddressLine1: " 1 Main St ",
	})
	require.NoError(t, err)
	require.Equal(t, "Acme Inc", fields.CompanyName)
	require.Empty(t, fields.BillingEmail)
	require.Equal(t, "eu_vat", fields.TaxIDType)
	require.Equal(t, "US", fields.Country)
	require.Equal(t, "1 Main St", fields.AddressLine1)

	_, err = validateInvoiceProfile(model.InvoiceProfileFields{
		Country:      "US",
		AddressLine1: "1 Main St",
	})
	require.EqualError(t, err, "Company name is required")

	fields, err = validateInvoiceProfile(model.InvoiceProfileFields{
		CompanyName:  "Acme Inc",
		Country:      "US",
		AddressLine1: "1 Main St",
	})
	require.NoError(t, err)
	require.Empty(t, fields.BillingEmail)
}

func TestStripeCustomerParamsForInvoiceUsesAccountEmail(t *testing.T) {
	params := stripeCustomerParamsForInvoice(&model.User{Email: " account@example.com "}, model.InvoiceProfileFields{
		CompanyName:  "Acme Inc",
		BillingEmail: "request@example.com",
		Country:      "US",
		AddressLine1: "1 Main St",
	})

	require.NotNil(t, params.Email)
	require.Equal(t, "account@example.com", *params.Email)
	require.Equal(t, "account@example.com", params.Metadata["user_email"])
}

func TestStripeInvoiceProfileForUserRequiresAccountEmail(t *testing.T) {
	_, err := stripeInvoiceProfileForUser(model.InvoiceProfileFields{
		CompanyName:  "Acme Inc",
		Country:      "US",
		AddressLine1: "1 Main St",
	}, &model.User{})

	require.EqualError(t, err, invoiceAccountEmailRequired)
}

func TestStripeInvoiceProfileForUserInjectsAccountEmail(t *testing.T) {
	fields, err := stripeInvoiceProfileForUser(model.InvoiceProfileFields{
		CompanyName:  "Acme Inc",
		BillingEmail: "request@example.com",
		Country:      "US",
		AddressLine1: "1 Main St",
	}, &model.User{Email: " account@example.com "})

	require.NoError(t, err)
	require.Equal(t, "account@example.com", fields.BillingEmail)
}
