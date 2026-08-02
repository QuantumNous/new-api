package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	affiliateCampaignCode = "referral-cashback"

	AffiliateCashLedgerTypeRewardPending   = "reward_pending"
	AffiliateCashLedgerTypeRewardAvailable = "reward_available"
	AffiliateCashLedgerTypeBalanceTransfer = "balance_transfer"

	AffiliateCashReferenceReward   = "cash_reward"
	AffiliateCashReferenceTransfer = "cash_transfer"
)

type AffiliateCampaign struct {
	ID                     int    `json:"id"`
	Code                   string `json:"code" gorm:"type:varchar(64);uniqueIndex;not null"`
	Name                   string `json:"name" gorm:"type:varchar(120);not null"`
	Enabled                bool   `json:"enabled" gorm:"not null"`
	StartsAt               int64  `json:"starts_at" gorm:"index;not null"`
	EndsAt                 int64  `json:"ends_at" gorm:"index;not null"`
	InviterCashbackRateBps int64  `json:"inviter_cashback_rate_bps" gorm:"type:bigint;not null"`
	InviteeBonusRateBps    int64  `json:"invitee_bonus_rate_bps" gorm:"type:bigint;not null"`
	HoldSeconds            int64  `json:"hold_seconds" gorm:"type:bigint;not null"`
	CreatedAt              int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt              int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (AffiliateCampaign) TableName() string {
	return "affiliate_promotion_campaigns"
}

type AffiliateCashReward struct {
	ID               int    `json:"id"`
	CampaignID       int    `json:"campaign_id" gorm:"index;not null"`
	ReferralID       int    `json:"referral_id" gorm:"index;not null"`
	TopUpID          int    `json:"topup_id" gorm:"uniqueIndex;not null"`
	InviterUserID    int    `json:"inviter_user_id" gorm:"index;not null"`
	InviteeUserID    int    `json:"invitee_user_id" gorm:"index;not null"`
	PaidCents        int64  `json:"paid_cents" gorm:"type:bigint;not null"`
	RewardRateBps    int64  `json:"reward_rate_bps" gorm:"type:bigint;not null"`
	CashbackCents    int64  `json:"cashback_cents" gorm:"type:bigint;not null"`
	TransferredCents int64  `json:"transferred_cents" gorm:"type:bigint;not null"`
	Status           string `json:"status" gorm:"type:varchar(20);index;not null"`
	AvailableAt      int64  `json:"available_at" gorm:"index;not null"`
	IdempotencyKey   string `json:"-" gorm:"type:varchar(128);uniqueIndex;not null"`
	CreatedAt        int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type AffiliateCashAccount struct {
	ID                  int   `json:"id"`
	UserID              int   `json:"user_id" gorm:"uniqueIndex;not null"`
	PendingCents        int64 `json:"pending_cents" gorm:"type:bigint;not null"`
	AvailableCents      int64 `json:"available_cents" gorm:"type:bigint;not null"`
	TransferredCents    int64 `json:"transferred_cents" gorm:"type:bigint;not null"`
	LifetimeEarnedCents int64 `json:"lifetime_earned_cents" gorm:"type:bigint;not null"`
	CreatedAt           int64 `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt           int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

type AffiliateCashLedger struct {
	ID                      int    `json:"id"`
	UserID                  int    `json:"user_id" gorm:"index;not null"`
	AccountID               int    `json:"account_id" gorm:"index;not null"`
	EntryType               string `json:"entry_type" gorm:"type:varchar(40);index;not null"`
	ReferenceType           string `json:"reference_type" gorm:"type:varchar(32);index;not null"`
	ReferenceID             int    `json:"reference_id" gorm:"index;not null"`
	AmountCents             int64  `json:"amount_cents" gorm:"type:bigint;not null"`
	PendingDeltaCents       int64  `json:"pending_delta_cents" gorm:"type:bigint;not null"`
	AvailableDeltaCents     int64  `json:"available_delta_cents" gorm:"type:bigint;not null"`
	TransferredDeltaCents   int64  `json:"transferred_delta_cents" gorm:"type:bigint;not null"`
	PendingBalanceCents     int64  `json:"pending_balance_cents" gorm:"type:bigint;not null"`
	AvailableBalanceCents   int64  `json:"available_balance_cents" gorm:"type:bigint;not null"`
	TransferredBalanceCents int64  `json:"transferred_balance_cents" gorm:"type:bigint;not null"`
	IdempotencyKey          string `json:"-" gorm:"type:varchar(128);uniqueIndex;not null"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

type AffiliateCashTransfer struct {
	ID                int     `json:"id"`
	UserID            int     `json:"user_id" gorm:"uniqueIndex:idx_affiliate_cash_transfer_request;index;not null"`
	RequestKey        string  `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_affiliate_cash_transfer_request;not null"`
	AmountCents       int64   `json:"amount_cents" gorm:"type:bigint;not null"`
	CashBalanceBefore int64   `json:"cash_balance_before" gorm:"type:bigint;not null"`
	CashBalanceAfter  int64   `json:"cash_balance_after" gorm:"type:bigint;not null"`
	CNYExchangeRate   float64 `json:"cny_exchange_rate" gorm:"not null"`
	CreditedQuota     int64   `json:"credited_quota" gorm:"type:bigint;not null"`
	UserQuotaBefore   int     `json:"user_quota_before" gorm:"type:int;not null"`
	UserQuotaAfter    int     `json:"user_quota_after" gorm:"type:int;not null"`
	CreatedAt         int64   `json:"created_at" gorm:"autoCreateTime;index"`
}

type AffiliateQuotaGrant struct {
	ID             int    `json:"id"`
	CampaignID     int    `json:"campaign_id" gorm:"index;not null"`
	TopUpID        int    `json:"topup_id" gorm:"uniqueIndex;not null"`
	UserID         int    `json:"user_id" gorm:"index;not null"`
	BaseQuota      int64  `json:"base_quota" gorm:"type:bigint;not null"`
	BonusRateBps   int64  `json:"bonus_rate_bps" gorm:"type:bigint;not null"`
	BonusQuota     int64  `json:"bonus_quota" gorm:"type:bigint;not null"`
	Status         string `json:"status" gorm:"type:varchar(20);index;not null"`
	IdempotencyKey string `json:"-" gorm:"type:varchar(128);uniqueIndex;not null"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime"`
}

func defaultAffiliateCampaign() AffiliateCampaign {
	return AffiliateCampaign{
		Code: affiliateCampaignCode, Name: "Referral rewards campaign",
		InviterCashbackRateBps: 2500, InviteeBonusRateBps: 2000,
		HoldSeconds: 7 * 24 * 60 * 60,
	}
}

func validateAffiliateCampaign(campaign AffiliateCampaign) error {
	if strings.TrimSpace(campaign.Name) == "" || len(campaign.Name) > 120 ||
		campaign.InviterCashbackRateBps != 2500 || campaign.InviteeBonusRateBps != 2000 ||
		campaign.HoldSeconds < 0 || campaign.HoldSeconds > 365*24*60*60 {
		return ErrAffiliateRuleInvalid
	}
	if campaign.Enabled && (campaign.StartsAt <= 0 || campaign.EndsAt <= campaign.StartsAt) {
		return ErrAffiliateRuleInvalid
	}
	return nil
}

func getAffiliateCampaignWithTx(tx *gorm.DB) (*AffiliateCampaign, error) {
	var campaign AffiliateCampaign
	if err := tx.Where("code = ?", affiliateCampaignCode).First(&campaign).Error; err == nil {
		return &campaign, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	campaign = defaultAffiliateCampaign()
	result := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "code"}}, DoNothing: true,
	}).Create(&campaign)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		if err := tx.Where("code = ?", affiliateCampaignCode).First(&campaign).Error; err != nil {
			return nil, err
		}
	}
	return &campaign, nil
}

