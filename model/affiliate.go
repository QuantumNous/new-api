package model

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	AffiliateActionAccrue         = "accrue"
	AffiliateActionSkip           = "skip"
	AffiliateActionTransfer       = "transfer"
	AffiliateActionLegacySnapshot = "legacy_snapshot"

	AffiliateSourceTopUp        = "topup"
	AffiliateSourceSubscription = "subscription"

	affiliateCodeLength = 12
)

var (
	ErrAffiliateCodeRequired  = errors.New("邀请码不能为空")
	ErrAffiliateCodeInvalid   = errors.New("邀请码无效")
	ErrAffiliateCodeDisabled  = errors.New("邀请码已停用")
	ErrAffiliateCodeLimit     = errors.New("邀请码使用次数已达上限")
	ErrAffiliateQuotaEmpty    = errors.New("邀请额度不足")
	ErrAffiliateProgramLocked = errors.New("邀请返利计划激活后不可停用")
)

var affiliateCodeAlphabet = []byte("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

type AffiliateLedger struct {
	Id                  int64  `json:"id"`
	UserId              int    `json:"user_id" gorm:"index;not null"`
	InviteeId           int    `json:"invitee_id" gorm:"index;not null;default:0"`
	Action              string `json:"action" gorm:"type:varchar(32);index;not null"`
	SourceType          string `json:"source_type" gorm:"type:varchar(32);index"`
	SourceId            int64  `json:"source_id" gorm:"type:bigint;index;not null;default:0"`
	SourceTradeNo       string `json:"source_trade_no" gorm:"type:varchar(255);index"`
	SourceEventKey      string `json:"source_event_key" gorm:"type:varchar(160);uniqueIndex;not null"`
	BaseQuota           int64  `json:"base_quota" gorm:"type:bigint;not null;default:0"`
	RateBps             int    `json:"rate_bps" gorm:"type:int;not null;default:0"`
	RewardQuota         int64  `json:"reward_quota" gorm:"type:bigint;not null;default:0"`
	Reason              string `json:"reason" gorm:"type:varchar(64)"`
	FrozenUntil         int64  `json:"frozen_until" gorm:"type:bigint;index;not null;default:0"`
	ThawedAt            int64  `json:"thawed_at" gorm:"type:bigint;not null;default:0"`
	BalanceAfter        *int64 `json:"balance_after,omitempty" gorm:"type:bigint"`
	AvailableQuotaAfter *int64 `json:"available_quota_after,omitempty" gorm:"type:bigint"`
	FrozenQuotaAfter    *int64 `json:"frozen_quota_after,omitempty" gorm:"type:bigint"`
	HistoryQuotaAfter   *int64 `json:"history_quota_after,omitempty" gorm:"type:bigint"`
	CreatedAt           int64  `json:"created_at" gorm:"autoCreateTime"`
}

type AffiliateRewardSource struct {
	Type      string
	Id        int64
	TradeNo   string
	InviteeId int
	BaseQuota int64
	CreatedAt int64
}

func GenerateAffiliateCode() (string, error) {
	buf := make([]byte, affiliateCodeLength)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		buf[i] = affiliateCodeAlphabet[int(buf[i])%len(affiliateCodeAlphabet)]
	}
	return string(buf), nil
}

func GenerateUniqueAffiliateCodeTx(tx *gorm.DB) (string, error) {
	if tx == nil {
		return "", errors.New("affiliate transaction is required")
	}
	for attempt := 0; attempt < 10; attempt++ {
		code, err := GenerateAffiliateCode()
		if err != nil {
			return "", err
		}
		var count int64
		if err := tx.Unscoped().Model(&User{}).Where("aff_code = ?", code).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return code, nil
		}
	}
	return "", errors.New("failed to generate a unique invite code")
}

func EnsureAffiliateCode(userId int) (string, error) {
	if userId <= 0 {
		return "", gorm.ErrRecordNotFound
	}
	var code string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id", "aff_code").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if user.AffCode != "" {
			code = user.AffCode
			return nil
		}
		generated, err := GenerateUniqueAffiliateCodeTx(tx)
		if err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ? AND aff_code = ''", userId).Updates(map[string]interface{}{
			"aff_code":         generated,
			"aff_code_enabled": true,
		}).Error; err != nil {
			return err
		}
		code = generated
		return nil
	})
	return code, err
}

