package model

import (
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const CreemRecurringSource = "creem_recurring"

const (
	CreemCheckoutReservationTTL             = 30 * 60
	CreemReconciliationResolved             = "resolved"
	CreemReconciliationUnresolved           = "unresolved"
	CreemFinancialNoticePendingManualReview = "pending_manual_review"
	CreemFinancialDecisionRecordOnly        = "record_only"
)

var ErrCreemSubscriptionLinkNotFound = errors.New("creem subscription link not found")
var ErrCreemCheckoutAlreadyPending = errors.New("a Creem subscription checkout is already pending")

type CreemWebhookEvent struct {
	Id               int    `json:"id"`
	ProviderEventId  string `json:"provider_event_id" gorm:"uniqueIndex;type:varchar(128);not null"`
	EventType        string `json:"event_type" gorm:"type:varchar(64);not null"`
	PayloadHash      string `json:"payload_hash" gorm:"type:varchar(64);not null"`
	ProcessingStatus string `json:"processing_status" gorm:"type:varchar(16);not null"`
	ProcessingError  string `json:"processing_error" gorm:"type:text"`
	ProcessedAt      int64  `json:"processed_at" gorm:"type:bigint"`
	CreatedAt        int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt        int64  `json:"updated_at" gorm:"type:bigint"`
}

type CreemSubscriptionLink struct {
	Id                        int    `json:"id"`
	CreemSubscriptionId       string `json:"creem_subscription_id" gorm:"uniqueIndex;type:varchar(128);not null"`
	UserId                    int    `json:"user_id" gorm:"index;not null"`
	PlanId                    int    `json:"plan_id" gorm:"index;not null"`
	CurrentUserSubscriptionId int    `json:"current_user_subscription_id" gorm:"index"`
	CustomerId                string `json:"customer_id" gorm:"type:varchar(128)"`
	ProductId                 string `json:"product_id" gorm:"type:varchar(128)"`
	ProviderStatus            string `json:"provider_status" gorm:"type:varchar(32);index"`
	PeriodStart               int64  `json:"period_start" gorm:"type:bigint"`
	PeriodEnd                 int64  `json:"period_end" gorm:"type:bigint"`
	LastEventAt               int64  `json:"last_event_at" gorm:"type:bigint"`
	ExpectedAmount            int64  `json:"expected_amount"`
	Currency                  string `json:"currency" gorm:"type:varchar(8)"`
	AmountTotal               int64  `json:"amount_total" gorm:"type:bigint"`
	AllowWalletOverflow       bool   `json:"allow_wallet_overflow"`
	UpgradeGroup              string `json:"upgrade_group" gorm:"type:varchar(64)"`
	DowngradeGroup            string `json:"downgrade_group" gorm:"type:varchar(64)"`
	PrevUserGroup             string `json:"prev_user_group" gorm:"type:varchar(64)"`
	CancelAtPeriodEnd         bool   `json:"cancel_at_period_end"`
	CreatedAt                 int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt                 int64  `json:"updated_at" gorm:"type:bigint"`
}

type CreemSubscriptionPayment struct {
	Id                   int    `json:"id"`
	CreemTransactionId   string `json:"creem_transaction_id" gorm:"uniqueIndex;type:varchar(128);not null"`
	CreemEventId         string `json:"creem_event_id" gorm:"type:varchar(128);index"`
	CreemOrderId         string `json:"creem_order_id" gorm:"type:varchar(128)"`
	CreemSubscriptionId  string `json:"creem_subscription_id" gorm:"type:varchar(128);index;not null"`
	UserId               int    `json:"user_id" gorm:"index;not null"`
	PlanId               int    `json:"plan_id" gorm:"index;not null"`
	UserSubscriptionId   int    `json:"user_subscription_id" gorm:"index;not null"`
	ReconciliationStatus string `json:"reconciliation_status" gorm:"type:varchar(16);index;not null;default:'resolved'"`
	Amount               int64  `json:"amount"`
	Currency             string `json:"currency" gorm:"type:varchar(8)"`
	PeriodStart          int64  `json:"period_start" gorm:"type:bigint"`
	PeriodEnd            int64  `json:"period_end" gorm:"type:bigint"`
	CreatedAt            int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt            int64  `json:"updated_at" gorm:"type:bigint"`
}

type CreemSubscriptionCheckoutReservation struct {
	Id        int    `json:"id"`
	UserId    int    `json:"user_id" gorm:"uniqueIndex;not null"`
	TradeNo   string `json:"trade_no" gorm:"uniqueIndex;type:varchar(255);not null"`
	ExpiresAt int64  `json:"expires_at" gorm:"type:bigint;index;not null"`
	CreatedAt int64  `json:"created_at" gorm:"type:bigint"`
}

type CreemFinancialNotice struct {
	Id                  int    `json:"id"`
	ProviderEventId     string `json:"provider_event_id" gorm:"uniqueIndex;type:varchar(128);not null"`
	EventType           string `json:"event_type" gorm:"type:varchar(64);not null"`
	ObjectId            string `json:"object_id" gorm:"type:varchar(128);index"`
	CreemTransactionId  string `json:"creem_transaction_id" gorm:"type:varchar(128);index"`
	CreemSubscriptionId string `json:"creem_subscription_id" gorm:"type:varchar(128);index"`
	CreemPaymentId      int    `json:"creem_payment_id" gorm:"index"`
	UserId              int    `json:"user_id" gorm:"index"`
	Amount              int64  `json:"amount"`
	Currency            string `json:"currency" gorm:"type:varchar(8)"`
	ProviderStatus      string `json:"provider_status" gorm:"type:varchar(32)"`
	Status              string `json:"status" gorm:"type:varchar(32);index;not null"`
	Decision            string `json:"decision" gorm:"type:varchar(32);not null"`
	CreatedAt           int64  `json:"created_at" gorm:"type:bigint"`
}

type CreemFinancialNoticeInput struct {
	EventId, EventType, PayloadHash, ObjectId, TransactionId, SubscriptionId string
	Amount                                                                   int64
	Currency, ProviderStatus                                                 string
}

type CreemPaymentInput struct {
	EventId, EventType, PayloadHash, TradeNo, OrderId, SubscriptionId string
	TransactionId, CustomerId, ProductId, ProviderStatus, Currency    string
	Amount, PeriodStart, PeriodEnd, EventCreatedAt                    int64
}

func beginCreemEventTx(tx *gorm.DB, input CreemPaymentInput) (bool, *CreemWebhookEvent, error) {
	if strings.TrimSpace(input.EventId) == "" || strings.TrimSpace(input.EventType) == "" || strings.TrimSpace(input.PayloadHash) == "" {
		return false, nil, errors.New("invalid creem event identity")
	}
	var existing CreemWebhookEvent
	result := tx.Where("provider_event_id = ?", input.EventId).First(&existing)
	if result.Error == nil {
		if existing.PayloadHash != input.PayloadHash || existing.EventType != input.EventType {
			return false, nil, errors.New("creem event identity payload mismatch")
		}
		return existing.ProcessingStatus == "processed", &existing, nil
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return false, nil, result.Error
	}
	now := common.GetTimestamp()
	event := &CreemWebhookEvent{ProviderEventId: input.EventId, EventType: input.EventType, PayloadHash: input.PayloadHash, ProcessingStatus: "processing", CreatedAt: now, UpdatedAt: now}
	if err := tx.Create(event).Error; err != nil {
		return false, nil, err
	}
	return false, event, nil
}

func finishCreemEventTx(tx *gorm.DB, event *CreemWebhookEvent) error {
	now := common.GetTimestamp()
	return tx.Model(event).Updates(map[string]any{"processing_status": "processed", "processing_error": "", "processed_at": now, "updated_at": now}).Error
}

func validateCreemPayment(input CreemPaymentInput) error {
	if strings.TrimSpace(input.SubscriptionId) == "" || strings.TrimSpace(input.TransactionId) == "" || strings.TrimSpace(input.ProductId) == "" {
		return errors.New("missing creem subscription, transaction, or product id")
	}
	if input.PeriodStart <= 0 || input.PeriodEnd <= input.PeriodStart {
		return errors.New("invalid creem subscription period")
	}
	return nil
}

func validateCreemPlanPayment(plan *SubscriptionPlan, input CreemPaymentInput) error {
	if plan == nil || strings.TrimSpace(plan.CreemProductId) == "" || plan.CreemProductId != input.ProductId {
		return errors.New("creem product does not match subscription plan")
	}
	expectedAmount := int64(math.Round(plan.PriceAmount * 100))
	if expectedAmount <= 0 || input.Amount != expectedAmount {
		return fmt.Errorf("creem payment amount mismatch: expected %d, got %d", expectedAmount, input.Amount)
	}
	if strings.TrimSpace(plan.Currency) == "" || !strings.EqualFold(plan.Currency, input.Currency) {
		return errors.New("creem payment currency does not match subscription plan")
	}
	return nil
}

func validateCreemLinkPayment(link *CreemSubscriptionLink, input CreemPaymentInput) error {
	if link == nil || strings.TrimSpace(link.ProductId) == "" || link.ProductId != input.ProductId {
		return errors.New("creem product does not match subscription contract")
	}
	if link.ExpectedAmount <= 0 || input.Amount != link.ExpectedAmount {
		return fmt.Errorf("creem payment amount mismatch: expected %d, got %d", link.ExpectedAmount, input.Amount)
	}
	if strings.TrimSpace(link.Currency) == "" || !strings.EqualFold(link.Currency, input.Currency) {
		return errors.New("creem payment currency does not match subscription contract")
	}
	return nil
}

func creemPlanSnapshot(link *CreemSubscriptionLink) (*SubscriptionPlan, error) {
	if link == nil || link.PlanId <= 0 || link.ExpectedAmount <= 0 {
		return nil, errors.New("creem subscription contract snapshot is invalid")
	}
	allowWalletOverflow := link.AllowWalletOverflow
	return &SubscriptionPlan{
		Id:                  link.PlanId,
		PriceAmount:         float64(link.ExpectedAmount) / 100,
		Currency:            link.Currency,
		DurationUnit:        SubscriptionDurationMonth,
		DurationValue:       1,
		CreemProductId:      link.ProductId,
		MaxPurchasePerUser:  0,
		UpgradeGroup:        link.UpgradeGroup,
		DowngradeGroup:      link.DowngradeGroup,
		TotalAmount:         link.AmountTotal,
		QuotaResetPeriod:    SubscriptionResetNever,
		AllowWalletOverflow: &allowWalletOverflow,
	}, nil
}

func staleCreemStateEvent(link *CreemSubscriptionLink, input CreemPaymentInput) bool {
	if link == nil {
		return false
	}
	if input.EventCreatedAt > 0 && link.LastEventAt > 0 && input.EventCreatedAt < link.LastEventAt {
		return true
	}
	// Equal provider timestamps are resolved in favor of an already-active
	// same-period recovery. Duplicate deliveries share an event ID and are caught
	// by idempotency; distinct same-millisecond active/terminal event pairs must
	// converge to active regardless of delivery order. A provider-active
	// subscription being canceled locally is harder to recover from than a
	// swallowed terminal event, which is logged for manual review.
	if input.EventCreatedAt > 0 && input.EventCreatedAt == link.LastEventAt &&
		input.PeriodStart == link.PeriodStart && input.PeriodEnd == link.PeriodEnd &&
		(link.ProviderStatus == "active" || link.ProviderStatus == "trialing") && creemTerminalStatus(input.ProviderStatus) {
		return true
	}
	return input.PeriodEnd > 0 && link.PeriodEnd > 0 && input.PeriodEnd < link.PeriodEnd
}

func logStaleCreemTerminalEvent(input CreemPaymentInput) {
	if !creemTerminalStatus(input.ProviderStatus) {
		return
	}
	common.SysLog(fmt.Sprintf("warning: stale Creem terminal lifecycle event requires manual review event_id=%s subscription_id=%s event_type=%s event_created_at=%d", input.EventId, input.SubscriptionId, input.EventType, input.EventCreatedAt))
}

func creemTerminalStatus(status string) bool {
	switch status {
	case "canceled", "expired", "paused":
		return true
	default:
		return false
	}
}

func validateExistingCreemPayment(existing *CreemSubscriptionPayment, input CreemPaymentInput) error {
	if existing == nil || existing.CreemSubscriptionId != input.SubscriptionId || existing.PeriodStart != input.PeriodStart || existing.PeriodEnd != input.PeriodEnd {
		return errors.New("creem transaction identity mismatch")
	}
	if input.Amount > 0 && existing.Amount != input.Amount {
		return errors.New("creem transaction amount mismatch")
	}
	if input.Currency != "" && !strings.EqualFold(existing.Currency, input.Currency) {
		return errors.New("creem transaction currency mismatch")
	}
	return nil
}

func setCreemSubscriptionPeriodTx(tx *gorm.DB, subscription *UserSubscription, plan *SubscriptionPlan, start, end int64) error {
	if subscription == nil || plan == nil || end <= start {
		return errors.New("invalid creem entitlement period")
	}
	allowWalletOverflow := true
	if plan.AllowWalletOverflow != nil {
		allowWalletOverflow = *plan.AllowWalletOverflow
	}
	subscription.AmountTotal = plan.TotalAmount
	subscription.AmountUsed = 0
	subscription.StartTime = start
	subscription.EndTime = end
	subscription.Status = "active"
	subscription.Source = CreemRecurringSource
	subscription.AllowWalletOverflow = allowWalletOverflow
	subscription.LastResetTime = 0
	subscription.NextResetTime = 0
	return tx.Save(subscription).Error
}

func upsertCreemLinkTx(tx *gorm.DB, input CreemPaymentInput, order *SubscriptionOrder, plan *SubscriptionPlan, subscription *UserSubscription) (*CreemSubscriptionLink, error) {
	if subscription == nil {
		return nil, errors.New("creem subscription entitlement is missing")
	}
	var link CreemSubscriptionLink
	result := tx.Where("creem_subscription_id = ?", input.SubscriptionId).First(&link)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		link = CreemSubscriptionLink{CreemSubscriptionId: input.SubscriptionId, UserId: order.UserId, PlanId: order.PlanId, CreatedAt: common.GetTimestamp()}
	} else if result.Error != nil {
		return nil, result.Error
	} else if link.UserId != order.UserId || link.PlanId != order.PlanId {
		return nil, errors.New("creem subscription link ownership mismatch")
	}
	if plan == nil {
		return nil, errors.New("creem subscription plan snapshot is missing")
	}
	allowWalletOverflow := true
	if plan.AllowWalletOverflow != nil {
		allowWalletOverflow = *plan.AllowWalletOverflow
	}
	link.CurrentUserSubscriptionId = subscription.Id
	link.CustomerId = input.CustomerId
	link.ProductId = input.ProductId
	link.ProviderStatus = input.ProviderStatus
	link.PeriodStart = input.PeriodStart
	link.PeriodEnd = input.PeriodEnd
	link.LastEventAt = input.EventCreatedAt
	link.ExpectedAmount = input.Amount
	link.Currency = input.Currency
	link.AmountTotal = plan.TotalAmount
	link.AllowWalletOverflow = allowWalletOverflow
	link.UpgradeGroup = plan.UpgradeGroup
	link.DowngradeGroup = plan.DowngradeGroup
	if link.Id == 0 {
		link.PrevUserGroup = subscription.PrevUserGroup
	}
	link.UpdatedAt = common.GetTimestamp()
	if link.Id == 0 {
		if err := tx.Create(&link).Error; err != nil {
			return nil, err
		}
	} else if err := tx.Save(&link).Error; err != nil {
		return nil, err
	}
	return &link, nil
}

