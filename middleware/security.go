package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
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

		// 读取请求体（限制最大 10MB）
		const maxBodySize = 10 * 1024 * 1024
		bodyBytes, err := io.ReadAll(io.LimitReader(c.Request.Body, maxBodySize+1))
		if err != nil {
			common.SysLog("读取请求体失败: " + err.Error())
			c.Next()
			return
		}
		if len(bodyBytes) > maxBodySize {
			common.SysLog("请求体超过 10MB，跳过安全检测")
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

		// 只对聊天补全接口进行检测
		if !isChatCompletionEndpoint(c.Request.URL.Path) {
			c.Next()
			return
		}

		userId := c.GetInt("id")
		if userId == 0 {
			c.Next()
			return
		}

		// 使用自定义 ResponseWriter 拦截响应
		blw := &bufferedResponseWriter{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
		c.Writer = blw

		c.Next()

		// 如果响应已经写入（例如流式响应），跳过
		if blw.written {
			return
		}

		// 只处理 JSON 响应
		contentType := blw.Header().Get("Content-Type")
		if !strings.Contains(contentType, "application/json") {
			// 非 JSON 直接写回原始响应
			blw.flushOriginal()
			return
		}

		// 从响应体中提取 AI 生成内容
		body := blw.body.Bytes()
		content := extractContentFromResponse(body)
		if content == "" {
			blw.flushOriginal()
			return
		}

		// 执行检测
		ctx := context.Background()
		result, err := security.GetDetectionEngine().Detect(ctx, userId, content, constant.SecurityContentTypeResponse, "")
		if err != nil {
			common.SysLog("响应安全检测错误: " + err.Error())
			blw.flushOriginal()
			return
		}

		if result.Detected {
			switch result.Action {
			case constant.SecurityActionBlock:
				// 重写为拦截响应
				c.Writer = blw.ResponseWriter
				c.Header("Content-Type", "application/json")
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": getBlockMessage(userId),
				})
				return
			case constant.SecurityActionMask:
				// 替换响应中的敏感内容
				newBody := replaceContentInResponse(body, content, result.ProcessedContent)
				blw.Header().Set("Content-Length", strconv.Itoa(len(newBody)))
				blw.ResponseWriter.WriteHeader(blw.statusCode)
				blw.ResponseWriter.Write(newBody)
				return
			}
		}

		blw.flushOriginal()
	}
}

// bufferedResponseWriter 缓冲响应内容的 ResponseWriter
type bufferedResponseWriter struct {
	gin.ResponseWriter
	body    *bytes.Buffer
	statusCode int
	written bool
}

func (w *bufferedResponseWriter) WriteHeader(code int) {
	w.statusCode = code
}

func (w *bufferedResponseWriter) Write(b []byte) (int, error) {
	return w.body.Write(b)
}

func (w *bufferedResponseWriter) flushOriginal() {
	if w.written {
		return
	}
	w.written = true
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	w.ResponseWriter.WriteHeader(w.statusCode)
	w.ResponseWriter.Write(w.body.Bytes())
}

// extractContentFromResponse 从响应体中提取 AI 生成的内容
func extractContentFromResponse(body []byte) string {
	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			Delta struct {
				Content string `json:"content"`
			} `json:"delta"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(body, &resp); err != nil {
		return ""
	}

	var contents []string
	for _, choice := range resp.Choices {
		if choice.Message.Content != "" {
			contents = append(contents, choice.Message.Content)
		} else if choice.Delta.Content != "" {
			contents = append(contents, choice.Delta.Content)
		}
	}

	return strings.Join(contents, "\n")
}

// replaceContentInResponse 替换响应体中的内容
func replaceContentInResponse(body []byte, oldContent, newContent string) []byte {
	return []byte(strings.Replace(string(body), oldContent, newContent, -1))
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
