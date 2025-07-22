package jsrt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type JSFetchRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    any               `json:"body"`
	Timeout int               `json:"timeout"`
}

type JSFetchResponse struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
	Error   string            `json:"error,omitempty"`
}

func (p *JSRuntimePool) fetch(url string, options ...any) *JSFetchResponse {
	req := &JSFetchRequest{
		Method:  "GET",
		URL:     url,
		Headers: make(map[string]string),
		Timeout: int(jsConfig.FetchTimeout.Seconds()),
	}

	// 解析选项
	if len(options) > 0 && options[0] != nil {
		if optMap, ok := options[0].(map[string]any); ok {
			if method, exists := optMap["method"]; exists {
				if methodStr, ok := method.(string); ok {
					req.Method = strings.ToUpper(methodStr)
				}
			}

			if headers, exists := optMap["headers"]; exists {
				if headersMap, ok := headers.(map[string]any); ok {
					for k, v := range headersMap {
						if vStr, ok := v.(string); ok {
							req.Headers[k] = vStr
						}
					}
				}
			}

			if body, exists := optMap["body"]; exists {
				req.Body = body
			}

			if timeout, exists := optMap["timeout"]; exists {
				if timeoutNum, ok := timeout.(float64); ok {
					req.Timeout = int(timeoutNum)
				}
			}
		}
	}

	// 创建HTTP请求
	var bodyReader io.Reader
	switch body := req.Body.(type) {
	case string:
		bodyReader = strings.NewReader(body)
	case []byte:
		bodyReader = bytes.NewReader(body)
	case nil:
		bodyReader = nil
	default:
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return &JSFetchResponse{
				Error: fmt.Sprintf("Failed to marshal body: %v", err),
			}
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	httpReq, err := http.NewRequest(req.Method, req.URL, bodyReader)
	if err != nil {
		return &JSFetchResponse{
			Error: err.Error(),
		}
	}

	// 设置请求头
	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	// 设置默认User-Agent
	if httpReq.Header.Get("User-Agent") == "" {
		httpReq.Header.Set("User-Agent", "JS-Runtime-Fetch/1.0")
	}

	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(req.Timeout)*time.Second)
	defer cancel()
	httpReq = httpReq.WithContext(ctx)

	// 执行请求
	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return &JSFetchResponse{}
	}
	defer resp.Body.Close()

	// 读取响应体
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return &JSFetchResponse{
			Status: resp.StatusCode,
		}
	}

	// 构建响应头
	headers := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	return &JSFetchResponse{
		Status:  resp.StatusCode,
		Headers: headers,
		Body:    string(bodyBytes),
	}
}
