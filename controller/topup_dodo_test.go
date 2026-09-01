package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/dodopayments/dodopayments-go"
	"github.com/dodopayments/dodopayments-go/shared"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func preserveDodoPricingForTest(t *testing.T) {
	t.Helper()
	originalUnitPrice := setting.DodoUnitPrice
	originalMinTopUp := setting.DodoMinTopUp
	originalQuotaPerUnit := common.QuotaPerUnit
	originalDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalDiscount := operation_setting.GetPaymentSetting().AmountDiscount
	t.Cleanup(func() {
		setting.DodoUnitPrice = originalUnitPrice
		setting.DodoMinTopUp = originalMinTopUp
		common.QuotaPerUnit = originalQuotaPerUnit
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscount
	})
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{}
}

func TestCalculateDodoOrderUsesUSDPricePerTopUpUnit(t *testing.T) {
	preserveDodoPricingForTest(t)
	setting.DodoUnitPrice = 1.25
	setting.DodoMinTopUp = 1
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{20: 0.9}

	expectedAmount, payMoney, err := calculateDodoOrder(20, "default")
	require.NoError(t, err)
	assert.Equal(t, int64(2250), expectedAmount)
	assert.Equal(t, 22.5, payMoney)
}

func TestCalculateDodoOrderRejectsUnsafeValues(t *testing.T) {
	preserveDodoPricingForTest(t)
	setting.DodoMinTopUp = 5

	testCases := []struct {
		name      string
		amount    int64
		unitPrice float64
	}{
		{name: "below minimum", amount: 4, unitPrice: 1},
		{name: "above request limit", amount: 10001, unitPrice: 1},
		{name: "zero price", amount: 5, unitPrice: 0},
		{name: "nan price", amount: 5, unitPrice: math.NaN()},
		{name: "overflowing price", amount: 10000, unitPrice: math.MaxFloat64},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setting.DodoUnitPrice = testCase.unitPrice
			_, _, err := calculateDodoOrder(testCase.amount, "default")
			require.Error(t, err)
		})
	}
}

func TestNewDodoClientAcceptsOpaqueAPIKeyForConfiguredEnvironment(t *testing.T) {
	originalAPIKey := setting.DodoAPIKey
	originalEnvironment := setting.DodoEnvironment
	t.Cleanup(func() {
		setting.DodoAPIKey = originalAPIKey
		setting.DodoEnvironment = originalEnvironment
	})
	setting.DodoAPIKey = "opaque_dashboard_generated_key"

	for _, environment := range []string{setting.DodoEnvironmentTestMode, setting.DodoEnvironmentLiveMode} {
		t.Run(environment, func(t *testing.T) {
			setting.DodoEnvironment = environment
			client, err := newDodoClient(false)
			require.NoError(t, err)
			assert.NotNil(t, client)
		})
	}
}

func TestNewDodoClientRejectsUnknownEnvironment(t *testing.T) {
	originalAPIKey := setting.DodoAPIKey
	originalEnvironment := setting.DodoEnvironment
	t.Cleanup(func() {
		setting.DodoAPIKey = originalAPIKey
		setting.DodoEnvironment = originalEnvironment
	})
	setting.DodoAPIKey = "opaque_dashboard_generated_key"
	setting.DodoEnvironment = "staging"

	client, err := newDodoClient(false)
	require.Error(t, err)
	assert.Nil(t, client)
}

func TestValidateDodoProduct(t *testing.T) {
	validProduct := dodopayments.Product{
		ProductID:   "pdt_123",
		IsRecurring: false,
		Price: dodopayments.Price{
			Currency:       dodopayments.CurrencyUsd,
			Type:           dodopayments.PriceTypeOneTimePrice,
			PayWhatYouWant: true,
			Price:          100,
		},
	}
	require.NoError(t, validateDodoProduct(&validProduct, "pdt_123", 1000))

	testCases := []struct {
		name   string
		amount int64
		mutate func(*dodopayments.Product)
	}{
		{name: "missing product", amount: 1000, mutate: func(product *dodopayments.Product) { *product = dodopayments.Product{} }},
		{name: "wrong product id", amount: 1000, mutate: func(product *dodopayments.Product) { product.ProductID = "pdt_other" }},
		{name: "recurring product", amount: 1000, mutate: func(product *dodopayments.Product) { product.IsRecurring = true }},
		{name: "wrong price type", amount: 1000, mutate: func(product *dodopayments.Product) { product.Price.Type = dodopayments.PriceTypeRecurringPrice }},
		{name: "wrong currency", amount: 1000, mutate: func(product *dodopayments.Product) { product.Price.Currency = dodopayments.CurrencyEur }},
		{name: "fixed amount", amount: 1000, mutate: func(product *dodopayments.Product) { product.Price.PayWhatYouWant = false }},
		{name: "below product minimum", amount: 99, mutate: func(_ *dodopayments.Product) {}},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			product := validProduct
			testCase.mutate(&product)
			require.Error(t, validateDodoProduct(&product, "pdt_123", testCase.amount))
		})
	}
}

