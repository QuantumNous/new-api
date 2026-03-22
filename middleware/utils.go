package middleware

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func abortWithOpenAiMessage(c *gin.Context, statusCode int, message string, code ...types.ErrorCode) {
	codeStr := ""
	if len(code) > 0 {
		codeStr = string(code[0])
	}
	userId := c.GetInt("id")
	messageWithRequestID := common.MessageWithRequestId(message, c.GetString(common.RequestIdKey))
	if service.ShouldWriteResponsesBootstrapStreamError(c) {
		helper.SetEventStreamHeaders(c)
		service.MarkResponsesBootstrapHeadersSent(c)
		err := helper.OpenAIErrorEvent(c, types.OpenAIError{
			Message: messageWithRequestID,
			Type:    "new_api_error",
			Code:    codeStr,
		})
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("user %d | write bootstrap stream error failed: %s", userId, err.Error()))
		}
		c.Abort()
		logger.LogError(c.Request.Context(), fmt.Sprintf("user %d | %s", userId, message))
		return
	}
	c.JSON(statusCode, gin.H{
		"error": gin.H{
			"message": messageWithRequestID,
			"type":    "new_api_error",
			"code":    codeStr,
		},
	})
	c.Abort()
	logger.LogError(c.Request.Context(), fmt.Sprintf("user %d | %s", userId, message))
}

func abortWithMidjourneyMessage(c *gin.Context, statusCode int, code int, description string) {
	c.JSON(statusCode, gin.H{
		"description": description,
		"type":        "new_api_error",
		"code":        code,
	})
	c.Abort()
	logger.LogError(c.Request.Context(), description)
}
