package model

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type AsyncExecutionStatus string

const (
	AsyncStatusQueued    AsyncExecutionStatus = "QUEUED"
	AsyncStatusRunning   AsyncExecutionStatus = "RUNNING"
	AsyncStatusSuccess   AsyncExecutionStatus = "SUCCESS"
	AsyncStatusFailure   AsyncExecutionStatus = "FAILURE"
	AsyncStatusUncertain AsyncExecutionStatus = "UNCERTAIN"
	AsyncStatusCancelled AsyncExecutionStatus = "CANCELLED"
)

const (
	AsyncEndpointImageGeneration = "image_generation"
	AsyncBillingReserved         = "RESERVED"
	AsyncBillingSettled          = "SETTLED"
	AsyncBillingRefunded         = "REFUNDED"
)

var ErrInvalidAsyncTransition = errors.New("invalid async job status transition")

var asyncIdempotencyLocks [256]sync.Mutex

type AsyncJob struct {
	ID               int64                `json:"id" gorm:"primaryKey;autoIncrement"`
	TaskID           int64                `json:"task_id" gorm:"not null;uniqueIndex"`
	TokenID          int                  `json:"token_id" gorm:"not null;uniqueIndex:idx_async_token_idempotency,priority:1;index"`
	ChannelID        int                  `json:"channel_id" gorm:"not null;index"`
	EndpointType     string               `json:"endpoint_type" gorm:"type:varchar(40);not null;index"`
	RequestPayload   []byte               `json:"-" gorm:"not null"`
	RequestHash      string               `json:"request_hash" gorm:"type:char(64);not null"`
	IdempotencyKey   string               `json:"idempotency_key" gorm:"type:varchar(191);not null;uniqueIndex:idx_async_token_idempotency,priority:2"`
	ExecutionStatus  AsyncExecutionStatus `json:"execution_status" gorm:"type:varchar(20);not null;index:idx_async_status_lease,priority:1"`
	WorkerID         string               `json:"worker_id,omitempty" gorm:"type:varchar(128);index"`
	LeaseUntil       int64                `json:"lease_until,omitempty" gorm:"index:idx_async_status_lease,priority:2"`
	Attempt          int                  `json:"attempt" gorm:"not null;default:0"`
	RequestSentAt    int64                `json:"request_sent_at,omitempty" gorm:"index"`
	ResultPayload    JSONValue            `json:"result_payload,omitempty" gorm:"type:text"`
	ErrorPhase       string               `json:"error_phase,omitempty" gorm:"type:varchar(40);index"`
	ErrorCode        string               `json:"error_code,omitempty" gorm:"type:varchar(80);index"`
	RefundEligible   bool                 `json:"refund_eligible" gorm:"not null;default:false"`
	BillingStatus    string               `json:"billing_status" gorm:"type:varchar(20);not null;default:'RESERVED';index"`
	BillingRequestID string               `json:"-" gorm:"type:varchar(64);index"`
	CreatedAt        int64                `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt        int64                `json:"updated_at" gorm:"autoUpdateTime"`

	Task Task `json:"task" gorm:"belongsTo:true;foreignKey:TaskID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

type Artifact struct {
	ID            int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	TaskID        int64  `json:"task_id" gorm:"not null;index:idx_artifact_task_object,priority:1"`
	ObjectKey     string `json:"object_key" gorm:"type:varchar(512);not null;uniqueIndex;index:idx_artifact_task_object,priority:2"`
	ContentType   string `json:"content_type" gorm:"type:varchar(128);not null"`
	SizeBytes     int64  `json:"size_bytes" gorm:"not null"`
	SHA256        string `json:"sha256" gorm:"type:char(64);not null;index"`
	SourceURLHash string `json:"source_url_hash" gorm:"type:char(64);not null"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime;index"`
	ExpiresAt     int64  `json:"expires_at" gorm:"not null;index"`

	Task Task `json:"-" gorm:"belongsTo:true;foreignKey:TaskID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

type TaskEvent struct {
	ID         int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	TaskID     int64     `json:"task_id" gorm:"not null;index"`
	EventType  string    `json:"event_type" gorm:"type:varchar(40);not null;index"`
	FromStatus string    `json:"from_status,omitempty" gorm:"type:varchar(20)"`
	ToStatus   string    `json:"to_status,omitempty" gorm:"type:varchar(20)"`
	WorkerID   string    `json:"worker_id,omitempty" gorm:"type:varchar(128)"`
	ErrorPhase string    `json:"error_phase,omitempty" gorm:"type:varchar(40)"`
	ErrorCode  string    `json:"error_code,omitempty" gorm:"type:varchar(80)"`
	ActorType  string    `json:"actor_type,omitempty" gorm:"type:varchar(20)"`
	ActorID    int       `json:"actor_id,omitempty"`
	Details    JSONValue `json:"details,omitempty" gorm:"type:text"`
	CreatedAt  int64     `json:"created_at" gorm:"autoCreateTime;index"`

	Task Task `json:"-" gorm:"belongsTo:true;foreignKey:TaskID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

type AsyncTaskRecord struct {
	Job  AsyncJob
	Task Task
}

func AsyncStatusIsTerminal(status AsyncExecutionStatus) bool {
	switch status {
	case AsyncStatusSuccess, AsyncStatusFailure, AsyncStatusUncertain, AsyncStatusCancelled:
		return true
	default:
		return false
	}
}

func ValidateAsyncTransition(from, to AsyncExecutionStatus) error {
	allowed := false
	switch from {
	case AsyncStatusQueued:
		allowed = to == AsyncStatusRunning || to == AsyncStatusCancelled
	case AsyncStatusRunning:
		allowed = to == AsyncStatusSuccess || to == AsyncStatusFailure || to == AsyncStatusUncertain
	case AsyncStatusFailure, AsyncStatusUncertain:
		allowed = to == AsyncStatusQueued
	}
	if !allowed {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidAsyncTransition, from, to)
	}
	return nil
}

func asyncTaskStatus(status AsyncExecutionStatus) TaskStatus {
	switch status {
	case AsyncStatusQueued:
		return TaskStatusQueued
	case AsyncStatusRunning:
		return TaskStatusInProgress
	case AsyncStatusSuccess:
		return TaskStatusSuccess
	case AsyncStatusFailure:
		return TaskStatusFailure
	case AsyncStatusUncertain:
		return TaskStatusUncertain
	case AsyncStatusCancelled:
		return TaskStatusCancelled
	default:
		return TaskStatusUnknown
	}
}

func CreateAsyncTask(task *Task, job *AsyncJob) error {
	if task == nil || job == nil {
		return errors.New("task and async job are required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(task).Error; err != nil {
			return err
		}
		job.TaskID = task.ID
		if err := tx.Create(job).Error; err != nil {
			return err
		}
		return tx.Create(&TaskEvent{
			TaskID:    task.ID,
			EventType: "created",
			ToStatus:  string(AsyncStatusQueued),
			ActorType: "token",
			ActorID:   job.TokenID,
		}).Error
	})
}

