package custompass

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/model"
	"one-api/relay/channel"
	relaycommon "one-api/relay/common"
	"one-api/service"
	"one-api/types"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// TwoRequestResult represents the result of a two-request operation
type TwoRequestResult struct {
	Response        *UpstreamResponse
	PrechargeAmount int64
	RequestCount    int // 1 for single request, 2 for two requests
	PrechargeUsage  *Usage // Usage from precharge response (for consistent billing logging)
}

// TwoRequestParams contains parameters for two-request operation
type TwoRequestParams struct {
	User          *model.User
	Channel       *model.Channel
	ModelName     string
	RequestBody   []byte
	AuthService   service.CustomPassAuthService
	PrechargeService service.CustomPassPrechargeService
	BillingService   service.CustomPassBillingService
	HTTPClient    *http.Client
}

type Adaptor struct {
	channel.Adaptor
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	// CustomPass initialization logic
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// CustomPass URL building logic
	return "", nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	// CustomPass header setup logic
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	// CustomPass request conversion logic
	return nil, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	// CustomPass rerank request conversion logic
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	// CustomPass embedding request conversion logic
	return nil, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	// CustomPass audio request conversion logic
	return nil, nil
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// CustomPass image request conversion logic
	return nil, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// CustomPass responses request conversion logic
	return nil, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	// CustomPass request execution logic
	return nil, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	// CustomPass response handling logic
	return nil, nil
}

func (a *Adaptor) GetModelList() []string {
	// Return available models for CustomPass
	return []string{"custom-model-1", "custom-model-2"}
}

func (a *Adaptor) GetChannelName() string {
	return "CustomPass"
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	// CustomPass Claude request conversion logic
	return nil, nil
}

// ExecuteTwoRequestFlow executes the two-request logic with precharge and billing
// This is a common function that can be used by both sync and async adaptors
func ExecuteTwoRequestFlow(c *gin.Context, params *TwoRequestParams) (*TwoRequestResult, error) {
	// Check if model requires billing
	requiresBilling, err := checkModelBilling(params.ModelName)
	if err != nil {
		return nil, err
	}

	if !requiresBilling {
		// Model doesn't require billing, send request directly
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 模型%s不需要计费，直接发起请求", params.ModelName))
		realResp, err := makeUpstreamRequest(c, params.Channel, "POST", 
			buildUpstreamURL(params.Channel.GetBaseURL(), params.ModelName), 
			params.RequestBody, params.AuthService, params.HTTPClient)
		if err != nil {
			return nil, err
		}

		return &TwoRequestResult{
			Response:        realResp,
			PrechargeAmount: 0,
			RequestCount:    1,
			PrechargeUsage:  nil, // No precharge for free models
		}, nil
	}

	// Step 1: Send precharge request to get usage estimation
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 模型%s需要计费，开始预扣费请求流程", params.ModelName))
	prechargeResp, err := handlePrechargeRequest(c, params)
	if err != nil {
		common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 预扣费请求失败: %v", err))
		return nil, err
	}

	// Check if upstream returned precharge response
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 检查上游响应类型 - Type: %s, IsPrecharge: %t", 
		prechargeResp.Type, prechargeResp.IsPrecharge()))

	if prechargeResp.IsPrecharge() {
		common.SysLog("[CustomPass-TwoRequest-Debug] 上游支持预扣费，将发起两次请求")
		return executeTwoRequestMode(c, params, prechargeResp)
	} else {
		common.SysLog("[CustomPass-TwoRequest-Debug] 上游不支持预扣费，使用单次请求模式，基于估算用量预扣费")
		return executeSingleRequestMode(c, params, prechargeResp)
	}
}

