package ratio_setting

import "testing"

func TestConfiguredCompletionRatioOverridesHardcodedGPT5Ratio(t *testing.T) {
	originalCompletionRatio := CompletionRatio2JSONString()
	t.Cleanup(func() {
		if err := UpdateCompletionRatioByJSONString(originalCompletionRatio); err != nil {
			t.Fatalf("restore completion ratio: %v", err)
		}
	})

	if err := UpdateCompletionRatioByJSONString(`{"gpt-5.5":6}`); err != nil {
		t.Fatalf("update completion ratio: %v", err)
	}

	if got := GetCompletionRatio("gpt-5.5"); got != 6 {
		t.Fatalf("GetCompletionRatio() = %v, want 6", got)
	}

	info := GetCompletionRatioInfo("gpt-5.5")
	if info.Ratio != 6 {
		t.Fatalf("GetCompletionRatioInfo().Ratio = %v, want 6", info.Ratio)
	}
	if info.Locked {
		t.Fatal("GetCompletionRatioInfo().Locked = true, want false for configured ratio")
	}
}

func TestHardcodedCompletionRatioAppliesWhenGPT5RatioIsNotConfigured(t *testing.T) {
	originalCompletionRatio := CompletionRatio2JSONString()
	t.Cleanup(func() {
		if err := UpdateCompletionRatioByJSONString(originalCompletionRatio); err != nil {
			t.Fatalf("restore completion ratio: %v", err)
		}
	})

	if err := UpdateCompletionRatioByJSONString(`{}`); err != nil {
		t.Fatalf("update completion ratio: %v", err)
	}

	if got := GetCompletionRatio("gpt-5.5"); got != 8 {
		t.Fatalf("GetCompletionRatio() = %v, want 8", got)
	}

	info := GetCompletionRatioInfo("gpt-5.5")
	if info.Ratio != 8 {
		t.Fatalf("GetCompletionRatioInfo().Ratio = %v, want 8", info.Ratio)
	}
	if !info.Locked {
		t.Fatal("GetCompletionRatioInfo().Locked = false, want true for hardcoded ratio")
	}
}
