package middleware

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

func abortWithRelayMessage(c *gin.Context, statusCode int, message string, code ...types.ErrorCode) {
	errorCode := types.ErrorCode("")
	if len(code) > 0 {
		errorCode = code[0]
	}
	userId := c.GetInt("id")
	requestID := c.GetString(common.RequestIdKey)
	if strings.HasPrefix(c.Request.URL.Path, "/v1/messages") {
		newAPIError := types.NewClaudeError(
			errors.New(message),
			errorCode,
			statusCode,
			types.ErrOptionWithClaudeRequestID(requestID),
		)
		c.JSON(statusCode, newAPIError.ToClaudeErrorResponse())
	} else {
		c.JSON(statusCode, gin.H{
			"error": gin.H{
				"message": common.MessageWithRequestId(message, requestID),
				"type":    "new_api_error",
				"code":    string(errorCode),
			},
		})
	}
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
