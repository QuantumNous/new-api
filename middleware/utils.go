package middleware

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func abortWithOpenAiMessage(c *gin.Context, statusCode int, message string, code ...types.ErrorCode) {
	abortWithOpenAiMessageCategory(c, constant.ErrorCategoryOther, statusCode, message, code...)
}

func abortWithOpenAiMessageCategory(c *gin.Context, category string, statusCode int, message string, code ...types.ErrorCode) {
	codeStr := ""
	if len(code) > 0 {
		codeStr = string(code[0])
	}
	service.RecordRequestErrorLog(c, category, message, map[string]interface{}{
		"status_code": statusCode,
		"error_code":  codeStr,
	}, false)
	userId := c.GetInt("id")
	c.JSON(statusCode, gin.H{
		"error": gin.H{
			"message": common.MessageWithRequestId(message, c.GetString(common.RequestIdKey)),
			"type":    "new_api_error",
			"code":    codeStr,
		},
	})
	c.Abort()
	logger.LogError(c.Request.Context(), fmt.Sprintf("user %d | %s", userId, message))
}

func abortWithMidjourneyMessage(c *gin.Context, statusCode int, code int, description string) {
	abortWithMidjourneyMessageCategory(c, constant.ErrorCategoryOther, statusCode, code, description)
}

func abortWithMidjourneyMessageCategory(c *gin.Context, category string, statusCode int, code int, description string) {
	service.RecordRequestErrorLog(c, category, description, map[string]interface{}{
		"status_code": statusCode,
		"error_code":  code,
	}, false)
	c.JSON(statusCode, gin.H{
		"description": description,
		"type":        "new_api_error",
		"code":        code,
	})
	c.Abort()
	logger.LogError(c.Request.Context(), description)
}
