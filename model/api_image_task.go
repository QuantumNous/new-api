package model

import (
	"errors"

	"gorm.io/gorm"
)

// Only metadata is stored in SQL. Private request/result files share the drawing
// volume; the idempotency tombstone outlives their 24-hour retention.
type APIImageTask struct {
	ID           string `json:"id" gorm:"type:varchar(36);primaryKey"`
	UserID       int    `json:"-" gorm:"uniqueIndex:api_image_submission,priority:1;index"`
	TokenID      int    `json:"-" gorm:"uniqueIndex:api_image_submission,priority:2"`
	SubmissionID string `json:"-" gorm:"type:varchar(36);uniqueIndex:api_image_submission,priority:3"`
	RequestHash  string `json:"request_hash" gorm:"type:varchar(64)"`
	ClientIP     string `json:"-" gorm:"type:varchar(64)"`
	Model        string `json:"model" gorm:"type:varchar(200)"`
	Count        int    `json:"-"`
	Status       string `json:"status" gorm:"type:varchar(24);index"`
	RequestID    string `json:"request_id" gorm:"type:varchar(100)"`
	HTTPStatus   int    `json:"http_status,omitempty"`
	Error        string `json:"message,omitempty" gorm:"type:varchar(200)"`
	QuoteLocked  bool   `json:"-"`
	QuoteJSON    string `json:"-" gorm:"type:text"`
	CreatedAt    int64  `json:"created_at"`
	StartedAt    int64  `json:"-"`
	ExpiresAt    int64  `json:"expires_at" gorm:"index"`
}

func GetAPIImageTask(user, token int, id string) (*APIImageTask, error) {
	var task APIImageTask
	err := DB.Where("id = ? AND user_id = ? AND token_id = ?", id, user, token).First(&task).Error
	return &task, err
}

func CreateAPIImageTask(task *APIImageTask) (*APIImageTask, error) {
	err := drawingQueueTransaction(func(tx *gorm.DB) error {
		var existing APIImageTask
		err := tx.Where("user_id = ? AND token_id = ? AND submission_id = ?", task.UserID, task.TokenID, task.SubmissionID).First(&existing).Error
		if err == nil {
			if existing.RequestHash != task.RequestHash {
				return errors.New("Idempotency key already used for another request")
			}
			*task = existing
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return tx.Create(task).Error
	})
	return task, err
}

func ClaimAPIImageTask(now int64) (*APIImageTask, error) {
	var result *APIImageTask
	err := drawingQueueTransaction(func(tx *gorm.DB) error {
		// A process may have died AFTER upstream generation or billing. Never replay.
		if err := tx.Model(&APIImageTask{}).Where("status = ? AND started_at < ?", "running", now-25*60).Updates(map[string]any{"status": "unknown", "error": "Worker interrupted; check usage before submitting another task"}).Error; err != nil {
			return err
		}
		if err := tx.Model(&APIImageTask{}).Where("status = ? AND expires_at <= ?", "queued", now).Updates(map[string]any{"status": "expired"}).Error; err != nil {
			return err
		}
		var task APIImageTask
		// Admission/dispatch adds no concurrency ceiling. Retain atomic claims
		// so concurrent dispatchers cannot send the same paid request twice.
		err := tx.Where("status = ? AND expires_at > ?", "queued", now).Order("created_at ASC, id ASC").First(&task).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		task.Status, task.StartedAt = "running", now
		if err := tx.Save(&task).Error; err != nil {
			return err
		}
		result = &task
		return nil
	})
	return result, err
}

func FinishAPIImageTask(task *APIImageTask) error {
	return DB.Model(&APIImageTask{}).Where("id = ? AND status = ?", task.ID, "running").Updates(map[string]any{"status": task.Status, "http_status": task.HTTPStatus, "error": task.Error}).Error
}