func createCreemPaymentTx(tx *gorm.DB, input CreemPaymentInput, link *CreemSubscriptionLink, subscriptionId int, reconciliationStatus string) error {
	payment := &CreemSubscriptionPayment{CreemTransactionId: input.TransactionId, CreemEventId: input.EventId, CreemOrderId: input.OrderId, CreemSubscriptionId: input.SubscriptionId, UserId: link.UserId, PlanId: link.PlanId, UserSubscriptionId: subscriptionId, ReconciliationStatus: reconciliationStatus, Amount: input.Amount, Currency: input.Currency, PeriodStart: input.PeriodStart, PeriodEnd: input.PeriodEnd, CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp()}
	return tx.Create(payment).Error
}

func createHistoricalCreemPaymentTx(tx *gorm.DB, input CreemPaymentInput, link *CreemSubscriptionLink) error {
	var matching UserSubscription
	result := tx.Where("user_id = ? AND plan_id = ? AND start_time = ? AND end_time = ? AND source = ?", link.UserId, link.PlanId, input.PeriodStart, input.PeriodEnd, CreemRecurringSource).First(&matching)
	if result.Error == nil {
		return createCreemPaymentTx(tx, input, link, matching.Id, CreemReconciliationResolved)
	} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
	}
	return createCreemPaymentTx(tx, input, link, 0, CreemReconciliationUnresolved)
}

