package operation_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	ChannelPreparationAutoPromotionGuaranteePriorityCapacityFirst = "capacity_first"
	ChannelPreparationAutoPromotionGuaranteePriorityCountFirst    = "count_first"
)

const (
	ChannelPreparationAutoPromotionStrategyPriorityWeighted  = "priority_weighted"
	ChannelPreparationAutoPromotionStrategySmallBalanceFirst = "small_balance_first"
	ChannelPreparationAutoPromotionStrategyLargeBalanceFirst = "large_balance_first"
)

type ChannelPreparationAutoPromotionRule struct {
	Id                        string  `json:"id"`
	Enabled                   bool    `json:"enabled"`
	Group                     string  `json:"group"`
	Type                      int     `json:"type"`
	ThresholdUSD              float64 `json:"threshold_usd"`
	MinimumUsableChannelCount int     `json:"minimum_usable_channel_count"`
	GuaranteePriority         string  `json:"guarantee_priority"`
	CountShortageStrategy     string  `json:"count_shortage_strategy"`
	CapacityShortageStrategy  string  `json:"capacity_shortage_strategy"`
	// Strategy is kept for compatibility with older settings JSON and rollback.
	Strategy string `json:"strategy,omitempty"`
}

type ChannelPreparationAutoPromotionSetting struct {
	SchedulerEnabled    bool                                  `json:"scheduler_enabled"`
	IntervalMinutes     float64                               `json:"interval_minutes"`
	MaxPromotionsPerRun int                                   `json:"max_promotions_per_run"`
	Rules               []ChannelPreparationAutoPromotionRule `json:"rules"`
}

var channelPreparationAutoPromotionSetting = ChannelPreparationAutoPromotionSetting{
	SchedulerEnabled:    false,
	IntervalMinutes:     10,
	MaxPromotionsPerRun: 10,
	Rules:               []ChannelPreparationAutoPromotionRule{},
}

func init() {
	config.GlobalConfig.Register("channel_preparation_auto_promotion_setting", &channelPreparationAutoPromotionSetting)
}

func GetChannelPreparationAutoPromotionSetting() *ChannelPreparationAutoPromotionSetting {
	NormalizeChannelPreparationAutoPromotionSetting(&channelPreparationAutoPromotionSetting)
	return &channelPreparationAutoPromotionSetting
}

func NormalizeChannelPreparationAutoPromotionSetting(setting *ChannelPreparationAutoPromotionSetting) {
	if setting == nil {
		return
	}
	if setting.IntervalMinutes <= 0 {
		setting.IntervalMinutes = 10
	}
	if setting.MaxPromotionsPerRun <= 0 {
		setting.MaxPromotionsPerRun = 10
	}
	for index := range setting.Rules {
		NormalizeChannelPreparationAutoPromotionRule(&setting.Rules[index])
	}
}

func NormalizeChannelPreparationAutoPromotionRule(rule *ChannelPreparationAutoPromotionRule) {
	if rule == nil {
		return
	}
	rule.Id = strings.TrimSpace(rule.Id)
	rule.Group = strings.TrimSpace(rule.Group)
	rule.Strategy = strings.TrimSpace(rule.Strategy)
	rule.GuaranteePriority = strings.TrimSpace(rule.GuaranteePriority)
	rule.CountShortageStrategy = strings.TrimSpace(rule.CountShortageStrategy)
	rule.CapacityShortageStrategy = strings.TrimSpace(rule.CapacityShortageStrategy)

	legacyStrategy := rule.Strategy
	if !IsSupportedChannelPreparationAutoPromotionStrategy(legacyStrategy) {
		legacyStrategy = ChannelPreparationAutoPromotionStrategyPriorityWeighted
	}
	if !IsSupportedChannelPreparationAutoPromotionGuaranteePriority(rule.GuaranteePriority) {
		rule.GuaranteePriority = ChannelPreparationAutoPromotionGuaranteePriorityCapacityFirst
	}
	if !IsSupportedChannelPreparationAutoPromotionStrategy(rule.CountShortageStrategy) {
		rule.CountShortageStrategy = legacyStrategy
	}
	if !IsSupportedChannelPreparationAutoPromotionStrategy(rule.CapacityShortageStrategy) {
		rule.CapacityShortageStrategy = legacyStrategy
	}
	// Keep legacy strategy readable by older code. Capacity-first is the V1-compatible path.
	rule.Strategy = rule.CapacityShortageStrategy
}

