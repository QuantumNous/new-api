package service

import (
	"time"

	"github.com/QuantumNous/new-api/model"
)

// CycleMonth is the only cycle kind in use. The counter table carries the kind
// so a weekly cap can be added later without migrating live data; if one is,
// derive its start from a per-account slot rather than the calendar week, or
// every account refills at the same instant.
const CycleMonth = "month"

// UsageCycle reports which cycle `now` falls in and when that cycle refills.
// A user with a metered subscription counts against the subscription's own
// cycle, so the pool and the counters always share one refill date. Everyone
// else uses the calendar month.
func UsageCycle(kind string, sub *model.UserSubscription, now time.Time) (cycleStart int64, resetAt int64) {
	if sub != nil && sub.AmountTotal > 0 {
		start := sub.LastResetTime
		if start <= 0 {
			start = sub.StartTime
		}
		return start, sub.NextResetTime
	}
	first := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	return first.Unix(), first.AddDate(0, 1, 0).Unix()
}
