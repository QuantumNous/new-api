package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
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
	userId       int
	consumed     int                  // 冗余镜像 = sumFree(fromFree)+fromRecharge，供外部读取（WalletQuotaDeducted 等）
	fromFree     []model.LedgerDeduct // 命中的免费明细扣减记录（原路退款依据）
	fromRecharge int                  // 充值钱包扣减量
}

func (w *WalletFunding) Source() string { return BillingSourceWallet }

// FreeConsumed 返回免费钱包扣减总额。
func (w *WalletFunding) FreeConsumed() int { return sumFree(w.fromFree) }

// RechargeConsumed 返回充值钱包扣减总额。
func (w *WalletFunding) RechargeConsumed() int { return w.fromRecharge }

// FreeDeducts 返回免费钱包扣减明细的副本（供 relayInfo 保存，退款原路复原用）。
func (w *WalletFunding) FreeDeducts() []model.LedgerDeduct {
	if len(w.fromFree) == 0 {
		return nil
	}
	out := make([]model.LedgerDeduct, len(w.fromFree))
	copy(out, w.fromFree)
	return out
}

// sumFree 汇总免费明细扣减量。
func sumFree(ds []model.LedgerDeduct) int {
	s := 0
	for _, d := range ds {
		s += d.Amount
	}
	return s
}

// mergeFree 把 add 合并进 base（同 LedgerId 累加 Amount，避免账本条目膨胀）。
func mergeFree(base, add []model.LedgerDeduct) []model.LedgerDeduct {
	for _, d := range add {
		if d.Amount <= 0 {
			continue
		}
		found := false
		for i := range base {
			if base[i].LedgerId == d.LedgerId {
				base[i].Amount += d.Amount
				found = true
				break
			}
		}
		if !found {
			base = append(base, d)
		}
	}
	return base
}

// subtractFree 从 base 中按 LedgerId 逐条扣减 sub 的 Amount，归零的条目移除。
func subtractFree(base, sub []model.LedgerDeduct) []model.LedgerDeduct {
	for _, s := range sub {
		for i := range base {
			if base[i].LedgerId == s.LedgerId {
				base[i].Amount -= s.Amount
				break
			}
		}
	}
	out := base[:0]
	for _, d := range base {
		if d.Amount > 0 {
			out = append(out, d)
		}
	}
	return out
}

// deduct 三级扣减 amount 并合并进账本。余额不足时对差额透支充值钱包
// （ConsumeQuotaWithOverdraft 内部单事务处理），保持"结算补扣允许透支"的语义。
func (w *WalletFunding) deduct(amount int) error {
	if amount <= 0 {
		return nil
	}
	fromFree, fromRecharge, err := model.ConsumeQuotaWithOverdraft(w.userId, amount)
	if err != nil {
		return err
	}
	w.fromFree = mergeFree(w.fromFree, fromFree)
	w.fromRecharge += fromRecharge
	w.consumed += sumFree(fromFree) + fromRecharge
	return nil
}

// refund 按原始扣款比例原路退款：免费钱包与充值钱包各按其占总扣款的比例获得退款。
// 免费明细内部按 LIFO 分配（先退最近扣的永久额度，后退较早扣的会过期额度）。
func (w *WalletFunding) refund(refundAmount int) error {
	if refundAmount <= 0 {
		return nil
	}
	if refundAmount > w.consumed {
		refundAmount = w.consumed
	}
	refundFree, refundRecharge := calcLIFORefund(w.fromFree, w.fromRecharge, refundAmount)
	if refundRecharge == 0 && len(refundFree) == 0 {
		return nil
	}
	if err := model.RefundQuota(w.userId, refundFree, refundRecharge); err != nil {
		return err
	}
	// 退款成功后才更新账本，保证失败可重入
	w.fromRecharge -= refundRecharge
	w.fromFree = subtractFree(w.fromFree, refundFree)
	w.consumed -= refundRecharge + sumFree(refundFree)
	return nil
}

