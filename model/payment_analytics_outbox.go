package model

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	PaymentAnalyticsOutboxPending    = "pending"
	PaymentAnalyticsOutboxDelivering = "delivering"
	PaymentAnalyticsOutboxDelivered  = "delivered"
	PaymentAnalyticsOutboxDead       = "dead"
)

const paymentAnalyticsOutboxDeliveredRetention = 30 * 24 * 60 * 60

// PaymentAnalyticsEvent contains the non-PII purchase facts required for a GA4
// Measurement Protocol purchase event. It is persisted after payment commit so
// analytics delivery can never participate in payment correctness.
type PaymentAnalyticsEvent struct {
	EventID         string
	TransactionID   string
	UserID          int
	Value           float64
	Currency        string
	PaymentProvider string
	PaymentMethod   string
	ProductType     string
	ItemID          string
	ItemName        string
	ClientID        string
	SessionID       string
	OccurredAt      int64
}

type PaymentAnalyticsOutbox struct {
	Id              int64   `json:"id"`
	EventId         string  `json:"event_id" gorm:"type:varchar(255);uniqueIndex"`
	TransactionId   string  `json:"transaction_id" gorm:"type:varchar(255);index"`
	UserId          int     `json:"user_id" gorm:"index"`
	Value           float64 `json:"value"`
	Currency        string  `json:"currency" gorm:"type:varchar(8)"`
	PaymentProvider string  `json:"payment_provider" gorm:"type:varchar(50)"`
	PaymentMethod   string  `json:"payment_method" gorm:"type:varchar(50)"`
	ProductType     string  `json:"product_type" gorm:"type:varchar(32);index"`
	ItemId          string  `json:"item_id" gorm:"type:varchar(255)"`
	ItemName        string  `json:"item_name" gorm:"type:varchar(255)"`
	ClientId        string  `json:"client_id" gorm:"type:varchar(128)"`
	SessionId       string  `json:"session_id" gorm:"type:varchar(128)"`
	OccurredAt      int64   `json:"occurred_at" gorm:"index"`
	Status          string  `json:"status" gorm:"type:varchar(24);index;default:'pending'"`
	Attempts        int     `json:"attempts" gorm:"default:0"`
	NextAttemptAt   int64   `json:"next_attempt_at" gorm:"index;default:0"`
	ClaimedAt       int64   `json:"claimed_at" gorm:"default:0"`
	DeliveredAt     int64   `json:"delivered_at" gorm:"default:0"`
	LastError       string  `json:"last_error" gorm:"type:varchar(512);default:''"`
	CreatedAt       int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

// PaymentAnalyticsEventReceipt retains an event ID after its delivered outbox
// payload has been cleaned up, so a delayed provider replay cannot emit a
// duplicate purchase conversion.
type PaymentAnalyticsEventReceipt struct {
	Id        int64  `json:"id"`
	EventId   string `json:"event_id" gorm:"type:varchar(255);uniqueIndex"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func paymentAnalyticsEventFromTopUp(topUp *TopUp) *PaymentAnalyticsEvent {
	if topUp == nil || topUp.Money <= 0 || topUp.PaymentProvider == PaymentProviderBalance {
		return nil
	}
	currency := strings.ToUpper(strings.TrimSpace(topUp.PaymentCurrency))
	if currency == "" {
		if topUp.PaymentProvider != PaymentProviderEpay {
			return nil
		}
		// Historical ePay orders did not persist currency and were charged in USD.
		currency = "USD"
	}
	return &PaymentAnalyticsEvent{
		EventID:         "flatkey:ga4:purchase:topup:" + topUp.TradeNo,
		TransactionID:   topUp.TradeNo,
		UserID:          topUp.UserId,
		Value:           topUp.Money,
		Currency:        currency,
		PaymentProvider: topUp.PaymentProvider,
		PaymentMethod:   topUp.PaymentMethod,
		ProductType:     "top_up",
		ItemID:          "wallet_top_up",
		ItemName:        "Wallet top-up",
		ClientID:        topUp.GAClientID,
		SessionID:       topUp.GASessionID,
		OccurredAt:      topUp.CompleteTime,
	}
}

func paymentAnalyticsEventFromSubscriptionOrder(order *SubscriptionOrder, planTitle string) *PaymentAnalyticsEvent {
	if order == nil || order.Money <= 0 || order.PaymentProvider == PaymentProviderBalance {
		return nil
	}
	if SubscriptionOrderIsRecallAttributed(order) {
		return nil
	}
	currency := strings.ToUpper(strings.TrimSpace(order.PaymentCurrency))
	if currency == "" {
		currency = "USD"
	}
	return &PaymentAnalyticsEvent{
		EventID:         "flatkey:ga4:purchase:subscription:" + order.TradeNo,
		TransactionID:   order.TradeNo,
		UserID:          order.UserId,
		Value:           order.Money,
		Currency:        currency,
		PaymentProvider: order.PaymentProvider,
		PaymentMethod:   order.PaymentMethod,
		ProductType:     "subscription",
		ItemID:          fmt.Sprintf("subscription_plan_%d", order.PlanId),
		ItemName:        strings.TrimSpace(planTitle),
		ClientID:        order.GAClientID,
		SessionID:       order.GASessionID,
		OccurredAt:      order.CompleteTime,
	}
}

func PaymentAnalyticsEventForSubscription(order *SubscriptionOrder, planTitle string) *PaymentAnalyticsEvent {
	return paymentAnalyticsEventFromSubscriptionOrder(order, planTitle)
}

func SubscriptionOrderIsRecallAttributed(order *SubscriptionOrder) bool {
	if order == nil {
		return false
	}
	return strings.TrimSpace(order.DiscountKind) == "recall" ||
		order.RecallCampaignId > 0 ||
		order.RecallRecipientId > 0 ||
		strings.TrimSpace(order.RecallPromotionCodeId) != "" ||
		order.RecallDiscountAmountMinor > 0
}

func PaymentAnalyticsEventForSubscriptionRenewal(order *SubscriptionOrder, planTitle string, invoiceID string, value float64, currency string, occurredAt int64) *PaymentAnalyticsEvent {
	if order == nil || value <= 0 || strings.TrimSpace(invoiceID) == "" ||
		order.PaymentProvider == PaymentProviderBalance || SubscriptionOrderIsRecallAttributed(order) {
		return nil
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		return nil
	}
	return &PaymentAnalyticsEvent{
		EventID:         "flatkey:ga4:purchase:subscription_renewal:" + strings.TrimSpace(invoiceID),
		TransactionID:   strings.TrimSpace(invoiceID),
		UserID:          order.UserId,
		Value:           value,
		Currency:        currency,
		PaymentProvider: order.PaymentProvider,
		PaymentMethod:   order.PaymentMethod,
		ProductType:     "subscription_renewal",
		ItemID:          fmt.Sprintf("subscription_plan_%d", order.PlanId),
		ItemName:        strings.TrimSpace(planTitle),
		ClientID:        order.GAClientID,
		SessionID:       order.GASessionID,
		OccurredAt:      occurredAt,
	}
}

// EnqueuePaymentAnalyticsBestEffort persists a completed payment event after
// the payment transaction has committed. Failure is intentionally swallowed:
// an analytics outage must never roll back a paid order or entitlement.
func EnqueuePaymentAnalyticsBestEffort(event *PaymentAnalyticsEvent) {
	if event == nil || strings.TrimSpace(event.EventID) == "" || strings.TrimSpace(event.TransactionID) == "" ||
		event.Value <= 0 || strings.TrimSpace(event.Currency) == "" || strings.TrimSpace(event.ClientID) == "" || strings.TrimSpace(event.SessionID) == "" {
		return
	}
	occurredAt := event.OccurredAt
	if occurredAt <= 0 {
		occurredAt = time.Now().Unix()
	}
	outbox := &PaymentAnalyticsOutbox{
		EventId: event.EventID, TransactionId: event.TransactionID, UserId: event.UserID,
		Value: event.Value, Currency: strings.ToUpper(strings.TrimSpace(event.Currency)),
		PaymentProvider: strings.TrimSpace(event.PaymentProvider), PaymentMethod: strings.TrimSpace(event.PaymentMethod),
		ProductType: strings.TrimSpace(event.ProductType), ItemId: strings.TrimSpace(event.ItemID),
		ItemName: strings.TrimSpace(event.ItemName), ClientId: strings.TrimSpace(event.ClientID),
		SessionId: strings.TrimSpace(event.SessionID), OccurredAt: occurredAt,
		Status: PaymentAnalyticsOutboxPending, NextAttemptAt: common.GetTimestamp(),
	}
	if err := paymentAnalyticsOutboxCreate(outbox); err != nil {
		common.SysError("payment analytics outbox enqueue failed event_id=" + outbox.EventId + " error=" + err.Error())
	}
}

var paymentAnalyticsOutboxCreate = func(outbox *PaymentAnalyticsOutbox) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		receipt := &PaymentAnalyticsEventReceipt{EventId: outbox.EventId}
		result := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "event_id"}}, DoNothing: true}).Create(receipt)
		if result.Error != nil || result.RowsAffected == 0 {
			return result.Error
		}
		return tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "event_id"}}, DoNothing: true}).Create(outbox).Error
	})
}

// This indirection lets payment regression tests force an outbox write failure
// without changing payment code paths.
var enqueuePaymentAnalyticsBestEffort = EnqueuePaymentAnalyticsBestEffort

func EnqueuePaymentAnalyticsForTopUpBestEffort(topUp *TopUp) {
	enqueuePaymentAnalyticsBestEffort(paymentAnalyticsEventFromTopUp(topUp))
}

func EnqueuePaymentAnalyticsForSubscriptionBestEffort(order *SubscriptionOrder, planTitle string) {
	enqueuePaymentAnalyticsBestEffort(paymentAnalyticsEventFromSubscriptionOrder(order, planTitle))
}

func ClaimPaymentAnalyticsOutbox(limit int, now int64) ([]PaymentAnalyticsOutbox, error) {
	if limit < 1 {
		limit = 1
	}
	if limit > 100 {
		limit = 100
	}
	staleBefore := now - 10*60
	if err := DB.Model(&PaymentAnalyticsOutbox{}).Where("status = ? AND claimed_at > 0 AND claimed_at < ?", PaymentAnalyticsOutboxDelivering, staleBefore).
		Updates(map[string]any{"status": PaymentAnalyticsOutboxPending, "claimed_at": 0, "next_attempt_at": now}).Error; err != nil {
		return nil, err
	}
	var candidates []PaymentAnalyticsOutbox
	if err := DB.Where("status = ? AND next_attempt_at <= ?", PaymentAnalyticsOutboxPending, now).Order("created_at asc").Limit(limit * 2).Find(&candidates).Error; err != nil {
		return nil, err
	}
	claimed := make([]PaymentAnalyticsOutbox, 0, limit)
	for _, candidate := range candidates {
		result := DB.Model(&PaymentAnalyticsOutbox{}).Where("id = ? AND status = ? AND next_attempt_at <= ?", candidate.Id, PaymentAnalyticsOutboxPending, now).
			Updates(map[string]any{"status": PaymentAnalyticsOutboxDelivering, "claimed_at": now, "attempts": gorm.Expr("attempts + 1")})
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected == 0 {
			continue
		}
		candidate.Status, candidate.ClaimedAt, candidate.Attempts = PaymentAnalyticsOutboxDelivering, now, candidate.Attempts+1
		claimed = append(claimed, candidate)
		if len(claimed) >= limit {
			break
		}
	}
	return claimed, nil
}

func CompletePaymentAnalyticsOutbox(id int64, claimedAt int64, now int64) error {
	result := DB.Model(&PaymentAnalyticsOutbox{}).Where("id = ? AND status = ? AND claimed_at = ?", id, PaymentAnalyticsOutboxDelivering, claimedAt).
		Updates(map[string]any{"status": PaymentAnalyticsOutboxDelivered, "delivered_at": now, "claimed_at": 0, "last_error": ""})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPaymentAnalyticsOutboxLeaseLost
	}
	return nil
}

func FailPaymentAnalyticsOutbox(id int64, claimedAt int64, attempts int, message string, now int64) error {
	message = truncateUTF8Bytes(message, 512)
	status, nextAttemptAt := PaymentAnalyticsOutboxPending, now+int64(30*(1<<min(attempts, 7)))
	if attempts >= 10 {
		status, nextAttemptAt = PaymentAnalyticsOutboxDead, 0
	}
	result := DB.Model(&PaymentAnalyticsOutbox{}).Where("id = ? AND status = ? AND claimed_at = ?", id, PaymentAnalyticsOutboxDelivering, claimedAt).
		Updates(map[string]any{"status": status, "next_attempt_at": nextAttemptAt, "claimed_at": 0, "last_error": message})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPaymentAnalyticsOutboxLeaseLost
	}
	return nil
}

func DeadPaymentAnalyticsOutbox(id int64, claimedAt int64, message string, now int64) error {
	result := DB.Model(&PaymentAnalyticsOutbox{}).Where("id = ? AND status = ? AND claimed_at = ?", id, PaymentAnalyticsOutboxDelivering, claimedAt).
		Updates(map[string]any{"status": PaymentAnalyticsOutboxDead, "next_attempt_at": 0, "claimed_at": 0, "last_error": truncateUTF8Bytes(message, 512)})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPaymentAnalyticsOutboxLeaseLost
	}
	return nil
}

func DeleteDeliveredPaymentAnalyticsOutboxBefore(now int64) error {
	return DB.Where("status = ? AND delivered_at > 0 AND delivered_at < ?", PaymentAnalyticsOutboxDelivered, now-paymentAnalyticsOutboxDeliveredRetention).
		Delete(&PaymentAnalyticsOutbox{}).Error
}

func truncateUTF8Bytes(value string, maxBytes int) string {
	if len(value) <= maxBytes {
		return value
	}
	for maxBytes > 0 && !utf8.RuneStart(value[maxBytes]) {
		maxBytes--
	}
	return value[:maxBytes]
}