// ProcessCreemInitialPayment atomically completes a pending local order, links
// the provider subscription, records the funds transaction, and processes the event.
func ProcessCreemInitialPayment(input CreemPaymentInput, providerPayload string) error {
	if err := validateCreemPayment(input); err != nil {
		return err
	}
	if strings.TrimSpace(input.TradeNo) == "" {
		return errors.New("missing trusted creem trade number")
	}
	var activatedUserId int
	var activatedGroup string
	var logPlanTitle string
	var logMoney float64
	var logPaymentMethod string
	err := DB.Transaction(func(tx *gorm.DB) error {
		done, event, err := beginCreemEventTx(tx, input)
		if err != nil || done {
			return err
		}
		var existing CreemSubscriptionPayment
		paymentResult := tx.Where("creem_transaction_id = ?", input.TransactionId).First(&existing)
		if paymentResult.Error == nil {
			if err := validateExistingCreemPayment(&existing, input); err != nil {
				return err
			}
			return finishCreemEventTx(tx, event)
		}
		if !errors.Is(paymentResult.Error, gorm.ErrRecordNotFound) {
			return paymentResult.Error
		}
		var orderForSettlement SubscriptionOrder
		if err := lockForUpdate(tx).Where("trade_no = ?", input.TradeNo).First(&orderForSettlement).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrSubscriptionOrderNotFound
			}
			return err
		}
		if orderForSettlement.Status == common.TopUpStatusExpired && orderForSettlement.PaymentProvider == PaymentProviderCreem {
			// Provider checkout URLs remain payable after the local reservation expires,
			// so expiry gates replacement checkout creation, not settlement. Paying two
			// different checkout URLs can still create two links; ops refunds that accepted
			// v1 edge case manually.
			if err := tx.Model(&orderForSettlement).Updates(map[string]any{"status": common.TopUpStatusPending, "complete_time": 0}).Error; err != nil {
				return err
			}
		}
		order, plan, subscription, completedNow, err := CompleteSubscriptionOrderTx(tx, input.TradeNo, providerPayload, PaymentProviderCreem, "")
		if err != nil {
			return err
		}
		if err := validateCreemPlanPayment(plan, input); err != nil {
			return err
		}
		if subscription == nil {
			return errors.New("completed creem order has no entitlement")
		}
		if err := setCreemSubscriptionPeriodTx(tx, subscription, plan, input.PeriodStart, input.PeriodEnd); err != nil {
			return err
		}
		link, err := upsertCreemLinkTx(tx, input, order, plan, subscription)
		if err != nil {
			return err
		}
		if err := createCreemPaymentTx(tx, input, link, subscription.Id, CreemReconciliationResolved); err != nil {
			return err
		}
		if err := tx.Where("trade_no = ?", input.TradeNo).Delete(&CreemSubscriptionCheckoutReservation{}).Error; err != nil {
			return err
		}
		if completedNow {
			activatedUserId = order.UserId
			activatedGroup = strings.TrimSpace(plan.UpgradeGroup)
			logPlanTitle = plan.Title
			logMoney = order.Money
			logPaymentMethod = order.PaymentMethod
		}
		return finishCreemEventTx(tx, event)
	})
	if err != nil {
		return err
	}
	if activatedUserId > 0 && activatedGroup != "" {
		_ = UpdateUserGroupCache(activatedUserId, activatedGroup)
	}
	if activatedUserId > 0 {
		RecordLog(activatedUserId, LogTypeTopup, fmt.Sprintf("订阅购买成功，套餐: %s，支付金额: %.2f，支付方式: %s", logPlanTitle, logMoney, logPaymentMethod))
	}
	return nil
}

