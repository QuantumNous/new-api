package ratio_setting

import "testing"

func TestGetCompletionRatioInfoGPT55UsesOfficialOutputMultiplier(t *testing.T) {
	info := GetCompletionRatioInfo("gpt-5.5")

	if info.Ratio != 6 {
		t.Fatalf("gpt-5.5 completion ratio = %v, want 6", info.Ratio)
	}
	if !info.Locked {
		t.Fatal("gpt-5.5 completion ratio should be locked to the official multiplier")
	}
}

func TestGetCompletionRatioGPT55DatedVariant(t *testing.T) {
	got := GetCompletionRatio("gpt-5.5-2026-04-24")

	if got != 6 {
		t.Fatalf("gpt-5.5 dated variant completion ratio = %v, want 6", got)
	}
}
