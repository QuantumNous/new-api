package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AffiliateReferralStatusBound     = "bound"
	AffiliateReferralStatusQualified = "qualified"

	AffiliateRewardTypeInviter  = "inviter_reward"
	AffiliateRewardTypeInvitee  = "invitee_reward"
	AffiliateRewardTypeCashback = "cashback"

	AffiliateRewardStatusPending     = "pending"
	AffiliateRewardStatusAvailable   = "available"
	AffiliateRewardStatusTransferred = "transferred"
	AffiliateRewardStatusCredited    = "credited"
	AffiliateRewardStatusAdjusted    = "adjusted"

	AffiliateLedgerTypeRewardPending   = "reward_pending"
	AffiliateLedgerTypeRewardAvailable = "reward_available"
	AffiliateLedgerTypeBalanceTransfer = "balance_transfer"
	AffiliateLedgerTypeAdjustment      = "adjustment"
	AffiliateLedgerTypeLegacyMigration = "legacy_migration"

	AffiliateReferenceReward     = "reward"
	AffiliateReferenceTransfer   = "balance_transfer"
	AffiliateReferenceAdjustment = "adjustment"
	AffiliateReferenceLegacy     = "legacy_aff_quota"

	AffiliateAdjustmentStatusApplied        = "applied"
	AffiliateAdjustmentStatusManualRequired = "manual_required"

	TopUpCompletionSourceOnlineWallet = "online_wallet"
	TopUpCompletionSourceAdmin        = "admin"
)

var (
	ErrAffiliateDisabled         = errors.New("affiliate cashback is disabled")
	ErrAffiliateAmountInvalid    = errors.New("invalid affiliate amount")
	ErrAffiliateBalance          = errors.New("insufficient available cashback balance")
	ErrAffiliateTopUpsHidden     = errors.New("invitee top-up records are not available")
	ErrAffiliateRewardNotFound   = errors.New("affiliate reward not found")
	ErrAffiliateRuleInvalid      = errors.New("invalid affiliate rule")
	ErrAffiliateTransferTooSmall = errors.New("cashback transfer is below the minimum")
)

type AffiliateRuleVersion struct {
	ID                        int    `json:"id"`
	InviterUserID             int    `json:"inviter_user_id" gorm:"uniqueIndex:idx_affiliate_rule_version;not null"`
	ConfigHash                string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_affiliate_rule_version;not null"`
	Source                    string `json:"source" gorm:"type:varchar(32);not null"`
	Enabled                   bool   `json:"enabled" gorm:"not null"`
	InviterRewardQuota        int64  `json:"inviter_reward_quota" gorm:"type:bigint;not null"`
	InviteeRewardQuota        int64  `json:"invitee_reward_quota" gorm:"type:bigint;not null"`
	RegistrationRewardTrigger string `json:"registration_reward_trigger" gorm:"type:varchar(32);not null"`
	RewardMode                string `json:"reward_mode" gorm:"type:varchar(20);not null"`
	CashbackFrequency         string `json:"cashback_frequency" gorm:"type:varchar(24);not null"`
	RewardRateBps             int64  `json:"reward_rate_bps" gorm:"type:bigint;not null"`
	FixedRewardQuota          int64  `json:"fixed_reward_quota" gorm:"type:bigint;not null"`
	UnlimitedReward           bool   `json:"unlimited_reward" gorm:"not null"`
	MaximumRewardQuota        int64  `json:"maximum_reward_quota" gorm:"type:bigint;not null"`
	MinimumTopUpCents         int64  `json:"minimum_topup_cents" gorm:"type:bigint;not null"`
	HoldSeconds               int64  `json:"hold_seconds" gorm:"type:bigint;not null"`
	MinimumTransferQuota      int64  `json:"minimum_transfer_quota" gorm:"type:bigint;not null"`
	CreatedAt                 int64  `json:"created_at" gorm:"autoCreateTime"`
}

type AffiliateUserOverride struct {
	ID                        int     `json:"id"`
	UserID                    int     `json:"user_id" gorm:"uniqueIndex;not null"`
	Enabled                   *bool   `json:"enabled"`
	InviterRewardQuota        *int64  `json:"inviter_reward_quota" gorm:"type:bigint"`
	InviteeRewardQuota        *int64  `json:"invitee_reward_quota" gorm:"type:bigint"`
	RegistrationRewardTrigger *string `json:"registration_reward_trigger" gorm:"type:varchar(32)"`
	RewardMode                *string `json:"reward_mode" gorm:"type:varchar(20)"`
	CashbackFrequency         *string `json:"cashback_frequency" gorm:"type:varchar(24)"`
	RewardRateBps             *int64  `json:"reward_rate_bps" gorm:"type:bigint"`
	FixedRewardQuota          *int64  `json:"fixed_reward_quota" gorm:"type:bigint"`
	UnlimitedReward           *bool   `json:"unlimited_reward"`
	MaximumRewardQuota        *int64  `json:"maximum_reward_quota" gorm:"type:bigint"`
	MinimumTopUpCents         *int64  `json:"minimum_topup_cents" gorm:"type:bigint"`
	HoldSeconds               *int64  `json:"hold_seconds" gorm:"type:bigint"`
	MinimumTransferQuota      *int64  `json:"minimum_transfer_quota" gorm:"type:bigint"`
	ShowInviteeTopUps         *bool   `json:"show_invitee_topups"`
	UpdatedBy                 int     `json:"updated_by" gorm:"index;not null"`
	UpdatedAt                 int64   `json:"updated_at" gorm:"autoUpdateTime"`
	ChangeReason              string  `json:"change_reason" gorm:"type:varchar(500);not null"`
}

type AffiliateReferral struct {
	ID                    int    `json:"id"`
	InviteeUserID         int    `json:"invitee_user_id" gorm:"uniqueIndex;not null"`
	InviterUserID         int    `json:"inviter_user_id" gorm:"index;not null"`
	CodeSnapshot          string `json:"code_snapshot" gorm:"type:varchar(32);index;not null"`
	Status                string `json:"status" gorm:"type:varchar(20);index;not null"`
	BoundAt               int64  `json:"bound_at" gorm:"index;not null"`
	QualifiedAt           int64  `json:"qualified_at" gorm:"not null"`
	QualifyingTopUpID     *int   `json:"qualifying_topup_id,omitempty" gorm:"uniqueIndex"`
	CumulativePaidCents   int64  `json:"cumulative_paid_cents" gorm:"type:bigint;not null"`
	CashbackRewardedQuota int64  `json:"cashback_rewarded_quota" gorm:"type:bigint;not null"`
}

type AffiliateReward struct {
	ID                      int     `json:"id"`
	ReferralID              int     `json:"referral_id" gorm:"index;not null"`
	InviterUserID           int     `json:"inviter_user_id" gorm:"index;not null"`
	InviteeUserID           int     `json:"invitee_user_id" gorm:"index;not null"`
	RecipientUserID         int     `json:"recipient_user_id" gorm:"index;not null"`
	RewardType              string  `json:"reward_type" gorm:"type:varchar(24);index;not null"`
	TopUpID                 *int    `json:"topup_id,omitempty" gorm:"index"`
	RuleVersionID           int     `json:"rule_version_id" gorm:"index;not null"`
	PaidCents               int64   `json:"paid_cents" gorm:"type:bigint;not null"`
	CumulativePaidCents     int64   `json:"cumulative_paid_cents" gorm:"type:bigint;not null"`
	RewardMode              string  `json:"reward_mode" gorm:"type:varchar(20);not null"`
	CashbackFrequency       string  `json:"cashback_frequency" gorm:"type:varchar(24);not null"`
	RewardRateBps           int64   `json:"reward_rate_bps" gorm:"type:bigint;not null"`
	FixedRewardQuota        int64   `json:"fixed_reward_quota" gorm:"type:bigint;not null"`
	UnlimitedReward         bool    `json:"unlimited_reward" gorm:"not null"`
	MaximumRewardQuota      int64   `json:"maximum_reward_quota" gorm:"type:bigint;not null"`
	MinimumTopUpCents       int64   `json:"minimum_topup_cents" gorm:"type:bigint;not null"`
	HoldSeconds             int64   `json:"hold_seconds" gorm:"type:bigint;not null"`
	QuotaPerUnitSnapshot    float64 `json:"quota_per_unit_snapshot" gorm:"not null"`
	CNYExchangeRateSnapshot float64 `json:"cny_exchange_rate_snapshot" gorm:"not null"`
	ActualQuota             int64   `json:"actual_quota" gorm:"type:bigint;not null"`
	AdjustedQuota           int64   `json:"adjusted_quota" gorm:"type:bigint;not null"`
	TransferredQuota        int64   `json:"transferred_quota" gorm:"type:bigint;not null"`
	Status                  string  `json:"status" gorm:"type:varchar(20);index;not null"`
	AvailableAt             int64   `json:"available_at" gorm:"index;not null"`
	CreatedAt               int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt               int64   `json:"updated_at" gorm:"autoUpdateTime"`
	IdempotencyKey          string  `json:"-" gorm:"type:varchar(128);uniqueIndex;not null"`
}

