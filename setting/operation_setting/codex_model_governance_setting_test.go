package operation_setting

import (
	"reflect"
	"regexp"
	"testing"
)

func TestDefaultCodexModelGovernanceSetting(t *testing.T) {
	setting := GetCodexModelGovernanceSetting()
	if setting.Enabled {
		t.Fatal("expected Codex model governance to be disabled by default")
	}
	if setting.ProbeEnabled {
		t.Fatal("expected Codex model governance probe to be disabled by default")
	}
	if setting.ProbeIntervalMinutes != 1440 {
		t.Fatalf("probe interval minutes = %d, want 1440", setting.ProbeIntervalMinutes)
	}
	if len(setting.UnsupportedMessagePatterns) != 1 {
		t.Fatalf("default unsupported patterns = %d, want 1", len(setting.UnsupportedMessagePatterns))
	}
	if setting.UnsupportedMessagePatterns[0] != DefaultCodexUnsupportedPattern {
		t.Fatalf("default unsupported pattern = %q, want %q", setting.UnsupportedMessagePatterns[0], DefaultCodexUnsupportedPattern)
	}
	if _, err := regexp.Compile(setting.UnsupportedMessagePatterns[0]); err != nil {
		t.Fatalf("default unsupported regex does not compile: %v", err)
	}
	if len(setting.OfficialSourceURLs) != 0 {
		t.Fatalf("official source urls = %v, want empty", setting.OfficialSourceURLs)
	}
	wantLifecycleTerms := []string{"deprecated", "retired", "sunset", "unavailable", "not supported"}
	if !reflect.DeepEqual(setting.OfficialLifecycleTerms, wantLifecycleTerms) {
		t.Fatalf("official lifecycle terms = %v, want %v", setting.OfficialLifecycleTerms, wantLifecycleTerms)
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

	err = ValidateCodexModelGovernancePatterns([]string{``})
	if err == nil {
		t.Fatal("expected empty regex error")
	}

	err = ValidateCodexModelGovernancePatterns([]string{})
	if err == nil {
		t.Fatal("expected empty pattern list error")
	}
}
