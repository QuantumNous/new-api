package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// StripeBonusClaim records that a physical card (identified by its stable Stripe fingerprint)
// has already earned the one-time new-user bonus. The UNIQUE index on CardFingerprint lets
// the database atomically enforce "one bonus per card" — concurrent binds of the same card
// across different accounts race on the insert, and only the winner grants the bonus. This
// avoids the read-then-write TOCTOU of a count-based check.
type StripeBonusClaim struct {
	Id              int    `json:"id"`
	CardFingerprint string `json:"card_fingerprint" gorm:"type:varchar(64);uniqueIndex"`
	UserId          int    `json:"user_id" gorm:"index"`
	CreatedTime     int64  `json:"created_time" gorm:"bigint"`
}

// claimBonusForFingerprint atomically claims the one-time bonus for a card fingerprint within
// the given transaction. Returns true if THIS user won the claim (and should be granted the
// bonus), false if the card already claimed it (insert lost on the unique index).
func claimBonusForFingerprint(tx *gorm.DB, userId int, cardFingerprint string) (bool, error) {
	claim := &StripeBonusClaim{
		CardFingerprint: cardFingerprint,
		UserId:          userId,
		CreatedTime:     common.GetTimestamp(),
	}
	// Insert; on unique-key conflict the card already claimed the bonus -> we lost the race.
	res := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(claim)
	if res.Error != nil {
		return false, res.Error
	}
	// RowsAffected == 0 means ON CONFLICT DO NOTHING skipped the insert (already claimed).
	return res.RowsAffected > 0, nil
}

// PaymentProviderStripeAuto marks top-up orders created by the threshold-triggered
// automatic off-session charge, so they can be distinguished from manual top-ups.
const PaymentProviderStripeAuto = "stripe_auto"

// SetStripeCardUnbound clears the bound-card flag for a user (used when a card is detached).
func SetStripeCardUnbound(userId int) error {
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	return DB.Model(&User{}).Where("id = ?", userId).Update("stripe_card_bound", false).Error
}

// SetStripeCardBound marks a user's card as bound (and records customer + fingerprint),
// without granting any bonus. Used by the recharge-with-save-card flow, where the card is
// saved during a paid Checkout via setup_future_usage.
func SetStripeCardBound(userId int, customerId string, cardFingerprint string) error {
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	fields := map[string]interface{}{"stripe_card_bound": true}
	if strings.TrimSpace(customerId) != "" {
		fields["stripe_customer"] = strings.TrimSpace(customerId)
	}
	if strings.TrimSpace(cardFingerprint) != "" {
		fields["stripe_card_fingerprint"] = strings.TrimSpace(cardFingerprint)
	}
	return DB.Model(&User{}).Where("id = ?", userId).Updates(fields).Error
}

// ClaimStripeCardFingerprint atomically consumes the one-time new-user-bonus eligibility for a
// physical card (Stripe fingerprint) without granting any bonus. It is used by the paid
// recharge-with-save-card flow: that flow gives the user a (purchased) deposit bonus instead of
// the free new-user bonus, so the card must still "use up" its one bonus slot to stop the same
// physical card from later earning the free new-user bonus on another account via the setup-mode
// bind path (which guards on the same StripeBonusClaim unique index). No-op when fingerprint is
// empty. Idempotent: a card already claimed (by this or another user) is a harmless no-op.
func ClaimStripeCardFingerprint(userId int, cardFingerprint string) error {
	cardFingerprint = strings.TrimSpace(cardFingerprint)
	if userId <= 0 || cardFingerprint == "" {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		_, err := claimBonusForFingerprint(tx, userId, cardFingerprint)
		return err
	})
}

