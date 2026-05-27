package billingexpr

import "math"

// QuotaRound converts a float64 quota value to int64 using half-away-from-zero
// rounding. Every tiered billing path (pre-consume, settlement, breakdown
// validation, log fields) MUST use this function to avoid +-1 discrepancies.
func QuotaRound(f float64) int64 {
	return int64(math.Round(f))
}

// QuotaFloor converts a float64 quota value to int64 using floor semantics.
// Use this when preserving legacy truncation behavior for non-negative quota
// calculations while still avoiding float64->int64 implicit casts spread across
// the codebase.
func QuotaFloor(f float64) int64 {
	return int64(math.Floor(f))
}
