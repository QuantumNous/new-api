package model

import (
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const TaskBillingSettlementCleanupDelaySeconds int64 = 24 * 60 * 60

// TaskBillingSettlement records the target-side work that remains after the
// terminal task transition and main-database quota adjustment commit together.
type TaskBillingSettlement struct {
	ID              int64 `gorm:"primaryKey"`
	TaskRecordID    int64 `gorm:"uniqueIndex;not null"`
	UserID          int
	ChannelID       int
	TokenID         int
	TargetQuota     int
	QuotaDelta      int
	WindowDelta     int64
	LogType         int
	LogQuota        int
	LogContent      string
	LogModelName    string
	LogGroup        string
	LogOther        string `gorm:"type:text"`
	CacheDelivered  bool   `gorm:"index;not null;default:false"`
	WindowDelivered bool   `gorm:"index;not null;default:false"`
	LogDelivered    bool   `gorm:"index;not null;default:false"`
	CreatedAt       int64
	UpdatedAt       int64
}

// TaskBillingLogDelivery is stored in LOG_DB. Its primary key makes inserting
// the matching billing log idempotent even when delivery is retried by another
// node after a crash.
type TaskBillingLogDelivery struct {
	SettlementID int64 `gorm:"primaryKey;autoIncrement:false"`
	CreatedAt    int64
}

type TaskBillingTransition struct {
	TargetQuota  int
	Reason       string
	ModelName    string
	LogOtherJSON string
}

// TransitionWithBilling atomically wins the terminal status CAS, applies all
// main-DB quota effects, and records the remaining cache/log delivery intent.
func (t *Task) TransitionWithBilling(fromStatus TaskStatus, input TaskBillingTransition) (bool, int64, error) {
	if input.TargetQuota < 0 {
		return false, 0, errors.New("task billing target quota cannot be negative")
	}

	preConsumedQuota := t.Quota
	quotaDelta := input.TargetQuota - preConsumedQuota
	var settlementID int64
	var won bool

	err := DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(t).Where("status = ?", fromStatus).Select("*").Updates(t)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		won = true

		if quotaDelta != 0 {
			windowDelta, err := applyTaskBillingMainDB(tx, t, quotaDelta)
			if err != nil {
				return err
			}
			if err := tx.Model(&Task{}).Where("id = ?", t.ID).Update("quota", input.TargetQuota).Error; err != nil {
				return err
			}

			logType := LogTypeRefund
			logQuota := -quotaDelta
			logContent := input.Reason
			if quotaDelta > 0 {
				logType = LogTypeConsume
				logQuota = quotaDelta
			} else if input.TargetQuota == 0 {
				logContent = ""
			}
			now := common.GetTimestamp()
			settlement := TaskBillingSettlement{
				TaskRecordID: t.ID,
				UserID:       t.UserId,
				ChannelID:    t.ChannelId,
				TokenID:      t.PrivateData.TokenId,
				TargetQuota:  input.TargetQuota,
				QuotaDelta:   quotaDelta,
				WindowDelta:  windowDelta,
				LogType:      logType,
				LogQuota:     logQuota,
				LogContent:   logContent,
				LogModelName: input.ModelName,
				LogGroup:     t.Group,
				LogOther:     input.LogOtherJSON,
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			if err := tx.Create(&settlement).Error; err != nil {
				return err
			}
			settlementID = settlement.ID
		}
		return nil
	})
	if err != nil {
		return false, 0, err
	}
	if !won {
		return false, 0, nil
	}
	if quotaDelta != 0 {
		t.Quota = input.TargetQuota
	}
	return true, settlementID, nil
}

