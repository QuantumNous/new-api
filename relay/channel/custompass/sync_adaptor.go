package custompass

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/model"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// SyncAdaptor interface defines synchronous pass-through operations for CustomPass
type SyncAdaptor interface {
	// ProcessRequest processes a synchronous CustomPass request
	ProcessRequest(c *gin.Context, channel *model.Channel, modelName string) error

	// BuildUpstreamURL builds the upstream API URL
	BuildUpstreamURL(baseURL, modelName string) string

	// HandlePrecharge handles precharge request and returns precharge response
	HandlePrecharge(c *gin.Context, channel *model.Channel, modelName string, requestBody []byte) (*UpstreamResponse, error)

	// HandleRealRequest handles the real request after precharge
	HandleRealRequest(c *gin.Context, channel *model.Channel, modelName string, requestBody []byte) (*UpstreamResponse, error)

	// ProcessResponse processes the upstream response and handles billing
	ProcessResponse(c *gin.Context, user *model.User, modelName string, response *UpstreamResponse, prechargeAmount int64) error
}

// SyncAdaptorImpl implements SyncAdaptor interface
type SyncAdaptorImpl struct {
	authService      service.CustomPassAuthService
	prechargeService service.CustomPassPrechargeService
	billingService   service.CustomPassBillingService
	httpClient       *http.Client
}

// NewSyncAdaptor creates a new synchronous CustomPass adaptor
func NewSyncAdaptor() SyncAdaptor {
	return &SyncAdaptorImpl{
		authService:      service.NewCustomPassAuthService(),
		prechargeService: service.NewCustomPassPrechargeService(),
		billingService:   service.NewCustomPassBillingService(),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ProcessRequest processes a synchronous CustomPass request with precharge and billing
func (a *SyncAdaptorImpl) ProcessRequest(c *gin.Context, channel *model.Channel, modelName string) error {
	// Check for precharge parameter in query string first (before any other validation)
	if c.Query("precharge") == "true" {
		return &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "同步模式不支持precharge参数",
		}
	}

	// Get user token from context
	userToken := c.GetString("token_key")
	if userToken == "" {
		userToken = c.GetString("token")
	}
	if userToken == "" {
		return &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "用户token缺失",
		}
	}

	// Validate user token
	user, err := a.authService.ValidateUserToken(userToken)
	if err != nil {
		return &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "用户认证失败",
			Details: err.Error(),
		}
	}

	// Validate channel access
	err = a.authService.ValidateChannelAccess(user, channel)
	if err != nil {
		return &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "渠道访问验证失败",
			Details: err.Error(),
		}
	}

	// Get request body
	requestBody, err := common.GetRequestBody(c)
	if err != nil {
		return &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "读取请求体失败",
			Details: err.Error(),
		}
	}

	// Check if model requires billing
	requiresBilling, err := a.checkModelBilling(modelName)
	if err != nil {
		return err
	}

	if requiresBilling {
		// Use the common two-request flow
		params := &TwoRequestParams{
			User:             user,
			Channel:          channel,
			ModelName:        modelName,
			RequestBody:      requestBody,
			AuthService:      a.authService,
			PrechargeService: a.prechargeService,
			BillingService:   a.billingService,
			HTTPClient:       a.httpClient,
		}

		result, err := ExecuteTwoRequestFlow(c, params)
		if err != nil {
			return err
		}

		// Process response and handle billing
		return a.ProcessResponse(c, user, modelName, result.Response, result.PrechargeAmount)
	} else {
		// Model doesn't require billing, send request directly
		common.SysLog(fmt.Sprintf("[CustomPass-TwoRequest-Debug] 模型%s不需要计费，直接发起请求", modelName))
		realResp, err := a.HandleRealRequest(c, channel, modelName, requestBody)
		if err != nil {
			return err
		}

		// Process response without billing
		return a.ProcessResponse(c, user, modelName, realResp, 0)
	}
}

