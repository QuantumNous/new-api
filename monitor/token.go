package monitor

import "strconv"

// RecordTokenRequest increments the per-user per-token request counter.
func RecordTokenRequest(userId, tokenId int) {
	if !Tier3Enabled() {
		return
	}
	uid := strconv.Itoa(userId)
	tid := strconv.Itoa(tokenId)
	TokenRequestsTotal.WithLabelValues(uid, tid).Inc()
}

// RecordTokenUsage records token and quota usage for a specific user/token.
func RecordTokenUsage(userId, tokenId int, model string, inputTokens, outputTokens, quota int) {
	if !Tier3Enabled() {
		return
	}
	uid := strconv.Itoa(userId)
	tid := strconv.Itoa(tokenId)

	if inputTokens > 0 {
		TokenTokensUsedTotal.WithLabelValues(uid, tid, model, "input").Add(float64(inputTokens))
	}
	if outputTokens > 0 {
		TokenTokensUsedTotal.WithLabelValues(uid, tid, model, "output").Add(float64(outputTokens))
	}
	if quota > 0 {
		TokenQuotaConsumedTotal.WithLabelValues(uid, tid).Add(float64(quota))
	}
}
