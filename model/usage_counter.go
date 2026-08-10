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
		if err := ensureUsageRow(tx, userId, kind, cycleStart); err != nil {
			return err
		}
		// SQL-side arithmetic, not a read-then-Save of a struct fetched
		// earlier: a Save would write back every column on the struct,
		// including images_used at whatever value it happened to have at
		// read time, silently erasing a concurrent ReserveImages write.
		// Only the two columns this call actually changes are touched.
		return tx.Model(&UserUsageCounter{}).
			Where("user_id = ? AND cycle_kind = ? AND cycle_start = ?", userId, kind, cycleStart).
			Updates(map[string]any{
				"cost_used":     gorm.Expr("cost_used + ?", cost),
				"requests_used": gorm.Expr("requests_used + ?", requests),
			}).Error
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
	seenInBatch := make(map[string]bool, len(hashes))
	unique := make([]UserImageUpload, 0, len(hashes))
	now := common.GetTimestamp()
	for _, h := range hashes {
		if seenInBatch[h] {
			continue
		}
		seenInBatch[h] = true
		unique = append(unique, UserImageUpload{UserId: userId, CycleStart: cycleStart, ImageHash: h, CreatedAt: now})
	}

	accepted := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := ensureUsageRow(tx, userId, CycleKindMonth, cycleStart); err != nil {
			return err
		}

		// Insert the fresh hashes; the unique index (idx_image_cycle) is the
		// real guard against double-insert, so a batch that collides with an
		// already-spent hash simply inserts nothing for it — RowsAffected
		// tells us exactly how many were actually new.
		res := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&unique)
		if res.Error != nil {
			return res.Error
		}
		fresh := int(res.RowsAffected)
		if fresh == 0 {
			return nil
		}

		// Conditional increment: this UPDATE only applies if the result stays
		// within limit, checked entirely in SQL so there is no read-then-write
		// gap between deciding "there's room" and writing it. If it doesn't
		// apply, RowsAffected is 0 and the whole transaction (including the
		// inserts above) rolls back, so nothing is reserved.
		upd := tx.Model(&UserUsageCounter{}).
			Where("user_id = ? AND cycle_kind = ? AND cycle_start = ? AND images_used + ? <= ?",
				userId, CycleKindMonth, cycleStart, fresh, limit).
			Update("images_used", gorm.Expr("images_used + ?", fresh))
		if upd.Error != nil {
			return upd.Error
		}
		if upd.RowsAffected == 0 {
			return ErrImageLimitReached
		}
		accepted = fresh
		return nil
	})
	if err != nil {
		return 0, err
	}
	return accepted, nil
}

// ensureUsageRow makes sure the counter row for (userId, kind, cycleStart)
// exists so AddUsage/ReserveImages have something to apply their atomic SQL
// updates to. It does not read or lock the row — see the Updates/Update calls
// in AddUsage and ReserveImages, which do the actual counting via SQL-side
// arithmetic (gorm.Expr and a conditional WHERE) rather than a Go-side
// read-modify-write, so they are correct under concurrent callers on SQLite,
// MySQL >= 5.7.8 and PostgreSQL without needing a portable row lock.
func ensureUsageRow(tx *gorm.DB, userId int, kind string, cycleStart int64) error {
	row := UserUsageCounter{UserId: userId, CycleKind: kind, CycleStart: cycleStart}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
}