func validDodoPaymentForTest() dodopayments.Payment {
	return dodopayments.Payment{
		BusinessID:  "business_123",
		Currency:    dodopayments.CurrencyUsd,
		PaymentID:   "pay_123",
		Status:      dodopayments.IntentStatusSucceeded,
		TotalAmount: 1000,
		Tax:         100,
		ProductCart: []dodopayments.PaymentProductCart{{ProductID: "pdt_123", Quantity: 1}},
		Metadata: dodopayments.Metadata{
			"order_type":      shared.UnionString("topup"),
			"trade_no":        shared.UnionString("dodo_trade_123"),
			"user_id":         shared.UnionString("42"),
			"product_id":      shared.UnionString("pdt_123"),
			"expected_amount": shared.UnionString("1000"),
		},
	}
}

func TestValidateDodoPaymentSucceededEnvelope(t *testing.T) {
	payment := validDodoPaymentForTest()
	tradeNo, err := validateDodoPaymentSucceededEnvelope("business_123", payment)
	require.NoError(t, err)
	assert.Equal(t, "dodo_trade_123", tradeNo)

	testCases := []struct {
		name   string
		mutate func(*dodopayments.Payment)
	}{
		{name: "wrong business", mutate: func(payment *dodopayments.Payment) { payment.BusinessID = "other" }},
		{name: "wrong status", mutate: func(payment *dodopayments.Payment) { payment.Status = dodopayments.IntentStatusProcessing }},
		{name: "wrong currency", mutate: func(payment *dodopayments.Payment) { payment.Currency = dodopayments.CurrencyEur }},
		{name: "missing payment id", mutate: func(payment *dodopayments.Payment) { payment.PaymentID = "" }},
		{name: "wrong product", mutate: func(payment *dodopayments.Payment) { payment.ProductCart[0].ProductID = "pdt_other" }},
		{name: "wrong quantity", mutate: func(payment *dodopayments.Payment) { payment.ProductCart[0].Quantity = 2 }},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			candidate := validDodoPaymentForTest()
			testCase.mutate(&candidate)
			_, err := validateDodoPaymentSucceededEnvelope("business_123", candidate)
			require.Error(t, err)
		})
	}
}

func TestValidateDodoPaymentAgainstTopUp(t *testing.T) {
	topUp := &model.TopUp{
		UserId:          42,
		PaymentProvider: model.PaymentProviderDodo,
		ExpectedAmount:  1000,
	}
	taxInclusivePayment := validDodoPaymentForTest()
	require.NoError(t, validateDodoPaymentAgainstTopUp(taxInclusivePayment, topUp))

	taxExclusivePayment := validDodoPaymentForTest()
	taxExclusivePayment.TotalAmount = 1100
	require.NoError(t, validateDodoPaymentAgainstTopUp(taxExclusivePayment, topUp))

	testCases := []struct {
		name   string
		mutate func(*dodopayments.Payment, *model.TopUp)
	}{
		{name: "wrong provider", mutate: func(_ *dodopayments.Payment, order *model.TopUp) { order.PaymentProvider = model.PaymentProviderStripe }},
		{name: "wrong user", mutate: func(payment *dodopayments.Payment, _ *model.TopUp) {
			payment.Metadata["user_id"] = shared.UnionString("41")
		}},
		{name: "wrong expected metadata", mutate: func(payment *dodopayments.Payment, _ *model.TopUp) {
			payment.Metadata["expected_amount"] = shared.UnionString("999")
		}},
		{name: "underpayment", mutate: func(payment *dodopayments.Payment, _ *model.TopUp) { payment.TotalAmount = 999 }},
		{name: "overpayment", mutate: func(payment *dodopayments.Payment, _ *model.TopUp) { payment.TotalAmount = 1101 }},
		{name: "invalid tax", mutate: func(payment *dodopayments.Payment, _ *model.TopUp) { payment.Tax = 1200 }},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			payment := validDodoPaymentForTest()
			order := *topUp
			testCase.mutate(&payment, &order)
			require.Error(t, validateDodoPaymentAgainstTopUp(payment, &order))
		})
	}
}