// HasRecentStripeAutoCharge reports whether the user already has an automatic off-session
// charge recorded within the last windowSeconds. This is a persistent (cross-instance,
// restart-safe) cooldown guard that complements the in-memory dedup in the controller —
// it prevents charging the same user again from another replica or after a restart.
func HasRecentStripeAutoCharge(userId int, windowSeconds int64) (bool, error) {
	if userId <= 0 {
		return false, errors.New("invalid user id")
	}
	cutoff := common.GetTimestamp() - windowSeconds
	var count int64
	err := DB.Model(&TopUp{}).
		Where("user_id = ? AND payment_provider = ? AND create_time >= ?", userId, PaymentProviderStripeAuto, cutoff).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// RecordStripeAutoChargeAttempt persists a failed/aborted auto-charge attempt as a
// stripe_auto TopUp row (status=failed) so that HasRecentStripeAutoCharge treats it as a
// recent charge and applies the cooldown. This stops a declined/unverifiable card from
// triggering a charge attempt on every relay request (decline storm + log spam), and is
// cross-instance / restart-safe. attemptKey makes the trade_no unique per attempt window.
//
// NOTE for revenue/top-up reporting: these rows are status=failed cooldown markers, NOT
// revenue. Any report aggregating TopUp by payment_provider MUST filter on
// status = success (the stripe_auto provider also carries these failed markers).
func RecordStripeAutoChargeAttempt(userId int, amountUnits int, attemptKey string) {
	if userId <= 0 {
		return
	}
	now := common.GetTimestamp()
	topUp := &TopUp{
		UserId:          userId,
		Amount:          int64(amountUnits),
		TradeNo:         "autofail_" + strings.TrimSpace(attemptKey),
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripeAuto,
		CreateTime:      now,
		CompleteTime:    now,
		Status:          common.TopUpStatusFailed,
	}
	if err := DB.Create(topUp).Error; err != nil {
		// A duplicate trade_no (same attempt key) is fine — the cooldown row already exists.
		common.SysLog("failed to record stripe auto-charge attempt cooldown row: " + err.Error())
	}
}

// RecordStripeAutoChargeFailure writes a user-visible system log entry when an automatic
// off-session charge fails, so the user (and admins) can see that their bound card needs
// attention. reason is a short human-readable cause (e.g. "card declined").
func RecordStripeAutoChargeFailure(userId int, amountUnits int, reason string) {
	if userId <= 0 {
		return
	}
	RecordLog(userId, LogTypeSystem, fmt.Sprintf(
		"自动扣费失败：尝试为您的绑定卡扣款 $%d 失败（%s），请检查或更新您的支付方式以免影响使用。",
		amountUnits, reason,
	))
}

// CreditStripeAutoCharge records a successful automatic off-session charge as a completed
// TopUp order and credits the user's quota, all within one transaction. amountUnits is the
// USD amount (in top-up units) charged; money is the exact amount billed; gatewayTradeNo is
// the Stripe PaymentIntent id.
func CreditStripeAutoCharge(userId int, amountUnits int, money float64, gatewayTradeNo string, callerIp string) error {
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	quotaToAdd := amountUnits * int(common.QuotaPerUnit)
	if quotaToAdd <= 0 {
		return errors.New("invalid auto-charge amount")
	}

	tradeNo := "auto_" + strings.TrimSpace(gatewayTradeNo)
	err := DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{
			UserId:          userId,
			Amount:          int64(amountUnits),
			Money:           money,
			TradeNo:         tradeNo,
			GatewayTradeNo:  strings.TrimSpace(gatewayTradeNo),
			PaymentMethod:   PaymentMethodStripe,
			PaymentProvider: PaymentProviderStripeAuto,
			CreateTime:      common.GetTimestamp(),
			CompleteTime:    common.GetTimestamp(),
			Status:          common.TopUpStatusSuccess,
		}
		if err := tx.Create(topUp).Error; err != nil {
			return err
		}
		return tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error
	})
	if err != nil {
		return err
	}

	if cacheErr := cacheIncrUserQuota(userId, int64(quotaToAdd)); cacheErr != nil {
		common.SysLog("failed to increase user quota cache after stripe auto charge: " + cacheErr.Error())
	}
	RecordTopupLog(userId, fmt.Sprintf("自动扣费充值成功，充值金额: %s，支付金额：%.2f", logger.FormatQuota(quotaToAdd), money), callerIp, PaymentMethodStripe, PaymentProviderStripeAuto)
	return nil
}
