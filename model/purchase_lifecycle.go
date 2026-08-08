package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	PurchaseLifecycleKindTopUp         = "topup"
	PurchaseLifecycleKindSubscription  = "subscription"
	purchaseLifecycleTopUpTable        = "top_ups"
	purchaseLifecycleSubscriptionTable = "subscription_orders"
	SubscriptionOrderStatusInitiated   = "initiated"
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

	SubscriptionScopeID int64
}

type purchaseLifecycleWinnerHook func(tx *gorm.DB, topUp *TopUp, transition *PurchaseLifecycleTransition) error
type purchaseLifecycleSubscriptionWinnerHook func(tx *gorm.DB, order *SubscriptionOrder, transition *PurchaseLifecycleTransition) error

func PersistPurchaseLifecycleTransition(tx *gorm.DB, transition PurchaseLifecycleTransition) (bool, error) {
	return persistPurchaseLifecycleTransitionWithWinner(tx, transition, nil)
}

func PersistSubscriptionPurchaseLifecycleTransitionWithWinner(tx *gorm.DB, transition PurchaseLifecycleTransition, winnerHook purchaseLifecycleSubscriptionWinnerHook) (bool, error) {
	transition.Kind = PurchaseLifecycleKindSubscription
	return persistPurchaseLifecycleSubscriptionTransitionWithWinner(tx, transition, winnerHook)
}

func CreateSubscriptionOrderWithPendingPurchaseLifecycleTx(tx *gorm.DB, order *SubscriptionOrder, sourceRef string) error {
	if tx == nil || order == nil {
		return errors.New("subscription order pending lifecycle requires order")
	}
	if order.CreateTime == 0 {
		order.CreateTime = common.GetTimestamp()
	}
	order.Status = common.TopUpStatusPending
	if err := tx.Create(order).Error; err != nil {
		return err
	}
	_, err := PersistSubscriptionPurchaseLifecycleTransitionWithWinner(tx, PurchaseLifecycleTransition{
		SourceID:   int64(order.Id),
		TradeNo:    order.TradeNo,
		UserID:     order.UserId,
		ToStatus:   common.TopUpStatusPending,
		OccurredAt: order.CreateTime,
		SourceRef:  strings.TrimSpace(sourceRef),
	}, nil)
	return err
}

func CreateSubscriptionOrderWithSuccessPurchaseLifecycleTx(tx *gorm.DB, order *SubscriptionOrder, sourceRef string, winnerHook purchaseLifecycleSubscriptionWinnerHook) (bool, error) {
	if tx == nil || order == nil {
		return false, errors.New("subscription order success lifecycle requires order")
	}
	if order.CreateTime == 0 {
		order.CreateTime = common.GetTimestamp()
	}
	order.Status = SubscriptionOrderStatusInitiated
	order.CompleteTime = 0
	if err := tx.Create(order).Error; err != nil {
		return false, err
	}
	return PersistSubscriptionPurchaseLifecycleTransitionWithWinner(tx, PurchaseLifecycleTransition{
		SourceID:   int64(order.Id),
		TradeNo:    order.TradeNo,
		UserID:     order.UserId,
		FromStatus: []string{SubscriptionOrderStatusInitiated},
		ToStatus:   common.TopUpStatusSuccess,
		OccurredAt: order.CreateTime,
		SourceRef:  strings.TrimSpace(sourceRef),
	}, winnerHook)
}

func CreateSubscriptionOrderWithInitiatedPurchaseLifecycleTx(tx *gorm.DB, order *SubscriptionOrder) error {
	if tx == nil || order == nil {
		return errors.New("subscription order initiated lifecycle requires order")
	}
	if order.CreateTime == 0 {
		order.CreateTime = common.GetTimestamp()
	}
	order.Status = SubscriptionOrderStatusInitiated
	order.CompleteTime = 0
	return tx.Create(order).Error
}

