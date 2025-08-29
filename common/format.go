package common

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// logRequestBody 记录请求体信息
func LogRequestBody(c *gin.Context) string {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return ""
	}

	// 恢复请求体
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	// 检查是否为 multipart/form-data
	contentType := c.GetHeader("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		// 处理 multipart/form-data
		return ParseMultipartFormData(body, contentType)
	} else {
		// 尝试解析为JSON
		var bodyData interface{}
		if err := json.Unmarshal(body, &bodyData); err == nil {
			// 对JSON数据使用ProcessMapValues处理
			processedData := ProcessMapValues(bodyData)
			return FormatValue(processedData)
		} else {
			// 对非JSON内容，转为字符串并限制长度
			bodyStr := string(body)
			if len(bodyStr) > 1000 {
				bodyStr = bodyStr[:1000] + fmt.Sprintf("...[truncated, total: %d chars]", len(bodyStr))
			}
			return bodyStr
		}
	}
}

// LogHttpRequestBody 记录 http.Request 请求体信息
func LogHttpRequestBody(req *http.Request) string {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return ""
	}

	// 恢复请求体
	req.Body = io.NopCloser(bytes.NewBuffer(body))

	// 检查是否为 multipart/form-data
	contentType := req.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		// 处理 multipart/form-data
		return ParseMultipartFormData(body, contentType)
	} else {
		// 尝试解析为JSON
		var bodyData interface{}
		if err := json.Unmarshal(body, &bodyData); err == nil {
			// 对JSON数据使用ProcessMapValues处理
			processedData := ProcessMapValues(bodyData)
			return FormatValue(processedData)
		} else {
			// 对非JSON内容，转为字符串并限制长度
			bodyStr := string(body)
			if len(bodyStr) > 1000 {
				bodyStr = bodyStr[:1000] + fmt.Sprintf("...[truncated, total: %d chars]", len(bodyStr))
			}
			return bodyStr
		}
	}
}

// parseMultipartFormData 解析 multipart/form-data 请求体
func ParseMultipartFormData(body []byte, contentType string) string {
	// 对于 multipart/form-data，我们只显示基本信息，避免解析消耗数据
	boundary := getBoundary(contentType)
	if boundary == "" {
		return fmt.Sprintf("[multipart/form-data - no boundary, body size: %d bytes]", len(body))
	}

	// 简单统计字段数量，不进行详细解析
	bodyStr := string(body)
	fieldCount := strings.Count(bodyStr, "--"+boundary) - 1 // 减去最后的结束边界

	if fieldCount <= 0 {
		return fmt.Sprintf("[multipart/form-data - no fields, body size: %d bytes]", len(body))
	}

	return fmt.Sprintf("[multipart/form-data - %d fields, body size: %d bytes]", fieldCount, len(body))
}

// getBoundary 从 Content-Type 中提取 boundary
func getBoundary(contentType string) string {
	parts := strings.Split(contentType, ";")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "boundary=") {
			return strings.TrimPrefix(part, "boundary=")
		}
	}
	return ""
}

func FormatMap(m map[string]string) string {
	if len(m) == 0 {
		return "{}"
	}
	var pairs []string
	for k, v := range m {
		pairs = append(pairs, fmt.Sprintf("%s: %s", k, v))
	}
	return "{" + strings.Join(pairs, ", ") + "}"
}

func FormatValue(v interface{}) string {
	if v == nil {
		return "null"
	}

	// 使用标准JSON格式输出，并去掉换行符
	bytes, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	// 去掉所有类型的换行符，让日志输出更紧凑
	result := strings.ReplaceAll(string(bytes), "\n", "")
	result = strings.ReplaceAll(result, "\r\n", "")
	result = strings.ReplaceAll(result, "\r", "")
	return result
}
