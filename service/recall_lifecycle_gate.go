package service

import (
	"net/mail"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func init() {
	model.RecallLifecycleSMTPGate = recallLifecycleSMTPGate
}

type recallLifecycleQuotaGateData struct {
	ScopeType      string `json:"scope_type"`
	ScopeID        string `json:"scope_id"`
	CycleKey       string `json:"cycle_key"`
	CurrentBalance int64  `json:"current_balance"`
	Threshold      int64  `json:"threshold"`
}

type recallLifecyclePurchaseGateData struct {
	PurchaseKind string `json:"purchase_kind"`
	SourceID     int64  `json:"source_id"`
	TradeNo      string `json:"trade_no"`
	ToStatus     string `json:"to_status"`
}

func recallLifecycleSMTPGate(tx *gorm.DB, input model.RecallLifecycleSMTPGateInput) (model.RecallLifecycleSMTPGateResult, error) {
	if input.Recipient.LifecycleEventId == nil {
		return model.RecallLifecycleSMTPGateResult{}, nil
	}
	var event model.RecallLifecycleEvent
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&event, "id = ?", *input.Recipient.LifecycleEventId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return recallLifecycleSMTPBlocked("no_account_email"), nil
		}
		return model.RecallLifecycleSMTPGateResult{}, err
	}
	var user model.User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&user, "id = ?", input.Recipient.UserId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return recallLifecycleSMTPBlocked("no_account_email"), nil
		}
		return model.RecallLifecycleSMTPGateResult{}, err
	}
	if user.Status != common.UserStatusEnabled || strings.TrimSpace(user.Email) == "" {
		return recallLifecycleSMTPBlocked("no_account_email"), nil
	}
	email, ok := normalizeRecallLifecycleSMTPEmail(user.Email)
	if !ok {
		return recallLifecycleSMTPBlocked("invalid_email"), nil
	}
	policy, err := model.RecallLifecycleTriggerDeliveryPolicy(event.EventType)
	if err != nil {
		return recallLifecycleSMTPBlocked("order_state_changed"), nil
	}
	if policy == model.RecallDeliveryPolicyEngagement && user.GetSetting().RecallMarketingOptOut {
		return recallLifecycleSMTPBlocked("engagement_opted_out"), nil
	}
	switch event.EventType {
	case model.RecallLifecycleTriggerUserRegistered:
	case model.RecallLifecycleTriggerRegistrationUnused:
		if user.RequestCount != 0 {
			return recallLifecycleSMTPBlocked("registration_used"), nil
		}
	case model.RecallLifecycleTriggerQuotaLow:
		if reason, err := recallLifecycleQuotaGateReason(tx, event, user, false); reason != "" || err != nil {
			return recallLifecycleSMTPBlocked(reason), err
		}
	case model.RecallLifecycleTriggerQuotaExhaustedUnpaid:
		if reason, err := recallLifecycleQuotaGateReason(tx, event, user, true); reason != "" || err != nil {
			return recallLifecycleSMTPBlocked(reason), err
		}
	case model.RecallLifecycleTriggerPaymentFailed, model.RecallLifecycleTriggerPaymentPending, model.RecallLifecycleTriggerPaymentSucceeded:
		if reason, err := recallLifecyclePurchaseGateReason(tx, event); reason != "" || err != nil {
			return recallLifecycleSMTPBlocked(reason), err
		}
	default:
		return recallLifecycleSMTPBlocked("order_state_changed"), nil
	}
	return model.RecallLifecycleSMTPGateResult{Email: email}, nil
}

func recallLifecycleSMTPBlocked(reason string) model.RecallLifecycleSMTPGateResult {
	if strings.TrimSpace(reason) == "" {
		reason = "order_state_changed"
	}
	return model.RecallLifecycleSMTPGateResult{Blocked: true, ReasonCode: reason}
}

