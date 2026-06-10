package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/security"

	"github.com/gin-gonic/gin"
)

// SecurityCheck 请求内容安全检测中间件
func SecurityCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !security.IsSecurityEnabled() {
			c.Next()
			return
		}

		// 只对聊天补全接口进行检测
		if !isChatCompletionEndpoint(c.Request.URL.Path) {
			c.Next()
			return
		}

		// 获取当前用户
		userId := c.GetInt("id")
		if userId == 0 {
			c.Next()
			return
		}

		// 读取请求体
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			common.SysLog("读取请求体失败: " + err.Error())
			c.Next()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		// 解析请求内容
		content := extractContentFromRequest(bodyBytes)
		if content == "" {
			c.Next()
			return
		}

		modelName := extractModelFromRequest(bodyBytes)

		// 执行检测
		ctx := context.Background()
		result, err := security.GetDetectionEngine().Detect(ctx, userId, content, constant.SecurityContentTypeRequest, modelName)
		if err != nil {
			common.SysLog("安全检测错误: " + err.Error())
			c.Next()
			return
		}

		if result.Detected {
			switch result.Action {
			case constant.SecurityActionBlock:
				c.JSON(http.StatusForbidden, gin.H{
					"success": false,
					"message": getBlockMessage(userId),
				})
				c.Abort()
				return
			case constant.SecurityActionMask:
				// 替换请求体中的敏感内容
				newBody := replaceContentInRequest(bodyBytes, content, result.ProcessedContent)
				c.Request.Body = io.NopCloser(bytes.NewBuffer(newBody))
				c.Request.ContentLength = int64(len(newBody))
			}
		}

		c.Next()
	}
}

// SecurityCheckResponse 响应内容安全检测中间件
func SecurityCheckResponse() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !security.IsSecurityEnabled() {
			c.Next()
			return
		}

		// 先执行后续处理获取响应
		c.Next()

		// 只对聊天补全接口进行检测
		if !isChatCompletionEndpoint(c.Request.URL.Path) {
			return
		}

		userId := c.GetInt("id")
		if userId == 0 {
			return
		}

		// TODO: 响应检测需要拦截响应体，这里使用简单的代理模式
		// 实际实现需要使用 gin 的响应重写机制或自定义 ResponseWriter
	}
}

// isChatCompletionEndpoint 判断是否为聊天补全接口
func isChatCompletionEndpoint(path string) bool {
	return strings.HasSuffix(path, "/chat/completions") || strings.HasSuffix(path, "/completions")
}

// extractContentFromRequest 从请求体中提取用户内容
func extractContentFromRequest(body []byte) string {
	var req struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}

	if err := json.Unmarshal(body, &req); err != nil {
		return ""
	}

	var contents []string
	for _, msg := range req.Messages {
		if msg.Role == "user" && msg.Content != "" {
			contents = append(contents, msg.Content)
		}
	}

	return strings.Join(contents, "\n")
}

// extractModelFromRequest 从请求体中提取模型名称
func extractModelFromRequest(body []byte) string {
	var req struct {
		Model string `json:"model"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return ""
	}
	return req.Model
}

// replaceContentInRequest 替换请求体中的内容
func replaceContentInRequest(body []byte, oldContent, newContent string) []byte {
	return []byte(strings.Replace(string(body), oldContent, newContent, -1))
}

// getBlockMessage 获取拦截提示消息
func getBlockMessage(userId int) string {
	// 尝试获取用户的自定义拦截消息
	policies, err := security.GetUserPolicies(userId)
	if err != nil {
		return "请求包含敏感内容，已被拦截。"
	}

	for _, policy := range policies {
		if policy.CustomResponse != "" {
			return policy.CustomResponse
		}
	}

	return "请求包含敏感内容，已被拦截。"
}
