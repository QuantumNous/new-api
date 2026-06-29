package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const imagePollTaskIDContextKey = "image_poll_task_id"

// RefundPreConsumeIfSafe 在确认上游未扣费时同步退还预扣费；不确定时 HoldRefund 并预约超时对账。
func RefundPreConsumeIfSafe(c *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) {
	if relayInfo == nil || relayInfo.Billing == nil || apiErr == nil {
		return
	}

	syncBillingHoldWithFinalError(c, relayInfo, apiErr)

	if !relayInfo.Billing.NeedsRefund() {
		if session, ok := relayInfo.Billing.(*BillingSession); ok && session.HoldRefundActive() {
			tryResolveActiveBillingHold(c, relayInfo, apiErr)
		}
		return
	}

	confidence := ClassifyUpstreamChargeConfidence(apiErr)
	switch confidence {
	case UpstreamChargeConfirmedNot:
		resolveConfirmedNotPreConsume(c, relayInfo, apiErr)
	case UpstreamChargeAmbiguous:
		if session, ok := relayInfo.Billing.(*BillingSession); ok {
			session.HoldRefund()
		}
		hold, err := upsertBillingHoldAndSchedule(c, relayInfo, apiErr)
		if err != nil {
			common.SysLog(fmt.Sprintf("billing hold persist failed userId=%d request=%s: %s",
				relayInfo.UserId, relayInfo.RequestId, err.Error()))
		}
		logger.LogInfo(c, fmt.Sprintf("用户 %d 预扣费 %s 暂不退款，已挂账等待对账（status=%d, code=%s, holdId=%d）",
			relayInfo.UserId,
			logger.FormatQuota(relayInfo.Billing.GetPreConsumedQuota()),
			apiErr.StatusCode,
			apiErr.GetErrorCode(),
			func() int {
				if hold != nil {
					return hold.Id
				}
				return 0
			}(),
		))
	}
}

func resolveConfirmedNotPreConsume(c *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) {
	if session, ok := relayInfo.Billing.(*BillingSession); ok {
		session.ReleaseHoldRefund()
	}

	requestId := strings.TrimSpace(relayInfo.RequestId)
	if requestId == "" && c != nil {
		requestId = c.GetString(common.RequestIdKey)
	}
	if requestId != "" {
		if hold, err := model.GetBillingHoldByRequestId(requestId); err == nil && hold != nil && isActiveBillingHold(hold) {
			detail := "relay error confirms upstream not charged: " + apiErr.Error()
			if err := RefundBillingHold(hold, detail); err != nil {
				logger.LogError(c, fmt.Sprintf("用户 %d 挂账退还失败: %s", relayInfo.UserId, err.Error()))
			} else {
				logger.LogInfo(c, fmt.Sprintf("用户 %d 挂账预扣费已退还 %s（确认上游未计费）",
					relayInfo.UserId, logger.FormatQuota(hold.PreConsumedQuota)))
			}
			return
		}
	}

	preConsumed := relayInfo.Billing.GetPreConsumedQuota()
	if err := relayInfo.Billing.RefundSync(c); err != nil {
		logger.LogError(c, fmt.Sprintf("用户 %d 预扣费退还失败（上游未计费）: %s", relayInfo.UserId, err.Error()))
		common.SysLog(fmt.Sprintf("CRITICAL: preconsume refund failed userId=%d quota=%d status=%d code=%s err=%s",
			relayInfo.UserId, preConsumed, apiErr.StatusCode, apiErr.GetErrorCode(), err.Error()))
	} else {
		logger.LogInfo(c, fmt.Sprintf("用户 %d 预扣费已退还 %s（确认上游未计费）",
			relayInfo.UserId, logger.FormatQuota(preConsumed)))
	}
}

func tryResolveActiveBillingHold(c *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) {
	if ClassifyUpstreamChargeConfidence(apiErr) != UpstreamChargeConfirmedNot {
		return
	}
	resolveConfirmedNotPreConsume(c, relayInfo, apiErr)
}

func syncBillingHoldWithFinalError(c *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) {
	requestId := strings.TrimSpace(relayInfo.RequestId)
	if requestId == "" && c != nil {
		requestId = c.GetString(common.RequestIdKey)
	}
	if requestId == "" {
		return
	}
	hold, err := model.GetBillingHoldByRequestId(requestId)
	if err != nil {
		return
	}
	if !isActiveBillingHold(hold) {
		return
	}
	patch := billingHoldPatchFromRelay(c, relayInfo, apiErr)
	if err := model.UpdateBillingHoldContext(hold.Id, patch); err != nil {
		common.SysLog(fmt.Sprintf("billing hold context update failed id=%d request=%s: %s", hold.Id, requestId, err.Error()))
	}
}

func billingHoldPatchFromRelay(c *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) model.BillingHoldContextPatch {
	patch := model.BillingHoldContextPatch{
		ErrorStatus:  apiErr.StatusCode,
		ErrorCode:    string(apiErr.GetErrorCode()),
		ErrorMessage: apiErr.Error(),
	}
	if relayInfo != nil && relayInfo.ChannelMeta != nil && relayInfo.ChannelMeta.ChannelId > 0 {
		patch.ChannelId = relayInfo.ChannelMeta.ChannelId
	}
	if relayInfo != nil && relayInfo.TaskRelayInfo != nil {
		patch.UpstreamTaskId = strings.TrimSpace(relayInfo.TaskRelayInfo.OriginTaskID)
	}
	if c != nil {
		if taskID := strings.TrimSpace(c.GetString(imagePollTaskIDContextKey)); taskID != "" {
			patch.UpstreamTaskId = taskID
		}
	}
	return patch
}

func isActiveBillingHold(hold *model.BillingHold) bool {
	if hold == nil {
		return false
	}
	switch hold.Status {
	case model.BillingHoldStatusPending, "processing":
		return true
	default:
		return false
	}
}

func upsertBillingHoldAndSchedule(c *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) (*model.BillingHold, error) {
	requestId := strings.TrimSpace(relayInfo.RequestId)
	if requestId == "" && c != nil {
		requestId = c.GetString(common.RequestIdKey)
	}
	if requestId == "" {
		return nil, fmt.Errorf("missing request id for billing hold")
	}

	if existing, err := model.GetBillingHoldByRequestId(requestId); err == nil && existing != nil {
		if isActiveBillingHold(existing) {
			patch := billingHoldPatchFromRelay(c, relayInfo, apiErr)
			if err := model.UpdateBillingHoldContext(existing.Id, patch); err != nil {
				return existing, err
			}
			scheduleBillingHoldReconcile(existing.Id)
			return existing, nil
		}
		return existing, nil
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	return RecordBillingHoldAndSchedule(c, relayInfo, apiErr)
}
