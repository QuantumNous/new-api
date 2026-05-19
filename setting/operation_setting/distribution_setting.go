package operation_setting

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const DistributionSettingName = "distribution_setting"

type DistributionSetting struct {
	Enabled       bool   `json:"enabled"`
	Level1RateBps int    `json:"level1_rate_bps"`
	Level2RateBps int    `json:"level2_rate_bps"`
	Currency      string `json:"currency"`
}

var distributionSetting = DistributionSetting{
	Enabled:       false,
	Level1RateBps: 0,
	Level2RateBps: 0,
	Currency:      "CNY",
}

func init() {
	config.GlobalConfig.Register(DistributionSettingName, &distributionSetting)
}

func GetDistributionSetting() *DistributionSetting {
	if strings.TrimSpace(distributionSetting.Currency) == "" {
		distributionSetting.Currency = "CNY"
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

func ValidateDistributionSetting(enabled bool, level1RateBps int, level2RateBps int, currency string) error {
	if level1RateBps < 0 || level1RateBps > 10000 {
		return errors.New("一级分销佣金比例必须在 0 到 10000 之间")
	}
	if level2RateBps < 0 || level2RateBps > 10000 {
		return errors.New("二级分销佣金比例必须在 0 到 10000 之间")
	}
	if level1RateBps+level2RateBps > 10000 {
		return errors.New("两级分销佣金比例合计不能超过 100%")
	}
	if strings.TrimSpace(currency) == "" {
		return errors.New("分销佣金币种不能为空")
	}
	if (enabled || level1RateBps > 0 || level2RateBps > 0) && !IsPaymentComplianceConfirmed() {
		return errors.New("开启分销或设置佣金比例前，请先完成支付合规确认")
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
			return errors.New("一级分销佣金比例参数无效")
		}
		current.Level1RateBps = rate
	case DistributionSettingName + ".level2_rate_bps":
		rate, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil {
			return errors.New("二级分销佣金比例参数无效")
		}
		current.Level2RateBps = rate
	case DistributionSettingName + ".currency":
		current.Currency = NormalizeDistributionCurrency(value)
	default:
		return nil
	}
	return ValidateDistributionSetting(current.Enabled, current.Level1RateBps, current.Level2RateBps, current.Currency)
}
