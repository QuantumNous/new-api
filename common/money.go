package common

import "github.com/shopspring/decimal"

// FenToYuan converts an amount in fen (1/100 CNY) to yuan as float64.
//
// Per docs/enterprise-features-design.md (D1): all CNY arithmetic must stay in
// integer fen; this conversion exists only for interop with legacy float fields
// (topups.money) and human-readable display. Never feed the result back into
// monetary calculations.
func FenToYuan(fen int64) float64 {
	f, _ := decimal.NewFromInt(fen).Div(decimal.NewFromInt(100)).Float64()
	return f
}