// ProcessCreemRenewal creates exactly one entitlement for a new funds transaction.
func ProcessCreemRenewal(input CreemPaymentInput, providerPayload string) error {
	if err := validateCreemPayment(input); err != nil {
		return err
	}
	var activatedUserId int
	var activatedGroup string
	var renewalLogUserId int
	var renewalLogPlanId int
	var renewalLogAmount int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		done, event, err := beginCreemEventTx(tx, input)
		if err != nil || done {
			return err
		}
		var link CreemSubscriptionLink
		if err := lockForUpdate(tx).Where("creem_subscription_id = ?", input.SubscriptionId).First(&link).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCreemSubscriptionLinkNotFound
			}
			return err
		}
		var existing CreemSubscriptionPayment
		paymentResult := tx.Where("creem_transaction_id = ?", input.TransactionId).First(&existing)
		if paymentResult.Error == nil {
			if err := validateExistingCreemPayment(&existing, input); err != nil {
				return err
			}
			if existing.UserId != link.UserId || existing.PlanId != link.PlanId {
				return errors.New("creem transaction ownership mismatch")
			}
			if staleCreemStateEvent(&link, input) {
				logStaleCreemTerminalEvent(input)
				return finishCreemEventTx(tx, event)
			}
			wasActive := link.ProviderStatus == "active" || link.ProviderStatus == "trialing"
			link.ProviderStatus, link.PeriodStart, link.PeriodEnd, link.ProductId, link.CustomerId = input.ProviderStatus, input.PeriodStart, input.PeriodEnd, input.ProductId, input.CustomerId
			if !wasActive && (link.ProviderStatus == "active" || link.ProviderStatus == "trialing") {
				link.CancelAtPeriodEnd = false
			}
			if input.PeriodEnd > getDBTimestampTx(tx) {
				var entitlement UserSubscription
				result := tx.Where("user_id = ? AND plan_id = ? AND start_time = ? AND end_time = ? AND source = ?", link.UserId, link.PlanId, input.PeriodStart, input.PeriodEnd, CreemRecurringSource).First(&entitlement)
				if result.Error == nil {
					if err := tx.Model(&entitlement).Update("status", "active").Error; err != nil {
						return err
					}
					link.CurrentUserSubscriptionId = entitlement.Id
				} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
					return result.Error
				}
			}
			if input.EventCreatedAt > link.LastEventAt {
				link.LastEventAt = input.EventCreatedAt
			}
			link.UpdatedAt = common.GetTimestamp()
			if err := tx.Save(&link).Error; err != nil {
				return err
			}
			return finishCreemEventTx(tx, event)
		}
		if !errors.Is(paymentResult.Error, gorm.ErrRecordNotFound) {
			return paymentResult.Error
		}
		if err := validateCreemLinkPayment(&link, input); err != nil {
			return err
		}
		if input.PeriodEnd <= link.PeriodEnd {
			if err := createHistoricalCreemPaymentTx(tx, input, &link); err != nil {
				return err
			}
			if input.PeriodStart == link.PeriodStart && input.PeriodEnd == link.PeriodEnd && input.PeriodEnd > getDBTimestampTx(tx) && input.EventCreatedAt >= link.LastEventAt {
				var entitlement UserSubscription
				result := tx.Where("user_id = ? AND plan_id = ? AND start_time = ? AND end_time = ? AND source = ?", link.UserId, link.PlanId, input.PeriodStart, input.PeriodEnd, CreemRecurringSource).First(&entitlement)
				if result.Error == nil {
					if err := tx.Model(&entitlement).Updates(map[string]any{"status": "active", "end_time": input.PeriodEnd}).Error; err != nil {
						return err
					}
					link.CurrentUserSubscriptionId = entitlement.Id
					wasActive := link.ProviderStatus == "active" || link.ProviderStatus == "trialing"
					link.ProviderStatus = "active"
					if !wasActive {
						link.CancelAtPeriodEnd = false
					}
					if input.EventCreatedAt > link.LastEventAt {
						link.LastEventAt = input.EventCreatedAt
					}
					link.UpdatedAt = common.GetTimestamp()
					if group := strings.TrimSpace(link.UpgradeGroup); group != "" {
						if err := tx.Model(&User{}).Where("id = ?", link.UserId).Update("group", group).Error; err != nil {
							return err
						}
						activatedUserId, activatedGroup = link.UserId, group
					}
					if err := tx.Save(&link).Error; err != nil {
						return err
					}
				} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
					return result.Error
				}
			}
			common.SysLog(fmt.Sprintf("recorded Creem payment without issuing duplicate or stale entitlement: subscription_id=%s transaction_id=%s", input.SubscriptionId, input.TransactionId))
			return finishCreemEventTx(tx, event)
		}
		plan, err := creemPlanSnapshot(&link)
		if err != nil {
			return err
		}
		subscription, err := CreateUserSubscriptionFromPlanTx(tx, link.UserId, plan, CreemRecurringSource)
		if err != nil {
			return err
		}
		if err := setCreemSubscriptionPeriodTx(tx, subscription, plan, input.PeriodStart, input.PeriodEnd); err != nil {
			return err
		}
		subscription.PrevUserGroup = link.PrevUserGroup
		if err := tx.Save(subscription).Error; err != nil {
			return err
		}
		wasActive := link.ProviderStatus == "active" || link.ProviderStatus == "trialing"
		link.CurrentUserSubscriptionId, link.ProviderStatus, link.PeriodStart, link.PeriodEnd = subscription.Id, input.ProviderStatus, input.PeriodStart, input.PeriodEnd
		if !wasActive && (link.ProviderStatus == "active" || link.ProviderStatus == "trialing") {
			link.CancelAtPeriodEnd = false
		}
		link.ProductId, link.CustomerId, link.UpdatedAt = input.ProductId, input.CustomerId, common.GetTimestamp()
		if input.EventCreatedAt > link.LastEventAt {
			link.LastEventAt = input.EventCreatedAt
		}
		if err := tx.Save(&link).Error; err != nil {
			return err
		}
		if err := createCreemPaymentTx(tx, input, &link, subscription.Id, CreemReconciliationResolved); err != nil {
			return err
		}
		activatedUserId = link.UserId
		activatedGroup = strings.TrimSpace(plan.UpgradeGroup)
		renewalLogUserId, renewalLogPlanId, renewalLogAmount = link.UserId, link.PlanId, input.Amount
		return finishCreemEventTx(tx, event)
	})
	if err == nil && activatedUserId > 0 && activatedGroup != "" {
		_ = UpdateUserGroupCache(activatedUserId, activatedGroup)
	}
	if err == nil && renewalLogUserId > 0 {
		planTitle := fmt.Sprintf("套餐#%d", renewalLogPlanId)
		if plan, planErr := GetSubscriptionPlanById(renewalLogPlanId); planErr == nil && plan != nil {
			planTitle = plan.Title
		}
		RecordLog(renewalLogUserId, LogTypeTopup, fmt.Sprintf("订阅续费成功，套餐: %s，支付金额: %.2f，支付方式: creem", planTitle, float64(renewalLogAmount)/100))
	}
	return err
}