func GetAffiliateCampaign() (*AffiliateCampaign, error) {
	return getAffiliateCampaignWithTx(DB)
}

func UpdateAffiliateCampaign(next AffiliateCampaign) (*AffiliateCampaign, error) {
	next.Code = affiliateCampaignCode
	next.Name = strings.TrimSpace(next.Name)
	if err := validateAffiliateCampaign(next); err != nil {
		return nil, err
	}
	var campaign *AffiliateCampaign
	err := DB.Transaction(func(tx *gorm.DB) error {
		current, err := getAffiliateCampaignWithTx(tx)
		if err != nil {
			return err
		}
		current.Name = next.Name
		current.Enabled = next.Enabled
		current.StartsAt = next.StartsAt
		current.EndsAt = next.EndsAt
		current.InviterCashbackRateBps = next.InviterCashbackRateBps
		current.InviteeBonusRateBps = next.InviteeBonusRateBps
		current.HoldSeconds = next.HoldSeconds
		if err := tx.Save(current).Error; err != nil {
			return err
		}
		campaign = current
		return nil
	})
	return campaign, err
}

func activeAffiliateCampaignWithTx(tx *gorm.DB, completedAt int64) (*AffiliateCampaign, error) {
	campaign, err := getAffiliateCampaignWithTx(tx)
	if err != nil {
		return nil, err
	}
	if !campaign.Enabled || completedAt < campaign.StartsAt || completedAt >= campaign.EndsAt {
		return nil, nil
	}
	return campaign, nil
}