// WithAsyncIdempotencyLock serializes a token/idempotency-key pair in this
// process and, on PostgreSQL, across API replicas using a transaction-scoped
// advisory lock. The database unique index remains the final invariant.
func WithAsyncIdempotencyLock(ctx context.Context, tokenID int, key string, fn func() error) error {
	hasher := fnv.New64a()
	_, _ = fmt.Fprintf(hasher, "%d:%s", tokenID, key)
	lockKey := hasher.Sum64()
	local := &asyncIdempotencyLocks[lockKey%uint64(len(asyncIdempotencyLocks))]
	local.Lock()
	defer local.Unlock()

	if !common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		return fn()
	}
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(?)", int64(lockKey)).Error; err != nil {
			return err
		}
		return fn()
	})
}

func GetAsyncJobByTokenAndKey(ctx context.Context, tokenID int, key string) (*AsyncJob, error) {
	var job AsyncJob
	err := DB.WithContext(ctx).Where("token_id = ? AND idempotency_key = ?", tokenID, key).First(&job).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &job, loadAsyncJobTask(DB.WithContext(ctx), &job)
}

func GetAsyncJobByPublicTaskID(ctx context.Context, publicTaskID string, tokenID int) (*AsyncJob, error) {
	var job AsyncJob
	query := DB.WithContext(ctx).
		Joins("JOIN tasks ON tasks.id = async_jobs.task_id").
		Where("tasks.task_id = ?", publicTaskID)
	if tokenID > 0 {
		query = query.Where("async_jobs.token_id = ?", tokenID)
	}
	err := query.First(&job).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &job, loadAsyncJobTask(DB.WithContext(ctx), &job)
}

