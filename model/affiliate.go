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
)

const (
	AffiliateCampaignStatusActive   = "active"
	AffiliateCampaignStatusDisabled = "disabled"

	AffiliateCodeStatusActive   = "active"
	AffiliateCodeStatusDisabled = "disabled"

	ReferralStatusBound     = "bound"
	ReferralStatusQualified = "qualified"

	AffiliateCommissionStatusPending   = "pending"
	AffiliateCommissionStatusAvailable = "available"
	AffiliateCommissionStatusReversed  = "reversed"

	WithdrawalStatusPending   = "pending"
	WithdrawalStatusApproved  = "approved"
	WithdrawalStatusPaid      = "paid"
	WithdrawalStatusRejected  = "rejected"
	WithdrawalStatusCancelled = "cancelled"

	AffiliateLedgerTypeCommissionPending   = "commission_pending"
	AffiliateLedgerTypeCommissionAvailable = "commission_available"
	AffiliateLedgerTypeWithdrawalApplied   = "withdrawal_applied"
	AffiliateLedgerTypeWithdrawalRejected  = "withdrawal_rejected"
	AffiliateLedgerTypeWithdrawalCancelled = "withdrawal_cancelled"
	AffiliateLedgerTypeWithdrawalPaid      = "withdrawal_paid"

	AffiliateReferenceCommission = "commission"
	AffiliateReferenceWithdrawal = "withdrawal"
)

var (
	ErrAffiliateDisabled         = errors.New("affiliate cashback is disabled")
	ErrAffiliateCompliance       = errors.New("payment compliance confirmation is required")
	ErrAffiliateAmountInvalid    = errors.New("invalid cashback amount")
	ErrAffiliateBalance          = errors.New("insufficient available cashback balance")
	ErrWithdrawalStatusInvalid   = errors.New("withdrawal status does not allow this operation")
	ErrWithdrawalNotFound        = errors.New("withdrawal request not found")
	ErrAffiliateStatementMissing = errors.New("affiliate statement not found")
)

type AffiliateCampaign struct {
	ID                      int    `json:"id"`
	Name                    string `json:"name" gorm:"type:varchar(128);not null"`
	ConfigKey               string `json:"-" gorm:"type:varchar(64);uniqueIndex;not null"`
	Status                  string `json:"status" gorm:"type:varchar(20);index;not null"`
	Currency                string `json:"currency" gorm:"type:varchar(8);not null"`
	RewardMicros            int64  `json:"reward_micros" gorm:"type:bigint;not null"`
	MinimumTopUpMicros      int64  `json:"minimum_topup_micros" gorm:"type:bigint;not null"`
	HoldSeconds             int64  `json:"hold_seconds" gorm:"type:bigint;not null"`
	MinimumWithdrawalMicros int64  `json:"minimum_withdrawal_micros" gorm:"type:bigint;not null"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime"`
}

