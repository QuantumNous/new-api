package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

type TaskWebhookStatus string

const (
	TaskWebhookStatusPending   TaskWebhookStatus = "pending"
	TaskWebhookStatusDelivered TaskWebhookStatus = "delivered"
	TaskWebhookStatusFailed    TaskWebhookStatus = "failed"
)

type TaskWebhook struct {
	ID             int64             `json:"id" gorm:"primaryKey"`
	TaskID         string            `json:"task_id" gorm:"type:varchar(191);uniqueIndex"`
	URL            string            `json:"url" gorm:"type:text"`
	Secret         string            `json:"-" gorm:"type:text"`
	Status         TaskWebhookStatus `json:"status" gorm:"type:varchar(20);index:idx_task_webhook_due,priority:1"`
	Attempts       int               `json:"attempts"`
	NextAttemptAt  int64             `json:"next_attempt_at" gorm:"index:idx_task_webhook_due,priority:2"`
	LeaseToken     string            `json:"-" gorm:"type:varchar(64)"`
	LeaseExpiresAt int64             `json:"-" gorm:"index:idx_task_webhook_due,priority:3"`
	LastError      string            `json:"last_error" gorm:"type:text"`
	DeliveredAt    int64             `json:"delivered_at"`
	CreatedAt      int64             `json:"created_at" gorm:"index"`
	UpdatedAt      int64             `json:"updated_at"`
}

// DeliveryID is stable across retries so webhook consumers can deduplicate
// the at-least-once delivery of a terminal task result.
func (webhook *TaskWebhook) DeliveryID() string {
	if webhook == nil {
		return ""
	}
	return webhook.TaskID
}

func (webhook *TaskWebhook) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if webhook.Status == "" {
		webhook.Status = TaskWebhookStatusPending
	}
	if webhook.CreatedAt == 0 {
		webhook.CreatedAt = now
	}
	if webhook.UpdatedAt == 0 {
		webhook.UpdatedAt = now
	}
	return nil
}

func InsertTaskWithWebhook(task *Task, webhook *TaskWebhook) error {
	if task == nil {
		return errors.New("task is required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(task).Error; err != nil {
			return err
		}
		if webhook == nil {
			return nil
		}
		webhook.TaskID = task.TaskID
		return tx.Create(webhook).Error
	})
}