func GetAsyncJobForSession(ctx context.Context, publicTaskID string, userID int, administrator bool) (*AsyncJob, error) {
	var job AsyncJob
	query := DB.WithContext(ctx).
		Joins("JOIN tasks ON tasks.id = async_jobs.task_id").
		Where("tasks.task_id = ?", publicTaskID)
	if !administrator {
		query = query.Where("tasks.user_id = ?", userID)
	}
	err := query.First(&job).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &job, loadAsyncJobTask(DB.WithContext(ctx), &job)
}

func ListAsyncJobsByTaskIDs(ctx context.Context, taskIDs []int64) (map[int64]AsyncJob, error) {
	result := make(map[int64]AsyncJob, len(taskIDs))
	if len(taskIDs) == 0 {
		return result, nil
	}
	var jobs []AsyncJob
	if err := DB.WithContext(ctx).Where("task_id IN ?", taskIDs).Find(&jobs).Error; err != nil {
		return nil, err
	}
	for _, job := range jobs {
		result[job.TaskID] = job
	}
	return result, nil
}

func ListTaskEvents(ctx context.Context, taskID int64) ([]TaskEvent, error) {
	var events []TaskEvent
	err := DB.WithContext(ctx).Where("task_id = ?", taskID).Order("id ASC").Find(&events).Error
	return events, err
}

func ListQueuedAsyncJobs(ctx context.Context, limit int) ([]AsyncJob, error) {
	if limit <= 0 {
		limit = 50
	}
	var jobs []AsyncJob
	err := DB.WithContext(ctx).
		Where("execution_status = ?", AsyncStatusQueued).
		Order("created_at ASC, id ASC").Limit(limit).Find(&jobs).Error
	if err == nil {
		for i := range jobs {
			if loadErr := loadAsyncJobTask(DB.WithContext(ctx), &jobs[i]); loadErr != nil {
				return nil, loadErr
			}
		}
	}
	return jobs, err
}

func loadAsyncJobTask(db *gorm.DB, job *AsyncJob) error {
	if job == nil || job.TaskID == 0 {
		return nil
	}
	return db.First(&job.Task, job.TaskID).Error
}

func ClaimAsyncJob(ctx context.Context, jobID int64, workerID string, leaseUntil int64) (*AsyncJob, bool, error) {
	var claimed AsyncJob
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job AsyncJob
		result := lockForUpdate(tx).Where("id = ? AND execution_status = ?", jobID, AsyncStatusQueued).First(&job)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil
		}
		if result.Error != nil {
			return result.Error
		}
		if err := ValidateAsyncTransition(job.ExecutionStatus, AsyncStatusRunning); err != nil {
			return err
		}
		now := time.Now().Unix()
		updates := map[string]any{
			"execution_status": AsyncStatusRunning,
			"worker_id":        workerID,
			"lease_until":      leaseUntil,
			"attempt":          gorm.Expr("attempt + 1"),
			"updated_at":       now,
		}
		jobUpdate := tx.Model(&AsyncJob{}).Where("id = ? AND execution_status = ?", job.ID, AsyncStatusQueued).Updates(updates)
		if jobUpdate.Error != nil {
			return jobUpdate.Error
		}
		if jobUpdate.RowsAffected != 1 {
			return nil
		}
		taskUpdate := tx.Model(&Task{}).Where("id = ? AND status = ?", job.TaskID, TaskStatusQueued).Updates(map[string]any{
			"status":     TaskStatusInProgress,
			"progress":   "1%",
			"start_time": now,
			"updated_at": now,
		})
		if taskUpdate.Error != nil {
			return taskUpdate.Error
		}
		if taskUpdate.RowsAffected != 1 {
			return errors.New("async task state changed while claiming job")
		}
		if err := tx.Create(&TaskEvent{TaskID: job.TaskID, EventType: "claimed", FromStatus: string(AsyncStatusQueued), ToStatus: string(AsyncStatusRunning), WorkerID: workerID}).Error; err != nil {
			return err
		}
		if err := tx.First(&claimed, job.ID).Error; err != nil {
			return err
		}
		return loadAsyncJobTask(tx, &claimed)
	})
	if err != nil {
		return nil, false, err
	}
	if claimed.ID == 0 {
		return nil, false, nil
	}
	return &claimed, true, nil
}