type AffiliateQuotaAccount struct {
	ID                     int   `json:"id"`
	UserID                 int   `json:"user_id" gorm:"uniqueIndex;not null"`
	PendingQuota           int64 `json:"pending_quota" gorm:"type:bigint;not null"`
	AvailableQuota         int64 `json:"available_quota" gorm:"type:bigint;not null"`
	TransferredQuota       int64 `json:"transferred_quota" gorm:"type:bigint;not null"`
	LifetimeEarnedQuota    int64 `json:"lifetime_earned_quota" gorm:"type:bigint;not null"`
	LegacyAffQuotaMigrated bool  `json:"-" gorm:"not null"`
	CreatedAt              int64 `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt              int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

type AffiliateQuotaLedger struct {
	ID                      int    `json:"id"`
	UserID                  int    `json:"user_id" gorm:"index;not null"`
	AccountID               int    `json:"account_id" gorm:"index;not null"`
	EntryType               string `json:"entry_type" gorm:"type:varchar(40);index;not null"`
	ReferenceType           string `json:"reference_type" gorm:"type:varchar(32);index;not null"`
	ReferenceID             int    `json:"reference_id" gorm:"index;not null"`
	AmountQuota             int64  `json:"amount_quota" gorm:"type:bigint;not null"`
	PendingDeltaQuota       int64  `json:"pending_delta_quota" gorm:"type:bigint;not null"`
	AvailableDeltaQuota     int64  `json:"available_delta_quota" gorm:"type:bigint;not null"`
	TransferredDeltaQuota   int64  `json:"transferred_delta_quota" gorm:"type:bigint;not null"`
	PendingBalanceQuota     int64  `json:"pending_balance_quota" gorm:"type:bigint;not null"`
	AvailableBalanceQuota   int64  `json:"available_balance_quota" gorm:"type:bigint;not null"`
	TransferredBalanceQuota int64  `json:"transferred_balance_quota" gorm:"type:bigint;not null"`
	IdempotencyKey          string `json:"-" gorm:"type:varchar(128);uniqueIndex;not null"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

type AffiliateBalanceTransfer struct {
	ID                     int    `json:"id"`
	UserID                 int    `json:"user_id" gorm:"uniqueIndex:idx_affiliate_transfer_request;index;not null"`
	RequestKey             string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_affiliate_transfer_request;not null"`
	AmountQuota            int64  `json:"amount_quota" gorm:"type:bigint;not null"`
	AffiliateBalanceBefore int64  `json:"affiliate_balance_before" gorm:"type:bigint;not null"`
	AffiliateBalanceAfter  int64  `json:"affiliate_balance_after" gorm:"type:bigint;not null"`
	UserQuotaBefore        int    `json:"user_quota_before" gorm:"type:int;not null"`
	UserQuotaAfter         int    `json:"user_quota_after" gorm:"type:int;not null"`
	CreatedAt              int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

type AffiliateAdjustment struct {
	ID                 int    `json:"id"`
	RewardID           int    `json:"reward_id" gorm:"uniqueIndex:idx_affiliate_adjustment_request;index;not null"`
	RequestKey         string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_affiliate_adjustment_request;not null"`
	AdminUserID        int    `json:"admin_user_id" gorm:"index;not null"`
	RequestedQuota     int64  `json:"requested_quota" gorm:"type:bigint;not null"`
	AppliedQuota       int64  `json:"applied_quota" gorm:"type:bigint;not null"`
	PendingManualQuota int64  `json:"pending_manual_quota" gorm:"type:bigint;not null"`
	Status             string `json:"status" gorm:"type:varchar(24);index;not null"`
	Reason             string `json:"reason" gorm:"type:varchar(500);not null"`
	CreatedAt          int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

type AffiliateTopUpEvent struct {
	ID                  int    `json:"id"`
	ReferralID          int    `json:"referral_id" gorm:"index;not null"`
	TopUpID             int    `json:"topup_id" gorm:"uniqueIndex;not null"`
	InviterUserID       int    `json:"inviter_user_id" gorm:"index;not null"`
	InviteeUserID       int    `json:"invitee_user_id" gorm:"index;not null"`
	MaskedEmail         string `json:"masked_email" gorm:"type:varchar(255);index;not null"`
	PaidCents           int64  `json:"paid_cents" gorm:"type:bigint;not null"`
	CumulativePaidCents int64  `json:"cumulative_paid_cents" gorm:"type:bigint;not null"`
	Qualified           bool   `json:"qualified" gorm:"index;not null"`
	RewardID            *int   `json:"reward_id,omitempty" gorm:"index"`
	CashRewardID        *int   `json:"cash_reward_id,omitempty" gorm:"index"`
	QuotaGrantID        *int   `json:"quota_grant_id,omitempty" gorm:"index"`
	CompletedAt         int64  `json:"completed_at" gorm:"index;not null"`
	CreatedAt           int64  `json:"created_at" gorm:"autoCreateTime"`
}

type AffiliateEffectiveRule struct {
	Enabled                   bool   `json:"enabled"`
	InviterRewardQuota        int64  `json:"inviter_reward_quota"`
	InviteeRewardQuota        int64  `json:"invitee_reward_quota"`
	RegistrationRewardTrigger string `json:"registration_reward_trigger"`
	RewardMode                string `json:"reward_mode"`
	CashbackFrequency         string `json:"cashback_frequency"`
	RewardRateBps             int64  `json:"reward_rate_bps"`
	FixedRewardQuota          int64  `json:"fixed_reward_quota"`
	UnlimitedReward           bool   `json:"unlimited_reward"`
	MaximumRewardQuota        int64  `json:"maximum_reward_quota"`
	MinimumTopUpCents         int64  `json:"minimum_topup_cents"`
	HoldSeconds               int64  `json:"hold_seconds"`
	MinimumTransferQuota      int64  `json:"minimum_transfer_quota"`
	ShowInviteeTopUps         bool   `json:"show_invitee_topups"`
	Source                    string `json:"source"`
}

type AffiliateSummary struct {
	Enabled                    bool                   `json:"enabled"`
	ReferralCode               string                 `json:"referral_code"`
	Currency                   string                 `json:"currency"`
	ReferralCount              int64                  `json:"referral_count"`
	QualifiedCount             int64                  `json:"qualified_count"`
	NextAvailableAt            int64                  `json:"next_available_at"`
	LifetimeCampaignBonusQuota int64                  `json:"lifetime_campaign_bonus_quota"`
	Rule                       AffiliateEffectiveRule `json:"rule"`
	Account                    AffiliateQuotaAccount  `json:"account"`
	CashAccount                AffiliateCashAccount   `json:"cash_account"`
	Campaign                   AffiliateCampaign      `json:"campaign"`
}

type AffiliateInviteeTopUp struct {
	ID                     int    `json:"id"`
	RewardID               int    `json:"reward_id"`
	CashRewardID           int    `json:"cash_reward_id"`
	MaskedEmail            string `json:"masked_email"`
	InvitedAt              int64  `json:"invited_at"`
	InvitationCode         string `json:"invitation_code"`
	TopUpID                int    `json:"topup_id"`
	TopUpAt                int64  `json:"topup_at"`
	PaidCents              int64  `json:"paid_cents"`
	RewardMode             string `json:"reward_mode"`
	RewardRateBps          int64  `json:"reward_rate_bps"`
	FixedRewardQuota       int64  `json:"fixed_reward_quota"`
	RewardQuota            int64  `json:"reward_quota"`
	RewardCents            int64  `json:"reward_cents"`
	AvailableRewardQuota   int64  `json:"available_reward_quota"`
	AvailableRewardCents   int64  `json:"available_reward_cents"`
	TransferredRewardQuota int64  `json:"transferred_reward_quota"`
	TransferredRewardCents int64  `json:"transferred_reward_cents"`
	AvailableAt            int64  `json:"available_at"`
	Status                 string `json:"status"`
}

type AffiliateUserOverrideView struct {
	UserID            int                    `json:"user_id"`
	Username          string                 `json:"username"`
	Email             string                 `json:"email"`
	UpdatedByUsername string                 `json:"updated_by_username"`
	Override          *AffiliateUserOverride `json:"override"`
	GlobalRule        AffiliateEffectiveRule `json:"global_rule"`
	EffectiveRule     AffiliateEffectiveRule `json:"effective_rule"`
}

type AffiliateAdminReward struct {
	ID               int    `json:"id"`
	InviterUserID    int    `json:"inviter_user_id"`
	InviterUsername  string `json:"inviter_username"`
	InviteeUserID    int    `json:"invitee_user_id"`
	InviteeEmail     string `json:"invitee_email"`
	InvitationCode   string `json:"invitation_code"`
	TopUpID          int    `json:"topup_id"`
	TradeNo          string `json:"trade_no"`
	PaidCents        int64  `json:"paid_cents"`
	ActualQuota      int64  `json:"actual_quota"`
	AdjustedQuota    int64  `json:"adjusted_quota"`
	TransferredQuota int64  `json:"transferred_quota"`
	Status           string `json:"status"`
	AvailableAt      int64  `json:"available_at"`
	CreatedAt        int64  `json:"created_at"`
}

func normalizedAffiliateSetting() operation_setting.AffiliateSetting {
	setting := *operation_setting.GetAffiliateSetting()
	maxQuota := int64(common.MaxQuota)
	for _, item := range []*int64{
		&setting.InviterRewardQuota,
		&setting.InviteeRewardQuota,
		&setting.FixedRewardQuota,
		&setting.MaximumRewardQuota,
		&setting.MinimumTransferQuota,
	} {
		if *item < 0 {
			*item = 0
		} else if *item > maxQuota {
			*item = maxQuota
		}
	}
	if setting.RewardRateBps < 0 {
		setting.RewardRateBps = 0
	} else if setting.RewardRateBps > 10_000 {
		setting.RewardRateBps = 10_000
	}
	if setting.MinimumTopUpCents < 0 {
		setting.MinimumTopUpCents = 0
	}
	if setting.HoldSeconds < 0 {
		setting.HoldSeconds = 0
	} else if setting.HoldSeconds > 365*24*60*60 {
		setting.HoldSeconds = 365 * 24 * 60 * 60
	}
	if setting.RegistrationRewardTrigger != operation_setting.AffiliateRegistrationTriggerRegistrationSuccess &&
		setting.RegistrationRewardTrigger != operation_setting.AffiliateRegistrationTriggerFirstQualifiedTopUp {
		setting.RegistrationRewardTrigger = operation_setting.AffiliateRegistrationTriggerRegistrationSuccess
	}
	if setting.RewardMode != operation_setting.AffiliateRewardModePercentage &&
		setting.RewardMode != operation_setting.AffiliateRewardModeFixed {
		setting.RewardMode = operation_setting.AffiliateRewardModePercentage
	}
	if setting.CashbackFrequency != operation_setting.AffiliateCashbackFrequencyFirstQualified &&
		setting.CashbackFrequency != operation_setting.AffiliateCashbackFrequencyEveryTopUp {
		setting.CashbackFrequency = operation_setting.AffiliateCashbackFrequencyFirstQualified
	}
	return setting
}

func globalAffiliateRule() AffiliateEffectiveRule {
	setting := normalizedAffiliateSetting()
	return AffiliateEffectiveRule{
		Enabled:                   setting.Enabled,
		InviterRewardQuota:        setting.InviterRewardQuota,
		InviteeRewardQuota:        setting.InviteeRewardQuota,
		RegistrationRewardTrigger: setting.RegistrationRewardTrigger,
		RewardMode:                setting.RewardMode,
		CashbackFrequency:         setting.CashbackFrequency,
		RewardRateBps:             setting.RewardRateBps,
		FixedRewardQuota:          setting.FixedRewardQuota,
		UnlimitedReward:           setting.UnlimitedReward,
		MaximumRewardQuota:        setting.MaximumRewardQuota,
		MinimumTopUpCents:         setting.MinimumTopUpCents,
		HoldSeconds:               setting.HoldSeconds,
		MinimumTransferQuota:      setting.MinimumTransferQuota,
		ShowInviteeTopUps:         setting.ShowInviteeTopUps,
		Source:                    "global",
	}
}

func validateAffiliateRule(rule AffiliateEffectiveRule) error {
	maxQuota := int64(common.MaxQuota)
	if rule.InviterRewardQuota < 0 || rule.InviterRewardQuota > maxQuota ||
		rule.InviteeRewardQuota < 0 || rule.InviteeRewardQuota > maxQuota ||
		rule.FixedRewardQuota < 0 || rule.FixedRewardQuota > maxQuota ||
		rule.MaximumRewardQuota < 0 || rule.MaximumRewardQuota > maxQuota ||
		rule.MinimumTransferQuota < 0 || rule.MinimumTransferQuota > maxQuota ||
		rule.RewardRateBps < 0 || rule.RewardRateBps > 10_000 ||
		rule.MinimumTopUpCents < 0 || rule.HoldSeconds < 0 || rule.HoldSeconds > 365*24*60*60 {
		return ErrAffiliateRuleInvalid
	}
	if !rule.UnlimitedReward && rule.MaximumRewardQuota <= 0 {
		return ErrAffiliateRuleInvalid
	}
	if rule.RegistrationRewardTrigger != operation_setting.AffiliateRegistrationTriggerRegistrationSuccess &&
		rule.RegistrationRewardTrigger != operation_setting.AffiliateRegistrationTriggerFirstQualifiedTopUp {
		return ErrAffiliateRuleInvalid
	}
	if rule.RewardMode != operation_setting.AffiliateRewardModePercentage && rule.RewardMode != operation_setting.AffiliateRewardModeFixed {
		return ErrAffiliateRuleInvalid
	}
	if rule.CashbackFrequency != operation_setting.AffiliateCashbackFrequencyFirstQualified &&
		rule.CashbackFrequency != operation_setting.AffiliateCashbackFrequencyEveryTopUp {
		return ErrAffiliateRuleInvalid
	}
	return nil
}

func applyAffiliateOverride(rule AffiliateEffectiveRule, override *AffiliateUserOverride) AffiliateEffectiveRule {
	if override == nil {
		return rule
	}
	applied := false
	if override.Enabled != nil {
		rule.Enabled = *override.Enabled
		applied = true
	}
	if override.InviterRewardQuota != nil {
		rule.InviterRewardQuota = *override.InviterRewardQuota
		applied = true
	}
	if override.InviteeRewardQuota != nil {
		rule.InviteeRewardQuota = *override.InviteeRewardQuota
		applied = true
	}
	if override.RegistrationRewardTrigger != nil {
		rule.RegistrationRewardTrigger = *override.RegistrationRewardTrigger
		applied = true
	}
	if override.RewardMode != nil {
		rule.RewardMode = *override.RewardMode
		applied = true
	}
	if override.CashbackFrequency != nil {
		rule.CashbackFrequency = *override.CashbackFrequency
		applied = true
	}
	if override.RewardRateBps != nil {
		rule.RewardRateBps = *override.RewardRateBps
		applied = true
	}
	if override.FixedRewardQuota != nil {
		rule.FixedRewardQuota = *override.FixedRewardQuota
		applied = true
	}
	if override.UnlimitedReward != nil {
		rule.UnlimitedReward = *override.UnlimitedReward
		applied = true
	}
	if override.MaximumRewardQuota != nil {
		rule.MaximumRewardQuota = *override.MaximumRewardQuota
		applied = true
	}
	if override.MinimumTopUpCents != nil {
		rule.MinimumTopUpCents = *override.MinimumTopUpCents
		applied = true
	}
	if override.HoldSeconds != nil {
		rule.HoldSeconds = *override.HoldSeconds
		applied = true
	}
	if override.MinimumTransferQuota != nil {
		rule.MinimumTransferQuota = *override.MinimumTransferQuota
		applied = true
	}
	if override.ShowInviteeTopUps != nil {
		rule.ShowInviteeTopUps = *override.ShowInviteeTopUps
		applied = true
	}
	if applied {
		rule.Source = "user_override"
	}
	return rule
}

func effectiveAffiliateRuleWithTx(tx *gorm.DB, inviterUserID int) (AffiliateEffectiveRule, *AffiliateUserOverride, error) {
	rule := globalAffiliateRule()
	var override AffiliateUserOverride
	if err := tx.Where("user_id = ?", inviterUserID).First(&override).Error; err == nil {
		rule = applyAffiliateOverride(rule, &override)
		if err := validateAffiliateRule(rule); err != nil {
			return AffiliateEffectiveRule{}, nil, err
		}
		return rule, &override, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return AffiliateEffectiveRule{}, nil, err
	}
	if err := validateAffiliateRule(rule); err != nil {
		return AffiliateEffectiveRule{}, nil, err
	}
	return rule, nil, nil
}

func GetAffiliateEffectiveRule(inviterUserID int) (AffiliateEffectiveRule, error) {
	rule, _, err := effectiveAffiliateRuleWithTx(DB, inviterUserID)
	return rule, err
}

func affiliateRuleHash(rule AffiliateEffectiveRule) string {
	value := fmt.Sprintf("%t|%d|%d|%s|%s|%s|%d|%d|%t|%d|%d|%d|%d|%s",
		rule.Enabled, rule.InviterRewardQuota, rule.InviteeRewardQuota,
		rule.RegistrationRewardTrigger, rule.RewardMode, rule.CashbackFrequency,
		rule.RewardRateBps, rule.FixedRewardQuota, rule.UnlimitedReward,
		rule.MaximumRewardQuota, rule.MinimumTopUpCents, rule.HoldSeconds,
		rule.MinimumTransferQuota, rule.Source)
	return fmt.Sprintf("%x", sha256.Sum256([]byte(value)))
}

func ensureAffiliateRuleVersionWithTx(tx *gorm.DB, inviterUserID int, rule AffiliateEffectiveRule) (*AffiliateRuleVersion, error) {
	hash := affiliateRuleHash(rule)
	var version AffiliateRuleVersion
	if err := tx.Where("inviter_user_id = ? AND config_hash = ?", inviterUserID, hash).First(&version).Error; err == nil {
		return &version, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	version = AffiliateRuleVersion{
		InviterUserID: inviterUserID, ConfigHash: hash, Source: rule.Source,
		Enabled: rule.Enabled, InviterRewardQuota: rule.InviterRewardQuota,
		InviteeRewardQuota:        rule.InviteeRewardQuota,
		RegistrationRewardTrigger: rule.RegistrationRewardTrigger,
		RewardMode:                rule.RewardMode, CashbackFrequency: rule.CashbackFrequency,
		RewardRateBps: rule.RewardRateBps, FixedRewardQuota: rule.FixedRewardQuota,
		UnlimitedReward: rule.UnlimitedReward, MaximumRewardQuota: rule.MaximumRewardQuota,
		MinimumTopUpCents: rule.MinimumTopUpCents, HoldSeconds: rule.HoldSeconds,
		MinimumTransferQuota: rule.MinimumTransferQuota,
	}
	result := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "inviter_user_id"}, {Name: "config_hash"}},
		DoNothing: true,
	}).Create(&version)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		if err := tx.Where("inviter_user_id = ? AND config_hash = ?", inviterUserID, hash).First(&version).Error; err != nil {
			return nil, err
		}
	}
	return &version, nil
}

