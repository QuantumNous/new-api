package model

import (
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// RegisterSubscriptionFundingAccounting makes the token baseline durable before
// either funding transaction commits. A recovered wallet debit can then use the
// same token receipt as the foreground request without charging it twice.
func RegisterSubscriptionFundingAccounting(requestId string, tokenId int, baseline int64, taskId int64) error {
	if baseline < 0 || tokenId < 0 || taskId < 0 {
		return errors.New("invalid subscription accounting identity")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		_, record, err := lockSubscriptionFundingTx(tx, requestId)
		if err != nil {
			return err
		}
		if record.TokenAccountingReady {
			if record.FundingTokenId != tokenId || record.FundingTaskId != taskId {
				return errors.New("subscription accounting identity mismatch")
			}
			return nil
		}
		if taskId > 0 {
			var task Task
			if err := lockForUpdate(tx).First(&task, taskId).Error; err != nil {
				return err
			}
			if task.UserId != record.UserId || task.PrivateData.SubscriptionId != record.UserSubscriptionId || task.PrivateData.TokenId != tokenId || task.PrivateData.Execution == nil || requestId != fmt.Sprintf("%x", common.Sha256Raw([]byte("task-completion:"+task.PrivateData.Execution.RequestID))) {
				return errors.New("subscription task funding identity mismatch")
			}
		}
		record.TokenAccountingReady = true
		record.FundingTokenId = tokenId
		record.TokenAccounted = baseline
		record.FundingTaskId = taskId
		return tx.Save(record).Error
	})
}

type SubscriptionFundingPublication struct {
	Amount             int64
	SubscriptionAmount int64
	WalletAmount       int64
	UnfundedAmount     int64
	TaskQuota          int
	TaskDelta          int
	tokenKey           string
	task               *Task
}

// PublishSubscriptionFundingAccounting synchronizes the token and, for task
// completion, its quota and statistics using the committed funding receipt.
func PublishSubscriptionFundingAccounting(requestId string) (*SubscriptionFundingPublication, error) {
	var result *SubscriptionFundingPublication
	err := DB.Transaction(func(tx *gorm.DB) error {
		_, record, err := lockSubscriptionFundingTx(tx, requestId)
		if err != nil {
			return err
		}
		result, err = publishSubscriptionFundingAccountingTx(tx, record)
		return err
	})
	if err != nil {
		return nil, err
	}
	if result.tokenKey != "" {
		if err := invalidateTokenCacheForMutation(result.tokenKey); err != nil {
			common.SysError(fmt.Sprintf("subscription funding token cache invalidation failed: %v", err))
		}
	}
	return result, nil
}

