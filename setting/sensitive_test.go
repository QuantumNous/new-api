package setting

import (
	"strings"
	"testing"
)

func TestParseSensitiveCheckRulesNormalizesConfig(t *testing.T) {
	raw := `{
		"rules": [
			{
				"id": " rule-1 ",
				"name": " Test rule ",
				"enabled": true,
				"groups": [" default ", "vip", "default", ""],
				"models": [" gpt-4o-mini ", "gpt-4o-mini"],
				"model_regex": ["^claude-.*$"],
				"include_global_words": true,
				"words": [" block ", "block", ""]
			}
		]
	}`

	config, err := ParseSensitiveCheckRules(raw)
	if err != nil {
		t.Fatalf("ParseSensitiveCheckRules returned error: %v", err)
	}
	if config.Version != 1 {
		t.Fatalf("Version = %d, want 1", config.Version)
	}
	if len(config.Rules) != 1 {
		t.Fatalf("len(Rules) = %d, want 1", len(config.Rules))
	}
	rule := config.Rules[0]
	if rule.ID != "rule-1" || rule.Name != "Test rule" {
		t.Fatalf("rule id/name not normalized: %#v", rule)
	}
	if got := strings.Join(rule.Groups, ","); got != "default,vip" {
		t.Fatalf("Groups = %q, want default,vip", got)
	}
	if got := strings.Join(rule.Models, ","); got != "gpt-4o-mini" {
		t.Fatalf("Models = %q, want gpt-4o-mini", got)
	}
	if got := strings.Join(rule.Words, ","); got != "block" {
		t.Fatalf("Words = %q, want block", got)
	}
}

func TestParseSensitiveCheckRulesRejectsInvalidRegex(t *testing.T) {
	raw := `{"version":1,"rules":[{"enabled":true,"model_regex":["("],"include_global_words":true}]}`
	if _, err := ParseSensitiveCheckRules(raw); err == nil {
		t.Fatal("ParseSensitiveCheckRules expected invalid regex error")
	}
}

func TestParseSensitiveCheckRulesRejectsEnabledRuleWithoutWords(t *testing.T) {
	raw := `{"version":1,"rules":[{"enabled":true,"include_global_words":false}]}`
	if _, err := ParseSensitiveCheckRules(raw); err == nil {
		t.Fatal("ParseSensitiveCheckRules expected missing words error")
	}
}

func TestSensitiveCheckRulesFromStringStoresCopy(t *testing.T) {
	originalRules := GetSensitiveCheckRulesCopy()
	originalWords := GetSensitiveWordsCopy()
	t.Cleanup(func() {
		sensitiveMutex.Lock()
		defer sensitiveMutex.Unlock()
		SensitiveCheckRules = originalRules
		SensitiveWords = originalWords
	})

	raw := `{"version":1,"rules":[{"id":"r1","enabled":true,"include_global_words":true,"models":["gpt-4o"]}]}`
	if err := SensitiveCheckRulesFromString(raw); err != nil {
		t.Fatalf("SensitiveCheckRulesFromString returned error: %v", err)
	}

	copyConfig := GetSensitiveCheckRulesCopy()
	copyConfig.Rules[0].Models[0] = "mutated"

	stored := GetSensitiveCheckRulesCopy()
	if stored.Rules[0].Models[0] != "gpt-4o" {
		t.Fatalf("stored config was mutated through copy: %#v", stored.Rules[0].Models)
	}
}