func RenewAsyncJobLease(ctx context.Context, jobID int64, workerID string, leaseUntil int64) (bool, error) {
	result := DB.WithContext(ctx).Model(&AsyncJob{}).
		Where("id = ? AND execution_status = ? AND worker_id = ?", jobID, AsyncStatusRunning, workerID).
		Updates(map[string]any{"lease_until": leaseUntil, "updated_at": time.Now().Unix()})
	return result.RowsAffected == 1, result.Error
}

func MarkAsyncRequestSent(ctx context.Context, jobID int64, workerID string, sentAt int64) (bool, error) {
	result := DB.WithContext(ctx).Model(&AsyncJob{}).
		Where("id = ? AND execution_status = ? AND worker_id = ? AND request_sent_at = 0", jobID, AsyncStatusRunning, workerID).
		Updates(map[string]any{"request_sent_at": sentAt, "updated_at": sentAt})
	return result.RowsAffected == 1, result.Error
}

func CompleteAsyncJob(ctx context.Context, jobID int64, workerID string, status AsyncExecutionStatus, resultPayload json.RawMessage, errorPhase, errorCode, failReason string, refundEligible bool) (bool, error) {
	if status != AsyncStatusSuccess && status != AsyncStatusFailure && status != AsyncStatusUncertain {
		return false, fmt.Errorf("unsupported completion status %s", status)
	}
	changed := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job AsyncJob
		result := lockForUpdate(tx).Where("id = ? AND execution_status = ? AND worker_id = ?", jobID, AsyncStatusRunning, workerID).First(&job)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil
		}
		if result.Error != nil {
			return result.Error
		}
		if err := ValidateAsyncTransition(job.ExecutionStatus, status); err != nil {
			return err
		}
		now := time.Now().Unix()
		jobUpdate := tx.Model(&AsyncJob{}).Where("id = ? AND execution_status = ? AND worker_id = ?", job.ID, AsyncStatusRunning, workerID).Updates(map[string]any{
			"execution_status": status,
			"worker_id":        "",
			"lease_until":      0,
			"result_payload":   JSONValue(resultPayload),
			"error_phase":      errorPhase,
			"error_code":       errorCode,
			"refund_eligible":  refundEligible,
			"updated_at":       now,
		})
		if jobUpdate.Error != nil {
			return jobUpdate.Error
		}
		if jobUpdate.RowsAffected != 1 {
			return nil
		}
		taskUpdates := map[string]any{
			"status":      asyncTaskStatus(status),
			"finish_time": now,
			"updated_at":  now,
			"fail_reason": failReason,
		}
		if status == AsyncStatusSuccess {
			taskUpdates["progress"] = "100%"
		} else {
			taskUpdates["progress"] = "0%"
		}
		if len(resultPayload) > 0 {
			taskUpdates["data"] = resultPayload
		}
		taskUpdate := tx.Model(&Task{}).Where("id = ? AND status = ?", job.TaskID, TaskStatusInProgress).Updates(taskUpdates)
		if taskUpdate.Error != nil {
			return taskUpdate.Error
		}
		if taskUpdate.RowsAffected != 1 {
			return errors.New("async task state changed while completing job")
		}
		if err := tx.Create(&TaskEvent{TaskID: job.TaskID, EventType: "completed", FromStatus: string(AsyncStatusRunning), ToStatus: string(status), WorkerID: workerID, ErrorPhase: errorPhase, ErrorCode: errorCode}).Error; err != nil {
			return err
		}
		changed = true
		return nil
	})
	return changed, err
}

