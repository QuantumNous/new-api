package modelroute

import (
	"time"

	"github.com/QuantumNous/new-api/model"
)

// StaleAfter computes stale_after = max(3 × max_probe_interval, 30m) (PRD §9 / §33).
// useFirstStandby=true uses first_standby interval (2m); false uses other_standby (10m).
func StaleAfter(useFirstStandby bool) time.Duration {
	var maxProbe int
	if useFirstStandby {
		maxProbe = model.DefaultFirstStandbyMaxProbeIntervalSec
	} else {
		maxProbe = model.DefaultOtherStandbyMaxProbeIntervalSec
	}
	three := 3 * maxProbe
	minAfter := model.DefaultStaleMinimumAfterSec
	if three < minAfter {
		three = minAfter
	}
	return time.Duration(three) * time.Second
}

// IsRouteStale soft-marks HEALTHY / RECOVERING / UNKNOWN when last success/probe is old (PRD §9).
// STALE is not a RouteState.
func IsRouteStale(m *model.ChannelModelMetrics, useFirstStandby bool) bool {
	if m == nil {
		return false
	}
	st := m.State()
	switch st {
	case model.RouteHealthy, model.RouteRecovering, model.RouteUnknown:
	default:
		return false
	}
	last := lastActivityUnix(m)
	if last == 0 {
		// never observed: only UNKNOWN is soft-stale for probe prioritization
		return st == model.RouteUnknown
	}
	age := now().Sub(time.Unix(last, 0))
	return age >= StaleAfter(useFirstStandby)
}

func lastActivityUnix(m *model.ChannelModelMetrics) int64 {
	var best int64
	for _, p := range []*int64{m.LastSuccessAt, m.LastProbeAt, m.LastRequestAt} {
		if p != nil && *p > best {
			best = *p
		}
	}
	return best
}

// ClearStaleOnActivity is a no-op marker: freshness is computed from LastSuccessAt/LastProbeAt.
// Callers must update those fields on production success / valid shadow probe (PRD §9).
func MarkActivityNow(m *model.ChannelModelMetrics, production bool) {
	if m == nil {
		return
	}
	ts := now().Unix()
	if production {
		m.LastRequestAt = &ts
		m.LastSuccessAt = &ts
	} else {
		m.LastProbeAt = &ts
	}
	GlobalMetricsRuntime.Put(m)
}
