package channel

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	onecommon "one-api/common"
	"one-api/relay/common"
	"one-api/relay/constant"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// contextKey 是用于 context 值的自定义类型
type contextKey string

const (
	ginContextKey contextKey = "gin_context"
)

func SetupApiRequestHeader(info *common.RelayInfo, c *gin.Context, req *http.Header) {
	if info.RelayMode == constant.RelayModeAudioTranscription || info.RelayMode == constant.RelayModeAudioTranslation {
		// multipart/form-data
	} else if info.RelayMode == constant.RelayModeRealtime {
		// websocket
	} else {
		req.Set("Content-Type", c.Request.Header.Get("Content-Type"))
		req.Set("Accept", c.Request.Header.Get("Accept"))
		if info.IsStream && c.Request.Header.Get("Accept") == "" {
			req.Set("Accept", "text/event-stream")
		}
	}

	// 添加自定义请求头
	for key, value := range info.Headers {
		req.Set(key, value)
	}

	// 添加指定的header - 从原始请求中获取
	if retryRequestId := c.GetHeader("retry_request_id"); retryRequestId != "" {
		req.Set("retry_request_id", retryRequestId)
	}
	if retry := c.GetHeader("retry"); retry != "" {
		req.Set("retry", retry)
	}
}

func DoApiRequest(a Adaptor, c *gin.Context, info *common.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	fullRequestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	err = a.SetupRequestHeader(c, &req.Header, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	resp, err := doRequest(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

func DoFormRequest(a Adaptor, c *gin.Context, info *common.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	fullRequestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	// set form data
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))

	err = a.SetupRequestHeader(c, &req.Header, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	resp, err := doRequest(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

func DoWssRequest(a Adaptor, c *gin.Context, info *common.RelayInfo, requestBody io.Reader) (*websocket.Conn, error) {
	fullRequestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	targetHeader := http.Header{}
	err = a.SetupRequestHeader(c, &targetHeader, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	targetHeader.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	targetConn, _, err := websocket.DefaultDialer.Dial(fullRequestURL, targetHeader)
	if err != nil {
		return nil, fmt.Errorf("dial failed to %s: %w", fullRequestURL, err)
	}
	// send request body
	//all, err := io.ReadAll(requestBody)
	//err = service.WssString(c, targetConn, string(all))
	return targetConn, nil
}

func doRequest(c *gin.Context, req *http.Request, info *common.RelayInfo) (*http.Response, error) {
	// Check if mock response is enabled and test traffic header is present
	var response *http.Response

	if onecommon.MockResponseEnabled && c.GetHeader("X-Test-Traffic") == "true" {

		var responseBody string
		if strings.Contains(strings.ToLower(info.UpstreamModelName), "gemini") {
			responseBody = `{
				"candidates": [{
					"content": {
						"parts": [{
							"text": "测试结果是1 + 1 = 2"
						}],
						"role": "model"
					},
					"finishReason": "STOP",
					"index": 0
				}],
				"usageMetadata": {
					"promptTokenCount": 10,
					"candidatesTokenCount": 10,
					"totalTokenCount": 20
				}
			}`
		} else {
			responseBody = `{
				"id": "mock-response",
				"model": "gpt-3.5-turbo",
				"object": "chat.completion",
				"choices": [{
					"message": {
						"role": "assistant",
						"content": "测试结果是1 + 1 = 2"
					}
				}]
			}`
		}
		response = &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewBufferString(responseBody)),
		}
		// 设置正确的 Content-Type 头
		response.Header.Set("Content-Type", "application/json")

	}

	// Create HTTP client
	client := &http.Client{
		Timeout: time.Duration(onecommon.RelayTimeout) * time.Second,
	}
	req.Header.Set(onecommon.RequestIdKey, c.GetString(onecommon.RequestIdKey))

	// 添加来源标识和重试次数
	req.Header.Set("X-Origin-User-ID", strconv.Itoa(info.UserId))
	req.Header.Set("X-Origin-Channel-ID", strconv.Itoa(info.ChannelId))
	req.Header.Set("X-Retry-Count", strconv.Itoa(info.RetryCount))

	// 添加指定的header - 从原始请求中获取
	if retryRequestId := c.GetHeader("retry_request_id"); retryRequestId != "" {
		req.Header.Set("retry_request_id", retryRequestId)
	}
	if retry := c.GetHeader("retry"); retry != "" {
		req.Header.Set("retry", retry)
	}

	// 打印请求头
	requestId := c.GetString(onecommon.RequestIdKey)
	ctx := context.WithValue(c.Request.Context(), onecommon.RequestIdKey, requestId)
	ctx = context.WithValue(ctx, "gin_context", c)
	onecommon.LogInfo(ctx, fmt.Sprintf("request headers: %v", req.Header))

	// 读取并打印请求体
	if req.Body != nil {
		bodyBytes, _ := io.ReadAll(req.Body)
		if len(bodyBytes) > 0 {
			// 只打印小于64KB的请求体
			if len(bodyBytes) < 64*1024 {
				// 使用正则表达式替换base64数据
				bodyStr := string(bodyBytes)
				replacedBody := replaceBase64InString(bodyStr)
				onecommon.LogInfo(ctx, fmt.Sprintf("request body: %s", replacedBody))
			} else {
				onecommon.LogInfo(ctx, fmt.Sprintf("request body too large (size: %d bytes), skipping print", len(bodyBytes)))
			}
			// 重新设置 body
			req.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}
	}

	var resp *http.Response
	if response == nil {
		var err error
		resp, err = client.Do(req)
		if err != nil {
			return nil, err
		}
		if resp == nil {
			return nil, errors.New("resp is nil")
		}
	} else {
		resp = response
	}

	// 打印响应头
	onecommon.LogInfo(c, fmt.Sprintf("response headers: %v", resp.Header))

	// 在doRequest函数中添加响应体日志
	if resp.StatusCode != http.StatusOK {
		responseBody, _ := io.ReadAll(resp.Body)
		onecommon.LogError(ctx, fmt.Sprintf("error response body: %s", string(responseBody)))
		resp.Body = io.NopCloser(bytes.NewBuffer(responseBody))
	}

	_ = req.Body.Close()
	_ = c.Request.Body.Close()
	return resp, nil
}

func DoTaskApiRequest(a TaskAdaptor, c *gin.Context, info *common.TaskRelayInfo, requestBody io.Reader) (*http.Response, error) {
	fullRequestURL, err := a.BuildRequestURL(info)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(requestBody), nil
	}

	err = a.BuildRequestHeader(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	req.Header.Set(onecommon.RequestIdKey, c.GetString(onecommon.RequestIdKey))
	resp, err := doRequest(c, req, info.RelayInfo)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

func replaceBase64InString(s string) string {
	// 替换data URL格式的base64数据
	// 匹配格式: "url": "data:video/mp4;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
	// 替换为: "url": "data:video/mp4;base64,[BASE64_DATA_1896764_chars]"

	// 匹配data URL格式的正则表达式
	dataURLPattern := regexp.MustCompile(`"url":\s*"data:[^"]+;base64,[^"]+"`)

	// 替换函数
	replacer := func(match string) string {
		// 提取MIME类型
		mimePattern := regexp.MustCompile(`data:([^;]+);base64,`)
		mimeMatch := mimePattern.FindStringSubmatch(match)
		if len(mimeMatch) > 1 {
			mimeType := mimeMatch[1]
			// 计算base64数据长度（大约）
			base64Pattern := regexp.MustCompile(`base64,([^"]+)`)
			base64Match := base64Pattern.FindStringSubmatch(match)
			if len(base64Match) > 1 {
				base64Data := base64Match[1]
				// 计算字符数
				charCount := len(base64Data)
				return fmt.Sprintf(`"url": "data:%s;base64,[BASE64_DATA_%d_chars]"`, mimeType, charCount)
			}
		}
		return `"url": "data:image/png;base64,[BASE64_DATA_REPLACED]"`
	}

	return dataURLPattern.ReplaceAllStringFunc(s, replacer)
}