func publishSubscriptionFundingAccountingTx(tx *gorm.DB, record *SubscriptionPreConsumeRecord) (*SubscriptionFundingPublication, error) {
	if !record.TokenAccountingReady || record.Status != "settled" || record.FundingClosed {
		return nil, errors.New("subscription funding accounting is not publishable")
	}
	if record.SettledAmount < 0 || record.WalletSettledAmount < 0 || record.SettledAmount > math.MaxInt32 || record.WalletSettledAmount > math.MaxInt32-record.SettledAmount || record.TokenAccounted < 0 || record.TokenAccounted > math.MaxInt32 {
		return nil, errors.New("subscription funding exceeds supported task or token quota")
	}
	result := &SubscriptionFundingPublication{
		Amount:             record.SettledAmount + record.WalletSettledAmount,
		SubscriptionAmount: record.SettledAmount, WalletAmount: record.WalletSettledAmount,
		UnfundedAmount: record.SettlementAmount - record.SettledAmount - record.WalletSettledAmount,
	}
	if record.FundingTaskId > 0 {
		var task Task
		if err := lockForUpdate(tx).First(&task, record.FundingTaskId).Error; err != nil {
			return nil, err
		}
		if task.UserId != record.UserId || task.PrivateData.Execution == nil || task.PrivateData.SubscriptionId != record.UserSubscriptionId {
			return nil, errors.New("subscription task funding identity mismatch")
		}
		var original SubscriptionPreConsumeRecord
		if err := lockForUpdate(tx).Where("request_id = ?", task.PrivateData.Execution.RequestID).First(&original).Error; err != nil {
			return nil, err
		}
		if original.UserSubscriptionId != record.UserSubscriptionId || original.FundingClosed {
			return nil, errors.New("subscription task submission funding is closed")
		}
		if original.SettledAmount < 0 || original.WalletSettledAmount < 0 || original.SettledAmount > math.MaxInt32-result.Amount || original.WalletSettledAmount > math.MaxInt32-result.Amount-original.SettledAmount {
			return nil, errors.New("subscription task funding total is invalid")
		}
		total := original.SettledAmount + original.WalletSettledAmount + result.Amount
		if total < int64(task.Quota) {
			return nil, errors.New("subscription task funding total is invalid")
		}
		result.TaskQuota = int(total)
		result.TaskDelta = result.TaskQuota - task.Quota
		result.task = &task
		if result.TaskDelta > 0 {
			var user User
			if err := lockForUpdate(tx).First(&user, task.UserId).Error; err != nil {
				return nil, err
			}
			if user.UsedQuota > int(^uint(0)>>1)-result.TaskDelta {
				return nil, errors.New("subscription task statistics exceed supported quota")
			}
			if err := tx.Model(&user).Update("used_quota", gorm.Expr("used_quota + ?", result.TaskDelta)).Error; err != nil {
				return nil, err
			}
			if task.ChannelId > 0 {
				if err := tx.Model(&Channel{}).Where("id = ?", task.ChannelId).Update("used_quota", gorm.Expr("used_quota + ?", result.TaskDelta)).Error; err != nil {
					return nil, err
				}
			}
			if err := tx.Model(&task).Update("quota", result.TaskQuota).Error; err != nil {
				return nil, err
			}
		}
	}
	delta := result.Amount - record.TokenAccounted
	if delta != 0 && record.FundingTokenId > 0 {
		var token Token
		query := lockForUpdate(tx).First(&token, record.FundingTokenId)
		if query.Error != nil && !errors.Is(query.Error, gorm.ErrRecordNotFound) {
			return nil, query.Error
		}
		if query.Error == nil {
			if token.UserId != record.UserId {
				return nil, errors.New("subscription funding token identity mismatch")
			}
			maxQuota := int64(^uint64(0) >> 1)
			minQuota := -maxQuota - 1
			if delta > 0 && (int64(token.RemainQuota) < minQuota+delta || int64(token.UsedQuota) > maxQuota-delta) || delta < 0 && (int64(token.RemainQuota) > maxQuota+delta || int64(token.UsedQuota) < minQuota-delta) {
				return nil, errors.New("subscription token settlement exceeds supported quota")
			}
			if err := tx.Model(&token).Updates(map[string]any{"remain_quota": gorm.Expr("remain_quota - ?", delta), "used_quota": gorm.Expr("used_quota + ?", delta)}).Error; err != nil {
				return nil, err
			}
			result.tokenKey = token.Key
		}
	}
	record.TokenAccounted = result.Amount
	return result, tx.Save(record).Error
}

// RetryPendingSubscriptionWalletSettlements retries only explicitly authorized
// residual charges. Wallet money, token accounting and task publication share
// one transaction; failures remain discoverable on the next maintenance tick.
func RetryPendingSubscriptionWalletSettlements(limit int) (int, error) {
	if limit <= 0 || limit > 300 {
		limit = 300
	}
	var records []SubscriptionPreConsumeRecord
	if err := DB.Where("wallet_recovery_pending = ? AND status = ? AND wallet_authorized = ? AND funding_closed = ? AND token_accounting_ready = ? AND settlement_amount > settled_amount + wallet_settled_amount", true, "settled", true, false, true).Order("updated_at, id").Limit(limit).Find(&records).Error; err != nil {
		return 0, err
	}
	completed := 0
	var failures []error
	for _, candidate := range records {
		var charged int64
		var publication *SubscriptionFundingPublication
		err := DB.Transaction(func(tx *gorm.DB) error {
			sub, record, err := lockSubscriptionFundingTx(tx, candidate.RequestId)
			if err != nil {
				return err
			}
			if record.FundingClosed || record.Status != "settled" {
				return nil
			}
			charged, err = settleSubscriptionWalletOverflowTx(tx, sub, record)
			if err != nil {
				return err
			}
			publication, err = publishSubscriptionFundingAccountingTx(tx, record)
			return err
		})
		if err != nil {
			failures = append(failures, fmt.Errorf("subscription wallet recovery %s: %w", candidate.RequestId, err))
			// Rotate persistent failures behind other pending receipts.
			if rotateErr := DB.Model(&SubscriptionPreConsumeRecord{}).Where("id = ?", candidate.Id).Update("updated_at", common.GetTimestamp()).Error; rotateErr != nil {
				failures = append(failures, rotateErr)
			}
			continue
		}
		if charged > 0 {
			completed++
			if err := cacheDecrUserQuota(candidate.UserId, charged); err != nil {
				common.SysError(fmt.Sprintf("subscription wallet recovery cache update failed: %v", err))
			}
		}
		if publication != nil && publication.tokenKey != "" {
			if err := invalidateTokenCacheForMutation(publication.tokenKey); err != nil {
				common.SysError(fmt.Sprintf("subscription wallet recovery token cache invalidation failed: %v", err))
			}
		}
		if publication != nil && publication.TaskDelta > 0 {
			task := publication.task
			other := NewLogOther()
			other.SetPublic("is_task", true)
			other.SetPublic("task_id", task.TaskID)
			other.SetPublic("billing_source", "subscription")
			other.SetPublic("subscription_id", candidate.UserSubscriptionId)
			other.SetPublic("subscription_consumed", 0)
			other.SetPublic("wallet_quota_deducted", charged)
			other.SetPublic("unfunded_quota", 0)
			other.SetPublic("pre_consumed_quota", task.Quota)
			other.SetPublic("actual_quota", publication.TaskQuota)
			modelName := task.Properties.OriginModelName
			if task.PrivateData.BillingContext != nil {
				modelName = task.PrivateData.BillingContext.OriginModelName
			}
			RecordTaskBillingLog(RecordTaskBillingLogParams{UserId: task.UserId, LogType: LogTypeConsume, ChannelId: task.ChannelId, ModelName: modelName, Quota: publication.TaskDelta, TokenId: task.PrivateData.TokenId, Group: task.Group, Other: other, NodeName: task.PrivateData.NodeName})
		}
	}
	return completed, errors.Join(failures...)
}

