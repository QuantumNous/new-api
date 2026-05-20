package taskcommon

import (
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/tidwall/gjson"
)

// QuotaFromUSDCost converts upstream USD cost to internal quota (same basis as model fixed price).
// quota = cost * costMultiplier * QuotaPerUnit * groupRatio
func QuotaFromUSDCost(costUSD, groupRatio, costMultiplier float64) int {
	if costUSD <= 0 {
		return 0
	}
	if groupRatio <= 0 {
		groupRatio = 1
	}
	if costMultiplier <= 0 {
		costMultiplier = 1
	}
	q := costUSD * costMultiplier * common.QuotaPerUnit * groupRatio
	if q <= 0 {
		return 0
	}
	return int(math.Round(q))
}

// ExtractUSDFromJSON reads upstream dollar cost from common ApiMart-style payloads.
func ExtractUSDFromJSON(raw []byte) float64 {
	if len(raw) == 0 {
		return 0
	}
	for _, path := range []string{
		"data.cost",
		"data.data.cost",
		"cost",
	} {
		if v := gjson.GetBytes(raw, path); v.Exists() && v.Type == gjson.Number {
			if cost := v.Float(); cost > 0 {
				return cost
			}
		}
	}
	return 0
}
