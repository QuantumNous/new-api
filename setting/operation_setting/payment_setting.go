package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions          []int           `json:"amount_options"`
	AmountDiscount         map[int]float64 `json:"amount_discount"`
	DefaultTopUpAmount     int             `json:"default_topup_amount"`
	ComplianceConfirmed    bool            `json:"compliance_confirmed"`
	ComplianceTermsVersion string          `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64           `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int             `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string          `json:"compliance_confirmed_ip"`
}

const CurrentComplianceTermsVersion = "v1"

var paymentSetting = PaymentSetting{
	AmountOptions:      []int{10, 20, 50, 100, 200, 500},
	AmountDiscount:     map[int]float64{},
	DefaultTopUpAmount: 100,
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
