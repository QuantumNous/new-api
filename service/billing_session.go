package service

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// BillingSession — 统一计费会话
// ---------------------------------------------------------------------------

// BillingSession 封装单次请求的预扣费/结算/退款生命周期。
// 实现 relaycommon.BillingSettler 接口。
type BillingSession struct {
	relayInfo        *relaycommon.RelayInfo
	funding          FundingSource
	preConsumedQuota int  // 实际预扣额度（信任用户可能为 0）
	tokenConsumed    int  // 令牌额度实际扣减量
	extraReserved    int  // 发送前补充预扣的额度（订阅退款时需要单独回滚）
	trusted          bool // 是否命中信任额度旁路
	fundingSettled   bool // funding.Settle 已成功，资金来源已提交
	settled          bool // Settle 全部完成（资金 + 令牌）
	refunded         bool // Refund 已调用
	mu               sync.Mutex
}

// adjustmentSpecs translates usage deltas into durable balance mutations.
// Positive usage consumes quota; wallet/token balances therefore receive the
// opposite signed delta while subscription amount_used receives it directly.
func (s *BillingSession) adjustmentSpecs(phase string, fundingUsageDelta int, tokenUsageDelta int) ([]model.BillingAdjustmentSpec, error) {
	if s.relayInfo == nil {
		return nil, errors.New("billing adjustment request id is required")
	}
	if s.relayInfo.RequestId == "" {
		s.relayInfo.RequestId = common.NewRequestId()
	}
	specs := make([]model.BillingAdjustmentSpec, 0, 2)
	if fundingUsageDelta != 0 {
		switch funding := s.funding.(type) {
		case *WalletFunding:
			specs = append(specs, model.BillingAdjustmentSpec{
				RequestID: s.relayInfo.RequestId,
				Phase:     phase,
				Leg:       model.BillingAdjustmentLegWallet,
				UserID:    funding.userId,
				Delta:     -int64(fundingUsageDelta),
			})
		case *SubscriptionFunding:
			specs = append(specs, model.BillingAdjustmentSpec{
				RequestID:      s.relayInfo.RequestId,
				Phase:          phase,
				Leg:            model.BillingAdjustmentLegSubscription,
				UserID:         funding.userId,
				SubscriptionID: funding.subscriptionId,
				Delta:          int64(fundingUsageDelta),
			})
		default:
			return nil, fmt.Errorf("unsupported funding source: %s", s.funding.Source())
		}
	}
	if tokenUsageDelta != 0 && !s.relayInfo.IsPlayground {
		specs = append(specs, model.BillingAdjustmentSpec{
			RequestID: s.relayInfo.RequestId,
			Phase:     phase,
			Leg:       model.BillingAdjustmentLegToken,
			UserID:    s.relayInfo.UserId,
			TokenID:   s.relayInfo.TokenId,
			Delta:     -int64(tokenUsageDelta),
		})
	}
	return specs, nil
}

