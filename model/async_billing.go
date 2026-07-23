package model

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var ErrAsyncRetryQuotaInsufficient = errors.New("insufficient quota for async task retry")

// SettleAsyncJobBilling commits the already-reserved quota exactly once and
// updates usage counters in the same transaction as the billing status guard.
// UNCERTAIN is settleable because the request crossed the send boundary and
// the upstream may already have executed and charged it.
func SettleAsyncJobBilling(ctx context.Context, jobID int64) (bool, error) {
	changed := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job AsyncJob
		result := lockForUpdate(tx).Where("id = ?", jobID).First(&job)
		if result.Error != nil {
			return result.Error
		}
		if job.BillingStatus != AsyncBillingReserved {
			return nil
		}
		var task Task
		if err := tx.First(&task, job.TaskID).Error; err != nil {
			return err
		}
		if task.Status != TaskStatusSuccess && task.Status != TaskStatusFailure && task.Status != TaskStatusUncertain {
			return fmt.Errorf("cannot settle async billing while task status is %s", task.Status)
		}
		if err := tx.Model(&User{}).Where("id = ?", task.UserId).Updates(map[string]any{
			"used_quota":    gorm.Expr("used_quota + ?", task.Quota),
			"request_count": gorm.Expr("request_count + 1"),
		}).Error; err != nil {
			return err
		}
		if task.Quota > 0 {
			if err := tx.Model(&Channel{}).Where("id = ?", task.ChannelId).
				Update("used_quota", gorm.Expr("used_quota + ?", task.Quota)).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&AsyncJob{}).Where("id = ? AND billing_status = ?", job.ID, AsyncBillingReserved).
			Update("billing_status", AsyncBillingSettled).Error; err != nil {
			return err
		}
		details := []byte(fmt.Sprintf(`{"quota":%d}`, task.Quota))
		if err := tx.Create(&TaskEvent{TaskID: task.ID, EventType: "billing_settled", ActorType: "system", Details: details}).Error; err != nil {
			return err
		}
		changed = true
		return nil
	})
	return changed, err
}

// RefundAsyncJobBilling refunds a queued cancellation or confirmed failure
// exactly once. User, token, subscription and the status guard are committed in
// one database transaction; caches are invalidated after commit.
func RefundAsyncJobBilling(ctx context.Context, jobID int64) (bool, error) {
	changed := false
	userID := 0
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job AsyncJob
		if err := lockForUpdate(tx).Where("id = ?", jobID).First(&job).Error; err != nil {
			return err
		}
		if job.BillingStatus != AsyncBillingReserved {
			return nil
		}
		var task Task
		if err := tx.First(&task, job.TaskID).Error; err != nil {
			return err
		}
		if task.Status != TaskStatusFailure && task.Status != TaskStatusCancelled {
			return fmt.Errorf("cannot refund async billing while task status is %s", task.Status)
		}
		quota := task.Quota
		userID = task.UserId
		if quota > 0 {
			if task.PrivateData.BillingSource == "subscription" && task.PrivateData.SubscriptionId > 0 {
				var subscription UserSubscription
				if err := lockForUpdate(tx).Where("id = ?", task.PrivateData.SubscriptionId).First(&subscription).Error; err != nil {
					return err
				}
				subscription.AmountUsed -= int64(quota)
				if subscription.AmountUsed < 0 {
					subscription.AmountUsed = 0
				}
				if err := tx.Save(&subscription).Error; err != nil {
					return err
				}
				if job.BillingRequestID != "" {
					if err := tx.Model(&SubscriptionPreConsumeRecord{}).
						Where("request_id = ? AND status != ?", job.BillingRequestID, "refunded").
						Update("status", "refunded").Error; err != nil {
						return err
					}
				}
			} else {
				if err := tx.Model(&User{}).Where("id = ?", task.UserId).
					Update("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
					return err
				}
			}
			if task.PrivateData.TokenId > 0 {
				if err := tx.Model(&Token{}).Where("id = ?", task.PrivateData.TokenId).Updates(map[string]any{
					"remain_quota": gorm.Expr("remain_quota + ?", quota),
					"used_quota":   gorm.Expr("used_quota - ?", quota),
				}).Error; err != nil {
					return err
				}
			}
		}
		result := tx.Model(&AsyncJob{}).Where("id = ? AND billing_status = ?", job.ID, AsyncBillingReserved).
			Update("billing_status", AsyncBillingRefunded)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		details := []byte(fmt.Sprintf(`{"quota":%d}`, quota))
		if err := tx.Create(&TaskEvent{TaskID: task.ID, EventType: "billing_refunded", ActorType: "system", Details: details}).Error; err != nil {
			return err
		}
		changed = true
		return nil
	})
	if err != nil {
		return false, err
	}
	if changed && userID > 0 {
		_ = InvalidateUserCache(userID)
		_ = InvalidateUserTokensCache(userID)
	}
	return changed, nil
}