func appendAffiliateQuotaLedgerWithTx(tx *gorm.DB, account *AffiliateQuotaAccount, entry AffiliateQuotaLedger) error {
	entry.UserID = account.UserID
	entry.AccountID = account.ID
	entry.PendingBalanceQuota = account.PendingQuota
	entry.AvailableBalanceQuota = account.AvailableQuota
	entry.TransferredBalanceQuota = account.TransferredQuota
	return tx.Create(&entry).Error
}

func ensureAffiliateQuotaAccountWithTx(tx *gorm.DB, userID int) (*AffiliateQuotaAccount, error) {
	var account AffiliateQuotaAccount
	if err := tx.Where("user_id = ?", userID).First(&account).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		account = AffiliateQuotaAccount{UserID: userID}
		result := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			DoNothing: true,
		}).Create(&account)
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected == 0 {
			if err := tx.Where("user_id = ?", userID).First(&account).Error; err != nil {
				return nil, err
			}
		}
	}
	if account.LegacyAffQuotaMigrated {
		if err := lockForUpdate(tx).Where("id = ?", account.ID).First(&account).Error; err != nil {
			return nil, err
		}
		return &account, nil
	}
	var user User
	if err := lockForUpdate(tx).Select("id", "aff_quota", "aff_history").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	if err := lockForUpdate(tx).Where("id = ?", account.ID).First(&account).Error; err != nil {
		return nil, err
	}
	if account.LegacyAffQuotaMigrated {
		return &account, nil
	}
	legacyQuota := int64(user.AffQuota)
	legacyLifetimeQuota := int64(user.AffHistoryQuota)
	if legacyLifetimeQuota < legacyQuota {
		legacyLifetimeQuota = legacyQuota
	}
	legacyTransferredQuota := legacyLifetimeQuota - legacyQuota
	if legacyQuota > 0 {
		account.AvailableQuota += legacyQuota
		if err := tx.Model(&User{}).Where("id = ?", userID).Update("aff_quota", 0).Error; err != nil {
			return nil, err
		}
	}
	account.TransferredQuota += legacyTransferredQuota
	account.LifetimeEarnedQuota += legacyLifetimeQuota
	account.LegacyAffQuotaMigrated = true
	if err := tx.Save(&account).Error; err != nil {
		return nil, err
	}
	if legacyLifetimeQuota > 0 {
		if err := appendAffiliateQuotaLedgerWithTx(tx, &account, AffiliateQuotaLedger{
			EntryType: AffiliateLedgerTypeLegacyMigration, ReferenceType: AffiliateReferenceLegacy,
			ReferenceID: userID, AmountQuota: legacyLifetimeQuota,
			AvailableDeltaQuota: legacyQuota, TransferredDeltaQuota: legacyTransferredQuota,
			IdempotencyKey: "legacy-aff-quota:" + strconv.Itoa(userID),
		}); err != nil {
			return nil, err
		}
	}
	return &account, nil
}