func ProcessCreemLifecycle(input CreemPaymentInput, cancelAtPeriodEnd bool, terminate bool) error {
	if strings.TrimSpace(input.SubscriptionId) == "" {
		return errors.New("missing creem subscription id")
	}
	var downgradedUserId int
	var downgradedGroup string
	var reactivatedUserId int
	var reactivatedGroup string
	err := DB.Transaction(func(tx *gorm.DB) error {
		done, event, err := beginCreemEventTx(tx, input)
		if err != nil || done {
			return err
		}
		var link CreemSubscriptionLink
		if err := lockForUpdate(tx).Where("creem_subscription_id = ?", input.SubscriptionId).First(&link).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCreemSubscriptionLinkNotFound
			}
			return err
		}
		if staleCreemStateEvent(&link, input) {
			logStaleCreemTerminalEvent(input)
			return finishCreemEventTx(tx, event)
		}
		wasActive := link.ProviderStatus == "active" || link.ProviderStatus == "trialing"
		link.ProviderStatus = input.ProviderStatus
		if cancelAtPeriodEnd {
			link.CancelAtPeriodEnd = true
		} else if terminate {
			link.CancelAtPeriodEnd = false
		} else if !wasActive && (link.ProviderStatus == "active" || link.ProviderStatus == "trialing") {
			link.CancelAtPeriodEnd = false
		}
		if input.PeriodStart > 0 {
			link.PeriodStart = input.PeriodStart
		}
		if input.PeriodEnd > input.PeriodStart {
			link.PeriodEnd = input.PeriodEnd
		}
		if input.EventCreatedAt > link.LastEventAt {
			link.LastEventAt = input.EventCreatedAt
		}
		link.UpdatedAt = common.GetTimestamp()
		if terminate && link.CurrentUserSubscriptionId > 0 {
			now := getDBTimestampTx(tx)
			var subscription UserSubscription
			if err := tx.Where("id = ?", link.CurrentUserSubscriptionId).First(&subscription).Error; err != nil {
				return err
			}
			if err := tx.Model(&subscription).Where("status = ?", "active").Updates(map[string]any{"status": "cancelled", "updated_at": now}).Error; err != nil {
				return err
			}
			subscription.Status = "cancelled"
			group, err := downgradeUserGroupForSubscriptionTx(tx, &subscription, now)
			if err != nil {
				return err
			}
			if group != "" {
				downgradedUserId, downgradedGroup = subscription.UserId, group
			}
		}
		if !terminate && (input.ProviderStatus == "active" || input.ProviderStatus == "trialing") && link.CurrentUserSubscriptionId > 0 && link.PeriodEnd > getDBTimestampTx(tx) {
			var subscription UserSubscription
			if err := tx.Where("id = ? AND user_id = ? AND plan_id = ? AND start_time = ? AND end_time = ? AND source = ?", link.CurrentUserSubscriptionId, link.UserId, link.PlanId, link.PeriodStart, link.PeriodEnd, CreemRecurringSource).First(&subscription).Error; err != nil {
				return err
			}
			if err := tx.Model(&subscription).Update("status", "active").Error; err != nil {
				return err
			}
			if group := strings.TrimSpace(link.UpgradeGroup); group != "" {
				if err := tx.Model(&User{}).Where("id = ?", link.UserId).Update("group", group).Error; err != nil {
					return err
				}
				reactivatedUserId, reactivatedGroup = link.UserId, group
			}
		}
		if err := tx.Save(&link).Error; err != nil {
			return err
		}
		return finishCreemEventTx(tx, event)
	})
	if err == nil && downgradedUserId > 0 {
		_ = UpdateUserGroupCache(downgradedUserId, downgradedGroup)
	}
	if err == nil && reactivatedUserId > 0 {
		_ = UpdateUserGroupCache(reactivatedUserId, reactivatedGroup)
	}
	return err
}