func NormalizeCustomAffiliateCode(raw string) (string, error) {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if len(code) < 4 || len(code) > 32 {
		return "", ErrAffiliateCodeInvalid
	}
	for _, char := range code {
		valid := char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '_' || char == '-'
		if !valid {
			return "", ErrAffiliateCodeInvalid
		}
	}
	return code, nil
}

func CountInvitedUsers(tx *gorm.DB, inviterId int) (int64, error) {
	if tx == nil {
		tx = DB
	}
	var count int64
	err := tx.Model(&User{}).Where("inviter_id = ?", inviterId).Count(&count).Error
	return count, err
}

func ResolveAffiliateInviterTx(tx *gorm.DB, rawCode string, required bool) (*User, error) {
	code := strings.TrimSpace(rawCode)
	if code == "" {
		if required {
			return nil, ErrAffiliateCodeRequired
		}
		return nil, nil
	}
	if tx == nil {
		return nil, errors.New("affiliate transaction is required")
	}

	var inviter User
	if err := lockForUpdate(tx).Where("aff_code = ?", code).First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAffiliateCodeInvalid
		}
		return nil, err
	}
	if inviter.Status != common.UserStatusEnabled {
		return nil, ErrAffiliateCodeDisabled
	}
	if !inviter.AffCodeEnabled {
		return nil, ErrAffiliateCodeDisabled
	}
	if inviter.AffInviteLimit != nil {
		count, err := CountInvitedUsers(tx, inviter.Id)
		if err != nil {
			return nil, err
		}
		if count >= int64(*inviter.AffInviteLimit) {
			return nil, ErrAffiliateCodeLimit
		}
	}
	return &inviter, nil
}

func ValidateAffiliateCode(rawCode string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		_, err := ResolveAffiliateInviterTx(tx, rawCode, true)
		return err
	})
}

func EffectiveAffiliateRateBps(user *User) int {
	if user != nil && user.AffRebateRateBps != nil {
		return clampAffiliateRateBps(*user.AffRebateRateBps)
	}
	return clampAffiliateRateBps(common.AffiliateRebateRateBps)
}

func clampAffiliateRateBps(value int) int {
	if value < 0 {
		return 0
	}
	if value > 10000 {
		return 10000
	}
	return value
}

