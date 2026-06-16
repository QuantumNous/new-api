package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting"

	"gorm.io/gorm"
)

// PaymentProviderStripeAuto marks top-up orders created by the threshold-triggered
// automatic off-session charge, so they can be distinguished from manual top-ups.
const PaymentProviderStripeAuto = "stripe_auto"

// MarkStripeCardBound records that a user has successfully bound a card, and (idempotently)
// grants the one-time new-user bonus when eligible.
//
// The whole operation runs in a single transaction and is safe to call repeatedly from
// webhook retries: the bonus is only granted when new_user_bonus_given is still false,
// guarded by a row-level lock. Returns (bonusGranted, bonusQuota, error).
func MarkStripeCardBound(userId int, customerId string) (bonusGranted bool, bonusQuota int, err error) {
	if userId <= 0 {
		return false, 0, errors.New("invalid user id")
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		user := &User{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(user).Error; err != nil {
			return err
		}

		// Always mark the card as bound.
		boundFields := map[string]interface{}{"stripe_card_bound": true}
		if strings.TrimSpace(customerId) != "" {
			boundFields["stripe_customer"] = strings.TrimSpace(customerId)
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).Updates(boundFields).Error; err != nil {
			return err
		}

		if !setting.StripeCardBindEnabled {
			return nil
		}
		grantQuota := setting.StripeNewUserBonusAmount * int(common.QuotaPerUnit)
		if grantQuota <= 0 {
			return nil
		}

		// Grant the one-time bonus with a conditional UPDATE: the WHERE clause makes the
		// database itself enforce single-grant atomically, so concurrent webhook deliveries
		// (even across distinct setup sessions, and on SQLite where FOR UPDATE is a no-op)
		// can never double-credit — only the first UPDATE matches a row.
		res := tx.Model(&User{}).
			Where("id = ? AND new_user_bonus_given = ?", userId, false).
			Updates(map[string]interface{}{
				"quota":                gorm.Expr("quota + ?", grantQuota),
				"new_user_bonus_given": true,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			bonusQuota = grantQuota
			bonusGranted = true
		}
		return nil
	})

	if err != nil {
		bonusGranted = false
		bonusQuota = 0
		return false, 0, err
	}

	if bonusGranted {
		if cacheErr := cacheIncrUserQuota(userId, int64(bonusQuota)); cacheErr != nil {
			common.SysLog("failed to increase user quota cache after stripe card bind bonus: " + cacheErr.Error())
		}
		RecordLog(userId, LogTypeSystem, fmt.Sprintf("绑定信用卡赠送 %s", logger.FormatQuota(bonusQuota)))
	}

	return bonusGranted, bonusQuota, nil
}

// SetStripeCardUnbound clears the bound-card flag for a user (used when a card is detached).
func SetStripeCardUnbound(userId int) error {
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	return DB.Model(&User{}).Where("id = ?", userId).Update("stripe_card_bound", false).Error
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
