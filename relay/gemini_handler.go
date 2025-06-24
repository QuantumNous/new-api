package relay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/relay/channel/gemini"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting"
	"one-api/setting/model_setting"
	"strings"

	"github.com/gin-gonic/gin"
)

func getAndValidateGeminiRequest(c *gin.Context) (*gemini.GeminiChatRequest, error) {
	request := &gemini.GeminiChatRequest{}
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

func checkGeminiInputSensitive(textRequest *gemini.GeminiChatRequest) ([]string, error) {
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

func getGeminiInputTokens(req *gemini.GeminiChatRequest, info *relaycommon.RelayInfo) int {
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

func isNoThinkingRequest(req *gemini.GeminiChatRequest) bool {
	if req.GenerationConfig.ThinkingConfig != nil && req.GenerationConfig.ThinkingConfig.ThinkingBudget != nil {
		return *req.GenerationConfig.ThinkingConfig.ThinkingBudget <= 0
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

func GeminiHelper(c *gin.Context) (openaiErr *dto.OpenAIErrorWithStatusCode) {
	req, err := getAndValidateGeminiRequest(c)
	if err != nil {
		common.LogError(c, fmt.Sprintf("getAndValidateGeminiRequest error: %s", err.Error()))
		return service.OpenAIErrorWrapperLocal(err, "invalid_gemini_request", http.StatusBadRequest)
	}

	relayInfo := relaycommon.GenRelayInfoGemini(c)

	// 检查 Gemini 流式模式
	checkGeminiStreamMode(c, relayInfo)

	if setting.ShouldCheckPromptSensitive() {
		sensitiveWords, err := checkGeminiInputSensitive(req)
		if err != nil {
			common.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(sensitiveWords, ", ")))
			return service.OpenAIErrorWrapperLocal(err, "check_request_sensitive_error", http.StatusBadRequest)
		}
	}

	// model mapped 模型映射
	err = helper.ModelMappedHelper(c, relayInfo, req)
	if err != nil {
		return service.OpenAIErrorWrapperLocal(err, "model_mapped_error", http.StatusBadRequest)
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
		return service.OpenAIErrorWrapperLocal(err, "model_price_error", http.StatusInternalServerError)
	}

	// pre consume quota
	preConsumedQuota, userQuota, openaiErr := preConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)
	if openaiErr != nil {
		return openaiErr
	}
	defer func() {
		if openaiErr != nil {
			returnPreConsumedQuota(c, relayInfo, userQuota, preConsumedQuota)
		}
	}()

	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return service.OpenAIErrorWrapperLocal(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), "invalid_api_type", http.StatusBadRequest)
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

	requestBody, err := json.Marshal(req)
	if err != nil {
		return service.OpenAIErrorWrapperLocal(err, "marshal_text_request_failed", http.StatusInternalServerError)
	}

	if common.DebugEnabled {
		println("Gemini request body: %s", string(requestBody))
	}

	resp, err := adaptor.DoRequest(c, relayInfo, bytes.NewReader(requestBody))
	if err != nil {
		common.LogError(c, "Do gemini request failed: "+err.Error())
		return service.OpenAIErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		relayInfo.IsStream = relayInfo.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			openaiErr = service.RelayErrorHandler(httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(openaiErr, statusCodeMappingStr)
			return openaiErr
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