func ensureAffiliateCodeWithTx(tx *gorm.DB, user *User) error {
	if strings.TrimSpace(user.AffCode) != "" {
		return nil
	}
	code := strings.ToUpper(strconv.FormatInt(int64(user.Id), 36)) + "-" + common.GetRandomString(8)
	result := tx.Model(&User{}).Where("id = ? AND (aff_code = '' OR aff_code IS NULL)", user.Id).Update("aff_code", code)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		user.AffCode = code
		return nil
	}
	if err := tx.Select("aff_code").Where("id = ?", user.Id).First(user).Error; err == nil && user.AffCode != "" {
		return nil
	}
	return errors.New("failed to create affiliate code")
}

func createAffiliateRewardWithTx(tx *gorm.DB, relation *AffiliateReferral, rule AffiliateEffectiveRule, versionID int, rewardType string, recipientUserID int, amountQuota int64, topUpID *int, paidCents int64, cumulativePaidCents int64, idempotencyKey string) (*AffiliateReward, bool, error) {
	var existing AffiliateReward
	if err := tx.Where("idempotency_key = ?", idempotencyKey).First(&existing).Error; err == nil {
		return &existing, false, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}
	now := common.GetTimestamp()
	status := AffiliateRewardStatusCredited
	availableAt := now
	if rewardType != AffiliateRewardTypeInvitee {
		availableAt = now + rule.HoldSeconds
		status = AffiliateRewardStatusAvailable
		if rule.HoldSeconds > 0 {
			status = AffiliateRewardStatusPending
		}
	}
	exchangeRate := operation_setting.USDExchangeRate
	if exchangeRate <= 0 {
		exchangeRate = 1
	}
	reward := AffiliateReward{
		ReferralID: relation.ID, InviterUserID: relation.InviterUserID,
		InviteeUserID: relation.InviteeUserID, RecipientUserID: recipientUserID,
		RewardType: rewardType, TopUpID: topUpID, RuleVersionID: versionID,
		PaidCents: paidCents, CumulativePaidCents: cumulativePaidCents,
		RewardMode: rule.RewardMode, CashbackFrequency: rule.CashbackFrequency,
		RewardRateBps: rule.RewardRateBps, FixedRewardQuota: rule.FixedRewardQuota,
		UnlimitedReward: rule.UnlimitedReward, MaximumRewardQuota: rule.MaximumRewardQuota,
		MinimumTopUpCents: rule.MinimumTopUpCents, HoldSeconds: rule.HoldSeconds,
		QuotaPerUnitSnapshot: common.QuotaPerUnit, CNYExchangeRateSnapshot: exchangeRate,
		ActualQuota: amountQuota, Status: status, AvailableAt: availableAt,
		IdempotencyKey: idempotencyKey,
	}
	result := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "idempotency_key"}},
		DoNothing: true,
	}).Create(&reward)
	if result.Error != nil {
		return nil, false, result.Error
	}
	if result.RowsAffected == 0 {
		if err := tx.Where("idempotency_key = ?", idempotencyKey).First(&existing).Error; err != nil {
			return nil, false, err
		}
		return &existing, false, nil
	}
	if amountQuota <= 0 {
		return &reward, true, nil
	}
	if rewardType == AffiliateRewardTypeInvitee {
		var invitee User
		if err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", recipientUserID).First(&invitee).Error; err != nil {
			return nil, false, err
		}
		quotaAfter := int64(invitee.Quota) + amountQuota
		if quotaAfter > int64(common.MaxQuota) {
			return nil, false, ErrAffiliateAmountInvalid
		}
		if err := tx.Model(&User{}).Where("id = ?", recipientUserID).Update("quota", int(quotaAfter)).Error; err != nil {
			return nil, false, err
		}
		return &reward, true, nil
	}
	account, err := ensureAffiliateQuotaAccountWithTx(tx, recipientUserID)
	if err != nil {
		return nil, false, err
	}
	entry := AffiliateQuotaLedger{
		ReferenceType: AffiliateReferenceReward, ReferenceID: reward.ID,
		AmountQuota: amountQuota, IdempotencyKey: "reward:create:" + strconv.Itoa(reward.ID),
	}
	if status == AffiliateRewardStatusPending {
		account.PendingQuota += amountQuota
		entry.EntryType = AffiliateLedgerTypeRewardPending
		entry.PendingDeltaQuota = amountQuota
	} else {
		account.AvailableQuota += amountQuota
		entry.EntryType = AffiliateLedgerTypeRewardAvailable
		entry.AvailableDeltaQuota = amountQuota
	}
	account.LifetimeEarnedQuota += amountQuota
	if err := tx.Save(account).Error; err != nil {
		return nil, false, err
	}
	if err := appendAffiliateQuotaLedgerWithTx(tx, account, entry); err != nil {
		return nil, false, err
	}
	return &reward, true, nil
}

func grantAffiliateRegistrationRewardsWithTx(tx *gorm.DB, relation *AffiliateReferral, rule AffiliateEffectiveRule, topUpID *int) error {
	version, err := ensureAffiliateRuleVersionWithTx(tx, relation.InviterUserID, rule)
	if err != nil {
		return err
	}
	if _, _, err := createAffiliateRewardWithTx(tx, relation, rule, version.ID,
		AffiliateRewardTypeInviter, relation.InviterUserID, rule.InviterRewardQuota,
		topUpID, 0, relation.CumulativePaidCents,
		fmt.Sprintf("referral:%d:%s", relation.ID, AffiliateRewardTypeInviter)); err != nil {
		return err
	}
	_, _, err = createAffiliateRewardWithTx(tx, relation, rule, version.ID,
		AffiliateRewardTypeInvitee, relation.InviteeUserID, rule.InviteeRewardQuota,
		topUpID, 0, relation.CumulativePaidCents,
		fmt.Sprintf("referral:%d:%s", relation.ID, AffiliateRewardTypeInvitee))
	return err
}

func bindAffiliateReferralWithTx(tx *gorm.DB, invitee *User, inviterID int, issueRegistrationRewards bool) error {
	if inviterID <= 0 || inviterID == invitee.Id {
		return nil
	}
	var existing AffiliateReferral
	if err := tx.Where("invitee_user_id = ?", invitee.Id).First(&existing).Error; err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	var inviter User
	if err := tx.Where("id = ?", inviterID).First(&inviter).Error; err != nil {
		return err
	}
	if err := ensureAffiliateCodeWithTx(tx, &inviter); err != nil {
		return err
	}
	relation := AffiliateReferral{
		InviteeUserID: invitee.Id, InviterUserID: inviterID, CodeSnapshot: inviter.AffCode,
		Status: AffiliateReferralStatusBound, BoundAt: common.GetTimestamp(),
	}
	if err := tx.Create(&relation).Error; err != nil {
		return err
	}
	if err := tx.Model(&User{}).Where("id = ?", inviterID).Update("aff_count", gorm.Expr("aff_count + 1")).Error; err != nil {
		return err
	}
	if !issueRegistrationRewards || inviter.Status != common.UserStatusEnabled {
		return nil
	}
	rule, _, err := effectiveAffiliateRuleWithTx(tx, inviterID)
	if err != nil || !rule.Enabled || rule.RegistrationRewardTrigger != operation_setting.AffiliateRegistrationTriggerRegistrationSuccess {
		return err
	}
	return grantAffiliateRegistrationRewardsWithTx(tx, &relation, rule, nil)
}

func initializeAffiliateUserWithTx(tx *gorm.DB, user *User, inviterID int, issueRegistrationRewards bool) error {
	if err := ensureAffiliateCodeWithTx(tx, user); err != nil {
		return err
	}
	if _, err := ensureAffiliateQuotaAccountWithTx(tx, user.Id); err != nil {
		return err
	}
	return bindAffiliateReferralWithTx(tx, user, inviterID, issueRegistrationRewards)
}

func EnsureAffiliateProfile(userID int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		return initializeAffiliateUserWithTx(tx, &user, user.InviterId, false)
	})
}

