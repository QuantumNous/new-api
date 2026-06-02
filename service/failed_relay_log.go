package service

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	failedRelayConsumeLogRecordedKey = "failed_relay_consume_log_recorded"
	failedRelayLogMessageLimit       = 512
	failedRelayLogTextLimit          = 1024
)

func RecordFailedRelayConsumeLog(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, apiErr *types.NewAPIError) {
	if apiErr == nil {
		RecordFailedRelayConsumeLogWithMessage(ctx, relayInfo, 0, "", "", "")
		return
	}
	RecordFailedRelayConsumeLogWithMessage(ctx, relayInfo, apiErr.StatusCode, string(apiErr.GetErrorType()), string(apiErr.GetErrorCode()), apiErr.MaskSensitiveError())
}

func RecordFailedRelayConsumeLogWithMessage(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, statusCode int, errorType, errorCode, message string) {
	if ctx == nil {
		return
	}
	hasErrorInfo := strings.TrimSpace(message) != "" || strings.TrimSpace(errorType) != "" || strings.TrimSpace(errorCode) != ""
	statusCode = normalizeFailedLogStatusCode(ctx, statusCode, hasErrorInfo)
	if statusCode < http.StatusBadRequest && !hasErrorInfo {
		return
	}
	if ctx.GetBool(failedRelayConsumeLogRecordedKey) {
		return
	}

	userId := failedLogUserId(ctx, relayInfo)
	if userId <= 0 {
		return
	}
	ctx.Set(failedRelayConsumeLogRecordedKey, true)

	other := buildFailedRelayLogOther(ctx, relayInfo, statusCode, errorType, errorCode, message)
	modelName := failedLogModelName(ctx, relayInfo)
	tokenName := ctx.GetString("token_name")
	tokenId := failedLogTokenId(ctx, relayInfo)
	group := failedLogGroup(ctx, relayInfo)
	channelId := failedLogChannelId(ctx, relayInfo)
	useTimeSeconds := failedLogUseTimeSeconds(ctx, relayInfo)
	promptTokens := failedLogPromptTokens(ctx, relayInfo)

	model.RecordConsumeLog(ctx, userId, model.RecordConsumeLogParams{
		ChannelId:        channelId,
		PromptTokens:     promptTokens,
		CompletionTokens: 0,
		ModelName:        modelName,
		TokenName:        tokenName,
		Quota:            0,
		Content:          failedRelayLogContent(statusCode, errorCode),
		TokenId:          tokenId,
		UseTimeSeconds:   useTimeSeconds,
		IsStream:         failedLogIsStream(ctx, relayInfo),
		Group:            group,
		Other:            other,
		SkipQuotaData:    true,
	})
}

func normalizeFailedLogStatusCode(ctx *gin.Context, statusCode int, hasErrorInfo bool) int {
	if statusCode >= 100 && statusCode <= 599 {
		return statusCode
	}
	if ctx != nil && ctx.Writer != nil {
		writerStatus := ctx.Writer.Status()
		if writerStatus >= http.StatusBadRequest && writerStatus <= 599 {
			return writerStatus
		}
		if !hasErrorInfo && writerStatus >= 100 && writerStatus <= 599 {
			return writerStatus
		}
	}
	return http.StatusInternalServerError
}

func failedRelayLogContent(statusCode int, errorCode string) string {
	content := fmt.Sprintf("请求失败，状态码 %d", statusCode)
	if strings.TrimSpace(errorCode) != "" {
		content += fmt.Sprintf("，错误码 %s", errorCode)
	}
	return common.HideExternalAddressInfo(content)
}

