package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
)

// withNormalize flips ClaudeSettings.ResponseNormalizeEnabled for the duration
// of a test and restores it afterward (test-state isolation).
func withNormalize(t *testing.T, enabled bool) {
	t.Helper()
	settings := model_setting.GetClaudeSettings()
	orig := settings.ResponseNormalizeEnabled
	settings.ResponseNormalizeEnabled = enabled
	t.Cleanup(func() { settings.ResponseNormalizeEnabled = orig })
}

func TestCalibrateAnthropicInputTokens_PerModelFactors(t *testing.T) {
	withNormalize(t, true)

	cases := []struct {
		name     string
		estimate int
		model    string
		want     int
	}{
		// 1026 * 0.84 = 861.84 -> 862 (rounds to the observed real opus-4-6 value)
		{"opus-4-6 family ×0.84", 1026, "claude-opus-4-6", 862},
		// 1026 * 1.27 = 1303.02 -> 1303 (close to observed ~1300)
		{"opus-4-7 family ×1.27", 1026, "claude-opus-4-7", 1303},
		{"opus-4-8 family ×1.27", 1026, "claude-opus-4-8", 1303},
		// upstream slug form still matches via substring
		{"opus-4-6 slug substring", 1026, "anthropic/claude-4.6-opus-20260205-claude-opus-4-6", 862},
		// unknown model -> unchanged
		{"unknown model ×1.0", 1026, "claude-sonnet-4-5", 1026},
		{"empty model ×1.0", 1026, "", 1026},
		// case-insensitive matching
		{"uppercase model", 1000, "CLAUDE-OPUS-4-7", 1270},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CalibrateAnthropicInputTokens(tc.estimate, tc.model)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestCalibrateAnthropicInputTokens_NonPositiveEstimate(t *testing.T) {
	withNormalize(t, true)
	assert.Equal(t, 0, CalibrateAnthropicInputTokens(0, "claude-opus-4-6"))
	assert.Equal(t, -5, CalibrateAnthropicInputTokens(-5, "claude-opus-4-6"))
}

func TestCalibrateAnthropicInputTokens_NormalizeDisabled(t *testing.T) {
	withNormalize(t, false)
	// When normalization is off, the estimate passes through unchanged even for
	// a known model family (fallback to current behavior).
	assert.Equal(t, 1026, CalibrateAnthropicInputTokens(1026, "claude-opus-4-6"))
}

func TestGetInputTokenCalibrationFactor(t *testing.T) {
	settings := model_setting.GetClaudeSettings()
	assert.Equal(t, 0.84, settings.GetInputTokenCalibrationFactor("claude-opus-4-6"))
	assert.Equal(t, 1.27, settings.GetInputTokenCalibrationFactor("claude-opus-4-7"))
	assert.Equal(t, 1.27, settings.GetInputTokenCalibrationFactor("claude-opus-4-8"))
	assert.Equal(t, 1.0, settings.GetInputTokenCalibrationFactor("claude-opus-4-9"))
	assert.Equal(t, 1.0, settings.GetInputTokenCalibrationFactor(""))
}