func topUpPaidCents(topUp *TopUp) (int64, error) {
	if topUp == nil {
		return 0, ErrAffiliateAmountInvalid
	}
	if topUp.PaidCents > 0 {
		return topUp.PaidCents, nil
	}
	if topUp.Money <= 0 {
		return 0, ErrAffiliateAmountInvalid
	}
	amount := decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromInt(100)).Round(0)
	max := decimal.NewFromInt(int64(^uint64(0) >> 1))
	if amount.LessThanOrEqual(decimal.Zero) || amount.GreaterThan(max) {
		return 0, ErrAffiliateAmountInvalid
	}
	return amount.IntPart(), nil
}

func calculateAffiliateCashbackQuota(baseCents int64, rule AffiliateEffectiveRule) (int64, error) {
	if rule.RewardMode == operation_setting.AffiliateRewardModeFixed {
		return rule.FixedRewardQuota, nil
	}
	if baseCents <= 0 || rule.RewardRateBps <= 0 {
		return 0, nil
	}
	exchangeRate := operation_setting.USDExchangeRate
	if exchangeRate <= 0 {
		exchangeRate = 1
	}
	quotaValue := decimal.NewFromInt(baseCents).
		Div(decimal.NewFromInt(100)).
		Div(decimal.NewFromFloat(exchangeRate)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Mul(decimal.NewFromInt(rule.RewardRateBps)).
		Div(decimal.NewFromInt(10_000))
	quota, clamp := common.QuotaFromDecimalChecked(quotaValue)
	if clamp != nil {
		return 0, clamp
	}
	return int64(quota), nil
}

func qualifyAffiliateTopUpWithTx(tx *gorm.DB, topUp *TopUp) error {
	if topUp == nil || topUp.Status != common.TopUpStatusSuccess || topUp.CompletionSource != TopUpCompletionSourceOnlineWallet {
		return nil
	}
	var relation AffiliateReferral
	if err := lockForUpdate(tx).Where("invitee_user_id = ?", topUp.UserId).First(&relation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	var existing AffiliateTopUpEvent
	if err := tx.Where("top_up_id = ?", topUp.Id).First(&existing).Error; err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	paidCents, err := topUpPaidCents(topUp)
	if err != nil {
		return err
	}
	completedAt := topUp.CompleteTime
	if completedAt <= 0 {
		completedAt = common.GetTimestamp()
	}
	var invitee User
	if err := tx.Select("email").Where("id = ?", relation.InviteeUserID).First(&invitee).Error; err != nil {
		return err
	}
	event := AffiliateTopUpEvent{
		ReferralID: relation.ID, TopUpID: topUp.Id, InviterUserID: relation.InviterUserID,
		InviteeUserID: relation.InviteeUserID,
		MaskedEmail:   maskAffiliateEmail(invitee.Email, relation.InviteeUserID), PaidCents: paidCents,
		CumulativePaidCents: relation.CumulativePaidCents, Qualified: relation.Status == AffiliateReferralStatusQualified,
		CompletedAt: completedAt,
	}
	result := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "top_up_id"}},
		DoNothing: true,
	}).Create(&event)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return nil
	}
	var inviter User
	if err := tx.Select("id", "status").Where("id = ?", relation.InviterUserID).First(&inviter).Error; err != nil {
		return err
	}
	if inviter.Status != common.UserStatusEnabled {
		return nil
	}
	campaign, err := activeAffiliateCampaignWithTx(tx, completedAt)
	if err != nil {
		return err
	}
	if campaign != nil {
		return settleAffiliateCampaignTopUpWithTx(tx, campaign, topUp, &relation, &event, paidCents)
	}
	rule, _, err := effectiveAffiliateRuleWithTx(tx, relation.InviterUserID)
	if err != nil {
		return err
	}
	if !rule.Enabled {
		return nil
	}
	baseCents := paidCents
	firstQualified := relation.Status != AffiliateReferralStatusQualified
	if firstQualified {
		relation.CumulativePaidCents += paidCents
		event.CumulativePaidCents = relation.CumulativePaidCents
		if relation.CumulativePaidCents < rule.MinimumTopUpCents {
			if err := tx.Save(&relation).Error; err != nil {
				return err
			}
			return tx.Save(&event).Error
		}
		now := common.GetTimestamp()
		relation.Status = AffiliateReferralStatusQualified
		relation.QualifiedAt = now
		relation.QualifyingTopUpID = &topUp.Id
		event.Qualified = true
		baseCents = relation.CumulativePaidCents
		if rule.RegistrationRewardTrigger == operation_setting.AffiliateRegistrationTriggerFirstQualifiedTopUp {
			if err := grantAffiliateRegistrationRewardsWithTx(tx, &relation, rule, &topUp.Id); err != nil {
				return err
			}
		}
	} else if rule.CashbackFrequency != operation_setting.AffiliateCashbackFrequencyEveryTopUp {
		return tx.Save(&event).Error
	}
	rewardQuota, err := calculateAffiliateCashbackQuota(baseCents, rule)
	if err != nil {
		return err
	}
	if !rule.UnlimitedReward {
		remaining := rule.MaximumRewardQuota - relation.CashbackRewardedQuota
		if remaining < 0 {
			remaining = 0
		}
		if rewardQuota > remaining {
			rewardQuota = remaining
		}
	}
	if rewardQuota <= 0 {
		if err := tx.Save(&relation).Error; err != nil {
			return err
		}
		return tx.Save(&event).Error
	}
	version, err := ensureAffiliateRuleVersionWithTx(tx, relation.InviterUserID, rule)
	if err != nil {
		return err
	}
	reward, _, err := createAffiliateRewardWithTx(tx, &relation, rule, version.ID,
		AffiliateRewardTypeCashback, relation.InviterUserID, rewardQuota, &topUp.Id,
		paidCents, event.CumulativePaidCents, fmt.Sprintf("cashback:%d:%d", relation.ID, topUp.Id))
	if err != nil {
		return err
	}
	event.RewardID = &reward.ID
	relation.CashbackRewardedQuota += rewardQuota
	if err := tx.Save(&relation).Error; err != nil {
		return err
	}
	return tx.Save(&event).Error
}

func ProcessAffiliateTopUp(topUpID int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var topUp TopUp
		if err := lockForUpdate(tx).Where("id = ?", topUpID).First(&topUp).Error; err != nil {
			return err
		}
		if topUp.Status != common.TopUpStatusSuccess {
			return ErrTopUpStatusInvalid
		}
		return qualifyAffiliateTopUpWithTx(tx, &topUp)
	})
}

func lockAffiliateRewardWithRecipient(tx *gorm.DB, rewardID int) (*AffiliateReward, error) {
	var identity AffiliateReward
	if err := tx.Select("recipient_user_id").Where("id = ?", rewardID).First(&identity).Error; err != nil {
		return nil, err
	}
	var recipient User
	if err := lockForUpdate(tx).Select("id").Where("id = ?", identity.RecipientUserID).First(&recipient).Error; err != nil {
		return nil, err
	}
	var reward AffiliateReward
	if err := lockForUpdate(tx).Where("id = ?", rewardID).First(&reward).Error; err != nil {
		return nil, err
	}
	return &reward, nil
}

func releaseAffiliateRewardWithTx(tx *gorm.DB, rewardID int, now int64) (bool, error) {
	reward, err := lockAffiliateRewardWithRecipient(tx, rewardID)
	if err != nil {
		return false, err
	}
	if reward.Status != AffiliateRewardStatusPending || reward.AvailableAt > now {
		return false, nil
	}
	account, err := ensureAffiliateQuotaAccountWithTx(tx, reward.RecipientUserID)
	if err != nil {
		return false, err
	}
	remaining := reward.ActualQuota - reward.AdjustedQuota - reward.TransferredQuota
	if remaining < 0 || account.PendingQuota < remaining {
		return false, ErrAffiliateBalance
	}
	account.PendingQuota -= remaining
	account.AvailableQuota += remaining
	reward.Status = AffiliateRewardStatusAvailable
	if err := tx.Save(account).Error; err != nil {
		return false, err
	}
	if err := tx.Save(reward).Error; err != nil {
		return false, err
	}
	if err := appendAffiliateQuotaLedgerWithTx(tx, account, AffiliateQuotaLedger{
		EntryType: AffiliateLedgerTypeRewardAvailable, ReferenceType: AffiliateReferenceReward,
		ReferenceID: reward.ID, AmountQuota: remaining, PendingDeltaQuota: -remaining,
		AvailableDeltaQuota: remaining, IdempotencyKey: "reward:release:" + strconv.Itoa(reward.ID),
	}); err != nil {
		return false, err
	}
	return true, nil
}

func ReleaseDueAffiliateRewards(now int64, limit int) (int, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	var ids []int
	if err := DB.Model(&AffiliateReward{}).
		Where("status = ? AND available_at <= ?", AffiliateRewardStatusPending, now).
		Order("id asc").Limit(limit).Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	released := 0
	for _, id := range ids {
		changed := false
		err := DB.Transaction(func(tx *gorm.DB) error {
			var err error
			changed, err = releaseAffiliateRewardWithTx(tx, id, now)
			return err
		})
		if err != nil {
			return released, err
		}
		if changed {
			released++
		}
	}
	return released, nil
}

func releaseDueAffiliateRewardsForUser(userID int, now int64) error {
	var ids []int
	if err := DB.Model(&AffiliateReward{}).
		Where("recipient_user_id = ? AND status = ? AND available_at <= ?", userID, AffiliateRewardStatusPending, now).
		Order("id asc").Limit(500).Pluck("id", &ids).Error; err != nil {
		return err
	}
	for _, id := range ids {
		if err := DB.Transaction(func(tx *gorm.DB) error {
			_, err := releaseAffiliateRewardWithTx(tx, id, now)
			return err
		}); err != nil {
			return err
		}
	}
	return nil
}

func GetAffiliateQuotaAccount(userID int) (*AffiliateQuotaAccount, error) {
	if err := EnsureAffiliateProfile(userID); err != nil {
		return nil, err
	}
	if err := releaseDueAffiliateRewardsForUser(userID, common.GetTimestamp()); err != nil {
		return nil, err
	}
	var account AffiliateQuotaAccount
	if err := DB.Where("user_id = ?", userID).First(&account).Error; err != nil {
		return nil, err
	}
	return &account, nil
}