// BuildUpstreamURL builds the upstream API URL for the given model
func (a *SyncAdaptorImpl) BuildUpstreamURL(baseURL, modelName string) string {
	return fmt.Sprintf("%s/%s", strings.TrimSuffix(baseURL, "/"), modelName)
}

// HandlePrecharge handles precharge request to get usage estimation
func (a *SyncAdaptorImpl) HandlePrecharge(c *gin.Context, channel *model.Channel, modelName string, requestBody []byte) (*UpstreamResponse, error) {
	// Build upstream URL
	upstreamURL := a.BuildUpstreamURL(channel.GetBaseURL(), modelName)

	// Add precharge parameter to request body
	var requestData map[string]interface{}
	if err := json.Unmarshal(requestBody, &requestData); err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "解析请求体失败",
			Details: err.Error(),
		}
	}

	// Add precharge flag
	requestData["precharge"] = true

	// Marshal modified request
	modifiedBody, err := json.Marshal(requestData)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "构建预扣费请求失败",
			Details: err.Error(),
		}
	}

	// Make precharge request
	return a.makeUpstreamRequest(c, channel, "POST", upstreamURL, modifiedBody)
}

// HandleRealRequest handles the real request after precharge
func (a *SyncAdaptorImpl) HandleRealRequest(c *gin.Context, channel *model.Channel, modelName string, requestBody []byte) (*UpstreamResponse, error) {
	// Build upstream URL
	upstreamURL := a.BuildUpstreamURL(channel.GetBaseURL(), modelName)

	// Make real request (without precharge flag)
	return a.makeUpstreamRequest(c, channel, "POST", upstreamURL, requestBody)
}

// ProcessResponse processes the upstream response and handles billing settlement
func (a *SyncAdaptorImpl) ProcessResponse(c *gin.Context, user *model.User, modelName string, response *UpstreamResponse, prechargeAmount int64) error {
	// Check if response is successful
	if !response.IsSuccess() {
		// Refund precharge amount on error
		if prechargeAmount > 0 {
			if err := a.prechargeService.ProcessRefund(user.Id, prechargeAmount, 0); err != nil {
				common.SysError(fmt.Sprintf("退款失败: %v", err))
			}
		}

		// Return upstream error
		c.JSON(http.StatusBadGateway, gin.H{
			"error": gin.H{
				"message": response.GetMessage(),
				"type":    "upstream_error",
				"code":    response.Code,
			},
		})
		return nil
	}

	// Calculate actual billing amount
	var actualAmount int64 = 0
	if prechargeAmount > 0 {
		if response.Usage != nil {
			// Convert Usage to service.Usage for calculation
			serviceUsage := &service.Usage{
				PromptTokens:     response.Usage.PromptTokens,
				CompletionTokens: response.Usage.CompletionTokens,
				TotalTokens:      response.Usage.TotalTokens,
				InputTokens:      response.Usage.InputTokens,
				OutputTokens:     response.Usage.OutputTokens,
			}

			// Calculate actual amount based on real usage using billingService
			groupRatio := a.billingService.CalculateGroupRatio(user.Group)
			userRatio := a.billingService.CalculateUserRatio(user.Id)
			
			calculatedAmount, err := a.billingService.CalculatePrechargeAmount(modelName, serviceUsage, groupRatio, userRatio)
			if err != nil {
				common.SysError(fmt.Sprintf("计算实际费用失败: %v", err))
				// Use precharge amount as fallback
				actualAmount = prechargeAmount
			} else {
				actualAmount = calculatedAmount
			}
		} else {
			// No usage information, use precharge amount
			actualAmount = prechargeAmount
		}

		// Process settlement (refund or additional charge)
		if err := a.prechargeService.ProcessSettlement(user.Id, prechargeAmount, actualAmount); err != nil {
			common.SysError(fmt.Sprintf("结算失败: %v", err))
			// Continue processing response even if settlement fails
		}

		// Record consumption log if there's actual usage and not in test environment
		if response.Usage != nil && model.DB != nil && model.LOG_DB != nil {
			// Build RelayInfo to get consistent group information
			relayInfo := relaycommon.GenRelayInfo(c)
			
			// Get context information for logging
			tokenName := c.GetString("token_name")
			
			// Get model price data using helper
			priceData, err := helper.ModelPriceHelper(c, relayInfo, response.Usage.GetInputTokens(), 0)
			if err != nil {
				common.LogError(c.Request.Context(), fmt.Sprintf("获取模型价格数据失败: %v", err))
				// Use default values if price data retrieval fails
				priceData = helper.PriceData{
					ModelRatio:      1.0,
					ModelPrice:      0.0,
					CompletionRatio: 1.0,
					GroupRatioInfo: helper.GroupRatioInfo{
						GroupRatio: a.billingService.CalculateGroupRatio(relayInfo.UsingGroup),
					},
				}
			}
			
			// Generate other info for logging using standard function
			other := service.GenerateTextOtherInfo(
				c,
				relayInfo,
				priceData.ModelRatio,
				priceData.GroupRatioInfo.GroupRatio,
				priceData.CompletionRatio,
				0,     // cacheTokens
				0.0,   // cacheRatio
				priceData.ModelPrice,
				priceData.GroupRatioInfo.GroupSpecialRatio,
			)
			
			// Record consumption log using the standard function
			model.RecordConsumeLog(c, user.Id, model.RecordConsumeLogParams{
				ChannelId:        relayInfo.ChannelId,
				PromptTokens:     response.Usage.GetInputTokens(),
				CompletionTokens: response.Usage.GetOutputTokens(),
				ModelName:        modelName,
				TokenName:        tokenName,
				Quota:            int(actualAmount),
				Content:          fmt.Sprintf("CustomPass同步请求: %s", modelName),
				IsStream:         false,
				Group:            relayInfo.UsingGroup,
				Other:            other,
			})
		}
	}

	// Forward response to client
	responseData, err := json.Marshal(response)
	if err != nil {
		return &CustomPassError{
			Code:    ErrCodeSystemError,
			Message: "序列化响应失败",
			Details: err.Error(),
		}
	}

	c.Header("Content-Type", "application/json")
	c.Status(http.StatusOK)
	c.Writer.Write(responseData)

	return nil
}

