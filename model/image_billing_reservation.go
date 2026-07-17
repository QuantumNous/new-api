package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

type ImageBillingReservationStatus string

const (
	ImageBillingReservationPreparing ImageBillingReservationStatus = "preparing"
	ImageBillingReservationActive    ImageBillingReservationStatus = "active"
	ImageBillingReservationRefunded  ImageBillingReservationStatus = "refunded"
)

var ErrImageBillingReservationNotPreparing = errors.New("image billing reservation is not preparing")

// ImageBillingReservation is the durable ownership record for quota deducted
// before an async image task becomes runnable. Each non-zero reserved leg is
// written in the same database transaction as its corresponding quota debit.
type ImageBillingReservation struct {
	ID                   int64                         `json:"id" gorm:"primaryKey"`
	TaskID               string                        `json:"task_id" gorm:"type:varchar(191);uniqueIndex"`
	RequestID            string                        `json:"request_id" gorm:"type:varchar(64);index"`
	UserID               int                           `json:"user_id" gorm:"index"`
	TokenID              int                           `json:"token_id" gorm:"index"`
	TokenRequired        bool                          `json:"token_required"`
	ExpectedQuota        int                           `json:"expected_quota"`
	FundingSource        string                        `json:"funding_source" gorm:"type:varchar(20)"`
	WalletReserved       int                           `json:"wallet_reserved"`
	TokenReserved        int                           `json:"token_reserved"`
	SubscriptionID       int                           `json:"subscription_id" gorm:"index"`
	SubscriptionReserved int64                         `json:"subscription_reserved"`
	Status               ImageBillingReservationStatus `json:"status" gorm:"type:varchar(20);index:idx_image_billing_reservation_due,priority:1"`
	FailureReason        string                        `json:"failure_reason" gorm:"type:text"`
	CreatedAt            int64                         `json:"created_at" gorm:"bigint"`
	UpdatedAt            int64                         `json:"updated_at" gorm:"bigint;index:idx_image_billing_reservation_due,priority:2"`
}

func (reservation *ImageBillingReservation) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if reservation.Status == "" {
		reservation.Status = ImageBillingReservationPreparing
	}
	if reservation.CreatedAt == 0 {
		reservation.CreatedAt = now
	}
	if reservation.UpdatedAt == 0 {
		reservation.UpdatedAt = now
	}
	return nil
}

// InsertPreparedImageTask persists the non-runnable task, optional webhook,
// and reservation owner in one transaction before any quota is deducted.
func InsertPreparedImageTask(task *Task, webhook *TaskWebhook, reservation *ImageBillingReservation) error {
	if task == nil || reservation == nil {
		return errors.New("prepared image task and billing reservation are required")
	}
	if task.TaskID == "" || task.Status != TaskStatusReserving {
		return errors.New("prepared image task must have a task id and RESERVING status")
	}
	if reservation.TaskID == "" {
		reservation.TaskID = task.TaskID
	}
	if reservation.TaskID != task.TaskID || reservation.UserID != task.UserId {
		return errors.New("image billing reservation identity does not match task")
	}
	if reservation.ExpectedQuota < 0 || reservation.ExpectedQuota > common.MaxQuota {
		return errors.New("image billing reservation quota is out of range")
	}
	reservation.Status = ImageBillingReservationPreparing

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(task).Error; err != nil {
			return err
		}
		if webhook != nil {
			webhook.TaskID = task.TaskID
			if err := tx.Create(webhook).Error; err != nil {
				return err
			}
		}
		return tx.Create(reservation).Error
	})
}

func GetImageBillingReservation(taskID string) (*ImageBillingReservation, error) {
	if strings.TrimSpace(taskID) == "" {
		return nil, errors.New("task id is required")
	}
	var reservation ImageBillingReservation
	if err := DB.Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
		return nil, err
	}
	return &reservation, nil
}

