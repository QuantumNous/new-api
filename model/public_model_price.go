package model

import (
	"time"

	"gorm.io/gorm/clause"
)

// PublicModelPrice caches the reference model prices fetched from romaapi.
// Used as a fallback when a channel has no upstream /api/pricing endpoint
// but has model_price_ratio set. Stored in DB so it survives if romaapi disappears.
type PublicModelPrice struct {
	Id              int64   `json:"id"               gorm:"primaryKey;autoIncrement"`
	ModelName       string  `json:"model_name"       gorm:"size:256;uniqueIndex;not null"`
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

func UpsertPublicModelPrices(rows []PublicModelPrice) error {
	if len(rows) == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "model_name"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"model_ratio", "completion_ratio", "cache_ratio", "create_cache_ratio",
			"quota_type", "model_price",
			"input_price", "output_price", "cache_price", "cache_creation_price", "fetched_at",
		}),
	}).Create(&rows).Error
}

func GetAllPublicModelPrices() ([]PublicModelPrice, error) {
	var rows []PublicModelPrice
	err := DB.Find(&rows).Error
	return rows, err
}

// GetPublicModelPriceByNames returns the first matching public price for any of the given model name candidates.
func GetPublicModelPriceByNames(names []string) (*PublicModelPrice, error) {
	if len(names) == 0 {
		return nil, nil
	}
	var row PublicModelPrice
	err := DB.Where("model_name IN ?", names).Order("input_price DESC").First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func CountPublicModelPrices() (int64, error) {
	var count int64
	err := DB.Model(&PublicModelPrice{}).Count(&count).Error
	return count, err
}

func PublicModelPricesFetchedAt() (time.Time, error) {
	var row PublicModelPrice
	err := DB.Order("fetched_at desc").First(&row).Error
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(row.FetchedAt, 0), nil
}