func GetAffiliateSummary(userID int) (*AffiliateSummary, error) {
	account, err := GetAffiliateQuotaAccount(userID)
	if err != nil {
		return nil, err
	}
	cashAccount, err := GetAffiliateCashAccount(userID)
	if err != nil {
		return nil, err
	}
	campaign, err := GetAffiliateCampaign()
	if err != nil {
		return nil, err
	}
	var user User
	if err := DB.Select("aff_code").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	rule, err := GetAffiliateEffectiveRule(userID)
	if err != nil {
		return nil, err
	}
	var referralCount, qualifiedCount int64
	if err := DB.Model(&AffiliateReferral{}).Where("inviter_user_id = ?", userID).Count(&referralCount).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&AffiliateReferral{}).Where("inviter_user_id = ? AND status = ?", userID, AffiliateReferralStatusQualified).Count(&qualifiedCount).Error; err != nil {
		return nil, err
	}
	var nextAvailableAt int64
	if err := DB.Model(&AffiliateReward{}).
		Where("recipient_user_id = ? AND status = ?", userID, AffiliateRewardStatusPending).
		Select("COALESCE(MIN(available_at), 0)").Scan(&nextAvailableAt).Error; err != nil {
		return nil, err
	}
	var cashNextAvailableAt int64
	if err := DB.Model(&AffiliateCashReward{}).
		Where("inviter_user_id = ? AND status = ?", userID, AffiliateRewardStatusPending).
		Select("COALESCE(MIN(available_at), 0)").Scan(&cashNextAvailableAt).Error; err != nil {
		return nil, err
	}
	if nextAvailableAt == 0 || (cashNextAvailableAt > 0 && cashNextAvailableAt < nextAvailableAt) {
		nextAvailableAt = cashNextAvailableAt
	}
	var lifetimeCampaignBonusQuota int64
	if err := DB.Model(&AffiliateQuotaGrant{}).
		Where("user_id = ? AND status = ?", userID, AffiliateRewardStatusCredited).
		Select("COALESCE(SUM(bonus_quota), 0)").Scan(&lifetimeCampaignBonusQuota).Error; err != nil {
		return nil, err
	}
	if campaign.Enabled {
		rule.Enabled = true
		rule.RewardMode = operation_setting.AffiliateRewardModePercentage
		rule.CashbackFrequency = operation_setting.AffiliateCashbackFrequencyEveryTopUp
		rule.RewardRateBps = campaign.InviterCashbackRateBps
	}
	return &AffiliateSummary{
		Enabled: rule.Enabled, ReferralCode: user.AffCode, Currency: "CNY",
		ReferralCount: referralCount, QualifiedCount: qualifiedCount,
		NextAvailableAt: nextAvailableAt, LifetimeCampaignBonusQuota: lifetimeCampaignBonusQuota,
		Rule: rule, Account: *account,
		CashAccount: *cashAccount, Campaign: *campaign,
	}, nil
}

func CreateAffiliateBalanceTransfer(userID int, amountQuota int64, requestKey string) (*AffiliateBalanceTransfer, error) {
	requestKey = strings.TrimSpace(requestKey)
	if amountQuota <= 0 || amountQuota > int64(common.MaxQuota) || requestKey == "" || len(requestKey) > 64 {
		return nil, ErrAffiliateAmountInvalid
	}
	if err := releaseDueAffiliateRewardsForUser(userID, common.GetTimestamp()); err != nil {
		return nil, err
	}
	var transfer AffiliateBalanceTransfer
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND request_key = ?", userID, requestKey).First(&transfer).Error; err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		rule, _, err := effectiveAffiliateRuleWithTx(tx, userID)
		if err != nil {
			return err
		}
		if amountQuota < rule.MinimumTransferQuota {
			return ErrAffiliateTransferTooSmall
		}
		var user User
		if err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		var rewards []AffiliateReward
		if err := lockForUpdate(tx).
			Where("recipient_user_id = ? AND status = ? AND actual_quota - adjusted_quota - transferred_quota > 0", userID, AffiliateRewardStatusAvailable).
			Order("available_at asc, id asc").Find(&rewards).Error; err != nil {
			return err
		}
		account, err := ensureAffiliateQuotaAccountWithTx(tx, userID)
		if err != nil {
			return err
		}
		if account.AvailableQuota < amountQuota {
			return ErrAffiliateBalance
		}
		quotaAfter := int64(user.Quota) + amountQuota
		if quotaAfter > int64(common.MaxQuota) {
			return ErrAffiliateAmountInvalid
		}
		transfer = AffiliateBalanceTransfer{
			UserID: userID, RequestKey: requestKey, AmountQuota: amountQuota,
			AffiliateBalanceBefore: account.AvailableQuota,
			AffiliateBalanceAfter:  account.AvailableQuota - amountQuota,
			UserQuotaBefore:        user.Quota, UserQuotaAfter: int(quotaAfter),
		}
		result := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "request_key"}},
			DoNothing: true,
		}).Create(&transfer)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return tx.Where("user_id = ? AND request_key = ?", userID, requestKey).First(&transfer).Error
		}
		remaining := amountQuota
		for index := range rewards {
			available := rewards[index].ActualQuota - rewards[index].AdjustedQuota - rewards[index].TransferredQuota
			allocated := available
			if allocated > remaining {
				allocated = remaining
			}
			rewards[index].TransferredQuota += allocated
			if rewards[index].TransferredQuota+rewards[index].AdjustedQuota >= rewards[index].ActualQuota {
				rewards[index].Status = AffiliateRewardStatusTransferred
			}
			if err := tx.Save(&rewards[index]).Error; err != nil {
				return err
			}
			remaining -= allocated
			if remaining == 0 {
				break
			}
		}
		if remaining != 0 {
			return ErrAffiliateBalance
		}
		account.AvailableQuota -= amountQuota
		account.TransferredQuota += amountQuota
		if err := tx.Save(account).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userID).Update("quota", int(quotaAfter)).Error; err != nil {
			return err
		}
		return appendAffiliateQuotaLedgerWithTx(tx, account, AffiliateQuotaLedger{
			EntryType: AffiliateLedgerTypeBalanceTransfer, ReferenceType: AffiliateReferenceTransfer,
			ReferenceID: transfer.ID, AmountQuota: amountQuota, AvailableDeltaQuota: -amountQuota,
			TransferredDeltaQuota: amountQuota, IdempotencyKey: "balance-transfer:" + strconv.Itoa(transfer.ID),
		})
	})
	if err != nil {
		return nil, err
	}
	_ = InvalidateUserCache(userID)
	return &transfer, nil
}

// CreateAffiliateRewardBalanceTransfer transfers one cashback reward in full.
// The legacy amount-based transfer remains available for older clients.
func CreateAffiliateRewardBalanceTransfer(userID int, rewardID int, requestKey string) (*AffiliateBalanceTransfer, error) {
	requestKey = strings.TrimSpace(requestKey)
	if userID <= 0 || rewardID <= 0 || requestKey == "" || len(requestKey) > 64 {
		return nil, ErrAffiliateAmountInvalid
	}
	if err := releaseDueAffiliateRewardsForUser(userID, common.GetTimestamp()); err != nil {
		return nil, err
	}
	var transfer AffiliateBalanceTransfer
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND request_key = ?", userID, requestKey).First(&transfer).Error; err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var user User
		if err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		reward, err := lockAffiliateRewardWithRecipient(tx, rewardID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAffiliateRewardNotFound
			}
			return err
		}
		if reward.InviterUserID != userID || reward.RewardType != AffiliateRewardTypeCashback {
			return ErrAffiliateRewardNotFound
		}
		if reward.Status != AffiliateRewardStatusAvailable || reward.AvailableAt > common.GetTimestamp() {
			return ErrAffiliateBalance
		}
		amountQuota := reward.ActualQuota - reward.AdjustedQuota - reward.TransferredQuota
		if amountQuota <= 0 {
			return ErrAffiliateBalance
		}
		account, err := ensureAffiliateQuotaAccountWithTx(tx, userID)
		if err != nil {
			return err
		}
		if account.AvailableQuota < amountQuota {
			return ErrAffiliateBalance
		}
		quotaAfter := int64(user.Quota) + amountQuota
		if quotaAfter > int64(common.MaxQuota) {
			return ErrAffiliateAmountInvalid
		}
		transfer = AffiliateBalanceTransfer{
			UserID: userID, RequestKey: requestKey, AmountQuota: amountQuota,
			AffiliateBalanceBefore: account.AvailableQuota,
			AffiliateBalanceAfter:  account.AvailableQuota - amountQuota,
			UserQuotaBefore:        user.Quota, UserQuotaAfter: int(quotaAfter),
		}
		result := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "request_key"}},
			DoNothing: true,
		}).Create(&transfer)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return tx.Where("user_id = ? AND request_key = ?", userID, requestKey).First(&transfer).Error
		}
		reward.TransferredQuota += amountQuota
		reward.Status = AffiliateRewardStatusTransferred
		if err := tx.Save(reward).Error; err != nil {
			return err
		}
		account.AvailableQuota -= amountQuota
		account.TransferredQuota += amountQuota
		if err := tx.Save(account).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userID).Update("quota", int(quotaAfter)).Error; err != nil {
			return err
		}
		return appendAffiliateQuotaLedgerWithTx(tx, account, AffiliateQuotaLedger{
			EntryType: AffiliateLedgerTypeBalanceTransfer, ReferenceType: AffiliateReferenceTransfer,
			ReferenceID: transfer.ID, AmountQuota: amountQuota, AvailableDeltaQuota: -amountQuota,
			TransferredDeltaQuota: amountQuota, IdempotencyKey: "balance-transfer:" + strconv.Itoa(transfer.ID),
		})
	})
	if err != nil {
		return nil, err
	}
	_ = InvalidateUserCache(userID)
	return &transfer, nil
}

