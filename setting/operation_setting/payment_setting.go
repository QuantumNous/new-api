package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠

	// EnableRangeDiscount 开启区间折扣：任意充值金额按不超过它的最大档位折扣计算
	// （例如 20 元 0.9、50 元 0.8 时，充 35 元按 0.9、60 元按 0.8）；关闭时仅精确匹配。
	EnableRangeDiscount bool `json:"enable_range_discount"`

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`
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

// GetAmountDiscount 返回指定充值金额应享受的折扣，默认 1.0（无折扣）。
// 区间折扣开启时，取不超过 amount 的最大档位折扣；关闭时仅精确匹配配置金额。
func (p *PaymentSetting) GetAmountDiscount(amount int) float64 {
	if ds, ok := p.AmountDiscount[amount]; ok && ds > 0 {
		return ds
	}
	if !p.EnableRangeDiscount {
		return 1.0
	}
	discount := 1.0
	bestKey := 0
	for key, value := range p.AmountDiscount {
		if key <= amount && value > 0 && key > bestKey {
			bestKey = key
			discount = value
		}
	}
	return discount
}
