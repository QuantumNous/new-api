package operation_setting

import (
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type InviteGroupUpgradeRule struct {
	InviteCount int    `json:"invite_count"`
	TargetGroup string `json:"target_group"`
	Enabled     bool   `json:"enabled"`
}

type InviteGroupUpgradeSetting struct {
	Enabled bool                     `json:"enabled"`
	Rules   []InviteGroupUpgradeRule `json:"rules"`
}

var inviteGroupUpgradeSetting = InviteGroupUpgradeSetting{
	Enabled: false,
	Rules:   []InviteGroupUpgradeRule{},
}

func init() {
	config.GlobalConfig.Register("invite_group_upgrade_setting", &inviteGroupUpgradeSetting)
}

func GetInviteGroupUpgradeSetting() *InviteGroupUpgradeSetting {
	return &inviteGroupUpgradeSetting
}

func NormalizeInviteGroupUpgradeRules(rules []InviteGroupUpgradeRule) []InviteGroupUpgradeRule {
	normalized := make([]InviteGroupUpgradeRule, 0, len(rules))
	for _, rule := range rules {
		normalized = append(normalized, InviteGroupUpgradeRule{
			InviteCount: rule.InviteCount,
			TargetGroup: strings.TrimSpace(rule.TargetGroup),
			Enabled:     rule.Enabled,
		})
	}

	sort.SliceStable(normalized, func(i, j int) bool {
		if normalized[i].InviteCount == normalized[j].InviteCount {
			return normalized[i].TargetGroup < normalized[j].TargetGroup
		}
		return normalized[i].InviteCount < normalized[j].InviteCount
	})
	return normalized
}

func ValidateInviteGroupUpgradeRules(rules []InviteGroupUpgradeRule) error {
	seenInviteCount := make(map[int]struct{}, len(rules))

	for _, rule := range NormalizeInviteGroupUpgradeRules(rules) {
		if rule.InviteCount <= 0 {
			return fmt.Errorf("invite_count must be greater than 0")
		}
		if rule.TargetGroup == "" {
			return fmt.Errorf("target_group cannot be empty")
		}
		if _, ok := seenInviteCount[rule.InviteCount]; ok {
			return fmt.Errorf("duplicate invite_count: %d", rule.InviteCount)
		}
		seenInviteCount[rule.InviteCount] = struct{}{}
	}
	return nil
}

func ParseInviteGroupUpgradeRulesJSON(raw string) ([]InviteGroupUpgradeRule, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []InviteGroupUpgradeRule{}, nil
	}
	var rules []InviteGroupUpgradeRule
	if err := common.UnmarshalJsonStr(raw, &rules); err != nil {
		return nil, err
	}
	rules = NormalizeInviteGroupUpgradeRules(rules)
	if err := ValidateInviteGroupUpgradeRules(rules); err != nil {
		return nil, err
	}
	return rules, nil
}

func MustInviteGroupUpgradeRulesJSON(rules []InviteGroupUpgradeRule) string {
	rules = NormalizeInviteGroupUpgradeRules(rules)
	jsonBytes, err := common.Marshal(rules)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

func GetEnabledInviteGroupUpgradeRules() []InviteGroupUpgradeRule {
	normalized := NormalizeInviteGroupUpgradeRules(inviteGroupUpgradeSetting.Rules)
	rules := make([]InviteGroupUpgradeRule, 0, len(normalized))
	for _, rule := range normalized {
		if rule.Enabled {
			rules = append(rules, rule)
		}
	}
	return rules
}