// ReserveImageTaskWalletQuota atomically records and applies the wallet leg.
// Redis is decremented first so concurrent nodes retain the existing direct
// reservation semantics; any database failure synchronously compensates it.
func ReserveImageTaskWalletQuota(taskID string, userID int, quota int) error {
	if strings.TrimSpace(taskID) == "" || userID <= 0 {
		return errors.New("task id and user id are required")
	}
	if quota <= 0 || quota > common.MaxQuota {
		return errors.New("wallet reservation quota is out of range")
	}

	return withFlushedBatchQuota(BatchUpdateTypeUserQuota, userID, increaseUserQuota, func() error {
		cacheDebited := false
		if common.RedisEnabled {
			if err := ensureUserQuotaCache(userID); err != nil {
				return err
			}
			if err := cacheTryDecrUserQuota(userID, int64(quota)); err != nil {
				return err
			}
			cacheDebited = true
		}

		applied, err := reserveImageTaskWalletQuotaDB(taskID, userID, quota)
		if cacheDebited && (!applied || err != nil) {
			if cacheErr := cacheIncrUserQuota(userID, int64(quota)); cacheErr != nil {
				common.SysLog("failed to compensate image wallet reservation cache: " + cacheErr.Error())
			}
		}
		return err
	})
}

func reserveImageTaskWalletQuotaDB(taskID string, userID int, quota int) (bool, error) {
	applied := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		claim := tx.Model(&ImageBillingReservation{}).
			Where(
				"task_id = ? AND user_id = ? AND status = ? AND wallet_reserved = 0 AND subscription_reserved = 0 AND (funding_source = ? OR funding_source = ?)",
				taskID,
				userID,
				ImageBillingReservationPreparing,
				"",
				"wallet",
			).
			Updates(map[string]any{
				"funding_source":  "wallet",
				"wallet_reserved": quota,
				"updated_at":      now,
			})
		if claim.Error != nil {
			return claim.Error
		}
		if claim.RowsAffected == 0 {
			var current ImageBillingReservation
			if err := tx.Where("task_id = ?", taskID).First(&current).Error; err != nil {
				return err
			}
			if current.Status != ImageBillingReservationPreparing {
				return ErrImageBillingReservationNotPreparing
			}
			if current.UserID != userID || current.WalletReserved != quota || current.FundingSource != "wallet" {
				return errors.New("conflicting image wallet reservation")
			}
			return nil
		}

		debit := tx.Model(&User{}).
			Where("id = ? AND quota >= ?", userID, quota).
			Update("quota", gorm.Expr("quota - ?", quota))
		if debit.Error != nil {
			return debit.Error
		}
		if debit.RowsAffected != 1 {
			return errors.New("user quota is not enough")
		}
		applied = true
		return nil
	})
	return applied, err
}

// ReserveImageTaskTokenQuota atomically records and applies the token leg.
func ReserveImageTaskTokenQuota(taskID string, tokenID int, key string, quota int) error {
	if strings.TrimSpace(taskID) == "" || tokenID <= 0 || key == "" {
		return errors.New("task id, token id, and token key are required")
	}
	if quota <= 0 || quota > common.MaxQuota {
		return errors.New("token reservation quota is out of range")
	}

	return withTokenQuotaCacheLock(key, func() error {
		return withFlushedBatchQuota(BatchUpdateTypeTokenQuota, tokenID, increaseTokenQuota, func() error {
			cacheDebited := false
			if common.RedisEnabled {
				if err := ensureTokenQuotaCache(tokenID, key); err != nil {
					return err
				}
				if err := cacheTryDecrTokenQuota(key, int64(quota)); err != nil {
					return err
				}
				cacheDebited = true
			}

			applied, err := reserveImageTaskTokenQuotaDB(taskID, tokenID, quota)
			if cacheDebited && (!applied || err != nil) {
				if cacheErr := cacheIncrTokenQuota(key, int64(quota)); cacheErr != nil {
					common.SysLog("failed to compensate image token reservation cache: " + cacheErr.Error())
				}
			}
			return err
		})
	})
}

func reserveImageTaskTokenQuotaDB(taskID string, tokenID int, quota int) (bool, error) {
	applied := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		claim := tx.Model(&ImageBillingReservation{}).
			Where("task_id = ? AND token_id = ? AND status = ? AND token_reserved = 0", taskID, tokenID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"token_reserved": quota,
				"token_required": true,
				"updated_at":     now,
			})
		if claim.Error != nil {
			return claim.Error
		}
		if claim.RowsAffected == 0 {
			var current ImageBillingReservation
			if err := tx.Where("task_id = ?", taskID).First(&current).Error; err != nil {
				return err
			}
			if current.Status != ImageBillingReservationPreparing {
				return ErrImageBillingReservationNotPreparing
			}
			if current.TokenID != tokenID || current.TokenReserved != quota {
				return errors.New("conflicting image token reservation")
			}
			return nil
		}

		debit := tx.Model(&Token{}).
			Where("id = ? AND (remain_quota >= ? OR unlimited_quota = ?)", tokenID, quota, true).
			Updates(map[string]any{
				"remain_quota":  gorm.Expr("remain_quota - ?", quota),
				"used_quota":    gorm.Expr("used_quota + ?", quota),
				"accessed_time": common.GetTimestamp(),
			})
		if debit.Error != nil {
			return debit.Error
		}
		if debit.RowsAffected != 1 {
			return errors.New("token quota is not enough")
		}
		applied = true
		return nil
	})
	return applied, err
}

