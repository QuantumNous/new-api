package relay

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

var responsesCompactAllowedFields = []string{
	"model",
	"input",
	"instructions",
	"previous_response_id",
	"prompt_cache_key",
	"prompt_cache_options",
	"prompt_cache_retention",
	"service_tier",
}

func responsesCompactUpstreamRequest(req *dto.OpenAIResponsesCompactionRequest) *dto.OpenAIResponsesRequest {
	return &dto.OpenAIResponsesRequest{
		Model:                req.Model,
		Input:                req.Input,
		Instructions:         req.Instructions,
		PreviousResponseID:   req.PreviousResponseID,
		ServiceTier:          req.ServiceTier,
		PromptCacheKey:       req.PromptCacheKey,
		PromptCacheOptions:   req.PromptCacheOptions,
		PromptCacheRetention: req.PromptCacheRetention,
	}
}

func filterResponsesCompactRequestFields(jsonData []byte) ([]byte, error) {
	var payload map[string]json.RawMessage
	if err := common.Unmarshal(jsonData, &payload); err != nil {
		return nil, err
	}
	filtered := make(map[string]json.RawMessage, len(responsesCompactAllowedFields))
	for _, field := range responsesCompactAllowedFields {
		if value, ok := payload[field]; ok {
			filtered[field] = value
		}
	}
	return common.Marshal(filtered)
}

func compactRequestDebugSummary(info *relaycommon.RelayInfo, jsonData []byte) string {
	var payload map[string]json.RawMessage
	present := make([]string, 0, len(responsesCompactAllowedFields))
	if err := common.Unmarshal(jsonData, &payload); err == nil {
		for _, field := range responsesCompactAllowedFields {
			if _, ok := payload[field]; ok {
				present = append(present, field)
			}
		}
	}
	return fmt.Sprintf(
		"body_bytes=%d fields=%s logical_model=%q upstream_model=%q stage=%q",
		len(jsonData),
		strings.Join(present, ","),
		info.LogicalBillingModel,
		info.ActualUpstreamModelName(),
		info.CompactAttemptStage,
	)
}

func ResponsesHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)
	if info.RelayMode == relayconstant.RelayModeResponsesCompact &&
		!common.IsResponsesCompactAPIType(info.ApiType) {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("unsupported endpoint %q for api type %d", "/v1/responses/compact", info.ApiType),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	var responsesReq *dto.OpenAIResponsesRequest
	switch req := info.Request.(type) {
	case *dto.OpenAIResponsesRequest:
		responsesReq = req
	case *dto.OpenAIResponsesCompactionRequest:
		// Only fields documented for POST /v1/responses/compact are forwarded:
		// model, input, instructions, previous_response_id, prompt_cache_key,
		// prompt_cache_options, prompt_cache_retention, service_tier.
		// Undocumented Codex-parity fields (tools, reasoning, text) are parsed
		// for client compatibility but intentionally not sent upstream.
		responsesReq = responsesCompactUpstreamRequest(req)
	default:
		return types.NewErrorWithStatusCode(
			fmt.Errorf("invalid request type, expected dto.OpenAIResponsesRequest or dto.OpenAIResponsesCompactionRequest, got %T", info.Request),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	request, err := common.DeepCopy(responsesReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to GeneralOpenAIRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	var requestBody io.Reader
	passThroughBody := model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled
	// Compact must always marshal the selected attempt model. Raw pass-through
	// would keep the client's base model and defeat exact-model dispatch.
	if passThroughBody && info.RelayMode != relayconstant.RelayModeResponsesCompact {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewError(err, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.NewReplayableBodyReader(storage)
	} else {
		convertedRequest, err := adaptor.ConvertOpenAIResponsesRequest(c, info, *request)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)
		jsonData, err := common.Marshal(convertedRequest)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}

		// remove disabled fields for OpenAI Responses API
		jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}

		// apply param override
		if len(info.ParamOverride) > 0 {
			jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
			if err != nil {
				return newAPIErrorFromParamOverride(err)
			}
		}
		if info.RelayMode == relayconstant.RelayModeResponsesCompact {
			jsonData, err = filterResponsesCompactRequestFields(jsonData)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
		}

		if info.RelayMode == relayconstant.RelayModeResponsesCompact {
			logger.LogDebug(c, "compact request metadata: %s", compactRequestDebugSummary(info, jsonData))
		} else {
			logger.LogDebug(c, "requestBody: %s", jsonData)
		}
		body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		defer closer.Close()
		jsonData = nil
		requestBody = body
	}

	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	if resp != nil {
		httpResp = resp.(*http.Response)

		if httpResp.StatusCode != http.StatusOK {
			newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	usageDto := usage.(*dto.Usage)
	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		service.PostTextConsumeQuota(c, info, usageDto, nil)
		return nil
	}

	if strings.HasPrefix(info.OriginModelName, "gpt-4o-audio") {
		service.PostAudioConsumeQuota(c, info, usageDto, "")
	} else {
		service.PostTextConsumeQuota(c, info, usageDto, nil)
	}
	return nil
}
