package service

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

const AgentRefundMaxCodes = 100

var (
	ErrAgentRefundInvalidRequest = errors.New("invalid agent refund request")
	ErrAgentRefundUnavailable    = errors.New("agent package codes are unavailable for refund")
)

type AgentRefundInput struct {
	AgentUserID    int
	RedemptionIDs  []int
	IdempotencyKey string
	RequestedBy    int
	RootOverride   bool
}

type AgentRefundResult struct {
	RequestID     int   `json:"request_id"`
	RedemptionIDs []int `json:"redemption_ids"`
	Fee           int64 `json:"-"`
	Refunded      int64 `json:"-"`
	BalanceAfter  int64 `json:"-"`
}

type agentRefundOrderTotals struct {
	Count  int
	Amount int64
}

func agentRefundCodeCAS(tx *gorm.DB, code model.Redemption, now int64) *gorm.DB {
	conditions := map[string]any{
		"id":                   code.Id,
		"type":                 code.Type,
		"user_id":              code.UserId,
		"agent_user_id":        code.AgentUserId,
		"agent_order_id":       code.AgentOrderId,
		"subscription_plan_id": code.SubscriptionPlanId,
		"key":                  code.Key,
		"name":                 code.Name,
		"status":               code.Status,
		"used_user_id":         code.UsedUserId,
		"redeemed_time":        code.RedeemedTime,
	}
	return tx.Model(&model.Redemption{}).
		Where(conditions).
		Where("expired_time > ?", now).
		UpdateColumn("status", common.RedemptionCodeStatusRefunded)
}

