package ratio_setting

import "testing"

// Anthropic's Claude 5 generation (Opus 5, Sonnet 5, Fable 5, Mythos 5) bills
// output at 5x input. Before 2026-08 none of the "-5" IDs matched a branch in
// getHardcodedCompletionModelRatio (which only knew claude-3 / claude-*-4), so
// they fell through to 1x and output tokens were billed at the input price.
//
// This guards the whole family, including effort and -thinking variants, which
// are the easy ones to forget when a new tier ships.
func TestClaude5FamilyBillsOutputAtFiveX(t *testing.T) {
	InitRatioSettings()

	models := []string{
		"claude-opus-5",
		"claude-opus-5-max",
		"claude-opus-5-xhigh",
		"claude-opus-5-high",
		"claude-opus-5-medium",
		"claude-opus-5-low",
		"claude-opus-5-thinking",
		"claude-sonnet-5",
		"claude-sonnet-5-thinking",
		"claude-fable-5",
		"claude-fable-5-thinking",
		"claude-mythos-5",
		"claude-mythos-5-thinking",
	}
	for _, name := range models {
		if got := GetCompletionRatio(name); got != 5 {
			t.Errorf("GetCompletionRatio(%q) = %v, want 5", name, got)
		}
		if _, found, _ := GetModelRatio(name); !found {
			t.Errorf("GetModelRatio(%q): no input price configured (would fail with 价格未配置)", name)
		}
	}
}

// Every GPT-5.6 tier prices output at 6x input ($5/$30, $2/$12, $0.2/$1.2).
// Without an explicit branch they inherit the generic gpt-5 rule (8x), which
// overcharges output by a third.
func TestGPT56TiersBillOutputAtSixX(t *testing.T) {
	InitRatioSettings()

	for _, name := range []string{"gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.6-cyber"} {
		if got := GetCompletionRatio(name); got != 6 {
			t.Errorf("GetCompletionRatio(%q) = %v, want 6", name, got)
		}
		if _, found, _ := GetModelRatio(name); !found {
			t.Errorf("GetModelRatio(%q): no input price configured", name)
		}
	}
}

// Models added to the catalogue for the 2026-08 refresh must all be priced —
// an unpriced model reaches the relay as "价格未配置" and the request is rejected.
func TestRefreshedCatalogModelsArePriced(t *testing.T) {
	InitRatioSettings()

	for _, name := range []string{
		"gemini-3.7-flash", "gemini-3.6-flash",
		"qwen3.8-max", "qwen3.7-max", "qwen3.7-plus", "qwen3.7-flash",
		"kimi-k3", "kimi-k2.7-code-highspeed",
		"glm-5.3",
		"grok-4.6", "grok-4.5",
	} {
		if _, found, _ := GetModelRatio(name); !found {
			t.Errorf("GetModelRatio(%q): no input price configured", name)
		}
		if got := GetCompletionRatio(name); got <= 1 {
			t.Errorf("GetCompletionRatio(%q) = %v, want > 1 (output is priced above input for all of these)", name, got)
		}
	}
}
