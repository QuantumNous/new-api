package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	PaymentWebhookEventStatusProcessing = "processing"
	PaymentWebhookEventStatusProcessed  = "processed"
	PaymentWebhookEventStatusFailed     = "failed"
)

var ErrSubscriptionProviderBindingConflict = errors.New("subscription provider binding conflict")

type SubscriptionProviderBinding struct {
	Id int64 `json:"id"`

	UserId         int   `json:"user_id" gorm:"index"`
	PlanId         int   `json:"plan_id" gorm:"index"`
	InitialOrderId int   `json:"initial_order_id" gorm:"index"`
	ContractId     int64 `json:"contract_id" gorm:"type:bigint;default:0;index"`

	Provider                   string `json:"provider" gorm:"type:varchar(32);not null;uniqueIndex:idx_provider_subscription,priority:1"`
	ProviderSubscriptionId     string `json:"provider_subscription_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_provider_subscription,priority:2"`
	ProviderSubscriptionItemId string `json:"-" gorm:"type:varchar(128);default:''"`
	ProviderScheduleId         string `json:"-" gorm:"type:varchar(128);default:''"`
	ProviderCustomerId         string `json:"provider_customer_id" gorm:"type:varchar(128);default:''"`
	ProviderPriceId            string `json:"provider_price_id" gorm:"type:varchar(128);default:''"`
	ProviderLatestInvoiceId    string `json:"provider_latest_invoice_id" gorm:"type:varchar(128);default:''"`
	ProviderStatus             string `json:"provider_status" gorm:"type:varchar(64);default:'';index"`

	CancelAtPeriodEnd  bool  `json:"cancel_at_period_end" gorm:"default:false"`
	CurrentPeriodStart int64 `json:"current_period_start" gorm:"type:bigint;default:0"`
	CurrentPeriodEnd   int64 `json:"current_period_end" gorm:"type:bigint;default:0;index"`
	GracePeriodEnd     int64 `json:"grace_period_end" gorm:"type:bigint;default:0"`
	CanceledAt         int64 `json:"canceled_at" gorm:"type:bigint;default:0"`
	EndedAt            int64 `json:"ended_at" gorm:"type:bigint;default:0"`
	Livemode           bool  `json:"livemode" gorm:"default:false"`
	LastSyncedAt       int64 `json:"last_synced_at" gorm:"type:bigint;default:0"`
	LifecycleActionSeq int64 `json:"lifecycle_action_seq" gorm:"type:bigint;default:0"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (b *SubscriptionProviderBinding) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	b.CreatedAt = now
	b.UpdatedAt = now
	if b.LastSyncedAt == 0 {
		b.LastSyncedAt = now
	}
	return nil
}

func (b *SubscriptionProviderBinding) BeforeUpdate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	b.UpdatedAt = now
	if b.LastSyncedAt == 0 {
		b.LastSyncedAt = now
	}
	return nil
}

type PaymentWebhookEvent struct {
	Id int64 `json:"id"`

	Provider         string `json:"provider" gorm:"type:varchar(32);not null;uniqueIndex:idx_payment_webhook_event,priority:1"`
	EventId          string `json:"event_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_payment_webhook_event,priority:2"`
	EventType        string `json:"event_type" gorm:"type:varchar(128);default:'';index"`
	ProviderObjectId string `json:"provider_object_id" gorm:"type:varchar(128);default:'';index"`
	EventCreated     int64  `json:"event_created" gorm:"type:bigint;default:0"`
	Status           string `json:"status" gorm:"type:varchar(32);default:'processing';index"`
	AttemptCount     int    `json:"attempt_count" gorm:"type:int;default:0"`
	ProcessingToken  string `json:"processing_token" gorm:"type:varchar(128);default:'';index"`
	ProcessingUntil  int64  `json:"processing_until" gorm:"type:bigint;default:0;index"`
	PayloadHash      string `json:"payload_hash" gorm:"type:varchar(128);default:''"`
	LastError        string `json:"last_error" gorm:"type:text"`
	ProcessedAt      int64  `json:"processed_at" gorm:"type:bigint;default:0"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

type PaymentWebhookEventClaimState struct {
	Exists          bool
	Status          string
	ProcessingToken string
	ProcessingUntil int64
}

func (e *PaymentWebhookEvent) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	e.CreatedAt = now
	e.UpdatedAt = now
	if e.Status == "" {
		e.Status = PaymentWebhookEventStatusProcessing
	}
	if e.AttemptCount == 0 {
		e.AttemptCount = 1
	}
	return nil
}

