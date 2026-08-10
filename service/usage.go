package service

import (
	"github.com/QuantumNous/new-api/model"
)

// SumIncludedPools reports the metered pool across a user's active
// subscriptions. Pre-consume walks every active row and spends from the first
// with room, so the spendable pool is the sum of them.
func SumIncludedPools(subs []model.UserSubscription) (total, used, resetAt int64) {
	for _, sub := range subs {
		// AmountTotal 0 means unmetered in pre-consume, not exhausted.
		if sub.AmountTotal <= 0 {
			continue
		}
		total += sub.AmountTotal
		used += sub.AmountUsed
		// 0 means "never resets", so it must not win the earliest-reset race.
		if sub.NextResetTime > 0 && (resetAt == 0 || sub.NextResetTime < resetAt) {
			resetAt = sub.NextResetTime
		}
	}
	return total, used, resetAt
}
