package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

const (
	AffCommissionTypePercentage = "percentage"
	AffCommissionTypeFixed      = "fixed"
)

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`

	// 邀请佣金设置
	AffCommissionEnabled     bool    `json:"aff_commission_enabled"`
	AffCommissionType        string  `json:"aff_commission_type"`         // "percentage" 或 "fixed"
	AffCommissionRate        float64 `json:"aff_commission_rate"`         // 百分比佣金比例，0-100
	AffCommissionFixedAmount int     `json:"aff_commission_fixed_amount"` // 固定佣金额度（quota 单位）
}

const CurrentComplianceTermsVersion = "v1"

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

func IsPaymentComplianceConfirmed() bool {
	return paymentSetting.ComplianceConfirmed &&
		paymentSetting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}

func GetAffCommissionSetting() (enabled bool, commType string, rate float64, fixedAmount int) {
	return paymentSetting.AffCommissionEnabled,
		paymentSetting.AffCommissionType,
		paymentSetting.AffCommissionRate,
		paymentSetting.AffCommissionFixedAmount
}