// Settle 根据实际消耗额度进行结算。
// 资金来源和令牌额度分两步提交：若资金来源已提交但令牌调整失败，
// 会标记 fundingSettled 防止 Refund 对已提交的资金来源执行退款。
func (s *BillingSession) Settle(actualQuota int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.settled {
		return nil
	}
	delta := actualQuota - s.preConsumedQuota
	if delta == 0 {
		s.settled = true
		return nil
	}
	if s.relayInfo.BillingReservationTaskID == "" {
		specs, err := s.adjustmentSpecs(model.BillingAdjustmentPhaseSettle, delta, delta)
		if err != nil {
			return err
		}
		if err := enqueueBillingAdjustments(specs); err != nil {
			return fmt.Errorf("enqueue billing settlement: %w", err)
		}
		s.fundingSettled = true
		if s.funding.Source() == BillingSourceSubscription {
			s.relayInfo.SubscriptionPostDelta += int64(delta)
		}
		s.settled = true
		return nil
	}
	// 1) 调整资金来源（仅在尚未提交时执行，防止重复调用）
	if !s.fundingSettled {
		if err := s.funding.Settle(delta); err != nil {
			return err
		}
		s.fundingSettled = true
	}
	// 2) 调整令牌额度
	var tokenErr error
	if !s.relayInfo.IsPlayground {
		if delta > 0 {
			tokenErr = s.decreaseTokenQuota(delta)
		} else {
			tokenErr = s.increaseTokenQuota(-delta)
		}
		if tokenErr != nil {
			// 资金来源已提交，令牌调整失败只能记录日志；标记 settled 防止 Refund 误退资金
			common.SysLog(fmt.Sprintf("error adjusting token quota after funding settled (userId=%d, tokenId=%d, delta=%d): %s",
				s.relayInfo.UserId, s.relayInfo.TokenId, delta, tokenErr.Error()))
		}
	}
	// 3) 更新 relayInfo 上的订阅 PostDelta（用于日志）
	if s.funding.Source() == BillingSourceSubscription {
		s.relayInfo.SubscriptionPostDelta += int64(delta)
	}
	s.settled = true
	return tokenErr
}

// Refund 退还所有预扣费，幂等安全，异步执行。
func (s *BillingSession) Refund(c *gin.Context) {
	s.mu.Lock()
	if s.settled || s.refunded || !s.needsRefundLocked() {
		s.mu.Unlock()
		return
	}
	if s.relayInfo.BillingReservationTaskID == "" {
		fundingUsageDelta := 0
		switch funding := s.funding.(type) {
		case *WalletFunding:
			fundingUsageDelta = -funding.consumed
		case *SubscriptionFunding:
			totalReserved := funding.preConsumed + int64(s.extraReserved)
			if totalReserved > int64(common.MaxQuota) {
				common.SysError(fmt.Sprintf("billing refund exceeds quota range: request_id=%s amount=%d", s.relayInfo.RequestId, totalReserved))
				s.mu.Unlock()
				return
			}
			fundingUsageDelta = -int(totalReserved)
		default:
			common.SysError("unsupported billing source during refund: " + s.funding.Source())
			s.mu.Unlock()
			return
		}
		tokenUsageDelta := -s.tokenConsumed
		specs, err := s.adjustmentSpecs(model.BillingAdjustmentPhaseRefund, fundingUsageDelta, tokenUsageDelta)
		if err != nil {
			common.SysError("build billing refund outbox: " + err.Error())
			s.mu.Unlock()
			return
		}
		if err := enqueueBillingAdjustments(specs); err != nil {
			common.SysError("enqueue billing refund: " + err.Error())
			s.mu.Unlock()
			return
		}
		s.refunded = true
		s.mu.Unlock()
		logger.LogInfo(c, fmt.Sprintf("用户 %d 请求失败, 已持久化返还预扣费（token_quota=%s, funding=%s）",
			s.relayInfo.UserId,
			logger.FormatQuota(s.tokenConsumed),
			s.funding.Source(),
		))
		return
	}
	s.refunded = true
	s.mu.Unlock()

	logger.LogInfo(c, fmt.Sprintf("用户 %d 请求失败, 返还预扣费（token_quota=%s, funding=%s）",
		s.relayInfo.UserId,
		logger.FormatQuota(s.tokenConsumed),
		s.funding.Source(),
	))

	// 复制需要的值到闭包中
	tokenId := s.relayInfo.TokenId
	tokenKey := s.relayInfo.TokenKey
	isPlayground := s.relayInfo.IsPlayground
	tokenConsumed := s.tokenConsumed
	extraReserved := s.extraReserved
	subscriptionId := s.relayInfo.SubscriptionId
	funding := s.funding

	refund := func() {
		// 1) 退还资金来源
		if err := funding.Refund(); err != nil {
			common.SysLog("error refunding billing source: " + err.Error())
		}
		if extraReserved > 0 && funding.Source() == BillingSourceSubscription && subscriptionId > 0 {
			if err := model.PostConsumeUserSubscriptionDelta(subscriptionId, -int64(extraReserved)); err != nil {
				common.SysLog("error refunding subscription extra reserved quota: " + err.Error())
			}
		}
		// 2) 退还令牌额度
		if tokenConsumed > 0 && !isPlayground {
			var err error
			if s.relayInfo.BillingReservationTaskID != "" {
				err = model.RefundImageTaskTokenQuota(s.relayInfo.BillingReservationTaskID, tokenId, tokenKey)
			} else if s.relayInfo.ForcePreConsume {
				err = model.IncreaseTokenQuotaDirect(tokenId, tokenKey, tokenConsumed)
			} else {
				err = model.IncreaseTokenQuota(tokenId, tokenKey, tokenConsumed)
			}
			if err != nil {
				common.SysLog("error refunding token quota: " + err.Error())
			}
		}
	}
	if s.relayInfo.ForcePreConsume {
		refund()
	} else {
		gopool.Go(refund)
	}
}