func ReconcileAsyncBilling(ctx context.Context, limit int) (int, error) {
	if limit <= 0 {
		limit = 100
	}
	var jobs []AsyncJob
	err := DB.WithContext(ctx).
		Joins("JOIN tasks ON tasks.id = async_jobs.task_id").
		Where("async_jobs.billing_status = ? AND tasks.status IN ?", AsyncBillingReserved, []TaskStatus{TaskStatusSuccess, TaskStatusFailure, TaskStatusCancelled, TaskStatusUncertain}).
		Order("async_jobs.id ASC").Limit(limit).Find(&jobs).Error
	if err != nil {
		return 0, err
	}
	processed := 0
	for _, job := range jobs {
		var changed bool
		if err := DB.WithContext(ctx).First(&job.Task, job.TaskID).Error; err != nil {
			return processed, err
		}
		switch job.Task.Status {
		case TaskStatusSuccess, TaskStatusUncertain:
			changed, err = SettleAsyncJobBilling(ctx, job.ID)
		case TaskStatusFailure:
			if job.RefundEligible {
				changed, err = RefundAsyncJobBilling(ctx, job.ID)
			} else {
				changed, err = SettleAsyncJobBilling(ctx, job.ID)
			}
		case TaskStatusCancelled:
			changed, err = RefundAsyncJobBilling(ctx, job.ID)
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return processed, err
		}
		if changed {
			processed++
		}
	}
	return processed, nil
}

