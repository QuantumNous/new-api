package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠
	InvoiceFeeRate float64         `json:"invoice_fee_rate"` // 开票手续费率，例如 0.06 表示 6%
}

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
	InvoiceFeeRate: 0.06,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
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