// calcLIFORefund 按原始扣款比例分配退款额度，免费明细按 LIFO 分配（先退最近扣的）。
// 供 WalletFunding.refund 与 PostConsumeQuota 退款路径共用。
func calcLIFORefund(fromFree []model.LedgerDeduct, fromRecharge int, refundAmount int) (refundFree []model.LedgerDeduct, refundRecharge int) {
	if refundAmount <= 0 {
		return nil, 0
	}
	totalDeducted := sumFree(fromFree) + fromRecharge
	if totalDeducted <= 0 {
		return nil, 0
	}
	if refundAmount > totalDeducted {
		refundAmount = totalDeducted
	}

	// 按原始扣款比例分配
	if fromRecharge > 0 {
		refundRecharge = refundAmount * fromRecharge / totalDeducted
	}
	freeRefund := refundAmount - refundRecharge

	// 免费明细按 LIFO 分配
	for i := len(fromFree) - 1; i >= 0 && freeRefund > 0; i-- {
		d := fromFree[i]
		if d.Amount <= 0 {
			continue
		}
		take := d.Amount
		if take > freeRefund {
			take = freeRefund
		}
		refundFree = append(refundFree, model.LedgerDeduct{
			LedgerId:    d.LedgerId,
			ExpiredTime: d.ExpiredTime,
			Amount:      take,
		})
		freeRefund -= take
	}
	// 整数取整导致的余数归还到充值钱包
	if freeRefund > 0 {
		refundRecharge += freeRefund
	}
	return refundFree, refundRecharge
}

func (w *WalletFunding) PreConsume(amount int) error {
	if amount <= 0 {
		return nil
	}
	// 预扣有门禁（ensureWalletQuota / tryWallet），正常不会透支；deduct 兜底透支逻辑仅补扣才会触发。
	return w.deduct(amount)
}

func (w *WalletFunding) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	if delta > 0 {
		return w.deduct(delta) // 补扣：允许透支
	}
	return w.refund(-delta) // 退还：先充值再免费 LIFO
}

func (w *WalletFunding) Refund() error {
	if w.consumed <= 0 {
		return nil
	}
	// RefundQuota 与旧 IncreaseUserQuota 一样是非幂等累加，不能 retry。
	if err := model.RefundQuota(w.userId, w.fromFree, w.fromRecharge); err != nil {
		return err
	}
	// 退完清空账本，防止重复退。
	w.fromFree = nil
	w.fromRecharge = 0
	w.consumed = 0
	return nil
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
	if delta > 0 {
		// 先尽量从订阅扣，不够的部分扣余额兜底
		subDelta, err := model.AdjustSubscriptionPreConsumePartial(s.requestId, s.userId, int64(delta), s.group)
		if err != nil {
			return err
		}
		s.preConsumed += subDelta
		walletDelta := delta - int(subDelta)
		if walletDelta <= 0 {
			return nil
		}
		w := &WalletFunding{userId: s.userId}
		if err := ensureWalletQuota(s.userId, walletDelta); err != nil {
			if rbErr := model.AdjustSubscriptionPreConsume(s.requestId, s.userId, -subDelta, s.group); rbErr != nil {
				common.SysLog(fmt.Sprintf("FATAL: rollback subscription settle failed (requestId=%s, userId=%d, subDelta=%d, err=%v, rbErr=%v)",
					s.requestId, s.userId, subDelta, err, rbErr))
				return fmt.Errorf("%v; rollback subscription delta failed: %w", err, rbErr)
			}
			s.preConsumed -= subDelta
			return err
		}
		if err := w.deduct(walletDelta); err != nil {
			if rbErr := model.AdjustSubscriptionPreConsume(s.requestId, s.userId, -subDelta, s.group); rbErr != nil {
				common.SysLog(fmt.Sprintf("FATAL: rollback subscription settle failed (requestId=%s, userId=%d, subDelta=%d, err=%v, rbErr=%v)",
					s.requestId, s.userId, subDelta, err, rbErr))
				return fmt.Errorf("%v; rollback subscription delta failed: %w", err, rbErr)
			}
			s.preConsumed -= subDelta
			return err
		}
		return nil
	}
	// delta < 0: 退款
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
	if err := h.wallet.deduct(walletAmount); err != nil {
		if h.subscription.preConsumed > 0 {
			_ = model.RefundSubscriptionPreConsume(h.subscription.requestId)
			h.subscription.preConsumed = 0
		}
		return err
	}
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
		if err := h.wallet.deduct(walletDelta); err != nil {
			if rollbackErr := h.rollbackSubscriptionDelta(subDelta); rollbackErr != nil {
				return fmt.Errorf("%v; rollback subscription delta failed: %w", err, rollbackErr)
			}
			return err
		}
		return nil
	}

	refund := -delta
	walletRefund := refund
	if walletRefund > h.wallet.consumed {
		walletRefund = h.wallet.consumed
	}
	if walletRefund > 0 {
		// 委托 WalletFunding.refund：先充值再免费 LIFO，原路返回。
		if err := h.wallet.refund(walletRefund); err != nil {
			return err
		}
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
	// 双钱包拆分：钱包可用额度 = 充值钱包 + 免费钱包（总可用额度）。
	quota, err := model.GetUserTotalQuota(userId, false)
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
