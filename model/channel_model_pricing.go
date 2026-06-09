package model

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ChannelModelPricing struct {
	Id                 int64   `json:"id"           gorm:"primaryKey;autoIncrement"`
	ChannelId          int     `json:"channel_id"   gorm:"uniqueIndex:idx_ch_model;not null"`
	ModelName          string  `json:"model_name"   gorm:"size:256;uniqueIndex:idx_ch_model;not null"`
	InputPrice         float64 `json:"input_price"`          // USD per 1M input tokens = model_ratio × group_ratio × 2
	OutputPrice        float64 `json:"output_price"`         // USD per 1M output tokens
	CachePrice         float64 `json:"cache_price"`          // USD per 1M cache-read tokens
	CacheCreationPrice float64 `json:"cache_creation_price"` // USD per 1M cache-write tokens
	GroupRatio         float64 `json:"group_ratio"    gorm:"default:1"`
	Currency           string  `json:"currency"       gorm:"size:8;default:'USD'"`
	PricingSource      string  `json:"pricing_source" gorm:"size:16;default:'api'"` // "api" | "manual"
	FetchedAt          int64   `json:"fetched_at"`
}

// GetChannelModelPricing returns the pricing row for a given channel+model.
// Returns nil, nil when no row exists (not an error — just no pricing data).
func GetChannelModelPricing(channelId int, modelName string) (*ChannelModelPricing, error) {
	var p ChannelModelPricing
	err := DB.Where("channel_id = ? AND model_name = ?", channelId, modelName).First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ChannelActualPrices holds four per-(channel,model) unit prices for the
// consume log's other JSON. The exact multiplier depends on the caller:
// service.ChannelActualPricesResolved applies recharge_rate × apimaster_ratio
// (user price); the helper below applies recharge_rate only (procurement cost).
type ChannelActualPrices struct {
	InputPrice         float64
	OutputPrice        float64
	CachePrice         float64
	CacheCreationPrice float64
}

// GetChannelActualPrices returns procurement cost (× recharge_rate only).
// NOTE: the billing log path uses service.ChannelActualPricesResolved instead,
// which also multiplies by apimaster_price_ratio. This helper is kept for
// callers that want raw procurement cost. Returns nil, nil when no row exists.
func GetChannelActualPrices(channelId int, modelName string) (*ChannelActualPrices, error) {
	p, err := GetChannelModelPricing(channelId, modelName)
	if err != nil || p == nil {
		return nil, err
	}

	// Fetch recharge_rate from channels table
	var rechargeRate float64 = 1.0
	var ch struct {
		RechargeRate *float64 `gorm:"column:recharge_rate"`
	}
	if err2 := DB.Table("channels").Select("recharge_rate").Where("id = ?", channelId).Scan(&ch).Error; err2 == nil && ch.RechargeRate != nil && *ch.RechargeRate > 0 {
		rechargeRate = *ch.RechargeRate
	}

	return &ChannelActualPrices{
		InputPrice:         p.InputPrice * rechargeRate,
		OutputPrice:        p.OutputPrice * rechargeRate,
		CachePrice:         p.CachePrice * rechargeRate,
		CacheCreationPrice: p.CacheCreationPrice * rechargeRate,
	}, nil
}

// UpsertChannelModelPricings inserts or updates rows by the (channel_id, model_name)
// unique index. Using DB.Save would conflict on the unique index because new rows
// have id=0 and Save keys on the primary key only — switch to explicit OnConflict.
func UpsertChannelModelPricings(rows []ChannelModelPricing) error {
	if len(rows) == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "channel_id"}, {Name: "model_name"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"input_price", "output_price", "cache_price", "cache_creation_price",
			"group_ratio", "currency", "pricing_source", "fetched_at",
		}),
	}).Create(&rows).Error
}