// NeedsRefund 返回是否存在需要退还的预扣状态。
func (s *BillingSession) NeedsRefund() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.needsRefundLocked()
}

func (s *BillingSession) needsRefundLocked() bool {
	if s.settled || s.refunded || s.fundingSettled {
		// fundingSettled 时资金来源已提交结算，不能再退预扣费
		return false
	}
	if s.tokenConsumed > 0 {
		return true
	}
	// 订阅可能在 tokenConsumed=0 时仍预扣了额度
	if sub, ok := s.funding.(*SubscriptionFunding); ok && sub.preConsumed > 0 {
		return true
	}
	return false
}

// GetPreConsumedQuota 返回实际预扣的额度。
func (s *BillingSession) GetPreConsumedQuota() int {
	return s.preConsumedQuota
}

func (s *BillingSession) Reserve(targetQuota int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.settled || s.refunded || s.trusted || targetQuota <= s.preConsumedQuota {
		return nil
	}

	delta := targetQuota - s.preConsumedQuota
	if delta <= 0 {
		return nil
	}

	if err := s.reserveFunding(delta); err != nil {
		return err
	}
	if err := s.reserveToken(delta); err != nil {
		if rollbackErr := s.rollbackFundingReserve(delta); rollbackErr != nil {
			return fmt.Errorf("%w; funding rollback enqueue failed: %v", err, rollbackErr)
		}
		return err
	}

	s.preConsumedQuota += delta
	s.tokenConsumed += delta
	s.extraReserved += delta
	s.syncRelayInfo()
	return nil
}

// ---------------------------------------------------------------------------
// PreConsume — 统一预扣费入口（含信任额度旁路）
// ---------------------------------------------------------------------------