// executeTwoRequestMode handles the case where upstream supports precharge
func executeTwoRequestMode(c *gin.Context, params *TwoRequestParams, prechargeResp *UpstreamResponse) (*TwoRequestResult, error) {
	// Upstream supports precharge, use the usage for precharge calculation
	if prechargeResp.Usage == nil {
		return nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: "预扣费响应缺少usage信息",
		}
	}

	// Log the usage from precharge response for debugging
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] ===== 预扣费响应的Usage (executeTwoRequestMode) ====="))
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] PromptTokens: %d", prechargeResp.Usage.PromptTokens))
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] CompletionTokens: %d", prechargeResp.Usage.CompletionTokens))
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] TotalTokens: %d", prechargeResp.Usage.TotalTokens))
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] InputTokens: %d", prechargeResp.Usage.InputTokens))
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] OutputTokens: %d", prechargeResp.Usage.OutputTokens))
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] 实际输入tokens: %d", prechargeResp.Usage.GetInputTokens()))
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] 实际输出tokens: %d", prechargeResp.Usage.GetOutputTokens()))
	common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] ================================================"))

	// Step 2: Send real request first to get actual usage
	common.SysLog("[CustomPass-TwoRequest-Debug] 开始发起真实请求以获取实际usage")
	realResp, err := makeUpstreamRequest(c, params.Channel, "POST", 
		buildUpstreamURL(params.Channel.GetBaseURL(), params.ModelName), 
		params.RequestBody, params.AuthService, params.HTTPClient)
	if err != nil {
		common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 真实请求失败: %v", err))
		return nil, err
	}

	common.SysLog("[CustomPass-TwoRequest-Debug] 真实请求成功")
	
	// Determine which usage to use for precharge: prefer real response usage, fallback to precharge usage
	var finalUsage *Usage
	var serviceUsageForPrecharge *service.Usage
	
	if realResp.Usage != nil {
		// Use usage from real response if available
		finalUsage = realResp.Usage
		serviceUsageForPrecharge = &service.Usage{
			PromptTokens:     realResp.Usage.PromptTokens,
			CompletionTokens: realResp.Usage.CompletionTokens,
			TotalTokens:      realResp.Usage.TotalTokens,
			InputTokens:      realResp.Usage.InputTokens,
			OutputTokens:     realResp.Usage.OutputTokens,
		}
		common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] ===== 使用真实请求的Usage进行预扣费 ====="))
		common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] 真实请求usage - 输入: %d, 输出: %d, 总计: %d", 
			realResp.Usage.GetInputTokens(), realResp.Usage.GetOutputTokens(), 
			realResp.Usage.GetInputTokens() + realResp.Usage.GetOutputTokens()))
		if prechargeResp.Usage != nil {
			common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] 预扣费请求usage(仅供参考) - 输入: %d, 输出: %d, 总计: %d", 
				prechargeResp.Usage.GetInputTokens(), prechargeResp.Usage.GetOutputTokens(),
				prechargeResp.Usage.GetInputTokens() + prechargeResp.Usage.GetOutputTokens()))
			common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] 差异 - 输入tokens差: %d, 输出tokens差: %d", 
				realResp.Usage.GetInputTokens() - prechargeResp.Usage.GetInputTokens(),
				realResp.Usage.GetOutputTokens() - prechargeResp.Usage.GetOutputTokens()))
		}
		common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] ================================================"))
	} else {
		// Fallback to precharge usage if real response doesn't have usage
		finalUsage = prechargeResp.Usage
		serviceUsageForPrecharge = &service.Usage{
			PromptTokens:     prechargeResp.Usage.PromptTokens,
			CompletionTokens: prechargeResp.Usage.CompletionTokens,
			TotalTokens:      prechargeResp.Usage.TotalTokens,
			InputTokens:      prechargeResp.Usage.InputTokens,
			OutputTokens:     prechargeResp.Usage.OutputTokens,
		}
		common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] ===== 真实请求无Usage，使用预扣费请求的Usage ====="))
		if prechargeResp.Usage != nil {
			common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] 预扣费请求usage - 输入: %d, 输出: %d, 总计: %d", 
				prechargeResp.Usage.GetInputTokens(), prechargeResp.Usage.GetOutputTokens(),
				prechargeResp.Usage.GetInputTokens() + prechargeResp.Usage.GetOutputTokens()))
		}
		common.SysLog(fmt.Sprintf("[CustomPass-Usage-Debug] ================================================"))
	}

	// Execute precharge using the final usage (real usage if available, otherwise precharge usage)
	prechargeResult, err := params.PrechargeService.ExecutePrecharge(params.User, params.ModelName, serviceUsageForPrecharge)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeInsufficientQuota,
			Message: "预扣费失败",
			Details: err.Error(),
		}
	}
	prechargeAmount := prechargeResult.PrechargeAmount
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 基于最终usage的预扣费成功(金额: %d)", prechargeAmount))
	
	// Check if real request was successful
	if !realResp.IsSuccess() {
		// Refund precharge amount on failed real request
		if prechargeAmount > 0 {
			common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 真实请求响应失败，退还预扣费: %d", prechargeAmount))
			params.PrechargeService.ProcessRefund(params.User.Id, prechargeAmount, 0)
		}
		return nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: "上游请求失败",
			Details: realResp.GetMessage(),
		}
	}
	
	return &TwoRequestResult{
		Response:        realResp,
		PrechargeAmount: prechargeAmount, // Now based on final usage
		RequestCount:    2,
		PrechargeUsage:  finalUsage, // Use final usage for consistent billing
	}, nil
}

