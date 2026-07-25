package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	SubscriptionContractStatusActive         = "active"
	SubscriptionContractStatusGrace          = "grace"
	SubscriptionContractStatusEnded          = "ended"
	SubscriptionContractStatusNeedsAttention = "needs_attention"

	SubscriptionPaymentModeStripeRecurring   = "stripe_recurring"
	SubscriptionPaymentModePrepaid           = "prepaid"
	SubscriptionPaymentModeBalanceOnePeriod  = "balance_one_period"
	SubscriptionPaymentModeExternalOnePeriod = "external_one_period"

	SubscriptionPaymentMethodAlipay = "alipay"
	SubscriptionPaymentMethodPix    = "pix"
	SubscriptionPaymentMethodUPI    = "upi"

	SubscriptionRenewalSourceWallet   = "wallet_auto"
	SubscriptionRenewalSourceProvider = "provider_recurring"

	SubscriptionRenewalStatusEnabled                   = "enabled"
	SubscriptionRenewalStatusPausedInsufficientBalance = "paused_insufficient_balance"
	SubscriptionRenewalStatusPausedPlanUnavailable     = "paused_plan_unavailable"

	SubscriptionChangeIntentKindPurchase   = "purchase"
	SubscriptionChangeIntentKindRepurchase = "repurchase"
	SubscriptionChangeIntentKindUpgrade    = "upgrade"
	SubscriptionChangeIntentKindDowngrade  = "downgrade"
	SubscriptionChangeIntentKindCancel     = "cancel"
	SubscriptionChangeIntentKindResume     = "resume"
	SubscriptionChangeIntentKindTerminate  = "terminate"

	SubscriptionChangeIntentStatusCreated              = "created"
	SubscriptionChangeIntentStatusSyncing              = "syncing"
	SubscriptionChangeIntentStatusAwaitingPayment      = "awaiting_payment"
	SubscriptionChangeIntentStatusScheduled            = "scheduled"
	SubscriptionChangeIntentStatusApplied              = "applied"
	SubscriptionChangeIntentStatusFailed               = "failed"
	SubscriptionChangeIntentStatusExpired              = "expired"
	SubscriptionChangeIntentStatusSuperseded           = "superseded"
	SubscriptionChangeIntentStatusCompensationRequired = "compensation_required"
)

type UserSubscriptionContract struct {
	Id int64 `json:"id"`

	UserId      int    `json:"user_id" gorm:"not null;uniqueIndex"`
	Status      string `json:"status" gorm:"type:varchar(32);not null;default:'ended';index"`
	PaymentMode string `json:"payment_mode" gorm:"type:varchar(32);not null;default:'external_one_period';index"`

	RenewalSource string `json:"renewal_source" gorm:"type:varchar(32);default:'';index"`
	RenewalStatus string `json:"renewal_status" gorm:"type:varchar(64);default:'';index"`

	CurrentPlanId            int    `json:"current_plan_id" gorm:"default:0;index"`
	CurrentEntitlementId     int    `json:"current_entitlement_id" gorm:"default:0;index"`
	CurrentProviderBindingId int64  `json:"current_provider_binding_id" gorm:"type:bigint;default:0;index"`
	LatestChangeIntentId     int64  `json:"latest_change_intent_id" gorm:"type:bigint;default:0;index"`
	PendingPlanId            int    `json:"pending_plan_id" gorm:"default:0;index"`
	PendingEffectiveAt       int64  `json:"pending_effective_at" gorm:"type:bigint;default:0;index"`
	CurrentPeriodStart       int64  `json:"current_period_start" gorm:"type:bigint;default:0"`
	CurrentPeriodEnd         int64  `json:"current_period_end" gorm:"type:bigint;default:0;index"`
	GracePeriodEnd           int64  `json:"grace_period_end" gorm:"type:bigint;default:0"`
	ChangeVersion            int64  `json:"change_version" gorm:"type:bigint;not null;default:0"`
	BaseUserGroup            string `json:"base_user_group" gorm:"type:varchar(64);default:''"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (c *UserSubscriptionContract) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	c.CreatedAt = now
	c.UpdatedAt = now
	c.Status = normalizeSubscriptionContractStatus(c.Status)
	c.PaymentMode = normalizeSubscriptionPaymentMode(c.PaymentMode)
	c.BaseUserGroup = strings.TrimSpace(c.BaseUserGroup)
	return nil
}

func (c *UserSubscriptionContract) BeforeUpdate(tx *gorm.DB) error {
	c.UpdatedAt = common.GetTimestamp()
	c.Status = normalizeSubscriptionContractStatus(c.Status)
	c.PaymentMode = normalizeSubscriptionPaymentMode(c.PaymentMode)
	c.BaseUserGroup = strings.TrimSpace(c.BaseUserGroup)
	return nil
}

type SubscriptionChangeIntent struct {
	Id int64 `json:"id"`

	ContractId int64  `json:"contract_id" gorm:"type:bigint;not null;index"`
	UserId     int    `json:"user_id" gorm:"not null;uniqueIndex:idx_subscription_change_intent_request,priority:1"`
	RequestId  string `json:"request_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_subscription_change_intent_request,priority:2"`

	ChangeVersion int64  `json:"change_version" gorm:"type:bigint;not null;default:0"`
	Kind          string `json:"kind" gorm:"type:varchar(32);not null;index"`
	PaymentMode   string `json:"payment_mode" gorm:"type:varchar(32);not null;default:'external_one_period';index"`
	Status        string `json:"status" gorm:"type:varchar(32);not null;default:'created';index"`

	FromPlanId        int   `json:"from_plan_id" gorm:"default:0;index"`
	ToPlanId          int   `json:"to_plan_id" gorm:"default:0;index"`
	ProviderBindingId int64 `json:"provider_binding_id" gorm:"type:bigint;default:0;index"`

	ProviderInvoiceId      string `json:"provider_invoice_id" gorm:"type:varchar(128);default:''"`
	ProviderScheduleId     string `json:"provider_schedule_id" gorm:"type:varchar(128);default:''"`
	ProviderIdempotencyKey string `json:"provider_idempotency_key" gorm:"type:varchar(255);default:''"`

	PreviousScheduleSnapshot string `json:"previous_schedule_snapshot" gorm:"type:text"`
	WalletDebitTradeNo       string `json:"wallet_debit_trade_no" gorm:"type:varchar(255);default:''"`
	EffectiveAt              int64  `json:"effective_at" gorm:"type:bigint;default:0;index"`
	SupersededById           int64  `json:"superseded_by_id" gorm:"type:bigint;default:0;index"`
	LastError                string `json:"last_error" gorm:"type:text"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (i *SubscriptionChangeIntent) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	i.CreatedAt = now
	i.UpdatedAt = now
	i.normalize()
	return nil
}