func AffiliateBaseQuotaFromPayment(payMoney float64, unitPrice float64) (int64, error) {
	if payMoney <= 0 || unitPrice <= 0 || common.QuotaPerUnit <= 0 || math.IsNaN(payMoney) || math.IsInf(payMoney, 0) {
		return 0, errors.New("invalid affiliate payment base")
	}
	base := decimal.NewFromFloat(payMoney).
		Div(decimal.NewFromFloat(unitPrice)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Floor()
	if !base.IsPositive() {
		return 0, errors.New("invalid affiliate quota base")
	}
	quota, err := common.QuotaFromDecimalStrict(base)
	if err != nil || quota <= 0 {
		return 0, errors.New("invalid affiliate quota base")
	}
	return int64(quota), nil
}

func AffiliateBaseQuotaFromUSD(amount float64) (int64, error) {
	return AffiliateBaseQuotaFromPayment(amount, 1)
}

func SnapshotAffiliateBaseQuota(payMoney float64, unitPrice float64) (int64, error) {
	if !common.AffiliateEnabled || common.AffiliateActivatedAt <= 0 {
		return 0, nil
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return 0, errors.New("支付合规状态无效，无法创建返利订单")
	}
	return AffiliateBaseQuotaFromPayment(payMoney, unitPrice)
}

func affiliatePeriodEndUnix(base int64, amount int, unitSeconds int64) (int64, error) {
	if amount < 0 || unitSeconds <= 0 {
		return 0, errors.New("invalid affiliate period")
	}
	if amount == 0 {
		return base, nil
	}
	amount64 := int64(amount)
	if amount64 > math.MaxInt64/unitSeconds {
		return 0, errors.New("affiliate period overflows unix timestamp")
	}
	delta := amount64 * unitSeconds
	if base > math.MaxInt64-delta {
		return 0, errors.New("affiliate period overflows unix timestamp")
	}
	return base + delta, nil
}

func ApplyAffiliateRewardTx(tx *gorm.DB, source AffiliateRewardSource) error {
	if tx == nil {
		return errors.New("affiliate transaction is required")
	}
	if source.Id <= 0 || source.InviteeId <= 0 || source.BaseQuota <= 0 || source.CreatedAt < common.AffiliateActivatedAt {
		return nil
	}

	eventKey := fmt.Sprintf("%s:%d", source.Type, source.Id)
	var existing int64
	if err := tx.Model(&AffiliateLedger{}).Where("source_event_key = ?", eventKey).Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}

	var invitee User
	if err := tx.Select("id", "inviter_id", "created_at").Where("id = ?", source.InviteeId).First(&invitee).Error; err != nil {
		return err
	}
	if invitee.InviterId <= 0 {
		return createAffiliateSkipTx(tx, source, eventKey, 0, "no_inviter")
	}
	if !common.AffiliateEnabled || common.AffiliateActivatedAt <= 0 {
		return createAffiliateSkipTx(tx, source, eventKey, invitee.InviterId, "program_inactive")
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return createAffiliateSkipTx(tx, source, eventKey, invitee.InviterId, "compliance_unconfirmed")
	}

	var inviter User
	if err := lockForUpdate(tx).Where("id = ?", invitee.InviterId).First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return createAffiliateSkipTx(tx, source, eventKey, invitee.InviterId, "inviter_missing")
		}
		return err
	}
	if inviter.Status != common.UserStatusEnabled || !inviter.AffCodeEnabled {
		return createAffiliateSkipTx(tx, source, eventKey, inviter.Id, "inviter_inactive")
	}
	if common.AffiliateDurationDays > 0 {
		expiresAt, err := affiliatePeriodEndUnix(invitee.CreatedAt, common.AffiliateDurationDays, 24*60*60)
		if err != nil {
			return err
		}
		if source.CreatedAt > expiresAt {
			return createAffiliateSkipTx(tx, source, eventKey, inviter.Id, "duration_expired")
		}
	}

	rateBps := EffectiveAffiliateRateBps(&inviter)
	reward := source.BaseQuota * int64(rateBps) / 10000
	if reward <= 0 {
		return createAffiliateSkipTx(tx, source, eventKey, inviter.Id, "zero_reward")
	}

	capQuota, err := AffiliateBaseQuotaFromUSD(common.AffiliatePerInviteeCap)
	if err != nil && common.AffiliatePerInviteeCap > 0 {
		return err
	}
	if capQuota > 0 {
		var accrued int64
		if err := tx.Model(&AffiliateLedger{}).
			Where("user_id = ? AND invitee_id = ? AND action = ?", inviter.Id, invitee.Id, AffiliateActionAccrue).
			Select("COALESCE(SUM(reward_quota), 0)").Scan(&accrued).Error; err != nil {
			return err
		}
		if accrued >= capQuota {
			return createAffiliateSkipTx(tx, source, eventKey, inviter.Id, "invitee_cap_reached")
		}
		if remaining := capQuota - accrued; reward > remaining {
			reward = remaining
		}
	}
	if reward > int64(common.MaxQuota) ||
		int64(inviter.AffHistoryQuota)+reward >= int64(common.MaxQuota) ||
		int64(inviter.AffQuota)+int64(inviter.AffFrozenQuota)+reward >= int64(common.MaxQuota) {
		return createAffiliateSkipTx(tx, source, eventKey, inviter.Id, "inviter_quota_limit")
	}

	frozenUntil := int64(0)
	updates := map[string]any{
		"aff_history": gorm.Expr("aff_history + ?", reward),
	}
	if common.AffiliateFreezeHours > 0 {
		var err error
		frozenUntil, err = affiliatePeriodEndUnix(time.Now().Unix(), common.AffiliateFreezeHours, 60*60)
		if err != nil {
			return err
		}
		updates["aff_frozen_quota"] = gorm.Expr("aff_frozen_quota + ?", reward)
	} else {
		updates["aff_quota"] = gorm.Expr("aff_quota + ?", reward)
	}
	if err := tx.Model(&User{}).Where("id = ?", inviter.Id).Updates(updates).Error; err != nil {
		return err
	}

	var updated User
	if err := tx.Select("aff_quota", "aff_frozen_quota", "aff_history").Where("id = ?", inviter.Id).First(&updated).Error; err != nil {
		return err
	}
	availableAfter := int64(updated.AffQuota)
	frozenAfter := int64(updated.AffFrozenQuota)
	historyAfter := int64(updated.AffHistoryQuota)
	return tx.Create(&AffiliateLedger{
		UserId: inviter.Id, InviteeId: invitee.Id, Action: AffiliateActionAccrue,
		SourceType: source.Type, SourceId: source.Id, SourceTradeNo: source.TradeNo, SourceEventKey: eventKey,
		BaseQuota: source.BaseQuota, RateBps: rateBps, RewardQuota: reward, FrozenUntil: frozenUntil,
		AvailableQuotaAfter: &availableAfter, FrozenQuotaAfter: &frozenAfter, HistoryQuotaAfter: &historyAfter,
	}).Error
}

