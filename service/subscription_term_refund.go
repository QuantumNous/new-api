package service

import (
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const subscriptionTermStatusCompleted = "completed"

var ErrInvalidSubscriptionTermSegmentID = errors.New("invalid term segment id")

type SubscriptionTermRefundResult struct {
	TermSegmentID int64
	RefundedQuota int64
	RefundedMoney float64
	RefundKey     string
}

type RefundableSubscriptionTermItem struct {
	TermSegmentID int64   `json:"term_segment_id"`
	OrderID       int64   `json:"order_id"`
	PlanID        int64   `json:"plan_id"`
	PlanTitle     string  `json:"plan_title"`
	StartTime     int64   `json:"start_time"`
	EndTime       int64   `json:"end_time"`
	RemainingDays int64   `json:"remaining_days"`
	RefundMoney   float64 `json:"refund_money"`
	RefundQuota   int64   `json:"refund_quota"`
	Status        string  `json:"status"`
}

type RefundableSubscriptionTermsResult struct {
	Items            []RefundableSubscriptionTermItem `json:"items"`
	TotalRefundMoney float64                          `json:"total_refund_money"`
	TotalRefundQuota int64                            `json:"total_refund_quota"`
}

func ListRefundableSubscriptionTerms(userID int) (*RefundableSubscriptionTermsResult, error) {
	if userID <= 0 {
		return nil, errors.New("invalid user id")
	}

	var orders []model.SubscriptionOrder
	if err := model.DB.
		Where("user_id = ?", userID).
		Where("status = ?", common.TopUpStatusSuccess).
		Where("NOT (payment_provider = ? AND payment_method = ?)", model.PaymentProviderStripe, model.PaymentMethodStripe).
		Find(&orders).Error; err != nil {
		return nil, err
	}
	if len(orders) == 0 {
		return &RefundableSubscriptionTermsResult{Items: []RefundableSubscriptionTermItem{}}, nil
	}
	ordersByID := make(map[int]model.SubscriptionOrder, len(orders))
	orderIDs := make([]int, 0, len(orders))
	planIDs := make([]int, 0, len(orders))
	seenPlans := map[int]struct{}{}
	for _, order := range orders {
		ordersByID[order.Id] = order
		orderIDs = append(orderIDs, order.Id)
		if _, ok := seenPlans[order.PlanId]; !ok {
			seenPlans[order.PlanId] = struct{}{}
			planIDs = append(planIDs, order.PlanId)
		}
	}

	var plans []model.SubscriptionPlan
	if len(planIDs) > 0 {
		if err := model.DB.Where("id IN ?", planIDs).Find(&plans).Error; err != nil {
			return nil, err
		}
	}
	plansByID := make(map[int]model.SubscriptionPlan, len(plans))
	for _, plan := range plans {
		plansByID[plan.Id] = plan
	}

	now := common.GetTimestamp()
	var terms []model.SubscriptionTermSegment
	if err := model.DB.
		Where("order_id IN ?", orderIDs).
		Where("status = ?", model.SubscriptionTermStatusNotStarted).
		Where("start_time > ?", now).
		Order("start_time asc, id asc").
		Find(&terms).Error; err != nil {
		return nil, err
	}

	result := &RefundableSubscriptionTermsResult{Items: make([]RefundableSubscriptionTermItem, 0, len(terms))}
	for _, term := range terms {
		order, ok := ordersByID[term.OrderId]
		if !ok {
			continue
		}
		plan := plansByID[term.PlanId]
		refundQuota, err := subscriptionMoneyQuota(term.AllocatedMoney)
		if err != nil {
			return nil, err
		}
		item := RefundableSubscriptionTermItem{
			TermSegmentID: term.Id,
			OrderID:       int64(order.Id),
			PlanID:        int64(term.PlanId),
			PlanTitle:     plan.Title,
			StartTime:     term.StartTime,
			EndTime:       term.EndTime,
			RemainingDays: refundableTermRemainingDays(now, term.StartTime, term.EndTime),
			RefundMoney:   term.AllocatedMoney,
			RefundQuota:   int64(refundQuota),
			Status:        term.Status,
		}
		result.Items = append(result.Items, item)
		result.TotalRefundMoney += item.RefundMoney
		result.TotalRefundQuota += item.RefundQuota
	}
	return result, nil
}

func refundableTermRemainingDays(now int64, startTime int64, endTime int64) int64 {
	if endTime <= startTime || endTime <= now {
		return 0
	}
	remainingFrom := now
	if startTime > now {
		remainingFrom = startTime
	}
	fullDays := ceilSecondsToDays(endTime - startTime)
	remainingDays := ceilSecondsToDays(endTime - remainingFrom)
	if remainingDays < 0 {
		return 0
	}
	if fullDays > 0 && remainingDays > fullDays {
		return fullDays
	}
	return remainingDays
}

func ceilSecondsToDays(seconds int64) int64 {
	if seconds <= 0 {
		return 0
	}
	return int64(math.Ceil(float64(seconds) / 86400))
}

func RefundSubscriptionTermSegment(userID int, termSegmentID int64) (*SubscriptionTermRefundResult, error) {
	if userID <= 0 {
		return nil, errors.New("invalid user id")
	}
	if termSegmentID <= 0 {
		return nil, ErrInvalidSubscriptionTermSegmentID
	}

	var result *SubscriptionTermRefundResult
	invalidateUserID := 0
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var term model.SubscriptionTermSegment
		if err := subscriptionCommandLock(tx).Where("id = ?", termSegmentID).First(&term).Error; err != nil {
			return err
		}
		var order model.SubscriptionOrder
		if err := subscriptionCommandLock(tx).
			Where("id = ? AND user_id = ?", term.OrderId, userID).
			First(&order).Error; err != nil {
			return err
		}
		if order.Status != common.TopUpStatusSuccess {
			return errors.New("subscription order must be successful")
		}
		if order.PaymentProvider == model.PaymentProviderStripe && order.PaymentMethod == model.PaymentMethodStripe {
			return errors.New("subscription term refund only supports one-time terms")
		}
		if term.Status == model.SubscriptionTermStatusRefunded {
			if term.RefundKey == nil || *term.RefundKey == "" {
				return errors.New("subscription term must be not_started or have a completed refund ledger")
			}
			var ledger model.WalletLedgerEntry
			if err := tx.Where(
				"entry_key = ? AND user_id = ? AND order_id = ? AND term_segment_id = ? AND entry_type = ?",
				*term.RefundKey,
				userID,
				order.Id,
				term.Id,
				model.WalletLedgerEntryTypePrepaidRefund,
			).First(&ledger).Error; err != nil {
				return err
			}
			result = &SubscriptionTermRefundResult{
				TermSegmentID: term.Id,
				RefundedQuota: ledger.QuotaDelta,
				RefundedMoney: ledger.MoneyAmount,
				RefundKey:     ledger.EntryKey,
			}
			return nil
		}
		if term.Status != model.SubscriptionTermStatusNotStarted {
			return fmt.Errorf("subscription term must be not_started, got %s", term.Status)
		}
		now := common.GetTimestamp()
		if term.StartTime <= now {
			return errors.New("subscription term has already started")
		}
		refundQuota, err := subscriptionMoneyQuota(term.AllocatedMoney)
		if err != nil {
			return err
		}
		refundKey := fmt.Sprintf("subscription:term:refund:%d", term.Id)
		termUpdate := tx.Model(&model.SubscriptionTermSegment{}).
			Where("id = ? AND status = ? AND start_time > ?", term.Id, model.SubscriptionTermStatusNotStarted, now).
			Updates(map[string]interface{}{
				"status":     model.SubscriptionTermStatusRefunded,
				"refund_key": refundKey,
			})
		if termUpdate.Error != nil {
			return termUpdate.Error
		}
		if termUpdate.RowsAffected != 1 {
			return errors.New("subscription term refund state changed")
		}
		if err := tx.Create(&model.WalletLedgerEntry{
			UserId:        userID,
			EntryKey:      refundKey,
			QuotaDelta:    int64(refundQuota),
			MoneyAmount:   term.AllocatedMoney,
			EntryType:     model.WalletLedgerEntryTypePrepaidRefund,
			OrderId:       term.OrderId,
			TermSegmentId: term.Id,
		}).Error; err != nil {
			return err
		}
		if refundQuota > 0 {
			if err := tx.Model(&model.User{}).Where("id = ?", userID).
				Update("quota", gorm.Expr("quota + ?", refundQuota)).Error; err != nil {
				return err
			}
		}
		result = &SubscriptionTermRefundResult{
			TermSegmentID: term.Id,
			RefundedQuota: int64(refundQuota),
			RefundedMoney: term.AllocatedMoney,
			RefundKey:     refundKey,
		}
		invalidateUserID = userID
		return nil
	})
	if err != nil {
		return nil, err
	}
	if invalidateUserID > 0 {
		if err := model.InvalidateUserCache(invalidateUserID); err != nil {
			common.SysLog("failed to invalidate user cache after subscription term refund: " + err.Error())
		}
	}
	return result, nil
}

