package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// RefundSubscriptionTaskFunding reverses submission and completion together.
// The task receipt, token and usage counters commit with the money, including
// when a previous caller failed before publishing its in-memory task state.
func RefundSubscriptionTaskFunding(task *Task) (int, error) {
	return reduceSubscriptionTaskFunding(task, 0)
}

func reduceSubscriptionTaskFunding(task *Task, target int) (int, error) {
	if task == nil || task.ID <= 0 || task.PrivateData.Execution == nil || task.PrivateData.Execution.RequestID == "" || target != 0 {
		return 0, errors.New("invalid subscription task refund")
	}
	requestId := task.PrivateData.Execution.RequestID
	var refunded int
	var walletCredit int64
	var tokenKey string
	err := DB.Transaction(func(tx *gorm.DB) error {
		sub, original, err := lockSubscriptionFundingTx(tx, requestId)
		if err != nil {
			return err
		}
		var persisted Task
		if err := lockForUpdate(tx).First(&persisted, task.ID).Error; err != nil {
			return err
		}
		if persisted.UserId != original.UserId || persisted.PrivateData.SubscriptionId != sub.Id || persisted.PrivateData.Execution == nil || persisted.PrivateData.Execution.RequestID != requestId {
			return errors.New("subscription task funding identity mismatch")
		}
		if target > persisted.Quota {
			return errors.New("subscription task refund cannot increase its charge")
		}
		refunded = persisted.Quota - target
		completionId := fmt.Sprintf("%x", common.Sha256Raw([]byte("task-completion:"+requestId)))
		var records []SubscriptionPreConsumeRecord
		if err := lockForUpdate(tx).Where("request_id IN ?", []string{requestId, completionId}).Order("id desc").Find(&records).Error; err != nil {
			return err
		}
		for i := range records {
			record := &records[i]
			if record.UserId != persisted.UserId || record.UserSubscriptionId != sub.Id {
				return errors.New("subscription task funding identity mismatch")
			}
			if record.Status == "refunded" {
				continue
			}
			if record.Status != "settled" && record.Status != "reserved" && record.Status != "consumed" {
				return errors.New("subscription task funding is not refundable")
			}
			if record.Status == "settled" && record.AccountingVersion == 0 {
				// Old settled receipts lack exact window attribution. Preserve the
				// charge for reconciliation rather than credit another request.
				return errors.New("settled subscription funding requires legacy reconciliation")
			}
			if record.Status == "reserved" {
				if sub.AmountReserved < record.PreConsumed {
					return errors.New("subscription reservation accounting is invalid")
				}
				sub.AmountReserved -= record.PreConsumed
			} else {
				amount := record.SettledAmount - record.RefundedAmount
				counter := record.CounterAmount
				if record.Status == "consumed" {
					amount, counter = record.PreConsumed, record.PreConsumed
					record.ChargedGeneration = record.ResetGeneration
				}
				if amount < 0 || counter < 0 || counter > amount || record.WindowCharged < 0 || record.WindowCharged > amount {
					return errors.New("subscription refund accounting is invalid")
				}
				if sub.QuotaModelVersion > 0 {
					if counter > sub.TotalAmountUsed || amount > sub.HistoricalAmountUsed {
						return errors.New("subscription refund exceeds attributed usage")
					}
					sub.TotalAmountUsed -= counter
					sub.AmountUsed = sub.TotalAmountUsed
					sub.HistoricalAmountUsed -= amount
					if record.ChargedGeneration == sub.ResetGeneration {
						if record.WindowCharged > sub.WindowAmountUsed {
							return errors.New("subscription refund exceeds attributed window usage")
						}
						sub.WindowAmountUsed -= record.WindowCharged
					}
				} else if record.ChargedGeneration == sub.ResetGeneration {
					if counter > sub.AmountUsed {
						return errors.New("subscription refund exceeds attributed usage")
					}
					sub.AmountUsed -= counter
				}
				record.RefundedAmount += amount
				record.CounterAmount = 0
				record.WindowCharged = 0
			}
			wallet := record.WalletSettledAmount - record.WalletRefundedAmount
			if wallet < 0 || wallet > int64(^uint64(0)>>1)-walletCredit {
				return errors.New("subscription wallet refund exceeds supported quota")
			}
			walletCredit += wallet
			record.WalletRefundedAmount += wallet
			record.FundingClosed = true
			record.Status = "refunded"
			if err := tx.Save(record).Error; err != nil {
				return err
			}
		}
		if err := tx.Save(sub).Error; err != nil {
			return err
		}
		var user User
		if err := lockForUpdate(tx).First(&user, persisted.UserId).Error; err != nil {
			return err
		}
		if walletCredit > 0 && int64(user.Quota) > int64(^uint64(0)>>1)-walletCredit {
			return errors.New("subscription wallet refund exceeds supported quota")
		}
		if err := tx.Model(&user).Updates(map[string]any{
			"quota":      gorm.Expr("quota + ?", walletCredit),
			"used_quota": gorm.Expr("used_quota - ?", refunded),
		}).Error; err != nil {
			return err
		}
		if persisted.PrivateData.TokenId > 0 && refunded > 0 {
			var token Token
			found := lockForUpdate(tx).First(&token, persisted.PrivateData.TokenId)
			if found.Error != nil && !errors.Is(found.Error, gorm.ErrRecordNotFound) {
				return found.Error
			}
			if found.Error == nil {
				tokenKey = token.Key
				if token.UserId != persisted.UserId {
					return errors.New("subscription task token identity mismatch")
				}
				if token.RemainQuota > int(^uint(0)>>1)-refunded {
					return errors.New("subscription token refund exceeds supported quota")
				}
				if err := tx.Model(&token).Updates(map[string]any{
					"remain_quota": gorm.Expr("remain_quota + ?", refunded),
					"used_quota":   gorm.Expr("used_quota - ?", refunded),
				}).Error; err != nil {
					return err
				}
			}
		}
		if persisted.ChannelId > 0 && refunded > 0 {
			if err := tx.Model(&Channel{}).Where("id = ?", persisted.ChannelId).Update("used_quota", gorm.Expr("used_quota - ?", refunded)).Error; err != nil {
				return err
			}
		}
		return tx.Model(&persisted).Update("quota", target).Error
	})
	if err != nil {
		return 0, err
	}
	task.Quota = target
	if walletCredit > 0 {
		if err := cacheIncrUserQuota(task.UserId, walletCredit); err != nil {
			common.SysError(fmt.Sprintf("subscription task wallet refund cache update failed: %v", err))
		}
	}
	if tokenKey != "" {
		if err := invalidateTokenCacheForMutation(tokenKey); err != nil {
			common.SysError(fmt.Sprintf("subscription task token refund cache invalidation failed: %v", err))
		}
	}
	return refunded, nil
}