func createAffiliateSkipTx(tx *gorm.DB, source AffiliateRewardSource, eventKey string, inviterId int, reason string) error {
	return tx.Create(&AffiliateLedger{
		UserId: inviterId, InviteeId: source.InviteeId, Action: AffiliateActionSkip,
		SourceType: source.Type, SourceId: source.Id, SourceTradeNo: source.TradeNo, SourceEventKey: eventKey,
		BaseQuota: source.BaseQuota, Reason: reason,
	}).Error
}

func ThawAffiliateQuotaTx(tx *gorm.DB, userId int) (int64, error) {
	if tx == nil {
		return 0, errors.New("affiliate transaction is required")
	}
	var user User
	if err := lockForUpdate(tx).Select("id", "aff_quota", "aff_frozen_quota").Where("id = ?", userId).First(&user).Error; err != nil {
		return 0, err
	}

	var rows []AffiliateLedger
	now := time.Now().Unix()
	if err := tx.Select("id", "reward_quota").
		Where("user_id = ? AND action = ? AND frozen_until > 0 AND frozen_until <= ? AND thawed_at = 0", userId, AffiliateActionAccrue, now).
		Find(&rows).Error; err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}

	ids := make([]int64, 0, len(rows))
	var thawed int64
	for _, row := range rows {
		ids = append(ids, row.Id)
		thawed += row.RewardQuota
	}
	if thawed <= 0 {
		return 0, nil
	}
	if err := tx.Model(&AffiliateLedger{}).Where("id IN ? AND thawed_at = 0", ids).Update("thawed_at", now).Error; err != nil {
		return 0, err
	}
	return thawed, tx.Model(&User{}).Where("id = ?", userId).Updates(map[string]any{
		"aff_quota":        gorm.Expr("aff_quota + ?", thawed),
		"aff_frozen_quota": gorm.Expr("CASE WHEN aff_frozen_quota >= ? THEN aff_frozen_quota - ? ELSE 0 END", thawed, thawed),
	}).Error
}

func ThawAffiliateQuota(userId int) (int64, error) {
	var thawed int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		thawed, err = ThawAffiliateQuotaTx(tx, userId)
		return err
	})
	return thawed, err
}