func RunSubscriptionTermSegmentAdvanceOnce(limit int) (int, error) {
	if limit <= 0 {
		limit = subscriptionResetBatchSize
	}
	now := common.GetTimestamp()
	advanced := 0
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var completeIDs []int64
		if err := tx.Model(&model.SubscriptionTermSegment{}).
			Where("status = ? AND end_time > ? AND end_time <= ?", model.SubscriptionTermStatusActive, 0, now).
			Order("end_time asc, id asc").
			Limit(limit).
			Pluck("id", &completeIDs).Error; err != nil {
			return err
		}
		if len(completeIDs) > 0 {
			res := tx.Model(&model.SubscriptionTermSegment{}).
				Where("id IN ? AND status = ?", completeIDs, model.SubscriptionTermStatusActive).
				Update("status", subscriptionTermStatusCompleted)
			if res.Error != nil {
				return res.Error
			}
			advanced += int(res.RowsAffected)
		}

		remaining := limit - advanced
		if remaining <= 0 {
			return nil
		}
		var activateIDs []int64
		if err := tx.Model(&model.SubscriptionTermSegment{}).
			Where("status = ? AND start_time <= ? AND end_time > ?", model.SubscriptionTermStatusNotStarted, now, now).
			Order("start_time asc, id asc").
			Limit(remaining).
			Pluck("id", &activateIDs).Error; err != nil {
			return err
		}
		if len(activateIDs) == 0 {
			return nil
		}
		res := tx.Model(&model.SubscriptionTermSegment{}).
			Where("id IN ? AND status = ?", activateIDs, model.SubscriptionTermStatusNotStarted).
			Update("status", model.SubscriptionTermStatusActive)
		if res.Error != nil {
			return res.Error
		}
		advanced += int(res.RowsAffected)
		return nil
	})
	if err != nil {
		return advanced, err
	}
	return advanced, nil
}