// RetryAsyncJob requeues an administrator-approved terminal task and reserves
// quota for the new attempt. For UNCERTAIN (or another non-refundable
// attempt), the previous reservation is first committed because the upstream
// may already have charged it; the new attempt is then reserved separately.
func RetryAsyncJob(ctx context.Context, jobID int64, actorID int) (*AsyncJob, bool, error) {
	var retried AsyncJob
	changed := false
	userID := 0
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job AsyncJob
		if err := lockForUpdate(tx).Where("id = ?", jobID).First(&job).Error; err != nil {
			return err
		}
		if job.ExecutionStatus != AsyncStatusFailure && job.ExecutionStatus != AsyncStatusUncertain {
			retried = job
			return loadAsyncJobTask(tx, &retried)
		}
		if err := ValidateAsyncTransition(job.ExecutionStatus, AsyncStatusQueued); err != nil {
			return err
		}

		var task Task
		if err := tx.First(&task, job.TaskID).Error; err != nil {
			return err
		}
		userID = task.UserId
		priorStatus := job.ExecutionStatus
		priorBilling := job.BillingStatus
		priorMustSettle := job.BillingStatus == AsyncBillingReserved &&
			(job.ExecutionStatus == AsyncStatusUncertain || !job.RefundEligible)
		if priorMustSettle {
			if err := recordAsyncAttemptUsageTx(tx, &task); err != nil {
				return err
			}
		}

		needsNewReservation := priorMustSettle || job.BillingStatus != AsyncBillingReserved
		billingRequestID := job.BillingRequestID
		if needsNewReservation && task.Quota > 0 {
			if task.PrivateData.BillingSource == "subscription" && task.PrivateData.SubscriptionId > 0 {
				var subscription UserSubscription
				now := time.Now().Unix()
				if err := lockForUpdate(tx).Where("id = ? AND user_id = ? AND status = ? AND end_time > ?", task.PrivateData.SubscriptionId, task.UserId, "active", now).First(&subscription).Error; err != nil {
					return fmt.Errorf("%w: active subscription unavailable", ErrAsyncRetryQuotaInsufficient)
				}
				if subscription.AmountTotal > 0 && subscription.AmountTotal-subscription.AmountUsed < int64(task.Quota) {
					return fmt.Errorf("%w: subscription quota", ErrAsyncRetryQuotaInsufficient)
				}
				subscription.AmountUsed += int64(task.Quota)
				if err := tx.Save(&subscription).Error; err != nil {
					return err
				}
				billingRequestID = fmt.Sprintf("async-retry-%d-%d", job.ID, time.Now().UnixNano())
				if err := tx.Create(&SubscriptionPreConsumeRecord{
					RequestId:          billingRequestID,
					UserId:             task.UserId,
					UserSubscriptionId: subscription.Id,
					PreConsumed:        int64(task.Quota),
					Status:             "consumed",
				}).Error; err != nil {
					return err
				}
			} else {
				result := tx.Model(&User{}).
					Where("id = ? AND status = ? AND quota >= ?", task.UserId, common.UserStatusEnabled, task.Quota).
					Update("quota", gorm.Expr("quota - ?", task.Quota))
				if result.Error != nil {
					return result.Error
				}
				if result.RowsAffected != 1 {
					return fmt.Errorf("%w: wallet quota", ErrAsyncRetryQuotaInsufficient)
				}
			}

			var token Token
			if err := lockForUpdate(tx).Where("id = ? AND user_id = ? AND status = ?", task.PrivateData.TokenId, task.UserId, common.TokenStatusEnabled).First(&token).Error; err != nil {
				return fmt.Errorf("%w: token unavailable", ErrAsyncRetryQuotaInsufficient)
			}
			if !token.UnlimitedQuota && token.RemainQuota < task.Quota {
				return fmt.Errorf("%w: token quota", ErrAsyncRetryQuotaInsufficient)
			}
			if err := tx.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]any{
				"remain_quota":  gorm.Expr("remain_quota - ?", task.Quota),
				"used_quota":    gorm.Expr("used_quota + ?", task.Quota),
				"accessed_time": time.Now().Unix(),
			}).Error; err != nil {
				return err
			}
		}

		now := time.Now().Unix()
		if err := tx.Model(&AsyncJob{}).Where("id = ? AND execution_status IN ?", job.ID, []AsyncExecutionStatus{AsyncStatusFailure, AsyncStatusUncertain}).Updates(map[string]any{
			"execution_status":   AsyncStatusQueued,
			"worker_id":          "",
			"lease_until":        0,
			"request_sent_at":    0,
			"result_payload":     nil,
			"error_phase":        "",
			"error_code":         "",
			"refund_eligible":    false,
			"billing_status":     AsyncBillingReserved,
			"billing_request_id": billingRequestID,
			"updated_at":         now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&Task{}).Where("id = ?", task.ID).Updates(map[string]any{
			"status":      TaskStatusQueued,
			"progress":    "0%",
			"start_time":  0,
			"finish_time": 0,
			"fail_reason": "",
			"data":        []byte("{}"),
			"updated_at":  now,
		}).Error; err != nil {
			return err
		}
		details := []byte(fmt.Sprintf(`{"previous_status":%q,"previous_billing_status":%q,"duplicate_risk":%t}`, priorStatus, priorBilling, priorStatus == AsyncStatusUncertain))
		if err := tx.Create(&TaskEvent{TaskID: task.ID, EventType: "manual_retry", FromStatus: string(priorStatus), ToStatus: string(AsyncStatusQueued), ActorType: "admin", ActorID: actorID, Details: details}).Error; err != nil {
			return err
		}
		if err := tx.First(&retried, job.ID).Error; err != nil {
			return err
		}
		changed = true
		return loadAsyncJobTask(tx, &retried)
	})
	if err != nil {
		return nil, false, err
	}
	if changed && userID > 0 {
		_ = InvalidateUserCache(userID)
		_ = InvalidateUserTokensCache(userID)
	}
	return &retried, changed, nil
}

func recordAsyncAttemptUsageTx(tx *gorm.DB, task *Task) error {
	if err := tx.Model(&User{}).Where("id = ?", task.UserId).Updates(map[string]any{
		"used_quota":    gorm.Expr("used_quota + ?", task.Quota),
		"request_count": gorm.Expr("request_count + 1"),
	}).Error; err != nil {
		return err
	}
	if task.Quota <= 0 {
		return nil
	}
	return tx.Model(&Channel{}).Where("id = ?", task.ChannelId).
		Update("used_quota", gorm.Expr("used_quota + ?", task.Quota)).Error
}
