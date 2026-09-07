package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const DrawingLifetime = int64(2 * time.Hour / time.Second)

// Drawing records contain metadata only; image bytes live in expiring private storage.
type DrawingBatch struct {
	AgentQuoteLocked bool          `json:"-"`
	AgentQuoteJSON   string        `json:"-" gorm:"type:text"`
	ID               string        `json:"id" gorm:"type:varchar(36);primaryKey"`
	UserID           int           `json:"-" gorm:"index;uniqueIndex:drawing_submission,priority:1"`
	SubmissionID     string        `json:"-" gorm:"type:varchar(36);uniqueIndex:drawing_submission,priority:2"`
	RequestHash      string        `json:"-" gorm:"type:varchar(64)"`
	Model            string        `json:"model" gorm:"type:varchar(200)"`
	Group            string        `json:"group" gorm:"type:varchar(100)"`
	Ratio            string        `json:"ratio" gorm:"type:varchar(10)"`
	HasReference     bool          `json:"has_reference"`
	CreatedAt        int64         `json:"created_at" gorm:"index"`
	ExpiresAt        int64         `json:"expires_at"`
	Items            []DrawingItem `json:"items" gorm:"foreignKey:BatchID"`
}

type DrawingItem struct {
	ID          string `json:"id" gorm:"type:varchar(36);primaryKey"`
	BatchID     string `json:"batch_id" gorm:"type:varchar(36);index"`
	UserID      int    `json:"-" gorm:"index"`
	Position    int    `json:"position"`
	Title       string `json:"title" gorm:"type:varchar(200)"`
	Prompt      string `json:"prompt" gorm:"type:text"`
	Status      string `json:"status" gorm:"type:varchar(24);index"`
	Attempts    int    `json:"attempts"`
	ChannelID   int    `json:"-" gorm:"index"`
	AvailableAt int64  `json:"-"`
	RequestID   string `json:"request_id" gorm:"type:varchar(100)"`
	Error       string `json:"error" gorm:"type:varchar(200)"`
	Mime        string `json:"mime" gorm:"type:varchar(32)"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	StartedAt   int64  `json:"started_at"`
	ExpiresAt   int64  `json:"expires_at" gorm:"index"`
}

// A short database write serializes queue admission/claims across processes and
// dialects (including SQLite). No network or file IO is done while holding it.
type DrawingQueueLock struct {
	ID       int `gorm:"primaryKey"`
	Revision int
}

func drawingQueueTransaction(fn func(*gorm.DB) error) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&DrawingQueueLock{}).Where("id = ?", 1).Update("revision", gorm.Expr("1 - revision")).Error; err != nil {
			return err
		}
		return fn(tx)
	})
}

func InitDrawingQueue() error {
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&DrawingQueueLock{ID: 1}).Error; err != nil {
		return err
	}
	// Pre-feature queued jobs have no agent quote. Keep them on their existing
	// platform billing path if an inviter is enabled as an agent after upgrade.
	return DB.Model(&DrawingBatch{}).Where("model = ? AND (agent_quote_locked = ? OR agent_quote_locked IS NULL) AND (agent_quote_json = ? OR agent_quote_json IS NULL)", AgentImageModel, false, "").Update("agent_quote_locked", true).Error
}

func CreateDrawingBatch(batch *DrawingBatch, maxPending int) (*DrawingBatch, error) {
	err := drawingQueueTransaction(func(tx *gorm.DB) error {
		var existing DrawingBatch
		err := tx.Where("user_id = ? AND submission_id = ?", batch.UserID, batch.SubmissionID).Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC") }).First(&existing).Error
		if err == nil {
			if existing.RequestHash != batch.RequestHash {
				return errors.New("Submission ID already used for a different request")
			}
			*batch = existing
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var pending int64
		if err := tx.Model(&DrawingItem{}).Where("user_id = ? AND status IN ?", batch.UserID, []string{"queued", "running", "recovering"}).Count(&pending).Error; err != nil {
			return err
		}
		if pending+int64(len(batch.Items)) > int64(maxPending) {
			return errors.New("Too many pending images; wait for the current batch")
		}
		return tx.Create(batch).Error
	})
	return batch, err
}

func ListDrawingBatches(userID int, now int64) ([]DrawingBatch, error) {
	var batches []DrawingBatch
	err := DB.Where("user_id = ? AND expires_at > ?", userID, now).Order("created_at DESC").Limit(50).Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC") }).Find(&batches).Error
	return batches, err
}

func GetDrawingBatch(userID int, id string) (*DrawingBatch, error) {
	var batch DrawingBatch
	err := DB.Where("user_id = ? AND id = ?", userID, id).Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC") }).First(&batch).Error
	return &batch, err
}

func ClaimDrawingItem(now int64, concurrency int) (*DrawingItem, error) {
	var claimed *DrawingItem
	err := drawingQueueTransaction(func(tx *gorm.DB) error {
		// An interrupted upstream call must never be automatically resubmitted.
		if err := tx.Model(&DrawingItem{}).Where("status IN ? AND started_at < ?", []string{"running", "recovering"}, now-24*60).Updates(map[string]any{"status": "unknown", "error": "Generation interrupted; check usage before retrying", "expires_at": now + DrawingLifetime}).Error; err != nil {
			return err
		}
		var running []DrawingItem
		if err := tx.Where("status IN ?", []string{"running", "recovering"}).Find(&running).Error; err != nil {
			return err
		}
		if len(running) >= concurrency {
			return nil
		}
		perUser := make(map[int]int)
		for _, item := range running {
			perUser[item.UserID]++
		}
		excluded := []int{0}
		for user, count := range perUser {
			if count >= 2 {
				excluded = append(excluded, user)
			}
		}
		var next DrawingItem
		err := tx.Where("status = ? AND user_id NOT IN ? AND available_at <= ? AND expires_at > ?", "queued", excluded, now, now).Order("expires_at ASC, position ASC").First(&next).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		next.Status, next.StartedAt, next.Attempts = "running", now, next.Attempts+1
		next.ChannelID = 0
		next.RequestID = next.ID + "-" + time.Unix(now, 0).UTC().Format("20060102150405")
		if err := tx.Save(&next).Error; err != nil {
			return err
		}
		// Keep the batch discoverable throughout a long queue.
		if err := tx.Model(&DrawingBatch{}).Where("id = ?", next.BatchID).Update("expires_at", now+DrawingLifetime).Error; err != nil {
			return err
		}
		claimed = &next
		return nil
	})
	return claimed, err
}

func ReserveDrawingChannel(itemID string, channelID int) (bool, error) {
	reserved := false
	err := drawingQueueTransaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&DrawingItem{}).Where("status = ? AND channel_id = ?", "running", channelID).Count(&count).Error; err != nil {
			return err
		}
		if count >= 2 {
			return nil
		}
		result := tx.Model(&DrawingItem{}).Where("id = ? AND status = ?", itemID, "running").Update("channel_id", channelID)
		reserved = result.RowsAffected == 1
		return result.Error
	})
	return reserved, err
}

func FinishDrawingItem(item *DrawingItem) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&DrawingItem{}).Where("id = ? AND status IN ? AND attempts = ?", item.ID, []string{"running", "recovering"}, item.Attempts).Updates(map[string]any{"status": item.Status, "error": item.Error, "mime": item.Mime, "width": item.Width, "height": item.Height, "expires_at": item.ExpiresAt})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("Drawing attempt no longer owns this item")
		}
		return tx.Model(&DrawingBatch{}).Where("id = ? AND expires_at < ?", item.BatchID, item.ExpiresAt).Update("expires_at", item.ExpiresAt).Error
	})
}

func RetryDrawingItem(userID int, id string, now int64, confirmUnknown bool, maxPending int) error {
	return drawingQueueTransaction(func(tx *gorm.DB) error {
		var item DrawingItem
		if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
			return err
		}
		if item.ExpiresAt <= now {
			return errors.New("Image expired")
		}
		if item.Status == "unknown" && !confirmUnknown {
			return errors.New("Retry may incur another charge; confirmation required")
		}
		if item.Status != "failed" && item.Status != "unknown" {
			return errors.New("Only failed images can be regenerated")
		}
		if item.Attempts >= 5 {
			return errors.New("Retry limit reached")
		}
		var pending int64
		if err := tx.Model(&DrawingItem{}).Where("user_id = ? AND status IN ?", userID, []string{"queued", "running", "recovering"}).Count(&pending).Error; err != nil {
			return err
		}
		if pending >= int64(maxPending) {
			return errors.New("Too many pending images; wait for the current batch")
		}
		if err := tx.Model(&item).Updates(map[string]any{"status": "queued", "error": "", "channel_id": 0, "available_at": now, "expires_at": now + DrawingLifetime}).Error; err != nil {
			return err
		}
		return tx.Model(&DrawingBatch{}).Where("id = ?", item.BatchID).Update("expires_at", now+DrawingLifetime).Error
	})
}

func ClaimDrawingRecovery(userID int, id string, now int64, concurrency int) (*DrawingItem, error) {
	var item DrawingItem
	err := drawingQueueTransaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
			return err
		}
		if item.ExpiresAt <= now {
			return errors.New("Image expired")
		}
		if item.Status != "storage_failed" && item.Status != "unknown" {
			return errors.New("Image recovery is not available")
		}
		var running []DrawingItem
		if err := tx.Where("status IN ?", []string{"running", "recovering"}).Find(&running).Error; err != nil {
			return err
		}
		perUser := 0
		for _, active := range running {
			if active.UserID == userID {
				perUser++
			}
		}
		if len(running) >= concurrency || perUser >= 2 {
			return errors.New("Image recovery is busy; try again later")
		}
		originalStatus := item.Status
		result := tx.Model(&item).Updates(map[string]any{"status": "recovering", "started_at": now})
		item.Status = originalStatus
		return result.Error
	})
	return &item, err
}

func GetDrawingSubmission(userID int, submissionID string) (*DrawingBatch, error) {
	var batch DrawingBatch
	result := DB.Where("user_id = ? AND submission_id = ?", userID, submissionID).Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC") }).Limit(1).Find(&batch)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &batch, nil
}
