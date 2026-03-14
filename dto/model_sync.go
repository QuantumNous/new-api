package dto

// OverwriteField describes which fields to overwrite for a specific model during sync.
type OverwriteField struct {
	ModelName string   `json:"model_name"`
	Fields    []string `json:"fields"`
}

// SyncRequest is the request body for POST /api/models/sync_upstream.
type SyncRequest struct {
	Overwrite []OverwriteField `json:"overwrite"`
	Locale    string           `json:"locale"`
}

// SyncSource holds upstream source metadata.
type SyncSource struct {
	Locale     string `json:"locale"`
	ModelsURL  string `json:"models_url"`
	VendorsURL string `json:"vendors_url"`
}

// SyncUpstreamResult holds the response data for SyncUpstreamModels.
type SyncUpstreamResult struct {
	CreatedModels  int        `json:"created_models"`
	CreatedVendors int        `json:"created_vendors"`
	UpdatedModels  int        `json:"updated_models"`
	SkippedModels  []string   `json:"skipped_models"`
	CreatedList    []string   `json:"created_list"`
	UpdatedList    []string   `json:"updated_list"`
	Source         SyncSource `json:"source"`
}

// SyncPreviewResult holds the response data for SyncUpstreamPreview.
type SyncPreviewResult struct {
	Missing   []string       `json:"missing"`
	Conflicts []ConflictItem `json:"conflicts"`
	Source    SyncSource      `json:"source"`
}

// ConflictField describes a single field difference between local and upstream.
type ConflictField struct {
	Field    string      `json:"field"`
	Local    interface{} `json:"local"`
	Upstream interface{} `json:"upstream"`
}

// ConflictItem describes all field differences for a single model.
type ConflictItem struct {
	ModelName string          `json:"model_name"`
	Fields    []ConflictField `json:"fields"`
}
