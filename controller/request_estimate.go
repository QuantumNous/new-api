package controller

import (
	"context"
	"errors"
	"math"
	"net"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// RequestEstimate stops at nominal pricing and never starts an upstream attempt.
func RequestEstimate(c *gin.Context, relayFormat types.RelayFormat) {
	if relayFormat == types.RelayFormatMjProxy {
		requestEstimateMidjourney(c)
		return
	}
	_, pinnedEndpoint := c.Get(pluginruntime.ContextKeyPinnedEndpoint)
	_, pinnedRoute := c.Get(pluginruntime.ContextKeyPinnedRoute)
	if relayFormat == types.RelayFormatTask || pinnedEndpoint || pinnedRoute {
		requestEstimateTask(c)
		return
	}
	request, err := helper.GetAndValidateRequest(c, relayFormat)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimateInvalidRequest), "type": "invalid_request_error", "code": "invalid_request"}})
		return
	}
	if _, hasMediaInfo := c.Get(common.RequestEstimateMediaInfoContextKey); hasMediaInfo {
		if err = service.BindRequestEstimateMediaInfo(c, request.GetTokenCountMeta().Files); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimateInvalidRequest), "type": "invalid_request_error", "code": "invalid_request"}})
			return
		}
	}
	info, err := relaycommon.GenRelayInfo(c, relayFormat, request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": "estimate_pricing_failed"}})
		return
	}
	imageCount := 0
	if _, isImageRequest := request.(*dto.ImageRequest); isImageRequest {
		info.InitChannelMeta(c)
		var imageErr *types.NewAPIError
		imageCount, imageErr = relay.PrepareImageRequestEstimate(c, info)
		if imageErr != nil {
			c.JSON(imageErr.StatusCode, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimateInvalidRequest), "type": "invalid_request_error", "code": "invalid_request"}})
			return
		}
	}
	if apiErr := relay.PrepareRequestPricing(c, info); apiErr != nil {
		if apiErr.GetErrorCode() == types.ErrorCodeCountTokenFailed {
			status := http.StatusBadRequest
			var timeoutError net.Error
			if errors.Is(c.Request.Context().Err(), context.DeadlineExceeded) || errors.Is(apiErr, context.DeadlineExceeded) || (errors.As(apiErr, &timeoutError) && timeoutError.Timeout()) {
				status = http.StatusGatewayTimeout
			}
			c.JSON(status, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimateMediaFailed), "type": "invalid_request_error", "code": "media_read_failed"}})
			return
		}
		c.JSON(apiErr.StatusCode, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": "estimate_pricing_failed"}})
		return
	}
	if imageCount > 0 {
		if apiErr := service.CalculateImageBillingForRequest(c, info, imageCount); apiErr != nil {
			c.JSON(apiErr.StatusCode, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": "estimate_pricing_failed"}})
			return
		}
	}
	quota := info.PriceData.QuotaToPreConsume
	snapshot, refreshErr := service.RefreshTieredBillingGroup(info)
	if snapshot != nil {
		quota = snapshot.EstimatedQuotaAfterGroup
	}
	if refreshErr != nil || quota < 0 || info.QuotaClamp != nil || common.QuotaPerUnit <= 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": "estimate_pricing_failed"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"quota":    quota,
		"amount":   decimal.NewFromInt(int64(quota)).Div(decimal.NewFromFloat(common.QuotaPerUnit)).String(),
		"currency": "USD", "model": info.GetBillingModelName(), "group": info.UsingGroup,
		"channel": gin.H{"id": c.GetInt("channel_id"), "type": c.GetInt("channel_type")},
	})
}

func requestEstimateMidjourney(c *gin.Context) {
	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatMjProxy, nil, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimateInvalidRequest), "type": "invalid_request_error", "code": "invalid_request"}})
		return
	}
	prepared, mjErr := service.PrepareMidjourneySubmit(c, info.UserId, info.RelayMode)
	if mjErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimateInvalidRequest), "type": "invalid_request_error", "code": "invalid_request"}})
		return
	}
	info.InitChannelMeta(c)
	price, err := helper.ModelPriceHelperPerCall(c, info)
	if err != nil || price.Quota < 0 || common.QuotaPerUnit <= 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": "estimate_pricing_failed"}})
		return
	}
	quota := price.Quota
	if !prepared.ConsumeQuota {
		quota = 0
	}
	c.JSON(http.StatusOK, gin.H{
		"quota": quota, "amount": decimal.NewFromInt(int64(quota)).Div(decimal.NewFromFloat(common.QuotaPerUnit)).String(),
		"currency": "USD", "model": prepared.ModelName, "group": info.UsingGroup,
		"channel": gin.H{"id": c.GetInt("channel_id"), "type": c.GetInt("channel_type")},
	})
}

func requestEstimateTask(c *gin.Context) {
	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": "estimate_pricing_failed"}})
		return
	}
	if action := c.GetString("task_action"); action != "" {
		info.Action = action
	}
	info.InitChannelMeta(c)
	if taskErr := relay.ResolveOriginTask(c, info); taskErr != nil {
		c.JSON(taskErr.StatusCode, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": taskErr.Code}})
		return
	}
	if taskErr := relay.ApplyChannelPin(c, info); taskErr != nil {
		c.JSON(taskErr.StatusCode, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": taskErr.Code}})
		return
	}
	prepared, taskErr := relay.PrepareTaskBilling(c, info)
	if taskErr != nil {
		status := taskErr.StatusCode
		if status == 0 {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": taskErr.Code}})
		return
	}
	quota := info.PriceData.Quota
	if info.TieredBillingSnapshot != nil {
		if snapshot, refreshErr := service.RefreshTieredBillingGroup(info); refreshErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": "estimate_pricing_failed"}})
			return
		} else if snapshot != nil {
			quota = snapshot.EstimatedQuotaAfterGroup
		}
	}
	if quota < 0 || info.QuotaClamp != nil || common.QuotaPerUnit <= 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": i18n.T(c, i18n.MsgEstimatePricingFailed), "type": "invalid_request_error", "code": "estimate_pricing_failed"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"quota": quota, "amount": decimal.NewFromInt(int64(quota)).Div(decimal.NewFromFloat(common.QuotaPerUnit)).String(),
		"currency": "USD", "model": info.GetBillingModelName(), "group": info.UsingGroup,
		"channel": gin.H{"id": c.GetInt("channel_id"), "type": c.GetInt("channel_type"), "plugin": prepared.Platform},
	})
}