func GetAffiliateBalanceTransfers(userID int, startIdx int, limit int) ([]AffiliateBalanceTransfer, int64, error) {
	var items []AffiliateBalanceTransfer
	var total int64
	query := DB.Model(&AffiliateBalanceTransfer{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("id desc").Offset(startIdx).Limit(limit).Find(&items).Error
	return items, total, err
}

func maskAffiliateEmail(email string, userID int) string {
	email = strings.TrimSpace(email)
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return fmt.Sprintf("user ****%04d", userID%10_000)
	}
	local := []rune(parts[0])
	switch len(local) {
	case 1:
		local = []rune("*")
	case 2:
		local = append(local[:1], '*')
	default:
		local = append(append(append([]rune{}, local[:1]...), []rune("***")...), local[len(local)-1])
	}
	return string(local) + "@" + parts[1]
}

func affiliateTopUpTimeRange(keyword string) (int64, int64, bool) {
	formats := []struct {
		layout string
		step   func(time.Time) time.Time
	}{
		{layout: "2006-01-02 15:04:05", step: func(value time.Time) time.Time { return value.Add(time.Second) }},
		{layout: "2006-01-02 15:04", step: func(value time.Time) time.Time { return value.Add(time.Minute) }},
		{layout: "2006-01-02", step: func(value time.Time) time.Time { return value.AddDate(0, 0, 1) }},
		{layout: "2006-01", step: func(value time.Time) time.Time { return value.AddDate(0, 1, 0) }},
		{layout: "2006", step: func(value time.Time) time.Time { return value.AddDate(1, 0, 0) }},
	}
	for _, format := range formats {
		value, err := time.ParseInLocation(format.layout, keyword, time.Local)
		if err != nil {
			continue
		}
		return value.Unix(), format.step(value).Unix(), true
	}
	return 0, 0, false
}

func GetAffiliateInviteeTopUps(userID int, status string, keyword string, startAt int64, endAt int64, startIdx int, limit int) ([]AffiliateInviteeTopUp, int64, error) {
	return GetAffiliateInviteeTopUpsSorted(userID, status, keyword, "recharge_time_desc", startAt, endAt, startIdx, limit)
}

func GetAffiliateInviteeTopUpsSorted(userID int, status string, keyword string, sort string, startAt int64, endAt int64, startIdx int, limit int) ([]AffiliateInviteeTopUp, int64, error) {
	rule, err := GetAffiliateEffectiveRule(userID)
	if err != nil {
		return nil, 0, err
	}
	if !rule.ShowInviteeTopUps {
		return nil, 0, ErrAffiliateTopUpsHidden
	}
	if err := releaseDueAffiliateRewardsForUser(userID, common.GetTimestamp()); err != nil {
		return nil, 0, err
	}
	if err := releaseDueAffiliateCashRewardsForUser(userID, common.GetTimestamp()); err != nil {
		return nil, 0, err
	}
	type row struct {
		EventID              int
		TopUpID              int
		InviteeUserID        int
		MaskedEmail          string
		BoundAt              int64
		CodeSnapshot         string
		CompletedAt          int64
		PaidCents            int64
		Qualified            bool
		RewardID             *int
		RewardMode           *string
		RewardRateBps        *int64
		FixedRewardQuota     *int64
		ActualQuota          *int64
		AdjustedQuota        *int64
		TransferredQuota     *int64
		AvailableAt          *int64
		RewardStatus         *string
		CashRewardID         *int
		CashRewardRateBps    *int64
		CashbackCents        *int64
		CashTransferredCents *int64
		CashAvailableAt      *int64
		CashRewardStatus     *string
	}
	query := DB.Table("affiliate_top_up_events AS e").
		Select("e.id AS event_id, e.top_up_id, e.invitee_user_id, e.masked_email, r.bound_at, r.code_snapshot, e.completed_at, e.paid_cents, e.qualified, e.reward_id, ar.reward_mode, ar.reward_rate_bps, ar.fixed_reward_quota, ar.actual_quota, ar.adjusted_quota, ar.transferred_quota, ar.available_at, ar.status AS reward_status, e.cash_reward_id, acr.reward_rate_bps AS cash_reward_rate_bps, acr.cashback_cents, acr.transferred_cents AS cash_transferred_cents, acr.available_at AS cash_available_at, acr.status AS cash_reward_status").
		Joins("JOIN affiliate_referrals AS r ON r.id = e.referral_id").
		Joins("JOIN users AS invitee ON invitee.id = e.invitee_user_id").
		Joins("LEFT JOIN affiliate_rewards AS ar ON ar.id = e.reward_id").
		Joins("LEFT JOIN affiliate_cash_rewards AS acr ON acr.id = e.cash_reward_id").
		Where("e.inviter_user_id = ?", userID)
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		normalizedKeyword := strings.ToLower(keyword)
		pattern := "%" + strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(normalizedKeyword, "!", "!!"), "%", "!%"), "_", "!_") + "%"
		if rangeStart, rangeEnd, ok := affiliateTopUpTimeRange(keyword); ok {
			query = query.Where("(LOWER(e.masked_email) LIKE ? ESCAPE '!' OR LOWER(invitee.email) LIKE ? ESCAPE '!' OR LOWER(r.code_snapshot) LIKE ? ESCAPE '!' OR (e.completed_at >= ? AND e.completed_at < ?))", pattern, pattern, pattern, rangeStart, rangeEnd)
		} else {
			query = query.Where("(LOWER(e.masked_email) LIKE ? ESCAPE '!' OR LOWER(invitee.email) LIKE ? ESCAPE '!' OR LOWER(r.code_snapshot) LIKE ? ESCAPE '!')", pattern, pattern, pattern)
		}
	}
	if startAt > 0 {
		query = query.Where("e.completed_at >= ?", startAt)
	}
	if endAt > 0 {
		query = query.Where("e.completed_at <= ?", endAt)
	}
	switch status {
	case "unqualified":
		query = query.Where("e.qualified = ?", false)
	case AffiliateRewardStatusPending, AffiliateRewardStatusAvailable, AffiliateRewardStatusTransferred, AffiliateRewardStatusAdjusted:
		query = query.Where("(ar.status = ? OR acr.status = ?)", status, status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []row
	order := "e.completed_at desc, e.id desc"
	if sort == "recharge_time_asc" {
		order = "e.completed_at asc, e.id asc"
	}
	if err := query.Order(order).Offset(startIdx).Limit(limit).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]AffiliateInviteeTopUp, 0, len(rows))
	for _, current := range rows {
		item := AffiliateInviteeTopUp{
			ID: current.EventID, MaskedEmail: current.MaskedEmail,
			InvitedAt: current.BoundAt, InvitationCode: current.CodeSnapshot,
			TopUpID: current.TopUpID, TopUpAt: current.CompletedAt, PaidCents: current.PaidCents,
			Status: "unqualified",
		}
		if current.Qualified {
			item.Status = AffiliateRewardStatusAvailable
		}
		if current.RewardID != nil {
			item.RewardID = *current.RewardID
			if current.RewardMode != nil {
				item.RewardMode = *current.RewardMode
			}
			if current.RewardRateBps != nil {
				item.RewardRateBps = *current.RewardRateBps
			}
			if current.FixedRewardQuota != nil {
				item.FixedRewardQuota = *current.FixedRewardQuota
			}
			if current.ActualQuota != nil {
				item.RewardQuota = *current.ActualQuota
			}
			if current.AdjustedQuota != nil {
				item.RewardQuota -= *current.AdjustedQuota
			}
			if current.TransferredQuota != nil {
				item.TransferredRewardQuota = *current.TransferredQuota
				item.AvailableRewardQuota = item.RewardQuota - *current.TransferredQuota
			}
			if item.AvailableRewardQuota < 0 {
				item.AvailableRewardQuota = 0
			}
			if current.AvailableAt != nil {
				item.AvailableAt = *current.AvailableAt
			}
			if current.RewardStatus != nil {
				item.Status = *current.RewardStatus
			}
		}
		if current.CashRewardID != nil {
			item.CashRewardID = *current.CashRewardID
			item.RewardMode = operation_setting.AffiliateRewardModePercentage
			if current.CashRewardRateBps != nil {
				item.RewardRateBps = *current.CashRewardRateBps
			}
			if current.CashbackCents != nil {
				item.RewardCents = *current.CashbackCents
				item.AvailableRewardCents = *current.CashbackCents
			}
			if current.CashTransferredCents != nil {
				item.TransferredRewardCents = *current.CashTransferredCents
				item.AvailableRewardCents -= *current.CashTransferredCents
			}
			if item.AvailableRewardCents < 0 {
				item.AvailableRewardCents = 0
			}
			if current.CashAvailableAt != nil {
				item.AvailableAt = *current.CashAvailableAt
			}
			if current.CashRewardStatus != nil {
				item.Status = *current.CashRewardStatus
			}
		}
		items = append(items, item)
	}
	return items, total, nil
}

