package operation_setting

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type ThresholdDiscount struct {
	MinAmount int     `json:"min_amount"`
	Discount  float64 `json:"discount"`
}

type AmountDiscountConfig struct {
	Exact      map[int]float64
	Thresholds []ThresholdDiscount
}

func (discounts AmountDiscountConfig) MarshalJSON() ([]byte, error) {
	if len(discounts.Thresholds) > 0 {
		return common.Marshal(discounts.Thresholds)
	}
	if discounts.Exact == nil {
		return common.Marshal(map[int]float64{})
	}
	return common.Marshal(discounts.Exact)
}

func (discounts *AmountDiscountConfig) UnmarshalJSON(data []byte) error {
	var thresholds []ThresholdDiscount
	if err := common.Unmarshal(data, &thresholds); err == nil {
		discounts.Exact = nil
		discounts.Thresholds = thresholds
		return nil
	}

	var raw map[string]float64
	if err := common.Unmarshal(data, &raw); err != nil {
		return err
	}

	exact := make(map[int]float64, len(raw))
	for amount, discount := range raw {
		amountInt, err := strconv.Atoi(amount)
		if err != nil {
			continue
		}
		exact[amountInt] = discount
	}
	discounts.Exact = exact
	discounts.Thresholds = nil
	return nil
}

func (discounts AmountDiscountConfig) DiscountForAmount(amount int) float64 {
	discount := 1.0
	if exactDiscount, ok := discounts.Exact[amount]; ok && exactDiscount > 0 {
		discount = exactDiscount
	}

	bestMinAmount := -1
	for _, threshold := range discounts.Thresholds {
		if threshold.MinAmount <= amount && threshold.MinAmount > bestMinAmount && threshold.Discount > 0 {
			bestMinAmount = threshold.MinAmount
			discount = threshold.Discount
		}
	}
	return discount
}

type PaymentSetting struct {
	AmountOptions  []int                `json:"amount_options"`
	AmountDiscount AmountDiscountConfig `json:"amount_discount"` // 支持精确金额折扣和 min_amount 阈值折扣

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
	AmountDiscount: AmountDiscountConfig{Exact: map[int]float64{}},
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