func buildFailedRelayLogOther(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, statusCode int, errorType, errorCode, message string) map[string]interface{} {
	other := map[string]interface{}{
		"failed":      true,
		"status_code": statusCode,
	}
	if errorType != "" {
		other["error_type"] = errorType
	}
	if errorCode != "" {
		other["error_code"] = errorCode
	}
	if message = cleanLogText(common.HideExternalAddressInfo(message), failedRelayLogMessageLimit); message != "" {
		other["error_message"] = message
	}
	if relayInfo != nil {
		if relayInfo.PriceData.ModelRatio != 0 {
			other["model_ratio"] = relayInfo.PriceData.ModelRatio
		}
		if relayInfo.PriceData.GroupRatioInfo.GroupRatio != 0 {
			other["group_ratio"] = relayInfo.PriceData.GroupRatioInfo.GroupRatio
		}
		if relayInfo.PriceData.CompletionRatio != 0 {
			other["completion_ratio"] = relayInfo.PriceData.CompletionRatio
		}
		if relayInfo.PriceData.ModelPrice != 0 {
			other["model_price"] = relayInfo.PriceData.ModelPrice
		}
		if relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio != 0 {
			other["user_group_ratio"] = relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio
		}
		if relayInfo.FinalPreConsumedQuota > 0 {
			other["pre_consumed_quota"] = relayInfo.FinalPreConsumedQuota
			other["refunded"] = true
		}
		if relayInfo.RetryIndex > 0 {
			other["retry_index"] = relayInfo.RetryIndex
		}
		appendClientRequestInfo(ctx, relayInfo, other)
		appendRequestPath(ctx, relayInfo, other)
		appendRequestConversionChain(relayInfo, other)
		appendFinalRequestFormat(relayInfo, other)
		appendBillingInfo(relayInfo, other)
		appendParamOverrideInfo(relayInfo, other)
		appendStreamStatus(relayInfo, other)
	} else {
		appendRequestPath(ctx, nil, other)
	}

	adminInfo := map[string]interface{}{
		"use_channel": ctx.GetStringSlice("use_channel"),
	}
	isMultiKey := common.GetContextKeyBool(ctx, constant.ContextKeyChannelIsMultiKey)
	if isMultiKey {
		adminInfo["is_multi_key"] = true
		adminInfo["multi_key_index"] = common.GetContextKeyInt(ctx, constant.ContextKeyChannelMultiKeyIndex)
	}
	AppendChannelAffinityAdminInfo(ctx, adminInfo)
	other["admin_info"] = adminInfo

	return sanitizeFailedRelayLogMap(other)
}

func sanitizeFailedRelayLogMap(input map[string]interface{}) map[string]interface{} {
	if input == nil {
		return nil
	}
	output := make(map[string]interface{}, len(input))
	for key, value := range input {
		output[key] = sanitizeFailedRelayLogValue(value)
	}
	return output
}

func sanitizeFailedRelayLogValue(value interface{}) interface{} {
	switch v := value.(type) {
	case string:
		return cleanLogText(common.HideExternalAddressInfo(v), failedRelayLogTextLimit)
	case []string:
		out := make([]string, 0, len(v))
		for _, item := range v {
			out = append(out, cleanLogText(common.HideExternalAddressInfo(item), failedRelayLogTextLimit))
		}
		return out
	case []interface{}:
		out := make([]interface{}, 0, len(v))
		for _, item := range v {
			out = append(out, sanitizeFailedRelayLogValue(item))
		}
		return out
	case map[string]interface{}:
		return sanitizeFailedRelayLogMap(v)
	case map[string]string:
		out := make(map[string]string, len(v))
		for key, item := range v {
			out[key] = cleanLogText(common.HideExternalAddressInfo(item), failedRelayLogTextLimit)
		}
		return out
	default:
		return value
	}
}

func failedLogUserId(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) int {
	if relayInfo != nil && relayInfo.UserId > 0 {
		return relayInfo.UserId
	}
	return common.GetContextKeyInt(ctx, constant.ContextKeyUserId)
}

func failedLogModelName(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) string {
	if relayInfo != nil && relayInfo.OriginModelName != "" {
		return relayInfo.OriginModelName
	}
	return common.GetContextKeyString(ctx, constant.ContextKeyOriginalModel)
}

func failedLogTokenId(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) int {
	if relayInfo != nil && relayInfo.TokenId > 0 {
		return relayInfo.TokenId
	}
	return common.GetContextKeyInt(ctx, constant.ContextKeyTokenId)
}

func failedLogGroup(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) string {
	if relayInfo != nil && relayInfo.UsingGroup != "" {
		return relayInfo.UsingGroup
	}
	return common.GetContextKeyString(ctx, constant.ContextKeyUsingGroup)
}

func failedLogChannelId(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) int {
	channelId := common.GetContextKeyInt(ctx, constant.ContextKeyChannelId)
	if channelId > 0 {
		return channelId
	}
	if relayInfo != nil && relayInfo.ChannelMeta != nil {
		return relayInfo.ChannelId
	}
	return 0
}

func failedLogIsStream(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) bool {
	if relayInfo != nil {
		return relayInfo.IsStream
	}
	return common.GetContextKeyBool(ctx, constant.ContextKeyIsStream)
}

func failedLogPromptTokens(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) int {
	if relayInfo != nil {
		return relayInfo.GetEstimatePromptTokens()
	}
	return common.GetContextKeyInt(ctx, constant.ContextKeyEstimatedTokens)
}

func failedLogUseTimeSeconds(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) int {
	startTime := time.Time{}
	if relayInfo != nil {
		startTime = relayInfo.StartTime
	}
	if startTime.IsZero() {
		startTime = common.GetContextKeyTime(ctx, constant.ContextKeyRequestStartTime)
	}
	if startTime.IsZero() {
		return 0
	}
	elapsed := time.Since(startTime).Seconds()
	if elapsed < 0 {
		return 0
	}
	return int(elapsed)
}
