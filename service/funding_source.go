package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

// ---------------------------------------------------------------------------
// FundingSource — 资金来源接口（钱包 or 订阅）
// ---------------------------------------------------------------------------

// FundingSource 抽象了预扣费的资金来源。
type FundingSource interface {
	// Source 返回资金来源标识："wallet" 或 "subscription"
	Source() string
	// PreConsume 从该资金来源预扣 amount 额度
	PreConsume(amount int) error
	// Settle 根据差额调整资金来源（正数补扣，负数退还）
	Settle(delta int) error
	// Refund 退还所有预扣费
	Refund() error
}

// ---------------------------------------------------------------------------
// WalletFunding — 钱包资金来源实现
// ---------------------------------------------------------------------------

type WalletFunding struct {
	userId   int
	consumed int // 实际预扣的用户额度
}

func (w *WalletFunding) Source() string { return BillingSourceWallet }

func (w *WalletFunding) PreConsume(amount int) error {
	if amount <= 0 {
		return nil
	}
	if err := model.DecreaseUserQuota(w.userId, amount, false); err != nil {
		return err
	}
	w.consumed = amount
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
	// IncreaseUserQuota 是 quota += N 的非幂等操作，不能重试，否则会多退额度。
	// 订阅的 RefundSubscriptionPreConsume 有 requestId 幂等保护所以可以重试。
	return model.IncreaseUserQuota(w.userId, w.consumed, false)
}

// ---------------------------------------------------------------------------
// SubscriptionFunding — 订阅资金来源实现
// ---------------------------------------------------------------------------

type SubscriptionFunding struct {
	requestId      string
	userId         int
	modelName      string
	group          string // relay model group for allowed_groups check
	amount         int64  // 预扣的订阅额度（subConsume）
	subscriptionId int
	preConsumed    int64
	// 以下字段在 PreConsume 成功后填充，供 RelayInfo 同步使用
	AmountTotal     int64
	AmountUsedAfter int64
	PlanId          int
	PlanTitle       string
}

func (s *SubscriptionFunding) Source() string { return BillingSourceSubscription }

func (s *SubscriptionFunding) PreConsume(_ int) error {
	// amount 参数被忽略，使用内部 s.amount（已在构造时根据 preConsumedQuota 计算）
	res, err := model.PreConsumeUserSubscription(s.requestId, s.userId, s.modelName, 0, s.amount, s.group)
	if err != nil {
		return err
	}
	s.subscriptionId = res.UserSubscriptionId
	s.preConsumed = res.PreConsumed
	s.AmountTotal = res.AmountTotal
	s.AmountUsedAfter = res.AmountUsedAfter
	// 获取订阅计划信息
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
	return model.AdjustSubscriptionPreConsume(s.requestId, s.userId, int64(delta), s.group)
}

func (s *SubscriptionFunding) Refund() error {
	if s.preConsumed <= 0 {
		return nil
	}
	return refundWithRetry(func() error {
		return model.RefundSubscriptionPreConsume(s.requestId)
	})
}

// ---------------------------------------------------------------------------
// HybridFunding — subscription-first with wallet fallback for the remainder
// ---------------------------------------------------------------------------

type HybridFunding struct {
	subscription          *SubscriptionFunding
	wallet                *WalletFunding
	lastSubscriptionDelta int64
}

func (h *HybridFunding) Source() string {
	if h == nil {
		return BillingSourceHybrid
	}
	hasSubscription := h.subscription != nil && h.subscription.preConsumed > 0
	hasWallet := h.wallet != nil && h.wallet.consumed > 0
	if hasSubscription && hasWallet {
		return BillingSourceHybrid
	}
	if hasSubscription {
		return BillingSourceSubscription
	}
	return BillingSourceWallet
}

func (h *HybridFunding) PreConsume(amount int) error {
	if amount <= 0 {
		return nil
	}
	if h.subscription == nil || h.wallet == nil {
		return fmt.Errorf("hybrid funding is not initialized")
	}

	res, err := model.PreConsumeUserSubscriptionPartial(h.subscription.requestId, h.subscription.userId, h.subscription.modelName, 0, int64(amount), h.subscription.group)
	if err != nil && !isSubscriptionQuotaUnavailable(err) {
		return err
	}
	if err == nil && res != nil && res.PreConsumed > 0 {
		h.subscription.subscriptionId = res.UserSubscriptionId
		h.subscription.preConsumed = res.PreConsumed
		h.subscription.AmountTotal = res.AmountTotal
		h.subscription.AmountUsedAfter = res.AmountUsedAfter
		if planInfo, planErr := model.GetSubscriptionPlanInfoByUserSubscriptionId(res.UserSubscriptionId); planErr == nil && planInfo != nil {
			h.subscription.PlanId = planInfo.PlanId
			h.subscription.PlanTitle = planInfo.PlanTitle
		}
	}

	walletAmount := amount - int(h.subscription.preConsumed)
	if walletAmount <= 0 {
		return nil
	}
	if err := ensureWalletQuota(h.wallet.userId, walletAmount); err != nil {
		if h.subscription.preConsumed > 0 {
			_ = model.RefundSubscriptionPreConsume(h.subscription.requestId)
			h.subscription.preConsumed = 0
		}
		return err
	}
	if err := model.DecreaseUserQuota(h.wallet.userId, walletAmount, false); err != nil {
		if h.subscription.preConsumed > 0 {
			_ = model.RefundSubscriptionPreConsume(h.subscription.requestId)
			h.subscription.preConsumed = 0
		}
		return err
	}
	h.wallet.consumed = walletAmount
	return nil
}