// PreConsumeImageTaskSubscription writes the subscription pre-consume record
// and the reservation leg in one transaction.
func PreConsumeImageTaskSubscription(taskID string, requestID string, userID int, modelName string, quotaType int, amount int64) (*SubscriptionPreConsumeResult, error) {
	if strings.TrimSpace(taskID) == "" || strings.TrimSpace(requestID) == "" || userID <= 0 {
		return nil, errors.New("task id, request id, and user id are required")
	}
	if amount <= 0 || amount > int64(common.MaxQuota) {
		return nil, errors.New("subscription reservation quota is out of range")
	}

	now := GetDBTimestamp()
	var result *SubscriptionPreConsumeResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.UserID != userID || reservation.RequestID != requestID {
			return errors.New("image subscription reservation identity mismatch")
		}
		if reservation.WalletReserved > 0 || (reservation.FundingSource != "" && reservation.FundingSource != "subscription") {
			return errors.New("image billing reservation already uses wallet funding")
		}
		if reservation.SubscriptionReserved > 0 {
			if reservation.SubscriptionReserved != amount || reservation.FundingSource != "subscription" {
				return errors.New("conflicting image subscription reservation")
			}
			var record SubscriptionPreConsumeRecord
			if err := tx.Where("request_id = ?", requestID).First(&record).Error; err != nil {
				return err
			}
			var subscription UserSubscription
			if err := tx.Where("id = ?", record.UserSubscriptionId).First(&subscription).Error; err != nil {
				return err
			}
			result = &SubscriptionPreConsumeResult{
				UserSubscriptionId: subscription.Id,
				PreConsumed:        record.PreConsumed,
				AmountTotal:        subscription.AmountTotal,
				AmountUsedBefore:   subscription.AmountUsed,
				AmountUsedAfter:    subscription.AmountUsed,
			}
			return nil
		}

		var err error
		result, err = preConsumeUserSubscriptionTx(tx, requestID, userID, modelName, quotaType, amount, now)
		if err != nil {
			return err
		}
		update := tx.Model(&ImageBillingReservation{}).
			Where("id = ? AND status = ? AND subscription_reserved = 0", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"funding_source":        "subscription",
				"subscription_id":       result.UserSubscriptionId,
				"subscription_reserved": result.PreConsumed,
				"updated_at":            common.GetTimestamp(),
			})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return errors.New("image subscription reservation claim lost")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// RefundImageTaskSubscriptionQuota atomically rolls back the subscription
// record and clears the preparing ledger leg.
func RefundImageTaskSubscriptionQuota(taskID string, requestID string) error {
	if strings.TrimSpace(taskID) == "" || strings.TrimSpace(requestID) == "" {
		return errors.New("task id and request id are required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			if reservation.Status == ImageBillingReservationRefunded {
				return nil
			}
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.RequestID != requestID {
			return errors.New("image subscription reservation request mismatch")
		}
		if reservation.SubscriptionReserved == 0 {
			return nil
		}
		if err := refundSubscriptionPreConsumeTx(tx, requestID); err != nil {
			return err
		}
		return tx.Model(&ImageBillingReservation{}).
			Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"subscription_reserved": 0,
				"subscription_id":       0,
				"updated_at":            common.GetTimestamp(),
			}).Error
	})
}

// RefundImageTaskWalletQuota rolls back only the preparing wallet leg. It is
// safe to call repeatedly; once the leg is zero no further credit is applied.
func RefundImageTaskWalletQuota(taskID string, userID int) error {
	if strings.TrimSpace(taskID) == "" || userID <= 0 {
		return errors.New("task id and user id are required")
	}
	return withFlushedBatchQuota(BatchUpdateTypeUserQuota, userID, increaseUserQuota, func() error {
		refunded, amount, err := refundImageTaskWalletQuotaDB(taskID, userID)
		if err != nil {
			return err
		}
		if refunded && common.RedisEnabled {
			if cacheErr := cacheIncrUserQuota(userID, int64(amount)); cacheErr != nil {
				common.SysLog("failed to update image wallet refund cache: " + cacheErr.Error())
			}
		}
		return nil
	})
}

