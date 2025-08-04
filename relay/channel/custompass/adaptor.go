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
	"one-api/relay/helper"
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
	BillingInfo     *model.BillingInfo // Billing context used for precharge
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
	// Determine billing mode for the model
	billingMode := params.BillingService.DetermineBillingMode(params.ModelName)
	
	if billingMode == service.BillingModeFree {
		// Model doesn't require billing, send request directly
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 模型%s不需要计费，直接发起请求", params.ModelName))
		realResp, err := makeUpstreamRequest(c, params.Channel, "POST", 
			buildUpstreamURL(params.Channel.GetBaseURL(), params.ModelName), 
			params.RequestBody, params.AuthService, params.HTTPClient)
		if err != nil {
			model.RecordConsumeLog(c, params.User.Id, model.RecordConsumeLogParams{
				ChannelId:        params.Channel.Id,
				PromptTokens:     0,
				CompletionTokens: 0,
				ModelName:        params.ModelName,
				TokenName:        c.GetString("token_name"),
				Quota:            0,
				Content:          "请求失败: " + err.Error(),
			})
			return nil, err
		}

		return &TwoRequestResult{
			Response:        realResp,
			PrechargeAmount: 0,
			RequestCount:    1,
			PrechargeUsage:  nil, // No precharge for free models
			BillingInfo:     nil, // No billing for free models
		}, nil
	}


	// 定义返回结果变量                                                                     
	var result *TwoRequestResult                                                            
                                                                                     
	// Step 1: 构建RelayInfo用于标准价格计算             
	
	// 构建RelayInfo，让标准流程处理分组逻辑
	relayInfo := &relaycommon.RelayInfo{
		UserGroup: params.User.Group,
		UsingGroup: params.User.Group, // 初始值，HandleGroupRatio会根据auto_group更新
		OriginModelName: params.ModelName,
	}

	// 设置用户设置信息（如果需要的话）
	if params.User != nil {
		relayInfo.UserSetting = dto.UserSetting{
			AcceptUnsetRatioModel: false, // 根据实际需求设置
		}
	}

	// 先获取预扣费响应以获得token信息
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 模型%s需要计费，开始预扣费请求流程", params.ModelName))
	prechargeResp, err := handlePrechargeRequest(c, params)
	if err != nil {
		common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 预扣费请求失败: %v", err))
		model.RecordConsumeLog(c, params.User.Id, model.RecordConsumeLogParams{
			ChannelId:        params.Channel.Id,
			PromptTokens:     0,
			CompletionTokens: 0,
			ModelName:        params.ModelName,
			TokenName:        c.GetString("token_name"),
			Quota:            0,
			Content:          "预扣费请求失败: " + err.Error(),
		})
		return nil, err
	}

	if prechargeResp.Usage == nil {                               
		return nil, &CustomPassError{                             
			Code:    ErrCodeUpstreamError,                        
			Message: "预扣费响应缺少usage信息",                   
		}                                                         
	}

	// 使用标准ModelPriceHelper进行价格计算
	priceData, err := helper.ModelPriceHelper(c, relayInfo, 
		prechargeResp.Usage.GetInputTokens(), 
		prechargeResp.Usage.GetOutputTokens())
	if err != nil {
		common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] ModelPriceHelper失败: %v", err))
		return nil, &CustomPassError{
			Code:    ErrCodeSystemError,
			Message: "价格计算失败",
			Details: err.Error(),
		}
	}
	
	// 构建 BillingInfo
	billingInfo := &model.BillingInfo{
		GroupRatio:      priceData.GroupRatioInfo.GroupRatio,
		UserGroupRatio:  priceData.GroupRatioInfo.GroupSpecialRatio,
		ModelRatio:      priceData.ModelRatio,
		CompletionRatio: priceData.CompletionRatio,
		ModelPrice:      priceData.ModelPrice,
		BillingMode:     billingModeToString(billingMode),
		HasSpecialRatio: priceData.GroupRatioInfo.HasSpecialRatio,
	}

	// 打印计费信息 (使用标准ModelPriceHelper的结果)
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] ===== 标准价格计算结果 ====="))
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 模型: %s", params.ModelName))
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 用户ID: %d, 用户组: %s", params.User.Id, params.User.Group))
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 使用分组: %s", relayInfo.UsingGroup))
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 计费模式: %s", billingInfo.BillingMode))
	if priceData.UsePrice {
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 固定价格: %.6f", billingInfo.ModelPrice))
	} else {
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 模型倍率: %.6f", billingInfo.ModelRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 补全倍率: %.6f", billingInfo.CompletionRatio))
	}
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 组倍率: %.6f", billingInfo.GroupRatio))
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 用户特殊倍率: %.6f", billingInfo.UserGroupRatio))
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 是否使用特殊倍率: %t", billingInfo.HasSpecialRatio))
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 预消费配额: %d", priceData.ShouldPreConsumedQuota))
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] ======================"))

	// Step 3: 计算预扣费金额信息

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
	
	
	// 计算预扣费金额，使用标准ModelPriceHelper的结果                                                                          
	var prechargeAmount int64 = 0                                                                                  
	var finalUsage *Usage = prechargeResp.Usage                                                                    
                                                                                                                
	// 只有非免费的计费模式才需要计算预扣费
	if billingMode != service.BillingModeFree {
		// 直接使用ModelPriceHelper计算的预消费配额
		prechargeAmount = int64(priceData.ShouldPreConsumedQuota)
		
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] ===== 预扣费计算 ====="))                         
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 计费模式: %s", billingInfo.BillingMode))          
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 组倍率: %.6f", billingInfo.GroupRatio))                       
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 用户倍率: %.6f", billingInfo.UserGroupRatio))             
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 使用标准ModelPriceHelper计算得出预扣费金额: %d (￥%.4f)",                 
			prechargeAmount, float64(prechargeAmount)/common.QuotaPerUnit))                                        
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] ===================="))
	} else {
		common.SysLog("[CustomPass-TwoRequest-Debug] 免费模型(BillingModeFree)，无需计算预扣费")
	}                           


	// 使用prechargeResp的信息构建 返回参数
	result = &TwoRequestResult{                                   
		Response:        prechargeResp,                           
		PrechargeAmount: prechargeAmount,                         
		RequestCount:    1,                                       
		PrechargeUsage:  finalUsage,                              
		BillingInfo:     billingInfo,                             
	} 
	

	// 执行预扣费（只有金额大于0才执行）
	if prechargeAmount > 0 {
		serviceUsageForPrecharge := &service.Usage{
			PromptTokens:     prechargeResp.Usage.PromptTokens,
			CompletionTokens: prechargeResp.Usage.CompletionTokens,
			TotalTokens:      prechargeResp.Usage.TotalTokens,
			InputTokens:      prechargeResp.Usage.InputTokens,
			OutputTokens:     prechargeResp.Usage.OutputTokens,
		}
		
		prechargeResult, _, err := params.PrechargeService.ExecutePrecharge(c, params.User, params.ModelName, serviceUsageForPrecharge)
		if err != nil {
			return nil, &CustomPassError{
				Code:    ErrCodeInsufficientQuota,
				Message: "预扣费执行失败",
				Details: err.Error(),
			}
		}
		// 使用实际扣除的金额
		prechargeAmount = prechargeResult.PrechargeAmount
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 预扣费执行成功，实际扣除: %d (￥%.4f)", 
			prechargeAmount, float64(prechargeAmount)/common.QuotaPerUnit))
	}

	// Check if upstream returned precharge response
	
	common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 检查上游响应类型 - Type: %s, IsPrecharge: %t", 
		prechargeResp.Type, prechargeResp.IsPrecharge()))

	// 如果需要进行第二次业务请求，将业务请求的结果返回出去
	if prechargeResp.IsPrecharge() {
		common.SysLog("[CustomPass-TwoRequest-Debug] 上游支持预扣费，将发起两次请求")

		realResp, err := executeSecondBizRequest(c, params, prechargeResp)                    
        if err != nil {                                                                     
            common.SysError(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 二次请求失败: %v", err))
            // 记录错误信息到logs
            model.RecordConsumeLog(c, params.User.Id, model.RecordConsumeLogParams{
				ChannelId:        params.Channel.Id,
				PromptTokens:     0,
				CompletionTokens: 0,
				ModelName:        params.ModelName,
				TokenName:        c.GetString("token_name"),
				Quota:            int(prechargeAmount),
				Content:          "二次请求失败: " + err.Error(),
			})
            
            // 退还预扣费
            if prechargeAmount > 0 {
                common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 退还预扣费: %d", prechargeAmount))
                params.PrechargeService.ProcessRefund(params.User.Id, prechargeAmount, 0)
            }
			return nil, err                                                                 
        } 

		// 使用真实响应的usage（如果有）
		if realResp.Usage != nil {
			finalUsage = realResp.Usage
			common.SysLog("[CustomPass-TwoRequest-Debug] 使用真实响应的usage作为最终usage")
		}

		// 构建返回结果                                               
		result.Response = realResp
		result.RequestCount = 2
	} 
                                                                                                                                                                                                                                                    
    // 返回结果                                                       
    return result, nil   

}

