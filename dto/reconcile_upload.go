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
	// DiffBreakdown attributes the interval's total Δ¥ to its top contributing
	// models (v3.1 §13.3). Sorted by |delta| desc; the tail collapses into a
	// single {model:"其他"} item.
	DiffBreakdown []DiffBreakdownItem `json:"diff_breakdown,omitempty"`
}

// DiffBreakdownItem is one row of the summary "差异构成" attribution.
type DiffBreakdownItem struct {
	Model          string  `json:"model"`
	DeltaAmountCNY float64 `json:"delta_amount_cny"`
	DiffKind       string  `json:"diff_kind,omitempty"`
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

// DiffRow is one (model, hour_bucket) cell. In v3.1 the comparator only emits
// rows that carry a *genuine* residual difference after drift alignment —
// pure drift buckets are dropped, so HourBucket is the local anchor and the
// supplier data (if any) may have come from SupplierBucket = HourBucket +
// AlignShiftHours·3600.
type ReconcileDiffRow struct {
	HourBucket               int64     `json:"hour_bucket"`
	Model                    string    `json:"model"`
	Supplier                 *DiffSide `json:"supplier,omitempty"`
	Local                    *DiffSide `json:"local,omitempty"`
	Delta                    Totals    `json:"delta"`
	CumulativeDeltaAmountCNY float64   `json:"cumulative_delta_amount_cny"`
	Status                   string    `json:"status"` // matched / supplier_only / local_only
	// DiffKind localises *why* this row differs: price_only / usage /
	// missing_local / missing_supplier (v3.1 §13.2).
	DiffKind string `json:"diff_kind,omitempty"`
	// AlignShiftHours is the integer-hour shift applied to this model's
	// supplier series during alignment (supplier_bucket - hour_bucket, in
	// hours). 0 when the supplier bucket already matched the local anchor.
	AlignShiftHours int `json:"align_shift_hours,omitempty"`
	// SupplierBucket is the supplier's original BucketEnd before alignment,
	// for the "供方 19:00（对齐 −1h）" hint. 0 when there's no supplier side.
	SupplierBucket int64    `json:"supplier_bucket,omitempty"`
	Regions        []string `json:"regions,omitempty"`
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
	// DiffKind summarises this model's significant detail rows (v3.1 §13.3):
	// price_only / usage / missing_local / missing_supplier / mixed, or empty
	// when the model has no significant difference.
	DiffKind string `json:"diff_kind,omitempty"`
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
