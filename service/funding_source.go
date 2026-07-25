package service

import (
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
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
	amount         int64   // 预扣的订阅额度（subConsume，list 等值，未加权）
	weight         float64 // 模型权重（全局权重表，缺省 1.0）；池/窗口扣量 = list × weight
	subscriptionId int
	preConsumed    int64                    // 实际预扣的池额度（加权后）
	extraWeighted  int64                    // Reserve 阶段追加预扣的池额度（加权后）
	windowGuard    *subscriptionWindowGuard // 窗口计数守卫（可能为 nil = 窗口未启用/fail-open）
	// 以下字段在 PreConsume 成功后填充，供 RelayInfo 同步使用
	AmountTotal     int64
	AmountUsedAfter int64
	PlanId          int
	PlanTitle       string
}

func (s *SubscriptionFunding) Source() string { return BillingSourceSubscription }

// weighted 把 list 等值额度换算为订阅池扣量（向上取整；负数对称处理，保证
// 同一数值的正负换算互为相反数，避免结算回补出现单向漂移）。
func (s *SubscriptionFunding) weighted(n int64) int64 {
	w := s.weight
	if w <= 0 || w == 1 {
		return n
	}
	if n >= 0 {
		return int64(math.Ceil(float64(n) * w))
	}
	return -int64(math.Ceil(float64(-n) * w))
}

func (s *SubscriptionFunding) PreConsume(_ int) error {
	// amount 参数被忽略，使用内部 s.amount（已在构造时根据 preConsumedQuota 计算）
	weightedAmount := s.weighted(s.amount)

	// ---- 窗口检查 + 原子预留（5h 滚动 + 周锚定周期）----
	// 预测本次将被扣费的订阅（与 PreConsumeUserSubscription 相同的选择逻辑：
	// end_time asc、跳过池余额不足的档），窗口按该订阅预留。
	windowInfo, err := model.GetChargeableSubscriptionWindowInfo(s.userId, weightedAmount)
	if err != nil {
		// 读取失败按 fail-open 处理，窗口不拦截；池扣费仍然照常
		common.SysLog("subscription window info query failed (fail-open): " + err.Error())
		windowInfo = nil
	}
	guard, windowErr := reserveSubscriptionWindows(windowInfo, weightedAmount)
	if windowErr != nil {
		return windowErr
	}

	res, err := model.PreConsumeUserSubscription(s.requestId, s.userId, s.modelName, 0, weightedAmount)
	if err != nil {
		guard.Release()
		return err
	}
	// 并发下实际扣费订阅仍可能与预测不符：释放旧守卫后必须对实际订阅重新
	// 预留并判限——直接放行会让付费档的 5h/周窗口被绕过（Free+付费并存是常态）。
	if guard != nil && res.UserSubscriptionId != guard.subId {
		guard.Release()
		guard = nil
	}
	if guard == nil {
		actualInfo, infoErr := model.GetSubscriptionWindowInfoBySubId(res.UserSubscriptionId)
		if infoErr != nil {
			common.SysLog("subscription window info re-query failed (fail-open): " + infoErr.Error())
		} else if actualInfo != nil {
			reGuard, reErr := reserveSubscriptionWindows(actualInfo, weightedAmount)
			if reErr != nil {
				// 实际扣费订阅的窗口已满：回滚池扣费并拒绝本次请求。
				// 回滚失败必须上抛为系统错误——此时池已扣但请求被拒，
				// 吞掉会造成静默少给用户额度（RefundSubscriptionPreConsume
				// 按 requestId 幂等，上层重试/人工补偿均可安全重放）。
				if refundErr := refundWithRetry(func() error {
					return model.RefundSubscriptionPreConsume(s.requestId)
				}); refundErr != nil {
					common.SysError("failed to refund subscription pre-consume after window rejection: " + refundErr.Error())
					return fmt.Errorf("subscription window rejected but pre-consume refund failed (request_id=%s): %w", s.requestId, refundErr)
				}
				return reErr
			}
			guard = reGuard
		}
	}
	s.windowGuard = guard
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
	weightedDelta := s.weighted(int64(delta))
	if err := model.PostConsumeUserSubscriptionDelta(s.subscriptionId, weightedDelta); err != nil {
		return err
	}
	s.windowGuard.Adjust(weightedDelta)
	return nil
}

func (s *SubscriptionFunding) Refund() error {
	if s.preConsumed <= 0 {
		return nil
	}
	err := refundWithRetry(func() error {
		return model.RefundSubscriptionPreConsume(s.requestId)
	})
	if err == nil {
		s.windowGuard.Release()
	}
	return err
}

// ReserveExtra 流式发送前追加预扣（billing_session.Reserve 路径）：
// 按权重扣池并同步窗口计数。窗口在追加阶段不再拦截（请求已在途），只累计。
func (s *SubscriptionFunding) ReserveExtra(delta int64) error {
	if delta <= 0 {
		return nil
	}
	weightedDelta := s.weighted(delta)
	if err := model.PostConsumeUserSubscriptionDelta(s.subscriptionId, weightedDelta); err != nil {
		return err
	}
	s.extraWeighted += weightedDelta
	s.windowGuard.Adjust(weightedDelta)
	return nil
}

// RollbackExtra 回滚 ReserveExtra（令牌预扣失败时）。
func (s *SubscriptionFunding) RollbackExtra(delta int64) error {
	if delta <= 0 {
		return nil
	}
	weightedDelta := s.weighted(delta)
	if err := model.PostConsumeUserSubscriptionDelta(s.subscriptionId, -weightedDelta); err != nil {
		return err
	}
	s.extraWeighted -= weightedDelta
	if s.extraWeighted < 0 {
		s.extraWeighted = 0
	}
	s.windowGuard.Adjust(-weightedDelta)
	return nil
}

// RefundExtra 退还追加预扣（请求失败退款路径）。
func (s *SubscriptionFunding) RefundExtra(delta int64) error {
	return s.RollbackExtra(delta)
}

// ExtraWeighted 返回追加预扣的池额度（加权后），供日志/RelayInfo 展示。
func (s *SubscriptionFunding) ExtraWeighted() int64 { return s.extraWeighted }

// Weight 返回本次请求的模型权重快照（池/窗口扣量 = list × weight）。
func (s *SubscriptionFunding) Weight() float64 { return s.weight }

// WindowSnapshot 导出窗口守卫台账（窗口未启用/已释放时为 nil），
// 供异步任务持久化后在轮询阶段做窗口补偿。
func (s *SubscriptionFunding) WindowSnapshot() *model.TaskSubscriptionWindow {
	return s.windowGuard.Snapshot()
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
