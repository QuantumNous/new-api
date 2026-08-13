package dto

// ResponseBilling is the gateway-calculated charge for one completed request.
// Unit prices are present for standard token billing. Dynamic expression and
// fixed-per-request billing return the authoritative total cost instead.
type ResponseBilling struct {
	Currency                  string   `json:"currency"`
	TotalCost                 float64  `json:"total_cost"`
	BillingMode               string   `json:"billing_mode"`
	BillingSource             string   `json:"billing_source,omitempty"`
	GroupRatio                float64  `json:"group_ratio"`
	InputUnitPricePerMillion  *float64 `json:"input_unit_price_per_million,omitempty"`
	OutputUnitPricePerMillion *float64 `json:"output_unit_price_per_million,omitempty"`
	RequestPrice              *float64 `json:"request_price,omitempty"`
	MatchedTier               string   `json:"matched_tier,omitempty"`
}
