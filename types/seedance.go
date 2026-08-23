package types

// SeedanceBillingSnapshot is captured at task submit so polling can settle
// token cost plus optional super-resolution duration cost.
type SeedanceBillingSnapshot struct {
	UnitPriceRMB       float64 `json:"unit_price_rmb"`
	BillingResolution  string  `json:"billing_resolution"`
	OutputResolution   string  `json:"output_resolution,omitempty"`
	HasVideo           bool    `json:"has_video"`
	SuperResolution    bool    `json:"super_resolution"`
	SuperResolutionRMB float64 `json:"super_resolution_rmb,omitempty"`
	DurationSeconds    float64 `json:"duration_seconds"`
	TokensPerSecond    float64 `json:"tokens_per_second"`
	MatchedModel       string  `json:"matched_model,omitempty"`
}

// SeedancePublicPricing is the user-facing Seedance quote attached to /api/pricing.
type SeedancePublicPricing struct {
	SuperResolution         bool               `json:"super_resolution"`
	TokensPerSecond         map[string]float64 `json:"tokens_per_second"`
	TextUnitPriceRMB        map[string]float64 `json:"text_unit_price_rmb"`
	VideoUnitPriceRMB       map[string]float64 `json:"video_unit_price_rmb"`
	TextPerSecondUSD        map[string]float64 `json:"text_per_second_usd"`
	VideoPerSecondUSD       map[string]float64 `json:"video_per_second_usd"`
	SRFrom480To720RMB       float64            `json:"sr_480_to_720_rmb,omitempty"`
	SRFrom720To1080RMB      float64            `json:"sr_720_to_1080_rmb,omitempty"`
	SRFrom480To720USD       float64            `json:"sr_480_to_720_usd,omitempty"`
	SRFrom720To1080USD      float64            `json:"sr_720_to_1080_usd,omitempty"`
	OutputTextPerSecondUSD  map[string]float64 `json:"output_text_per_second_usd,omitempty"`
	OutputVideoPerSecondUSD map[string]float64 `json:"output_video_per_second_usd,omitempty"`
}
