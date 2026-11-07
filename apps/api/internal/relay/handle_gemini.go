package relay

import (
	"fmt"
	"github.com/QuantumNous/new-api/internal/billing"
	"io"
	"net/http"
	"strings"

	model_setting "github.com/QuantumNous/new-api/internal/catalog"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/internal/logger"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/relay/helper"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func isNoThinkingRequest(req *dto.GeminiChatRequest) bool {
	if req.GenerationConfig.ThinkingConfig != nil && req.GenerationConfig.ThinkingConfig.ThinkingBudget != nil {
		configBudget := req.GenerationConfig.ThinkingConfig.ThinkingBudget
		if configBudget != nil && *configBudget == 0 {
			// 如果思考预算为 0，则认为是非思考请求
			return true
		}
	}
	return false
}

func applyGeminiSystemPrompt(c contract.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) {
	if info == nil || request == nil {
		return
	}
	systemPrompt := info.ChannelSetting.ResolveSystemPrompt(info.OriginModelName)
	if systemPrompt == "" {
		return
	}

	switch {
	case request.SystemInstructions == nil:
		request.SystemInstructions = &dto.GeminiChatContent{
			Parts: []dto.GeminiPart{{Text: systemPrompt}},
		}
	case len(request.SystemInstructions.Parts) == 0:
		request.SystemInstructions.Parts = []dto.GeminiPart{{Text: systemPrompt}}
	case info.ChannelSetting.UserSystemPromptOverride:
		// 覆盖模式：丢弃用户自带的 system prompt，只保留通道提示词。
		common.SetContextKey(c, constant.ContextKeyUserSystemPromptOverridden, true)
		request.SystemInstructions.Parts = []dto.GeminiPart{{Text: systemPrompt}}
	default:
		// 默认合并：通道提示词拼在用户 system prompt 最前。
		for i := range request.SystemInstructions.Parts {
			if request.SystemInstructions.Parts[i].Text == "" {
				continue
			}
			request.SystemInstructions.Parts[i].Text = systemPrompt + "\n" + request.SystemInstructions.Parts[i].Text
			return
		}
		request.SystemInstructions.Parts = append([]dto.GeminiPart{{Text: systemPrompt}}, request.SystemInstructions.Parts...)
	}
}

func GeminiHelper(c contract.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	geminiReq, ok := info.Request.(*dto.GeminiChatRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected *dto.GeminiChatRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(geminiReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to GeminiChatRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	// model mapped 模型映射
	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	if model_setting.GetGeminiSettings().ThinkingAdapterEnabled {
		if isNoThinkingRequest(request) {
			// check is thinking
			if !strings.Contains(info.OriginModelName, "-nothinking") {
				// try to get no thinking model price
				noThinkingModelName := info.OriginModelName + "-nothinking"
				containPrice := helper.HasModelBillingConfig(noThinkingModelName)
				if containPrice {
					info.OriginModelName = noThinkingModelName
					info.UpstreamModelName = noThinkingModelName
				}
			}
		}
		if request.GenerationConfig.ThinkingConfig == nil {
			relayconvert.ApplyGeminiThinkingConfig(request, info)
		}
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}

	adaptor.Init(info)

	applyGeminiSystemPrompt(c, info, request)

	// Clean up empty system instruction
	if request.SystemInstructions != nil {
		hasContent := false
		for _, part := range request.SystemInstructions.Parts {
			if part.Text != "" {
				hasContent = true
				break
			}
		}
		if !hasContent {
			request.SystemInstructions = nil
		}
	}

	var requestBody io.Reader
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.NewReplayableBodyReader(storage)
	} else {
		// 使用 ConvertGeminiRequest 转换请求格式
		convertedRequest, err := adaptor.ConvertGeminiRequest(c, info, request)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)
		jsonData, err := common.Marshal(convertedRequest)
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

		logger.LogDebug(c.Context(), "Gemini request body: %s", jsonData)

		body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		defer closer.Close()
		jsonData = nil
		requestBody = body
	}

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		logger.LogError(c.Context(), "Do gemini request failed: "+err.Error())
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			newAPIError = relaycommon.RelayErrorHandler(c.Context(), httpResp, false)
			// reset status code 重置状态码
			relaycommon.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	if !info.IsStream {
		info.SetFirstResponseTime()
	}
	usage, openaiErr := adaptor.DoResponse(c, resp.(*http.Response), info)
	if openaiErr != nil {
		relaycommon.ResetStatusCode(openaiErr, statusCodeMappingStr)
		return openaiErr
	}

	billing.PostTextConsumeQuota(c, info, usage.(*dto.Usage), nil)
	return nil
}

func GeminiEmbeddingHandler(c contract.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	isBatch := strings.HasSuffix(c.Path(), "batchEmbedContents")
	info.IsGeminiBatchEmbedding = isBatch

	var req dto.Request
	var err error
	var inputTexts []string

	if isBatch {
		batchRequest := &dto.GeminiBatchEmbeddingRequest{}
		err = common.UnmarshalBodyReusable(c, batchRequest)
		if err != nil {
			return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		}
		req = batchRequest
		for _, r := range batchRequest.Requests {
			for _, part := range r.Content.Parts {
				if part.Text != "" {
					inputTexts = append(inputTexts, part.Text)
				}
			}
		}
	} else {
		singleRequest := &dto.GeminiEmbeddingRequest{}
		err = common.UnmarshalBodyReusable(c, singleRequest)
		if err != nil {
			return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		}
		req = singleRequest
		for _, part := range singleRequest.Content.Parts {
			if part.Text != "" {
				inputTexts = append(inputTexts, part.Text)
			}
		}
	}

	err = helper.ModelMappedHelper(c, info, req)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	req.SetModelName("models/" + info.UpstreamModelName)

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	var requestBody io.Reader
	jsonData, err := common.Marshal(req)
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
	logger.LogDebug(c.Context(), "Gemini embedding request body: %s", jsonData)
	body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer closer.Close()
	jsonData = nil
	requestBody = body

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		logger.LogError(c.Context(), "Do gemini request failed: "+err.Error())
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		if httpResp.StatusCode != http.StatusOK {
			newAPIError = relaycommon.RelayErrorHandler(c.Context(), httpResp, false)
			relaycommon.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	if !info.IsStream {
		info.SetFirstResponseTime()
	}
	usage, openaiErr := adaptor.DoResponse(c, resp.(*http.Response), info)
	if openaiErr != nil {
		relaycommon.ResetStatusCode(openaiErr, statusCodeMappingStr)
		return openaiErr
	}

	billing.PostTextConsumeQuota(c, info, usage.(*dto.Usage), nil)
	return nil
}
