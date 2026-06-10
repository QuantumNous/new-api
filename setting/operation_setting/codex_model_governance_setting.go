package operation_setting

import (
	"fmt"
	"regexp"

	"github.com/QuantumNous/new-api/setting/config"
)

type CodexModelGovernanceSetting struct {
	Enabled                    bool     `json:"enabled"`
	UnsupportedMessagePatterns []string `json:"unsupported_message_patterns"`
	AlertCooldownMinutes       float64  `json:"alert_cooldown_minutes"`
}

var codexModelGovernanceSetting = CodexModelGovernanceSetting{
	Enabled: false,
	UnsupportedMessagePatterns: []string{
		`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`,
	},
	AlertCooldownMinutes: 60,
}

func init() {
	config.GlobalConfig.Register("codex_model_governance_setting", &codexModelGovernanceSetting)
}

func GetCodexModelGovernanceSetting() *CodexModelGovernanceSetting {
	return &codexModelGovernanceSetting
}

func ValidateCodexModelGovernancePatterns(patterns []string) error {
	for _, pattern := range patterns {
		if _, err := regexp.Compile(pattern); err != nil {
			return fmt.Errorf("invalid codex model governance unsupported message pattern %q: %w", pattern, err)
		}
	}
	return nil
}