func ensureAffiliateCashAccountWithTx(tx *gorm.DB, userID int) (*AffiliateCashAccount, error) {
	var account AffiliateCashAccount
	if err := lockForUpdate(tx).Where("user_id = ?", userID).First(&account).Error; err == nil {
		return &account, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	account.UserID = userID
	result := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}}, DoNothing: true,
	}).Create(&account)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		if err := lockForUpdate(tx).Where("user_id = ?", userID).First(&account).Error; err != nil {
			return nil, err
		}
	}
	return &account, nil
}

func appendAffiliateCashLedgerWithTx(tx *gorm.DB, account *AffiliateCashAccount, entry AffiliateCashLedger) error {
	entry.UserID = account.UserID
	entry.AccountID = account.ID
	entry.PendingBalanceCents = account.PendingCents
	entry.AvailableBalanceCents = account.AvailableCents
	entry.TransferredBalanceCents = account.TransferredCents
	return tx.Create(&entry).Error
}

func topUpCreditedQuota(topUp *TopUp) (int64, error) {
	if topUp == nil {
		return 0, ErrAffiliateAmountInvalid
	}
	if topUp.CreditedQuota > 0 {
		return topUp.CreditedQuota, nil
	}
	quotaValue := decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	switch topUp.PaymentProvider {
	case PaymentProviderStripe:
		quotaValue = decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	case PaymentProviderCreem:
		quotaValue = decimal.NewFromInt(topUp.Amount)
	}
	quota, clamp := common.QuotaFromDecimalChecked(quotaValue)
	if clamp != nil {
		return 0, clamp
	}
	return int64(quota), nil
}

func settleAffiliateCampaignTopUpWithTx(tx *gorm.DB, campaign *AffiliateCampaign, topUp *TopUp, relation *AffiliateReferral, event *AffiliateTopUpEvent, paidCents int64) error {
	baseQuota, err := topUpCreditedQuota(topUp)
	if err != nil {
		return err
	}
	if paidCents <= 0 || baseQuota <= 0 {
		return ErrAffiliateAmountInvalid
	}
	rewardCents := decimal.NewFromInt(paidCents).
		Mul(decimal.NewFromInt(campaign.InviterCashbackRateBps)).
		Div(decimal.NewFromInt(10_000)).IntPart()
	bonusQuota, clamp := common.QuotaFromDecimalChecked(decimal.NewFromInt(baseQuota).
		Mul(decimal.NewFromInt(campaign.InviteeBonusRateBps)).
		Div(decimal.NewFromInt(10_000)))
	if clamp != nil {
		return clamp
	}
	if rewardCents <= 0 || bonusQuota <= 0 {
		return ErrAffiliateAmountInvalid
	}

	account, err := ensureAffiliateCashAccountWithTx(tx, relation.InviterUserID)
	if err != nil {
		return err
	}
	availableAt := event.CompletedAt + campaign.HoldSeconds
	status := AffiliateRewardStatusPending
	if campaign.HoldSeconds == 0 {
		status = AffiliateRewardStatusAvailable
	}
	reward := AffiliateCashReward{
		CampaignID: campaign.ID, ReferralID: relation.ID, TopUpID: topUp.Id,
		InviterUserID: relation.InviterUserID, InviteeUserID: relation.InviteeUserID,
		PaidCents: paidCents, RewardRateBps: campaign.InviterCashbackRateBps,
		CashbackCents: rewardCents, Status: status, AvailableAt: availableAt,
		IdempotencyKey: "campaign-cash:" + strconv.Itoa(campaign.ID) + ":" + strconv.Itoa(topUp.Id),
	}
	if err := tx.Create(&reward).Error; err != nil {
		return err
	}
	if status == AffiliateRewardStatusPending {
		account.PendingCents += rewardCents
	} else {
		account.AvailableCents += rewardCents
	}
	account.LifetimeEarnedCents += rewardCents
	if err := tx.Save(account).Error; err != nil {
		return err
	}
	ledger := AffiliateCashLedger{
		EntryType: AffiliateCashLedgerTypeRewardPending, ReferenceType: AffiliateCashReferenceReward,
		ReferenceID: reward.ID, AmountCents: rewardCents,
		IdempotencyKey: "campaign-cash-ledger:" + strconv.Itoa(reward.ID),
	}
	if status == AffiliateRewardStatusPending {
		ledger.PendingDeltaCents = rewardCents
	} else {
		ledger.EntryType = AffiliateCashLedgerTypeRewardAvailable
		ledger.AvailableDeltaCents = rewardCents
	}
	if err := appendAffiliateCashLedgerWithTx(tx, account, ledger); err != nil {
		return err
	}

	var invitee User
	if err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", relation.InviteeUserID).First(&invitee).Error; err != nil {
		return err
	}
	quotaAfter := int64(invitee.Quota) + int64(bonusQuota)
	if quotaAfter > int64(common.MaxQuota) {
		return ErrAffiliateAmountInvalid
	}
	grant := AffiliateQuotaGrant{
		CampaignID: campaign.ID, TopUpID: topUp.Id, UserID: relation.InviteeUserID,
		BaseQuota: baseQuota, BonusRateBps: campaign.InviteeBonusRateBps,
		BonusQuota: int64(bonusQuota), Status: AffiliateRewardStatusCredited,
		IdempotencyKey: "campaign-bonus:" + strconv.Itoa(campaign.ID) + ":" + strconv.Itoa(topUp.Id),
	}
	if err := tx.Create(&grant).Error; err != nil {
		return err
	}
	if err := tx.Model(&User{}).Where("id = ?", relation.InviteeUserID).Update("quota", int(quotaAfter)).Error; err != nil {
		return err
	}

	relation.CumulativePaidCents += paidCents
	if relation.Status != AffiliateReferralStatusQualified {
		relation.Status = AffiliateReferralStatusQualified
		relation.QualifiedAt = event.CompletedAt
		relation.QualifyingTopUpID = &topUp.Id
	}
	event.CumulativePaidCents = relation.CumulativePaidCents
	event.Qualified = true
	event.CashRewardID = &reward.ID
	event.QuotaGrantID = &grant.ID
	if err := tx.Save(relation).Error; err != nil {
		return err
	}
	return tx.Save(event).Error
}

