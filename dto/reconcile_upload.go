package dto

// ReconcileUploadRequest is the multipart form parsed by /reconcile/admin/upload.
// `file` is read separately via c.FormFile. `Supplier` is reserved for future
// non-parallel adapters; today only "parallel" is accepted. `Granularity`
// controls the time-bucket size for the diff: "hour" (default) for fine-grained
// drift inspection, "day" for high-volume deployments where 24× more rows would
// blow up the JSON response.
type ReconcileUploadRequest struct {
	ChannelIDs  []int  `form:"channel_ids"`
	Supplier    string `form:"supplier"`
	Granularity string `form:"granularity"`
}

// Totals is the 4-token + amount tuple used in summary / row / by_model.
type Totals struct {
	TokensInput      int64   `json:"tokens_input"`
	TokensOutput     int64   `json:"tokens_output"`
	TokensCacheRead  int64   `json:"tokens_cache_read"`
	TokensCacheWrite int64   `json:"tokens_cache_write"`
	TokensCount      int64   `json:"tokens_count,omitempty"`
	AmountCNY        float64 `json:"amount_cny"`
}

// Summary is the top-of-page card.
type ReconcileSummary struct {
	From             int64   `json:"from"`
	To               int64   `json:"to"`
	ChannelIDs       []int   `json:"channel_ids"`
	ModelsCount      int     `json:"models_count"`
	RowsCount        int     `json:"rows_count"`
	SupplierOnlyRows int     `json:"supplier_only_rows"`
	LocalOnlyRows    int     `json:"local_only_rows"`
	ParseErrorsCount int     `json:"parse_errors_count"`
	SupplierTotal    Totals  `json:"supplier_total"`
	LocalTotal       Totals  `json:"local_total"`
	Delta            Totals  `json:"delta"`
	DeltaAmountPct   float64 `json:"delta_amount_pct"`
}

// DriftAnalysis classifies the cumulative Δ¥ pattern across the hour series.
type ReconcileDriftAnalysis struct {
	MaxAbsCumulativeDelta float64 `json:"max_abs_cumulative_delta"`
	FinalCumulativeDelta  float64 `json:"final_cumulative_delta"`
	Verdict               string  `json:"verdict"` // ok_drift_only / needs_attention / diverging
	DivergenceStartHour   int64   `json:"divergence_start_hour,omitempty"`
}

// DiffSide is the supplier or local half of a DiffRow. Pointer fields stay nil
// when that side has no data for the (model, hour) cell.
type DiffSide struct {
	TokensInput      int64   `json:"tokens_input"`
	TokensOutput     int64   `json:"tokens_output"`
	TokensCacheRead  int64   `json:"tokens_cache_read"`
	TokensCacheWrite int64   `json:"tokens_cache_write"`
	TokensCount      int64   `json:"tokens_count,omitempty"`
	AmountCNY        float64 `json:"amount_cny"`
	RequestCount     int     `json:"request_count,omitempty"`
}

// DiffRow is one (model, hour_bucket) cell.
type ReconcileDiffRow struct {
	HourBucket               int64     `json:"hour_bucket"`
	Model                    string    `json:"model"`
	Supplier                 *DiffSide `json:"supplier,omitempty"`
	Local                    *DiffSide `json:"local,omitempty"`
	Delta                    Totals    `json:"delta"`
	CumulativeDeltaAmountCNY float64   `json:"cumulative_delta_amount_cny"`
	Status                   string    `json:"status"` // matched / supplier_only / local_only
	Regions                  []string  `json:"regions,omitempty"`
}

// ByModelKind is one token-kind row inside ByModel.
type ByModelKind struct {
	Kind           string  `json:"kind"`
	SupplierTokens int64   `json:"supplier_tokens"`
	LocalTokens    int64   `json:"local_tokens"`
	DeltaTokens    int64   `json:"delta_tokens"`
	DeltaPct       float64 `json:"delta_pct"`
}

// ByModelStat aggregates one model across the whole interval.
type ByModelStat struct {
	Model             string        `json:"model"`
	Kinds             []ByModelKind `json:"kinds"`
	SupplierAmountCNY float64       `json:"supplier_amount_cny"`
	LocalAmountCNY    float64       `json:"local_amount_cny"`
	DeltaAmountCNY    float64       `json:"delta_amount_cny"`
}

// ParseError describes one bad row inside the uploaded xlsx.
type ReconcileParseError struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

// ReconcileResult is what the controller hands back to the frontend.
type ReconcileResult struct {
	Summary       ReconcileSummary       `json:"summary"`
	DriftAnalysis ReconcileDriftAnalysis `json:"drift_analysis"`
	Rows          []ReconcileDiffRow     `json:"rows"`
	ByModel       []ByModelStat          `json:"by_model"`
	ParseErrors   []ReconcileParseError  `json:"parse_errors"`
}
