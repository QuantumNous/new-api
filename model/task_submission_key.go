package model

import (
	"context"

	"gorm.io/gorm/clause"
)

// TaskSubmissionKey reserves one public task ID before the gateway sends a
// billable request. The key fingerprint covers the caller and operation.
type TaskSubmissionKey struct {
	Fingerprint string `gorm:"primaryKey;size:64"`
	RequestHash string `gorm:"size:64;not null"`
	TaskID      string `gorm:"size:64;not null"`
	CreatedAt   int64
	Accepted    bool
}

func ReserveTaskSubmissionKey(ctx context.Context, candidate TaskSubmissionKey) (TaskSubmissionKey, bool, error) {
	db := DB.WithContext(ctx)
	// Do not use RowsAffected to identify the owner. MySQL can report a row
	// for a no-op duplicate-key update.
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&candidate).Error; err != nil {
		return TaskSubmissionKey{}, false, err
	}
	var saved TaskSubmissionKey
	err := db.First(&saved, "fingerprint = ?", candidate.Fingerprint).Error
	return saved, saved.TaskID == candidate.TaskID, err
}

func AcceptTaskSubmissionKey(ctx context.Context, reservation TaskSubmissionKey) error {
	return DB.WithContext(ctx).Model(&TaskSubmissionKey{}).
		Where("fingerprint = ? AND task_id = ?", reservation.Fingerprint, reservation.TaskID).
		Update("accepted", true).Error
}