func (i *SubscriptionChangeIntent) BeforeUpdate(tx *gorm.DB) error {
	i.UpdatedAt = common.GetTimestamp()
	i.normalize()
	return nil
}

func (i *SubscriptionChangeIntent) normalize() {
	i.RequestId = strings.TrimSpace(i.RequestId)
	i.Kind = normalizeSubscriptionChangeIntentKind(i.Kind)
	i.PaymentMode = normalizeSubscriptionPaymentMode(i.PaymentMode)
	i.Status = normalizeSubscriptionChangeIntentStatus(i.Status)
	i.ProviderInvoiceId = strings.TrimSpace(i.ProviderInvoiceId)
	i.ProviderScheduleId = strings.TrimSpace(i.ProviderScheduleId)
	i.ProviderIdempotencyKey = strings.TrimSpace(i.ProviderIdempotencyKey)
	i.WalletDebitTradeNo = strings.TrimSpace(i.WalletDebitTradeNo)
	i.LastError = strings.TrimSpace(i.LastError)
}

type SubscriptionTierRankReservation struct {
	TierRank     int `json:"tier_rank" gorm:"primaryKey;type:int"`
	ActivePlanId int `json:"active_plan_id" gorm:"uniqueIndex;not null"`
}

func normalizeSubscriptionContractStatus(status string) string {
	switch strings.TrimSpace(status) {
	case SubscriptionContractStatusActive, SubscriptionContractStatusGrace, SubscriptionContractStatusNeedsAttention:
		return strings.TrimSpace(status)
	default:
		return SubscriptionContractStatusEnded
	}
}

func normalizeSubscriptionPaymentMode(mode string) string {
	switch strings.TrimSpace(mode) {
	case SubscriptionPaymentModeStripeRecurring, SubscriptionPaymentModePrepaid, SubscriptionPaymentModeBalanceOnePeriod:
		return strings.TrimSpace(mode)
	default:
		return SubscriptionPaymentModeExternalOnePeriod
	}
}

func normalizeSubscriptionChangeIntentKind(kind string) string {
	switch strings.TrimSpace(kind) {
	case SubscriptionChangeIntentKindRepurchase, SubscriptionChangeIntentKindUpgrade, SubscriptionChangeIntentKindDowngrade, SubscriptionChangeIntentKindCancel, SubscriptionChangeIntentKindResume, SubscriptionChangeIntentKindTerminate:
		return strings.TrimSpace(kind)
	default:
		return SubscriptionChangeIntentKindPurchase
	}
}

func normalizeSubscriptionChangeIntentStatus(status string) string {
	switch strings.TrimSpace(status) {
	case SubscriptionChangeIntentStatusSyncing, SubscriptionChangeIntentStatusAwaitingPayment, SubscriptionChangeIntentStatusScheduled, SubscriptionChangeIntentStatusApplied, SubscriptionChangeIntentStatusFailed, SubscriptionChangeIntentStatusExpired, SubscriptionChangeIntentStatusSuperseded, SubscriptionChangeIntentStatusCompensationRequired:
		return strings.TrimSpace(status)
	default:
		return SubscriptionChangeIntentStatusCreated
	}
}
