package operation_setting

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const DefaultCodexUnsupportedPattern = `The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`

type CodexModelGovernanceSetting struct {
	Enabled                    bool     `json:"enabled"`
	ProbeEnabled               bool     `json:"probe_enabled"`
	ProbeIntervalMinutes       int      `json:"probe_interval_minutes"`
	UnsupportedMessagePatterns []string `json:"unsupported_message_patterns"`
	OfficialSourceURLs         []string `json:"official_source_urls"`
	OfficialLifecycleTerms     []string `json:"official_lifecycle_terms"`
	AlertCooldownMinutes       int      `json:"alert_cooldown_minutes"`
}

var codexModelGovernanceSetting = CodexModelGovernanceSetting{
	Enabled:              false,
	ProbeEnabled:         false,
	ProbeIntervalMinutes: 1440,
	UnsupportedMessagePatterns: []string{
		DefaultCodexUnsupportedPattern,
	},
	OfficialSourceURLs: []string{},
	OfficialLifecycleTerms: []string{
		"deprecated",
		"retired",
		"sunset",
		"unavailable",
		"not supported",
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
	if len(patterns) == 0 {
		return fmt.Errorf("at least one Codex unsupported model pattern is required")
	}
	for index, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			return fmt.Errorf("pattern #%d is empty", index+1)
		}
		if _, err := regexp.Compile(pattern); err != nil {
			return fmt.Errorf("pattern #%d is invalid: %w", index+1, err)
		}
	}
	return nil
}
