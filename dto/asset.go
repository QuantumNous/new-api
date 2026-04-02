package dto

type CreativeCenterAsset struct {
	AssetID      string `json:"asset_id"`
	HistoryID    int64  `json:"history_id"`
	UserID       int    `json:"user_id"`
	Username     string `json:"username,omitempty"`
	AssetType    string `json:"asset_type"`
	MediaURL     string `json:"media_url"`
	ThumbnailURL string `json:"thumbnail_url"`
	Prompt       string `json:"prompt"`
	ModelName    string `json:"model_name"`
	Group        string `json:"group"`
	SessionID    string `json:"session_id"`
	SessionName  string `json:"session_name"`
	RecordID     string `json:"record_id"`
	Status       string `json:"status"`
	CreatedAt    int64  `json:"created_at"`
	UpdatedAt    int64  `json:"updated_at"`
}

type CreativeCenterAssetDownloadRequest struct {
	AssetIDs []string `json:"asset_ids"`
}