func persistPurchaseLifecycleTransitionWithWinner(tx *gorm.DB, transition PurchaseLifecycleTransition, winnerHook purchaseLifecycleWinnerHook) (bool, error) {
	if tx == nil {
		return false, errors.New("purchase lifecycle transition requires transaction")
	}
	kind := strings.TrimSpace(transition.Kind)
	if kind == "" {
		kind = PurchaseLifecycleKindTopUp
	}
	if kind == PurchaseLifecycleKindSubscription {
		return persistPurchaseLifecycleSubscriptionTransitionWithWinner(tx, transition, nil)
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
	if winnerHook != nil {
		if err := winnerHook(tx, topUp, &transition); err != nil {
			return false, err
		}
	}
	if toStatus == common.TopUpStatusSuccess && transition.Credit <= 0 {
		return false, errors.New("purchase lifecycle success requires positive credit")
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

func persistPurchaseLifecycleSubscriptionTransitionWithWinner(tx *gorm.DB, transition PurchaseLifecycleTransition, winnerHook purchaseLifecycleSubscriptionWinnerHook) (bool, error) {
	if tx == nil {
		return false, errors.New("purchase lifecycle transition requires transaction")
	}
	toStatus := normalizePurchaseLifecycleStatus(transition.ToStatus)
	if toStatus == "" {
		return false, errors.New("purchase lifecycle transition requires target status")
	}
	if transition.UserID <= 0 {
		return false, errors.New("purchase lifecycle transition requires user id")
	}

	order, err := lockPurchaseLifecycleSubscriptionOrder(tx, transition)
	if err != nil {
		return false, err
	}
	if order.UserId != transition.UserID {
		return false, ErrSubscriptionOrderStatusInvalid
	}
	tradeNo := strings.TrimSpace(transition.TradeNo)
	if tradeNo == "" {
		tradeNo = strings.TrimSpace(order.TradeNo)
	}
	if tradeNo != "" && strings.TrimSpace(order.TradeNo) != "" && tradeNo != strings.TrimSpace(order.TradeNo) {
		return false, ErrSubscriptionOrderStatusInvalid
	}
	currentStatus := normalizePurchaseLifecycleStatus(order.Status)
	if currentStatus == toStatus {
		if toStatus == common.TopUpStatusPending {
			inserted, insertErr := insertPurchaseLifecycleEventForSubscriptionOrder(tx, order, transition, RecallLifecycleTriggerPaymentPending)
			return inserted, insertErr
		}
		return false, nil
	}
	if !purchaseLifecycleStatusAllowed(currentStatus, transition.FromStatus) {
		return false, ErrSubscriptionOrderStatusInvalid
	}

	occurredAt := transition.OccurredAt
	if occurredAt <= 0 {
		occurredAt = getDBTimestampTx(tx)
	}
	switch toStatus {
	case common.TopUpStatusPending:
		order.Status = common.TopUpStatusPending
	case common.TopUpStatusSuccess:
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = occurredAt
	case common.TopUpStatusFailed, common.TopUpStatusExpired, "cancelled", "canceled":
		order.Status = toStatus
		order.CompleteTime = occurredAt
	default:
		return false, ErrSubscriptionOrderStatusInvalid
	}
	result := tx.Model(&SubscriptionOrder{}).Where("id = ? AND status = ?", order.Id, currentStatus).Updates(map[string]any{
		"status":        order.Status,
		"complete_time": order.CompleteTime,
	})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected != 1 {
		latest, err := lockPurchaseLifecycleSubscriptionOrder(tx, transition)
		if err != nil {
			return false, err
		}
		if latest.UserId != transition.UserID {
			return false, ErrSubscriptionOrderStatusInvalid
		}
		if normalizePurchaseLifecycleStatus(latest.Status) == toStatus {
			return false, nil
		}
		return false, ErrSubscriptionOrderStatusInvalid
	}
	if winnerHook != nil {
		if err := winnerHook(tx, order, &transition); err != nil {
			return false, err
		}
	}

	eventType := purchaseLifecycleEventType(toStatus)
	if eventType != "" {
		if _, err := insertPurchaseLifecycleEventForSubscriptionOrder(tx, order, transition, eventType); err != nil {
			return false, err
		}
	}
	if toStatus == common.TopUpStatusSuccess && transition.SubscriptionScopeID > 0 {
		cycleKey := subscriptionOrderLifecycleCycleKey(order.Id, order.TradeNo)
		if _, err := ApplyLifecycleQuotaMutation(tx, LifecycleQuotaMutation{
			UserID:          order.UserId,
			ScopeType:       QuotaLifecycleScopeSubscription,
			ScopeID:         transition.SubscriptionScopeID,
			Cause:           subscriptionOrderLifecycleSuccessCause(order),
			SourceRef:       cycleKey,
			NextCycleKey:    cycleKey,
			NextCycleSource: cycleKey,
			OccurredAt:      occurredAt,
		}); err != nil {
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

func lockPurchaseLifecycleSubscriptionOrder(tx *gorm.DB, transition PurchaseLifecycleTransition) (*SubscriptionOrder, error) {
	order := &SubscriptionOrder{}
	query := lockQuery(tx)
	if transition.SourceID > 0 {
		if err := query.Where("id = ?", transition.SourceID).First(order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrSubscriptionOrderNotFound
			}
			return nil, err
		}
		return order, nil
	}
	tradeNo := strings.TrimSpace(transition.TradeNo)
	if tradeNo == "" {
		return nil, ErrSubscriptionOrderNotFound
	}
	if err := query.Where("trade_no = ?", tradeNo).First(order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSubscriptionOrderNotFound
		}
		return nil, err
	}
	return order, nil
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

func insertPurchaseLifecycleEventForSubscriptionOrder(tx *gorm.DB, order *SubscriptionOrder, transition PurchaseLifecycleTransition, eventType string) (bool, error) {
	occurredAt := transition.OccurredAt
	if occurredAt <= 0 {
		occurredAt = getDBTimestampTx(tx)
	}
	tradeNo := strings.TrimSpace(order.TradeNo)
	sourceID := int64(order.Id)
	occurrence, err := NewRecallLifecyclePurchaseOccurrence(eventType, PurchaseLifecycleKindSubscription, tradeNo, purchaseLifecycleSubscriptionTable, sourceID, order.UserId)
	if err != nil {
		return false, err
	}
	scopeID := tradeNo
	if scopeID == "" {
		scopeID = fmt.Sprintf("%s:%d", purchaseLifecycleSubscriptionTable, sourceID)
	}
	availableAt := occurredAt
	if eventType == RecallLifecycleTriggerPaymentPending {
		availableAt = order.CreateTime + int64(recallLifecyclePaymentPendingDelay.Seconds())
	}
	payload, err := common.Marshal(map[string]any{
		"purchase_kind":    PurchaseLifecycleKindSubscription,
		"source_table":     purchaseLifecycleSubscriptionTable,
		"source_id":        sourceID,
		"trade_no":         tradeNo,
		"user_id":          order.UserId,
		"from_status":      transition.FromStatus,
		"to_status":        normalizePurchaseLifecycleStatus(transition.ToStatus),
		"payment_provider": order.PaymentProvider,
		"payment_method":   order.PaymentMethod,
		"amount":           0,
		"money":            order.Money,
		"currency":         order.PaymentCurrency,
		"credit":           0,
		"source_ref":       strings.TrimSpace(transition.SourceRef),
	})
	if err != nil {
		return false, err
	}
	event := &RecallLifecycleEvent{
		EventType:         eventType,
		OccurrenceKeyHash: occurrence.Hash,
		ScopeType:         PurchaseLifecycleKindSubscription,
		ScopeId:           scopeID,
		BusinessKey:       occurrence.Canonical,
		UserId:            order.UserId,
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

func subscriptionOrderLifecycleCycleKey(orderID int, tradeNo string) string {
	if normalized := strings.TrimSpace(tradeNo); normalized != "" {
		return "subscription_order:" + normalized
	}
	return fmt.Sprintf("subscription_orders:%d", orderID)
}

func subscriptionOrderLifecycleSuccessCause(order *SubscriptionOrder) string {
	if order != nil && strings.TrimSpace(order.RenewalSource) != "" {
		return "subscription_renewal"
	}
	return "subscription_purchase"
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

func subscriptionSuccessFromStatuses() []string {
	return []string{common.TopUpStatusPending, common.TopUpStatusFailed, common.TopUpStatusExpired, "cancelled", "canceled"}
}