func RefundAgentCodes(input AgentRefundInput) (*AgentRefundResult, error) {
	input.IdempotencyKey = strings.TrimSpace(input.IdempotencyKey)
	ids, snapshot, requestHash, err := canonicalAgentRefundRequest(input)
	if err != nil {
		return nil, err
	}

	if existing, found, err := findAgentRefundRequest(model.DB, input.AgentUserID, input.IdempotencyKey); err != nil {
		return nil, err
	} else if found {
		return replayAgentRefund(existing, requestHash)
	}
	if !input.RootOverride && !operation_setting.GetAgentSetting().Enabled {
		return nil, ErrAgentFeatureDisabled
	}

	var expectedAccount model.AgentAccount
	if err := model.DB.Where("user_id = ?", input.AgentUserID).First(&expectedAccount).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAgentAccountNotFound
		}
		return nil, err
	}
	if !input.RootOverride && expectedAccount.Status != model.AgentAccountStatusActive {
		return nil, ErrAgentAccountDisabled
	}
	if expectedAccount.Balance < 0 {
		return nil, ErrAgentBalanceOverflow
	}
	if expectedAccount.Version == math.MaxInt64 {
		return nil, ErrAgentAccountConflict
	}

	var result AgentRefundResult
	transactionErr := model.DB.Transaction(func(tx *gorm.DB) error {
		accountWhere := tx.Model(&model.AgentAccount{}).
			Where("id = ? AND version = ?", expectedAccount.Id, expectedAccount.Version)
		if !input.RootOverride {
			accountWhere = accountWhere.Where("status = ?", model.AgentAccountStatusActive)
		}
		guard := accountWhere.Updates(map[string]interface{}{
			"version":    expectedAccount.Version + 1,
			"updated_at": common.GetTimestamp(),
		})
		if guard.Error != nil {
			return guard.Error
		}
		if guard.RowsAffected != 1 {
			return errAgentAccountVersionConflict
		}

		if existing, found, err := findAgentRefundRequest(tx, input.AgentUserID, input.IdempotencyKey); err != nil {
			return err
		} else if found {
			if existing.RequestHash != requestHash {
				return ErrAgentIdempotencyConflict
			}
			return errAgentPurchaseUniqueConflict
		}

		var account model.AgentAccount
		if err := tx.Where("id = ?", expectedAccount.Id).First(&account).Error; err != nil {
			return err
		}
		if !input.RootOverride && account.Status != model.AgentAccountStatusActive {
			return ErrAgentAccountDisabled
		}
		if account.Balance < 0 {
			return ErrAgentBalanceOverflow
		}
		if err := guardAgentLedgerConsistencyTx(tx, &account); err != nil {
			return err
		}

		var codes []model.Redemption
		if err := tx.Where("id IN ? AND type = ? AND agent_user_id = ?", ids, common.RedemptionCodeTypeSubscription, input.AgentUserID).
			Order("id ASC").Find(&codes).Error; err != nil {
			return err
		}
		if len(codes) != len(ids) {
			return ErrAgentRefundUnavailable
		}

		orderIDs := make([]int, 0, len(codes))
		seenOrders := make(map[int]struct{}, len(codes))
		for _, code := range codes {
			if code.AgentOrderId <= 0 {
				return ErrAgentRefundUnavailable
			}
			if _, exists := seenOrders[code.AgentOrderId]; !exists {
				seenOrders[code.AgentOrderId] = struct{}{}
				orderIDs = append(orderIDs, code.AgentOrderId)
			}
		}
		var orders []model.AgentPurchaseOrder
		if err := tx.Where("id IN ? AND agent_user_id = ?", orderIDs, input.AgentUserID).Find(&orders).Error; err != nil {
			return err
		}
		if len(orders) != len(orderIDs) {
			return ErrAgentRefundUnavailable
		}
		ordersByID := make(map[int]model.AgentPurchaseOrder, len(orders))
		for _, order := range orders {
			if err := validateAgentRefundOrder(order); err != nil {
				return err
			}
			ordersByID[order.Id] = order
		}

		now := time.Now().Unix()
		refunds := make(map[int]int64, len(codes))
		orderTotals := make(map[int]agentRefundOrderTotals, len(orders))
		feeTotal := int64(0)
		refundTotal := int64(0)
		for _, code := range codes {
			order, exists := ordersByID[code.AgentOrderId]
			if !exists || code.UserId != input.AgentUserID || code.Key == "" || code.Name != order.PlanTitle ||
				code.AgentOrderId != order.Id || code.SubscriptionPlanId != order.PlanId ||
				code.Status != common.RedemptionCodeStatusEnabled || code.ExpiredTime <= now ||
				code.UsedUserId != 0 || code.RedeemedTime != 0 {
				return ErrAgentRefundUnavailable
			}
			fee, refund, err := AgentRefundAmount(order.UnitPrice, order.RefundFeeBps)
			if err != nil {
				return ErrAgentRefundUnavailable
			}
			feeTotal, err = checkedAgentRefundAdd(feeTotal, fee)
			if err != nil {
				return err
			}
			refundTotal, err = checkedAgentRefundAdd(refundTotal, refund)
			if err != nil {
				return err
			}
			refunds[code.Id] = refund
			totals := orderTotals[order.Id]
			totals.Count++
			totals.Amount, err = checkedAgentRefundAdd(totals.Amount, refund)
			if err != nil {
				return err
			}
			orderTotals[order.Id] = totals
		}
		if feeTotal < 0 || refundTotal < 0 || account.Balance > math.MaxInt64-refundTotal {
			return ErrAgentBalanceOverflow
		}

		request := model.AgentRefundRequest{
			AgentUserId: input.AgentUserID, IdempotencyKey: input.IdempotencyKey,
			RequestHash: requestHash, RedemptionIDsSnapshot: snapshot,
			FeeTotal: feeTotal, RefundTotal: refundTotal, BalanceAfter: account.Balance + refundTotal,
		}
		if err := tx.Create(&request).Error; err != nil {
			if isAgentPurchaseUniqueConflict(err) {
				return errAgentPurchaseUniqueConflict
			}
			return err
		}

		for _, code := range codes {
			codeUpdate := agentRefundCodeCAS(tx, code, now)
			if codeUpdate.Error != nil {
				return codeUpdate.Error
			}
			if codeUpdate.RowsAffected != 1 {
				return ErrAgentRefundUnavailable
			}
		}

		balanceAfter := account.Balance + refundTotal
		if refundTotal > 0 {
			accountUpdate := tx.Model(&model.AgentAccount{}).
				Where("id = ? AND version = ?", account.Id, account.Version).
				UpdateColumn("balance", balanceAfter)
			if accountUpdate.Error != nil {
				return accountUpdate.Error
			}
			if accountUpdate.RowsAffected != 1 {
				return errAgentAccountVersionConflict
			}
		}

		runningBalance := account.Balance
		for _, code := range codes {
			refund := refunds[code.Id]
			nextBalance := runningBalance + refund
			ledger := model.AgentCreditLog{
				AgentUserId: input.AgentUserID, Delta: refund,
				BalanceBefore: runningBalance, BalanceAfter: nextBalance,
				EventType: model.AgentCreditEventRefund, BusinessKey: fmt.Sprintf("refund:%d", code.Id),
				OrderId: code.AgentOrderId, RedemptionId: code.Id,
				OperatorUserId: input.RequestedBy, Remark: "package code refund",
			}
			if err := tx.Create(&ledger).Error; err != nil {
				if isAgentPurchaseUniqueConflict(err) {
					return ErrAgentRefundUnavailable
				}
				return err
			}
			runningBalance = nextBalance
		}
		if runningBalance != balanceAfter {
			return ErrAgentBalanceOverflow
		}

		for orderID, totals := range orderTotals {
			order := ordersByID[orderID]
			if totals.Count > order.Quantity-order.RefundedCount {
				return ErrAgentRefundUnavailable
			}
			newCount := order.RefundedCount + totals.Count
			newAmount, err := checkedAgentRefundAdd(order.RefundedAmount, totals.Amount)
			if err != nil || newAmount > order.TotalPrice {
				return ErrAgentRefundUnavailable
			}
			status := model.AgentPurchaseOrderStatusPartiallyRefunded
			if newCount == order.Quantity {
				status = model.AgentPurchaseOrderStatusRefunded
			}
			updated := tx.Model(&model.AgentPurchaseOrder{}).
				Where("id = ? AND refunded_count = ? AND refunded_amount = ?", orderID, order.RefundedCount, order.RefundedAmount).
				Updates(map[string]interface{}{
					"refunded_count": newCount, "refunded_amount": newAmount, "status": status,
				})
			if updated.Error != nil {
				return updated.Error
			}
			if updated.RowsAffected != 1 {
				return ErrAgentRefundUnavailable
			}
		}

		result = AgentRefundResult{
			RequestID: request.Id, RedemptionIDs: append([]int(nil), ids...),
			Fee: feeTotal, Refunded: refundTotal, BalanceAfter: balanceAfter,
		}
		return nil
	})
	if transactionErr == nil {
		return &result, nil
	}
	if errors.Is(transactionErr, errAgentPurchaseUniqueConflict) || errors.Is(transactionErr, errAgentAccountVersionConflict) {
		if existing, found, err := findAgentRefundRequest(model.DB, input.AgentUserID, input.IdempotencyKey); err != nil {
			return nil, err
		} else if found {
			return replayAgentRefund(existing, requestHash)
		}
		return nil, ErrAgentAccountConflict
	}
	return nil, transactionErr
}

