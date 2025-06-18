package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"one-api/common"
	"strings"

	"github.com/gin-gonic/gin"
)

func abortWithOpenAiMessage(c *gin.Context, statusCode int, message string) {
	userId := c.GetInt("id")

	// 获取请求体内容
	var requestBody []byte
	if c.Request.Body != nil {
		requestBody, _ = io.ReadAll(c.Request.Body)
		// 恢复请求体，以便后续处理
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	}

	// 准备错误响应
	errorResponse := gin.H{
		"error": gin.H{
			"message": common.MessageWithRequestId(message, c.GetString(common.RequestIdKey)),
			"type":    "new_api_error",
		},
	}

	// 将错误响应转换为JSON字符串，确保中文正确显示
	var responseBuffer bytes.Buffer
	encoder := json.NewEncoder(&responseBuffer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "")
	encoder.Encode(errorResponse)
	responseStr := strings.TrimSpace(responseBuffer.String())

	// 将请求体转换为紧凑的JSON格式
	if len(requestBody) > 0 {
		var jsonObj interface{}
		if err := json.Unmarshal(requestBody, &jsonObj); err == nil {
			if prettyJSON, err := json.Marshal(jsonObj); err == nil {
				requestStr := strings.ReplaceAll(string(prettyJSON), "\n", "")
				common.LogError(c.Request.Context(), fmt.Sprintf("user %d | %s | request body: %s | response body: %s",
					userId,
					message,
					requestStr,
					responseStr))
			}
		}
	}

	c.JSON(statusCode, errorResponse)
	c.Abort()
}
