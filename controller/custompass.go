package controller

import (
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/relay"
	"strings"

	"github.com/gin-gonic/gin"
)

// RelayCustomPass handles CustomPass requests
func RelayCustomPass(c *gin.Context) {
	// Validate request method
	if c.Request.Method != http.MethodPost {
		handleCustomPassError(c, http.StatusMethodNotAllowed, "method_not_allowed",
			"只支持POST请求", "")
		return
	}

	// Parse the model from URL path - use wildcard parameter
	modelPath := c.Param("model")
	if modelPath == "" {
		handleCustomPassError(c, http.StatusBadRequest, "missing_model",
			"模型参数不能为空", "")
		return
	}

	// Remove leading slash from wildcard parameter
	modelPath = strings.TrimPrefix(modelPath, "/")

	// Validate model path format
	if err := validateModelPath(modelPath); err != nil {
		handleCustomPassError(c, http.StatusBadRequest, "invalid_model",
			err.Error(), "")
		return
	}

	// Check if client request contains precharge parameter (forbidden)
	if c.Query("precharge") != "" {
		handleCustomPassError(c, http.StatusBadRequest, "forbidden_parameter",
			"precharge参数是系统保留参数，客户端请求中不允许包含此参数", "")
		return
	}

	// Parse model and determine if this is an async task
	model, isAsync := parseCustomPassModel(modelPath)

	// Validate parsed model name
	if model == "" {
		handleCustomPassError(c, http.StatusBadRequest, "invalid_model",
			"解析后的模型名称不能为空", "")
		return
	}

	// Log request information
	common.LogInfo(c.Request.Context(), fmt.Sprintf("CustomPass request: model=%s, isAsync=%t, userID=%d",
		model, isAsync, c.GetInt("id")))

	// Store CustomPass context information
	c.Set("custompass_model", model)
	c.Set("custompass_is_async", isAsync)

	// Set relay mode for CustomPass
	c.Set("relay_mode", "custompass")

	// Call the CustomPass relay helper
	err := relay.CustomPassHelper(c)
	if err != nil {
		common.LogError(c.Request.Context(), fmt.Sprintf("CustomPass relay error: %v", err))
		c.JSON(err.StatusCode, gin.H{
			"error": err.ToOpenAIError(),
		})
		return
	}
}

// RelayCustomPassTaskQuery handles CustomPass task query requests
func RelayCustomPassTaskQuery(c *gin.Context) {
	// Validate request method
	if c.Request.Method != http.MethodPost {
		handleCustomPassError(c, http.StatusMethodNotAllowed, "method_not_allowed",
			"只支持POST请求", "")
		return
	}

	// Parse the model from URL path
	model := c.Param("model")
	if model == "" {
		handleCustomPassError(c, http.StatusBadRequest, "missing_model",
			"模型参数不能为空", "")
		return
	}

	// Validate model name format
	if err := validateModelName(model); err != nil {
		handleCustomPassError(c, http.StatusBadRequest, "invalid_model",
			err.Error(), "")
		return
	}

	// Log task query request
	common.LogInfo(c.Request.Context(), fmt.Sprintf("CustomPass task query: model=%s, userID=%d",
		model, c.GetInt("id")))

	// Store CustomPass context information for task query
	c.Set("custompass_model", model)
	c.Set("custompass_is_async", true)
	c.Set("custompass_is_query", true)

	// Set relay mode for CustomPass
	c.Set("relay_mode", "custompass")

	// Call the CustomPass relay helper
	err := relay.CustomPassHelper(c)
	if err != nil {
		common.LogError(c.Request.Context(), fmt.Sprintf("CustomPass task query error: %v", err))
		c.JSON(err.StatusCode, gin.H{
			"error": err.ToOpenAIError(),
		})
		return
	}
}

// parseCustomPassModel parses CustomPass model name and determines mode
func parseCustomPassModel(path string) (model string, isAsync bool) {
	// Remove /pass/ prefix
	model = strings.TrimPrefix(path, "/pass/")

	// Check if it's async mode (ends with /submit)
	isAsync = strings.HasSuffix(model, "/submit")

	// Keep the full model path including /submit for async models
	// The upstream URL should match the complete model path

	return model, isAsync
}

// validateModelPath validates the model path format
func validateModelPath(modelPath string) error {
	if modelPath == "" {
		return fmt.Errorf("模型路径不能为空")
	}

	// Check for invalid characters
	if strings.Contains(modelPath, "..") {
		return fmt.Errorf("模型路径不能包含'..'")
	}

	// Check for double slashes
	if strings.Contains(modelPath, "//") {
		return fmt.Errorf("模型路径格式无效")
	}

	// Check maximum length
	if len(modelPath) > 200 {
		return fmt.Errorf("模型路径长度不能超过200个字符")
	}

	return nil
}

// validateModelName validates the model name format
func validateModelName(modelName string) error {
	if modelName == "" {
		return fmt.Errorf("模型名称不能为空")
	}

	// Check for invalid characters
	if strings.Contains(modelName, "..") || strings.Contains(modelName, "/") {
		return fmt.Errorf("模型名称包含无效字符")
	}

	// Check maximum length
	if len(modelName) > 100 {
		return fmt.Errorf("模型名称长度不能超过100个字符")
	}

	return nil
}

// handleCustomPassError handles CustomPass specific errors with consistent format
func handleCustomPassError(c *gin.Context, statusCode int, errorCode, message, details string) {
	// Log the error
	common.LogError(c.Request.Context(), fmt.Sprintf("CustomPass error: %s - %s", errorCode, message))

	// Build error response
	errorResponse := gin.H{
		"error": gin.H{
			"message": message,
			"type":    "custompass_error",
			"code":    errorCode,
		},
	}

	// Add details if provided
	if details != "" {
		errorResponse["error"].(gin.H)["details"] = details
	}

	// Add request context information for debugging
	if c.GetInt("id") > 0 {
		errorResponse["error"].(gin.H)["user_id"] = c.GetInt("id")
	}

	if channelId := c.GetInt("channel_id"); channelId > 0 {
		errorResponse["error"].(gin.H)["channel_id"] = channelId
	}

	c.JSON(statusCode, errorResponse)
}