func CancelQueuedAsyncJob(ctx context.Context, publicTaskID string, tokenID int) (*AsyncJob, bool, error) {
	job, err := GetAsyncJobByPublicTaskID(ctx, publicTaskID, tokenID)
	if err != nil || job == nil {
		return job, false, err
	}
	return CancelQueuedAsyncJobByID(ctx, job.ID, "token", tokenID)
}

func CancelQueuedAsyncJobByID(ctx context.Context, jobID int64, actorType string, actorID int) (*AsyncJob, bool, error) {
	var cancelled AsyncJob
	changed := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job AsyncJob
		result := lockForUpdate(tx).Where("id = ?", jobID).First(&job)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil
		}
		if result.Error != nil {
			return result.Error
		}
		if job.ExecutionStatus != AsyncStatusQueued {
			cancelled = job
			return loadAsyncJobTask(tx, &cancelled)
		}
		if err := ValidateAsyncTransition(job.ExecutionStatus, AsyncStatusCancelled); err != nil {
			return err
		}
		now := time.Now().Unix()
		jobUpdate := tx.Model(&AsyncJob{}).Where("id = ? AND execution_status = ?", job.ID, AsyncStatusQueued).Updates(map[string]any{
			"execution_status": AsyncStatusCancelled,
			"refund_eligible":  true,
			"updated_at":       now,
		})
		if jobUpdate.Error != nil {
			return jobUpdate.Error
		}
		if jobUpdate.RowsAffected != 1 {
			cancelled = job
			return loadAsyncJobTask(tx, &cancelled)
		}
		taskUpdate := tx.Model(&Task{}).Where("id = ? AND status = ?", job.TaskID, TaskStatusQueued).Updates(map[string]any{
			"status":      TaskStatusCancelled,
			"finish_time": now,
			"updated_at":  now,
			"fail_reason": "cancelled before upstream request",
		})
		if taskUpdate.Error != nil {
			return taskUpdate.Error
		}
		if taskUpdate.RowsAffected != 1 {
			return errors.New("async task state changed while cancelling job")
		}
		if err := tx.Create(&TaskEvent{TaskID: job.TaskID, EventType: "cancelled", FromStatus: string(AsyncStatusQueued), ToStatus: string(AsyncStatusCancelled), ActorType: actorType, ActorID: actorID}).Error; err != nil {
			return err
		}
		changed = true
		if err := tx.First(&cancelled, job.ID).Error; err != nil {
			return err
		}
		return loadAsyncJobTask(tx, &cancelled)
	})
	if err != nil {
		return nil, false, err
	}
	if cancelled.ID == 0 {
		return nil, false, nil
	}
	return &cancelled, changed, nil
}

type AsyncRecoverySummary struct {
	Requeued  int `json:"requeued"`
	Uncertain int `json:"uncertain"`
}