func recallLifecycleQuotaGateReason(tx *gorm.DB, event model.RecallLifecycleEvent, user model.User, exhausted bool) (string, error) {
	data := recallLifecycleQuotaGateData{}
	if err := common.Unmarshal([]byte(event.EventData), &data); err != nil {
		return "quota_recovered", nil
	}
	scopeType := strings.TrimSpace(data.ScopeType)
	scopeID := strings.TrimSpace(data.ScopeID)
	cycle := strings.TrimSpace(data.CycleKey)
	if scopeType == "" || scopeID == "" || cycle == "" {
		return "quota_recovered", nil
	}
	var state model.QuotaLifecycleState
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("user_id = ? AND scope_type = ? AND scope_id = ?", event.UserId, scopeType, scopeID).
		First(&state).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "quota_recovered", nil
		}
		return "", err
	}
	if strings.TrimSpace(state.Cycle) != cycle {
		return "quota_cycle_changed", nil
	}
	if exhausted {
		if state.Balance > 0 {
			return "quota_recovered", nil
		}
		return "", nil
	}
	threshold := recallLifecycleCurrentQuotaThreshold(user)
	if state.Balance <= 0 || (threshold > 0 && state.Balance >= threshold) {
		return "quota_recovered", nil
	}
	return "", nil
}

func recallLifecycleCurrentQuotaThreshold(user model.User) int64 {
	if threshold := user.GetSetting().QuotaWarningThreshold; threshold > 0 {
		return int64(threshold)
	}
	return int64(common.QuotaRemindThreshold)
}

func recallLifecyclePurchaseGateReason(tx *gorm.DB, event model.RecallLifecycleEvent) (string, error) {
	data := recallLifecyclePurchaseGateData{}
	if err := common.Unmarshal([]byte(event.EventData), &data); err != nil {
		return "order_state_changed", nil
	}
	current, err := recallLifecycleCurrentPurchaseStatus(tx, event.UserId, data)
	if err != nil {
		return "", err
	}
	if current == "" {
		return "order_state_changed", nil
	}
	switch event.EventType {
	case model.RecallLifecycleTriggerPaymentPending:
		if current != common.TopUpStatusPending {
			return "order_state_changed", nil
		}
	case model.RecallLifecycleTriggerPaymentSucceeded:
		if current != common.TopUpStatusSuccess {
			return "order_state_changed", nil
		}
	case model.RecallLifecycleTriggerPaymentFailed:
		if current != common.TopUpStatusFailed && current != common.TopUpStatusExpired && current != "cancelled" && current != "canceled" {
			return "order_state_changed", nil
		}
	}
	return "", nil
}

func recallLifecycleCurrentPurchaseStatus(tx *gorm.DB, userID int, data recallLifecyclePurchaseGateData) (string, error) {
	kind := strings.TrimSpace(data.PurchaseKind)
	tradeNo := strings.TrimSpace(data.TradeNo)
	switch kind {
	case model.PurchaseLifecycleKindTopUp:
		var topUp model.TopUp
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("user_id = ?", userID)
		if data.SourceID > 0 {
			query = query.Where("id = ?", data.SourceID)
		} else {
			query = query.Where("trade_no = ?", tradeNo)
		}
		if err := query.First(&topUp).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return "", nil
			}
			return "", err
		}
		return strings.ToLower(strings.TrimSpace(topUp.Status)), nil
	case model.PurchaseLifecycleKindSubscription:
		var order model.SubscriptionOrder
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("user_id = ?", userID)
		if data.SourceID > 0 {
			query = query.Where("id = ?", data.SourceID)
		} else {
			query = query.Where("trade_no = ?", tradeNo)
		}
		if err := query.First(&order).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return "", nil
			}
			return "", err
		}
		return strings.ToLower(strings.TrimSpace(order.Status)), nil
	default:
		return "", nil
	}
}

func normalizeRecallLifecycleSMTPEmail(value string) (string, bool) {
	value = strings.TrimSpace(value)
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value {
		return "", false
	}
	return strings.ToLower(value), true
}
