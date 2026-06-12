package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func withNormalize(t *testing.T, enabled bool) {
	t.Helper()
	orig := constant.AnthropicResponseNormalize
	constant.AnthropicResponseNormalize = enabled
	t.Cleanup(func() { constant.AnthropicResponseNormalize = orig })
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
		{"opus-4-6 slug substring", 1026, "anthropic/claude-4.6-opus-20260205-opus-4-6", 862},
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

func TestLookupInputTokenCalibrationFactor(t *testing.T) {
	assert.Equal(t, 0.84, lookupInputTokenCalibrationFactor("claude-opus-4-6"))
	assert.Equal(t, 1.27, lookupInputTokenCalibrationFactor("claude-opus-4-7"))
	assert.Equal(t, 1.27, lookupInputTokenCalibrationFactor("claude-opus-4-8"))
	assert.Equal(t, 1.0, lookupInputTokenCalibrationFactor("claude-opus-4-9"))
	assert.Equal(t, 1.0, lookupInputTokenCalibrationFactor(""))
}