// executeSingleRequestMode handles the case where upstream doesn't support precharge
func executeSingleRequestMode(c *gin.Context, params *TwoRequestParams, prechargeResp *UpstreamResponse) (*TwoRequestResult, error) {
	// For single request mode, we need to validate that the response contains usage information
	// for models that require usage-based billing
	billingMode := params.BillingService.DetermineBillingMode(params.ModelName)
	
	if billingMode == service.BillingModeUsage {
		// For usage-based billing, the response must contain usage information
		if prechargeResp.Usage == nil {
			common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 按量计费模型%s的响应缺少usage信息", params.ModelName))
			return nil, &CustomPassError{
				Code:    ErrCodeUpstreamError,
				Message: fmt.Sprintf("按量计费模型%s的响应必须包含usage信息", params.ModelName),
			}
		}

		// Convert Usage to service.Usage for validation
		serviceUsageForValidation := &service.Usage{
			PromptTokens:     prechargeResp.Usage.PromptTokens,
			CompletionTokens: prechargeResp.Usage.CompletionTokens,
			TotalTokens:      prechargeResp.Usage.TotalTokens,
			InputTokens:      prechargeResp.Usage.InputTokens,
			OutputTokens:     prechargeResp.Usage.OutputTokens,
		}
		
		// Validate usage for billing
		if err := params.BillingService.ValidateUsageForBilling(params.ModelName, serviceUsageForValidation); err != nil {
			common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 按量计费模型%s的usage信息校验失败: %v", params.ModelName, err))
			return nil, &CustomPassError{
				Code:    ErrCodeUpstreamError,
				Message: fmt.Sprintf("按量计费模型%s的usage信息无效: %s", params.ModelName, err.Error()),
			}
		}

		// Use actual usage from response for precharge calculation
		serviceUsage := &service.Usage{
			PromptTokens:     prechargeResp.Usage.PromptTokens,
			CompletionTokens: prechargeResp.Usage.CompletionTokens,
			TotalTokens:      prechargeResp.Usage.TotalTokens,
			InputTokens:      prechargeResp.Usage.InputTokens,
			OutputTokens:     prechargeResp.Usage.OutputTokens,
		}

		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 使用响应中的实际用量进行预扣费 - PromptTokens: %d, CompletionTokens: %d", 
			serviceUsage.PromptTokens, serviceUsage.CompletionTokens))

		// Execute precharge with actual usage from response
		prechargeResult, err := params.PrechargeService.ExecutePrecharge(params.User, params.ModelName, serviceUsage)
		if err != nil {
			common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 实际用量预扣费失败: %v", err))
			return nil, &CustomPassError{
				Code:    ErrCodeInsufficientQuota,
				Message: "预扣费失败",
				Details: err.Error(),
			}
		}
		prechargeAmount := prechargeResult.PrechargeAmount

		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 实际用量预扣费成功(金额: %d)，直接使用第一次请求的响应", prechargeAmount))
		return &TwoRequestResult{
			Response:        prechargeResp,
			PrechargeAmount: prechargeAmount,
			RequestCount:    1,
			PrechargeUsage:  prechargeResp.Usage, // Use usage from precharge response (same as response in single request mode)
		}, nil
	} else {
		// For fixed-price or free models, usage is not required
		var prechargeAmount int64 = 0
		
		if billingMode == service.BillingModeFixed {
			// For fixed-price models, calculate based on fixed price
			estimatedUsage := &service.Usage{
				PromptTokens:     1, // Minimal usage for fixed price calculation
				CompletionTokens: 1,
				TotalTokens:      2,
			}

			prechargeResult, err := params.PrechargeService.ExecutePrecharge(params.User, params.ModelName, estimatedUsage)
			if err != nil {
				common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 固定价格模型预扣费失败: %v", err))
				return nil, &CustomPassError{
					Code:    ErrCodeInsufficientQuota,
					Message: "预扣费失败",
					Details: err.Error(),
				}
			}
			prechargeAmount = prechargeResult.PrechargeAmount
			common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 固定价格模型预扣费成功(金额: %d)", prechargeAmount))
		} else {
			common.SysLog("[CustomPass-TwoRequest-Debug] 免费模型，无需预扣费")
		}

		return &TwoRequestResult{
			Response:        prechargeResp,
			PrechargeAmount: prechargeAmount,
			RequestCount:    1,
			PrechargeUsage:  prechargeResp.Usage, // Use usage from precharge response (may be nil for free models)
		}, nil
	}
}