func RecordCreemInformationalEvent(input CreemPaymentInput) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		done, event, err := beginCreemEventTx(tx, input)
		if err != nil || done {
			return err
		}
		return finishCreemEventTx(tx, event)
	})
}

func RecordCreemFinancialNotice(input CreemFinancialNoticeInput) error {
	eventInput := CreemPaymentInput{EventId: input.EventId, EventType: input.EventType, PayloadHash: input.PayloadHash}
	return DB.Transaction(func(tx *gorm.DB) error {
		done, event, err := beginCreemEventTx(tx, eventInput)
		if err != nil || done {
			return err
		}
		notice := CreemFinancialNotice{
			ProviderEventId: input.EventId, EventType: input.EventType, ObjectId: input.ObjectId,
			CreemTransactionId: input.TransactionId, CreemSubscriptionId: input.SubscriptionId,
			Amount: input.Amount, Currency: input.Currency, ProviderStatus: input.ProviderStatus,
			Status:   CreemFinancialNoticePendingManualReview,
			Decision: CreemFinancialDecisionRecordOnly, CreatedAt: common.GetTimestamp(),
		}
		if input.TransactionId != "" {
			var payment CreemSubscriptionPayment
			result := tx.Where("creem_transaction_id = ?", input.TransactionId).First(&payment)
			if result.Error == nil {
				notice.CreemPaymentId = payment.Id
				notice.UserId = payment.UserId
				if notice.CreemSubscriptionId == "" {
					notice.CreemSubscriptionId = payment.CreemSubscriptionId
				}
			} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
				return result.Error
			}
		}
		if notice.UserId == 0 && notice.CreemSubscriptionId != "" {
			var link CreemSubscriptionLink
			result := tx.Where("creem_subscription_id = ?", notice.CreemSubscriptionId).First(&link)
			if result.Error == nil {
				notice.UserId = link.UserId
			} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
				return result.Error
			}
		}
		if err := tx.Create(&notice).Error; err != nil {
			return err
		}
		return finishCreemEventTx(tx, event)
	})
}