func IsSupportedChannelPreparationAutoPromotionGuaranteePriority(priority string) bool {
	switch priority {
	case ChannelPreparationAutoPromotionGuaranteePriorityCapacityFirst,
		ChannelPreparationAutoPromotionGuaranteePriorityCountFirst:
		return true
	default:
		return false
	}
}

func IsSupportedChannelPreparationAutoPromotionStrategy(strategy string) bool {
	switch strategy {
	case ChannelPreparationAutoPromotionStrategyPriorityWeighted,
		ChannelPreparationAutoPromotionStrategySmallBalanceFirst,
		ChannelPreparationAutoPromotionStrategyLargeBalanceFirst:
		return true
	default:
		return false
	}
}

func ValidateChannelPreparationAutoPromotionRules(rules []ChannelPreparationAutoPromotionRule) error {
	seenIds := make(map[string]bool)
	for index := range rules {
		rawRule := rules[index]
		rawRule.GuaranteePriority = strings.TrimSpace(rawRule.GuaranteePriority)
		rawRule.CountShortageStrategy = strings.TrimSpace(rawRule.CountShortageStrategy)
		rawRule.CapacityShortageStrategy = strings.TrimSpace(rawRule.CapacityShortageStrategy)
		rawRule.Strategy = strings.TrimSpace(rawRule.Strategy)
		if rawRule.GuaranteePriority != "" && !IsSupportedChannelPreparationAutoPromotionGuaranteePriority(rawRule.GuaranteePriority) {
			return fmt.Errorf("第 %d 条规则保障优先级无效", index+1)
		}
		if rawRule.CountShortageStrategy != "" && !IsSupportedChannelPreparationAutoPromotionStrategy(rawRule.CountShortageStrategy) {
			return fmt.Errorf("第 %d 条规则数量不足策略无效", index+1)
		}
		if rawRule.CapacityShortageStrategy != "" && !IsSupportedChannelPreparationAutoPromotionStrategy(rawRule.CapacityShortageStrategy) {
			return fmt.Errorf("第 %d 条规则容量不足策略无效", index+1)
		}
		if rawRule.Strategy != "" && !IsSupportedChannelPreparationAutoPromotionStrategy(rawRule.Strategy) && rawRule.CountShortageStrategy == "" && rawRule.CapacityShortageStrategy == "" {
			return fmt.Errorf("第 %d 条规则策略无效", index+1)
		}

		rule := rawRule
		NormalizeChannelPreparationAutoPromotionRule(&rule)
		if rule.Id == "" {
			return fmt.Errorf("第 %d 条规则缺少 id", index+1)
		}
		if seenIds[rule.Id] {
			return fmt.Errorf("规则 id 重复：%s", rule.Id)
		}
		seenIds[rule.Id] = true
		if strings.TrimSpace(rule.Group) == "" {
			return fmt.Errorf("第 %d 条规则缺少分组", index+1)
		}
		if rule.Type <= 0 {
			return fmt.Errorf("第 %d 条规则渠道类型无效", index+1)
		}
		if rule.ThresholdUSD <= 0 {
			return fmt.Errorf("第 %d 条规则阈值必须大于 0", index+1)
		}
		if rule.MinimumUsableChannelCount < 0 {
			return fmt.Errorf("第 %d 条规则最低可用渠道数不能小于 0", index+1)
		}
		if !IsSupportedChannelPreparationAutoPromotionGuaranteePriority(rule.GuaranteePriority) {
			return fmt.Errorf("第 %d 条规则保障优先级无效", index+1)
		}
		if !IsSupportedChannelPreparationAutoPromotionStrategy(rule.CountShortageStrategy) {
			return fmt.Errorf("第 %d 条规则数量不足策略无效", index+1)
		}
		if !IsSupportedChannelPreparationAutoPromotionStrategy(rule.CapacityShortageStrategy) {
			return fmt.Errorf("第 %d 条规则容量不足策略无效", index+1)
		}
	}
	return nil
}

func ValidateChannelPreparationAutoPromotionRulesJSONString(value string) error {
	value = strings.TrimSpace(value)
	if value == "" {
		value = "[]"
	}
	var rules []ChannelPreparationAutoPromotionRule
	if err := common.Unmarshal([]byte(value), &rules); err != nil {
		return err
	}
	return ValidateChannelPreparationAutoPromotionRules(rules)
}