func applyTaskBillingMainDB(tx *gorm.DB, task *Task, quotaDelta int) (int64, error) {
	var windowDelta int64
	if task.PrivateData.BillingSource == "subscription" && task.PrivateData.SubscriptionId > 0 {
		currentQuota := int64(task.Quota)
		targetQuota := currentQuota + int64(quotaDelta)
		weightedDelta := taskBillingWeightedQuota(task, targetQuota) - taskBillingWeightedQuota(task, currentQuota)
		windowDelta = weightedDelta
		if weightedDelta != 0 {
			query := tx.Model(&UserSubscription{}).Where("id = ?", task.PrivateData.SubscriptionId)
			var result *gorm.DB
			if weightedDelta > 0 {
				result = query.
					Where("amount_total <= 0 OR amount_used <= amount_total - ?", weightedDelta).
					Update("amount_used", gorm.Expr("amount_used + ?", weightedDelta))
			} else {
				refund := -weightedDelta
				result = query.Update("amount_used", gorm.Expr(
					"CASE WHEN amount_used < ? THEN 0 ELSE amount_used - ? END", refund, refund,
				))
			}
			if result.Error != nil {
				return 0, result.Error
			}
			if result.RowsAffected == 0 {
				if weightedDelta < 0 {
					var count int64
					if err := tx.Model(&UserSubscription{}).
						Where("id = ?", task.PrivateData.SubscriptionId).Count(&count).Error; err != nil {
						return 0, err
					}
					if count != 1 {
						return 0, fmt.Errorf("subscription settlement rejected, subscription_id=%d delta=%d", task.PrivateData.SubscriptionId, weightedDelta)
					}
				} else {
					return 0, fmt.Errorf("subscription settlement rejected, subscription_id=%d delta=%d", task.PrivateData.SubscriptionId, weightedDelta)
				}
			}
		}
	} else if quotaDelta > 0 {
		if err := tx.Model(&User{}).Where("id = ?", task.UserId).Update("quota", gorm.Expr("quota - ?", quotaDelta)).Error; err != nil {
			return 0, err
		}
	} else {
		if err := tx.Model(&User{}).Where("id = ?", task.UserId).Update("quota", gorm.Expr("quota + ?", -quotaDelta)).Error; err != nil {
			return 0, err
		}
	}

	if task.PrivateData.TokenId > 0 {
		updates := map[string]any{
			"remain_quota":  gorm.Expr("remain_quota - ?", quotaDelta),
			"used_quota":    gorm.Expr("used_quota + ?", quotaDelta),
			"accessed_time": common.GetTimestamp(),
		}
		if err := tx.Model(&Token{}).Where("id = ?", task.PrivateData.TokenId).Updates(updates).Error; err != nil {
			return 0, err
		}
	}

	if quotaDelta > 0 {
		if err := tx.Model(&User{}).Where("id = ?", task.UserId).Updates(map[string]any{
			"used_quota":    gorm.Expr("used_quota + ?", quotaDelta),
			"request_count": gorm.Expr("request_count + ?", 1),
		}).Error; err != nil {
			return 0, err
		}
		if err := tx.Model(&Channel{}).Where("id = ?", task.ChannelId).Update("used_quota", gorm.Expr("used_quota + ?", quotaDelta)).Error; err != nil {
			return 0, err
		}
	}
	return windowDelta, nil
}

func taskBillingWeightedQuota(task *Task, quota int64) int64 {
	weight := 1.0
	if bc := task.PrivateData.BillingContext; bc != nil && bc.SubscriptionWeight > 0 {
		weight = bc.SubscriptionWeight
	}
	if quota == 0 || weight == 1 {
		return quota
	}
	if quota > 0 {
		return int64(math.Ceil(float64(quota) * weight))
	}
	return -int64(math.Ceil(float64(-quota) * weight))
}

func GetPendingTaskBillingSettlementIDs(limit int) ([]int64, error) {
	if limit <= 0 {
		return nil, nil
	}
	var ids []int64
	cleanupCutoff := common.GetTimestamp() - TaskBillingSettlementCleanupDelaySeconds
	err := DB.Model(&TaskBillingSettlement{}).
		Where("cache_delivered = ? OR window_delivered = ? OR log_delivered = ? OR updated_at <= ?", false, false, false, cleanupCutoff).
		Order("id").Limit(limit).Pluck("id", &ids).Error
	return ids, err
}