func (e *PaymentWebhookEvent) BeforeUpdate(tx *gorm.DB) error {
	e.UpdatedAt = common.GetTimestamp()
	return nil
}

type ProviderSubscriptionSnapshot struct {
	ProviderSubscriptionId     string
	ProviderSubscriptionItemId string
	ProviderScheduleId         string
	ProviderScheduleIdObserved bool
	ProviderCustomerId         string
	ProviderPriceId            string
	ProviderLatestInvoiceId    string
	ProviderStatus             string
	CancelAtPeriodEnd          bool
	CurrentPeriodStart         int64
	CurrentPeriodEnd           int64
	GracePeriodEnd             int64
	CanceledAt                 int64
	EndedAt                    int64
	Livemode                   bool
}

func normalizeProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

func isTerminalProviderSubscriptionStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "canceled", "incomplete_expired", "unpaid":
		return true
	default:
		return false
	}
}

func subscriptionProviderBindingFromSnapshot(order *SubscriptionOrder, snapshot ProviderSubscriptionSnapshot) *SubscriptionProviderBinding {
	return &SubscriptionProviderBinding{
		UserId:                     order.UserId,
		PlanId:                     order.PlanId,
		InitialOrderId:             order.Id,
		Provider:                   PaymentProviderStripe,
		ProviderSubscriptionId:     strings.TrimSpace(snapshot.ProviderSubscriptionId),
		ProviderSubscriptionItemId: strings.TrimSpace(snapshot.ProviderSubscriptionItemId),
		ProviderScheduleId:         strings.TrimSpace(snapshot.ProviderScheduleId),
		ProviderCustomerId:         strings.TrimSpace(snapshot.ProviderCustomerId),
		ProviderPriceId:            strings.TrimSpace(snapshot.ProviderPriceId),
		ProviderLatestInvoiceId:    strings.TrimSpace(snapshot.ProviderLatestInvoiceId),
		ProviderStatus:             strings.TrimSpace(snapshot.ProviderStatus),
		CancelAtPeriodEnd:          snapshot.CancelAtPeriodEnd,
		CurrentPeriodStart:         snapshot.CurrentPeriodStart,
		CurrentPeriodEnd:           snapshot.CurrentPeriodEnd,
		GracePeriodEnd:             snapshot.GracePeriodEnd,
		CanceledAt:                 snapshot.CanceledAt,
		EndedAt:                    snapshot.EndedAt,
		Livemode:                   snapshot.Livemode,
		LastSyncedAt:               common.GetTimestamp(),
	}
}

func findBindingByProviderSubscriptionIDTx(tx *gorm.DB, provider string, providerSubscriptionID string) (*SubscriptionProviderBinding, error) {
	if tx == nil {
		tx = DB
	}
	provider = normalizeProvider(provider)
	providerSubscriptionID = strings.TrimSpace(providerSubscriptionID)
	if provider == "" || providerSubscriptionID == "" {
		return nil, errors.New("provider subscription id is empty")
	}
	var binding SubscriptionProviderBinding
	if err := tx.Where("provider = ? AND provider_subscription_id = ?", provider, providerSubscriptionID).
		First(&binding).Error; err != nil {
		return nil, err
	}
	return &binding, nil
}

func FindBindingByProviderSubscriptionID(provider string, providerSubscriptionID string) (*SubscriptionProviderBinding, error) {
	return findBindingByProviderSubscriptionIDTx(nil, provider, providerSubscriptionID)
}

func FindBindingByIDForUser(bindingID int64, userID int) (*SubscriptionProviderBinding, error) {
	if bindingID <= 0 || userID <= 0 {
		return nil, errors.New("invalid binding lookup")
	}
	var binding SubscriptionProviderBinding
	if err := DB.Where("id = ? AND user_id = ?", bindingID, userID).First(&binding).Error; err != nil {
		return nil, err
	}
	return &binding, nil
}