func refundImageTaskWalletQuotaDB(taskID string, userID int) (bool, int, error) {
	refunded := false
	amount := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			if reservation.Status == ImageBillingReservationRefunded {
				return nil
			}
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.UserID != userID {
			return errors.New("image wallet reservation user mismatch")
		}
		amount = reservation.WalletReserved
		if amount == 0 {
			return nil
		}
		walletRefund := tx.Unscoped().Model(&User{}).Where("id = ?", userID).
			Update("quota", gorm.Expr("quota + ?", amount))
		if walletRefund.Error != nil {
			return walletRefund.Error
		}
		if walletRefund.RowsAffected != 1 {
			return errors.New("image wallet reservation refund lost")
		}
		if err := tx.Model(&ImageBillingReservation{}).Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{"wallet_reserved": 0, "updated_at": common.GetTimestamp()}).Error; err != nil {
			return err
		}
		refunded = true
		return nil
	})
	return refunded, amount, err
}

// RefundImageTaskTokenQuota rolls back only the preparing token leg.
func RefundImageTaskTokenQuota(taskID string, tokenID int, key string) error {
	if strings.TrimSpace(taskID) == "" || tokenID <= 0 || key == "" {
		return errors.New("task id, token id, and token key are required")
	}
	return withTokenQuotaCacheLock(key, func() error {
		return withFlushedBatchQuota(BatchUpdateTypeTokenQuota, tokenID, increaseTokenQuota, func() error {
			refunded, amount, err := refundImageTaskTokenQuotaDB(taskID, tokenID)
			if err != nil {
				return err
			}
			if refunded && common.RedisEnabled {
				if cacheErr := cacheIncrTokenQuota(key, int64(amount)); cacheErr != nil {
					common.SysLog("failed to update image token refund cache: " + cacheErr.Error())
				}
			}
			return nil
		})
	})
}

func refundImageTaskTokenQuotaDB(taskID string, tokenID int) (bool, int, error) {
	refunded := false
	amount := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status != ImageBillingReservationPreparing {
			if reservation.Status == ImageBillingReservationRefunded {
				return nil
			}
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.TokenID != tokenID {
			return errors.New("image token reservation token mismatch")
		}
		amount = reservation.TokenReserved
		if amount == 0 {
			return nil
		}
		tokenRefund := tx.Unscoped().Model(&Token{}).Where("id = ?", tokenID).Updates(map[string]any{
			"remain_quota":  gorm.Expr("remain_quota + ?", amount),
			"used_quota":    gorm.Expr("used_quota - ?", amount),
			"accessed_time": common.GetTimestamp(),
		})
		if tokenRefund.Error != nil {
			return tokenRefund.Error
		}
		if tokenRefund.RowsAffected != 1 {
			return errors.New("image token reservation refund lost")
		}
		if err := tx.Model(&ImageBillingReservation{}).Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{"token_reserved": 0, "updated_at": common.GetTimestamp()}).Error; err != nil {
			return err
		}
		refunded = true
		return nil
	})
	return refunded, amount, err
}

