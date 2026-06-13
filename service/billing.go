package service

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	BillingSourceWallet       = "wallet"
	BillingSourceSubscription = "subscription"
)

// PreConsumeBilling 根据用户计费偏好创建 BillingSession 并执行预扣费。
// 会话存储在 relayInfo.Billing 上，供后续 Settle / Refund 使用。
func PreConsumeBilling(c *gin.Context, preConsumedQuota int, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {
	session, apiErr := NewBillingSession(c, relayInfo, preConsumedQuota)
	if apiErr != nil {
		return apiErr
	}
	relayInfo.Billing = session
	return nil
}

// PrecheckBilling performs a read-only quota sanity check before a request enters
// a flow-control queue. It intentionally does not reserve or deduct quota.
func PrecheckBilling(c *gin.Context, estimatedQuota int, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {
	if relayInfo == nil || estimatedQuota <= 0 {
		return nil
	}
	trustQuota := common.GetTrustQuota()
	if !relayInfo.TokenUnlimited {
		tokenQuota := c.GetInt("token_quota")
		if tokenQuota <= trustQuota && tokenQuota < estimatedQuota {
			return types.NewErrorWithStatusCode(
				fmt.Errorf("令牌额度不足, 剩余额度: %s, 预计需要额度: %s", logger.FormatQuota(tokenQuota), logger.FormatQuota(estimatedQuota)),
				types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
				types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
	}

	userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	relayInfo.UserQuota = userQuota
	walletOK := userQuota > 0 && userQuota >= estimatedQuota
	hasSub, subErr := model.HasActiveUserSubscription(relayInfo.UserId)
	if subErr != nil {
		return types.NewError(subErr, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}

	switch common.NormalizeBillingPreference(relayInfo.UserSetting.BillingPreference) {
	case "wallet_only":
		if !walletOK {
			return insufficientPrecheckError(userQuota, estimatedQuota)
		}
	case "subscription_only":
		if !hasSub {
			return insufficientPrecheckError(userQuota, estimatedQuota)
		}
	case "wallet_first":
		if !walletOK && !hasSub {
			return insufficientPrecheckError(userQuota, estimatedQuota)
		}
	case "subscription_first":
		fallthrough
	default:
		if !hasSub && !walletOK {
			return insufficientPrecheckError(userQuota, estimatedQuota)
		}
	}
	return nil
}

func insufficientPrecheckError(userQuota int, estimatedQuota int) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		fmt.Errorf("额度不足, 剩余额度: %s, 预计需要额度: %s", logger.FormatQuota(userQuota), logger.FormatQuota(estimatedQuota)),
		types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
		types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
}

// ---------------------------------------------------------------------------
// SettleBilling — 后结算辅助函数
// ---------------------------------------------------------------------------

// SettleBilling 执行计费结算。如果 RelayInfo 上有 BillingSession 则通过 session 结算，
// 否则回退到旧的 PostConsumeQuota 路径（兼容按次计费等场景）。
func SettleBilling(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, actualQuota int) error {
	if relayInfo.Billing != nil {
		preConsumed := relayInfo.Billing.GetPreConsumedQuota()
		delta := actualQuota - preConsumed

		if delta > 0 {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费后补扣费：%s（实际消耗：%s，预扣费：%s）",
				logger.FormatQuota(delta),
				logger.FormatQuota(actualQuota),
				logger.FormatQuota(preConsumed),
			))
		} else if delta < 0 {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费后返还扣费：%s（实际消耗：%s，预扣费：%s）",
				logger.FormatQuota(-delta),
				logger.FormatQuota(actualQuota),
				logger.FormatQuota(preConsumed),
			))
		} else {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费与实际消耗一致，无需调整：%s（按次计费）",
				logger.FormatQuota(actualQuota),
			))
		}

		if err := relayInfo.Billing.Settle(actualQuota); err != nil {
			return err
		}

		// 发送额度通知（订阅计费使用订阅剩余额度）
		if actualQuota != 0 {
			if relayInfo.BillingSource == BillingSourceSubscription {
				checkAndSendSubscriptionQuotaNotify(relayInfo)
			} else {
				checkAndSendQuotaNotify(relayInfo, actualQuota-preConsumed, preConsumed)
			}
		}
		return nil
	}

	// 回退：无 BillingSession 时使用旧路径
	quotaDelta := actualQuota - relayInfo.FinalPreConsumedQuota
	if quotaDelta != 0 {
		return PostConsumeQuota(relayInfo, quotaDelta, relayInfo.FinalPreConsumedQuota, true)
	}
	return nil
}