func canonicalAgentRefundRequest(input AgentRefundInput) ([]int, string, string, error) {
	if input.AgentUserID <= 0 || input.RequestedBy <= 0 || input.IdempotencyKey == "" ||
		len(input.IdempotencyKey) > agentIdempotencyKeyMaxBytes || len(input.RedemptionIDs) < 1 ||
		len(input.RedemptionIDs) > AgentRefundMaxCodes {
		return nil, "", "", ErrAgentRefundInvalidRequest
	}
	ids := append([]int(nil), input.RedemptionIDs...)
	sort.Ints(ids)
	for index, id := range ids {
		if id <= 0 || (index > 0 && ids[index-1] == id) {
			return nil, "", "", ErrAgentRefundInvalidRequest
		}
	}
	snapshotBytes, err := common.Marshal(ids)
	if err != nil {
		return nil, "", "", err
	}
	hash := sha256.Sum256(snapshotBytes)
	return ids, string(snapshotBytes), fmt.Sprintf("%x", hash[:]), nil
}

func findAgentRefundRequest(db *gorm.DB, agentUserID int, idempotencyKey string) (model.AgentRefundRequest, bool, error) {
	var request model.AgentRefundRequest
	result := db.Where("agent_user_id = ? AND idempotency_key = ?", agentUserID, idempotencyKey).Limit(1).Find(&request)
	return request, result.RowsAffected == 1, result.Error
}

