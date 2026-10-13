package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const SubscriptionOrderPaidReview = "paid_review"

var ErrSubscriptionPurchasePending = errors.New("同套餐或同等级已有未完成订单，请前往我的订单继续支付或取消，关单确认后再购买")
var ErrSubscriptionPurchaseLimit = errors.New("已达到该套餐购买上限")

// Every purchase/fulfillment takes the same database user lock before reading
// eligibility. The no-op write also acquires SQLite's writer lock (FOR UPDATE is
// unavailable there). No process-local mutex or unlocked count is authoritative.
func lockSubscriptionBuyer(tx *gorm.DB, userID int) error {
	if userID <= 0 {
		return errors.New("invalid user id")
	}
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		if err := tx.Model(&User{}).Where("id = ?", userID).UpdateColumn("id", gorm.Expr("id")).Error; err != nil {
			return err
		}
	}
	var user User
	return lockForUpdate(tx).Select("id").First(&user, userID).Error
}

func checkSubscriptionEligibilityTx(tx *gorm.DB, userID int, plan *SubscriptionPlan) error {
	var active int64
	query := tx.Model(&UserSubscription{}).Where("user_id = ? AND status = ? AND end_time > ?", userID, "active", getDBTimestamp(tx))
	group := strings.TrimSpace(plan.UpgradeGroup)
	if group == "" {
		query = query.Where("plan_id = ?", plan.Id)
	} else {
		query = query.Where("plan_id = ? OR upgrade_group = ?", plan.Id, group)
	}
	if err := query.Count(&active).Error; err != nil {
		return err
	}
	if active > 0 {
		return ErrActiveSubscriptionExists
	}
	if plan.MaxPurchasePerUser > 0 {
		var count int64
		if err := tx.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", userID, plan.Id).Count(&count).Error; err != nil {
			return err
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			return ErrSubscriptionPurchaseLimit
		}
	}
	return nil
}

// Pending orders are the durable reservation, independent of lifetime limits.
// Local expiry is not proof of gateway closure. A paid review also retains its
// reservation until an explicit financial resolution, never an automatic retry.
func checkSubscriptionReservationTx(tx *gorm.DB, userID int, plan *SubscriptionPlan) error {
	var orders []SubscriptionOrder
	if err := tx.Where("user_id = ? AND status IN ?", userID, []string{common.TopUpStatusPending, common.TopUpStatusExpired, SubscriptionOrderPaidReview}).Find(&orders).Error; err != nil {
		return err
	}
	for _, order := range orders {
		if order.Status == common.TopUpStatusExpired {
			var payment any
			switch order.PaymentProvider {
			case PaymentProviderAlipay:
				payment = &AlipayOrder{}
			case PaymentProviderWechatPay:
				payment = &WechatPayOrder{}
			default:
				continue
			}
			var state struct {
				ClosedAt       int64
				Status         string
				ReviewRequired bool
			}
			if err := tx.Model(payment).Where("trade_no = ?", order.TradeNo).Take(&state).Error; err != nil {
				return err
			}
			if state.ClosedAt > 0 && state.Status == common.TopUpStatusExpired && !state.ReviewRequired {
				continue
			}
		}
		if order.PlanId == plan.Id {
			return ErrSubscriptionPurchasePending
		}
		if strings.TrimSpace(plan.UpgradeGroup) == "" {
			continue
		}
		var reserved SubscriptionPlan
		if order.ProviderPayload == "" || common.UnmarshalJsonStr(order.ProviderPayload, &reserved) != nil || reserved.Id != order.PlanId {
			// Legacy orders predate frozen plan snapshots.
			if err := tx.First(&reserved, order.PlanId).Error; err != nil {
				return err
			}
		}
		if strings.TrimSpace(reserved.UpgradeGroup) == strings.TrimSpace(plan.UpgradeGroup) {
			return ErrSubscriptionPurchasePending
		}
	}
	return nil
}