// makeUpstreamRequest makes HTTP request to upstream API
func (a *SyncAdaptorImpl) makeUpstreamRequest(c *gin.Context, channel *model.Channel, method, url string, body []byte) (*UpstreamResponse, error) {
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
	// Use full_token if available (for CustomPass), otherwise use token_key or token
	userToken := c.GetString("full_token")
	if userToken == "" {
		userToken = c.GetString("token_key")
	}
	if userToken == "" {
		userToken = c.GetString("token")
	}
	headers := a.authService.BuildUpstreamHeaders(channel.Key, userToken)

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
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 同步适配器上游API - URL: %s", url))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 同步适配器Headers: %+v", headers))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 同步适配器Body: %s", string(body)))

	// Make request
	resp, err := a.httpClient.Do(req)
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
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 同步适配器响应状态码: %d", resp.StatusCode))
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 同步适配器响应Body: %s", string(respBody)))

	// Parse response
	upstreamResp, err := ParseUpstreamResponse(respBody)
	if err != nil {
		return nil, err
	}

	// Validate response structure
	if err := upstreamResp.ValidateResponse(); err != nil {
		return nil, err
	}

	return upstreamResp, nil
}

// checkModelBilling checks if the model requires billing
func (a *SyncAdaptorImpl) checkModelBilling(modelName string) (bool, error) {
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

// Convenience functions for external use

// ProcessSyncRequest processes a synchronous CustomPass request
func ProcessSyncRequest(c *gin.Context, channel *model.Channel, modelName string) error {
	adaptor := NewSyncAdaptor()
	return adaptor.ProcessRequest(c, channel, modelName)
}

// BuildSyncUpstreamURL builds upstream URL for sync requests
func BuildSyncUpstreamURL(baseURL, modelName string) string {
	adaptor := NewSyncAdaptor()
	return adaptor.BuildUpstreamURL(baseURL, modelName)
}
