package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// DirectPaymentLifecycle retains cancellation intent separately from payment facts.
// No automatic deletion: these records are needed for late callbacks and audit.
type DirectPaymentLifecycle struct {
	CloseRequestedAt int64  `json:"close_requested_at"`
	ClosedAt         int64  `json:"closed_at"`
	CloseReason      string `json:"close_reason" gorm:"type:varchar(32)"`
	GatewayStatus    string `json:"gateway_status" gorm:"type:varchar(32)"`
	CheckedAt        int64  `json:"checked_at"`
	RetryCount       int    `json:"retry_count"`
	ReviewRequired   bool   `json:"review_required"`
}

var ErrPaymentReviewRequired = errors.New("payment requires manual review")

// ConfirmDirectOrderClosed preserves both records and uses the same lock order as
// settlement. A concurrent verified payment always wins over a close response.
func ConfirmDirectOrderClosed(tradeNo, provider string) error {
	var target any
	switch provider {
	case PaymentProviderAlipay:
		target = &AlipayOrder{}
	case PaymentProviderWechatPay:
		target = &WechatPayOrder{}
	default:
		return ErrPaymentMethodMismatch
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var evidence struct {
			ID              int
			UserID          int
			Status          string
			ProviderTradeNo *string
			CancelRequested bool
			DirectPaymentLifecycle
		}
		if err := lockForUpdate(tx.Model(target)).Where("trade_no = ?", tradeNo).First(&evidence).Error; err != nil {
			return err
		}
		if evidence.Status == "paid" || evidence.Status == common.TopUpStatusSuccess {
			return nil
		}
		if evidence.ReviewRequired {
			return ErrPaymentReviewRequired
		}
		if (evidence.Status != common.TopUpStatusPending && evidence.Status != common.TopUpStatusExpired) || evidence.ProviderTradeNo != nil {
			return ErrTopUpStatusInvalid
		}
		var business any = &TopUp{}
		if isDirectSubscriptionOrder(tradeNo) {
			business = &SubscriptionOrder{}
		}
		var order struct {
			UserId          int
			Status          string
			PaymentProvider string
			CompleteTime    int64
			PaymentReceipt
		}
		if err := lockForUpdate(tx.Model(business)).Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			return err
		}
		if order.UserId != evidence.UserID || order.PaymentProvider != provider {
			return ErrPaymentMethodMismatch
		}
		if (order.Status != common.TopUpStatusPending && order.Status != common.TopUpStatusExpired) || order.CompleteTime != 0 || order.ReceiptTradeNo != "" || order.ReceiptCurrency != "" || order.ReceiptAmount != "" {
			return ErrTopUpStatusInvalid
		}
		if evidence.ClosedAt != 0 {
			return nil
		}
		now := common.GetTimestamp()
		reason := evidence.CloseReason
		if reason == "" {
			reason = "gateway_closed"
		}
		if evidence.CancelRequested {
			reason = "user_cancelled"
		}
		requested := evidence.CloseRequestedAt
		if requested == 0 {
			requested = now
		}
		if err := tx.Model(target).Where("id = ?", evidence.ID).Updates(map[string]any{"status": common.TopUpStatusExpired, "closed_at": now, "close_requested_at": requested, "close_reason": reason, "next_check_at": 0}).Error; err != nil {
			return err
		}
		return tx.Model(business).Where("trade_no = ?", tradeNo).Update("status", common.TopUpStatusExpired).Error
	})
}

// RecordDirectOrderCheck stores only bounded internal error codes, never SDK
// request/response bodies or credentials. Retry backoff is durable across restarts.
func RecordDirectOrderCheck(tradeNo, provider string, checkErr error) error {
	var target any = &AlipayOrder{}
	if provider == PaymentProviderWechatPay {
		target = &WechatPayOrder{}
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order struct {
			ID           int
			Status       string
			ExpiresAt    int64
			CachePending bool
			DirectPaymentLifecycle
		}
		if err := lockForUpdate(tx.Model(target)).Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		updates := map[string]any{"checked_at": now, "retry_count": 0, "last_error": "", "next_check_at": now + 15}
		if checkErr != nil {
			attempts := min(max(order.RetryCount, 0)+1, 8)
			updates["retry_count"] = attempts
			next := now + min(int64(15)<<uint(attempts-1), 900)
			if order.Status == common.TopUpStatusPending && order.ExpiresAt > now {
				next = min(next, order.ExpiresAt)
			}
			updates["next_check_at"] = next
			updates["last_error"] = "gateway_check_failed"
			if order.Status == "paid" {
				updates["last_error"] = "credit_pending"
			}
		}
		if order.ReviewRequired {
			updates["last_error"] = "manual_review_required"
		}
		if (order.Status == common.TopUpStatusSuccess && !order.CachePending) || (order.Status == common.TopUpStatusExpired && order.ClosedAt > 0) || order.ReviewRequired {
			updates["next_check_at"] = 0
		}
		return tx.Model(target).Where("id = ?", order.ID).Updates(updates).Error
	})
}
