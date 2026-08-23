package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// InviteRebate records a recharge rebate already paid to an inviter.
// TopUpId uniqueness makes webhook retries and crash recovery idempotent.
type InviteRebate struct {
	Id        int     `json:"id"`
	TopUpId   int     `json:"top_up_id" gorm:"uniqueIndex;not null"`
	TradeNo   string  `json:"trade_no" gorm:"type:varchar(255);index"`
	InviteeId int     `json:"invitee_id" gorm:"index;not null"`
	InviterId int     `json:"inviter_id" gorm:"index;not null"`
	Quota     int     `json:"quota"`
	Percent   float64 `json:"percent"`
	Sequence  int     `json:"sequence"`
	CreatedAt int64   `json:"created_at" gorm:"bigint"`
}

type inviteRebateGrant struct {
	InviteeId int
	InviterId int
	Quota     int
	Percent   float64
	Sequence  int
}

var walletTopUpProviders = []string{
	PaymentProviderEpay,
	PaymentProviderStripe,
	PaymentProviderCreem,
	PaymentProviderWaffo,
	PaymentProviderWaffoPancake,
}

func isWalletTopUpProvider(provider string) bool {
	switch provider {
	case PaymentProviderEpay, PaymentProviderStripe, PaymentProviderCreem, PaymentProviderWaffo, PaymentProviderWaffoPancake:
		return true
	default:
		return false
	}
}

func inviteRebateUnitPrice(provider string) float64 {
	switch provider {
	case PaymentProviderStripe:
		return setting.StripeUnitPrice
	case PaymentProviderWaffo:
		return setting.WaffoUnitPrice
	case PaymentProviderWaffoPancake:
		return setting.WaffoPancakeUnitPrice
	default:
		return operation_setting.Price
	}
}

// calcInviteRebateQuota converts the amount actually paid into site quota and
// applies the rebate percent. Creem stores credited quota in Amount; other
// gateways store the paid money and a unit price.
func calcInviteRebateQuota(topUp *TopUp, percent float64) int {
	if topUp == nil || percent <= 0 {
		return 0
	}

	var base decimal.Decimal
	if topUp.PaymentProvider == PaymentProviderCreem {
		if topUp.Amount <= 0 {
			return 0
		}
		base = decimal.NewFromInt(topUp.Amount)
	} else {
		if topUp.Money <= 0 {
			return 0
		}
		unitPrice := inviteRebateUnitPrice(topUp.PaymentProvider)
		if unitPrice <= 0 {
			return 0
		}
		base = decimal.NewFromFloat(topUp.Money).
			Div(decimal.NewFromFloat(unitPrice)).
			Mul(decimal.NewFromFloat(common.QuotaPerUnit))
	}

	quota, err := common.QuotaFromDecimalStrict(
		base.Mul(decimal.NewFromFloat(percent)).Div(decimal.NewFromInt(100)),
	)
	if err != nil || quota <= 0 {
		return 0
	}
	return quota
}

// applyInviteRebate credits the inviter after a wallet top-up has reached
// success. It is safe to call on webhook retries: a unique TopUpId keeps the
// payout at most once, and already-success callbacks can recover a grant that
// crashed between invitee credit and rebate.
func applyInviteRebate(topUp *TopUp) {
	result, err := grantInviteRebate(topUp)
	if err != nil {
		tradeNo := ""
		if topUp != nil {
			tradeNo = topUp.TradeNo
		}
		common.SysError(fmt.Sprintf("invite rebate failed trade_no=%s: %s", tradeNo, err.Error()))
		return
	}
	if result == nil {
		return
	}
	syncCreditUserQuotaCache(result.InviterId, result.Quota, "invite rebate")
	RecordLog(result.InviterId, LogTypeSystem, fmt.Sprintf(
		"邀请充值返利：被邀请用户 #%d 第 %d 次充值，按实际支付金额的 %.4g%% 返还 %s",
		result.InviteeId, result.Sequence, result.Percent, logger.LogQuota(result.Quota),
	))
}

