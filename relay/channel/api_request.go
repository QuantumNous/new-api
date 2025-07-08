package channel

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	onecommon "one-api/common"
	"one-api/relay/common"
	"one-api/relay/constant"
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
<<<<<<< Updated upstream
	req.Header.Set("X-Origin-Hash-Value", strconv.Itoa(c.GetInt("hash_value")))
=======
	req.Header.Set("X-Origin-Token-ID", strconv.Itoa(info.TokenId))

	// 添加指定的header - 从原始请求中获取
	if retryRequestId := c.GetHeader("retry_request_id"); retryRequestId != "" {
		req.Header.Set("retry_request_id", retryRequestId)
	}
	if retry := c.GetHeader("retry"); retry != "" {
		req.Header.Set("retry", retry)
	}
>>>>>>> Stashed changes

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
				var jsonData interface{}
				if err := json.Unmarshal(bodyBytes, &jsonData); err == nil {
					compactJSON, err := json.Marshal(jsonData)
					if err == nil {
						onecommon.LogInfo(ctx, fmt.Sprintf("request body: %s", string(compactJSON)))
					}
				} else {
					onecommon.LogInfo(ctx, fmt.Sprintf("request body: %s", string(bodyBytes)))
				}
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
