package relay

import (
	"encoding/json"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/model"
	"one-api/relay/channel/custompass"
	"one-api/types"

	"github.com/gin-gonic/gin"
)

// CustomPassHelper handles CustomPass relay requests
func CustomPassHelper(c *gin.Context) *types.NewAPIError {
	// Get CustomPass context information
	modelValue, exists := c.Get("custompass_model")
	if !exists {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("CustomPass模型信息缺失"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
		)
	}

	isAsync, _ := c.Get("custompass_is_async")
	isQuery, _ := c.Get("custompass_is_query")

	modelStr := modelValue.(string)
	isAsyncBool := isAsync.(bool)
	isQueryBool, _ := isQuery.(bool)

	// Get channel information from context
	channelId := c.GetInt("channel_id")
	if channelId == 0 {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("渠道信息缺失"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
		)
	}

	// Get channel details
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("获取渠道信息失败: %v", err),
			types.ErrorCodeGetChannelFailed,
			http.StatusInternalServerError,
		)
	}

	// Validate channel type
	if channel.Type != constant.ChannelTypeCustomPass {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("渠道类型不匹配"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
		)
	}

	// Log request information
	common.LogInfo(c.Request.Context(), fmt.Sprintf("CustomPass request: model=%s, isAsync=%t, isQuery=%t, userID=%d",
		modelStr, isAsyncBool, isQueryBool, c.GetInt("id")))

	// Use new adaptors for handling requests
	var handlerErr error
	
	if isQueryBool {
		// Handle task query request using async adaptor
		asyncAdaptor := custompass.NewAsyncAdaptor()
		
		// Get request body for task IDs
		requestBody, err := common.GetRequestBody(c)
		if err != nil {
			return types.NewErrorWithStatusCode(
				err,
				types.ErrorCodeReadRequestBodyFailed,
				http.StatusBadRequest,
			)
		}
		
		// Parse task IDs from request
		var queryRequest custompass.TaskQueryRequest
		if err := json.Unmarshal(requestBody, &queryRequest); err != nil {
			return types.NewErrorWithStatusCode(
				fmt.Errorf("解析任务查询请求失败: %v", err),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
			)
		}
		
		// Query tasks
		queryResp, err := asyncAdaptor.QueryTasks(queryRequest.TaskIDs, channel, modelStr)
		if err != nil {
			handlerErr = err
		} else {
			// Forward response to client
			respBytes, _ := json.Marshal(queryResp)
			c.Header("Content-Type", "application/json")
			c.Status(http.StatusOK)
			c.Writer.Write(respBytes)
			return nil
		}
	} else if isAsyncBool {
		// Handle async task submission
		asyncAdaptor := custompass.NewAsyncAdaptor()
		
		// Process task submission with upstream request and precharge
		submitResp, err := asyncAdaptor.SubmitTask(c, channel, modelStr)
		if err != nil {
			handlerErr = err
		} else {
			// Forward response to client
			respBytes, _ := json.Marshal(submitResp)
			c.Header("Content-Type", "application/json")
			c.Status(http.StatusOK)
			c.Writer.Write(respBytes)
			return nil
		}
	} else {
		// Handle sync request
		syncAdaptor := custompass.NewSyncAdaptor()
		handlerErr = syncAdaptor.ProcessRequest(c, channel, modelStr)
		if handlerErr == nil {
			// Response already sent by adaptor
			return nil
		}
	}

	// Convert error to types.NewAPIError
	if handlerErr != nil {
		return convertToAPIError(handlerErr)
	}

	return nil
}

// convertToAPIError converts CustomPassError to types.NewAPIError
func convertToAPIError(err error) *types.NewAPIError {
	if err == nil {
		return nil
	}

	// Check if it's already a NewAPIError
	if apiErr, ok := err.(*types.NewAPIError); ok {
		return apiErr
	}

	// Check if it's a CustomPassError
	if customErr, ok := err.(*custompass.CustomPassError); ok {
		// Map CustomPass error codes to API error codes
		var apiErrorCode types.ErrorCode
		var statusCode int

		switch customErr.Code {
		case custompass.ErrCodeInvalidRequest:
			apiErrorCode = types.ErrorCodeInvalidRequest
			statusCode = http.StatusBadRequest
		case custompass.ErrCodeInsufficientQuota:
			apiErrorCode = types.ErrorCodeInsufficientUserQuota
			statusCode = http.StatusPaymentRequired
		case custompass.ErrCodeTimeout:
			apiErrorCode = types.ErrorCodeDoRequestFailed
			statusCode = http.StatusGatewayTimeout
		case custompass.ErrCodeUpstreamError:
			apiErrorCode = types.ErrorCodeBadResponse
			statusCode = http.StatusBadGateway
		case custompass.ErrCodeSystemError:
			apiErrorCode = types.ErrorCodeBadResponse
			statusCode = http.StatusInternalServerError
		default:
			apiErrorCode = types.ErrorCodeBadResponse
			statusCode = http.StatusInternalServerError
		}

		// Build error message
		message := customErr.Message
		if customErr.Details != "" {
			message = fmt.Sprintf("%s: %s", message, customErr.Details)
		}

		return types.NewErrorWithStatusCode(
			fmt.Errorf(message),
			apiErrorCode,
			statusCode,
		)
	}

	// For other errors, return a generic error
	return types.NewErrorWithStatusCode(
		err,
		types.ErrorCodeBadResponse,
		http.StatusInternalServerError,
	)
}