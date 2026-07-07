package billingexpr

import (
	"math"

	"github.com/QuantumNous/new-api/common"
)

// QuotaRound converts a float64 quota value to int using half-away-from-zero
// rounding. Every tiered billing path (pre-consume, settlement, breakdown
// validation, log fields) MUST use this function to avoid +-1 discrepancies.
func QuotaRound(f float64) int {
	return common.QuotaFromFloat(math.Round(f))
}
