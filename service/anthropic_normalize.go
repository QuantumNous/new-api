package service

import (
	"math"

	"github.com/QuantumNous/new-api/setting/model_setting"
)

// CalibrateAnthropicInputTokens applies the per-model calibration factor to a
// cl100k-based prompt-token estimate so the message_start.usage.input_tokens
// shown to the client lands closer to the real Anthropic count.
//
// Rationale (research §5.4): new-api estimates prompt tokens for *all* Claude
// models with the GPT cl100k tokenizer (tokenizer.go only initializes
// cl100k_base; ForModel("claude-*") falls back to it). The estimate is
// therefore model-independent (~constant for a given prompt) and diverges from
// the real Claude token count by a model-dependent, sign-flipping ~20%:
//   - opus-4-6 family: estimate runs ~19% high  -> ×0.84 brings it down
//   - opus-4-7 / opus-4-8 family: estimate runs ~21% low -> ×1.27 brings it up
//
// A single global factor cannot fix both directions, so the factor table
// (ClaudeSettings.InputTokenCalibration, DB-persisted and UI-configurable, R4)
// is keyed by model family. Matching is by case-insensitive substring; the
// longest matching key wins. Unknown models get ×1.0 (the safe current behavior).
//
// IMPORTANT: this is a *display-only* correction applied at the message_start
// conversion boundary. It does NOT touch EstimateRequestToken or the billing
// pre-deduction path (hard constraint R2.4) — final settlement uses the real
// upstream usage from message_delta, not this value.
//
// When response normalization is disabled, the estimate is returned unchanged
// (fall back to current behavior). Unknown / empty model names also pass
// through unchanged (factor 1.0).
func CalibrateAnthropicInputTokens(estimate int, model string) int {
	settings := model_setting.GetClaudeSettings()
	if !settings.ResponseNormalizeEnabled {
		return estimate
	}
	if estimate <= 0 {
		return estimate
	}
	factor := settings.GetInputTokenCalibrationFactor(model)
	if factor == 1.0 {
		return estimate
	}
	return int(math.Round(float64(estimate) * factor))
}