// handlePrechargeRequest handles the precharge request to upstream
func handlePrechargeRequest(c *gin.Context, params *TwoRequestParams) (*UpstreamResponse, error) {
	// Build upstream URL (handles both sync and async models)
	upstreamURL := buildUpstreamURL(params.Channel.GetBaseURL(), params.ModelName)
	
	// Add precharge query parameter
	upstreamURL += "?precharge=true"

	// Make precharge request with original request body
	return makeUpstreamRequest(c, params.Channel, "POST", upstreamURL, params.RequestBody, params.AuthService, params.HTTPClient)
}

// buildUpstreamURL builds the upstream API URL for the given model
func buildUpstreamURL(baseURL, modelName string) string {
	// For async models ending with /submit, construct submit endpoint
	if strings.HasSuffix(modelName, "/submit") {
		return buildTaskSubmitURL(baseURL, modelName)
	}
	return fmt.Sprintf("%s/%s", strings.TrimSuffix(baseURL, "/"), modelName)
}

// buildTaskSubmitURL builds the URL for task submission
func buildTaskSubmitURL(baseURL, modelName string) string {
	// Remove /submit suffix from model name for URL construction
	cleanModelName := strings.TrimSuffix(modelName, "/submit")
	return fmt.Sprintf("%s/%s/submit", strings.TrimSuffix(baseURL, "/"), cleanModelName)
}

// makeUpstreamRequest makes HTTP request to upstream API
func makeUpstreamRequest(c *gin.Context, channel *model.Channel, method, url string, body []byte, 
	authService service.CustomPassAuthService, httpClient *http.Client) (*UpstreamResponse, error) {
	
	// Create request with context
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeSystemError,
			Message: "创建上游请求失败",
			Details: err.Error(),
		}
	}

	// Build authentication headers
	userToken := c.GetString("token_key")
	headers := authService.BuildUpstreamHeaders(channel, userToken)

	// Set headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	// Set additional headers
	req.Header.Set("Content-Type", "application/json")
	if userAgent := c.GetHeader("User-Agent"); userAgent != "" {
		req.Header.Set("User-Agent", userAgent)
	}

	// Log upstream request details
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 公共适配器上游API - URL: %s", url))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 公共适配器Headers: %+v", headers))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 公共适配器Body: %s", string(body)))

	// Make request
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeTimeout,
			Message: "上游API请求失败",
			Details: err.Error(),
		}
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: "读取上游响应失败",
			Details: err.Error(),
		}
	}

	// Log upstream response
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 公共适配器响应状态码: %d", resp.StatusCode))
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 公共适配器响应Body: %s", string(respBody)))

	// Parse response
	upstreamResp, err := ParseUpstreamResponse(respBody)
	if err != nil {
		return nil, err
	}

	// Log parsed response structure before validation
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 验证前的上游响应内容 - Code: %v, Message: %s, Msg: %s, Type: %s, Usage: %+v", 
		upstreamResp.Code, upstreamResp.Message, upstreamResp.Msg, upstreamResp.Type, upstreamResp.Usage))
	
	// Validate response structure
	if err := upstreamResp.ValidateResponse(); err != nil {
		common.SysError(fmt.Sprintf("[CustomPass-Response-Debug] 响应验证失败: %v", err))
		return nil, err
	}

	// Check if upstream returned an error
	if !upstreamResp.IsSuccess() {
		errorMsg := upstreamResp.GetMessage()
		if errorMsg == "" {
			errorMsg = fmt.Sprintf("上游API返回错误，code: %v", upstreamResp.Code)
		}
		common.SysError(fmt.Sprintf("[CustomPass-Response-Debug] 上游API返回错误 - Code: %v, Message: %s", upstreamResp.Code, errorMsg))
		return nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: errorMsg,
			Details: fmt.Sprintf("upstream code: %v", upstreamResp.Code),
		}
	}

	return upstreamResp, nil
}

// checkModelBilling checks if the model requires billing
func checkModelBilling(modelName string) (bool, error) {
	// Handle test environment where DB might be nil
	if model.DB == nil {
		// In test environment, assume billing is required for testing purposes
		// unless the model name contains "free"
		return !strings.Contains(strings.ToLower(modelName), "free"), nil
	}

	// Check if model exists in ability table
	var abilityCount int64
	err := model.DB.Model(&model.Ability{}).Where("model = ? AND enabled = ?", modelName, true).Count(&abilityCount).Error
	if err != nil {
		return false, &CustomPassError{
			Code:    ErrCodeSystemError,
			Message: "查询模型配置失败",
			Details: err.Error(),
		}
	}

	// If model not found in ability table, treat as free model
	return abilityCount > 0, nil
}