func GetTaskBillingSettlement(settlementID int64) (*TaskBillingSettlement, bool, error) {
	var settlement TaskBillingSettlement
	err := DB.First(&settlement, settlementID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return &settlement, true, nil
}

func GetTaskBillingSettlementTask(settlementID int64) (*TaskBillingSettlement, *Task, error) {
	var settlement TaskBillingSettlement
	if err := DB.First(&settlement, settlementID).Error; err != nil {
		return nil, nil, err
	}
	var task Task
	if err := DB.First(&task, settlement.TaskRecordID).Error; err != nil {
		return nil, nil, err
	}
	return &settlement, &task, nil
}

func MarkTaskBillingSettlementWindowDelivered(settlementID int64) error {
	return DB.Model(&TaskBillingSettlement{}).Where("id = ?", settlementID).
		Updates(map[string]any{"window_delivered": true, "updated_at": common.GetTimestamp()}).Error
}

// SyncTaskBillingSettlementCache invalidates mutable quota caches. Deletion is
// idempotent, so a retry after an unknown crash point cannot apply quota twice.
func SyncTaskBillingSettlementCache(settlementID int64) error {
	var settlement TaskBillingSettlement
	if err := DB.First(&settlement, settlementID).Error; err != nil {
		return err
	}
	if settlement.CacheDelivered {
		return nil
	}
	if err := invalidateUserCache(settlement.UserID); err != nil {
		return err
	}
	if settlement.TokenID > 0 {
		var token Token
		err := DB.Select("key").First(&token, settlement.TokenID).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err == nil && token.Key != "" {
			if err := cacheDeleteToken(token.Key); err != nil {
				return err
			}
		}
	}
	return DB.Model(&TaskBillingSettlement{}).Where("id = ?", settlementID).
		Updates(map[string]any{"cache_delivered": true, "updated_at": common.GetTimestamp()}).Error
}

// DeliverTaskBillingSettlementLog inserts the marker and log in one LOG_DB
// transaction. A crash after that commit is safe: retry sees the marker and
// only acknowledges delivery in the main DB.
func DeliverTaskBillingSettlementLog(settlementID int64) error {
	var settlement TaskBillingSettlement
	if err := DB.First(&settlement, settlementID).Error; err != nil {
		return err
	}
	if settlement.LogDelivered {
		return nil
	}
	if settlement.LogType == LogTypeConsume && !common.LogConsumeEnabled {
		return markTaskBillingLogDelivered(settlementID)
	}

	username, _ := GetUsernameById(settlement.UserID, false)
	tokenName := ""
	if settlement.TokenID > 0 {
		if token, err := GetTokenById(settlement.TokenID); err == nil {
			tokenName = token.Name
		}
	}
	err := LOG_DB.Transaction(func(tx *gorm.DB) error {
		marker := TaskBillingLogDelivery{SettlementID: settlement.ID, CreatedAt: common.GetTimestamp()}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&marker)
		if result.Error != nil || result.RowsAffected == 0 {
			return result.Error
		}
		return tx.Create(&Log{
			UserId: settlement.UserID, Username: username, CreatedAt: common.GetTimestamp(),
			Type: settlement.LogType, Content: settlement.LogContent, TokenName: tokenName,
			ModelName: settlement.LogModelName, Quota: settlement.LogQuota,
			ChannelId: settlement.ChannelID, TokenId: settlement.TokenID,
			Group: settlement.LogGroup, Other: settlement.LogOther,
		}).Error
	})
	if err != nil {
		return err
	}
	return markTaskBillingLogDelivered(settlementID)
}

func markTaskBillingLogDelivered(settlementID int64) error {
	return DB.Model(&TaskBillingSettlement{}).Where("id = ?", settlementID).
		Updates(map[string]any{"log_delivered": true, "updated_at": common.GetTimestamp()}).Error
}

func DeleteTaskBillingLogDelivery(settlementID int64) error {
	return LOG_DB.Where("settlement_id = ?", settlementID).Delete(&TaskBillingLogDelivery{}).Error
}

func DeleteTaskBillingSettlement(settlementID int64) error {
	return DB.Where("id = ?", settlementID).Delete(&TaskBillingSettlement{}).Error
}
