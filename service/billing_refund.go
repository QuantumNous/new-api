package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// RefundPreConsumeIfSafe 在确认上游未扣费时同步退还预扣费；不确定时 HoldRefund，暂不退款。
func RefundPreConsumeIfSafe(c *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) {
	if relayInfo == nil || relayInfo.Billing == nil || apiErr == nil {
		return
	}
	if !relayInfo.Billing.NeedsRefund() {
		return
	}

	confidence := ClassifyUpstreamChargeConfidence(apiErr)
	switch confidence {
	case UpstreamChargeConfirmedNot:
		preConsumed := relayInfo.Billing.GetPreConsumedQuota()
		if err := relayInfo.Billing.RefundSync(c); err != nil {
			logger.LogError(c, fmt.Sprintf("用户 %d 预扣费退还失败（上游未计费）: %s", relayInfo.UserId, err.Error()))
			common.SysLog(fmt.Sprintf("CRITICAL: preconsume refund failed userId=%d quota=%d status=%d code=%s err=%s",
				relayInfo.UserId, preConsumed, apiErr.StatusCode, apiErr.GetErrorCode(), err.Error()))
		} else {
			logger.LogInfo(c, fmt.Sprintf("用户 %d 预扣费已退还 %s（确认上游未计费）",
				relayInfo.UserId, logger.FormatQuota(relayInfo.Billing.GetPreConsumedQuota())))
		}
	case UpstreamChargeAmbiguous:
		if session, ok := relayInfo.Billing.(*BillingSession); ok {
			session.HoldRefund()
		}
		logger.LogInfo(c, fmt.Sprintf("用户 %d 预扣费 %s 暂不退款，上游计费状态未确认（status=%d, code=%s）",
			relayInfo.UserId,
			logger.FormatQuota(relayInfo.Billing.GetPreConsumedQuota()),
			apiErr.StatusCode,
			apiErr.GetErrorCode(),
		))
	}
}
