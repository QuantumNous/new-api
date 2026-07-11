package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	BillingHoldStatusPending   = "pending"
	BillingHoldStatusRefunded  = "refunded"
	BillingHoldStatusConfirmed = "confirmed"
)

// BillingHold 记录 HoldRefund 挂起的预扣费，供超时对账任务处理。
type BillingHold struct {
	Id                int    `json:"id" gorm:"primaryKey"`
	RequestId         string `json:"request_id" gorm:"type:varchar(64);uniqueIndex;not null"`
	UserId            int    `json:"user_id" gorm:"index;not null"`
	TokenId           int    `json:"token_id" gorm:"not null;default:0"`
	TokenName         string `json:"token_name" gorm:"type:varchar(191);default:''"`
	ChannelId         int    `json:"channel_id" gorm:"not null;default:0"`
	ModelName         string `json:"model_name" gorm:"type:varchar(191);default:''"`
	Group             string `json:"group" gorm:"type:varchar(64);default:''"`
	PreConsumedQuota  int    `json:"pre_consumed_quota" gorm:"not null;default:0"`
	ReceivedResponses int    `json:"received_responses" gorm:"not null;default:0"`
	UpstreamTaskId    string `json:"upstream_task_id" gorm:"type:varchar(128);default:''"`
	ErrorStatus       int    `json:"error_status" gorm:"not null;default:0"`
	ErrorCode         string `json:"error_code" gorm:"type:varchar(64);default:''"`
	ErrorMessage      string `json:"error_message" gorm:"type:text"`
	Status            string `json:"status" gorm:"type:varchar(32);index;not null;default:'pending'"`
	VerifyDetail      string `json:"verify_detail" gorm:"type:text"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index"`
	ReconcileAfter    int64  `json:"reconcile_after" gorm:"bigint;index"`
	ResolvedAt        int64  `json:"resolved_at" gorm:"bigint;default:0"`
}

func CreateBillingHold(hold *BillingHold) error {
	if hold == nil {
		return errors.New("billing hold is nil")
	}
	if hold.RequestId == "" {
		return errors.New("billing hold request_id is empty")
	}
	if hold.CreatedAt == 0 {
		hold.CreatedAt = common.GetTimestamp()
	}
	if hold.Status == "" {
		hold.Status = BillingHoldStatusPending
	}
	return DB.Create(hold).Error
}

func GetBillingHoldByRequestId(requestId string) (*BillingHold, error) {
	if requestId == "" {
		return nil, errors.New("request_id is empty")
	}
	hold := &BillingHold{}
	err := DB.Where("request_id = ?", requestId).First(hold).Error
	if err != nil {
		return nil, err
	}
	return hold, nil
}

func GetBillingHoldById(id int) (*BillingHold, error) {
	hold := &BillingHold{}
	err := DB.First(hold, id).Error
	if err != nil {
		return nil, err
	}
	return hold, nil
}

func ListDueBillingHolds(now int64, limit int) ([]*BillingHold, error) {
	if limit <= 0 {
		limit = 100
	}
	var holds []*BillingHold
	// A process can die after claiming a hold. Reclaim processing rows whose
	// lease (stored in resolved_at while processing) expired five minutes ago.
	err := DB.Where("(status = ? AND reconcile_after <= ?) OR (status = ? AND resolved_at > 0 AND resolved_at <= ?)",
		BillingHoldStatusPending, now, "processing", now-300).
		Order("reconcile_after ASC").
		Limit(limit).
		Find(&holds).Error
	return holds, err
}

func MarkBillingHoldResolved(id int, status, verifyDetail string) error {
	if status == "" {
		return errors.New("status is empty")
	}
	return DB.Model(&BillingHold{}).
		Where("id = ? AND status IN ?", id, []string{BillingHoldStatusPending, "processing"}).
		Updates(map[string]interface{}{
			"status":        status,
			"verify_detail": verifyDetail,
			"resolved_at":   common.GetTimestamp(),
		}).Error
}

