package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	TestTrafficHeader = "X-Test-Traffic"
)

func MockResponse() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 检查是否是测试流量
		if c.GetHeader(TestTrafficHeader) == "true" {
			// 构造mock响应数据
			mockResponse := map[string]interface{}{
				"id":      "chatcmpl-7f757876e4a24f75a4b0025b4d8a0e62",
				"model":   "gemini-2.5-pro-preview-05-06",
				"object":  "chat.completion",
				"created": 1748702089,
				"choices": []map[string]interface{}{
					{
						"index": 0,
						"message": map[string]interface{}{
							"role":    "assistant",
							"content": "测试结果是1 + 1 = 2",
						},
						"finish_reason": "stop",
					},
				},
				"usage": map[string]interface{}{
					"prompt_tokens":     6,
					"completion_tokens": 7,
					"total_tokens":      154,
					"prompt_tokens_details": map[string]interface{}{
						"cached_tokens": 0,
						"text_tokens":   0,
						"audio_tokens":  0,
						"image_tokens":  0,
					},
					"completion_tokens_details": map[string]interface{}{
						"text_tokens":      0,
						"audio_tokens":     0,
						"reasoning_tokens": 141,
					},
				},
			}

			// 设置响应头
			c.Header("Content-Type", "application/json")
			c.JSON(http.StatusOK, mockResponse)
			c.Abort()
			return
		}
		c.Next()
	}
}
