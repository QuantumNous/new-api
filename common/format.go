package common

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"

	"strings"

	"github.com/gin-gonic/gin"
)

type RequestInfo struct {
	ResponseHeaders string `json:"response_headers" gorm:"type:longtext;"`
	RequestHeaders  string `json:"request_headers" gorm:"type:longtext;"`
	RequestBody     string `json:"request_body" gorm:"type:longtext;"`
	ResponseBody    string `json:"response_body" gorm:"type:longtext;"`
	IsTruncated     bool   `json:"is_truncated" db:"is_truncated"` // 是否缩略打印请求体和响应体
}

const (
	CtxRequestBody     = "ctx_request_body"
	CtxRequestHeaders  = "ctx_request_headers"
	CtxResponseHeaders = "ctx_response_headers"
	CtxResponseBody    = "ctx_response_body"
)

func LogRequestInfo(c *gin.Context, isTruncated bool) (reqInfo *RequestInfo, err error) {
	reqInfo = &RequestInfo{
		IsTruncated:     isTruncated,
		RequestBody:     "",
		RequestHeaders:  "",
		ResponseHeaders: "",
		ResponseBody:    "",
	}

	requestbody, exists := c.Get(CtxRequestBody)
	if !exists {
		return reqInfo, errors.New("failed to get request body")
	}
	requestheaders, exists := c.Get(CtxRequestHeaders)
	if !exists {
		return reqInfo, errors.New("failed to get request body")
	}
	responseheaders, exists := c.Get(CtxResponseHeaders)
	if !exists {
		return reqInfo, errors.New("failed to get request body")
	}
	responsebody, exists := c.Get(CtxResponseBody)
	if !exists {
		return reqInfo, errors.New("failed to get request body")
	}

	if strings.Contains(responseheaders.(string), "stream") {
		isTruncated = false
	}

	reqInfo = &RequestInfo{
		IsTruncated:     false,
		RequestBody:     requestbody.(string),
		RequestHeaders:  requestheaders.(string),
		ResponseHeaders: responseheaders.(string),
		ResponseBody:    responsebody.(string),
	}

	if isTruncated {
		reqInfo = &RequestInfo{
			IsTruncated:     true,
			RequestBody:     TruncatedBody(requestbody.(string), requestheaders.(string)),
			RequestHeaders:  requestheaders.(string),
			ResponseHeaders: responseheaders.(string),
			ResponseBody:    TruncatedBody(responsebody.(string), responseheaders.(string)),
		}
	}

	// 检查环境变量是否禁用缩略
	switch os.Getenv("LOG_TRUNCATE_TYPE") {
	case "ALL_REC":
		reqInfo = &RequestInfo{
			IsTruncated:     false,
			RequestBody:     requestbody.(string),
			RequestHeaders:  requestheaders.(string),
			ResponseHeaders: responseheaders.(string),
			ResponseBody:    responsebody.(string),
		}
	case "REQ_DROP":
		reqInfo.RequestBody = "{}"
		reqInfo.RequestHeaders = "{}"
		reqInfo.ResponseHeaders = "{}"
	case "REQ_TRUN":
		reqInfo.RequestBody = TruncatedBody(requestbody.(string), requestheaders.(string))
	case "ALL_TRUN":
		reqInfo.RequestBody = "{}"
		reqInfo.RequestHeaders = "{}"
		reqInfo.ResponseHeaders = "{}"
	}
	return
}

// truncateNonJsonBody 截断非JSON内容，保留首尾各1000字符
func truncateNonJsonBody(bodyStr string) string {
	const headSize = 1000
	const tailSize = 1000
	const minTruncateSize = headSize + tailSize

	if len(bodyStr) <= minTruncateSize {
		return bodyStr
	}

	// 直接截取首尾各1000字符
	headPart := bodyStr[:headSize]
	tailPart := bodyStr[len(bodyStr)-tailSize:]

	return fmt.Sprintf("%s\n...[truncated, total: %d chars, showing first %d and last %d chars]...\n%s",
		headPart, len(bodyStr), headSize, tailSize, tailPart)
}

func TruncatedBody(body string, contentType string) string {
	if strings.Contains(contentType, "multipart/form-data") {
		return ParseMultipartFormData([]byte(body), contentType)
	} else {
		// 尝试解析为JSON
		var bodyData interface{}
		if err := json.Unmarshal([]byte(body), &bodyData); err == nil {
			// 对JSON数据使用ProcessMapValues处理
			processedData := ProcessMapValues(bodyData)
			return FormatValue(processedData)
		} else {
			// 对非JSON内容，使用新的截断逻辑
			return truncateNonJsonBody(body)
		}
	}
}

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
			// 对非JSON内容，使用新的截断逻辑
			return truncateNonJsonBody(string(body))
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
			// 对非JSON内容，使用新的截断逻辑
			return truncateNonJsonBody(string(body))
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
	data, err := json.Marshal(m)
	if err != nil {
		return "{}" // 出错时返回空对象
	}
	return string(data)
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
