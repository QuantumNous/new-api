package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

type ImageInputCleanupStatus string

const (
	ImageInputCleanupWaiting   ImageInputCleanupStatus = "waiting"
	ImageInputCleanupPending   ImageInputCleanupStatus = "pending"
	ImageInputCleanupCompleted ImageInputCleanupStatus = "completed"

	maxImageInputCleanupKeys = 17
)

// ImageInputCleanup keeps private R2 input keys outside the task checkpoint so
// terminal finalization can clear request data while deletion remains durable.
type ImageInputCleanup struct {
	ID             int64                   `gorm:"primaryKey"`
	TaskID         string                  `gorm:"type:varchar(191);uniqueIndex"`
	ObjectKeys     string                  `gorm:"type:text"`
	Status         ImageInputCleanupStatus `gorm:"type:varchar(20);index:idx_image_input_cleanup_due,priority:1"`
	Attempts       int
	NextAttemptAt  int64  `gorm:"index:idx_image_input_cleanup_due,priority:2"`
	LeaseToken     string `gorm:"type:varchar(64)"`
	LeaseExpiresAt int64  `gorm:"index:idx_image_input_cleanup_due,priority:3"`
	LastError      string `gorm:"type:text"`
	CreatedAt      int64  `gorm:"index"`
	UpdatedAt      int64
	CompletedAt    int64
}

func validateImageInputCleanupKeys(objectKeys []string) ([]string, error) {
	if len(objectKeys) == 0 || len(objectKeys) > maxImageInputCleanupKeys {
		return nil, fmt.Errorf("image input cleanup contains %d object keys (max %d)", len(objectKeys), maxImageInputCleanupKeys)
	}
	keys := make([]string, 0, len(objectKeys))
	seen := make(map[string]struct{}, len(objectKeys))
	for _, key := range objectKeys {
		key = strings.TrimSpace(key)
		if len(key) > 255 || !strings.HasPrefix(key, "inputs/") || strings.Contains(key, "..") || strings.ContainsAny(key, "?#\\") {
			return nil, fmt.Errorf("invalid image input object key %q", key)
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		keys = append(keys, key)
	}
	if len(keys) == 0 {
		return nil, errors.New("image input cleanup contains no object keys")
	}
	return keys, nil
}

func NewImageInputCleanup(taskID string, objectKeys []string) (*ImageInputCleanup, error) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, errors.New("image input cleanup task id is required")
	}
	keys, err := validateImageInputCleanupKeys(objectKeys)
	if err != nil {
		return nil, err
	}
	stored, err := storeImageInputCleanupKeys(keys, common.AsyncImageEncryptedWritesEnabled())
	if err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	return &ImageInputCleanup{
		TaskID:     taskID,
		ObjectKeys: stored,
		Status:     ImageInputCleanupWaiting,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func (cleanup *ImageInputCleanup) ResolvedObjectKeys() ([]string, error) {
	if cleanup == nil {
		return nil, errors.New("image input cleanup is required")
	}
	plaintext, err := common.DecryptString(cleanup.ObjectKeys)
	if err != nil {
		return nil, err
	}
	var keys []string
	if err := common.Unmarshal([]byte(plaintext), &keys); err != nil {
		return nil, err
	}
	return validateImageInputCleanupKeys(keys)
}

func storeImageInputCleanupKeys(objectKeys []string, encrypted bool) (string, error) {
	keys, err := validateImageInputCleanupKeys(objectKeys)
	if err != nil {
		return "", err
	}
	encoded, err := common.Marshal(keys)
	if err != nil {
		return "", err
	}
	stored := string(encoded)
	if encrypted {
		stored, err = common.EncryptString(stored)
		if err != nil {
			return "", err
		}
	}
	return stored, nil
}

// PersistPreparedImageInputCleanup records ownership before a private R2 PUT.
// Repeated calls merge keys while the task is still RESERVING, so every staged
// object is recoverable even if a later upload or activation step fails.
func PersistPreparedImageInputCleanup(taskID string, objectKeys []string) error {
	taskID = strings.TrimSpace(taskID)
	keys, err := validateImageInputCleanupKeys(objectKeys)
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var task Task
		if err := lockForUpdate(tx).
			Select("id", "task_id", "platform", "status").
			Where("task_id = ?", taskID).
			First(&task).Error; err != nil {
			return err
		}
		if task.Platform != constant.TaskPlatformOpenAIImage || task.Status != TaskStatusReserving {
			return errors.New("image input cleanup requires a reserving image task")
		}

		var cleanup ImageInputCleanup
		err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&cleanup).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			created, createErr := NewImageInputCleanup(taskID, keys)
			if createErr != nil {
				return createErr
			}
			return tx.Create(created).Error
		}
		if err != nil {
			return err
		}
		if cleanup.Status != ImageInputCleanupWaiting {
			return errors.New("image input cleanup is no longer waiting")
		}
		existingKeys, err := cleanup.ResolvedObjectKeys()
		if err != nil {
			return err
		}
		merged := append([]string(nil), existingKeys...)
		seen := make(map[string]struct{}, len(existingKeys)+len(keys))
		for _, key := range existingKeys {
			seen[key] = struct{}{}
		}
		for _, key := range keys {
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			merged = append(merged, key)
		}
		stored, err := storeImageInputCleanupKeys(
			merged,
			common.AsyncImageEncryptedWritesEnabled() || strings.HasPrefix(cleanup.ObjectKeys, "enc:v1:"),
		)
		if err != nil {
			return err
		}
		return tx.Model(&ImageInputCleanup{}).
			Where("id = ? AND status = ?", cleanup.ID, ImageInputCleanupWaiting).
			Updates(map[string]any{
				"object_keys": stored,
				"updated_at":  common.GetTimestamp(),
			}).Error
	})
}

