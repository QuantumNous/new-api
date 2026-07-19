package service

import (
	"errors"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	ChannelMonitorCostConversionNone         = "none"
	ChannelMonitorCostConversionRecharge     = "recharge"
	ChannelMonitorCostConversionSubscription = "subscription"

	ChannelMonitorSubscriptionPeriodDay   = "day"
	ChannelMonitorSubscriptionPeriodWeek  = "week"
	ChannelMonitorSubscriptionPeriodMonth = "month"

	maxChannelMonitorCostAmount = 1_000_000_000_000
)

type ChannelMonitorCostConversion struct {
	Mode                 string  `json:"mode"`
	PaidCNY              float64 `json:"paid_cny,omitempty"`
	CreditedUSD          float64 `json:"credited_usd,omitempty"`
	SubscriptionPeriod   string  `json:"subscription_period,omitempty"`
	SubscriptionPriceCNY float64 `json:"subscription_price_cny,omitempty"`
	SubscriptionDailyUSD float64 `json:"subscription_daily_usd,omitempty"`
}

func NormalizeChannelMonitorCostConversion(config ChannelMonitorCostConversion) (ChannelMonitorCostConversion, error) {
	config.Mode = strings.TrimSpace(config.Mode)
	if config.Mode == "" {
		config.Mode = ChannelMonitorCostConversionNone
	}

	switch config.Mode {
	case ChannelMonitorCostConversionNone:
		return ChannelMonitorCostConversion{Mode: ChannelMonitorCostConversionNone}, nil
	case ChannelMonitorCostConversionRecharge:
		if !validChannelMonitorCostAmount(config.PaidCNY) {
			return ChannelMonitorCostConversion{}, errors.New("实付人民币金额必须大于 0 且不能超过 1000000000000")
		}
		if !validChannelMonitorCostAmount(config.CreditedUSD) {
			return ChannelMonitorCostConversion{}, errors.New("到账美元额度必须大于 0 且不能超过 1000000000000")
		}
		return ChannelMonitorCostConversion{
			Mode:        ChannelMonitorCostConversionRecharge,
			PaidCNY:     config.PaidCNY,
			CreditedUSD: config.CreditedUSD,
		}, nil
	case ChannelMonitorCostConversionSubscription:
		config.SubscriptionPeriod = strings.TrimSpace(config.SubscriptionPeriod)
		if _, err := channelMonitorSubscriptionDays(config.SubscriptionPeriod); err != nil {
			return ChannelMonitorCostConversion{}, err
		}
		if !validChannelMonitorCostAmount(config.SubscriptionPriceCNY) {
			return ChannelMonitorCostConversion{}, errors.New("订阅价格必须大于 0 且不能超过 1000000000000")
		}
		if !validChannelMonitorCostAmount(config.SubscriptionDailyUSD) {
			return ChannelMonitorCostConversion{}, errors.New("每日美元额度必须大于 0 且不能超过 1000000000000")
		}
		return ChannelMonitorCostConversion{
			Mode:                 ChannelMonitorCostConversionSubscription,
			SubscriptionPeriod:   config.SubscriptionPeriod,
			SubscriptionPriceCNY: config.SubscriptionPriceCNY,
			SubscriptionDailyUSD: config.SubscriptionDailyUSD,
		}, nil
	default:
		return ChannelMonitorCostConversion{}, errors.New("倍率换算方式无效")
	}
}

func ParseChannelMonitorCostConversion(raw string) (ChannelMonitorCostConversion, error) {
	if strings.TrimSpace(raw) == "" {
		return ChannelMonitorCostConversion{Mode: ChannelMonitorCostConversionNone}, nil
	}
	var config ChannelMonitorCostConversion
	if err := common.UnmarshalJsonStr(raw, &config); err != nil {
		return ChannelMonitorCostConversion{}, errors.New("倍率换算配置格式无效")
	}
	return NormalizeChannelMonitorCostConversion(config)
}

func MarshalChannelMonitorCostConversion(config ChannelMonitorCostConversion) (string, error) {
	normalized, err := NormalizeChannelMonitorCostConversion(config)
	if err != nil {
		return "", err
	}
	data, err := common.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func ChannelMonitorCostConversionFactor(config ChannelMonitorCostConversion) (float64, error) {
	normalized, err := NormalizeChannelMonitorCostConversion(config)
	if err != nil {
		return 0, err
	}

	factor := 1.0
	switch normalized.Mode {
	case ChannelMonitorCostConversionRecharge:
		factor = normalized.PaidCNY / normalized.CreditedUSD
	case ChannelMonitorCostConversionSubscription:
		days, _ := channelMonitorSubscriptionDays(normalized.SubscriptionPeriod)
		factor = normalized.SubscriptionPriceCNY / (normalized.SubscriptionDailyUSD * float64(days))
	}
	if math.IsNaN(factor) || math.IsInf(factor, 0) || factor <= 0 || factor > maxUpstreamGroupRatio {
		return 0, errors.New("倍率换算系数必须大于 0 且不能超过 1000000")
	}
	return factor, nil
}

func CalculateChannelMonitorCostRatio(upstreamRatio float64, config ChannelMonitorCostConversion) (float64, float64, error) {
	if math.IsNaN(upstreamRatio) || math.IsInf(upstreamRatio, 0) || upstreamRatio < 0 || upstreamRatio > maxUpstreamGroupRatio {
		return 0, 0, errors.New("上游倍率必须在 0 到 1000000 之间")
	}
	factor, err := ChannelMonitorCostConversionFactor(config)
	if err != nil {
		return 0, 0, err
	}
	costRatio := upstreamRatio * factor
	if math.IsNaN(costRatio) || math.IsInf(costRatio, 0) || costRatio < 0 || costRatio > maxUpstreamGroupRatio {
		return 0, 0, errors.New("换算后的成本倍率必须在 0 到 1000000 之间")
	}
	return costRatio, factor, nil
}

func validChannelMonitorCostAmount(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value > 0 && value <= maxChannelMonitorCostAmount
}

func channelMonitorSubscriptionDays(period string) (int, error) {
	switch period {
	case ChannelMonitorSubscriptionPeriodDay:
		return 1, nil
	case ChannelMonitorSubscriptionPeriodWeek:
		return 7, nil
	case ChannelMonitorSubscriptionPeriodMonth:
		return 30, nil
	default:
		return 0, errors.New("订阅周期必须是天、周或月")
	}
}