// preConsume 执行预扣费：信任检查 -> 令牌预扣 -> 资金来源预扣。
// 任一步骤失败时原子回滚已完成的步骤。
func (s *BillingSession) preConsume(c *gin.Context, quota int) *types.NewAPIError {
	effectiveQuota := quota

	// ---- 信任额度旁路 ----
	if s.shouldTrust(c) {
		s.trusted = true
		effectiveQuota = 0
		logger.LogInfo(c, fmt.Sprintf("用户 %d 额度充足, 信任且不需要预扣费 (funding=%s)", s.relayInfo.UserId, s.funding.Source()))
	} else if effectiveQuota > 0 {
		logger.LogInfo(c, fmt.Sprintf("用户 %d 需要预扣费 %s (funding=%s)", s.relayInfo.UserId, logger.FormatQuota(effectiveQuota), s.funding.Source()))
	}

	// ---- 1) 预扣令牌额度 ----
	if effectiveQuota > 0 {
		if err := PreConsumeTokenQuota(s.relayInfo, effectiveQuota); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodePreConsumeTokenQuotaFailed, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		s.tokenConsumed = effectiveQuota
	}

	// ---- 2) 预扣资金来源 ----
	if err := s.funding.PreConsume(effectiveQuota); err != nil {
		// 预扣费失败，回滚令牌额度
		if s.tokenConsumed > 0 && !s.relayInfo.IsPlayground {
			var rollbackErr error
			if s.relayInfo.BillingReservationTaskID == "" {
				specs, specErr := s.adjustmentSpecs(model.BillingAdjustmentPhasePreConsumeRollback, 0, -s.tokenConsumed)
				if specErr != nil {
					rollbackErr = specErr
				} else {
					rollbackErr = enqueueBillingAdjustments(specs)
				}
			} else {
				rollbackErr = s.increaseTokenQuota(s.tokenConsumed)
			}
			if rollbackErr != nil {
				common.SysLog(fmt.Sprintf("error durably rolling back token quota (userId=%d, tokenId=%d, amount=%d, fundingErr=%s): %s",
					s.relayInfo.UserId, s.relayInfo.TokenId, s.tokenConsumed, err.Error(), rollbackErr.Error()))
				err = fmt.Errorf("%w; token rollback enqueue failed: %v", err, rollbackErr)
			} else {
				s.tokenConsumed = 0
			}
		}
		if errors.Is(err, model.ErrImageBillingReservationQuotaInsufficient) {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		// TODO: model 层应定义订阅哨兵错误（如 ErrNoActiveSubscription），用 errors.Is 替代字符串匹配
		errMsg := err.Error()
		if strings.Contains(errMsg, "no active subscription") || strings.Contains(errMsg, "subscription quota insufficient") {
			return types.NewErrorWithStatusCode(fmt.Errorf("订阅额度不足或未配置订阅: %s", errMsg), types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}

	s.preConsumedQuota = effectiveQuota

	// ---- 同步 RelayInfo 兼容字段 ----
	s.syncRelayInfo()

	return nil
}

func (s *BillingSession) reserveFunding(delta int) error {
	switch funding := s.funding.(type) {
	case *WalletFunding:
		var err error
		if funding.direct {
			err = model.DecreaseUserQuotaDirect(funding.userId, delta)
		} else {
			err = model.DecreaseUserQuota(funding.userId, delta, false)
		}
		if err != nil {
			return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
		}
		funding.consumed += delta
		return nil
	case *SubscriptionFunding:
		if err := model.PostConsumeUserSubscriptionDelta(funding.subscriptionId, int64(delta)); err != nil {
			return types.NewErrorWithStatusCode(
				fmt.Errorf("订阅额度不足或未配置订阅: %s", err.Error()),
				types.ErrorCodeInsufficientUserQuota,
				http.StatusForbidden,
				types.ErrOptionWithSkipRetry(),
				types.ErrOptionWithNoRecordErrorLog(),
			)
		}
		return nil
	default:
		return types.NewError(fmt.Errorf("unsupported funding source: %s", s.funding.Source()), types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
}

func (s *BillingSession) rollbackFundingReserve(delta int) error {
	if s.relayInfo.BillingReservationTaskID == "" {
		specs, err := s.adjustmentSpecs(model.BillingAdjustmentPhaseReserveRollback, -delta, 0)
		if err != nil {
			return err
		}
		if err := enqueueBillingAdjustments(specs); err != nil {
			return err
		}
		if funding, ok := s.funding.(*WalletFunding); ok {
			funding.consumed -= delta
		}
		return nil
	}
	switch funding := s.funding.(type) {
	case *WalletFunding:
		var err error
		if funding.direct {
			err = model.IncreaseUserQuotaDirect(funding.userId, delta)
		} else {
			err = model.IncreaseUserQuota(funding.userId, delta, false)
		}
		if err != nil {
			common.SysLog("error rolling back wallet funding reserve: " + err.Error())
			return err
		}
		funding.consumed -= delta
		return nil
	case *SubscriptionFunding:
		if err := model.PostConsumeUserSubscriptionDelta(funding.subscriptionId, -int64(delta)); err != nil {
			common.SysLog("error rolling back subscription funding reserve: " + err.Error())
			return err
		}
		return nil
	default:
		return fmt.Errorf("unsupported funding source: %s", s.funding.Source())
	}
}

func (s *BillingSession) reserveToken(delta int) error {
	if delta <= 0 || s.relayInfo.IsPlayground {
		return nil
	}
	if err := PreConsumeTokenQuota(s.relayInfo, delta); err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodePreConsumeTokenQuotaFailed, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
	}
	return nil
}

func (s *BillingSession) increaseTokenQuota(quota int) error {
	if s.relayInfo.BillingReservationTaskID != "" {
		return model.RefundImageTaskTokenQuota(s.relayInfo.BillingReservationTaskID, s.relayInfo.TokenId, s.relayInfo.TokenKey)
	}
	if s.relayInfo.ForcePreConsume {
		return model.IncreaseTokenQuotaDirect(s.relayInfo.TokenId, s.relayInfo.TokenKey, quota)
	}
	return model.IncreaseTokenQuota(s.relayInfo.TokenId, s.relayInfo.TokenKey, quota)
}

func (s *BillingSession) decreaseTokenQuota(quota int) error {
	if s.relayInfo.ForcePreConsume {
		return model.DecreaseTokenQuotaDirect(s.relayInfo.TokenId, s.relayInfo.TokenKey, quota)
	}
	return model.DecreaseTokenQuota(s.relayInfo.TokenId, s.relayInfo.TokenKey, quota)
}

// shouldTrust 统一信任额度检查，适用于钱包和订阅。
func (s *BillingSession) shouldTrust(c *gin.Context) bool {
	// 异步任务（ForcePreConsume=true）必须预扣全额，不允许信任旁路
	if s.relayInfo.ForcePreConsume {
		return false
	}

	trustQuota := common.GetTrustQuota()
	if trustQuota <= 0 {
		return false
	}

	// Cached quota is only a fast negative filter. A failed Redis invalidation
	// can leave an older high value behind, so the trust bypass must always be
	// granted from durable token and wallet rows.
	if !s.relayInfo.TokenUnlimited && c.GetInt("token_quota") <= trustQuota {
		return false
	}

	if s.funding.Source() == BillingSourceSubscription {
		// 订阅不能启用信任旁路。原因：
		// 1. PreConsumeUserSubscription 要求 amount>0 来创建预扣记录并锁定订阅
		// 2. SubscriptionFunding.PreConsume 忽略参数，始终用 s.amount 预扣
		// 3. 若信任旁路将 effectiveQuota 设为 0，会导致 preConsumedQuota 与实际订阅预扣不一致
		return false
	}
	if s.funding.Source() != BillingSourceWallet || s.relayInfo.UserQuota <= trustQuota {
		return false
	}

	token, err := model.GetTokenByKey(s.relayInfo.TokenKey, true)
	if err != nil || token == nil || token.Status != common.TokenStatusEnabled {
		return false
	}
	if !token.UnlimitedQuota && token.RemainQuota <= trustQuota {
		return false
	}

	userQuota, err := model.GetUserQuota(s.relayInfo.UserId, true)
	return err == nil && userQuota > trustQuota
}

// syncRelayInfo 将 BillingSession 的状态同步到 RelayInfo 的兼容字段上。
func (s *BillingSession) syncRelayInfo() {
	info := s.relayInfo
	info.FinalPreConsumedQuota = s.preConsumedQuota
	info.BillingSource = s.funding.Source()

	if sub, ok := s.funding.(*SubscriptionFunding); ok {
		info.SubscriptionId = sub.subscriptionId
		info.SubscriptionPreConsumed = sub.preConsumed + int64(s.extraReserved)
		info.SubscriptionPostDelta = 0
		info.SubscriptionAmountTotal = sub.AmountTotal
		info.SubscriptionAmountUsedAfterPreConsume = sub.AmountUsedAfter + int64(s.extraReserved)
		info.SubscriptionPlanId = sub.PlanId
		info.SubscriptionPlanTitle = sub.PlanTitle
	} else {
		info.SubscriptionId = 0
		info.SubscriptionPreConsumed = 0
	}
}

// ---------------------------------------------------------------------------
// NewBillingSession 工厂 — 根据计费偏好创建会话并处理回退
// ---------------------------------------------------------------------------

// NewBillingSession 根据用户计费偏好创建 BillingSession，处理 subscription_first / wallet_first 的回退。
func NewBillingSession(c *gin.Context, relayInfo *relaycommon.RelayInfo, preConsumedQuota int) (*BillingSession, *types.NewAPIError) {
	if relayInfo == nil {
		return nil, types.NewError(fmt.Errorf("relayInfo is nil"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	pref := common.NormalizeBillingPreference(relayInfo.UserSetting.BillingPreference)

	// 钱包路径需要先检查用户额度
	tryWallet := func() (*BillingSession, *types.NewAPIError) {
		userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		}
		if userQuota <= 0 {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("用户额度不足, 剩余额度: %s", logger.FormatQuota(userQuota)),
				types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
				types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		if userQuota-preConsumedQuota < 0 {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("预扣费额度失败, 用户剩余额度: %s, 需要预扣费额度: %s", logger.FormatQuota(userQuota), logger.FormatQuota(preConsumedQuota)),
				types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
				types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		relayInfo.UserQuota = userQuota

		session := &BillingSession{
			relayInfo: relayInfo,
			funding: &WalletFunding{
				userId:            relayInfo.UserId,
				direct:            relayInfo.ForcePreConsume,
				reservationTaskID: relayInfo.BillingReservationTaskID,
			},
		}
		if apiErr := session.preConsume(c, preConsumedQuota); apiErr != nil {
			return nil, apiErr
		}
		return session, nil
	}

	trySubscription := func() (*BillingSession, *types.NewAPIError) {
		subConsume := int64(preConsumedQuota)
		if subConsume <= 0 {
			subConsume = 1
		}
		session := &BillingSession{
			relayInfo: relayInfo,
			funding: &SubscriptionFunding{
				requestId:         relayInfo.RequestId,
				userId:            relayInfo.UserId,
				modelName:         relayInfo.OriginModelName,
				amount:            subConsume,
				reservationTaskID: relayInfo.BillingReservationTaskID,
			},
		}
		// 必须传 subConsume 而非 preConsumedQuota，保证 SubscriptionFunding.amount、
		// preConsume 参数和 FinalPreConsumedQuota 三者一致，避免订阅多扣费。
		if apiErr := session.preConsume(c, int(subConsume)); apiErr != nil {
			return nil, apiErr
		}
		return session, nil
	}

	switch pref {
	case "subscription_only":
		return trySubscription()
	case "wallet_only":
		return tryWallet()
	case "wallet_first":
		session, err := tryWallet()
		if err != nil {
			if err.GetErrorCode() == types.ErrorCodeInsufficientUserQuota {
				return trySubscription()
			}
			return nil, err
		}
		return session, nil
	case "subscription_first":
		fallthrough
	default:
		hasSub, subCheckErr := model.HasActiveUserSubscription(relayInfo.UserId)
		if subCheckErr != nil {
			return nil, types.NewError(subCheckErr, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		}
		if !hasSub {
			return tryWallet()
		}
		session, apiErr := trySubscription()
		if apiErr != nil {
			if apiErr.GetErrorCode() == types.ErrorCodeInsufficientUserQuota {
				// 仅当用户的活跃订阅允许钱包回退时才回退到钱包，否则返回订阅额度不足错误
				allowOverflow, overflowErr := model.UserActiveSubscriptionsAllowWalletOverflow(relayInfo.UserId)
				if overflowErr != nil {
					return nil, types.NewError(overflowErr, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
				}
				if allowOverflow {
					return tryWallet()
				}
				return nil, apiErr
			}
			return nil, apiErr
		}
		return session, nil
	}
}
