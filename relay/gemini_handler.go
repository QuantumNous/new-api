package relay

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/relay/channel/gemini"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting"
	"one-api/setting/model_setting"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

func getAndValidateGeminiRequest(c *gin.Context) (*dto.GeminiChatRequest, error) {
	request := &dto.GeminiChatRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	if len(request.Contents) == 0 {
		return nil, errors.New("contents is required")
	}
	return request, nil
}

// 流模式
// /v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=xxx
func checkGeminiStreamMode(c *gin.Context, relayInfo *relaycommon.RelayInfo) {
	if c.Query("alt") == "sse" {
		relayInfo.IsStream = true
	}

	// if strings.Contains(c.Request.URL.Path, "streamGenerateContent") {
	// 	relayInfo.IsStream = true
	// }
}

func checkGeminiInputSensitive(textRequest *dto.GeminiChatRequest) ([]string, error) {
	var inputTexts []string
	for _, content := range textRequest.Contents {
		for _, part := range content.Parts {
			if part.Text != "" {
				inputTexts = append(inputTexts, part.Text)
			}
		}
	}
	if len(inputTexts) == 0 {
		return nil, nil
	}

	sensitiveWords, err := service.CheckSensitiveInput(inputTexts)
	return sensitiveWords, err
}

func getGeminiInputTokens(req *dto.GeminiChatRequest, info *relaycommon.RelayInfo) int {
	// 计算输入 token 数量
	var inputTexts []string
	for _, content := range req.Contents {
		for _, part := range content.Parts {
			if part.Text != "" {
				inputTexts = append(inputTexts, part.Text)
			}
		}
	}

	inputText := strings.Join(inputTexts, "\n")
	inputTokens := service.CountTokenInput(inputText, info.UpstreamModelName)
	info.PromptTokens = inputTokens
	return inputTokens
}

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

func trimModelThinking(modelName string) string {
	// 去除模型名称中的 -nothinking 后缀
	if strings.HasSuffix(modelName, "-nothinking") {
		return strings.TrimSuffix(modelName, "-nothinking")
	}
	// 去除模型名称中的 -thinking 后缀
	if strings.HasSuffix(modelName, "-thinking") {
		return strings.TrimSuffix(modelName, "-thinking")
	}

	// 去除模型名称中的 -thinking-number
	if strings.Contains(modelName, "-thinking-") {
		parts := strings.Split(modelName, "-thinking-")
		if len(parts) > 1 {
			return parts[0] + "-thinking"
		}
	}
	return modelName
}

func GeminiHelper(c *gin.Context) (newAPIError *types.NewAPIError) {
	req, err := getAndValidateGeminiRequest(c)
	if err != nil {
		common.LogError(c, fmt.Sprintf("getAndValidateGeminiRequest error: %s", err.Error()))
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	relayInfo := relaycommon.GenRelayInfoGemini(c)

	// 检查 Gemini 流式模式
	checkGeminiStreamMode(c, relayInfo)

	if setting.ShouldCheckPromptSensitive() {
		sensitiveWords, err := checkGeminiInputSensitive(req)
		if err != nil {
			common.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(sensitiveWords, ", ")))
			return types.NewError(err, types.ErrorCodeSensitiveWordsDetected, types.ErrOptionWithSkipRetry())
		}
	}

	// model mapped 模型映射
	err = helper.ModelMappedHelper(c, relayInfo, req)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	if value, exists := c.Get("prompt_tokens"); exists {
		promptTokens := value.(int)
		relayInfo.SetPromptTokens(promptTokens)
	} else {
		promptTokens := getGeminiInputTokens(req, relayInfo)
		c.Set("prompt_tokens", promptTokens)
	}

	if model_setting.GetGeminiSettings().ThinkingAdapterEnabled {
		if isNoThinkingRequest(req) {
			// check is thinking
			if !strings.Contains(relayInfo.OriginModelName, "-nothinking") {
				// try to get no thinking model price
				noThinkingModelName := relayInfo.OriginModelName + "-nothinking"
				containPrice := helper.ContainPriceOrRatio(noThinkingModelName)
				if containPrice {
					relayInfo.OriginModelName = noThinkingModelName
					relayInfo.UpstreamModelName = noThinkingModelName
				}
			}
		}
		if req.GenerationConfig.ThinkingConfig == nil {
			gemini.ThinkingAdaptor(req, relayInfo)
		}
	}

	priceData, err := helper.ModelPriceHelper(c, relayInfo, relayInfo.PromptTokens, int(req.GenerationConfig.MaxOutputTokens))
	if err != nil {
		return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry())
	}

	// pre consume quota
	preConsumedQuota, userQuota, newAPIError := preConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)
	if newAPIError != nil {
		return newAPIError
	}
	defer func() {
		if newAPIError != nil {
			returnPreConsumedQuota(c, relayInfo, userQuota, preConsumedQuota)
		}
	}()

	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}

	adaptor.Init(relayInfo)

	// Clean up empty system instruction
	if req.SystemInstructions != nil {
		hasContent := false
		for _, part := range req.SystemInstructions.Parts {
			if part.Text != "" {
				hasContent = true
				break
			}
		}
		if !hasContent {
			req.SystemInstructions = nil
		}
	}

	var requestBody io.Reader
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || relayInfo.ChannelSetting.PassThroughBodyEnabled {
		body, err := common.GetRequestBody(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		requestBody = bytes.NewReader(body)
	} else {
		// 使用 ConvertGeminiRequest 转换请求格式
		convertedRequest, err := adaptor.ConvertGeminiRequest(c, relayInfo, req)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		jsonData, err := common.Marshal(convertedRequest)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}

		// apply param override
		if len(relayInfo.ParamOverride) > 0 {
			reqMap := make(map[string]interface{})
			_ = common.Unmarshal(jsonData, &reqMap)
			for key, value := range relayInfo.ParamOverride {
				reqMap[key] = value
			}
			jsonData, err = common.Marshal(reqMap)
			if err != nil {
				return types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
			}
		}

		if common.DebugEnabled {
			println("Gemini request body: %s", string(jsonData))
		}
		requestBody = bytes.NewReader(jsonData)
	}

	resp, err := adaptor.DoRequest(c, relayInfo, requestBody)
	if err != nil {
		common.LogError(c, "Do gemini request failed: "+err.Error())
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		relayInfo.IsStream = relayInfo.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			newAPIError = service.RelayErrorHandler(httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	usage, openaiErr := adaptor.DoResponse(c, resp.(*http.Response), relayInfo)
	if openaiErr != nil {
		service.ResetStatusCode(openaiErr, statusCodeMappingStr)
		return openaiErr
	}

	postConsumeQuota(c, relayInfo, usage.(*dto.Usage), preConsumedQuota, userQuota, priceData, "")
	return nil
}