// ResolveBillingHoldRefund applies the wallet/token refund and resolves the
// claimed hold atomically. A crash can no longer leave money refunded while the
// hold remains "processing" and is later refunded again.
func ResolveBillingHoldRefund(hold *BillingHold, hasConsume bool, verifyDetail, tokenKey string) error {
	if hold == nil || hold.Id <= 0 || hold.PreConsumedQuota <= 0 {
		return errors.New("invalid billing hold refund")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current BillingHold
		if err := tx.Where("id = ? AND status = ?", hold.Id, "processing").First(&current).Error; err != nil {
			return err
		}
		quota := current.PreConsumedQuota
		if res := tx.Model(&User{}).Where("id = ?", current.UserId).
			Update("quota", gorm.Expr("quota + ?", quota)); res.Error != nil || res.RowsAffected != 1 {
			if res.Error != nil {
				return res.Error
			}
			return fmt.Errorf("billing hold refund user %d not found", current.UserId)
		}
		if hasConsume {
			if err := tx.Model(&User{}).Where("id = ?", current.UserId).
				Update("used_quota", gorm.Expr("CASE WHEN used_quota > ? THEN used_quota - ? ELSE 0 END", quota, quota)).Error; err != nil {
				return err
			}
			if current.ChannelId > 0 {
				if err := tx.Model(&Channel{}).Where("id = ?", current.ChannelId).
					Update("used_quota", gorm.Expr("used_quota - ?", quota)).Error; err != nil {
					return err
				}
			}
		}
		if current.TokenId > 0 {
			if res := tx.Model(&Token{}).Where("id = ?", current.TokenId).Updates(map[string]interface{}{
				"remain_quota":  gorm.Expr("remain_quota + ?", quota),
				"used_quota":    gorm.Expr("used_quota - ?", quota),
				"accessed_time": common.GetTimestamp(),
			}); res.Error != nil || res.RowsAffected != 1 {
				if res.Error != nil {
					return res.Error
				}
				return fmt.Errorf("billing hold refund token %d not found", current.TokenId)
			}
		}
		return tx.Model(&BillingHold{}).Where("id = ? AND status = ?", current.Id, "processing").Updates(map[string]interface{}{
			"status":        BillingHoldStatusRefunded,
			"verify_detail": verifyDetail,
			"resolved_at":   common.GetTimestamp(),
		}).Error
	})
	if err != nil {
		return err
	}
	if common.RedisEnabled {
		gopool.Go(func() {
			if err := cacheIncrUserQuota(hold.UserId, int64(hold.PreConsumedQuota)); err != nil {
				common.SysLog("failed to update billing hold wallet refund cache: " + err.Error())
			}
			if hold.TokenId > 0 && tokenKey != "" {
				if err := cacheIncrTokenQuota(tokenKey, int64(hold.PreConsumedQuota)); err != nil {
					common.SysLog("failed to update billing hold token refund cache: " + err.Error())
				}
			}
		})
	}
	return nil
}

// ResolveBillingHoldConfirm records the derived counters and resolves the hold
// in one transaction. Wallet/token quota was already deducted at pre-consume.
func ResolveBillingHoldConfirm(hold *BillingHold, hasConsume bool, verifyDetail string) error {
	if hold == nil || hold.Id <= 0 || hold.PreConsumedQuota <= 0 {
		return errors.New("invalid billing hold confirmation")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var current BillingHold
		if err := tx.Where("id = ? AND status = ?", hold.Id, "processing").First(&current).Error; err != nil {
			return err
		}
		if !hasConsume {
			if err := tx.Model(&User{}).Where("id = ?", current.UserId).Updates(map[string]interface{}{
				"used_quota":    gorm.Expr("used_quota + ?", current.PreConsumedQuota),
				"request_count": gorm.Expr("request_count + 1"),
			}).Error; err != nil {
				return err
			}
			if current.ChannelId > 0 {
				if err := tx.Model(&Channel{}).Where("id = ?", current.ChannelId).
					Update("used_quota", gorm.Expr("used_quota + ?", current.PreConsumedQuota)).Error; err != nil {
					return err
				}
			}
		}
		return tx.Model(&BillingHold{}).Where("id = ? AND status = ?", current.Id, "processing").Updates(map[string]interface{}{
			"status":        BillingHoldStatusConfirmed,
			"verify_detail": verifyDetail,
			"resolved_at":   common.GetTimestamp(),
		}).Error
	})
}