// ActivatePreparedImageTask transfers ownership of all recorded reservation
// legs to the runnable task in the same transaction.
func ActivatePreparedImageTask(task *Task) (bool, error) {
	if task == nil || task.ID == 0 || task.TaskID == "" {
		return false, errors.New("persisted prepared image task is required")
	}
	activated := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", task.TaskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status == ImageBillingReservationActive {
			return nil
		}
		if reservation.Status != ImageBillingReservationPreparing {
			return ErrImageBillingReservationNotPreparing
		}
		if reservation.UserID != task.UserId {
			return errors.New("activated image task does not match billing reservation")
		}
		if task.Quota != reservation.ExpectedQuota {
			canUpgradeZeroSubscription := reservation.ExpectedQuota == 0 &&
				task.Quota == 1 &&
				reservation.FundingSource == "subscription" &&
				reservation.SubscriptionReserved == 1
			if !canUpgradeZeroSubscription {
				return errors.New("activated image task does not match billing reservation")
			}
			reservation.ExpectedQuota = task.Quota
		}
		if task.Quota > 0 && reservation.FundingSource != "wallet" && reservation.FundingSource != "subscription" {
			return errors.New("image funding reservation is incomplete")
		}
		if reservation.FundingSource == "wallet" && reservation.WalletReserved != task.Quota {
			return errors.New("image wallet reservation is incomplete")
		}
		if reservation.FundingSource == "subscription" && reservation.SubscriptionReserved != int64(task.Quota) {
			return errors.New("image subscription reservation is incomplete")
		}
		if reservation.TokenRequired && reservation.TokenReserved != task.Quota {
			return errors.New("image token reservation is incomplete")
		}

		candidate := *task
		candidate.Status = TaskStatusNotStart
		candidate.Progress = "0%"
		candidate.PrivateData.BillingSource = reservation.FundingSource
		candidate.PrivateData.SubscriptionId = reservation.SubscriptionID
		candidate.PrivateData.TokenId = reservation.TokenID
		candidate.PrivateData.TokenPreConsumed = reservation.TokenReserved
		candidate.PrivateData.TokenBillingEnabled = reservation.TokenRequired
		candidate.UpdatedAt = common.GetTimestamp()
		update := tx.Model(&Task{}).
			Where("id = ? AND task_id = ? AND platform = ? AND status = ?", task.ID, task.TaskID, constant.TaskPlatformOpenAIImage, TaskStatusReserving).
			Select("*").
			Updates(&candidate)
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return errors.New("prepared image task activation lost")
		}
		ledger := tx.Model(&ImageBillingReservation{}).
			Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"status":         ImageBillingReservationActive,
				"expected_quota": reservation.ExpectedQuota,
				"updated_at":     candidate.UpdatedAt,
			})
		if ledger.Error != nil {
			return ledger.Error
		}
		if ledger.RowsAffected != 1 {
			return errors.New("image billing reservation activation lost")
		}
		*task = candidate
		activated = true
		return nil
	})
	return activated, err
}

// RecoverStaleImageBillingReservations refunds stale pre-activation tasks.
// All database quota legs and the terminal task transition commit atomically;
// repeated recovery passes are no-ops after the ledger becomes refunded.
func RecoverStaleImageBillingReservations(cutoff int64, limit int, reason string) (int, error) {
	if cutoff <= 0 {
		return 0, errors.New("reservation cutoff is required")
	}
	if limit <= 0 {
		limit = 1
	}
	var reservations []ImageBillingReservation
	if err := DB.Where("status = ? AND updated_at <= ?", ImageBillingReservationPreparing, cutoff).
		Order("id asc").
		Limit(limit).
		Find(&reservations).Error; err != nil {
		return 0, err
	}

	recovered := 0
	var firstErr error
	for i := range reservations {
		applied, err := RefundImageBillingReservation(reservations[i].TaskID, reason)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("refund stale image billing reservation %s: %w", reservations[i].TaskID, err)
			}
			continue
		}
		if applied {
			recovered++
		}
	}
	return recovered, firstErr
}

// RefundImageBillingReservation atomically refunds every recorded preparing
// leg, including the idempotent subscription pre-consume record.
func RefundImageBillingReservation(taskID string, reason string) (bool, error) {
	if strings.TrimSpace(taskID) == "" {
		return false, errors.New("task id is required")
	}
	reservation, err := GetImageBillingReservation(taskID)
	if err != nil {
		return false, err
	}

	tokenKey := ""
	if reservation.TokenID > 0 {
		var token Token
		if queryErr := DB.Unscoped().Select("id", "key").Where("id = ?", reservation.TokenID).First(&token).Error; queryErr == nil {
			tokenKey = token.Key
		} else if !errors.Is(queryErr, gorm.ErrRecordNotFound) {
			return false, queryErr
		}
	}

	applied := false
	walletRefunded := 0
	tokenRefunded := 0
	refund := func() error {
		return withFlushedBatchQuota(BatchUpdateTypeUserQuota, reservation.UserID, increaseUserQuota, func() error {
			return withFlushedBatchQuota(BatchUpdateTypeTokenQuota, reservation.TokenID, increaseTokenQuota, func() error {
				var txErr error
				applied, walletRefunded, tokenRefunded, txErr = refundImageBillingReservationDB(taskID, reason)
				if txErr != nil || !applied || !common.RedisEnabled {
					return txErr
				}
				if walletRefunded > 0 {
					if cacheErr := cacheIncrUserQuota(reservation.UserID, int64(walletRefunded)); cacheErr != nil {
						common.SysLog("failed to update recovered image wallet cache: " + cacheErr.Error())
						if invalidateErr := invalidateUserCache(reservation.UserID); invalidateErr != nil {
							common.SysLog("failed to invalidate recovered image wallet cache: " + invalidateErr.Error())
						}
					}
				}
				if tokenRefunded > 0 && tokenKey != "" {
					if cacheErr := cacheIncrTokenQuota(tokenKey, int64(tokenRefunded)); cacheErr != nil {
						common.SysLog("failed to update recovered image token cache: " + cacheErr.Error())
						if invalidateErr := cacheDeleteToken(tokenKey); invalidateErr != nil {
							common.SysLog("failed to invalidate recovered image token cache: " + invalidateErr.Error())
						}
					}
				}
				return nil
			})
		})
	}
	if tokenKey != "" {
		err = withTokenQuotaCacheLock(tokenKey, refund)
	} else {
		err = refund()
	}
	if err != nil || !applied {
		return applied, err
	}
	return true, nil
}

