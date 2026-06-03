package service

import (
	"errors"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const affiliateDefaultLogScanBatchSize = 500

var affiliateLogScanBatchSize = affiliateDefaultLogScanBatchSize

func normalizedAffiliateLogScanBatchSize() int {
	if affiliateLogScanBatchSize <= 0 {
		return affiliateDefaultLogScanBatchSize
	}
	return affiliateLogScanBatchSize
}

func scanAffiliateLogsByCreatedAtCursor(base *gorm.DB, handle func([]model.Log) error) error {
	if base == nil {
		return errors.New("nil log query")
	}
	if handle == nil {
		return errors.New("nil log batch handler")
	}

	batchSize := normalizedAffiliateLogScanBatchSize()
	lastCreatedAt := int64(0)
	lastId := 0
	hasCursor := false

	for {
		var logs []model.Log
		tx := base.Session(&gorm.Session{}).Order("created_at asc, id asc")
		if hasCursor {
			tx = tx.Where("(created_at > ? OR (created_at = ? AND id > ?))", lastCreatedAt, lastCreatedAt, lastId)
		}
		if err := tx.Limit(batchSize).Find(&logs).Error; err != nil {
			return err
		}
		if len(logs) == 0 {
			return nil
		}
		if err := handle(logs); err != nil {
			return err
		}

		last := logs[len(logs)-1]
		lastCreatedAt = last.CreatedAt
		lastId = last.Id
		hasCursor = true
		if len(logs) < batchSize {
			return nil
		}
	}
}