func replayAgentRefund(request model.AgentRefundRequest, requestHash string) (*AgentRefundResult, error) {
	if request.RequestHash != requestHash {
		return nil, ErrAgentIdempotencyConflict
	}
	var ids []int
	if err := common.UnmarshalJsonStr(request.RedemptionIDsSnapshot, &ids); err != nil {
		return nil, err
	}
	canonical, err := common.Marshal(ids)
	if err != nil || string(canonical) != request.RedemptionIDsSnapshot {
		return nil, ErrAgentRefundUnavailable
	}
	persistedHash := sha256.Sum256(canonical)
	if fmt.Sprintf("%x", persistedHash[:]) != request.RequestHash {
		return nil, ErrAgentRefundUnavailable
	}
	return &AgentRefundResult{
		RequestID: request.Id, RedemptionIDs: ids, Fee: request.FeeTotal,
		Refunded: request.RefundTotal, BalanceAfter: request.BalanceAfter,
	}, nil
}

func validateAgentRefundOrder(order model.AgentPurchaseOrder) error {
	if order.AgentUserId <= 0 || order.PlanId <= 0 || order.Quantity <= 0 || order.UnitPrice <= 0 ||
		order.RefundFeeBps < 0 || order.RefundFeeBps > 10000 || order.RefundedCount < 0 ||
		order.RefundedCount >= order.Quantity || order.RefundedAmount < 0 ||
		(order.Status != model.AgentPurchaseOrderStatusCompleted && order.Status != model.AgentPurchaseOrderStatusPartiallyRefunded) {
		return ErrAgentRefundUnavailable
	}
	if order.RefundedAmount > order.TotalPrice ||
		(order.Status == model.AgentPurchaseOrderStatusCompleted && (order.RefundedCount != 0 || order.RefundedAmount != 0)) ||
		(order.Status == model.AgentPurchaseOrderStatusPartiallyRefunded && order.RefundedCount == 0) {
		return ErrAgentRefundUnavailable
	}
	expectedTotal, err := AgentPurchaseTotal(order.UnitPrice, order.Quantity)
	if err != nil || expectedTotal != order.TotalPrice {
		return ErrAgentRefundUnavailable
	}
	_, perCodeRefund, err := AgentRefundAmount(order.UnitPrice, order.RefundFeeBps)
	if err != nil {
		return ErrAgentRefundUnavailable
	}
	expectedRefundedAmount := int64(0)
	if order.RefundedCount > 0 {
		expectedRefundedAmount, err = AgentPurchaseTotal(perCodeRefund, order.RefundedCount)
		if err != nil {
			return ErrAgentRefundUnavailable
		}
	}
	if order.RefundedAmount != expectedRefundedAmount {
		return ErrAgentRefundUnavailable
	}
	snapshot, err := model.DecodeSubscriptionEntitlementSnapshot(order.EntitlementSnapshot)
	if err != nil || snapshot.PlanId != order.PlanId || snapshot.PlanTitle != order.PlanTitle {
		return ErrAgentRefundUnavailable
	}
	return nil
}

func checkedAgentRefundAdd(left int64, right int64) (int64, error) {
	if left < 0 || right < 0 || left > math.MaxInt64-right {
		return 0, ErrAgentBalanceOverflow
	}
	return left + right, nil
}
