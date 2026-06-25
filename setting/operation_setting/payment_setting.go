package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions    []int           `json:"amount_options"`
	AmountBonus      map[int]int64   `json:"amount_bonus"`       // Top-up amount bonus, e.g. 20:5 means pay 20 and credit 25.
	AmountBonusLimit map[int]int     `json:"amount_bonus_limit"` // 档位金额 → 每用户终身可享赠送次数；缺省/0 = 不限次。注意：key 是充值金额，仅在 USD/CNY 展示模式下生效；TOKENS 模式下 req.Amount 是 token 数、量纲不匹配，赠送与限次均不生效。
	// AmountBonusGroups 档位金额 → 可享该档位赠送的用户组白名单（opt-in）。
	// 未配 / 空数组 = 谁都不送（必须显式授权）；含 "all" = 所有用户组都送；
	// 否则仅命中列表内用户组才送。与 AmountBonus 同源，key 是充值金额，仅 USD/CNY 展示模式生效。
	AmountBonusGroups map[int][]string `json:"amount_bonus_groups"`
	AmountDiscount    map[int]float64  `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`
}

const CurrentComplianceTermsVersion = "v1"

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:     []int{10, 20, 50, 100, 200, 1000},
	AmountDiscount:    map[int]float64{},
	AmountBonus:       map[int]int64{},
	AmountBonusLimit:  map[int]int{},
	AmountBonusGroups: map[int][]string{},
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