// executeSecondBizRequest handles the second business request
// 只负责发送第二次业务请求和校验响应
func executeSecondBizRequest(c *gin.Context, params *TwoRequestParams, prechargeResp *UpstreamResponse) (*UpstreamResponse, error) {
	// Log the usage from precharge response for debugging
	common.SysLog(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] ===== 开始第二次业务请求 ====="))
	if prechargeResp.Usage != nil {
		common.SysLog(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] 预扣费响应usage - 输入: %d, 输出: %d", 
			prechargeResp.Usage.GetInputTokens(), prechargeResp.Usage.GetOutputTokens()))
	}

	// Send business request
	common.SysLog("[CustomPass-SecondBizRequest-Debug] 发起真实业务请求")
	common.SysLog(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] 第二次请求上游接口 - URL: %s", buildUpstreamURL(params.Channel.GetBaseURL(), params.ModelName)))
	realResp, err := makeUpstreamRequest(c, params.Channel, "POST", 
		buildUpstreamURL(params.Channel.GetBaseURL(), params.ModelName), 
		params.RequestBody, params.AuthService, params.HTTPClient)
	if err != nil {
		common.SysError(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] 业务请求失败: %v", err))
		return nil, err
	}

	// 校验响应是否成功
	if !realResp.IsSuccess() {
		return nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: "上游业务请求失败",
			Details: realResp.GetMessage(),
		}
	}

	common.SysLog("[CustomPass-SecondBizRequest-Debug] 业务请求成功")
	
	// Log usage comparison if available
	if realResp.Usage != nil && prechargeResp.Usage != nil {
		common.SysLog(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] Usage对比:"))
		common.SysLog(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] 真实usage - 输入: %d, 输出: %d", 
			realResp.Usage.GetInputTokens(), realResp.Usage.GetOutputTokens()))
		common.SysLog(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] 预扣费usage - 输入: %d, 输出: %d", 
			prechargeResp.Usage.GetInputTokens(), prechargeResp.Usage.GetOutputTokens()))
		common.SysLog(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] 差异 - 输入: %d, 输出: %d", 
			realResp.Usage.GetInputTokens() - prechargeResp.Usage.GetInputTokens(),
			realResp.Usage.GetOutputTokens() - prechargeResp.Usage.GetOutputTokens()))
	}
	common.SysLog(fmt.Sprintf("[CustomPass-SecondBizRequest-Debug] ===== 第二次业务请求完成 ====="))

	return realResp, nil
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


// billingModeToString converts BillingMode to string
func billingModeToString(mode service.BillingMode) string {
	switch mode {
	case service.BillingModeUsage:
		return "usage"
	case service.BillingModeFixed:
		return "fixed"
	default:
		return "free"
	}
}
