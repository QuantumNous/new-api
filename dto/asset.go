package dto

type AssetCreateRequest struct {
	URL       string  `json:"url"`
	AssetType string  `json:"asset_type"`
	Model     *string `json:"model,omitempty"`
}

type AssetUploadSessionRequest struct {
	AssetType   string  `json:"asset_type"`
	ContentType string  `json:"content_type"`
	SizeBytes   int64   `json:"size_bytes"`
	Model       *string `json:"model,omitempty"`
}

type AssetResponse struct {
	ID              string `json:"id"`
	Object          string `json:"object"`
	AssetType       string `json:"asset_type"`
	Status          string `json:"status"`
	AssetURL        string `json:"asset_url"`
	CreatedAt       int64  `json:"created_at"`
	SourceExpiresAt int64  `json:"source_expires_at,omitempty"`
}

type AssetUploadSessionResponse struct {
	UploadID      string            `json:"upload_id"`
	AssetID       string            `json:"asset_id"`
	Object        string            `json:"object"`
	Status        string            `json:"status"`
	UploadURL     string            `json:"upload_url"`
	UploadHeaders map[string]string `json:"upload_headers"`
	ExpiresAt     int64             `json:"expires_at"`
}