func TransferAffiliateQuota(userId int, amount int) (int, int, error) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return 0, 0, errors.New("邀请返利功能未启用")
	}
	if amount <= 0 || float64(amount) < common.QuotaPerUnit {
		return 0, 0, errors.New("转移额度低于最低限制")
	}

	var newBalance int
	err := DB.Transaction(func(tx *gorm.DB) error {
		if _, err := ThawAffiliateQuotaTx(tx, userId); err != nil {
			return err
		}
		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if user.AffQuota < amount {
			return ErrAffiliateQuotaEmpty
		}
		if int64(user.Quota)+int64(amount) >= int64(common.MaxQuota) {
			return ErrTopUpQuotaLimitExceeded
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).Updates(map[string]any{
			"aff_quota": gorm.Expr("aff_quota - ?", amount),
			"quota":     gorm.Expr("quota + ?", amount),
		}).Error; err != nil {
			return err
		}
		if err := tx.Select("quota", "aff_quota", "aff_frozen_quota", "aff_history").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		newBalance = user.Quota
		balanceAfter := int64(user.Quota)
		availableAfter := int64(user.AffQuota)
		frozenAfter := int64(user.AffFrozenQuota)
		historyAfter := int64(user.AffHistoryQuota)
		return tx.Create(&AffiliateLedger{
			UserId: userId, Action: AffiliateActionTransfer,
			SourceEventKey: "transfer:" + common.GetUUID(), RewardQuota: int64(amount),
			BalanceAfter: &balanceAfter, AvailableQuotaAfter: &availableAfter,
			FrozenQuotaAfter: &frozenAfter, HistoryQuotaAfter: &historyAfter,
		}).Error
	})
	if err != nil {
		return 0, 0, err
	}
	syncCreditUserQuotaCache(userId, amount, "affiliate transfer")
	return amount, newBalance, nil
}

func HasActiveAffiliateSeed() (bool, error) {
	var count int64
	err := DB.Model(&User{}).
		Where("role >= ? AND status = ? AND aff_code <> '' AND aff_code_enabled = ?", common.RoleAdminUser, common.UserStatusEnabled, true).
		Count(&count).Error
	return count > 0, err
}

func ActivateAffiliateProgram() error {
	if common.AffiliateActivatedAt > 0 {
		common.AffiliateEnabled = true
		return nil
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return errors.New("支付合规确认后才能激活邀请返利计划")
	}
	hasSeed, err := HasActiveAffiliateSeed()
	if err != nil {
		return err
	}
	if !hasSeed {
		return errors.New("至少需要一个有效的管理员或根用户邀请码才能激活")
	}
	now := time.Now().Unix()
	values := map[string]string{
		"AffiliateEnabled":     "true",
		"AffiliateActivatedAt": strconv.FormatInt(now, 10),
		"QuotaForInviter":      "0",
	}
	if err := UpdateOptionsBulk(values); err != nil {
		return err
	}
	common.AffiliateEnabled = true
	common.AffiliateActivatedAt = now
	common.QuotaForInviter = 0
	return nil
}

func SetAffiliateProgramEnabled(enabled bool) error {
	if enabled {
		return ActivateAffiliateProgram()
	}
	if common.AffiliateActivatedAt > 0 {
		return ErrAffiliateProgramLocked
	}
	return UpdateOption("AffiliateEnabled", "false")
}

func BackfillAffiliateCodeEnabled() error {
	const marker = "affiliate.migration.aff_code_enabled_v1"
	var option Option
	if err := DB.Where(commonKeyCol+" = ?", marker).First(&option).Error; err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).Where("1 = 1").Update("aff_code_enabled", true).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("aff_code_custom IS NULL").Update("aff_code_custom", false).Error; err != nil {
			return err
		}
		return tx.Create(&Option{Key: marker, Value: "done"}).Error
	})
}

func InitializeAffiliateLedger() error {
	var users []User
	if err := DB.Select("id", "quota", "aff_quota", "aff_frozen_quota", "aff_history").
		Where("aff_history <> 0 OR aff_quota <> 0 OR aff_frozen_quota <> 0").Find(&users).Error; err != nil {
		return err
	}
	for _, user := range users {
		key := fmt.Sprintf("legacy:user:%d", user.Id)
		balanceAfter := int64(user.Quota)
		availableAfter := int64(user.AffQuota)
		frozenAfter := int64(user.AffFrozenQuota)
		historyAfter := int64(user.AffHistoryQuota)
		entry := AffiliateLedger{
			UserId: user.Id, Action: AffiliateActionLegacySnapshot, SourceEventKey: key,
			RewardQuota: int64(user.AffHistoryQuota), BalanceAfter: &balanceAfter,
			AvailableQuotaAfter: &availableAfter, FrozenQuotaAfter: &frozenAfter, HistoryQuotaAfter: &historyAfter,
		}
		if err := DB.Where("source_event_key = ?", key).FirstOrCreate(&entry).Error; err != nil {
			return err
		}
	}
	return nil
}
