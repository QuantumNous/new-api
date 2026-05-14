package model

import "gorm.io/gorm/clause"

type ChannelModelPricing struct {
	Id          int64   `json:"id"           gorm:"primaryKey;autoIncrement"`
	ChannelId   int     `json:"channel_id"   gorm:"uniqueIndex:idx_ch_model;not null"`
	ModelName   string  `json:"model_name"   gorm:"size:256;uniqueIndex:idx_ch_model;not null"`
	InputPrice  float64 `json:"input_price"`  // USD per 1M input tokens
	OutputPrice float64 `json:"output_price"` // USD per 1M output tokens
	Currency    string  `json:"currency"     gorm:"size:8;default:'USD'"`
	FetchedAt   int64   `json:"fetched_at"`
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
			"input_price", "output_price", "currency", "fetched_at",
		}),
	}).Create(&rows).Error
}