// RefundSubscriptionTaskFunding reverses submission and completion together.
// The task receipt, token and usage counters commit with the money, including
// when a previous caller failed before publishing its in-memory task state.
func RefundSubscriptionTaskFunding(task *Task) (int, error) {
	return reduceSubscriptionTaskFunding(task, 0)
}

// ReduceSubscriptionTaskFunding refunds the difference from a lower final
// price. Completion funding is reversed first, wallet before subscription.
func ReduceSubscriptionTaskFunding(task *Task, target int) (int, error) {
	return reduceSubscriptionTaskFunding(task, target)
}

func reduceSubscriptionTaskFunding(task *Task, target int) (int, error) {
	if task == nil || task.ID <= 0 || task.PrivateData.Execution == nil || task.PrivateData.Execution.RequestID == "" || target < 0 {
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
		var funded int64
		for _, record := range records {
			if record.Status == "refunded" || record.Status == "reserved" {
				continue
			}
			amount := record.SettledAmount - record.RefundedAmount
			if record.Status == "consumed" {
				amount = record.PreConsumed
			}
			wallet := record.WalletSettledAmount - record.WalletRefundedAmount
			if amount < 0 || wallet < 0 || amount > int64(^uint64(0)>>1)-funded || wallet > int64(^uint64(0)>>1)-funded-amount {
				return errors.New("subscription refund accounting is invalid")
			}
			funded += amount + wallet
		}
		if int64(target) > funded {
			return errors.New("subscription refund target exceeds committed funding")
		}
		remaining := funded - int64(target)
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
				if target > 0 && record.PreConsumed > 0 {
					return errors.New("subscription task funding has not settled")
				}
				if sub.AmountReserved < record.PreConsumed {
					return errors.New("subscription reservation accounting is invalid")
				}
				sub.AmountReserved -= record.PreConsumed
			} else {
				wallet := min(remaining, record.WalletSettledAmount-record.WalletRefundedAmount)
				remaining -= wallet
				walletCredit += wallet
				record.WalletRefundedAmount += wallet
				amount := record.SettledAmount - record.RefundedAmount
				counter := record.CounterAmount
				if record.Status == "consumed" {
					amount, counter = record.PreConsumed, record.PreConsumed
					record.ChargedGeneration = record.ResetGeneration
					record.SettledAmount = amount
					record.CounterAmount = counter
					record.AccountingVersion = 1
					record.Status = "settled"
				}
				if amount < 0 || counter < 0 || counter > amount || record.WindowCharged < 0 || record.WindowCharged > amount {
					return errors.New("subscription refund accounting is invalid")
				}
				amount = min(amount, remaining)
				remaining -= amount
				counter = min(counter, amount)
				window := min(record.WindowCharged, amount)
				if sub.QuotaModelVersion > 0 {
					if counter > sub.TotalAmountUsed || amount > sub.HistoricalAmountUsed {
						return errors.New("subscription refund exceeds attributed usage")
					}
					sub.TotalAmountUsed -= counter
					sub.AmountUsed = sub.TotalAmountUsed
					sub.HistoricalAmountUsed -= amount
					if record.ChargedGeneration == sub.ResetGeneration {
						if window > sub.WindowAmountUsed {
							return errors.New("subscription refund exceeds attributed window usage")
						}
						sub.WindowAmountUsed -= window
					}
				} else if record.ChargedGeneration == sub.ResetGeneration {
					if counter > sub.AmountUsed {
						return errors.New("subscription refund exceeds attributed usage")
					}
					sub.AmountUsed -= counter
				}
				record.RefundedAmount += amount
				record.CounterAmount -= counter
				record.WindowCharged -= window
			}
			record.FundingClosed = true
			record.WalletRecoveryPending = false
			if target == 0 || record.Status == "reserved" || record.SettledAmount == record.RefundedAmount && record.WalletSettledAmount == record.WalletRefundedAmount {
				record.Status = "refunded"
			}
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
