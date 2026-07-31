package operation_setting

import "math"

var BillingUSDToCNYRate = 1.0

func GetBillingUSDToCNYRate() float64 {
	if BillingUSDToCNYRate <= 0 || math.IsNaN(BillingUSDToCNYRate) || math.IsInf(BillingUSDToCNYRate, 0) {
		return 1
	}
	return BillingUSDToCNYRate
}
