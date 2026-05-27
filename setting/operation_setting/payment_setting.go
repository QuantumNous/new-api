package operation_setting

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type PaymentSetting struct {
	AmountOptions           []int              `json:"amount_options"`
	AmountOptionsByCurrency map[string][]int   `json:"amount_options_by_currency"`
	AmountDiscount          map[int]float64    `json:"amount_discount"`
	PriceByCurrency         map[string]float64 `json:"price_by_currency"`
	ComplianceConfirmed     bool               `json:"compliance_confirmed"`
	ComplianceTermsVersion  string             `json:"compliance_terms_version"`
	ComplianceConfirmedAt   int64              `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy   int                `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP   string             `json:"compliance_confirmed_ip"`
}

const CurrentComplianceTermsVersion = "v1"

var paymentSetting = PaymentSetting{
	AmountOptions: []int{10, 20, 50, 100, 200, 500},
	AmountOptionsByCurrency: map[string][]int{
		"USD": {10, 20, 50, 100, 200, 500},
		"CNY": {10, 20, 50, 100, 200, 500},
		"HKD": {10, 20, 50, 100, 200, 500},
	},
	AmountDiscount: map[int]float64{},
	PriceByCurrency: map[string]float64{
		"USD": 1.0,
		"CNY": 7.3,
		"HKD": 7.8,
	},
}

func init() {
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

func IsPaymentComplianceConfirmed() bool {
	return paymentSetting.ComplianceConfirmed &&
		paymentSetting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}

func normalizeCurrencyCode(currency string) string {
	return strings.ToUpper(strings.TrimSpace(currency))
}

func (p PaymentSetting) GetAmountOptionsByCurrency(currency string) []int {
	currency = normalizeCurrencyCode(currency)
	if currency != "" {
		if opts, ok := p.AmountOptionsByCurrency[currency]; ok && len(opts) > 0 {
			return append([]int(nil), opts...)
		}
	}
	return append([]int(nil), p.AmountOptions...)
}

func (p PaymentSetting) GetConfiguredAmountOptionsByCurrency(currency string) ([]int, bool) {
	currency = normalizeCurrencyCode(currency)
	if currency == "" {
		return nil, false
	}
	if opts, ok := p.AmountOptionsByCurrency[currency]; ok && len(opts) > 0 {
		return append([]int(nil), opts...), true
	}
	return nil, false
}

func (p PaymentSetting) GetPriceByCurrency(currency string) float64 {
	currency = normalizeCurrencyCode(currency)
	if currency != "" {
		if price, ok := p.PriceByCurrency[currency]; ok && price > 0 {
			return price
		}
	}
	return Price
}

func (p PaymentSetting) GetSupportedCurrencies() []string {
	currencySet := make(map[string]struct{}, len(p.PriceByCurrency))
	for key, price := range p.PriceByCurrency {
		if price <= 0 {
			continue
		}
		currency := normalizeCurrencyCode(key)
		if currency != "" {
			currencySet[currency] = struct{}{}
		}
	}
	currencies := make([]string, 0, len(currencySet))
	for currency := range currencySet {
		currencies = append(currencies, currency)
	}
	sort.Strings(currencies)
	return currencies
}