func activateImageInputCleanupTx(tx *gorm.DB, task *Task, cleanup *ImageInputCleanup, now int64) error {
	if tx == nil || task == nil || task.TaskID == "" {
		return errors.New("image input cleanup activation requires a task transaction")
	}
	var checkpointKeys []string
	if len(task.CheckpointData) != 0 {
		checkpoint, err := DecryptImageTaskArtifactCheckpoint(task.CheckpointData)
		if err != nil {
			return fmt.Errorf("decode image input cleanup checkpoint: %w", err)
		}
		var payload struct {
			InputObjectKeys []string `json:"input_object_keys"`
			MaskObjectKey   string   `json:"mask_object_key"`
		}
		if err := common.Unmarshal(checkpoint, &payload); err != nil {
			return fmt.Errorf("decode image input cleanup checkpoint: %w", err)
		}
		if strings.TrimSpace(payload.MaskObjectKey) != "" {
			payload.InputObjectKeys = append(payload.InputObjectKeys, payload.MaskObjectKey)
		}
		if len(payload.InputObjectKeys) != 0 {
			checkpointKeys, err = validateImageInputCleanupKeys(payload.InputObjectKeys)
			if err != nil {
				return fmt.Errorf("validate image input cleanup checkpoint: %w", err)
			}
		}
	}
	if len(checkpointKeys) == 0 {
		if cleanup != nil {
			return errors.New("image input cleanup keys do not match the task checkpoint")
		}
		var storedCleanup ImageInputCleanup
		lookupErr := tx.Select("id").Where("task_id = ?", task.TaskID).First(&storedCleanup).Error
		if lookupErr == nil {
			return errors.New("image input cleanup keys do not match the task checkpoint")
		}
		if !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			return lookupErr
		}
		return nil
	}
	persisted := false
	var storedCleanup ImageInputCleanup
	lookupErr := tx.Where("task_id = ?", task.TaskID).First(&storedCleanup).Error
	if lookupErr == nil {
		if cleanup != nil {
			providedKeys, providedErr := cleanup.ResolvedObjectKeys()
			if providedErr != nil {
				return fmt.Errorf("decode image input cleanup: %w", providedErr)
			}
			storedKeys, storedErr := storedCleanup.ResolvedObjectKeys()
			if storedErr != nil {
				return fmt.Errorf("decode image input cleanup: %w", storedErr)
			}
			if len(providedKeys) != len(storedKeys) {
				return errors.New("image input cleanup keys do not match the prepared task")
			}
			storedSet := make(map[string]struct{}, len(storedKeys))
			for _, key := range storedKeys {
				storedSet[key] = struct{}{}
			}
			for _, key := range providedKeys {
				if _, ok := storedSet[key]; !ok {
					return errors.New("image input cleanup keys do not match the prepared task")
				}
			}
		}
		cleanup = &storedCleanup
		persisted = true
	} else if !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
		return lookupErr
	} else if cleanup == nil {
		created, createErr := NewImageInputCleanup(task.TaskID, checkpointKeys)
		if createErr != nil {
			return fmt.Errorf("create image input cleanup: %w", createErr)
		}
		cleanup = created
	}
	if cleanup.TaskID != task.TaskID || cleanup.Status != ImageInputCleanupWaiting {
		return errors.New("image input cleanup does not match the prepared task")
	}
	cleanupKeys, err := cleanup.ResolvedObjectKeys()
	if err != nil {
		return fmt.Errorf("decode image input cleanup: %w", err)
	}
	if len(cleanupKeys) != len(checkpointKeys) {
		return errors.New("image input cleanup keys do not match the task checkpoint")
	}
	checkpointSet := make(map[string]struct{}, len(checkpointKeys))
	for _, key := range checkpointKeys {
		checkpointSet[key] = struct{}{}
	}
	for _, key := range cleanupKeys {
		if _, ok := checkpointSet[key]; !ok {
			return errors.New("image input cleanup keys do not match the task checkpoint")
		}
	}
	cleanup.UpdatedAt = now
	if persisted {
		return tx.Model(&ImageInputCleanup{}).
			Where("id = ? AND status = ?", cleanup.ID, ImageInputCleanupWaiting).
			Update("updated_at", now).Error
	}
	return tx.Create(cleanup).Error
}

