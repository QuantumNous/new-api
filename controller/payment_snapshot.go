package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func getDisplayCurrencySnapshot() string {
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		return "CNY"
	case operation_setting.QuotaDisplayTypeCustom:
		symbol := strings.TrimSpace(operation_setting.GetGeneralSetting().CustomCurrencySymbol)
		if symbol != "" {
			return symbol
		}
		return "CUSTOM"
	default:
		return "USD"
	}
}

func getDisplayExchangeRateSnapshot() float64 {
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		if operation_setting.USDExchangeRate > 0 {
			return operation_setting.USDExchangeRate
		}
		return 1
	case operation_setting.QuotaDisplayTypeCustom:
		if operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate > 0 {
			return operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
		}
		return 1
	default:
		return 1
	}
}

func buildPaymentSnapshot(displayAmount float64, settlementAmount float64, settlementCurrency string) model.PaymentSnapshot {
	return model.PaymentSnapshot{
		DisplayAmount:        displayAmount,
		DisplayCurrency:      getDisplayCurrencySnapshot(),
		SettlementAmount:     settlementAmount,
		SettlementCurrency:   settlementCurrency,
		ExchangeRateSnapshot: getDisplayExchangeRateSnapshot(),
	}
}
