package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"one-api/common"

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

	// 先解析JSON字符串，再处理数据结构
	var responseStr string
	responseJsonStr := responseBuffer.String()
	var jsonObj interface{}
	if err := json.Unmarshal([]byte(responseJsonStr), &jsonObj); err == nil {
		processedData := common.ProcessMapValues(jsonObj)
		if processedJSON, err := json.Marshal(processedData); err == nil {
			responseStr = string(processedJSON)
		} else {
			responseStr = responseJsonStr
		}
	} else {
		responseStr = responseJsonStr
	}

	// 将请求体转换为紧凑的JSON格式
	requestStr := common.LogRequestBody(c)

	// 记录日志
	common.LogError(c.Request.Context(), fmt.Sprintf("user %d | %s | request body: %s | response body: %s",
		userId,
		message,
		requestStr,
		responseStr))

	c.JSON(statusCode, errorResponse)
	c.Abort()
}
