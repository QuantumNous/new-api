package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	PurchaseLifecycleKindTopUp  = "topup"
	purchaseLifecycleTopUpTable = "top_ups"
)

type PurchaseLifecycleTransition struct {
	Kind       string
	SourceID   int64
	TradeNo    string
	UserID     int
	FromStatus []string
	ToStatus   string
	OccurredAt int64
	Credit     int64
	SourceRef  string
}

func PersistPurchaseLifecycleTransition(tx *gorm.DB, transition PurchaseLifecycleTransition) (bool, error) {
	if tx == nil {
		return false, errors.New("purchase lifecycle transition requires transaction")
	}
	kind := strings.TrimSpace(transition.Kind)
	if kind == "" {
		kind = PurchaseLifecycleKindTopUp
	}
	if kind != PurchaseLifecycleKindTopUp {
		return false, fmt.Errorf("unsupported purchase lifecycle kind %q", kind)
	}
	toStatus := normalizePurchaseLifecycleStatus(transition.ToStatus)
	if toStatus == "" {
		return false, errors.New("purchase lifecycle transition requires target status")
	}
	if transition.UserID <= 0 {
		return false, errors.New("purchase lifecycle transition requires user id")
	}

	topUp, err := lockPurchaseLifecycleTopUp(tx, transition)
	if err != nil {
		return false, err
	}
	if topUp.UserId != transition.UserID {
		return false, ErrTopUpStatusInvalid
	}
	tradeNo := strings.TrimSpace(transition.TradeNo)
	if tradeNo == "" {
		tradeNo = strings.TrimSpace(topUp.TradeNo)
	}
	if tradeNo != "" && strings.TrimSpace(topUp.TradeNo) != "" && tradeNo != strings.TrimSpace(topUp.TradeNo) {
		return false, ErrTopUpStatusInvalid
	}
	currentStatus := normalizePurchaseLifecycleStatus(topUp.Status)
	if currentStatus == toStatus {
		if toStatus == common.TopUpStatusPending {
			inserted, insertErr := insertPurchaseLifecycleEventForTopUp(tx, topUp, transition, RecallLifecycleTriggerPaymentPending)
			return inserted, insertErr
		}
		return false, nil
	}
	if !purchaseLifecycleStatusAllowed(currentStatus, transition.FromStatus) {
		return false, ErrTopUpStatusInvalid
	}

	occurredAt := transition.OccurredAt
	if occurredAt <= 0 {
		occurredAt = getDBTimestampTx(tx)
	}
	switch toStatus {
	case common.TopUpStatusPending:
		topUp.Status = common.TopUpStatusPending
	case common.TopUpStatusSuccess:
		if transition.Credit <= 0 {
			return false, errors.New("purchase lifecycle success requires positive credit")
		}
		topUp.Status = common.TopUpStatusSuccess
		topUp.CompleteTime = occurredAt
	case common.TopUpStatusFailed, common.TopUpStatusExpired, "cancelled", "canceled":
		topUp.Status = toStatus
	default:
		return false, ErrTopUpStatusInvalid
	}
	result := tx.Model(&TopUp{}).Where("id = ? AND status = ?", topUp.Id, currentStatus).Updates(map[string]any{
		"status":        topUp.Status,
		"complete_time": topUp.CompleteTime,
	})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected != 1 {
		latest, err := lockPurchaseLifecycleTopUp(tx, transition)
		if err != nil {
			return false, err
		}
		if latest.UserId != transition.UserID {
			return false, ErrTopUpStatusInvalid
		}
		if normalizePurchaseLifecycleStatus(latest.Status) == toStatus {
			return false, nil
		}
		return false, ErrTopUpStatusInvalid
	}

	eventType := purchaseLifecycleEventType(toStatus)
	if eventType != "" {
		if _, err := insertPurchaseLifecycleEventForTopUp(tx, topUp, transition, eventType); err != nil {
			return false, err
		}
	}
	if toStatus == common.TopUpStatusSuccess {
		if _, err := ApplyWalletTopUpSuccessMutationTx(tx, topUp.UserId, transition.Credit, topUp.Id, topUp.TradeNo); err != nil {
			return false, err
		}
	}
	return true, nil
}

