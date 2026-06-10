package operation_setting

import (
	"regexp"
	"testing"
)

func TestDefaultCodexModelGovernanceSetting(t *testing.T) {
	setting := GetCodexModelGovernanceSetting()
	if setting.Enabled {
		t.Fatal("expected Codex model governance to be disabled by default")
	}
	if len(setting.UnsupportedMessagePatterns) != 1 {
		t.Fatalf("default unsupported patterns = %d, want 1", len(setting.UnsupportedMessagePatterns))
	}
	if _, err := regexp.Compile(setting.UnsupportedMessagePatterns[0]); err != nil {
		t.Fatalf("default unsupported regex does not compile: %v", err)
	}
	if setting.AlertCooldownMinutes != 60 {
		t.Fatalf("alert cooldown = %v, want 60", setting.AlertCooldownMinutes)
	}
}

func TestValidateCodexModelGovernancePatterns(t *testing.T) {
	err := ValidateCodexModelGovernancePatterns([]string{`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`})
	if err != nil {
		t.Fatalf("expected valid pattern, got %v", err)
	}
	err = ValidateCodexModelGovernancePatterns([]string{`(`})
	if err == nil {
		t.Fatal("expected invalid regex error")
	}
}