type AffiliateCode struct {
	ID            int    `json:"id"`
	OwnerUserID   int    `json:"owner_user_id" gorm:"uniqueIndex;not null"`
	CampaignID    int    `json:"campaign_id" gorm:"index;not null"`
	Code          string `json:"code" gorm:"type:varchar(32);uniqueIndex;not null"`
	Status        string `json:"status" gorm:"type:varchar(20);index;not null"`
	UsageLimit    int    `json:"usage_limit" gorm:"not null"`
	UsageCount    int    `json:"usage_count" gorm:"not null"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime"`
	LastUpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type ReferralRelation struct {
	ID                 int    `json:"id"`
	InviteeUserID      int    `json:"invitee_user_id" gorm:"uniqueIndex;not null"`
	InviterUserID      int    `json:"inviter_user_id" gorm:"index;not null"`
	AffiliateCodeID    int    `json:"affiliate_code_id" gorm:"index;not null"`
	CampaignID         int    `json:"campaign_id" gorm:"index;not null"`
	CodeSnapshot       string `json:"code_snapshot" gorm:"type:varchar(32);not null"`
	Currency           string `json:"currency" gorm:"type:varchar(8);not null"`
	RewardMicros       int64  `json:"reward_micros" gorm:"type:bigint;not null"`
	MinimumTopUpMicros int64  `json:"minimum_topup_micros" gorm:"type:bigint;not null"`
	HoldSeconds        int64  `json:"hold_seconds" gorm:"type:bigint;not null"`
	Status             string `json:"status" gorm:"type:varchar(20);index;not null"`
	BoundAt            int64  `json:"bound_at" gorm:"not null"`
	QualifiedAt        int64  `json:"qualified_at" gorm:"not null"`
	QualifyingTopUpID  *int   `json:"qualifying_topup_id,omitempty" gorm:"uniqueIndex"`
}

type AffiliateCommission struct {
	ID                 int    `json:"id"`
	InviterUserID      int    `json:"inviter_user_id" gorm:"index;not null"`
	InviteeUserID      int    `json:"invitee_user_id" gorm:"index;not null"`
	ReferralRelationID int    `json:"referral_relation_id" gorm:"index;not null"`
	TopUpID            int    `json:"topup_id" gorm:"uniqueIndex;not null"`
	CampaignID         int    `json:"campaign_id" gorm:"index;not null"`
	Currency           string `json:"currency" gorm:"type:varchar(8);not null"`
	AmountMicros       int64  `json:"amount_micros" gorm:"type:bigint;not null"`
	Status             string `json:"status" gorm:"type:varchar(20);index;not null"`
	AvailableAt        int64  `json:"available_at" gorm:"index;not null"`
	CreatedAt          int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt          int64  `json:"updated_at" gorm:"autoUpdateTime"`
	IdempotencyKey     string `json:"-" gorm:"type:varchar(128);uniqueIndex;not null"`
}

type AffiliateAccount struct {
	ID                   int    `json:"id"`
	UserID               int    `json:"user_id" gorm:"uniqueIndex;not null"`
	Currency             string `json:"currency" gorm:"type:varchar(8);not null"`
	PendingMicros        int64  `json:"pending_micros" gorm:"type:bigint;not null"`
	AvailableMicros      int64  `json:"available_micros" gorm:"type:bigint;not null"`
	FrozenMicros         int64  `json:"frozen_micros" gorm:"type:bigint;not null"`
	WithdrawnMicros      int64  `json:"withdrawn_micros" gorm:"type:bigint;not null"`
	LifetimeEarnedMicros int64  `json:"lifetime_earned_micros" gorm:"type:bigint;not null"`
	DebtMicros           int64  `json:"debt_micros" gorm:"type:bigint;not null"`
	CreatedAt            int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt            int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type AffiliateLedger struct {
	ID                     int    `json:"id"`
	UserID                 int    `json:"user_id" gorm:"index;not null"`
	AccountID              int    `json:"account_id" gorm:"index;not null"`
	EntryType              string `json:"entry_type" gorm:"type:varchar(40);index;not null"`
	ReferenceType          string `json:"reference_type" gorm:"type:varchar(32);index;not null"`
	ReferenceID            int    `json:"reference_id" gorm:"index;not null"`
	Currency               string `json:"currency" gorm:"type:varchar(8);not null"`
	AmountMicros           int64  `json:"amount_micros" gorm:"type:bigint;not null"`
	PendingDeltaMicros     int64  `json:"pending_delta_micros" gorm:"type:bigint;not null"`
	AvailableDeltaMicros   int64  `json:"available_delta_micros" gorm:"type:bigint;not null"`
	FrozenDeltaMicros      int64  `json:"frozen_delta_micros" gorm:"type:bigint;not null"`
	WithdrawnDeltaMicros   int64  `json:"withdrawn_delta_micros" gorm:"type:bigint;not null"`
	PendingBalanceMicros   int64  `json:"pending_balance_micros" gorm:"type:bigint;not null"`
	AvailableBalanceMicros int64  `json:"available_balance_micros" gorm:"type:bigint;not null"`
	FrozenBalanceMicros    int64  `json:"frozen_balance_micros" gorm:"type:bigint;not null"`
	WithdrawnBalanceMicros int64  `json:"withdrawn_balance_micros" gorm:"type:bigint;not null"`
	IdempotencyKey         string `json:"-" gorm:"type:varchar(128);uniqueIndex;not null"`
	CreatedAt              int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

type WithdrawalRequest struct {
	ID                     int    `json:"id"`
	UserID                 int    `json:"user_id" gorm:"uniqueIndex:idx_withdrawal_user_request;index;not null"`
	RequestKey             string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_withdrawal_user_request;not null"`
	Currency               string `json:"currency" gorm:"type:varchar(8);not null"`
	AmountMicros           int64  `json:"amount_micros" gorm:"type:bigint;not null"`
	Status                 string `json:"status" gorm:"type:varchar(20);index;not null"`
	PayoutMethod           string `json:"payout_method" gorm:"type:varchar(32);not null"`
	PayoutDetailsEncrypted string `json:"-" gorm:"type:text;not null"`
	RequestedAt            int64  `json:"requested_at" gorm:"index;not null"`
	ReviewedAt             int64  `json:"reviewed_at" gorm:"not null"`
	ReviewedBy             int    `json:"reviewed_by" gorm:"index;not null"`
	ReviewNote             string `json:"review_note" gorm:"type:varchar(500);not null"`
	PaidAt                 int64  `json:"paid_at" gorm:"not null"`
	PaymentReference       string `json:"payment_reference" gorm:"type:varchar(128);not null"`
	UpdatedAt              int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type SettlementPeriod struct {
	ID        int    `json:"id"`
	StartAt   int64  `json:"start_at" gorm:"uniqueIndex:idx_settlement_period;not null"`
	EndAt     int64  `json:"end_at" gorm:"uniqueIndex:idx_settlement_period;not null"`
	Status    string `json:"status" gorm:"type:varchar(20);index;not null"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
}

type AffiliateStatement struct {
	ID                     int    `json:"id"`
	PeriodID               int    `json:"period_id" gorm:"uniqueIndex:idx_affiliate_statement_user_period;not null"`
	UserID                 int    `json:"user_id" gorm:"uniqueIndex:idx_affiliate_statement_user_period;index;not null"`
	Currency               string `json:"currency" gorm:"type:varchar(8);not null"`
	StartAt                int64  `json:"start_at" gorm:"index;not null"`
	EndAt                  int64  `json:"end_at" gorm:"index;not null"`
	OpeningPendingMicros   int64  `json:"opening_pending_micros" gorm:"type:bigint;not null"`
	OpeningAvailableMicros int64  `json:"opening_available_micros" gorm:"type:bigint;not null"`
	OpeningFrozenMicros    int64  `json:"opening_frozen_micros" gorm:"type:bigint;not null"`
	OpeningWithdrawnMicros int64  `json:"opening_withdrawn_micros" gorm:"type:bigint;not null"`
	EarnedMicros           int64  `json:"earned_micros" gorm:"type:bigint;not null"`
	PaidMicros             int64  `json:"paid_micros" gorm:"type:bigint;not null"`
	ClosingPendingMicros   int64  `json:"closing_pending_micros" gorm:"type:bigint;not null"`
	ClosingAvailableMicros int64  `json:"closing_available_micros" gorm:"type:bigint;not null"`
	ClosingFrozenMicros    int64  `json:"closing_frozen_micros" gorm:"type:bigint;not null"`
	ClosingWithdrawnMicros int64  `json:"closing_withdrawn_micros" gorm:"type:bigint;not null"`
	GeneratedAt            int64  `json:"generated_at" gorm:"not null"`
}

type AffiliateStatementItem struct {
	ID           int    `json:"id"`
	StatementID  int    `json:"statement_id" gorm:"uniqueIndex:idx_statement_ledger;index;not null"`
	LedgerID     int    `json:"ledger_id" gorm:"uniqueIndex:idx_statement_ledger;not null"`
	EntryType    string `json:"entry_type" gorm:"type:varchar(40);not null"`
	ReferenceID  int    `json:"reference_id" gorm:"not null"`
	AmountMicros int64  `json:"amount_micros" gorm:"type:bigint;not null"`
	CreatedAt    int64  `json:"created_at" gorm:"not null"`
}

type AffiliateSummary struct {
	Enabled                 bool             `json:"enabled"`
	ReferralCode            string           `json:"referral_code"`
	Currency                string           `json:"currency"`
	RewardMicros            int64            `json:"reward_micros"`
	MinimumTopUpMicros      int64            `json:"minimum_topup_micros"`
	MinimumWithdrawalMicros int64            `json:"minimum_withdrawal_micros"`
	HoldSeconds             int64            `json:"hold_seconds"`
	ReferralCount           int64            `json:"referral_count"`
	QualifiedCount          int64            `json:"qualified_count"`
	PendingWithdrawalCount  int64            `json:"pending_withdrawal_count"`
	Account                 AffiliateAccount `json:"account"`
}

type AffiliateStatementDetail struct {
	Statement AffiliateStatement       `json:"statement"`
	Items     []AffiliateStatementItem `json:"items"`
}

func normalizedAffiliateSetting() operation_setting.AffiliateSetting {
	setting := *operation_setting.GetAffiliateSetting()
	setting.Currency = strings.ToUpper(strings.TrimSpace(setting.Currency))
	if setting.Currency == "" {
		setting.Currency = "USD"
	}
	if setting.RewardMicros < 0 {
		setting.RewardMicros = 0
	}
	if setting.MinimumTopUpMicros < 0 {
		setting.MinimumTopUpMicros = 0
	}
	if setting.HoldSeconds < 0 {
		setting.HoldSeconds = 0
	}
	if setting.MinimumWithdrawalMicros < 0 {
		setting.MinimumWithdrawalMicros = 0
	}
	return setting
}

func affiliateCampaignKey(setting operation_setting.AffiliateSetting) string {
	value := fmt.Sprintf("%t|%s|%d|%d|%d|%d", setting.Enabled, setting.Currency, setting.RewardMicros, setting.MinimumTopUpMicros, setting.HoldSeconds, setting.MinimumWithdrawalMicros)
	return fmt.Sprintf("%x", sha256.Sum256([]byte(value)))
}

func currentAffiliateCampaignWithTx(tx *gorm.DB) (*AffiliateCampaign, error) {
	setting := normalizedAffiliateSetting()
	configKey := affiliateCampaignKey(setting)
	var campaign AffiliateCampaign
	if err := tx.Where("config_key = ?", configKey).First(&campaign).Error; err == nil {
		return &campaign, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	status := AffiliateCampaignStatusDisabled
	if setting.Enabled {
		status = AffiliateCampaignStatusActive
	}
	campaign = AffiliateCampaign{
		Name:                    "To C referral cashback",
		ConfigKey:               configKey,
		Status:                  status,
		Currency:                setting.Currency,
		RewardMicros:            setting.RewardMicros,
		MinimumTopUpMicros:      setting.MinimumTopUpMicros,
		HoldSeconds:             setting.HoldSeconds,
		MinimumWithdrawalMicros: setting.MinimumWithdrawalMicros,
	}
	if err := tx.Create(&campaign).Error; err != nil {
		if lookupErr := tx.Where("config_key = ?", configKey).First(&campaign).Error; lookupErr == nil {
			return &campaign, nil
		}
		return nil, err
	}
	return &campaign, nil
}

func ensureAffiliateAccountWithTx(tx *gorm.DB, userID int, currency string) (*AffiliateAccount, error) {
	var account AffiliateAccount
	if err := tx.Where("user_id = ?", userID).First(&account).Error; err == nil {
		return &account, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	account = AffiliateAccount{UserID: userID, Currency: currency}
	if err := tx.Create(&account).Error; err != nil {
		if lookupErr := tx.Where("user_id = ?", userID).First(&account).Error; lookupErr == nil {
			return &account, nil
		}
		return nil, err
	}
	return &account, nil
}

func ensureAffiliateCodeWithTx(tx *gorm.DB, user *User, campaignID int) (*AffiliateCode, error) {
	var code AffiliateCode
	if err := tx.Where("owner_user_id = ?", user.Id).First(&code).Error; err == nil {
		return &code, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if user.AffCode == "" {
		user.AffCode = common.GetRandomString(8)
		if err := tx.Model(&User{}).Where("id = ?", user.Id).Update("aff_code", user.AffCode).Error; err != nil {
			return nil, err
		}
	}
	code = AffiliateCode{
		OwnerUserID: user.Id,
		CampaignID:  campaignID,
		Code:        user.AffCode,
		Status:      AffiliateCodeStatusActive,
	}
	if err := tx.Create(&code).Error; err != nil {
		if lookupErr := tx.Where("owner_user_id = ?", user.Id).First(&code).Error; lookupErr == nil {
			return &code, nil
		}
		return nil, err
	}
	return &code, nil
}

func bindAffiliateRelationWithTx(tx *gorm.DB, invitee *User, inviterID int, campaign *AffiliateCampaign, incrementCount bool) error {
	if inviterID <= 0 || inviterID == invitee.Id || campaign.Status != AffiliateCampaignStatusActive {
		return nil
	}
	var existing ReferralRelation
	if err := tx.Where("invitee_user_id = ?", invitee.Id).First(&existing).Error; err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	var inviter User
	if err := tx.Where("id = ?", inviterID).First(&inviter).Error; err != nil {
		return err
	}
	code, err := ensureAffiliateCodeWithTx(tx, &inviter, campaign.ID)
	if err != nil {
		return err
	}
	relation := ReferralRelation{
		InviteeUserID:      invitee.Id,
		InviterUserID:      inviterID,
		AffiliateCodeID:    code.ID,
		CampaignID:         campaign.ID,
		CodeSnapshot:       code.Code,
		Currency:           campaign.Currency,
		RewardMicros:       campaign.RewardMicros,
		MinimumTopUpMicros: campaign.MinimumTopUpMicros,
		HoldSeconds:        campaign.HoldSeconds,
		Status:             ReferralStatusBound,
		BoundAt:            common.GetTimestamp(),
	}
	if err := tx.Create(&relation).Error; err != nil {
		return err
	}
	if err := tx.Model(&AffiliateCode{}).Where("id = ?", code.ID).Update("usage_count", gorm.Expr("usage_count + 1")).Error; err != nil {
		return err
	}
	if incrementCount {
		return tx.Model(&User{}).Where("id = ?", inviterID).Update("aff_count", gorm.Expr("aff_count + 1")).Error
	}
	return nil
}

func initializeAffiliateUserWithTx(tx *gorm.DB, user *User, inviterID int, incrementCount bool) error {
	campaign, err := currentAffiliateCampaignWithTx(tx)
	if err != nil {
		return err
	}
	if _, err := ensureAffiliateAccountWithTx(tx, user.Id, campaign.Currency); err != nil {
		return err
	}
	if _, err := ensureAffiliateCodeWithTx(tx, user, campaign.ID); err != nil {
		return err
	}
	return bindAffiliateRelationWithTx(tx, user, inviterID, campaign, incrementCount)
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

func topUpPaidMicros(topUp *TopUp) (int64, error) {
	if topUp == nil || topUp.Money <= 0 {
		return 0, ErrAffiliateAmountInvalid
	}
	scaled := decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromInt(operation_setting.AffiliateMicrosPerUnit)).Truncate(0)
	amount, err := strconv.ParseInt(scaled.StringFixed(0), 10, 64)
	if err != nil || amount <= 0 {
		return 0, ErrAffiliateAmountInvalid
	}
	return amount, nil
}

func appendAffiliateLedgerWithTx(tx *gorm.DB, account *AffiliateAccount, entry AffiliateLedger) error {
	entry.UserID = account.UserID
	entry.AccountID = account.ID
	entry.Currency = account.Currency
	entry.PendingBalanceMicros = account.PendingMicros
	entry.AvailableBalanceMicros = account.AvailableMicros
	entry.FrozenBalanceMicros = account.FrozenMicros
	entry.WithdrawnBalanceMicros = account.WithdrawnMicros
	return tx.Create(&entry).Error
}

func qualifyAffiliateTopUpWithTx(tx *gorm.DB, topUp *TopUp) error {
	setting := normalizedAffiliateSetting()
	if !setting.Enabled || !operation_setting.IsPaymentComplianceConfirmed() || topUp == nil {
		return nil
	}
	var invitee User
	if err := tx.Where("id = ?", topUp.UserId).First(&invitee).Error; err != nil {
		return err
	}
	if err := initializeAffiliateUserWithTx(tx, &invitee, invitee.InviterId, false); err != nil {
		return err
	}
	var relation ReferralRelation
	err := lockForUpdate(tx).Where("invitee_user_id = ?", topUp.UserId).First(&relation).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if relation.Status != ReferralStatusBound || relation.RewardMicros <= 0 {
		return nil
	}
	paidMicros, err := topUpPaidMicros(topUp)
	if err != nil || paidMicros < relation.MinimumTopUpMicros {
		return nil
	}
	now := common.GetTimestamp()
	availableAt := now + relation.HoldSeconds
	status := AffiliateCommissionStatusPending
	if relation.HoldSeconds == 0 {
		status = AffiliateCommissionStatusAvailable
	}
	commission := AffiliateCommission{
		InviterUserID:      relation.InviterUserID,
		InviteeUserID:      relation.InviteeUserID,
		ReferralRelationID: relation.ID,
		TopUpID:            topUp.Id,
		CampaignID:         relation.CampaignID,
		Currency:           relation.Currency,
		AmountMicros:       relation.RewardMicros,
		Status:             status,
		AvailableAt:        availableAt,
		IdempotencyKey:     fmt.Sprintf("topup:%d", topUp.Id),
	}
	if err := tx.Create(&commission).Error; err != nil {
		var existing AffiliateCommission
		if lookupErr := tx.Where("top_up_id = ?", topUp.Id).First(&existing).Error; lookupErr == nil {
			return nil
		}
		return err
	}
	account, err := ensureAffiliateAccountWithTx(tx, relation.InviterUserID, relation.Currency)
	if err != nil {
		return err
	}
	if err := lockForUpdate(tx).Where("id = ?", account.ID).First(account).Error; err != nil {
		return err
	}
	ledgerType := AffiliateLedgerTypeCommissionPending
	entry := AffiliateLedger{
		EntryType:      ledgerType,
		ReferenceType:  AffiliateReferenceCommission,
		ReferenceID:    commission.ID,
		AmountMicros:   commission.AmountMicros,
		IdempotencyKey: "commission:create:" + strconv.Itoa(commission.ID),
	}
	if status == AffiliateCommissionStatusPending {
		account.PendingMicros += commission.AmountMicros
		entry.PendingDeltaMicros = commission.AmountMicros
	} else {
		account.AvailableMicros += commission.AmountMicros
		entry.EntryType = AffiliateLedgerTypeCommissionAvailable
		entry.AvailableDeltaMicros = commission.AmountMicros
	}
	account.LifetimeEarnedMicros += commission.AmountMicros
	if err := tx.Save(account).Error; err != nil {
		return err
	}
	if err := appendAffiliateLedgerWithTx(tx, account, entry); err != nil {
		return err
	}
	relation.Status = ReferralStatusQualified
	relation.QualifiedAt = now
	relation.QualifyingTopUpID = &topUp.Id
	return tx.Save(&relation).Error
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

func ReleaseDueAffiliateCommissions(now int64, limit int) (int, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	var ids []int
	if err := DB.Model(&AffiliateCommission{}).
		Where("status = ? AND available_at <= ?", AffiliateCommissionStatusPending, now).
		Order("id asc").Limit(limit).Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	released := 0
	for _, id := range ids {
		err := DB.Transaction(func(tx *gorm.DB) error {
			var commission AffiliateCommission
			if err := lockForUpdate(tx).Where("id = ?", id).First(&commission).Error; err != nil {
				return err
			}
			if commission.Status != AffiliateCommissionStatusPending || commission.AvailableAt > now {
				return nil
			}
			var account AffiliateAccount
			if err := lockForUpdate(tx).Where("user_id = ?", commission.InviterUserID).First(&account).Error; err != nil {
				return err
			}
			if account.PendingMicros < commission.AmountMicros {
				return ErrAffiliateBalance
			}
			account.PendingMicros -= commission.AmountMicros
			account.AvailableMicros += commission.AmountMicros
			if err := tx.Save(&account).Error; err != nil {
				return err
			}
			commission.Status = AffiliateCommissionStatusAvailable
			if err := tx.Save(&commission).Error; err != nil {
				return err
			}
			return appendAffiliateLedgerWithTx(tx, &account, AffiliateLedger{
				EntryType:            AffiliateLedgerTypeCommissionAvailable,
				ReferenceType:        AffiliateReferenceCommission,
				ReferenceID:          commission.ID,
				AmountMicros:         commission.AmountMicros,
				PendingDeltaMicros:   -commission.AmountMicros,
				AvailableDeltaMicros: commission.AmountMicros,
				IdempotencyKey:       "commission:release:" + strconv.Itoa(commission.ID),
			})
		})
		if err != nil {
			return released, err
		}
		released++
	}
	return released, nil
}

func CreateAffiliateWithdrawal(userID int, amountMicros int64, payoutMethod string, encryptedDetails string, requestKey string) (*WithdrawalRequest, error) {
	setting := normalizedAffiliateSetting()
	if !setting.Enabled {
		return nil, ErrAffiliateDisabled
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return nil, ErrAffiliateCompliance
	}
	payoutMethod = strings.TrimSpace(payoutMethod)
	requestKey = strings.TrimSpace(requestKey)
	if amountMicros <= 0 || amountMicros < setting.MinimumWithdrawalMicros || payoutMethod == "" || len(payoutMethod) > 32 || encryptedDetails == "" || requestKey == "" || len(requestKey) > 64 {
		return nil, ErrAffiliateAmountInvalid
	}
	var withdrawal WithdrawalRequest
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND request_key = ?", userID, requestKey).First(&withdrawal).Error; err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var account AffiliateAccount
		if err := lockForUpdate(tx).Where("user_id = ?", userID).First(&account).Error; err != nil {
			return err
		}
		if account.AvailableMicros < amountMicros {
			return ErrAffiliateBalance
		}
		withdrawal = WithdrawalRequest{
			UserID:                 userID,
			RequestKey:             requestKey,
			Currency:               account.Currency,
			AmountMicros:           amountMicros,
			Status:                 WithdrawalStatusPending,
			PayoutMethod:           payoutMethod,
			PayoutDetailsEncrypted: encryptedDetails,
			RequestedAt:            common.GetTimestamp(),
		}
		if err := tx.Create(&withdrawal).Error; err != nil {
			return err
		}
		account.AvailableMicros -= amountMicros
		account.FrozenMicros += amountMicros
		if err := tx.Save(&account).Error; err != nil {
			return err
		}
		return appendAffiliateLedgerWithTx(tx, &account, AffiliateLedger{
			EntryType:            AffiliateLedgerTypeWithdrawalApplied,
			ReferenceType:        AffiliateReferenceWithdrawal,
			ReferenceID:          withdrawal.ID,
			AmountMicros:         amountMicros,
			AvailableDeltaMicros: -amountMicros,
			FrozenDeltaMicros:    amountMicros,
			IdempotencyKey:       "withdrawal:apply:" + strconv.Itoa(withdrawal.ID),
		})
	})
	return &withdrawal, err
}

func transitionAffiliateWithdrawal(withdrawalID int, userID int, adminID int, targetStatus string, note string, paymentReference string) (*WithdrawalRequest, error) {
	var withdrawal WithdrawalRequest
	err := DB.Transaction(func(tx *gorm.DB) error {
		query := lockForUpdate(tx).Where("id = ?", withdrawalID)
		if userID > 0 {
			query = query.Where("user_id = ?", userID)
		}
		if err := query.First(&withdrawal).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrWithdrawalNotFound
			}
			return err
		}
		if withdrawal.Status == targetStatus {
			return nil
		}
		now := common.GetTimestamp()
		switch targetStatus {
		case WithdrawalStatusApproved:
			if withdrawal.Status != WithdrawalStatusPending || adminID <= 0 {
				return ErrWithdrawalStatusInvalid
			}
			withdrawal.Status = targetStatus
			withdrawal.ReviewedAt = now
			withdrawal.ReviewedBy = adminID
			withdrawal.ReviewNote = strings.TrimSpace(note)
			return tx.Save(&withdrawal).Error
		case WithdrawalStatusRejected, WithdrawalStatusCancelled, WithdrawalStatusPaid:
			valid := targetStatus == WithdrawalStatusRejected && adminID > 0 && (withdrawal.Status == WithdrawalStatusPending || withdrawal.Status == WithdrawalStatusApproved)
			valid = valid || targetStatus == WithdrawalStatusCancelled && userID > 0 && withdrawal.Status == WithdrawalStatusPending
			valid = valid || targetStatus == WithdrawalStatusPaid && adminID > 0 && withdrawal.Status == WithdrawalStatusApproved
			if !valid {
				return ErrWithdrawalStatusInvalid
			}
			var account AffiliateAccount
			if err := lockForUpdate(tx).Where("user_id = ?", withdrawal.UserID).First(&account).Error; err != nil {
				return err
			}
			if account.FrozenMicros < withdrawal.AmountMicros {
				return ErrAffiliateBalance
			}
			entry := AffiliateLedger{
				ReferenceType:     AffiliateReferenceWithdrawal,
				ReferenceID:       withdrawal.ID,
				AmountMicros:      withdrawal.AmountMicros,
				FrozenDeltaMicros: -withdrawal.AmountMicros,
			}
			account.FrozenMicros -= withdrawal.AmountMicros
			if targetStatus == WithdrawalStatusPaid {
				account.WithdrawnMicros += withdrawal.AmountMicros
				entry.EntryType = AffiliateLedgerTypeWithdrawalPaid
				entry.WithdrawnDeltaMicros = withdrawal.AmountMicros
				entry.IdempotencyKey = "withdrawal:paid:" + strconv.Itoa(withdrawal.ID)
				withdrawal.PaidAt = now
				withdrawal.PaymentReference = strings.TrimSpace(paymentReference)
			} else {
				account.AvailableMicros += withdrawal.AmountMicros
				entry.AvailableDeltaMicros = withdrawal.AmountMicros
				if targetStatus == WithdrawalStatusRejected {
					entry.EntryType = AffiliateLedgerTypeWithdrawalRejected
					entry.IdempotencyKey = "withdrawal:reject:" + strconv.Itoa(withdrawal.ID)
				} else {
					entry.EntryType = AffiliateLedgerTypeWithdrawalCancelled
					entry.IdempotencyKey = "withdrawal:cancel:" + strconv.Itoa(withdrawal.ID)
				}
			}
			if err := tx.Save(&account).Error; err != nil {
				return err
			}
			withdrawal.Status = targetStatus
			if adminID > 0 {
				withdrawal.ReviewedAt = now
				withdrawal.ReviewedBy = adminID
				if strings.TrimSpace(note) != "" {
					withdrawal.ReviewNote = strings.TrimSpace(note)
				}
			}
			if err := tx.Save(&withdrawal).Error; err != nil {
				return err
			}
			return appendAffiliateLedgerWithTx(tx, &account, entry)
		default:
			return ErrWithdrawalStatusInvalid
		}
	})
	return &withdrawal, err
}

func CancelAffiliateWithdrawal(withdrawalID int, userID int) (*WithdrawalRequest, error) {
	return transitionAffiliateWithdrawal(withdrawalID, userID, 0, WithdrawalStatusCancelled, "", "")
}

func ApproveAffiliateWithdrawal(withdrawalID int, adminID int, note string) (*WithdrawalRequest, error) {
	return transitionAffiliateWithdrawal(withdrawalID, 0, adminID, WithdrawalStatusApproved, note, "")
}

func RejectAffiliateWithdrawal(withdrawalID int, adminID int, note string) (*WithdrawalRequest, error) {
	return transitionAffiliateWithdrawal(withdrawalID, 0, adminID, WithdrawalStatusRejected, note, "")
}

func MarkAffiliateWithdrawalPaid(withdrawalID int, adminID int, paymentReference string) (*WithdrawalRequest, error) {
	if strings.TrimSpace(paymentReference) == "" || len(strings.TrimSpace(paymentReference)) > 128 {
		return nil, ErrAffiliateAmountInvalid
	}
	return transitionAffiliateWithdrawal(withdrawalID, 0, adminID, WithdrawalStatusPaid, "", paymentReference)
}

func GetAffiliateSummary(userID int) (*AffiliateSummary, error) {
	if err := EnsureAffiliateProfile(userID); err != nil {
		return nil, err
	}
	setting := normalizedAffiliateSetting()
	var user User
	if err := DB.Select("aff_code").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	var account AffiliateAccount
	if err := DB.Where("user_id = ?", userID).First(&account).Error; err != nil {
		return nil, err
	}
	var referralCount int64
	var qualifiedCount int64
	var pendingWithdrawalCount int64
	if err := DB.Model(&ReferralRelation{}).Where("inviter_user_id = ?", userID).Count(&referralCount).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ReferralRelation{}).Where("inviter_user_id = ? AND status = ?", userID, ReferralStatusQualified).Count(&qualifiedCount).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&WithdrawalRequest{}).Where("user_id = ? AND status IN ?", userID, []string{WithdrawalStatusPending, WithdrawalStatusApproved}).Count(&pendingWithdrawalCount).Error; err != nil {
		return nil, err
	}
	return &AffiliateSummary{
		Enabled:                 setting.Enabled && operation_setting.IsPaymentComplianceConfirmed(),
		ReferralCode:            user.AffCode,
		Currency:                setting.Currency,
		RewardMicros:            setting.RewardMicros,
		MinimumTopUpMicros:      setting.MinimumTopUpMicros,
		MinimumWithdrawalMicros: setting.MinimumWithdrawalMicros,
		HoldSeconds:             setting.HoldSeconds,
		ReferralCount:           referralCount,
		QualifiedCount:          qualifiedCount,
		PendingWithdrawalCount:  pendingWithdrawalCount,
		Account:                 account,
	}, nil
}

func GetUserReferralRelations(userID int, startIdx int, limit int) ([]ReferralRelation, int64, error) {
	var items []ReferralRelation
	var total int64
	query := DB.Model(&ReferralRelation{}).Where("inviter_user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("id desc").Offset(startIdx).Limit(limit).Find(&items).Error
	return items, total, err
}

func GetUserAffiliateCommissions(userID int, startIdx int, limit int) ([]AffiliateCommission, int64, error) {
	var items []AffiliateCommission
	var total int64
	query := DB.Model(&AffiliateCommission{}).Where("inviter_user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("id desc").Offset(startIdx).Limit(limit).Find(&items).Error
	return items, total, err
}

func GetAffiliateWithdrawals(userID int, status string, startIdx int, limit int) ([]WithdrawalRequest, int64, error) {
	var items []WithdrawalRequest
	var total int64
	query := DB.Model(&WithdrawalRequest{})
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("id desc").Offset(startIdx).Limit(limit).Find(&items).Error
	return items, total, err
}

func GenerateAffiliateStatements(startAt int64, endAt int64) (int, error) {
	if startAt <= 0 || endAt <= startAt {
		return 0, ErrAffiliateAmountInvalid
	}
	period := SettlementPeriod{StartAt: startAt, EndAt: endAt, Status: "generated"}
	if err := DB.Where("start_at = ? AND end_at = ?", startAt, endAt).FirstOrCreate(&period).Error; err != nil {
		return 0, err
	}
	var userIDs []int
	if err := DB.Model(&AffiliateLedger{}).Distinct("user_id").Where("created_at >= ? AND created_at < ?", startAt, endAt).Pluck("user_id", &userIDs).Error; err != nil {
		return 0, err
	}
	generated := 0
	for _, userID := range userIDs {
		err := DB.Transaction(func(tx *gorm.DB) error {
			var existing AffiliateStatement
			if err := tx.Where("period_id = ? AND user_id = ?", period.ID, userID).First(&existing).Error; err == nil {
				return nil
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			var ledgers []AffiliateLedger
			if err := tx.Where("user_id = ? AND created_at >= ? AND created_at < ?", userID, startAt, endAt).Order("id asc").Find(&ledgers).Error; err != nil {
				return err
			}
			if len(ledgers) == 0 {
				return nil
			}
			first := ledgers[0]
			last := ledgers[len(ledgers)-1]
			statement := AffiliateStatement{
				PeriodID:               period.ID,
				UserID:                 userID,
				Currency:               first.Currency,
				StartAt:                startAt,
				EndAt:                  endAt,
				OpeningPendingMicros:   first.PendingBalanceMicros - first.PendingDeltaMicros,
				OpeningAvailableMicros: first.AvailableBalanceMicros - first.AvailableDeltaMicros,
				OpeningFrozenMicros:    first.FrozenBalanceMicros - first.FrozenDeltaMicros,
				OpeningWithdrawnMicros: first.WithdrawnBalanceMicros - first.WithdrawnDeltaMicros,
				ClosingPendingMicros:   last.PendingBalanceMicros,
				ClosingAvailableMicros: last.AvailableBalanceMicros,
				ClosingFrozenMicros:    last.FrozenBalanceMicros,
				ClosingWithdrawnMicros: last.WithdrawnBalanceMicros,
				GeneratedAt:            common.GetTimestamp(),
			}
			for _, ledger := range ledgers {
				if ledger.EntryType == AffiliateLedgerTypeCommissionPending || (ledger.EntryType == AffiliateLedgerTypeCommissionAvailable && ledger.PendingDeltaMicros == 0) {
					statement.EarnedMicros += ledger.PendingDeltaMicros + ledger.AvailableDeltaMicros
				}
				if ledger.EntryType == AffiliateLedgerTypeWithdrawalPaid {
					statement.PaidMicros += ledger.WithdrawnDeltaMicros
				}
			}
			if err := tx.Create(&statement).Error; err != nil {
				return err
			}
			items := make([]AffiliateStatementItem, 0, len(ledgers))
			for _, ledger := range ledgers {
				items = append(items, AffiliateStatementItem{
					StatementID:  statement.ID,
					LedgerID:     ledger.ID,
					EntryType:    ledger.EntryType,
					ReferenceID:  ledger.ReferenceID,
					AmountMicros: ledger.AmountMicros,
					CreatedAt:    ledger.CreatedAt,
				})
			}
			if err := tx.Create(&items).Error; err != nil {
				return err
			}
			generated++
			return nil
		})
		if err != nil {
			return generated, err
		}
	}
	return generated, nil
}

func GeneratePreviousMonthAffiliateStatements(now time.Time) (int, error) {
	currentMonth := time.Date(now.UTC().Year(), now.UTC().Month(), 1, 0, 0, 0, 0, time.UTC)
	previousMonth := currentMonth.AddDate(0, -1, 0)
	return GenerateAffiliateStatements(previousMonth.Unix(), currentMonth.Unix())
}

func GetUserAffiliateStatements(userID int, startIdx int, limit int) ([]AffiliateStatement, int64, error) {
	var items []AffiliateStatement
	var total int64
	query := DB.Model(&AffiliateStatement{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("start_at desc").Offset(startIdx).Limit(limit).Find(&items).Error
	return items, total, err
}

func GetUserAffiliateStatementDetail(userID int, statementID int) (*AffiliateStatementDetail, error) {
	var statement AffiliateStatement
	if err := DB.Where("id = ? AND user_id = ?", statementID, userID).First(&statement).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAffiliateStatementMissing
		}
		return nil, err
	}
	var items []AffiliateStatementItem
	if err := DB.Where("statement_id = ?", statement.ID).Order("id asc").Find(&items).Error; err != nil {
		return nil, err
	}
	return &AffiliateStatementDetail{Statement: statement, Items: items}, nil
}
