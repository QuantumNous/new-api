package dto

type BytePlusAssetCreateRequest struct {
	URL        string                   `json:"url"`
	AssetType  string                   `json:"asset_type"`
	Moderation *BytePlusAssetModeration `json:"moderation,omitempty"`
}

type BytePlusAssetModeration struct {
	Strategy string `json:"strategy"`
}

type BytePlusAssetResponse struct {
	ID         string                  `json:"id"`
	Object     string                  `json:"object"`
	AssetType  string                  `json:"asset_type"`
	Status     string                  `json:"status"`
	Moderation BytePlusAssetModeration `json:"moderation"`
	CreatedAt  int64                   `json:"created_at"`
}
