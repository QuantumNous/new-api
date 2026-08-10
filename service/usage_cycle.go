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
	if sub != nil {
		if sub.AmountTotal > 0 {
			start := sub.LastResetTime
			if start <= 0 {
				start = sub.StartTime
			}
			return start, sub.NextResetTime
		}
		// A paying tier with no metered pool (Plus today) has no reset date to
		// read — next_reset_time is 0 — but it does have a billing date. Anchor
		// to that, so the renewal date and the usage refill date on the portal
		// card are the same day rather than two dates that invite the question.
		if sub.StartTime > 0 {
			return monthlyAnniversary(sub.StartTime, now)
		}
	}
	first := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	return first.Unix(), first.AddDate(0, 1, 0).Unix()
}

// monthlyAnniversary reports the most recent monthly anniversary of anchor on
// or before now, and the next one. It walks months rather than using the
// subscription's end_time because an annual plan runs a year end to end, and
// the usage cycle must stay monthly inside it.
func monthlyAnniversary(anchorUnix int64, now time.Time) (int64, int64) {
	anchor := time.Unix(anchorUnix, 0).In(now.Location())
	if now.Before(anchor) {
		return anchor.Unix(), addMonthsClamped(anchor, 1).Unix()
	}
	months := (now.Year()-anchor.Year())*12 + int(now.Month()) - int(anchor.Month())
	if addMonthsClamped(anchor, months).After(now) {
		months--
	}
	return addMonthsClamped(anchor, months).Unix(), addMonthsClamped(anchor, months+1).Unix()
}

// addMonthsClamped adds whole months, clamping a day-of-month that the target
// month is too short to hold. Go's AddDate rolls the overflow forward instead —
// 31 January plus one month is 3 March — which would drift a subscriber's cycle
// every short month.
func addMonthsClamped(t time.Time, months int) time.Time {
	first := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location()).AddDate(0, months, 0)
	day := t.Day()
	if last := daysInMonth(first.Year(), first.Month()); day > last {
		day = last
	}
	return time.Date(first.Year(), first.Month(), day, t.Hour(), t.Minute(), t.Second(), 0, t.Location())
}

func daysInMonth(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// CycleSubscription picks the row whose billing date anchors a user's usage
// cycle. Every caller — the gate, the accrual and the portal endpoint — must
// pick the same one, or they would read and write different counter rows for
// the same user. Selection is "the first active row", matching the order
// GetAllActiveUserSubscriptions returns.
func CycleSubscription(subs []model.UserSubscription) *model.UserSubscription {
	if len(subs) == 0 {
		return nil
	}
	return &subs[0]
}

// CycleSubscriptionFor loads the anchoring row for a user. Returns nil when
// they have none, which is the Free case and falls back to the calendar month.
func CycleSubscriptionFor(userId int) *model.UserSubscription {
	summaries, err := model.GetAllActiveUserSubscriptions(userId)
	if err != nil {
		return nil
	}
	subs := make([]model.UserSubscription, 0, len(summaries))
	for _, summary := range summaries {
		if summary.Subscription != nil {
			subs = append(subs, *summary.Subscription)
		}
	}
	return CycleSubscription(subs)
}