func IsCreemEventProcessed(eventId, eventType, payloadHash string) (bool, error) {
	var event CreemWebhookEvent
	result := DB.Where("provider_event_id = ?", eventId).First(&event)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if result.Error != nil {
		return false, result.Error
	}
	if event.EventType != eventType || event.PayloadHash != payloadHash {
		return false, errors.New("creem event identity payload mismatch")
	}
	return event.ProcessingStatus == "processed", nil
}

func GetCreemSubscriptionLinkByUser(userId int) (*CreemSubscriptionLink, error) {
	var link CreemSubscriptionLink
	result := DB.Where("user_id = ?", userId).Order("updated_at desc, id desc").First(&link)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &link, result.Error
}

func GetCreemSubscriptionPaymentsByUser(userId int) ([]CreemSubscriptionPayment, error) {
	payments := make([]CreemSubscriptionPayment, 0)
	err := DB.Where("user_id = ?", userId).Order("period_start desc, id desc").Find(&payments).Error
	return payments, err
}

func HasBlockingCreemSubscription(userId int) (bool, error) {
	var count int64
	err := DB.Model(&CreemSubscriptionLink{}).Where("user_id = ? AND provider_status IN ?", userId, []string{"active", "trialing", "scheduled_cancel", "past_due", "unpaid"}).Count(&count).Error
	return count > 0, err
}

