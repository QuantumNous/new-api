package operation_setting

import (
	"sort"

	"github.com/QuantumNous/new-api/setting/config"
)

// TopupGiftRule 充值赠送档位规则：充值本金额度达到 Threshold 时赠送 Gift 免费额度。
// Threshold / Gift 均以“额度”为单位（quota，即 money * QuotaPerUnit 后的整数）。
type TopupGiftRule struct {
	Threshold int `json:"threshold"` // 充值本金额度门槛（quota）
	Gift      int `json:"gift"`      // 赠送免费额度（quota）
}

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠
	InvoiceFeeRate float64         `json:"invoice_fee_rate"` // 开票手续费率，例如 0.06 表示 6%
	// 双钱包拆分：充值赠送配置
	GiftEnabled   bool            `json:"gift_enabled"`    // 是否启用充值赠送
	GiftRules     []TopupGiftRule `json:"gift_rules"`      // 赠送档位规则（命中最高满足档位）
	GiftValidDays int             `json:"gift_valid_days"` // 赠送额度有效天数，<=0 表示不过期
}

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
	InvoiceFeeRate: 0.06,
	GiftEnabled:    false,
	GiftRules:      []TopupGiftRule{},
	GiftValidDays:  0,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

// CalcTopupGift 根据本次充值的本金额度 principalQuota，命中“最高满足档位”返回赠送额度。
// 未启用、无规则或未达任何档位门槛时返回 0。
func CalcTopupGift(principalQuota int) int {
	if !paymentSetting.GiftEnabled || len(paymentSetting.GiftRules) == 0 || principalQuota <= 0 {
		return 0
	}
	// 拷贝后按门槛降序，取第一个 principalQuota >= Threshold 的档位（最高满足档）。
	rules := make([]TopupGiftRule, len(paymentSetting.GiftRules))
	copy(rules, paymentSetting.GiftRules)
	sort.Slice(rules, func(i, j int) bool { return rules[i].Threshold > rules[j].Threshold })
	for _, r := range rules {
		if r.Threshold <= 0 || r.Gift <= 0 {
			continue
		}
		if principalQuota >= r.Threshold {
			return r.Gift
		}
	}
	return 0
}

// GetTopupGiftValidDays 返回赠送额度有效天数（<=0 表示不过期，返回 0）。
func GetTopupGiftValidDays() int {
	if paymentSetting.GiftValidDays <= 0 {
		return 0
	}
	return paymentSetting.GiftValidDays
}

// CalcTaxedAmount 根据 baseAmount 和是否含税，计算实付金额、税前金额、税额
func CalcTaxedAmount(baseAmount float64, includeTax bool) (money, preTax, taxAmount float64) {
	if !includeTax {
		return baseAmount, baseAmount, 0
	}
	rate := paymentSetting.InvoiceFeeRate
	money = baseAmount * (1 + rate)
	return money, baseAmount, money - baseAmount
}
