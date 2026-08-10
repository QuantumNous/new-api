package service

import "github.com/shopspring/decimal"

// ShadowCost is what a request would have cost if the caller's group were
// metered. It mirrors the billing formula in calculateAudioQuota with
// GroupRatio pinned to 1, because Free and Plus run at GroupRatio 0 — their
// real quota is always 0 and therefore useless as a meter.
//
// Returns 0 when the alias has no ModelRatio: there is no basis to invent.
func ShadowCost(promptTokens, completionTokens, cachedTokens int, modelRatio, completionRatio, cacheRatio float64) int64 {
	if modelRatio <= 0 {
		return 0
	}
	if cachedTokens < 0 {
		cachedTokens = 0
	}
	if completionTokens < 0 {
		completionTokens = 0
	}
	if cachedTokens > promptTokens {
		cachedTokens = promptTokens
	}
	fresh := decimal.NewFromInt(int64(promptTokens - cachedTokens))
	cached := decimal.NewFromInt(int64(cachedTokens)).Mul(decimal.NewFromFloat(cacheRatio))
	output := decimal.NewFromInt(int64(completionTokens)).Mul(decimal.NewFromFloat(completionRatio))

	weighted := fresh.Add(cached).Add(output)
	return weighted.Mul(decimal.NewFromFloat(modelRatio)).Round(0).IntPart()
}
