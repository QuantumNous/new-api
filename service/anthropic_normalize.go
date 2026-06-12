package service

import (
	"math"
	"strings"

	"github.com/QuantumNous/new-api/constant"
)

// anthropicInputTokenCalibration maps a lowercase model-name substring to a
// calibration factor applied to the cl100k-based prompt-token estimate at the
// message_start display boundary only (R2.7).
//
// Rationale (research §5.4): new-api estimates prompt tokens for *all* Claude
// models with the GPT cl100k tokenizer (tokenizer.go only initializes
// cl100k_base; ForModel("claude-*") falls back to it). The estimate is
// therefore model-independent (~constant for a given prompt) and diverges from
// the real Claude token count by a model-dependent, sign-flipping ~20%:
//   - opus-4-6 family: estimate runs ~19% high  -> ×0.84 brings it down
//   - opus-4-7 / opus-4-8 family: estimate runs ~21% low -> ×1.27 brings it up
//
// A single global factor cannot fix both directions, so the table is keyed by
// model family. Unknown models get ×1.0 (the safe current behavior).
//
// The factors live in a package-level map so new model families can be added
// without code surgery. Matching is by case-insensitive substring of the
// model name; the longest matching key wins (so "opus-4-6" is preferred over a
// hypothetical broader "opus" key, were one ever added).
var anthropicInputTokenCalibration = map[string]float64{
	"opus-4-6": 0.84,
	"opus-4-7": 1.27,
	"opus-4-8": 1.27,
}

// CalibrateAnthropicInputTokens applies the per-model calibration factor to a
// cl100k-based prompt-token estimate so the message_start.usage.input_tokens
// shown to the client lands closer to the real Anthropic count.
//
// IMPORTANT: this is a *display-only* correction applied at the message_start
// conversion boundary. It does NOT touch EstimateRequestToken or the billing
// pre-deduction path (hard constraint R2.4) — final settlement uses the real
// upstream usage from message_delta, not this value.
//
// When AnthropicResponseNormalize is disabled, the estimate is returned
// unchanged (fall back to current behavior). Unknown / empty model names also
// pass through unchanged (factor 1.0).
func CalibrateAnthropicInputTokens(estimate int, model string) int {
	if !constant.AnthropicResponseNormalize {
		return estimate
	}
	if estimate <= 0 {
		return estimate
	}
	factor := lookupInputTokenCalibrationFactor(model)
	if factor == 1.0 {
		return estimate
	}
	return int(math.Round(float64(estimate) * factor))
}

// lookupInputTokenCalibrationFactor returns the calibration factor for the
// given model name, defaulting to 1.0 (no change) when no family matches. The
// longest matching substring key wins to keep matching deterministic if
// overlapping keys are ever added.
func lookupInputTokenCalibrationFactor(model string) float64 {
	if model == "" {
		return 1.0
	}
	lower := strings.ToLower(model)
	factor := 1.0
	matchedLen := 0
	for key, f := range anthropicInputTokenCalibration {
		if len(key) > matchedLen && strings.Contains(lower, key) {
			factor = f
			matchedLen = len(key)
		}
	}
	return factor
}
