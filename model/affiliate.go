package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	AffiliateRebateStatusPending   = "pending"
	AffiliateRebateStatusAvailable = "available"

	AffiliateWithdrawalStatusPending  = "pending"
	AffiliateWithdrawalStatusPaid     = "paid"
	AffiliateWithdrawalStatusRejected = "rejected"
)

var (
	ErrAffiliateRuleDisabled       = errors.New("affiliate rebate is disabled")
	ErrAffiliateWithdrawalDisabled = errors.New("affiliate withdrawal is disabled")
	ErrAffiliateQuotaInsufficient  = errors.New("affiliate quota is insufficient")
	ErrAffiliateWithdrawalInvalid  = errors.New("affiliate withdrawal status is invalid")
)

type AffiliateUserRule struct {
	Id                         int     `json:"id"`
	UserId                     int     `json:"user_id" gorm:"uniqueIndex;not null"`
	Enabled                    bool    `json:"enabled"`
	RewardPercent              float64 `json:"reward_percent"`
	SettleAfterInviteeConsumed bool    `json:"settle_after_invitee_consumed"`
	CreatedAt                  int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt                  int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

type AffiliateRebate struct {
	Id                         int     `json:"id"`
	InviterId                  int     `json:"inviter_id" gorm:"index"`
	InviteeId                  int     `json:"invitee_id" gorm:"index"`
	TopUpId                    int     `json:"topup_id" gorm:"uniqueIndex"`
	TradeNo                    string  `json:"trade_no" gorm:"type:varchar(255);uniqueIndex"`
	TopUpQuota                 int     `json:"topup_quota"`
	TopUpMoney                 float64 `json:"topup_money"`
	RewardQuota                int     `json:"reward_quota"`
	RewardPercent              float64 `json:"reward_percent"`
	SettleAfterInviteeConsumed bool    `json:"settle_after_invitee_consumed"`
	ReleaseUsedQuota           int     `json:"release_used_quota"`
	Status                     string  `json:"status" gorm:"type:varchar(32);index"`
	CreatedAt                  int64   `json:"created_at" gorm:"autoCreateTime"`
	ReleasedAt                 int64   `json:"released_at"`
}

type AffiliateWithdrawal struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id" gorm:"index"`
	Amount        int    `json:"amount"`
	PaymentMethod string `json:"payment_method" gorm:"type:varchar(64)"`
	Account       string `json:"account" gorm:"type:varchar(255)"`
	Remark        string `json:"remark" gorm:"type:varchar(255)"`
	AdminRemark   string `json:"admin_remark" gorm:"type:varchar(255)"`
	Status        string `json:"status" gorm:"type:varchar(32);index"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     int64  `json:"updated_at" gorm:"autoUpdateTime"`
	ProcessedAt   int64  `json:"processed_at"`
	ProcessedBy   int    `json:"processed_by"`
}

type effectiveAffiliateRule struct {
	Enabled                    bool
	RewardPercent              float64
	SettleAfterInviteeConsumed bool
}

func GetAffiliateUserRule(userId int) (*AffiliateUserRule, bool, error) {
	var rule AffiliateUserRule
	err := DB.Where("user_id = ?", userId).First(&rule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return &rule, true, nil
}

func SaveAffiliateUserRule(rule *AffiliateUserRule) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return SaveAffiliateUserRuleWithTx(tx, rule)
	})
}

func SaveAffiliateUserRuleWithTx(tx *gorm.DB, rule *AffiliateUserRule) error {
	if rule.UserId == 0 {
		return errors.New("user id is empty")
	}
	var existing AffiliateUserRule
	err := tx.Where("user_id = ?", rule.UserId).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return tx.Create(rule).Error
	}
	if err != nil {
		return err
	}
	existing.Enabled = rule.Enabled
	existing.RewardPercent = rule.RewardPercent
	existing.SettleAfterInviteeConsumed = rule.SettleAfterInviteeConsumed
	return tx.Save(&existing).Error
}

func DeleteAffiliateUserRule(userId int) error {
	return DB.Where("user_id = ?", userId).Delete(&AffiliateUserRule{}).Error
}

func DeleteAffiliateUserRuleWithTx(tx *gorm.DB, userId int) error {
	return tx.Where("user_id = ?", userId).Delete(&AffiliateUserRule{}).Error
}

func GetAffiliateInviteCount(userId int) (int, error) {
	var count int64
	err := DB.Model(&User{}).Where("inviter_id = ?", userId).Count(&count).Error
	return int(count), err
}

func getEffectiveAffiliateRuleTx(tx *gorm.DB, inviterId int) (effectiveAffiliateRule, error) {
	global := operation_setting.GetAffiliateSetting()
	if !global.Enabled {
		return effectiveAffiliateRule{}, nil
	}

	rule := effectiveAffiliateRule{
		Enabled:                    true,
		RewardPercent:              global.RewardPercent,
		SettleAfterInviteeConsumed: global.SettleAfterInviteeConsumed,
	}

	var userRule AffiliateUserRule
	err := tx.Where("user_id = ?", inviterId).First(&userRule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return rule, nil
	}
	if err != nil {
		return effectiveAffiliateRule{}, err
	}

	rule.Enabled = userRule.Enabled
	rule.RewardPercent = userRule.RewardPercent
	rule.SettleAfterInviteeConsumed = userRule.SettleAfterInviteeConsumed
	return rule, nil
}

func addAffiliateQuotaTx(tx *gorm.DB, userId int, amount int, includeHistory bool) error {
	if amount <= 0 {
		return nil
	}
	updates := map[string]interface{}{
		"aff_quota": gorm.Expr("aff_quota + ?", amount),
	}
	if includeHistory {
		updates["aff_history"] = gorm.Expr("aff_history + ?", amount)
	}
	return tx.Model(&User{}).Where("id = ?", userId).Updates(updates).Error
}

func createAffiliateRebateForQuotaTx(tx *gorm.DB, inviteeId int, sourceId int, sourceTradeNo string, sourceQuota int, sourceMoney float64) error {
	if inviteeId == 0 || sourceId == 0 || sourceTradeNo == "" || sourceQuota <= 0 {
		return nil
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return nil
	}

	var invitee User
	if err := tx.Select("id", "inviter_id", "used_quota").Where("id = ?", inviteeId).First(&invitee).Error; err != nil {
		return err
	}
	if invitee.InviterId == 0 {
		return nil
	}

	rule, err := getEffectiveAffiliateRuleTx(tx, invitee.InviterId)
	if err != nil {
		return err
	}
	if !rule.Enabled || rule.RewardPercent <= 0 {
		return nil
	}

	var existing int64
	if err := tx.Model(&AffiliateRebate{}).Where("top_up_id = ? OR trade_no = ?", sourceId, sourceTradeNo).Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}

	rewardQuota := int(decimal.NewFromInt(int64(sourceQuota)).
		Mul(decimal.NewFromFloat(rule.RewardPercent)).
		Div(decimal.NewFromInt(100)).
		IntPart())
	if rewardQuota <= 0 {
		return nil
	}

	status := AffiliateRebateStatusAvailable
	releaseUsedQuota := 0
	if rule.SettleAfterInviteeConsumed {
		status = AffiliateRebateStatusPending
		releaseUsedQuota = invitee.UsedQuota + sourceQuota
	}

	rebate := AffiliateRebate{
		InviterId:                  invitee.InviterId,
		InviteeId:                  invitee.Id,
		TopUpId:                    sourceId,
		TradeNo:                    sourceTradeNo,
		TopUpQuota:                 sourceQuota,
		TopUpMoney:                 sourceMoney,
		RewardQuota:                rewardQuota,
		RewardPercent:              rule.RewardPercent,
		SettleAfterInviteeConsumed: rule.SettleAfterInviteeConsumed,
		ReleaseUsedQuota:           releaseUsedQuota,
		Status:                     status,
	}
	if status == AffiliateRebateStatusAvailable {
		rebate.ReleasedAt = common.GetTimestamp()
	}
	if err := tx.Create(&rebate).Error; err != nil {
		return err
	}
	if status == AffiliateRebateStatusAvailable {
		return addAffiliateQuotaTx(tx, invitee.InviterId, rewardQuota, true)
	}
	return nil
}

func CreateAffiliateRebateForTopUpTx(tx *gorm.DB, topUp *TopUp, topUpQuota int) error {
	if topUp == nil || topUp.Id == 0 || topUp.UserId == 0 {
		return nil
	}
	return createAffiliateRebateForQuotaTx(tx, topUp.UserId, topUp.Id, topUp.TradeNo, topUpQuota, topUp.Money)
}

func CreateAffiliateRebateForTopUp(topUp *TopUp, topUpQuota int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return CreateAffiliateRebateForTopUpTx(tx, topUp, topUpQuota)
	})
}

func CreateAffiliateRebateForRedemptionTx(tx *gorm.DB, redemption *Redemption, userId int) error {
	if redemption == nil || redemption.Id == 0 || userId == 0 || redemption.Quota <= 0 {
		return nil
	}
	if !operation_setting.GetAffiliateSetting().RedemptionEnabled {
		return nil
	}
	sourceTradeNo := fmt.Sprintf("redemption:%d", redemption.Id)
	return createAffiliateRebateForQuotaTx(tx, userId, -redemption.Id, sourceTradeNo, redemption.Quota, 0)
}

func ReleaseEligibleAffiliateRebatesForInvitee(inviteeId int) error {
	if inviteeId == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var invitee User
		if err := tx.Select("id", "used_quota").Where("id = ?", inviteeId).First(&invitee).Error; err != nil {
			return err
		}

		var rebates []AffiliateRebate
		if err := tx.Where(
			"invitee_id = ? AND status = ? AND release_used_quota <= ?",
			inviteeId,
			AffiliateRebateStatusPending,
			invitee.UsedQuota,
		).Find(&rebates).Error; err != nil {
			return err
		}

		for _, rebate := range rebates {
			res := tx.Model(&AffiliateRebate{}).
				Where("id = ? AND status = ?", rebate.Id, AffiliateRebateStatusPending).
				Updates(map[string]interface{}{
					"status":      AffiliateRebateStatusAvailable,
					"released_at": common.GetTimestamp(),
				})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				continue
			}
			if err := addAffiliateQuotaTx(tx, rebate.InviterId, rebate.RewardQuota, true); err != nil {
				return err
			}
		}
		return nil
	})
}

func GetPendingAffiliateQuota(userId int) (int, error) {
	var total int64
	err := DB.Model(&AffiliateRebate{}).
		Where("inviter_id = ? AND status = ?", userId, AffiliateRebateStatusPending).
		Select("COALESCE(SUM(reward_quota), 0)").
		Scan(&total).Error
	return int(total), err
}

func CreateAffiliateWithdrawal(userId int, amount int, paymentMethod string, account string, remark string) (*AffiliateWithdrawal, error) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return nil, ErrAffiliateRuleDisabled
	}
	affiliateSetting := operation_setting.GetAffiliateSetting()
	if !affiliateSetting.Enabled || !affiliateSetting.WithdrawEnabled {
		return nil, ErrAffiliateWithdrawalDisabled
	}
	if amount <= 0 {
		return nil, errors.New("withdraw amount must be greater than zero")
	}

	withdrawal := &AffiliateWithdrawal{
		UserId:        userId,
		Amount:        amount,
		PaymentMethod: paymentMethod,
		Account:       account,
		Remark:        remark,
		Status:        AffiliateWithdrawalStatusPending,
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if user.AffQuota < amount {
			return ErrAffiliateQuotaInsufficient
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("aff_quota", gorm.Expr("aff_quota - ?", amount)).Error; err != nil {
			return err
		}
		return tx.Create(withdrawal).Error
	})
	if err != nil {
		return nil, err
	}
	return withdrawal, nil
}

func GetUserAffiliateWithdrawals(userId int, pageInfo *common.PageInfo) (withdrawals []*AffiliateWithdrawal, total int64, err error) {
	query := DB.Model(&AffiliateWithdrawal{}).Where("user_id = ?", userId)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&withdrawals).Error
	return withdrawals, total, err
}

func GetAllAffiliateWithdrawals(pageInfo *common.PageInfo) (withdrawals []*AffiliateWithdrawal, total int64, err error) {
	query := DB.Model(&AffiliateWithdrawal{})
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&withdrawals).Error
	return withdrawals, total, err
}

func UpdateAffiliateWithdrawalStatus(id int, status string, adminRemark string, operatorId int) error {
	if status != AffiliateWithdrawalStatusPaid && status != AffiliateWithdrawalStatusRejected {
		return ErrAffiliateWithdrawalInvalid
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var withdrawal AffiliateWithdrawal
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(&withdrawal).Error; err != nil {
			return err
		}
		if withdrawal.Status != AffiliateWithdrawalStatusPending {
			return ErrAffiliateWithdrawalInvalid
		}
		if status == AffiliateWithdrawalStatusRejected {
			if err := tx.Model(&User{}).Where("id = ?", withdrawal.UserId).Update("aff_quota", gorm.Expr("aff_quota + ?", withdrawal.Amount)).Error; err != nil {
				return err
			}
		}
		withdrawal.Status = status
		withdrawal.AdminRemark = adminRemark
		withdrawal.ProcessedAt = common.GetTimestamp()
		withdrawal.ProcessedBy = operatorId
		return tx.Save(&withdrawal).Error
	})
}