func RecoverExpiredAsyncJobs(ctx context.Context, now int64, limit int) (AsyncRecoverySummary, error) {
	if limit <= 0 {
		limit = 100
	}
	var ids []int64
	if err := DB.WithContext(ctx).Model(&AsyncJob{}).
		Where("execution_status = ? AND lease_until > 0 AND lease_until < ?", AsyncStatusRunning, now).
		Order("lease_until ASC").Limit(limit).Pluck("id", &ids).Error; err != nil {
		return AsyncRecoverySummary{}, err
	}
	summary := AsyncRecoverySummary{}
	for _, id := range ids {
		err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var job AsyncJob
			result := lockForUpdate(tx).Where("id = ? AND execution_status = ? AND lease_until < ?", id, AsyncStatusRunning, now).First(&job)
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				return nil
			}
			if result.Error != nil {
				return result.Error
			}
			if job.RequestSentAt == 0 {
				if err := tx.Model(&AsyncJob{}).Where("id = ?", job.ID).Updates(map[string]any{
					"execution_status": AsyncStatusQueued,
					"worker_id":        "",
					"lease_until":      0,
					"updated_at":       now,
				}).Error; err != nil {
					return err
				}
				if err := tx.Model(&Task{}).Where("id = ?", job.TaskID).Updates(map[string]any{
					"status":     TaskStatusQueued,
					"progress":   "0%",
					"start_time": 0,
					"updated_at": now,
				}).Error; err != nil {
					return err
				}
				if err := tx.Create(&TaskEvent{TaskID: job.TaskID, EventType: "lease_recovered", FromStatus: string(AsyncStatusRunning), ToStatus: string(AsyncStatusQueued), WorkerID: job.WorkerID}).Error; err != nil {
					return err
				}
				summary.Requeued++
				return nil
			}
			if err := tx.Model(&AsyncJob{}).Where("id = ?", job.ID).Updates(map[string]any{
				"execution_status": AsyncStatusUncertain,
				"worker_id":        "",
				"lease_until":      0,
				"error_phase":      "worker_recovery",
				"error_code":       "lease_expired_after_send",
				"updated_at":       now,
			}).Error; err != nil {
				return err
			}
			if err := tx.Model(&Task{}).Where("id = ?", job.TaskID).Updates(map[string]any{
				"status":      TaskStatusUncertain,
				"finish_time": now,
				"fail_reason": "worker lease expired after the upstream request may have been sent",
				"updated_at":  now,
			}).Error; err != nil {
				return err
			}
			if err := tx.Create(&TaskEvent{TaskID: job.TaskID, EventType: "lease_uncertain", FromStatus: string(AsyncStatusRunning), ToStatus: string(AsyncStatusUncertain), WorkerID: job.WorkerID, ErrorPhase: "worker_recovery", ErrorCode: "lease_expired_after_send"}).Error; err != nil {
				return err
			}
			summary.Uncertain++
			return nil
		})
		if err != nil {
			return summary, err
		}
	}
	return summary, nil
}

func CreateArtifacts(ctx context.Context, artifacts []Artifact) error {
	if len(artifacts) == 0 {
		return nil
	}
	return DB.WithContext(ctx).Create(&artifacts).Error
}

func ListArtifactsByTaskID(ctx context.Context, taskID int64) ([]Artifact, error) {
	var artifacts []Artifact
	err := DB.WithContext(ctx).Where("task_id = ?", taskID).Order("id ASC").Find(&artifacts).Error
	return artifacts, err
}

func ListExpiredArtifacts(ctx context.Context, before int64, limit int) ([]Artifact, error) {
	if limit <= 0 {
		limit = 100
	}
	var artifacts []Artifact
	err := DB.WithContext(ctx).Where("expires_at <= ?", before).Order("expires_at ASC").Limit(limit).Find(&artifacts).Error
	return artifacts, err
}

func DeleteArtifactAndClearResultIfLast(ctx context.Context, artifactID, taskID int64) (bool, error) {
	resultCleared := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job AsyncJob
		jobQuery := lockForUpdate(tx).Select("id").Where("task_id = ?", taskID).First(&job)
		if jobQuery.Error != nil && !errors.Is(jobQuery.Error, gorm.ErrRecordNotFound) {
			return jobQuery.Error
		}

		deleted := tx.Where("id = ? AND task_id = ?", artifactID, taskID).Delete(&Artifact{})
		if deleted.Error != nil || deleted.RowsAffected == 0 {
			return deleted.Error
		}
		if job.ID == 0 {
			return nil
		}

		var remaining int64
		if err := tx.Model(&Artifact{}).Where("task_id = ?", taskID).Count(&remaining).Error; err != nil {
			return err
		}
		if remaining > 0 {
			return nil
		}
		update := tx.Model(&AsyncJob{}).Where("id = ?", job.ID).Updates(map[string]any{
			"result_payload": nil,
			"updated_at":     time.Now().Unix(),
		})
		if update.Error != nil {
			return update.Error
		}
		resultCleared = update.RowsAffected == 1
		return nil
	})
	return resultCleared, err
}
