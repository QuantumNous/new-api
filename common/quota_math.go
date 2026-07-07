package common

import "math"

// QuotaFromFloat converts computed quota values to int with saturation.
// User-controlled multipliers must never overflow and turn a charge into a credit.
func QuotaFromFloat(value float64) int {
	if math.IsNaN(value) {
		return 0
	}
	if value >= math.MaxInt32 {
		return math.MaxInt32
	}
	if value <= math.MinInt32 {
		return math.MinInt32
	}
	return int(value)
}
