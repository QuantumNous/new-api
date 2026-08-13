package model

import (
	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// WebsiteFeaturedModel stores the optional merchandising order used by the
// public website model directory. It deliberately does not affect API routing
// or the regular model catalog.
type WebsiteFeaturedModel struct {
	ID        int    `json:"id"`
	ModelName string `json:"model_name" gorm:"size:128;not null;uniqueIndex"`
	SortOrder int    `json:"sort_order" gorm:"not null;index"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

// ListWebsiteFeaturedModels returns the configured order, with the ID as a
// deterministic tie-breaker for rows created by older versions.
func ListWebsiteFeaturedModels() ([]WebsiteFeaturedModel, error) {
	var rows []WebsiteFeaturedModel
	err := DB.Order("sort_order ASC").Order("id ASC").Find(&rows).Error
	return rows, err
}

// ReplaceWebsiteFeaturedModels atomically replaces the complete configured
// order. The caller validates public visibility and duplicate names before
// invoking this function.
func ReplaceWebsiteFeaturedModels(modelNames []string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&WebsiteFeaturedModel{}).Error; err != nil {
			return err
		}
		if len(modelNames) == 0 {
			return nil
		}

		now := common.GetTimestamp()
		rows := make([]WebsiteFeaturedModel, len(modelNames))
		for i, modelName := range modelNames {
			rows[i] = WebsiteFeaturedModel{
				ModelName: modelName,
				SortOrder: i,
				CreatedAt: now,
				UpdatedAt: now,
			}
		}
		return tx.Create(&rows).Error
	})
}
