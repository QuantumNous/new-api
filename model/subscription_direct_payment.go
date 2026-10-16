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
		if err := lockSubscriptionBuyer(tx, order.UserId); err != nil {
			return err
		}
		if err := checkSubscriptionEligibilityTx(tx, order.UserId, plan); err != nil {
			return err
		}
		if err := checkSubscriptionReservationTx(tx, order.UserId, plan); err != nil {
			return err
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}
		if err := tx.Create(payment).Error; err != nil {
			return err
		}
		if wm, ok := payment.(*WebMoneyOrder); ok && (wm.ID <= 0 || wm.ID >= 999999999999999) {
			return errors.New("WebMoney payment number exhausted")
		}
		return nil
	})
}

func completeDirectSubscriptionPayment(tradeNo, provider string) error {
	var userID int
	completed := false
	reviewed := false
	var owner SubscriptionOrder
	if err := DB.Select("user_id").Where("trade_no = ?", tradeNo).Take(&owner).Error; err != nil {
		return err
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockSubscriptionBuyer(tx, owner.UserId); err != nil {
			return err
		}
		var payment any
		var status string
		var providerTradeNo *string
		var amountFen int64
		var reviewRequired bool
		receiptCurrency, receiptAmount := "CNY", ""
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
		case PaymentProviderAntom:
			var p AntomOrder
			if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&p).Error; err != nil {
				return err
			}
			reviewRequired = p.ReviewRequired
			payment, status, providerTradeNo, userID = &p, p.Status, p.ProviderTradeNo, p.UserID
			receiptCurrency, receiptAmount = "USD", p.Amount
		case PaymentProviderWebMoney:
			var p WebMoneyOrder
			if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&p).Error; err != nil {
				return err
			}
			reviewRequired = p.ReviewRequired
			payment, status, providerTradeNo, userID = &p, p.Status, p.ProviderTradeNo, p.UserID
			receiptCurrency, receiptAmount = "WMT", p.Amount
		default:
			return ErrPaymentMethodMismatch
		}
		if receiptAmount == "" {
			receiptAmount = decimal.NewFromInt(amountFen).Div(decimal.NewFromInt(100)).StringFixed(2)
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
		if order.Status == SubscriptionOrderPaidReview && status == "paid" && providerTradeNo != nil {
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
		if err := checkSubscriptionEligibilityTx(tx, userID, &plan); err != nil {
			if !errors.Is(err, ErrActiveSubscriptionExists) && !errors.Is(err, ErrSubscriptionPurchaseLimit) {
				return err
			}
			order.Status = SubscriptionOrderPaidReview
			order.PaymentReceipt = PaymentReceipt{ReceiptCurrency: receiptCurrency, ReceiptAmount: receiptAmount, ReceiptTradeNo: *providerTradeNo}
			if err := tx.Save(&order).Error; err != nil {
				return err
			}
			updates := map[string]any{"review_required": true, "last_error": "subscription_conflict", "next_check_at": 0, "checked_at": common.GetTimestamp()}
			if provider == PaymentProviderWebMoney || provider == PaymentProviderAntom {
				updates["status"] = "paid"
			}
			if err := tx.Model(payment).Updates(updates).Error; err != nil {
				return err
			}
			reviewed = true
			return nil
		}
		if _, err := createUserSubscriptionFromPlanTx(tx, userID, &plan, "order"); err != nil {
			return err
		}
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = common.GetTimestamp()
		order.PaymentReceipt = PaymentReceipt{ReceiptCurrency: receiptCurrency, ReceiptAmount: receiptAmount, ReceiptTradeNo: *providerTradeNo}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		updates := map[string]any{"status": common.TopUpStatusSuccess, "cache_pending": false}
		if provider != PaymentProviderWebMoney {
			updates["last_error"] = ""
		}
		if provider == PaymentProviderAntom {
			updates["next_check_at"] = 0
		}
		if err := tx.Model(payment).Updates(updates).Error; err != nil {
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
	if reviewed {
		RecordLog(userID, LogTypeSystem, fmt.Sprintf("订阅订单已付款，因购买限制冲突待人工处理，未发放权益，订单: %s，支付方式: %s", tradeNo, provider))
	}
	if completed {
		RecordLog(userID, LogTypeTopup, fmt.Sprintf("订阅购买成功，订单: %s，支付方式: %s", tradeNo, provider))
	}
	return nil
}

func isDirectSubscriptionOrder(tradeNo string) bool {
	return strings.HasPrefix(tradeNo, "SUBALI") || strings.HasPrefix(tradeNo, "SUBWX")
}

// A verified payment may require manual resolution if subscription eligibility changed.
func DirectSubscriptionReviewRequired(tradeNo string) bool {
	if !strings.HasPrefix(tradeNo, "SUBANT") && !strings.HasPrefix(tradeNo, "SUBWM") {
		return false
	}
	var order SubscriptionOrder
	if err := DB.Select("status").Where("trade_no = ?", tradeNo).Take(&order).Error; err != nil {
		return true
	}
	return order.Status == SubscriptionOrderPaidReview || order.Status == PaymentOrderReviewClosed
}