func FindPendingImageTasks(limit int) ([]*Task, error) {
	if limit <= 0 {
		limit = 1
	}
	var tasks []*Task
	now := common.GetTimestamp()
	err := DB.Where(
		"platform = ? AND status = ? AND worker_next_retry_at <= ? AND provider_next_retry_at <= ? AND download_next_retry_at <= ? AND upload_next_retry_at <= ?",
		constant.TaskPlatformOpenAIImage,
		TaskStatusNotStart,
		now,
		now,
		now,
		now,
	).
		Order("id asc").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func HasPendingImageWork(staleInProgressCutoff int64) bool {
	var taskID int64
	err := DB.Model(&Task{}).
		Where("platform = ?", constant.TaskPlatformOpenAIImage).
		Where(
			"(status = ? AND worker_next_retry_at <= ? AND provider_next_retry_at <= ? AND download_next_retry_at <= ? AND upload_next_retry_at <= ?) OR (status = ? AND start_time <= ?) OR (status = ? AND finalize_next_retry_at <= ?)",
			TaskStatusNotStart,
			common.GetTimestamp(),
			common.GetTimestamp(),
			common.GetTimestamp(),
			common.GetTimestamp(),
			TaskStatusInProgress,
			staleInProgressCutoff,
			TaskStatusFinalizing,
			common.GetTimestamp(),
		).
		Limit(1).
		Pluck("id", &taskID).Error
	if err == nil && taskID != 0 {
		return true
	}

	var webhookID int64
	err = DB.Model(&TaskWebhook{}).
		Where("status = ? AND next_attempt_at <= ? AND (lease_expires_at IS NULL OR lease_expires_at <= ?)", TaskWebhookStatusPending, common.GetTimestamp(), common.GetTimestamp()).
		Limit(1).
		Pluck("id", &webhookID).Error
	return err == nil && webhookID != 0
}

func (task *Task) MarkImageSubmissionRetry(nextRetryAt int64, lastError string) (bool, error) {
	return task.markImageProviderRetry(nextRetryAt, lastError, "10%")
}

func (task *Task) MarkImageProviderRetry(nextRetryAt int64, lastError string) (bool, error) {
	return task.markImageProviderRetry(nextRetryAt, lastError, "40%")
}

func (task *Task) markImageProviderRetry(nextRetryAt int64, lastError string, progress string) (bool, error) {
	if task == nil || task.ID == 0 {
		return false, errors.New("persisted image task is required")
	}
	if len(lastError) > 2000 {
		lastError = lastError[:2000]
	}
	now := common.GetTimestamp()
	result := DB.Model(&Task{}).
		Where("id = ? AND platform = ? AND status = ? AND attempt = ?", task.ID, constant.TaskPlatformOpenAIImage, TaskStatusInProgress, task.Attempt).
		Updates(map[string]any{
			"status":                 TaskStatusNotStart,
			"progress":               progress,
			"start_time":             0,
			"provider_attempts":      gorm.Expr("provider_attempts + ?", 1),
			"provider_next_retry_at": nextRetryAt,
			"provider_error":         lastError,
			"worker_attempts":        0,
			"worker_next_retry_at":   0,
			"worker_error":           "",
			"updated_at":             now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, nil
	}
	task.Status = TaskStatusNotStart
	task.Progress = progress
	task.StartTime = 0
	task.ProviderAttempts++
	task.ProviderNextRetryAt = nextRetryAt
	task.ProviderError = lastError
	task.WorkerAttempts = 0
	task.WorkerNextRetryAt = 0
	task.WorkerError = ""
	task.UpdatedAt = now
	return true, nil
}

func (task *Task) MarkImageDownloadRetry(nextRetryAt int64, lastError string) (bool, error) {
	if task == nil || task.ID == 0 {
		return false, errors.New("persisted image task is required")
	}
	if len(lastError) > 2000 {
		lastError = lastError[:2000]
	}
	now := common.GetTimestamp()
	result := DB.Model(&Task{}).
		Where("id = ? AND platform = ? AND status = ? AND attempt = ?", task.ID, constant.TaskPlatformOpenAIImage, TaskStatusInProgress, task.Attempt).
		Updates(map[string]any{
			"status":                 TaskStatusNotStart,
			"progress":               "40%",
			"start_time":             0,
			"download_attempts":      gorm.Expr("download_attempts + ?", 1),
			"download_next_retry_at": nextRetryAt,
			"download_error":         lastError,
			"worker_attempts":        0,
			"worker_next_retry_at":   0,
			"worker_error":           "",
			"updated_at":             now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, nil
	}
	task.Status = TaskStatusNotStart
	task.Progress = "40%"
	task.StartTime = 0
	task.DownloadAttempts++
	task.DownloadNextRetryAt = nextRetryAt
	task.DownloadError = lastError
	task.WorkerAttempts = 0
	task.WorkerNextRetryAt = 0
	task.WorkerError = ""
	task.UpdatedAt = now
	return true, nil
}

func (task *Task) MarkImageWorkerRetry(nextRetryAt int64, lastError string) (bool, error) {
	if task == nil || task.ID == 0 {
		return false, errors.New("persisted image task is required")
	}
	if len(lastError) > 2000 {
		lastError = lastError[:2000]
	}
	now := common.GetTimestamp()
	result := DB.Model(&Task{}).
		Where("id = ? AND platform = ? AND status = ? AND attempt = ?", task.ID, constant.TaskPlatformOpenAIImage, TaskStatusInProgress, task.Attempt).
		Updates(map[string]any{
			"status":               TaskStatusNotStart,
			"start_time":           0,
			"worker_attempts":      gorm.Expr("worker_attempts + ?", 1),
			"worker_next_retry_at": nextRetryAt,
			"worker_error":         lastError,
			"updated_at":           now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, nil
	}
	task.Status = TaskStatusNotStart
	task.StartTime = 0
	task.WorkerAttempts++
	task.WorkerNextRetryAt = nextRetryAt
	task.WorkerError = lastError
	task.UpdatedAt = now
	return true, nil
}

func RequeueStaleInProgressImageTasks(cutoff int64, now int64) error {
	return DB.Model(&Task{}).
		Where(
			"platform = ? AND status = ? AND start_time <= ?",
			constant.TaskPlatformOpenAIImage,
			TaskStatusInProgress,
			cutoff,
		).
		Updates(map[string]any{
			"status":     TaskStatusNotStart,
			"start_time": 0,
			"updated_at": now,
		}).Error
}

func (task *Task) MarkImageUploadRetry(nextRetryAt int64, lastError string) (bool, error) {
	if task == nil || task.ID == 0 {
		return false, errors.New("persisted image task is required")
	}
	if len(lastError) > 2000 {
		lastError = lastError[:2000]
	}
	now := common.GetTimestamp()
	result := DB.Model(&Task{}).
		Where("id = ? AND platform = ? AND status = ? AND attempt = ?", task.ID, constant.TaskPlatformOpenAIImage, TaskStatusInProgress, task.Attempt).
		Updates(map[string]any{
			"status":               TaskStatusNotStart,
			"progress":             "70%",
			"start_time":           0,
			"upload_attempts":      gorm.Expr("upload_attempts + ?", 1),
			"upload_next_retry_at": nextRetryAt,
			"upload_error":         lastError,
			"worker_attempts":      0,
			"worker_next_retry_at": 0,
			"worker_error":         "",
			"updated_at":           now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, nil
	}
	task.Status = TaskStatusNotStart
	task.Progress = "70%"
	task.StartTime = 0
	task.UploadAttempts++
	task.UploadNextRetryAt = nextRetryAt
	task.UploadError = lastError
	task.WorkerAttempts = 0
	task.WorkerNextRetryAt = 0
	task.WorkerError = ""
	task.UpdatedAt = now
	return true, nil
}

func ClaimImageTask(task *Task, now int64) (bool, error) {
	if task == nil || task.ID == 0 {
		return false, nil
	}
	claimed := false
	claimedAttempt := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current Task
		query := lockForUpdate(tx).
			Select("id", "attempt").
			Where("id = ? AND platform = ? AND status = ?", task.ID, constant.TaskPlatformOpenAIImage, TaskStatusNotStart).
			First(&current)
		if errors.Is(query.Error, gorm.ErrRecordNotFound) {
			return nil
		}
		if query.Error != nil {
			return query.Error
		}

		claimedAttempt = current.Attempt + 1
		result := tx.Model(&Task{}).
			Where("id = ? AND platform = ? AND status = ? AND attempt = ?", task.ID, constant.TaskPlatformOpenAIImage, TaskStatusNotStart, current.Attempt).
			Updates(map[string]any{
				"status":     TaskStatusInProgress,
				"attempt":    claimedAttempt,
				"progress":   "10%",
				"start_time": now,
				"updated_at": now,
			})
		if result.Error != nil {
			return result.Error
		}
		claimed = result.RowsAffected == 1
		return nil
	})
	if err != nil || !claimed {
		return false, err
	}
	task.Status = TaskStatusInProgress
	task.Attempt = claimedAttempt
	task.Progress = "10%"
	task.StartTime = now
	task.UpdatedAt = now
	return true, nil
}

func FindFinalizingImageTasks(limit int) ([]*Task, error) {
	if limit <= 0 {
		limit = 1
	}
	var tasks []*Task
	err := DB.Where(
		"platform = ? AND status = ? AND finalize_next_retry_at <= ?",
		constant.TaskPlatformOpenAIImage,
		TaskStatusFinalizing,
		common.GetTimestamp(),
	).
		Order("id asc").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

// TransitionImageTaskToFinalizing persists the upstream result and billing
// target only if this is still the current worker claim. Attempt fencing keeps
// a worker from an earlier claim generation from committing after requeue.
func (task *Task) TransitionImageTaskToFinalizing(targetStatus TaskStatus, actualQuota int) (bool, error) {
	if task == nil || task.ID == 0 || task.TaskID == "" {
		return false, errors.New("persisted image task is required")
	}
	if targetStatus != TaskStatusSuccess && targetStatus != TaskStatusFailure {
		return false, errors.New("image task final status must be SUCCESS or FAILURE")
	}
	if actualQuota < 0 || actualQuota > common.MaxQuota {
		return false, errors.New("image task actual quota is out of range")
	}

	candidate := *task
	candidate.Status = TaskStatusFinalizing
	candidate.Progress = "99%"
	candidate.FinishTime = 0
	candidate.UpdatedAt = common.GetTimestamp()
	candidate.PrivateData.BillingFinalStatus = targetStatus
	candidate.PrivateData.BillingActualQuota = actualQuota
	candidate.PrivateData.BillingDBApplied = false
	candidate.FinalizeAttempts = 0
	candidate.FinalizeNextRetryAt = 0
	candidate.FinalizeError = ""
	candidate.WorkerAttempts = 0
	candidate.WorkerNextRetryAt = 0
	candidate.WorkerError = ""
	candidate.ProviderAttempts = 0
	candidate.ProviderNextRetryAt = 0
	candidate.ProviderError = ""
	candidate.DownloadAttempts = 0
	candidate.DownloadNextRetryAt = 0
	candidate.DownloadError = ""
	candidate.UploadAttempts = 0
	candidate.UploadNextRetryAt = 0
	candidate.UploadError = ""

	result := DB.Model(&Task{}).
		Where(
			"id = ? AND task_id = ? AND platform = ? AND status = ? AND attempt = ?",
			task.ID,
			task.TaskID,
			constant.TaskPlatformOpenAIImage,
			TaskStatusInProgress,
			task.Attempt,
		).
		Select("*").
		Updates(&candidate)
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, nil
	}
	*task = candidate
	return true, nil
}

func MarkImageTaskFinalizationRetry(task *Task, nextRetryAt int64, lastError string) error {
	if task == nil || task.ID == 0 {
		return errors.New("persisted image task is required")
	}
	result := DB.Model(&Task{}).
		Where("id = ? AND platform = ? AND status = ?", task.ID, constant.TaskPlatformOpenAIImage, TaskStatusFinalizing).
		Updates(map[string]any{
			"finalize_attempts":      gorm.Expr("finalize_attempts + ?", 1),
			"finalize_next_retry_at": nextRetryAt,
			"finalize_error":         lastError,
			"updated_at":             common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		task.FinalizeAttempts++
		task.FinalizeNextRetryAt = nextRetryAt
		task.FinalizeError = lastError
	}
	return nil
}

func FindDueTaskWebhooks(now int64, limit int) ([]*TaskWebhook, error) {
	if limit <= 0 {
		limit = 1
	}
	var webhooks []*TaskWebhook
	err := DB.Model(&TaskWebhook{}).
		Joins(
			"LEFT JOIN tasks ON tasks.task_id = task_webhooks.task_id AND tasks.platform = ?",
			constant.TaskPlatformOpenAIImage,
		).
		Where("task_webhooks.status = ? AND task_webhooks.next_attempt_at <= ? AND (task_webhooks.lease_expires_at IS NULL OR task_webhooks.lease_expires_at <= ?)", TaskWebhookStatusPending, now, now).
		Where("tasks.id IS NULL OR tasks.status IN ?", []TaskStatus{TaskStatusSuccess, TaskStatusFailure}).
		Order("task_webhooks.id asc").
		Limit(limit).
		Find(&webhooks).Error
	return webhooks, err
}

// ClaimDueTaskWebhooks leases due rows with an atomic conditional update. The
// lease prevents concurrent workers from sending the same callback. Delivery
// remains at-least-once because a process can stop after the receiver accepts
// the request but before the delivered status is persisted.
func ClaimDueTaskWebhooks(now int64, leaseExpiresAt int64, limit int) ([]*TaskWebhook, error) {
	if leaseExpiresAt <= now {
		return nil, errors.New("task webhook lease must expire in the future")
	}
	candidates, err := FindDueTaskWebhooks(now, limit)
	if err != nil {
		return nil, err
	}
	claimed := make([]*TaskWebhook, 0, len(candidates))
	for _, webhook := range candidates {
		leaseToken := common.GetUUID()
		result := DB.Model(&TaskWebhook{}).
			Where(
				"id = ? AND status = ? AND next_attempt_at <= ? AND (lease_expires_at IS NULL OR lease_expires_at <= ?)",
				webhook.ID,
				TaskWebhookStatusPending,
				now,
				now,
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
		webhook.LeaseToken = leaseToken
		webhook.LeaseExpiresAt = leaseExpiresAt
		webhook.UpdatedAt = now
		claimed = append(claimed, webhook)
	}
	return claimed, nil
}

func taskWebhookMutationQuery(webhook *TaskWebhook) *gorm.DB {
	query := DB.Model(&TaskWebhook{}).
		Where("id = ? AND status = ?", webhook.ID, TaskWebhookStatusPending)
	if webhook.LeaseToken != "" {
		query = query.Where("lease_token = ?", webhook.LeaseToken)
	}
	return query
}

func MarkTaskWebhookRetry(webhook *TaskWebhook, nextAttemptAt int64, lastError string) error {
	if webhook == nil || webhook.ID == 0 {
		return errors.New("persisted task webhook is required")
	}
	now := common.GetTimestamp()
	result := taskWebhookMutationQuery(webhook).
		Updates(map[string]any{
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
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return DB.Where("id = ?", webhook.ID).First(webhook).Error
}

func MarkTaskWebhookDelivered(webhook *TaskWebhook) error {
	if webhook == nil || webhook.ID == 0 {
		return errors.New("persisted task webhook is required")
	}
	now := common.GetTimestamp()
	result := taskWebhookMutationQuery(webhook).
		Updates(map[string]any{
			"status":           TaskWebhookStatusDelivered,
			"url":              "",
			"secret":           "",
			"lease_token":      "",
			"lease_expires_at": 0,
			"last_error":       "",
			"delivered_at":     now,
			"updated_at":       now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return DB.Where("id = ?", webhook.ID).First(webhook).Error
}

func MarkTaskWebhookFailed(webhook *TaskWebhook, lastError string) error {
	if webhook == nil || webhook.ID == 0 {
		return errors.New("persisted task webhook is required")
	}
	now := common.GetTimestamp()
	result := taskWebhookMutationQuery(webhook).
		Updates(map[string]any{
			"status":           TaskWebhookStatusFailed,
			"url":              "",
			"secret":           "",
			"lease_token":      "",
			"lease_expires_at": 0,
			"attempts":         gorm.Expr("attempts + ?", 1),
			"last_error":       lastError,
			"updated_at":       now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return DB.Where("id = ?", webhook.ID).First(webhook).Error
}