func GetRecurringSubscriptionBindingsForUser(userID int) ([]SubscriptionProviderBinding, error) {
	if userID <= 0 {
		return nil, errors.New("invalid user id")
	}
	var bindings []SubscriptionProviderBinding
	if err := DB.Where("user_id = ?", userID).
		Order("current_period_end desc, id desc").
		Find(&bindings).Error; err != nil {
		return nil, err
	}
	return bindings, nil
}

func ApplyProviderSubscriptionSnapshot(bindingID int64, snapshot ProviderSubscriptionSnapshot) (*SubscriptionProviderBinding, error) {
	if bindingID <= 0 {
		return nil, errors.New("invalid binding id")
	}
	var binding SubscriptionProviderBinding
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", bindingID).First(&binding).Error; err != nil {
			return err
		}
		if strings.TrimSpace(snapshot.ProviderSubscriptionId) != "" && strings.TrimSpace(snapshot.ProviderSubscriptionId) != binding.ProviderSubscriptionId {
			return ErrSubscriptionProviderBindingConflict
		}
		if binding.EndedAt > 0 || isTerminalProviderSubscriptionStatus(binding.ProviderStatus) {
			return nil
		}
		updates := map[string]interface{}{
			"provider_customer_id":       strings.TrimSpace(snapshot.ProviderCustomerId),
			"provider_price_id":          strings.TrimSpace(snapshot.ProviderPriceId),
			"provider_latest_invoice_id": strings.TrimSpace(snapshot.ProviderLatestInvoiceId),
			"provider_status":            strings.TrimSpace(snapshot.ProviderStatus),
			"cancel_at_period_end":       snapshot.CancelAtPeriodEnd,
			"current_period_start":       snapshot.CurrentPeriodStart,
			"current_period_end":         snapshot.CurrentPeriodEnd,
			"grace_period_end":           snapshot.GracePeriodEnd,
			"canceled_at":                snapshot.CanceledAt,
			"ended_at":                   snapshot.EndedAt,
			"livemode":                   snapshot.Livemode,
			"last_synced_at":             common.GetTimestamp(),
			"updated_at":                 common.GetTimestamp(),
		}
		if providerSubscriptionItemID := strings.TrimSpace(snapshot.ProviderSubscriptionItemId); providerSubscriptionItemID != "" {
			updates["provider_subscription_item_id"] = providerSubscriptionItemID
		}
		if snapshot.ProviderScheduleIdObserved {
			updates["provider_schedule_id"] = strings.TrimSpace(snapshot.ProviderScheduleId)
		}
		if snapshot.CancelAtPeriodEnd != binding.CancelAtPeriodEnd {
			updates["lifecycle_action_seq"] = binding.LifecycleActionSeq + 1
		}
		if err := tx.Model(&binding).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", bindingID).First(&binding).Error
	})
	if err != nil {
		return nil, err
	}
	return &binding, nil
}

