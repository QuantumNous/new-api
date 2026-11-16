package service

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// ---------------------------------------------------------------------------
// FundingSource — Funding source interface (wallet or subscription)
// ---------------------------------------------------------------------------

// FundingSource abstracts the funding source for withholding fees.
type FundingSource interface {
	// Source returns the funding source identifier: "wallet" or "subscription"
	Source() string
	// PreConsume withholds amount amount from this funding source
	PreConsume(amount int) error
	// Settle adjusts the source of funds according to the difference (positive amounts are deducted, negative amounts are refunded)
	Settle(delta int) error
	// Refund all withholding fees
	Refund() error
}

// ---------------------------------------------------------------------------
// WalletFunding — wallet fund source implementation
// ---------------------------------------------------------------------------

// ErrInsufficientWalletQuota The wallet atomic withholding failed (insufficient balance) and no deduction occurred.
// BillingSession is accordingly mapped to ErrorCodeInsufficientUserQuota,
// Enables billing preferences such as wallet_first to fall back to subscriptions.
var ErrInsufficientWalletQuota = errors.New("wallet quota insufficient")

type WalletFunding struct {
	userId   int
	consumed int // Actual user quota withheld
}

func (w *WalletFunding) Source() string { return BillingSourceWallet }

func (w *WalletFunding) PreConsume(amount int) error {
	if amount <= 0 {
		return nil
	}
	reserved, err := model.TryReserveUserQuota(w.userId, amount)
	if err != nil {
		return err
	}
	if !reserved {
		return ErrInsufficientWalletQuota
	}
	// Any additional deductions made before sending will be withheld again, and the full amount of the withholding will be refunded only after the amount is accumulated and refunded.
	w.consumed += amount
	return nil
}

func (w *WalletFunding) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	if delta > 0 {
		return model.DecreaseUserQuota(w.userId, delta, false)
	}
	return model.IncreaseUserQuota(w.userId, -delta, false)
}

func (w *WalletFunding) Refund() error {
	if w.consumed <= 0 {
		return nil
	}
	// IncreaseUserQuota is a non-idempotent operation with quota += N and cannot be retried, otherwise the quota will be refunded.
	// The subscription's RefundSubscriptionPreConsume has requestId idempotent protection so it can be retried.
	return model.IncreaseUserQuota(w.userId, w.consumed, false)
}

// ---------------------------------------------------------------------------
// SubscriptionFunding — Subscription funding source implementation
// ---------------------------------------------------------------------------

type SubscriptionFunding struct {
	requestId      string
	userId         int
	modelName      string
	amount         int64 // Subscription amount withheld (subConsume)
	subscriptionId int
	preConsumed    int64
	// The following fields are populated after PreConsume succeeds and are used synchronously by RelayInfo
	AmountTotal     int64
	AmountUsedAfter int64
	PlanId          int
	PlanTitle       string
}

func (s *SubscriptionFunding) Source() string { return BillingSourceSubscription }

func (s *SubscriptionFunding) PreConsume(_ int) error {
	// The amount parameter is ignored, the internal s.amount is used (already calculated at construction time based on preConsumedQuota)
	res, err := model.PreConsumeUserSubscription(s.requestId, s.userId, s.modelName, 0, s.amount)
	if err != nil {
		return err
	}
	s.subscriptionId = res.UserSubscriptionId
	s.preConsumed = res.PreConsumed
	s.AmountTotal = res.AmountTotal
	s.AmountUsedAfter = res.AmountUsedAfter
	// Get subscription plan information
	if planInfo, err := model.GetSubscriptionPlanInfoByUserSubscriptionId(res.UserSubscriptionId); err == nil && planInfo != nil {
		s.PlanId = planInfo.PlanId
		s.PlanTitle = planInfo.PlanTitle
	}
	return nil
}

func (s *SubscriptionFunding) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	return model.PostConsumeUserSubscriptionDelta(s.subscriptionId, int64(delta))
}

func (s *SubscriptionFunding) Refund() error {
	if s.preConsumed <= 0 {
		return nil
	}
	return refundWithRetry(func() error {
		return model.RefundSubscriptionPreConsume(s.requestId)
	})
}

// refundWithRetry attempts to perform a refund operation multiple times to improve the success rate and can only be used for transaction-based refund functions! ! ! ! ! !
// try to refund with retries, only for refund functions based on transactions!!!
func refundWithRetry(fn func() error) error {
	if fn == nil {
		return nil
	}
	const maxAttempts = 3
	var lastErr error
	for i := range maxAttempts {
		if err := fn(); err == nil {
			return nil
		} else {
			lastErr = err
		}
		if i < maxAttempts-1 {
			time.Sleep(time.Duration(200*(i+1)) * time.Millisecond)
		}
	}
	return lastErr
}