func lockPurchaseLifecycleTopUp(tx *gorm.DB, transition PurchaseLifecycleTransition) (*TopUp, error) {
	topUp := &TopUp{}
	query := lockQuery(tx)
	if transition.SourceID > 0 {
		if err := query.Where("id = ?", transition.SourceID).First(topUp).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrTopUpNotFound
			}
			return nil, err
		}
		return topUp, nil
	}
	tradeNo := strings.TrimSpace(transition.TradeNo)
	if tradeNo == "" {
		return nil, ErrTopUpNotFound
	}
	if err := query.Where("trade_no = ?", tradeNo).First(topUp).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTopUpNotFound
		}
		return nil, err
	}
	return topUp, nil
}

func insertPurchaseLifecycleEventForTopUp(tx *gorm.DB, topUp *TopUp, transition PurchaseLifecycleTransition, eventType string) (bool, error) {
	occurredAt := transition.OccurredAt
	if occurredAt <= 0 {
		occurredAt = getDBTimestampTx(tx)
	}
	tradeNo := strings.TrimSpace(topUp.TradeNo)
	sourceID := int64(topUp.Id)
	occurrence, err := NewRecallLifecyclePurchaseOccurrence(eventType, PurchaseLifecycleKindTopUp, tradeNo, purchaseLifecycleTopUpTable, sourceID, topUp.UserId)
	if err != nil {
		return false, err
	}
	scopeID := tradeNo
	if scopeID == "" {
		scopeID = fmt.Sprintf("%s:%d", purchaseLifecycleTopUpTable, sourceID)
	}
	availableAt := occurredAt
	if eventType == RecallLifecycleTriggerPaymentPending {
		availableAt = topUp.CreateTime + int64(recallLifecyclePaymentPendingDelay.Seconds())
	}
	payload, err := common.Marshal(map[string]any{
		"purchase_kind":    PurchaseLifecycleKindTopUp,
		"source_table":     purchaseLifecycleTopUpTable,
		"source_id":        sourceID,
		"trade_no":         tradeNo,
		"user_id":          topUp.UserId,
		"from_status":      transition.FromStatus,
		"to_status":        normalizePurchaseLifecycleStatus(transition.ToStatus),
		"payment_provider": topUp.PaymentProvider,
		"payment_method":   topUp.PaymentMethod,
		"amount":           topUp.Amount,
		"money":            topUp.Money,
		"currency":         topUp.PaymentCurrency,
		"credit":           transition.Credit,
		"source_ref":       strings.TrimSpace(transition.SourceRef),
	})
	if err != nil {
		return false, err
	}
	event := &RecallLifecycleEvent{
		EventType:         eventType,
		OccurrenceKeyHash: occurrence.Hash,
		ScopeType:         PurchaseLifecycleKindTopUp,
		ScopeId:           scopeID,
		BusinessKey:       occurrence.Canonical,
		UserId:            topUp.UserId,
		EventData:         string(payload),
		Disposition:       RecallLifecycleEventPending,
		OccurredAt:        occurredAt,
		AvailableAt:       availableAt,
		SchemaVersion:     1,
	}
	result := insertRecallLifecycleEvent(tx, event)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func purchaseLifecycleEventType(status string) string {
	switch normalizePurchaseLifecycleStatus(status) {
	case common.TopUpStatusPending:
		return RecallLifecycleTriggerPaymentPending
	case common.TopUpStatusSuccess:
		return RecallLifecycleTriggerPaymentSucceeded
	case common.TopUpStatusFailed, common.TopUpStatusExpired, "cancelled", "canceled":
		return RecallLifecycleTriggerPaymentFailed
	default:
		return ""
	}
}

func normalizePurchaseLifecycleStatus(status string) string {
	return strings.ToLower(strings.TrimSpace(status))
}

func purchaseLifecycleStatusAllowed(current string, allowed []string) bool {
	if len(allowed) == 0 {
		return current == common.TopUpStatusPending
	}
	for _, status := range allowed {
		if current == normalizePurchaseLifecycleStatus(status) {
			return true
		}
	}
	return false
}

func topUpSuccessFromStatuses() []string {
	return []string{common.TopUpStatusPending, common.TopUpStatusFailed, common.TopUpStatusExpired, "cancelled", "canceled"}
}
