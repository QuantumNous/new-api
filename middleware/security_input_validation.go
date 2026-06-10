package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// SecurityInputValidation 安全模块 admin API 输入校验中间件
// 用于防止 XSS 和注入攻击
func SecurityInputValidation() gin.HandlerFunc {
	// 常见 XSS/注入危险模式
	dangerousPatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)<script[^>]*>[\s\S]*?</script>`),
		regexp.MustCompile(`(?i)<iframe[\s/>]`),
		regexp.MustCompile(`(?i)<object[\s/>]`),
		regexp.MustCompile(`(?i)<embed[\s/>]`),
		regexp.MustCompile(`(?i)javascript\s*:`),
		regexp.MustCompile(`(?i)on\w+\s*=`),
		regexp.MustCompile(`(?i)\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|EXECUTE)\b`),
	}

	return func(c *gin.Context) {
		if !isSecurityAdminEndpoint(c.Request.URL.Path) {
			c.Next()
			return
		}

		method := c.Request.Method
		if method != http.MethodPost && method != http.MethodPut && method != http.MethodPatch {
			c.Next()
			return
		}

		// 读取请求体
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "读取请求体失败"})
			c.Abort()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		// 空请求体直接放行
		if len(bodyBytes) == 0 {
			c.Next()
			return
		}

		// 只校验 JSON 请求
		contentType := c.ContentType()
		if !strings.Contains(contentType, "application/json") && contentType != "" {
			c.Next()
			return
		}

		var payload map[string]any
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			// 解析失败可能是文件上传等非 JSON，放行让后续处理器处理
			c.Next()
			return
		}

		if msg := validatePayload(payload, dangerousPatterns); msg != "" {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
			c.Abort()
			return
		}

		c.Next()
	}
}

func isSecurityAdminEndpoint(path string) bool {
	return strings.HasPrefix(path, "/api/security/")
}

func validatePayload(payload map[string]any, patterns []*regexp.Regexp) string {
	for key, value := range payload {
		if value == nil {
			continue
		}
		switch v := value.(type) {
		case string:
			if msg := validateString(key, v, patterns); msg != "" {
				return msg
			}
		case map[string]any:
			if msg := validatePayload(v, patterns); msg != "" {
				return msg
			}
		case []any:
			if msg := validateSlice(v, patterns); msg != "" {
				return msg
			}
		}
	}
	return ""
}

func validateSlice(items []any, patterns []*regexp.Regexp) string {
	for _, item := range items {
		switch v := item.(type) {
		case string:
			if msg := validateString("", v, patterns); msg != "" {
				return msg
			}
		case map[string]any:
			if msg := validatePayload(v, patterns); msg != "" {
				return msg
			}
		case []any:
			if msg := validateSlice(v, patterns); msg != "" {
				return msg
			}
		}
	}
	return ""
}

func validateString(key, value string, patterns []*regexp.Regexp) string {
	for _, re := range patterns {
		if re.MatchString(value) {
			field := key
			if field == "" {
				field = "输入内容"
			}
			return field + " 包含非法字符或危险模式，请检查后重新提交"
		}
	}
	return ""
}
