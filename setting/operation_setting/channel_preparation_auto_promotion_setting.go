package operation_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	ChannelPreparationAutoPromotionStrategyPriorityWeighted = "priority_weighted"
)

type ChannelPreparationAutoPromotionRule struct {
	Id           string  `json:"id"`
	Enabled      bool    `json:"enabled"`
	Group        string  `json:"group"`
	Type         int     `json:"type"`
	ThresholdUSD float64 `json:"threshold_usd"`
	Strategy     string  `json:"strategy"`
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
	if rule.Strategy == "" || !IsSupportedChannelPreparationAutoPromotionStrategy(rule.Strategy) {
		rule.Strategy = ChannelPreparationAutoPromotionStrategyPriorityWeighted
	}
}

func IsSupportedChannelPreparationAutoPromotionStrategy(strategy string) bool {
	return strategy == ChannelPreparationAutoPromotionStrategyPriorityWeighted
}

func ValidateChannelPreparationAutoPromotionRules(rules []ChannelPreparationAutoPromotionRule) error {
	seenIds := make(map[string]bool)
	for index := range rules {
		rule := rules[index]
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
		if !IsSupportedChannelPreparationAutoPromotionStrategy(rule.Strategy) {
			return fmt.Errorf("第 %d 条规则策略无效", index+1)
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
