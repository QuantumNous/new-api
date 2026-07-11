package modelroute

import (
	"time"

	"github.com/QuantumNous/new-api/model"
)

// CanTakeOver implements three-zone takeover thresholds (PRD §27).
func CanTakeOver(current, candidate model.ResolvedRouteCandidate) bool {
	if candidate.Metrics == nil || candidate.Metrics.State() != model.RouteHealthy {
		return false
	}
	if IsRouteStale(candidate.Metrics, false) {
		return false // cannot takeover on stale scores (PRD §9)
	}
	delta := candidate.ManualPriority - current.ManualPriority
	curTTFT := estimatedTTFTMs(current)
	candTTFT := estimatedTTFTMs(candidate)
	conf := candidate.Metrics.TakeoverConfirmations

	switch {
	case delta > 0:
		// higher priority: not significantly worse
		curRel := f64or(nilSafeSuccess(current), 0)
		candRel := f64or(nilSafeSuccess(candidate), 0)
		return candRel >= curRel &&
			candTTFT <= curTTFT*1.15 &&
			conf >= 3

	case delta == 0:
		return candTTFT <= curTTFT/1.10 && conf >= 3

	default:
		gap := -delta
		if gap > 50 {
			gap = 50
		}
		requiredRatio := 1.10 + float64(gap)*0.014
		requiredAbsMs := 100.0 + float64(-delta)*10.0 // use full gap for absolute
		requiredConf := 3 + (-delta)/10
		return curTTFT >= candTTFT*requiredRatio &&
			(curTTFT-candTTFT) >= requiredAbsMs &&
			conf >= requiredConf
	}
}

// EstimatedTTFTDuration returns production TTFT estimate for a candidate.
func EstimatedTTFTDuration(c model.ResolvedRouteCandidate) time.Duration {
	return time.Duration(estimatedTTFTMs(c)) * time.Millisecond
}
