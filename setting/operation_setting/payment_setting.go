package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"`

	BusinessFeatures    map[string]bool            `json:"business_features"`
	ProviderSceneScopes map[string]map[string]bool `json:"provider_scene_scopes"`

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`
}

const CurrentComplianceTermsVersion = "v1"

var paymentSetting = PaymentSetting{
	AmountOptions:       []int{10, 20, 50, 100, 200, 500},
	AmountDiscount:      map[int]float64{},
	BusinessFeatures:    DefaultBusinessFeatures(),
	ProviderSceneScopes: DefaultProviderSceneScopes(),
}

func init() {
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	NormalizePaymentSetting()
	return &paymentSetting
}

func IsPaymentComplianceConfirmed() bool {
	setting := GetPaymentSetting()
	return setting.ComplianceConfirmed &&
		setting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}