func refundImageBillingReservationDB(taskID string, reason string) (bool, int, int, error) {
	applied := false
	walletRefunded := 0
	tokenRefunded := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var reservation ImageBillingReservation
		if err := lockForUpdate(tx).Where("task_id = ?", taskID).First(&reservation).Error; err != nil {
			return err
		}
		if reservation.Status == ImageBillingReservationRefunded {
			return nil
		}
		if reservation.Status != ImageBillingReservationPreparing {
			return nil
		}

		if reservation.SubscriptionReserved > 0 {
			if err := refundSubscriptionPreConsumeTx(tx, reservation.RequestID); err != nil {
				return err
			}
		}
		if reservation.WalletReserved > 0 {
			walletRefund := tx.Unscoped().Model(&User{}).Where("id = ?", reservation.UserID).
				Update("quota", gorm.Expr("quota + ?", reservation.WalletReserved))
			if walletRefund.Error != nil {
				return walletRefund.Error
			}
			if walletRefund.RowsAffected != 1 {
				return errors.New("image wallet reservation refund lost")
			}
			walletRefunded = reservation.WalletReserved
		}
		if reservation.TokenReserved > 0 {
			tokenRefund := tx.Unscoped().Model(&Token{}).Where("id = ?", reservation.TokenID).Updates(map[string]any{
				"remain_quota":  gorm.Expr("remain_quota + ?", reservation.TokenReserved),
				"used_quota":    gorm.Expr("used_quota - ?", reservation.TokenReserved),
				"accessed_time": common.GetTimestamp(),
			})
			if tokenRefund.Error != nil {
				return tokenRefund.Error
			}
			if tokenRefund.RowsAffected != 1 {
				return errors.New("image token reservation refund lost")
			}
			tokenRefunded = reservation.TokenReserved
		}

		now := common.GetTimestamp()
		if len(reason) > 2000 {
			reason = reason[:2000]
		}
		ledger := tx.Model(&ImageBillingReservation{}).
			Where("id = ? AND status = ?", reservation.ID, ImageBillingReservationPreparing).
			Updates(map[string]any{
				"status":                ImageBillingReservationRefunded,
				"wallet_reserved":       0,
				"token_reserved":        0,
				"subscription_reserved": 0,
				"failure_reason":        reason,
				"updated_at":            now,
			})
		if ledger.Error != nil {
			return ledger.Error
		}
		if ledger.RowsAffected != 1 {
			return errors.New("image billing reservation refund lost")
		}
		if err := tx.Model(&Task{}).
			Where("task_id = ? AND platform = ? AND status = ?", taskID, constant.TaskPlatformOpenAIImage, TaskStatusReserving).
			Updates(map[string]any{
				"status":      TaskStatusFailure,
				"progress":    "100%",
				"fail_reason": reason,
				"finish_time": now,
				"updated_at":  now,
			}).Error; err != nil {
			return err
		}
		applied = true
		return nil
	})
	return applied, walletRefunded, tokenRefunded, err
}

func HasStaleImageBillingReservations(cutoff int64) bool {
	if cutoff <= 0 {
		return false
	}
	var id int64
	err := DB.Model(&ImageBillingReservation{}).
		Where("status = ? AND updated_at <= ?", ImageBillingReservationPreparing, cutoff).
		Limit(1).
		Pluck("id", &id).Error
	return err == nil && id != 0
}
