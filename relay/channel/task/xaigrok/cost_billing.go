package xaigrok

import (
	"math"

	"github.com/QuantumNous/new-api/common"
)

// usdTicksPerDollar is the fixed-point scale xAI reports costs in.
// A 480P second bills 500000000 ticks, which is $0.05.
const usdTicksPerDollar = 1e10

// grokMarkup multiplies the upstream cost to reach the customer price.
//
// It lives in code rather than in ModelPrice so that the deploy needs no
// matching configuration change. ModelPrice keeps meaning dollars per second
// for the reservation; reusing it here would give one field two incompatible
// meanings depending on which build is running, with nothing in the data to
// tell them apart.
const grokMarkup = 1.0

// upstreamCostUSD converts xAI's fixed-point cost. A non-positive value is not
// a usable cost: the caller must keep the reservation rather than settle at zero.
func upstreamCostUSD(ticks int64) (float64, bool) {
	if ticks <= 0 {
		return 0, false
	}
	return float64(ticks) / usdTicksPerDollar, true
}

// grokUsage is the subset of the poll response this settlement needs.
type grokUsage struct {
	CostInUSDTicks int64 `json:"cost_in_usd_ticks"`
}

type grokCostEnvelope struct {
	Usage *grokUsage `json:"usage"`
}

// parseUpstreamCost reads the cost out of the stored upstream response.
//
// Returns false for anything unreadable. A missing field most likely means the
// upstream renamed it, and guessing a cost there would misprice silently --
// which is the failure this settlement exists to remove.
func parseUpstreamCost(body []byte) (float64, bool) {
	if len(body) == 0 {
		return 0, false
	}
	var envelope grokCostEnvelope
	if err := common.Unmarshal(body, &envelope); err != nil {
		return 0, false
	}
	if envelope.Usage == nil {
		return 0, false
	}
	return upstreamCostUSD(envelope.Usage.CostInUSDTicks)
}

// settledQuotaFromCost converts an upstream cost into the quota to charge.
//
// Returns 0 for any input that cannot produce a meaningful charge. The caller
// treats 0 as "keep the reservation", so a bad input leaves the customer billed
// at the reserved amount rather than at nothing.
func settledQuotaFromCost(usd, groupRatio float64) int {
	if !isPositiveFinite(usd) || !isPositiveFinite(groupRatio) {
		return 0
	}
	quota := usd * grokMarkup * common.QuotaPerUnit * groupRatio
	if !isPositiveFinite(quota) {
		return 0
	}
	return int(quota)
}

func isPositiveFinite(v float64) bool {
	return v > 0 && !math.IsNaN(v) && !math.IsInf(v, 0)
}