func (h *HybridFunding) Settle(delta int) error {
	h.lastSubscriptionDelta = 0
	if delta == 0 {
		return nil
	}
	if h.subscription == nil || h.wallet == nil {
		return fmt.Errorf("hybrid funding is not initialized")
	}
	if delta > 0 {
		subDelta, err := model.AdjustSubscriptionPreConsumePartial(h.subscription.requestId, h.subscription.userId, int64(delta), h.subscription.group)
		if err != nil {
			return err
		}
		h.subscription.preConsumed += subDelta
		h.lastSubscriptionDelta = subDelta
		walletDelta := delta - int(subDelta)
		if walletDelta <= 0 {
			return nil
		}
		if err := ensureWalletQuota(h.wallet.userId, walletDelta); err != nil {
			if rollbackErr := h.rollbackSubscriptionDelta(subDelta); rollbackErr != nil {
				return fmt.Errorf("%v; rollback subscription delta failed: %w", err, rollbackErr)
			}
			return err
		}
		if err := model.DecreaseUserQuota(h.wallet.userId, walletDelta, false); err != nil {
			if rollbackErr := h.rollbackSubscriptionDelta(subDelta); rollbackErr != nil {
				return fmt.Errorf("%v; rollback subscription delta failed: %w", err, rollbackErr)
			}
			return err
		}
		h.wallet.consumed += walletDelta
		return nil
	}

	refund := -delta
	walletRefund := refund
	if walletRefund > h.wallet.consumed {
		walletRefund = h.wallet.consumed
	}
	if walletRefund > 0 {
		if err := model.IncreaseUserQuota(h.wallet.userId, walletRefund, false); err != nil {
			return err
		}
		h.wallet.consumed -= walletRefund
		refund -= walletRefund
	}
	if refund <= 0 {
		return nil
	}
	if err := model.AdjustSubscriptionPreConsume(h.subscription.requestId, h.subscription.userId, -int64(refund), h.subscription.group); err != nil {
		return err
	}
	h.subscription.preConsumed -= int64(refund)
	if h.subscription.preConsumed < 0 {
		h.subscription.preConsumed = 0
	}
	h.lastSubscriptionDelta = -int64(refund)
	return nil
}

func (h *HybridFunding) rollbackSubscriptionDelta(delta int64) error {
	if delta <= 0 || h.subscription == nil {
		return nil
	}
	if err := model.AdjustSubscriptionPreConsume(h.subscription.requestId, h.subscription.userId, -delta, h.subscription.group); err != nil {
		return err
	}
	h.subscription.preConsumed -= delta
	if h.subscription.preConsumed < 0 {
		h.subscription.preConsumed = 0
	}
	h.lastSubscriptionDelta = 0
	return nil
}

func (h *HybridFunding) Refund() error {
	if h.subscription != nil && h.subscription.preConsumed > 0 {
		if err := h.subscription.Refund(); err != nil {
			return err
		}
	}
	if h.wallet != nil && h.wallet.consumed > 0 {
		return h.wallet.Refund()
	}
	return nil
}

func isSubscriptionQuotaUnavailable(err error) bool {
	if err == nil {
		return false
	}
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "no active subscription") || strings.Contains(errMsg, "subscription quota insufficient")
}

func ensureWalletQuota(userId int, amount int) error {
	quota, err := model.GetUserQuota(userId, false)
	if err != nil {
		return err
	}
	if quota < amount {
		return fmt.Errorf("用户额度不足, 剩余额度: %s, 需要预扣费额度: %s", logger.FormatQuota(quota), logger.FormatQuota(amount))
	}
	return nil
}

// refundWithRetry 尝试多次执行退款操作以提高成功率，只能用于基于事务的退款函数！！！！！！
// try to refund with retries, only for refund functions based on transactions!!!
func refundWithRetry(fn func() error) error {
	if fn == nil {
		return nil
	}
	const maxAttempts = 3
	var lastErr error
	for i := 0; i < maxAttempts; i++ {
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
