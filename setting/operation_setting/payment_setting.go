package operation_setting

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/shopspring/decimal"
)

const (
	EpayFeePercentOptionKey         = "payment_setting.epay_fee_percent"
	EpayFeeFixedOptionKey           = "payment_setting.epay_fee_fixed"
	StripeFeePercentOptionKey       = "payment_setting.stripe_fee_percent"
	StripeFeeFixedOptionKey         = "payment_setting.stripe_fee_fixed"
	CreemFeePercentOptionKey        = "payment_setting.creem_fee_percent"
	CreemFeeFixedOptionKey          = "payment_setting.creem_fee_fixed"
	WaffoFeePercentOptionKey        = "payment_setting.waffo_fee_percent"
	WaffoFeeFixedOptionKey          = "payment_setting.waffo_fee_fixed"
	WaffoPancakeFeePercentOptionKey = "payment_setting.waffo_pancake_fee_percent"
	WaffoPancakeFeeFixedOptionKey   = "payment_setting.waffo_pancake_fee_fixed"
)

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠

	EpayFeePercent         float64 `json:"epay_fee_percent"`
	EpayFeeFixed           float64 `json:"epay_fee_fixed"`
	StripeFeePercent       float64 `json:"stripe_fee_percent"`
	StripeFeeFixed         float64 `json:"stripe_fee_fixed"`
	CreemFeePercent        float64 `json:"creem_fee_percent"`
	CreemFeeFixed          float64 `json:"creem_fee_fixed"`
	WaffoFeePercent        float64 `json:"waffo_fee_percent"`
	WaffoFeeFixed          float64 `json:"waffo_fee_fixed"`
	WaffoPancakeFeePercent float64 `json:"waffo_pancake_fee_percent"`
	WaffoPancakeFeeFixed   float64 `json:"waffo_pancake_fee_fixed"`

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

func IsPaymentFeeOptionKey(key string) bool {
	switch key {
	case EpayFeePercentOptionKey,
		EpayFeeFixedOptionKey,
		StripeFeePercentOptionKey,
		StripeFeeFixedOptionKey,
		CreemFeePercentOptionKey,
		CreemFeeFixedOptionKey,
		WaffoFeePercentOptionKey,
		WaffoFeeFixedOptionKey,
		WaffoPancakeFeePercentOptionKey,
		WaffoPancakeFeeFixedOptionKey:
		return true
	default:
		return false
	}
}

func IsValidPaymentFee(value float64) bool {
	return value >= 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}

func ValidatePaymentFeeOption(key, value string) error {
	if !IsPaymentFeeOptionKey(key) {
		return nil
	}
	fee, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil || !IsValidPaymentFee(fee) {
		return fmt.Errorf("payment fee must be a finite non-negative number")
	}
	return nil
}

func ApplyPaymentFee(base decimal.Decimal, percent, fixed float64) (decimal.Decimal, bool) {
	if !IsValidPaymentFee(percent) || !IsValidPaymentFee(fixed) {
		return decimal.Zero, false
	}
	multiplier := decimal.NewFromInt(1).
		Add(decimal.NewFromFloat(percent).Div(decimal.NewFromInt(100)))
	return base.
		Mul(multiplier).
		Add(decimal.NewFromFloat(fixed)), true
}

func IsPaymentComplianceConfirmed() bool {
	return paymentSetting.ComplianceConfirmed &&
		paymentSetting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}