func GetAffiliateAdminRewards(keyword string, status string, startAt int64, endAt int64, startIdx int, limit int) ([]AffiliateAdminReward, int64, error) {
	query := DB.Table("affiliate_rewards AS ar").
		Select("ar.id, ar.inviter_user_id, inviter.username AS inviter_username, ar.invitee_user_id, invitee.email AS invitee_email, r.code_snapshot AS invitation_code, ar.top_up_id, t.trade_no, ar.paid_cents, ar.actual_quota, ar.adjusted_quota, ar.transferred_quota, ar.status, ar.available_at, ar.created_at").
		Joins("JOIN affiliate_referrals AS r ON r.id = ar.referral_id").
		Joins("JOIN users AS inviter ON inviter.id = ar.inviter_user_id").
		Joins("JOIN users AS invitee ON invitee.id = ar.invitee_user_id").
		Joins("LEFT JOIN top_ups AS t ON t.id = ar.top_up_id").
		Where("ar.reward_type = ?", AffiliateRewardTypeCashback)

	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		pattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		if userID, err := strconv.Atoi(keyword); err == nil && userID > 0 {
			query = query.Where("(inviter.username LIKE ? ESCAPE '!' OR inviter.email LIKE ? ESCAPE '!' OR invitee.username LIKE ? ESCAPE '!' OR invitee.email LIKE ? ESCAPE '!' OR r.code_snapshot LIKE ? ESCAPE '!' OR t.trade_no LIKE ? ESCAPE '!' OR ar.inviter_user_id = ? OR ar.invitee_user_id = ?)", pattern, pattern, pattern, pattern, pattern, pattern, userID, userID)
		} else {
			query = query.Where("(inviter.username LIKE ? ESCAPE '!' OR inviter.email LIKE ? ESCAPE '!' OR invitee.username LIKE ? ESCAPE '!' OR invitee.email LIKE ? ESCAPE '!' OR r.code_snapshot LIKE ? ESCAPE '!' OR t.trade_no LIKE ? ESCAPE '!')", pattern, pattern, pattern, pattern, pattern, pattern)
		}
	}
	switch status {
	case AffiliateRewardStatusPending, AffiliateRewardStatusAvailable, AffiliateRewardStatusTransferred, AffiliateRewardStatusAdjusted:
		query = query.Where("ar.status = ?", status)
	}
	if startAt > 0 {
		query = query.Where("ar.created_at >= ?", startAt)
	}
	if endAt > 0 {
		query = query.Where("ar.created_at <= ?", endAt)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []AffiliateAdminReward
	if err := query.Order("ar.created_at desc, ar.id desc").Offset(startIdx).Limit(limit).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	for index := range items {
		items[index].InviteeEmail = maskAffiliateEmail(items[index].InviteeEmail, items[index].InviteeUserID)
	}
	return items, total, nil
}

func SaveAffiliateUserOverride(userID int, adminUserID int, override AffiliateUserOverride) (*AffiliateUserOverrideView, error) {
	changeReason := strings.TrimSpace(override.ChangeReason)
	if userID <= 0 || adminUserID <= 0 || changeReason == "" || len(changeReason) > 500 {
		return nil, ErrAffiliateRuleInvalid
	}
	override.UserID = userID
	override.ID = 0
	override.UpdatedBy = adminUserID
	override.ChangeReason = changeReason
	rule := applyAffiliateOverride(globalAffiliateRule(), &override)
	if err := validateAffiliateRule(rule); err != nil {
		return nil, err
	}
	if err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := tx.Select("id").Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			UpdateAll: true,
		}).Create(&override).Error
	}); err != nil {
		return nil, err
	}
	return GetAffiliateUserOverrideView(userID)
}

func DeleteAffiliateUserOverride(userID int) error {
	return DB.Where("user_id = ?", userID).Delete(&AffiliateUserOverride{}).Error
}

func GetAffiliateUserOverrideView(userID int) (*AffiliateUserOverrideView, error) {
	var user User
	if err := DB.Select("id", "username", "email").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	global := globalAffiliateRule()
	var override AffiliateUserOverride
	var overridePtr *AffiliateUserOverride
	updatedByUsername := ""
	if err := DB.Where("user_id = ?", userID).First(&override).Error; err == nil {
		overridePtr = &override
		if override.UpdatedBy > 0 {
			var updatedBy User
			if err := DB.Unscoped().Select("username").Where("id = ?", override.UpdatedBy).First(&updatedBy).Error; err == nil {
				updatedByUsername = updatedBy.Username
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	effective := applyAffiliateOverride(global, overridePtr)
	return &AffiliateUserOverrideView{
		UserID: user.Id, Username: user.Username, Email: user.Email,
		UpdatedByUsername: updatedByUsername,
		Override:          overridePtr, GlobalRule: global, EffectiveRule: effective,
	}, nil
}

func AdjustAffiliateReward(rewardID int, adminUserID int, amountQuota int64, reason string, requestKey string) (*AffiliateAdjustment, error) {
	reason = strings.TrimSpace(reason)
	requestKey = strings.TrimSpace(requestKey)
	if rewardID <= 0 || adminUserID <= 0 || amountQuota <= 0 || amountQuota > int64(common.MaxQuota) || reason == "" || len(reason) > 500 || requestKey == "" || len(requestKey) > 64 {
		return nil, ErrAffiliateAmountInvalid
	}
	var adjustment AffiliateAdjustment
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("reward_id = ? AND request_key = ?", rewardID, requestKey).First(&adjustment).Error; err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		reward, err := lockAffiliateRewardWithRecipient(tx, rewardID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAffiliateRewardNotFound
			}
			return err
		}
		if reward.RewardType != AffiliateRewardTypeCashback {
			return ErrAffiliateAmountInvalid
		}
		remaining := reward.ActualQuota - reward.AdjustedQuota - reward.TransferredQuota
		if remaining < 0 {
			remaining = 0
		}
		applied := amountQuota
		if applied > remaining {
			applied = remaining
		}
		manual := amountQuota - applied
		status := AffiliateAdjustmentStatusApplied
		if manual > 0 {
			status = AffiliateAdjustmentStatusManualRequired
		}
		adjustment = AffiliateAdjustment{
			RewardID: rewardID, RequestKey: requestKey, AdminUserID: adminUserID, RequestedQuota: amountQuota,
			AppliedQuota: applied, PendingManualQuota: manual, Status: status, Reason: reason,
		}
		result := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "reward_id"}, {Name: "request_key"}},
			DoNothing: true,
		}).Create(&adjustment)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return tx.Where("reward_id = ? AND request_key = ?", rewardID, requestKey).First(&adjustment).Error
		}
		if applied == 0 {
			return nil
		}
		account, err := ensureAffiliateQuotaAccountWithTx(tx, reward.RecipientUserID)
		if err != nil {
			return err
		}
		entry := AffiliateQuotaLedger{
			EntryType: AffiliateLedgerTypeAdjustment, ReferenceType: AffiliateReferenceAdjustment,
			ReferenceID: adjustment.ID, AmountQuota: -applied,
			IdempotencyKey: "adjustment:" + strconv.Itoa(adjustment.ID),
		}
		if reward.Status == AffiliateRewardStatusPending {
			if account.PendingQuota < applied {
				return ErrAffiliateBalance
			}
			account.PendingQuota -= applied
			entry.PendingDeltaQuota = -applied
		} else {
			if account.AvailableQuota < applied {
				return ErrAffiliateBalance
			}
			account.AvailableQuota -= applied
			entry.AvailableDeltaQuota = -applied
		}
		reward.AdjustedQuota += applied
		if reward.AdjustedQuota+reward.TransferredQuota >= reward.ActualQuota {
			reward.Status = AffiliateRewardStatusAdjusted
		}
		if err := tx.Save(account).Error; err != nil {
			return err
		}
		if err := tx.Save(reward).Error; err != nil {
			return err
		}
		return appendAffiliateQuotaLedgerWithTx(tx, account, entry)
	})
	if err != nil {
		return nil, err
	}
	return &adjustment, nil
}

func UpdateAffiliateSetting(next operation_setting.AffiliateSetting) error {
	rule := AffiliateEffectiveRule{
		Enabled: next.Enabled, InviterRewardQuota: next.InviterRewardQuota,
		InviteeRewardQuota: next.InviteeRewardQuota, RegistrationRewardTrigger: next.RegistrationRewardTrigger,
		RewardMode: next.RewardMode, CashbackFrequency: next.CashbackFrequency,
		RewardRateBps: next.RewardRateBps, FixedRewardQuota: next.FixedRewardQuota,
		UnlimitedReward: next.UnlimitedReward, MaximumRewardQuota: next.MaximumRewardQuota,
		MinimumTopUpCents: next.MinimumTopUpCents, HoldSeconds: next.HoldSeconds,
		MinimumTransferQuota: next.MinimumTransferQuota, ShowInviteeTopUps: next.ShowInviteeTopUps,
		Source: "global",
	}
	if err := validateAffiliateRule(rule); err != nil {
		return err
	}
	values := map[string]string{
		"affiliate_setting.enabled":                     strconv.FormatBool(next.Enabled),
		"affiliate_setting.inviter_reward_quota":        strconv.FormatInt(next.InviterRewardQuota, 10),
		"affiliate_setting.invitee_reward_quota":        strconv.FormatInt(next.InviteeRewardQuota, 10),
		"affiliate_setting.registration_reward_trigger": next.RegistrationRewardTrigger,
		"affiliate_setting.reward_mode":                 next.RewardMode,
		"affiliate_setting.cashback_frequency":          next.CashbackFrequency,
		"affiliate_setting.reward_rate_bps":             strconv.FormatInt(next.RewardRateBps, 10),
		"affiliate_setting.fixed_reward_quota":          strconv.FormatInt(next.FixedRewardQuota, 10),
		"affiliate_setting.unlimited_reward":            strconv.FormatBool(next.UnlimitedReward),
		"affiliate_setting.maximum_reward_quota":        strconv.FormatInt(next.MaximumRewardQuota, 10),
		"affiliate_setting.minimum_topup_cents":         strconv.FormatInt(next.MinimumTopUpCents, 10),
		"affiliate_setting.hold_seconds":                strconv.FormatInt(next.HoldSeconds, 10),
		"affiliate_setting.minimum_transfer_quota":      strconv.FormatInt(next.MinimumTransferQuota, 10),
		"affiliate_setting.show_invitee_topups":         strconv.FormatBool(next.ShowInviteeTopUps),
	}
	return UpdateOptionsBulk(values)
}

func GetGlobalAffiliateSetting() operation_setting.AffiliateSetting {
	return normalizedAffiliateSetting()
}