func ReserveCreemSubscriptionCheckout(userId int, order *SubscriptionOrder) error {
	if userId <= 0 || order == nil || order.UserId != userId || strings.TrimSpace(order.TradeNo) == "" {
		return errors.New("invalid Creem checkout reservation")
	}
	if order.PaymentProvider != PaymentProviderCreem || order.Status != common.TopUpStatusPending {
		return errors.New("Creem checkout order must be pending")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		var blocking int64
		if err := tx.Model(&CreemSubscriptionLink{}).Where("user_id = ? AND provider_status IN ?", userId, []string{"active", "trialing", "scheduled_cancel", "past_due", "unpaid"}).Count(&blocking).Error; err != nil {
			return err
		}
		if blocking > 0 {
			return ErrCreemCheckoutAlreadyPending
		}
		now := getDBTimestampTx(tx)
		var reservation CreemSubscriptionCheckoutReservation
		result := tx.Where("user_id = ?", userId).First(&reservation)
		if result.Error == nil {
			if reservation.ExpiresAt > now {
				return ErrCreemCheckoutAlreadyPending
			}
			if err := tx.Model(&SubscriptionOrder{}).Where("trade_no = ? AND status = ?", reservation.TradeNo, common.TopUpStatusPending).Updates(map[string]any{"status": common.TopUpStatusExpired, "complete_time": now}).Error; err != nil {
				return err
			}
			if err := tx.Delete(&reservation).Error; err != nil {
				return err
			}
		} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return result.Error
		}
		if order.CreateTime == 0 {
			order.CreateTime = now
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}
		reservation = CreemSubscriptionCheckoutReservation{UserId: userId, TradeNo: order.TradeNo, ExpiresAt: now + CreemCheckoutReservationTTL, CreatedAt: now}
		if err := tx.Create(&reservation).Error; err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				return ErrCreemCheckoutAlreadyPending
			}
			return err
		}
		return nil
	})
}

func ReleaseCreemSubscriptionCheckout(tradeNo string) error {
	if strings.TrimSpace(tradeNo) == "" {
		return errors.New("missing Creem checkout trade number")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		now := getDBTimestampTx(tx)
		if err := tx.Model(&SubscriptionOrder{}).Where("trade_no = ? AND payment_provider = ? AND status = ?", tradeNo, PaymentProviderCreem, common.TopUpStatusPending).Updates(map[string]any{"status": common.TopUpStatusExpired, "complete_time": now}).Error; err != nil {
			return err
		}
		return tx.Where("trade_no = ?", tradeNo).Delete(&CreemSubscriptionCheckoutReservation{}).Error
	})
}

func MarkCreemScheduledCancel(userId int, subscriptionId string) error {
	result := DB.Model(&CreemSubscriptionLink{}).Where("user_id = ? AND creem_subscription_id = ?", userId, subscriptionId).Updates(map[string]any{"provider_status": "scheduled_cancel", "cancel_at_period_end": true, "updated_at": common.GetTimestamp()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("creem subscription ownership mismatch")
	}
	return nil
}
