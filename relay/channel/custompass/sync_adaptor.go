package custompass

import (
	"encoding/json"
	"fmt"
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


	// Use the common two-request flow for all requests
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
