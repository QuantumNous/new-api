package operation_setting

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const MaxRefusalFallbackCooldownSeconds = 30 * 24 * 60 * 60

type RefusalFallbackRule struct {
	Name            string   `json:"name"`
	ModelRegex      []string `json:"model_regex"`
	PathRegex       []string `json:"path_regex,omitempty"`
	Groups          []string `json:"groups,omitempty"`
	FallbackGroup   string   `json:"fallback_group"`
	CooldownSeconds int      `json:"cooldown_seconds"`
}

type RefusalFallbackSetting struct {
	Enabled bool                  `json:"enabled"`
	Rules   []RefusalFallbackRule `json:"rules"`
}

var refusalFallbackSetting = RefusalFallbackSetting{
	Enabled: false,
	Rules:   []RefusalFallbackRule{},
}

func init() {
	config.GlobalConfig.Register("refusal_fallback_setting", &refusalFallbackSetting)
}

func GetRefusalFallbackSetting() *RefusalFallbackSetting {
	return &refusalFallbackSetting
}

func ValidateRefusalFallbackRules(raw string) error {
	var rules []RefusalFallbackRule
	if err := common.UnmarshalJsonStr(raw, &rules); err != nil {
		return fmt.Errorf("invalid refusal fallback rules JSON: %w", err)
	}

	names := make(map[string]struct{}, len(rules))
	for index, rule := range rules {
		name := strings.TrimSpace(rule.Name)
		if name == "" {
			return fmt.Errorf("refusal fallback rule %d must have a name", index+1)
		}
		if _, exists := names[name]; exists {
			return fmt.Errorf("refusal fallback rule name %q is duplicated", name)
		}
		names[name] = struct{}{}

		if len(rule.ModelRegex) == 0 {
			return fmt.Errorf("refusal fallback rule %q must include at least one model regex", name)
		}
		fallbackGroup := strings.TrimSpace(rule.FallbackGroup)
		if fallbackGroup == "" {
			return fmt.Errorf("refusal fallback rule %q must include a fallback group", name)
		}
		if fallbackGroup == "auto" {
			return fmt.Errorf("refusal fallback rule %q cannot use the auto group", name)
		}
		for _, group := range rule.Groups {
			if strings.TrimSpace(group) == "auto" {
				return fmt.Errorf("refusal fallback rule %q cannot match the auto source group", name)
			}
		}
		if rule.CooldownSeconds <= 0 || rule.CooldownSeconds > MaxRefusalFallbackCooldownSeconds {
			return fmt.Errorf(
				"refusal fallback rule %q cooldown must be between 1 and %d seconds",
				name,
				MaxRefusalFallbackCooldownSeconds,
			)
		}

		for _, pattern := range append(append([]string{}, rule.ModelRegex...), rule.PathRegex...) {
			if strings.TrimSpace(pattern) == "" {
				return fmt.Errorf("refusal fallback rule %q contains an empty regex", name)
			}
			if _, err := regexp.Compile(pattern); err != nil {
				return fmt.Errorf("refusal fallback rule %q contains invalid regex %q: %w", name, pattern, err)
			}
		}
	}
	return nil
}