func scheduleImageInputCleanupTx(tx *gorm.DB, taskID string, now int64) error {
	if tx == nil || strings.TrimSpace(taskID) == "" {
		return errors.New("image input cleanup scheduling requires a task transaction")
	}
	return tx.Model(&ImageInputCleanup{}).
		Where("task_id = ? AND status = ?", taskID, ImageInputCleanupWaiting).
		Updates(map[string]any{
			"status":          ImageInputCleanupPending,
			"next_attempt_at": now,
			"updated_at":      now,
		}).Error
}

// ClaimDueImageInputCleanups uses a portable candidate scan followed by an
// atomic conditional update. This avoids dialect-specific SKIP LOCKED syntax
// while still preventing concurrent workers from owning the same row.
func ClaimDueImageInputCleanups(now, leaseExpiresAt int64, limit int) ([]*ImageInputCleanup, error) {
	if leaseExpiresAt <= now {
		return nil, errors.New("image input cleanup lease must expire in the future")
	}
	if limit <= 0 {
		limit = 1
	}
	var candidates []*ImageInputCleanup
	if err := DB.Where(
		"status = ? AND next_attempt_at <= ? AND (lease_expires_at = 0 OR lease_expires_at <= ?)",
		ImageInputCleanupPending, now, now,
	).Order("id asc").Limit(limit).Find(&candidates).Error; err != nil {
		return nil, err
	}
	claimed := make([]*ImageInputCleanup, 0, len(candidates))
	for _, cleanup := range candidates {
		leaseToken := common.GetUUID()
		result := DB.Model(&ImageInputCleanup{}).
			Where(
				"id = ? AND status = ? AND next_attempt_at <= ? AND (lease_expires_at = 0 OR lease_expires_at <= ?)",
				cleanup.ID, ImageInputCleanupPending, now, now,
			).
			Updates(map[string]any{
				"lease_token":      leaseToken,
				"lease_expires_at": leaseExpiresAt,
				"updated_at":       now,
			})
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected == 0 {
			continue
		}
		cleanup.LeaseToken = leaseToken
		cleanup.LeaseExpiresAt = leaseExpiresAt
		cleanup.UpdatedAt = now
		claimed = append(claimed, cleanup)
	}
	return claimed, nil
}

