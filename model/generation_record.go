package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// GenerationRecord is one row of the playground's generation history. It is
// written only for requests that arrive on the /pg routes: the history belongs
// to the browser playground, not to the API traffic a customer's own product
// sends with a key.
//
// The row is created as soon as the submission is accepted, so a task that is
// still rendering shows up in the history right away, and is updated in place
// when the poll reports the final state.
type GenerationRecord struct {
	ID        int64  `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	CreatedAt int64  `json:"created_at" gorm:"index"`
	UpdatedAt int64  `json:"updated_at"`
	UserId    int    `json:"user_id" gorm:"index"`
	Kind      string `json:"kind" gorm:"type:varchar(16);index"` // image | video
	Model     string `json:"model" gorm:"type:varchar(128);index"`
	Prompt    string `json:"prompt" gorm:"type:text"`
	// Params keeps the request knobs the caller sent (size, seconds,
	// resolution) so the history can be replayed with the same settings.
	Params     string `json:"params" gorm:"type:text"`
	Status     string `json:"status" gorm:"type:varchar(20);index"` // queued | running | success | failure
	TaskID     string `json:"task_id" gorm:"type:varchar(191);index"`
	ResultURLs string `json:"result_urls" gorm:"type:text"` // JSON array of urls
	FailReason string `json:"fail_reason" gorm:"type:text"`
	Quota      int    `json:"quota"`
}

const (
	GenerationKindImage = "image"
	GenerationKindVideo = "video"

	GenerationStatusQueued  = "queued"
	GenerationStatusRunning = "running"
	GenerationStatusSuccess = "success"
	GenerationStatusFailure = "failure"
)

func CreateGenerationRecord(record *GenerationRecord) error {
	if record == nil {
		return errors.New("record is nil")
	}
	now := common.GetTimestamp()
	record.CreatedAt = now
	record.UpdatedAt = now
	return DB.Create(record).Error
}

// ListGenerationRecords returns the caller's own history, newest first. kind
// empty means every kind.
func ListGenerationRecords(userId int, kind string, offset int, limit int) ([]GenerationRecord, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	query := DB.Model(&GenerationRecord{}).Where("user_id = ?", userId)
	if kind != "" {
		query = query.Where("kind = ?", kind)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []GenerationRecord
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

// GetGenerationRecord returns one row the given user owns, or gorm.ErrRecordNotFound.
func GetGenerationRecord(userId int, id int64) (*GenerationRecord, error) {
	var record GenerationRecord
	if err := DB.Where("id = ? AND user_id = ?", id, userId).First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

// GetGenerationRecordByTaskID finds the row a task submission created. A poll
// that arrives before the submission finished writing simply has nothing to
// update yet, which is not an error.
func GetGenerationRecordByTaskID(taskId string) (*GenerationRecord, error) {
	if taskId == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var record GenerationRecord
	if err := DB.Where("task_id = ?", taskId).Order("id desc").First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func DeleteGenerationRecord(userId int, id int64) error {
	result := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&GenerationRecord{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// UpdateGenerationRecordByTaskID applies a poll result to the row the
// submission created. A missing row is not an error: the record is history, and
// losing it must never break the poll response the caller is waiting for.
func UpdateGenerationRecordByTaskID(taskId string, updates map[string]any) {
	if taskId == "" || len(updates) == 0 {
		return
	}
	updates["updated_at"] = common.GetTimestamp()
	err := DB.Model(&GenerationRecord{}).Where("task_id = ?", taskId).Updates(updates).Error
	if err != nil {
		common.SysError(common.LogText("failed to update generation record for task %s: %s", taskId, err.Error()))
	}
}