func ApplyProviderSubscriptionTermination(bindingID int64, snapshot ProviderSubscriptionSnapshot) (*SubscriptionProviderBinding, error) {
	if bindingID <= 0 {
		return nil, errors.New("invalid binding id")
	}
	now := common.GetTimestamp()
	if snapshot.EndedAt <= 0 {
		snapshot.EndedAt = now
	}
	if strings.TrimSpace(snapshot.ProviderStatus) == "" {
		snapshot.ProviderStatus = "canceled"
	}
	var binding SubscriptionProviderBinding
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", bindingID).First(&binding).Error; err != nil {
			return err
		}
		if strings.TrimSpace(snapshot.ProviderSubscriptionId) != "" && strings.TrimSpace(snapshot.ProviderSubscriptionId) != binding.ProviderSubscriptionId {
			return ErrSubscriptionProviderBindingConflict
		}
		updates := map[string]interface{}{
			"provider_customer_id":       strings.TrimSpace(snapshot.ProviderCustomerId),
			"provider_price_id":          strings.TrimSpace(snapshot.ProviderPriceId),
			"provider_latest_invoice_id": strings.TrimSpace(snapshot.ProviderLatestInvoiceId),
			"provider_status":            strings.TrimSpace(snapshot.ProviderStatus),
			"cancel_at_period_end":       false,
			"current_period_start":       snapshot.CurrentPeriodStart,
			"current_period_end":         snapshot.CurrentPeriodEnd,
			"grace_period_end":           snapshot.GracePeriodEnd,
			"canceled_at":                snapshot.CanceledAt,
			"ended_at":                   snapshot.EndedAt,
			"livemode":                   snapshot.Livemode,
			"last_synced_at":             now,
			"updated_at":                 now,
		}
		if providerSubscriptionItemID := strings.TrimSpace(snapshot.ProviderSubscriptionItemId); providerSubscriptionItemID != "" {
			updates["provider_subscription_item_id"] = providerSubscriptionItemID
		}
		if snapshot.ProviderScheduleIdObserved {
			updates["provider_schedule_id"] = strings.TrimSpace(snapshot.ProviderScheduleId)
		}
		if binding.CancelAtPeriodEnd {
			updates["lifecycle_action_seq"] = binding.LifecycleActionSeq + 1
		}
		if err := tx.Model(&binding).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.Model(&UserSubscription{}).
			Where("provider_binding_id = ? AND status = ?", bindingID, "active").
			Updates(map[string]interface{}{
				"status":     "cancelled",
				"end_time":   now,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", bindingID).First(&binding).Error
	})
	if err != nil {
		return nil, err
	}
	return &binding, nil
}

