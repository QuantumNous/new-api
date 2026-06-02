package operation_setting

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const DistributionSettingName = "distribution_setting"

const DefaultDistributionPointsPerAmountUnit = 100
const DefaultDistributionOfflineAmountPerPointMicros int64 = 10000

type DistributionSetting struct {
	Enabled                     bool   `json:"enabled"`
	Level1RateBps               int    `json:"level1_rate_bps"`
	Level2RateBps               int    `json:"level2_rate_bps"`
	CdkPurchaseDiscountBps      int    `json:"cdk_purchase_discount_bps"`
	Currency                    string `json:"currency"`
	PointsPerAmountUnit         int    `json:"points_per_amount_unit"`
	OfflineAmountPerPointMicros int64  `json:"offline_amount_per_point_micros"`
}

var distributionSetting = DistributionSetting{
	Enabled:                     false,
	Level1RateBps:               0,
	Level2RateBps:               0,
	CdkPurchaseDiscountBps:      0,
	Currency:                    "CNY",
	PointsPerAmountUnit:         DefaultDistributionPointsPerAmountUnit,
	OfflineAmountPerPointMicros: DefaultDistributionOfflineAmountPerPointMicros,
}

func init() {
	config.GlobalConfig.Register(DistributionSettingName, &distributionSetting)
}

func GetDistributionSetting() *DistributionSetting {
	if strings.TrimSpace(distributionSetting.Currency) == "" {
		distributionSetting.Currency = "CNY"
	}
	if distributionSetting.PointsPerAmountUnit <= 0 {
		distributionSetting.PointsPerAmountUnit = DefaultDistributionPointsPerAmountUnit
	}
	if distributionSetting.OfflineAmountPerPointMicros <= 0 {
		distributionSetting.OfflineAmountPerPointMicros = DefaultDistributionOfflineAmountPerPointMicros
	}
	return &distributionSetting
}

func NormalizeDistributionCurrency(currency string) string {
	currency = strings.TrimSpace(currency)
	if currency == "" {
		return "CNY"
	}
	return strings.ToUpper(currency)
}

func ValidateDistributionSetting(enabled bool, level1RateBps int, level2RateBps int, cdkPurchaseDiscountBps int, currency string, pointsPerAmountUnit int, offlineAmountPerPointMicros int64) error {
	if level1RateBps < 0 || level1RateBps > 10000 {
		return errors.New("一级分销积分比例必须在 0 到 10000 之间")
	}
	if level2RateBps < 0 || level2RateBps > 10000 {
		return errors.New("二级分销积分比例必须在 0 到 10000 之间")
	}
	if level1RateBps+level2RateBps > 10000 {
		return errors.New("两级分销积分比例合计不能超过 100%")
	}
	if cdkPurchaseDiscountBps < 0 || cdkPurchaseDiscountBps >= 10000 {
		return errors.New("代理 CDK 采购折扣必须在 0 到 9999 之间")
	}
	if strings.TrimSpace(currency) == "" {
		return errors.New("分销积分兼容币种不能为空")
	}
	if pointsPerAmountUnit <= 0 || pointsPerAmountUnit > 1000000 {
		return errors.New("每支付单位积分基数必须在 1 到 1000000 之间")
	}
	if offlineAmountPerPointMicros <= 0 || offlineAmountPerPointMicros > 1000000000 {
		return errors.New("每积分线下价值必须大于 0 且不超过 1000")
	}
	if (enabled || level1RateBps > 0 || level2RateBps > 0 || cdkPurchaseDiscountBps > 0) && !IsPaymentComplianceConfirmed() {
		return errors.New("开启分销或设置积分比例前，请先完成支付合规确认")
	}
	return nil
}

func ValidateDistributionOptionUpdate(key string, value string) error {
	current := *GetDistributionSetting()
	switch key {
	case DistributionSettingName + ".enabled":
		enabled, err := strconv.ParseBool(strings.TrimSpace(value))
		if err != nil {
			return errors.New("分销总开关参数无效")
		}
		current.Enabled = enabled
	case DistributionSettingName + ".level1_rate_bps":
		rate, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil {
			return errors.New("一级分销积分比例参数无效")
		}
		current.Level1RateBps = rate
	case DistributionSettingName + ".level2_rate_bps":
		rate, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil {
			return errors.New("二级分销积分比例参数无效")
		}
		current.Level2RateBps = rate
	case DistributionSettingName + ".cdk_purchase_discount_bps":
		discountBps, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil {
			return errors.New("代理 CDK 采购折扣参数无效")
		}
		current.CdkPurchaseDiscountBps = discountBps
	case DistributionSettingName + ".currency":
		current.Currency = NormalizeDistributionCurrency(value)
	case DistributionSettingName + ".points_per_amount_unit":
		pointsPerAmountUnit, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil {
			return errors.New("每支付单位积分基数参数无效")
		}
		current.PointsPerAmountUnit = pointsPerAmountUnit
	case DistributionSettingName + ".offline_amount_per_point_micros":
		amountMicros, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err != nil {
			return errors.New("每积分线下价值参数无效")
		}
		current.OfflineAmountPerPointMicros = amountMicros
	default:
		return nil
	}
	return ValidateDistributionSetting(current.Enabled, current.Level1RateBps, current.Level2RateBps, current.CdkPurchaseDiscountBps, current.Currency, current.PointsPerAmountUnit, current.OfflineAmountPerPointMicros)
}
