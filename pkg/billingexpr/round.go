package billingexpr

import "math"

// QuotaRound converts a float64 quota value to int64 using half-away-from-zero
// rounding. Every tiered billing path (pre-consume, settlement, breakdown
// validation, log fields) MUST use this function to avoid +-1 discrepancies.
func QuotaRound(f float64) int64 {
	return int64(math.Round(f))
}
