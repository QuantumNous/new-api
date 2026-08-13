package dto

const (
	UpstreamCostStatusSettled  = "settled"
	UpstreamCostStatusUnpriced = "unpriced"

	UpstreamCostSourceResponseCost = "response_cost"
	UpstreamCostSourceBillingUnits = "billing_units"
)

// UpstreamCostSnapshot is the immutable, admin-only cost result for one
// completed request. AmountCNYMicros is the accounting value; float fields are
// retained for log display and compatibility with existing clients.
type UpstreamCostSnapshot struct {
	Status                string  `json:"status"`
	Mode                  string  `json:"mode"`
	Source                string  `json:"source,omitempty"`
	Reason                string  `json:"reason,omitempty"`
	NativeUnit            string  `json:"native_unit"`
	NativeAmount          float64 `json:"native_amount,omitempty"`
	NativeAmountDecimal   string  `json:"native_amount_decimal,omitempty"`
	Units                 float64 `json:"units,omitempty"`
	RateCNYPerUnit        float64 `json:"rate_cny_per_unit"`
	RateCNYPerUnitDecimal string  `json:"rate_cny_per_unit_decimal,omitempty"`
	AmountCNY             float64 `json:"amount_cny,omitempty"`
	AmountCNYMicros       int64   `json:"amount_cny_micros,omitempty"`
	Estimated             bool    `json:"estimated"`
	PriceVersion          string  `json:"price_version,omitempty"`
	SettlementCurrency    string  `json:"settlement_currency"`
}