func releaseAffiliateCashRewardWithTx(tx *gorm.DB, rewardID int, now int64) (bool, error) {
	var identity AffiliateCashReward
	if err := tx.Select("inviter_user_id").Where("id = ?", rewardID).First(&identity).Error; err != nil {
		return false, err
	}
	var user User
	if err := lockForUpdate(tx).Select("id").Where("id = ?", identity.InviterUserID).First(&user).Error; err != nil {
		return false, err
	}
	var reward AffiliateCashReward
	if err := lockForUpdate(tx).Where("id = ?", rewardID).First(&reward).Error; err != nil {
		return false, err
	}
	if reward.Status != AffiliateRewardStatusPending || reward.AvailableAt > now {
		return false, nil
	}
	account, err := ensureAffiliateCashAccountWithTx(tx, reward.InviterUserID)
	if err != nil {
		return false, err
	}
	remaining := reward.CashbackCents - reward.TransferredCents
	if remaining <= 0 || account.PendingCents < remaining {
		return false, ErrAffiliateBalance
	}
	account.PendingCents -= remaining
	account.AvailableCents += remaining
	reward.Status = AffiliateRewardStatusAvailable
	if err := tx.Save(account).Error; err != nil {
		return false, err
	}
	if err := tx.Save(&reward).Error; err != nil {
		return false, err
	}
	if err := appendAffiliateCashLedgerWithTx(tx, account, AffiliateCashLedger{
		EntryType: AffiliateCashLedgerTypeRewardAvailable, ReferenceType: AffiliateCashReferenceReward,
		ReferenceID: reward.ID, AmountCents: remaining, PendingDeltaCents: -remaining,
		AvailableDeltaCents: remaining, IdempotencyKey: "campaign-cash-release:" + strconv.Itoa(reward.ID),
	}); err != nil {
		return false, err
	}
	return true, nil
}

