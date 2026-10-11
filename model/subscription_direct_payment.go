package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Direct subscription orders reuse the provider's immutable configuration and
// verified payment evidence. The plan is frozen before redirecting to checkout.
func CreateDirectSubscriptionOrder(order *SubscriptionOrder, plan *SubscriptionPlan, payment any) error {
	payload, err := common.Marshal(plan)
	if err != nil {
		return err
	}
	order.ProviderPayload = string(payload)
	return DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id").First(&user, order.UserId).Error; err != nil {
			return err
		}
		var active int64
		if err := tx.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ? AND status = ? AND end_time > ?", order.UserId, plan.Id, "active", getDBTimestamp(tx)).Count(&active).Error; err != nil {
			return err
		}
		if active > 0 {
			return ErrActiveSubscriptionExists
		}
		if plan.MaxPurchasePerUser > 0 {
			var purchased, pending int64
			if err := tx.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", order.UserId, plan.Id).Count(&purchased).Error; err != nil {
				return err
			}
			if err := tx.Model(&SubscriptionOrder{}).Where("user_id = ? AND plan_id = ? AND status = ?", order.UserId, plan.Id, common.TopUpStatusPending).Count(&pending).Error; err != nil {
				return err
			}
			if purchased+pending >= int64(plan.MaxPurchasePerUser) {
				return errors.New("已达到该套餐购买上限或存在待支付订单")
			}
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}
		return tx.Create(payment).Error
	})
}

func completeDirectSubscriptionPayment(tradeNo, provider string) error {
	var userID int
	completed := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var payment any
		var status string
		var providerTradeNo *string
		var amountFen int64
		var reviewRequired bool
		switch provider {
		case PaymentProviderAlipay:
			var p AlipayOrder
			if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&p).Error; err != nil {
				return err
			}
			reviewRequired = p.ReviewRequired
			payment, status, providerTradeNo, amountFen, userID = &p, p.Status, p.ProviderTradeNo, p.AmountFen, p.UserID
		case PaymentProviderWechatPay:
			var p WechatPayOrder
			if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&p).Error; err != nil {
				return err
			}
			reviewRequired = p.ReviewRequired
			payment, status, providerTradeNo, amountFen, userID = &p, p.Status, p.ProviderTradeNo, p.AmountFen, p.UserID
		default:
			return ErrPaymentMethodMismatch
		}
		var order SubscriptionOrder
		if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			return err
		}
		if order.PaymentProvider != provider || order.UserId != userID {
			return ErrPaymentMethodMismatch
		}
		if status == common.TopUpStatusSuccess && order.Status == common.TopUpStatusSuccess {
			return nil
		}
		if reviewRequired {
			return ErrPaymentReviewRequired
		}
		if status != "paid" || providerTradeNo == nil || (order.Status != common.TopUpStatusPending && order.Status != common.TopUpStatusExpired) || order.CompleteTime != 0 || order.PaymentReceipt.ReceiptTradeNo != "" || order.PaymentReceipt.ReceiptAmount != "" || order.PaymentReceipt.ReceiptCurrency != "" {
			return ErrTopUpStatusInvalid
		}
		var plan SubscriptionPlan
		if err := common.UnmarshalJsonStr(order.ProviderPayload, &plan); err != nil {
			return err
		}
		if plan.Id != order.PlanId {
			return errors.New("invalid subscription snapshot")
		}
		var user User
		if err := lockForUpdate(tx).Select("id").First(&user, userID).Error; err != nil {
			return err
		}
		// Purchase limits were checked while creating the payable order. A verified
		// payment must be fulfilled even if another purchase completed meanwhile.
		plan.MaxPurchasePerUser = 0
		if _, err := createUserSubscriptionFromPlanTx(tx, userID, &plan, "order", false); err != nil {
			return err
		}
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = common.GetTimestamp()
		order.PaymentReceipt = PaymentReceipt{ReceiptCurrency: "CNY", ReceiptAmount: decimal.NewFromInt(amountFen).Div(decimal.NewFromInt(100)).StringFixed(2), ReceiptTradeNo: *providerTradeNo}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		if err := tx.Model(payment).Updates(map[string]any{"status": common.TopUpStatusSuccess, "last_error": "", "cache_pending": false}).Error; err != nil {
			return err
		}
		completed = true
		return nil
	})
	if err != nil {
		return err
	}
	if userID > 0 {
		refreshSubscriptionUserGroupCache(userID, "direct subscription payment")
	}
	if completed {
		RecordLog(userID, LogTypeTopup, fmt.Sprintf("订阅购买成功，订单: %s，支付方式: %s", tradeNo, provider))
	}
	return nil
}

func isDirectSubscriptionOrder(tradeNo string) bool {
	return strings.HasPrefix(tradeNo, "SUBALI") || strings.HasPrefix(tradeNo, "SUBWX")
}