// BillingHoldContextPatch carries fields learned after the hold was first created.
type BillingHoldContextPatch struct {
	ChannelId      int
	UpstreamTaskId string
	ErrorStatus    int
	ErrorCode      string
	ErrorMessage   string
}

// UpdateBillingHoldContext merges later relay context (final channel, task_id, error).
func UpdateBillingHoldContext(id int, patch BillingHoldContextPatch) error {
	if id <= 0 {
		return errors.New("invalid billing hold id")
	}
	updates := map[string]interface{}{}
	if patch.ChannelId > 0 {
		updates["channel_id"] = patch.ChannelId
	}
	if strings.TrimSpace(patch.UpstreamTaskId) != "" {
		updates["upstream_task_id"] = strings.TrimSpace(patch.UpstreamTaskId)
	}
	if patch.ErrorStatus > 0 {
		updates["error_status"] = patch.ErrorStatus
	}
	if strings.TrimSpace(patch.ErrorCode) != "" {
		updates["error_code"] = strings.TrimSpace(patch.ErrorCode)
	}
	if strings.TrimSpace(patch.ErrorMessage) != "" {
		updates["error_message"] = patch.ErrorMessage
	}
	if len(updates) == 0 {
		return nil
	}
	return DB.Model(&BillingHold{}).
		Where("id = ? AND status IN ?", id, []string{BillingHoldStatusPending, "processing"}).
		Updates(updates).Error
}

func ClaimBillingHold(id int) (bool, error) {
	res := DB.Model(&BillingHold{}).
		Where("id = ? AND (status = ? OR (status = ? AND resolved_at > 0 AND resolved_at <= ?))",
			id, BillingHoldStatusPending, "processing", common.GetTimestamp()-300).
		Updates(map[string]interface{}{
			"status":      "processing",
			"resolved_at": common.GetTimestamp(), // processing lease timestamp
		})
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

func ResetBillingHoldProcessing(id int) error {
	return DB.Model(&BillingHold{}).
		Where("id = ? AND status = ?", id, "processing").
		Updates(map[string]interface{}{"status": BillingHoldStatusPending, "resolved_at": 0}).Error
}

// SumUserOrphanPreconsumeGap is intentionally disabled. A user's funded quota
// can come from top-ups, redemption codes, check-ins, referrals, subscriptions,
// reseller adjustments, refunds, and admin operations. Treating top-ups as the
// complete ledger can manufacture a false "orphan" charge.
//
// Deprecated: use the durable accounting reconciliation pipeline.
func SumUserOrphanPreconsumeGap(userId int) (gap int, err error) {
	return 0, errors.New("unsafe orphan preconsume inference is disabled; reconcile against the complete funding and transaction ledger")
}

// ConfirmOrphanPreconsumeGap is intentionally disabled because a balance gap
// alone cannot distinguish an unrefunded pre-consume from a missing charge.
// Automatically converting that gap into consumption can charge users twice.
//
// Deprecated: resolve a persisted reconciliation case with an explicit refund
// or charge decision and an idempotency key.
func ConfirmOrphanPreconsumeGap(userId int, quota int, content string) error {
	return errors.New("automatic orphan preconsume confirmation is disabled; classify the discrepancy before changing user funds")
}