func createOrLoadProviderBindingTx(tx *gorm.DB, order *SubscriptionOrder, snapshot ProviderSubscriptionSnapshot) (*SubscriptionProviderBinding, error) {
	if tx == nil || order == nil {
		return nil, errors.New("invalid provider binding args")
	}
	if strings.TrimSpace(snapshot.ProviderSubscriptionId) == "" {
		return nil, errors.New("provider subscription id is empty")
	}
	binding, err := findBindingByProviderSubscriptionIDTx(tx, PaymentProviderStripe, snapshot.ProviderSubscriptionId)
	if err == nil {
		if binding.UserId == order.UserId && binding.PlanId == order.PlanId && binding.InitialOrderId == order.Id {
			return binding, nil
		}
		return nil, ErrSubscriptionProviderBindingConflict
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	binding = subscriptionProviderBindingFromSnapshot(order, snapshot)
	if err := tx.Create(binding).Error; err != nil {
		existing, findErr := findBindingByProviderSubscriptionIDTx(tx, PaymentProviderStripe, snapshot.ProviderSubscriptionId)
		if findErr == nil {
			if existing.UserId == order.UserId && existing.PlanId == order.PlanId && existing.InitialOrderId == order.Id {
				return existing, nil
			}
			return nil, ErrSubscriptionProviderBindingConflict
		}
		return nil, err
	}
	return binding, nil
}

func RecordPaymentWebhookEventProcessing(provider string, eventID string, eventType string, providerObjectID string, eventCreated int64, payloadHash string) (bool, error) {
	provider = normalizeProvider(provider)
	eventID = strings.TrimSpace(eventID)
	if provider == "" || eventID == "" {
		return false, errors.New("provider and event id are required")
	}
	event := &PaymentWebhookEvent{
		Provider:         provider,
		EventId:          eventID,
		EventType:        strings.TrimSpace(eventType),
		ProviderObjectId: strings.TrimSpace(providerObjectID),
		EventCreated:     eventCreated,
		Status:           PaymentWebhookEventStatusProcessing,
		AttemptCount:     1,
		PayloadHash:      strings.TrimSpace(payloadHash),
	}
	if err := DB.Create(event).Error; err != nil {
		var existing PaymentWebhookEvent
		if findErr := DB.Where("provider = ? AND event_id = ?", provider, eventID).First(&existing).Error; findErr == nil {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func ClaimPaymentWebhookEventProcessing(provider string, eventID string, eventType string, providerObjectID string, eventCreated int64, payloadHash string) (bool, error) {
	now := common.GetTimestamp()
	return ClaimPaymentWebhookEventLease(provider, eventID, eventType, providerObjectID, eventCreated, payloadHash, eventID, now+300)
}

func ClaimPaymentWebhookEventLease(provider string, eventID string, eventType string, providerObjectID string, eventCreated int64, payloadHash string, processingToken string, processingUntil int64) (bool, error) {
	provider = normalizeProvider(provider)
	eventID = strings.TrimSpace(eventID)
	if provider == "" || eventID == "" {
		return false, errors.New("provider and event id are required")
	}
	processingToken = strings.TrimSpace(processingToken)
	if processingToken == "" {
		return false, errors.New("processing token is required")
	}
	now := common.GetTimestamp()
	if processingUntil <= now {
		processingUntil = now + 300
	}
	event := &PaymentWebhookEvent{
		Provider:         provider,
		EventId:          eventID,
		EventType:        strings.TrimSpace(eventType),
		ProviderObjectId: strings.TrimSpace(providerObjectID),
		EventCreated:     eventCreated,
		Status:           PaymentWebhookEventStatusProcessing,
		AttemptCount:     1,
		ProcessingToken:  processingToken,
		ProcessingUntil:  processingUntil,
		PayloadHash:      strings.TrimSpace(payloadHash),
	}
	insert := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(event)
	if insert.Error != nil {
		return false, insert.Error
	}
	if insert.RowsAffected == 1 {
		return true, nil
	}
	updates := map[string]interface{}{
		"event_type":         strings.TrimSpace(eventType),
		"provider_object_id": strings.TrimSpace(providerObjectID),
		"event_created":      eventCreated,
		"status":             PaymentWebhookEventStatusProcessing,
		"attempt_count":      gorm.Expr("attempt_count + ?", 1),
		"processing_token":   processingToken,
		"processing_until":   processingUntil,
		"payload_hash":       strings.TrimSpace(payloadHash),
		"last_error":         "",
		"updated_at":         now,
	}
	result := DB.Model(&PaymentWebhookEvent{}).
		Where("provider = ? AND event_id = ? AND status <> ?", provider, eventID, PaymentWebhookEventStatusProcessed).
		Where("processing_token = ? OR processing_until <= ?", "", now).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func GetPaymentWebhookEventClaimState(provider string, eventID string) (PaymentWebhookEventClaimState, error) {
	provider = normalizeProvider(provider)
	eventID = strings.TrimSpace(eventID)
	if provider == "" || eventID == "" {
		return PaymentWebhookEventClaimState{}, errors.New("provider and event id are required")
	}
	var event PaymentWebhookEvent
	if err := DB.Select("status", "processing_token", "processing_until").
		Where("provider = ? AND event_id = ?", provider, eventID).
		First(&event).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return PaymentWebhookEventClaimState{}, nil
		}
		return PaymentWebhookEventClaimState{}, err
	}
	return PaymentWebhookEventClaimState{
		Exists:          true,
		Status:          event.Status,
		ProcessingToken: event.ProcessingToken,
		ProcessingUntil: event.ProcessingUntil,
	}, nil
}

func claimFailedPaymentWebhookEventForRetry(existing PaymentWebhookEvent, eventType string, providerObjectID string, eventCreated int64, payloadHash string) (bool, error) {
	updates := map[string]interface{}{
		"event_type":         strings.TrimSpace(eventType),
		"provider_object_id": strings.TrimSpace(providerObjectID),
		"event_created":      eventCreated,
		"status":             PaymentWebhookEventStatusProcessing,
		"attempt_count":      existing.AttemptCount + 1,
		"payload_hash":       strings.TrimSpace(payloadHash),
		"last_error":         "",
		"updated_at":         common.GetTimestamp(),
	}
	result := DB.Model(&PaymentWebhookEvent{}).
		Where("provider = ? AND event_id = ? AND status = ?", existing.Provider, existing.EventId, PaymentWebhookEventStatusFailed).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, nil
	}
	return true, nil
}

func MarkPaymentWebhookEventProcessed(provider string, eventID string) error {
	return MarkPaymentWebhookEventProcessedByToken(provider, eventID, "")
}

func MarkPaymentWebhookEventProcessedByToken(provider string, eventID string, processingToken string) error {
	provider = normalizeProvider(provider)
	eventID = strings.TrimSpace(eventID)
	if provider == "" || eventID == "" {
		return nil
	}
	now := common.GetTimestamp()
	query := DB.Model(&PaymentWebhookEvent{}).
		Where("provider = ? AND event_id = ?", provider, eventID).
		Where("status <> ?", PaymentWebhookEventStatusProcessed)
	if strings.TrimSpace(processingToken) != "" {
		query = query.Where("processing_token = ?", strings.TrimSpace(processingToken))
	}
	return query.Updates(map[string]interface{}{
		"status":           PaymentWebhookEventStatusProcessed,
		"processed_at":     now,
		"processing_token": "",
		"processing_until": 0,
		"updated_at":       now,
	}).Error
}

func MarkPaymentWebhookEventFailed(provider string, eventID string, processingErr error) error {
	return MarkPaymentWebhookEventFailedByToken(provider, eventID, "", processingErr)
}

func MarkPaymentWebhookEventFailedByToken(provider string, eventID string, processingToken string, processingErr error) error {
	provider = normalizeProvider(provider)
	eventID = strings.TrimSpace(eventID)
	if provider == "" || eventID == "" {
		return nil
	}
	now := common.GetTimestamp()
	lastError := ""
	if processingErr != nil {
		lastError = processingErr.Error()
	}
	query := DB.Model(&PaymentWebhookEvent{}).
		Where("provider = ? AND event_id = ?", provider, eventID).
		Where("status <> ?", PaymentWebhookEventStatusProcessed)
	if strings.TrimSpace(processingToken) != "" {
		query = query.Where("processing_token = ?", strings.TrimSpace(processingToken))
	}
	return query.Updates(map[string]interface{}{
		"status":           PaymentWebhookEventStatusFailed,
		"processing_token": "",
		"processing_until": 0,
		"last_error":       lastError,
		"updated_at":       now,
	}).Error
}

func CompleteSubscriptionOrderWithProviderBinding(tradeNo string, providerPayload string, expectedPaymentProvider string, actualPaymentMethod string, snapshot ProviderSubscriptionSnapshot) (*SubscriptionProviderBinding, error) {
	if strings.TrimSpace(tradeNo) == "" {
		return nil, errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	var result *SubscriptionProviderBinding
	var logUserId int
	var logPlanTitle string
	var logMoney float64
	var logPaymentMethod string
	var upgradeGroup string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return ErrSubscriptionOrderNotFound
		}
		if expectedPaymentProvider != "" && order.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		binding, err := createOrLoadProviderBindingTx(tx, &order, snapshot)
		if err != nil {
			return err
		}
		result = binding
		if order.Status == common.TopUpStatusSuccess {
			return nil
		}
		if order.Status != common.TopUpStatusPending {
			return ErrSubscriptionOrderStatusInvalid
		}
		plan, err := getSubscriptionPlanByIdTx(tx, order.PlanId)
		if err != nil {
			return err
		}
		upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
		if _, err := createUserSubscriptionFromPlanTx(tx, order.UserId, plan, "order", binding.Id); err != nil {
			return err
		}
		if err := upsertSubscriptionTopUpTx(tx, &order); err != nil {
			return err
		}
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = common.GetTimestamp()
		if providerPayload != "" {
			order.ProviderPayload = providerPayload
		}
		if actualPaymentMethod != "" && order.PaymentMethod != actualPaymentMethod {
			order.PaymentMethod = actualPaymentMethod
		}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		logUserId = order.UserId
		logPlanTitle = plan.Title
		logMoney = order.Money
		logPaymentMethod = order.PaymentMethod
		return nil
	})
	if err != nil {
		return nil, err
	}
	if upgradeGroup != "" && logUserId > 0 {
		_ = UpdateUserGroupCache(logUserId, upgradeGroup)
	}
	if logUserId > 0 {
		msg := fmt.Sprintf("Subscription purchase succeeded, plan: %s, amount: %.2f, payment method: %s", logPlanTitle, logMoney, logPaymentMethod)
		RecordLog(logUserId, LogTypeTopup, msg)
	}
	return result, nil
}
