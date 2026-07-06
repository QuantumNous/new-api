package model

// PublicModelPrice is the legacy romaapi reference-price snapshot (formerly
// refreshed by the removed "刷新公开价" button). The table is kept read-only as
// the seed source for the one-shot backfill into the global ratio settings
// (POST /api/admin/channel-data/backfill-global-ratios); the unified 官方原价
// now lives in 系统设置 → 模型定价 and is served by /api/pricing. Once the
// backfill has been run and verified, this table is dead data and can be dropped.
type PublicModelPrice struct {
	Id                 int64   `json:"id"               gorm:"primaryKey;autoIncrement"`
	ModelName          string  `json:"model_name"       gorm:"size:256;uniqueIndex;not null"`
	ModelRatio         float64 `json:"model_ratio"`          // 1 ratio = $2/1M input tokens (ratio-based)
	CompletionRatio    float64 `json:"completion_ratio"`     // output / input multiplier
	CacheRatio         float64 `json:"cache_ratio"`          // cache-read / input multiplier
	CreateCacheRatio   float64 `json:"create_cache_ratio"`   // cache-write / input multiplier
	QuotaType          int     `json:"quota_type"`           // 0=ratio-based 1=price-based
	ModelPrice         float64 `json:"model_price"`          // USD/request (quota_type=1 only)
	InputPrice         float64 `json:"input_price"`          // USD per 1M input tokens (pre-computed)
	OutputPrice        float64 `json:"output_price"`         // USD per 1M output tokens (pre-computed)
	CachePrice         float64 `json:"cache_price"`          // USD per 1M cache-read tokens (pre-computed)
	CacheCreationPrice float64 `json:"cache_creation_price"` // USD per 1M cache-write tokens (pre-computed)
	FetchedAt          int64   `json:"fetched_at"`
}

func GetAllPublicModelPrices() ([]PublicModelPrice, error) {
	var rows []PublicModelPrice
	err := DB.Find(&rows).Error
	return rows, err
}
