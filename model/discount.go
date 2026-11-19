package model

import "math"

// NormalizeDiscount checks a settlement discount, such as a site's receivable
// discount or a channel supplier's payable discount: greater than 0 and at most
// 1, with at most 4 decimal places. It returns the value rounded to those 4
// places, which drops the floating-point noise of decimal input.
func NormalizeDiscount(d float64) (float64, bool) {
	scaled := math.Round(d * 10000)
	if !(d > 0 && d <= 1 && math.Abs(d*10000-scaled) <= 1e-6 && scaled >= 1) {
		return 0, false
	}
	return scaled / 10000, true
}
