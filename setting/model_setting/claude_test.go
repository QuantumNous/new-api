package model_setting

import (
	"net/http"
	"testing"
)

func TestClaudeSettingsNormalizeDefaults(t *testing.T) {
	if !defaultClaudeSettings.ResponseNormalizeEnabled {
		t.Fatalf("ResponseNormalizeEnabled default must be true")
	}
	if !defaultClaudeSettings.SsePaddingEnabled {
		t.Fatalf("SsePaddingEnabled default must be true")
	}
	if len(defaultClaudeSettings.RecalcInputTokensChannels) != 0 {
		t.Fatalf("RecalcInputTokensChannels default must be empty, got %v", defaultClaudeSettings.RecalcInputTokensChannels)
	}
	want := map[string]float64{
		"claude-opus-4-6": 0.84,
		"claude-opus-4-7": 1.27,
		"claude-opus-4-8": 1.27,
	}
	for k, v := range want {
		if got := defaultClaudeSettings.InputTokenCalibration[k]; got != v {
			t.Fatalf("default calibration[%q]=%v, want %v", k, got, v)
		}
	}
}

func TestClaudeSettingsShouldRecalcInputTokens(t *testing.T) {
	// empty allowlist -> never recalc
	empty := &ClaudeSettings{}
	if empty.ShouldRecalcInputTokens(7) {
		t.Fatalf("empty allowlist must not match any channel")
	}
	// nil slice -> no panic, no match
	nilSlice := &ClaudeSettings{RecalcInputTokensChannels: nil}
	if nilSlice.ShouldRecalcInputTokens(7) {
		t.Fatalf("nil allowlist must not match")
	}
	// populated allowlist
	s := &ClaudeSettings{RecalcInputTokensChannels: []int{7, 14}}
	if !s.ShouldRecalcInputTokens(7) {
		t.Fatalf("channel 7 should be in allowlist")
	}
	if !s.ShouldRecalcInputTokens(14) {
		t.Fatalf("channel 14 should be in allowlist")
	}
	if s.ShouldRecalcInputTokens(99) {
		t.Fatalf("channel 99 must not be in allowlist")
	}
}

func TestClaudeSettingsGetInputTokenCalibrationFactor(t *testing.T) {
	// nil map -> falls back to built-in defaults
	nilMap := &ClaudeSettings{}
	if got := nilMap.GetInputTokenCalibrationFactor("claude-opus-4-6"); got != 0.84 {
		t.Fatalf("nil-map fallback opus-4-6 = %v, want 0.84", got)
	}
	if got := nilMap.GetInputTokenCalibrationFactor("claude-sonnet-4-5"); got != 1.0 {
		t.Fatalf("unknown model = %v, want 1.0", got)
	}
	if got := nilMap.GetInputTokenCalibrationFactor(""); got != 1.0 {
		t.Fatalf("empty model = %v, want 1.0", got)
	}
	// case-insensitive + substring match
	if got := nilMap.GetInputTokenCalibrationFactor("ANTHROPIC/CLAUDE-OPUS-4-7"); got != 1.27 {
		t.Fatalf("substring/case-insensitive opus-4-7 = %v, want 1.27", got)
	}
	// configured map overrides defaults
	custom := &ClaudeSettings{InputTokenCalibration: map[string]float64{"opus-9": 2.0}}
	if got := custom.GetInputTokenCalibrationFactor("claude-opus-9"); got != 2.0 {
		t.Fatalf("custom opus-9 = %v, want 2.0", got)
	}
	if got := custom.GetInputTokenCalibrationFactor("claude-opus-4-6"); got != 1.0 {
		t.Fatalf("custom map without opus-4-6 = %v, want 1.0", got)
	}
}

func TestClaudeSettingsWriteHeadersMergesConfiguredValuesIntoSingleHeader(t *testing.T) {
	settings := &ClaudeSettings{
		HeadersSettings: map[string]map[string][]string{
			"claude-3-7-sonnet-20250219-thinking": {
				"anthropic-beta": {
					"token-efficient-tools-2025-02-19",
				},
			},
		},
	}

	headers := http.Header{}
	headers.Set("anthropic-beta", "output-128k-2025-02-19")

	settings.WriteHeaders("claude-3-7-sonnet-20250219-thinking", &headers)

	got := headers.Values("anthropic-beta")
	if len(got) != 1 {
		t.Fatalf("expected a single merged header value, got %v", got)
	}
	expected := "output-128k-2025-02-19,token-efficient-tools-2025-02-19"
	if got[0] != expected {
		t.Fatalf("expected merged header %q, got %q", expected, got[0])
	}
}

func TestClaudeSettingsWriteHeadersDeduplicatesAcrossCommaSeparatedAndRepeatedValues(t *testing.T) {
	settings := &ClaudeSettings{
		HeadersSettings: map[string]map[string][]string{
			"claude-3-7-sonnet-20250219-thinking": {
				"anthropic-beta": {
					"token-efficient-tools-2025-02-19",
					"computer-use-2025-01-24",
				},
			},
		},
	}

	headers := http.Header{}
	headers.Add("anthropic-beta", "output-128k-2025-02-19, token-efficient-tools-2025-02-19")
	headers.Add("anthropic-beta", "token-efficient-tools-2025-02-19")

	settings.WriteHeaders("claude-3-7-sonnet-20250219-thinking", &headers)

	got := headers.Values("anthropic-beta")
	if len(got) != 1 {
		t.Fatalf("expected duplicate values to collapse into one header, got %v", got)
	}
	expected := "output-128k-2025-02-19,token-efficient-tools-2025-02-19,computer-use-2025-01-24"
	if got[0] != expected {
		t.Fatalf("expected deduplicated merged header %q, got %q", expected, got[0])
	}
}
