package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrImageLimitReached means the batch would cross the cycle's image allowance.
// Nothing is reserved when it is returned.
var ErrImageLimitReached = errors.New("monthly image limit reached")

// CycleKindMonth duplicates service.CycleMonth to avoid a model→service import.
const CycleKindMonth = "month"

// UserUsageCounter is one row per user per cycle. A new cycle is a new row,
// which is why no reset job exists. cycle_kind is carried from day one so a
// weekly cap can be added later without migrating live counters.
type UserUsageCounter struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id" gorm:"index:idx_usage_cycle,unique,priority:1"`
	CycleKind    string `json:"cycle_kind" gorm:"type:varchar(8);index:idx_usage_cycle,unique,priority:2"`
	CycleStart   int64  `json:"cycle_start" gorm:"index:idx_usage_cycle,unique,priority:3"`
	CostUsed     int64  `json:"cost_used" gorm:"type:bigint;not null;default:0"`
	RequestsUsed int    `json:"requests_used" gorm:"not null;default:0"`
	ImagesUsed   int    `json:"images_used" gorm:"not null;default:0"`
}

// UserImageUpload records which images a user has already spent this cycle, so
// a re-sent or retried image is free.
type UserImageUpload struct {
	Id         int    `json:"id"`
	UserId     int    `json:"user_id" gorm:"index:idx_image_cycle,unique,priority:1"`
	CycleStart int64  `json:"cycle_start" gorm:"index:idx_image_cycle,unique,priority:2"`
	ImageHash  string `json:"image_hash" gorm:"type:varchar(64);index:idx_image_cycle,unique,priority:3"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
}

func AddUsage(userId int, kind string, cycleStart int64, cost int64, requests int) error {
	if userId <= 0 {
		return errors.New("invalid userId")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		row, err := lockUsageRow(tx, userId, kind, cycleStart)
		if err != nil {
			return err
		}
		row.CostUsed += cost
		row.RequestsUsed += requests
		return tx.Save(row).Error
	})
}

func GetUsage(userId int, kind string, cycleStart int64) (cost int64, requests int, images int, err error) {
	var row UserUsageCounter
	q := DB.Where("user_id = ? AND cycle_kind = ? AND cycle_start = ?", userId, kind, cycleStart).Limit(1).Find(&row)
	if q.Error != nil {
		return 0, 0, 0, q.Error
	}
	if q.RowsAffected == 0 {
		return 0, 0, 0, nil
	}
	return row.CostUsed, row.RequestsUsed, row.ImagesUsed, nil
}

// ReserveImages inserts the hashes not already spent this cycle and returns how
// many were newly reserved. It reserves all or nothing: if the batch would
// cross `limit`, it returns ErrImageLimitReached having changed nothing.
func ReserveImages(userId int, cycleStart int64, hashes []string, limit int) (int, error) {
	if len(hashes) == 0 {
		return 0, nil
	}
	accepted := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		row, err := lockUsageRow(tx, userId, CycleKindMonth, cycleStart)
		if err != nil {
			return err
		}
		var fresh []string
		for _, h := range hashes {
			var existing UserImageUpload
			q := tx.Where("user_id = ? AND cycle_start = ? AND image_hash = ?", userId, cycleStart, h).Limit(1).Find(&existing)
			if q.Error != nil {
				return q.Error
			}
			if q.RowsAffected == 0 {
				fresh = append(fresh, h)
			}
		}
		if len(fresh) == 0 {
			return nil
		}
		if row.ImagesUsed+len(fresh) > limit {
			return ErrImageLimitReached
		}
		now := common.GetTimestamp()
		for _, h := range fresh {
			if err := tx.Create(&UserImageUpload{UserId: userId, CycleStart: cycleStart, ImageHash: h, CreatedAt: now}).Error; err != nil {
				return err
			}
		}
		row.ImagesUsed += len(fresh)
		accepted = len(fresh)
		return tx.Save(row).Error
	})
	if err != nil {
		return 0, err
	}
	return accepted, nil
}

// lockUsageRow ensures the counter row for (userId, kind, cycleStart) exists
// and returns it locked FOR UPDATE within tx, so concurrent AddUsage/ReserveImages
// calls for the same cycle serialize instead of racing on a read-modify-write.
//
// This uses the same `tx.Set("gorm:query_option", "FOR UPDATE")` pattern as the
// rest of the codebase (see model/subscription.go, model/topup.go, model/user.go,
// model/redemption.go) rather than gorm's `clause.Locking{Strength: "UPDATE"}`.
// Both were verified to run without error against the glebarez/sqlite driver used
// in tests (SQLite has no real row-level FOR UPDATE, so it is accepted as a no-op
// there), but the query_option form is what every other locked-row path in this
// codebase already uses, so it is followed here for consistency.
func lockUsageRow(tx *gorm.DB, userId int, kind string, cycleStart int64) (*UserUsageCounter, error) {
	row := UserUsageCounter{UserId: userId, CycleKind: kind, CycleStart: cycleStart}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
		return nil, err
	}
	var locked UserUsageCounter
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ? AND cycle_kind = ? AND cycle_start = ?", userId, kind, cycleStart).
		First(&locked).Error; err != nil {
		return nil, err
	}
	return &locked, nil
}
