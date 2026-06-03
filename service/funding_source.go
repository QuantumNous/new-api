package service

import (
	"time"

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
	userId         int
	requestId      string
	relatedType    string
	sourceSegments []model.UserQuotaSourceSegment
	consumed       int // 实际预扣的用户额度
}

func (w *WalletFunding) Source() string { return BillingSourceWallet }

func (w *WalletFunding) PreConsume(amount int) error {
	if amount <= 0 {
		return nil
	}
	segments, err := model.DecreaseUserQuotaWithSource(w.userId, amount, w.relatedType, w.requestId, w.requestId, "wallet pre-consume")
	if err != nil {
		return err
	}
	w.sourceSegments = append(w.sourceSegments, segments...)
	w.consumed = amount
	return nil
}

func (w *WalletFunding) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	if delta > 0 {
		segments, err := model.DecreaseUserQuotaWithSource(w.userId, delta, w.relatedType, w.requestId, w.requestId, "wallet settlement extra debit")
		if err != nil {
			return err
		}
		w.sourceSegments = append(w.sourceSegments, segments...)
		w.consumed += delta
		return nil
	}
	refundSegments, remainingSegments := splitRefundQuotaSourceSegments(w.sourceSegments, -delta)
	if err := model.IncreaseUserQuotaFromSourceSegments(w.userId, refundSegments, w.relatedType, w.requestId, w.requestId, "wallet settlement refund"); err != nil {
		return err
	}
	w.sourceSegments = remainingSegments
	w.consumed += delta
	if w.consumed < 0 {
		w.consumed = 0
	}
	return nil
}

func (w *WalletFunding) Refund() error {
	if w.consumed <= 0 {
		return nil
	}
	refundSegments, remainingSegments := splitRefundQuotaSourceSegments(w.sourceSegments, w.consumed)
	// IncreaseUserQuotaFromSourceSegments 是 quota += N 的非幂等操作，不能重试，否则会多退额度。
	// 订阅的 RefundSubscriptionPreConsume 有 requestId 幂等保护所以可以重试。
	if err := model.IncreaseUserQuotaFromSourceSegments(w.userId, refundSegments, w.relatedType, w.requestId, w.requestId, "wallet pre-consume refund"); err != nil {
		return err
	}
	w.sourceSegments = remainingSegments
	w.consumed = int(model.SumQuotaSourceSegments(remainingSegments).Total)
	return nil
}

func (w *WalletFunding) SourceBreakdown() model.UserQuotaSourceBreakdown {
	return model.SumQuotaSourceSegments(w.sourceSegments)
}

func splitRefundQuotaSourceSegments(segments []model.UserQuotaSourceSegment, amount int) ([]model.UserQuotaSourceSegment, []model.UserQuotaSourceSegment) {
	if amount <= 0 || len(segments) == 0 {
		return nil, append([]model.UserQuotaSourceSegment(nil), segments...)
	}
	remaining := append([]model.UserQuotaSourceSegment(nil), segments...)
	refund := make([]model.UserQuotaSourceSegment, 0, len(segments))
	left := int64(amount)
	for i := len(remaining) - 1; i >= 0 && left > 0; i-- {
		if remaining[i].Amount <= 0 {
			continue
		}
		take := remaining[i].Amount
		if take > left {
			take = left
		}
		refund = append(refund, model.UserQuotaSourceSegment{Source: remaining[i].Source, Amount: take})
		remaining[i].Amount -= take
		left -= take
	}
	if left > 0 {
		refund = append(refund, model.UserQuotaSourceSegment{Source: model.QuotaSourceLegacyUnknown, Amount: left})
	}
	cleanRemaining := make([]model.UserQuotaSourceSegment, 0, len(remaining))
	for _, segment := range remaining {
		if segment.Amount > 0 {
			cleanRemaining = append(cleanRemaining, segment)
		}
	}
	return refund, cleanRemaining
}

// ---------------------------------------------------------------------------
// SubscriptionFunding — 订阅资金来源实现
// ---------------------------------------------------------------------------

type SubscriptionFunding struct {
	requestId      string
	userId         int
	modelName      string
	amount         int64 // 预扣的订阅额度（subConsume）
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
	res, err := model.PreConsumeUserSubscription(s.requestId, s.userId, s.modelName, 0, s.amount)
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
