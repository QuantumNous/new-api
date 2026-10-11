package service

import (
	"context"
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type DirectOrderCheckout struct {
	PaymentProvider string `json:"payment_provider"`
	TradeNo         string `json:"trade_no"`
	Amount          string `json:"amount"`
	Currency        string `json:"currency"`
	ExpiresAt       int64  `json:"expires_at"`
	PayLink         string `json:"pay_link,omitempty"`
	CodeURL         string `json:"code_url,omitempty"`
}

// ResumeDirectOrder never reprices an order or extends the original payment window.
func ResumeDirectOrder(ctx context.Context, userID int, tradeNo, provider string, mobile bool) (*DirectOrderCheckout, error) {
	result := &DirectOrderCheckout{PaymentProvider: provider, TradeNo: tradeNo, Currency: "CNY"}
	switch provider {
	case model.PaymentProviderAlipay:
		order, config, err := model.GetAlipayOrder(tradeNo)
		if err != nil {
			return nil, err
		}
		if order.UserID != userID {
			return nil, gorm.ErrRecordNotFound
		}
		if order.Status != common.TopUpStatusPending || order.CancelRequested || order.CloseRequestedAt != 0 || order.ReviewRequired || common.GetTimestamp() >= order.ExpiresAt {
			return nil, errors.New("订单已支付、已取消或已过期，请刷新订单")
		}
		// Signing the same trade preserves merchant, amount and absolute expiry. This
		// also supports switching between desktop and mobile for a legacy order.
		result.PayLink, err = CreateAlipayCheckout(config, order, mobile)
		if err != nil {
			return nil, err
		}
		result.ExpiresAt = order.ExpiresAt
		result.Amount = decimal.NewFromInt(order.AmountFen).Div(decimal.NewFromInt(100)).StringFixed(2)
	case model.PaymentProviderWechatPay:
		order, config, err := model.GetWechatPayOrder(tradeNo)
		if err != nil {
			return nil, err
		}
		if order.UserID != userID {
			return nil, gorm.ErrRecordNotFound
		}
		if order.Status != common.TopUpStatusPending || order.CancelRequested || order.CloseRequestedAt != 0 || order.ReviewRequired || common.GetTimestamp() >= order.ExpiresAt {
			return nil, errors.New("订单已支付、已取消或已过期，请刷新订单")
		}
		result.CodeURL = order.CheckoutURL
		if result.CodeURL == "" {
			result.CodeURL, err = CreateWechatPayCheckout(ctx, config, order)
			if err != nil {
				return nil, err
			}
			updated := model.DB.Model(&model.WechatPayOrder{}).Where("id = ? AND status = ? AND (cancel_requested = ? OR cancel_requested IS NULL)", order.ID, common.TopUpStatusPending, false).Update("checkout_url", result.CodeURL)
			if updated.Error != nil {
				return nil, updated.Error
			}
			if updated.RowsAffected != 1 {
				return nil, errors.New("订单状态已变化，请刷新订单")
			}
		}
		result.ExpiresAt = order.ExpiresAt
		result.Amount = decimal.NewFromInt(order.AmountFen).Div(decimal.NewFromInt(100)).StringFixed(2)
	default:
		return nil, model.ErrPaymentMethodMismatch
	}
	return result, nil
}

// RequestDirectOrderCancellation stops resumption immediately. Gateway failures
// leave a durable cancellation request for reconciliation, never a local deletion.
func RequestDirectOrderCancellation(ctx context.Context, userID int, tradeNo, provider string) (string, error) {
	var target any
	var reconcile func(context.Context, string) error
	switch provider {
	case model.PaymentProviderAlipay:
		target, reconcile = &model.AlipayOrder{}, ReconcileAlipayOrder
	case model.PaymentProviderWechatPay:
		target, reconcile = &model.WechatPayOrder{}, ReconcileWechatPayOrder
	default:
		return "", model.ErrPaymentMethodMismatch
	}
	var order struct {
		Status          string
		CancelRequested bool
	}
	if err := model.DB.Model(target).Where("trade_no = ? AND user_id = ?", tradeNo, userID).First(&order).Error; err != nil {
		return "", err
	}
	if order.Status != common.TopUpStatusPending {
		return "", errors.New("仅可取消待支付订单")
	}
	updated := model.DB.Model(target).Where("trade_no = ? AND user_id = ? AND status = ?", tradeNo, userID, common.TopUpStatusPending).Updates(map[string]any{"cancel_requested": true, "next_check_at": 0, "close_requested_at": common.GetTimestamp(), "close_reason": "user_cancelled"})
	if updated.Error != nil {
		return "", updated.Error
	}
	if updated.RowsAffected != 1 && !order.CancelRequested {
		return "", errors.New("订单状态已变化，请刷新订单")
	}
	// The persisted request is accepted even if the provider is temporarily offline.
	_ = reconcile(ctx, tradeNo)
	err := model.DB.Model(target).Where("trade_no = ? AND user_id = ?", tradeNo, userID).First(&order).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "closed", nil
	}
	if err != nil {
		return "", err
	}
	if order.Status == common.TopUpStatusExpired {
		return "closed", nil
	}
	if order.Status == "paid" || order.Status == common.TopUpStatusSuccess {
		return "paid", nil
	}
	return "closing", nil
}