func HasDueImageInputCleanups(now int64) bool {
	if DB == nil {
		return false
	}
	var id int64
	err := DB.Model(&ImageInputCleanup{}).
		Where(
			"status = ? AND next_attempt_at <= ? AND (lease_expires_at = 0 OR lease_expires_at <= ?)",
			ImageInputCleanupPending, now, now,
		).
		Limit(1).
		Pluck("id", &id).Error
	return err == nil && id != 0
}

func imageInputCleanupMutationQuery(cleanup *ImageInputCleanup) *gorm.DB {
	return DB.Model(&ImageInputCleanup{}).
		Where("id = ? AND status = ? AND lease_token = ? AND lease_expires_at = ?", cleanup.ID, ImageInputCleanupPending, cleanup.LeaseToken, cleanup.LeaseExpiresAt)
}

// UpdateClaimedImageInputCleanupKeys checkpoints progress after each successful
// object deletion. A retry therefore does not re-delete keys completed before a
// later object failed.
func UpdateClaimedImageInputCleanupKeys(cleanup *ImageInputCleanup, objectKeys []string) error {
	if cleanup == nil || cleanup.ID == 0 || cleanup.LeaseToken == "" || cleanup.LeaseExpiresAt == 0 {
		return errors.New("leased image input cleanup is required")
	}
	keys, err := validateImageInputCleanupKeys(objectKeys)
	if err != nil {
		return err
	}
	encrypted := common.AsyncImageEncryptedWritesEnabled() || strings.HasPrefix(cleanup.ObjectKeys, "enc:v1:")
	stored, err := storeImageInputCleanupKeys(keys, encrypted)
	if err != nil {
		return err
	}
	now := common.GetTimestamp()
	result := imageInputCleanupMutationQuery(cleanup).Updates(map[string]any{
		"object_keys": stored,
		"updated_at":  now,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	cleanup.ObjectKeys = stored
	cleanup.UpdatedAt = now
	return nil
}

func MarkImageInputCleanupRetry(cleanup *ImageInputCleanup, nextAttemptAt int64, lastError string) error {
	if cleanup == nil || cleanup.ID == 0 || cleanup.LeaseToken == "" || cleanup.LeaseExpiresAt == 0 {
		return errors.New("leased image input cleanup is required")
	}
	if nextAttemptAt <= 0 {
		return errors.New("image input cleanup retry time is required")
	}
	if len(lastError) > 2000 {
		lastError = lastError[:2000]
	}
	now := common.GetTimestamp()
	result := imageInputCleanupMutationQuery(cleanup).Updates(map[string]any{
		"attempts":         gorm.Expr("attempts + ?", 1),
		"next_attempt_at":  nextAttemptAt,
		"lease_token":      "",
		"lease_expires_at": 0,
		"last_error":       lastError,
		"updated_at":       now,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	cleanup.Attempts++
	cleanup.NextAttemptAt = nextAttemptAt
	cleanup.LeaseToken = ""
	cleanup.LeaseExpiresAt = 0
	cleanup.LastError = lastError
	cleanup.UpdatedAt = now
	return nil
}

func MarkImageInputCleanupCompleted(cleanup *ImageInputCleanup) error {
	if cleanup == nil || cleanup.ID == 0 || cleanup.LeaseToken == "" || cleanup.LeaseExpiresAt == 0 {
		return errors.New("leased image input cleanup is required")
	}
	now := common.GetTimestamp()
	result := imageInputCleanupMutationQuery(cleanup).Updates(map[string]any{
		"status":           ImageInputCleanupCompleted,
		"object_keys":      "",
		"lease_token":      "",
		"lease_expires_at": 0,
		"last_error":       "",
		"completed_at":     now,
		"updated_at":       now,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	cleanup.Status = ImageInputCleanupCompleted
	cleanup.ObjectKeys = ""
	cleanup.LeaseToken = ""
	cleanup.LeaseExpiresAt = 0
	cleanup.LastError = ""
	cleanup.CompletedAt = now
	cleanup.UpdatedAt = now
	return nil
}