func ReleaseDueAffiliateCashRewards(now int64, limit int) (int, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	var ids []int
	if err := DB.Model(&AffiliateCashReward{}).
		Where("status = ? AND available_at <= ?", AffiliateRewardStatusPending, now).
		Order("id asc").Limit(limit).Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	released := 0
	for _, id := range ids {
		changed := false
		err := DB.Transaction(func(tx *gorm.DB) error {
			var err error
			changed, err = releaseAffiliateCashRewardWithTx(tx, id, now)
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

func releaseDueAffiliateCashRewardsForUser(userID int, now int64) error {
	var ids []int
	if err := DB.Model(&AffiliateCashReward{}).
		Where("inviter_user_id = ? AND status = ? AND available_at <= ?", userID, AffiliateRewardStatusPending, now).
		Order("id asc").Limit(500).Pluck("id", &ids).Error; err != nil {
		return err
	}
	for _, id := range ids {
		if err := DB.Transaction(func(tx *gorm.DB) error {
			_, err := releaseAffiliateCashRewardWithTx(tx, id, now)
			return err
		}); err != nil {
			return err
		}
	}
	return nil
}

func GetAffiliateCashAccount(userID int) (*AffiliateCashAccount, error) {
	if err := releaseDueAffiliateCashRewardsForUser(userID, common.GetTimestamp()); err != nil {
		return nil, err
	}
	var account AffiliateCashAccount
	err := DB.Transaction(func(tx *gorm.DB) error {
		current, err := ensureAffiliateCashAccountWithTx(tx, userID)
		if err != nil {
			return err
		}
		account = *current
		return nil
	})
	return &account, err
}

func CreateAffiliateCashTransfer(userID int, amountCents int64, requestKey string) (*AffiliateCashTransfer, error) {
	requestKey = strings.TrimSpace(requestKey)
	if amountCents <= 0 || requestKey == "" || len(requestKey) > 64 {
		return nil, ErrAffiliateAmountInvalid
	}
	if err := releaseDueAffiliateCashRewardsForUser(userID, common.GetTimestamp()); err != nil {
		return nil, err
	}
	var transfer AffiliateCashTransfer
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
		account, err := ensureAffiliateCashAccountWithTx(tx, userID)
		if err != nil {
			return err
		}
		if account.AvailableCents < amountCents {
			return ErrAffiliateBalance
		}
		exchangeRate := operation_setting.USDExchangeRate
		if exchangeRate <= 0 {
			exchangeRate = 1
		}
		creditedQuota, clamp := common.QuotaFromDecimalChecked(decimal.NewFromInt(amountCents).
			Div(decimal.NewFromInt(100)).Div(decimal.NewFromFloat(exchangeRate)).
			Mul(decimal.NewFromFloat(common.QuotaPerUnit)))
		if clamp != nil {
			return clamp
		}
		if creditedQuota <= 0 || int64(user.Quota)+int64(creditedQuota) > int64(common.MaxQuota) {
			return ErrAffiliateAmountInvalid
		}
		transfer = AffiliateCashTransfer{
			UserID: userID, RequestKey: requestKey, AmountCents: amountCents,
			CashBalanceBefore: account.AvailableCents, CashBalanceAfter: account.AvailableCents - amountCents,
			CNYExchangeRate: exchangeRate, CreditedQuota: int64(creditedQuota),
			UserQuotaBefore: user.Quota, UserQuotaAfter: user.Quota + creditedQuota,
		}
		if err := tx.Create(&transfer).Error; err != nil {
			return err
		}
		remaining := amountCents
		var rewards []AffiliateCashReward
		if err := lockForUpdate(tx).Where("inviter_user_id = ? AND status = ? AND cashback_cents - transferred_cents > 0", userID, AffiliateRewardStatusAvailable).
			Order("available_at asc, id asc").Find(&rewards).Error; err != nil {
			return err
		}
		for index := range rewards {
			available := rewards[index].CashbackCents - rewards[index].TransferredCents
			allocated := available
			if allocated > remaining {
				allocated = remaining
			}
			rewards[index].TransferredCents += allocated
			if rewards[index].TransferredCents >= rewards[index].CashbackCents {
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
		account.AvailableCents -= amountCents
		account.TransferredCents += amountCents
		if err := tx.Save(account).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userID).Update("quota", transfer.UserQuotaAfter).Error; err != nil {
			return err
		}
		return appendAffiliateCashLedgerWithTx(tx, account, AffiliateCashLedger{
			EntryType: AffiliateCashLedgerTypeBalanceTransfer, ReferenceType: AffiliateCashReferenceTransfer,
			ReferenceID: transfer.ID, AmountCents: amountCents, AvailableDeltaCents: -amountCents,
			TransferredDeltaCents: amountCents, IdempotencyKey: "campaign-cash-transfer:" + strconv.Itoa(transfer.ID),
		})
	})
	if err != nil {
		return nil, err
	}
	_ = InvalidateUserCache(userID)
	return &transfer, nil
}