func grantInviteRebate(topUp *TopUp) (*inviteRebateGrant, error) {
	if topUp == nil || topUp.Id == 0 || topUp.Status != common.TopUpStatusSuccess {
		return nil, nil
	}
	if !isWalletTopUpProvider(topUp.PaymentProvider) {
		return nil, nil
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return nil, nil
	}

	times, percent := operation_setting.GetInviteRebateSetting().Normalized()
	if times <= 0 || percent <= 0 {
		return nil, nil
	}

	var grant *inviteRebateGrant
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing int64
		if err := tx.Model(&InviteRebate{}).Where("top_up_id = ?", topUp.Id).Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return nil
		}

		var invitee User
		if err := lockForUpdate(tx).
			Select("id", "inviter_id", "invite_rebate_eligible").
			Where("id = ?", topUp.UserId).
			First(&invitee).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if !invitee.InviteRebateEligible || invitee.InviterId <= 0 || invitee.InviterId == invitee.Id {
			return nil
		}

		var sequence int64
		if err := tx.Model(&TopUp{}).
			Where("user_id = ? AND status = ? AND payment_provider IN ? AND id <= ?",
				invitee.Id, common.TopUpStatusSuccess, walletTopUpProviders, topUp.Id).
			Count(&sequence).Error; err != nil {
			return err
		}
		if sequence <= 0 || sequence > int64(times) {
			return nil
		}

		rebateQuota := calcInviteRebateQuota(topUp, percent)
		if rebateQuota <= 0 {
			return nil
		}

		record := &InviteRebate{
			TopUpId:   topUp.Id,
			TradeNo:   topUp.TradeNo,
			InviteeId: invitee.Id,
			InviterId: invitee.InviterId,
			Quota:     rebateQuota,
			Percent:   percent,
			Sequence:  int(sequence),
			CreatedAt: common.GetTimestamp(),
		}
		if err := tx.Create(record).Error; err != nil {
			if isDuplicateKeyError(err) {
				return nil
			}
			return err
		}

		if err := creditTopUpQuota(tx, invitee.InviterId, rebateQuota, map[string]interface{}{
			"aff_history": gorm.Expr("aff_history + ?", rebateQuota),
		}); err != nil {
			return err
		}

		grant = &inviteRebateGrant{
			InviteeId: invitee.Id,
			InviterId: invitee.InviterId,
			Quota:     rebateQuota,
			Percent:   percent,
			Sequence:  int(sequence),
		}
		return nil
	})
	if errors.Is(err, ErrTopUpQuotaLimitExceeded) || errors.Is(err, gorm.ErrRecordNotFound) {
		common.SysLog(fmt.Sprintf("invite rebate skipped trade_no=%s: %s", topUp.TradeNo, err.Error()))
		return nil, nil
	}
	return grant, err
}

const inviteStatisticsSyncedOptionKey = "InviteStatisticsSynced"

// EnsureInviteStatisticsSynced backfills invite counts from inviter_id and
// adds already-paid recharge rebates into aff_history so admin/wallet stats
// match the actual invite graph. It runs once per database.
func EnsureInviteStatisticsSynced() error {
	var opt Option
	err := DB.Where(commonKeyCol+" = ?", inviteStatisticsSyncedOptionKey).First(&opt).Error
	if err == nil && opt.Value == "true" {
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if err := syncInviteStatistics(); err != nil {
		return err
	}
	return UpdateOption(inviteStatisticsSyncedOptionKey, "true")
}

func syncInviteStatistics() error {
	type inviteCountRow struct {
		InviterId int   `gorm:"column:inviter_id"`
		Count     int64 `gorm:"column:cnt"`
	}
	var countRows []inviteCountRow
	if err := DB.Unscoped().Model(&User{}).
		Select("inviter_id as inviter_id, count(*) as cnt").
		Where("inviter_id > 0").
		Group("inviter_id").
		Scan(&countRows).Error; err != nil {
		return err
	}

	inviterIDs := make([]int, 0, len(countRows))
	for _, row := range countRows {
		inviterIDs = append(inviterIDs, row.InviterId)
	}
	zeroQuery := DB.Model(&User{}).Where("aff_count > 0")
	if len(inviterIDs) > 0 {
		zeroQuery = zeroQuery.Where("id NOT IN ?", inviterIDs)
	}
	if err := zeroQuery.Update("aff_count", 0).Error; err != nil {
		return err
	}
	for _, row := range countRows {
		if err := DB.Model(&User{}).Where("id = ?", row.InviterId).Update("aff_count", int(row.Count)).Error; err != nil {
			return err
		}
	}

	type rebateSumRow struct {
		InviterId int `gorm:"column:inviter_id"`
		Total     int `gorm:"column:total"`
	}
	var rebateRows []rebateSumRow
	if err := DB.Model(&InviteRebate{}).
		Select("inviter_id, sum(quota) as total").
		Group("inviter_id").
		Scan(&rebateRows).Error; err != nil {
		return err
	}
	for _, row := range rebateRows {
		if row.Total <= 0 {
			continue
		}
		if err := DB.Model(&User{}).Where("id = ?", row.InviterId).
			Update("aff_history", gorm.Expr("aff_history + ?", row.Total)).Error; err != nil {
			return err
		}
	}
	return nil
}
