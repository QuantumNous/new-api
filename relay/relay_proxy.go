package relay

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/metrics"
	relayChannel "one-api/relay/channel"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func ProxyInfo(c *gin.Context) (*relaycommon.RelayInfo, interface{}, string, *dto.OpenAIErrorWithStatusCode) {
	relayInfo := relaycommon.GenRelayInfo(c)

	// 直接提取 HTTP body 的原始数据
	bodyBytes, err := common.GetRequestBody(c)
	if err != nil {
		return nil, nil, "", service.OpenAIErrorWrapperLocal(err, "get_request_body_failed", http.StatusBadRequest)
	}
	return relayInfo, bodyBytes, relayInfo.OriginModelName, nil
}

func ProxyHelper(c *gin.Context, relayInfo *relaycommon.RelayInfo, proxyRequest interface{}) (openaiErr *dto.OpenAIErrorWithStatusCode) {
	startTime := common.GetBeijingTime()
	var statusCode int = -1
	var err error
	var funcErr *dto.OpenAIErrorWithStatusCode
	metrics.IncrementRelayRequestTotalCounter(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, relayInfo.ChannelTag, relayInfo.BaseUrl, relayInfo.OriginModelName, relayInfo.Group, strconv.Itoa(relayInfo.UserId), relayInfo.UserName, 1)
	defer func() {
		if funcErr != nil {
			err = fmt.Errorf(funcErr.Error.Message)
		}
		if err != nil {
			metrics.IncrementRelayRequestFailedCounter(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, relayInfo.ChannelTag, relayInfo.BaseUrl, relayInfo.OriginModelName, relayInfo.Group, strconv.Itoa(openaiErr.StatusCode), strconv.Itoa(relayInfo.UserId), relayInfo.UserName, 1)
		} else {
			metrics.IncrementRelayRequestSuccessCounter(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, relayInfo.ChannelTag, relayInfo.BaseUrl, relayInfo.OriginModelName, relayInfo.Group, strconv.Itoa(statusCode), strconv.Itoa(relayInfo.UserId), relayInfo.UserName, 1)
			metrics.ObserveRelayRequestDuration(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, relayInfo.ChannelTag, relayInfo.BaseUrl, relayInfo.OriginModelName, relayInfo.Group, strconv.Itoa(relayInfo.UserId), relayInfo.UserName, time.Since(startTime).Seconds())
		}
	}()

	priceData, err := helper.ModelPriceHelper(c, relayInfo, 0, 0)
	if err != nil {
		common.LogError(c, fmt.Sprintf("Failed to get model price: %v", err))
		return service.OpenAIErrorWrapperLocal(err, "model_price_error", http.StatusInternalServerError)
	}

	relayInfo.StartTime = startTime

	// 获取原始 body 数据
	bodyBytes, ok := proxyRequest.([]byte)
	if !ok {
		return service.OpenAIErrorWrapperLocal(fmt.Errorf("invalid proxy request type"), "invalid_proxy_request", http.StatusInternalServerError)
	}

	// 创建 HTTP 请求
	req, err := http.NewRequest(c.Request.Method, relayInfo.BaseUrl+c.Request.URL.Path, bytes.NewBuffer(bodyBytes))
	if err != nil {
		funcErr = service.OpenAIErrorWrapperLocal(err, "create_request_failed", http.StatusInternalServerError)
		return funcErr
	}

	// 复制原始请求头
	for key, values := range c.Request.Header {
		for _, value := range values {
			if strings.Contains(value, "sk-") {
				continue
			}
			req.Header.Add(key, value)
		}
	}

	// 设置授权头
	if relayInfo.ApiKey != "" {
		req.Header.Set("Authorization", "Bearer "+relayInfo.ApiKey)
	}

	// 打印请求URL
	common.LogInfo(c, fmt.Sprintf("proxy request url: %s", req.URL.String()))

	// 转换headers为map并使用ProcessMapValues处理
	headerMap := make(map[string]interface{})
	for key, values := range req.Header {
		if len(values) == 1 {
			headerMap[key] = values[0]
		} else {
			headerMap[key] = values
		}
	}

	if headersJSON, err := json.Marshal(headerMap); err == nil {
		common.LogInfo(c, fmt.Sprintf("proxy request headers: %s", string(headersJSON)))
	}

	// 打印请求体
	if req.Body != nil {
		bodyStr := common.LogHttpRequestBody(req)
		if bodyStr != "" {
			common.LogInfo(c, fmt.Sprintf("proxy request body: %s", bodyStr))
		}
	}

	// 发送请求 - 使用统一的doRequest函数
	httpResp, err := relayChannel.DoRequest(c, req, relayInfo)
	if err != nil {
		funcErr = service.OpenAIErrorWrapperLocal(err, "do_request_failed", http.StatusInternalServerError)
		return funcErr
	}

	// 确保响应体被正确关闭
	defer func() {
		if httpResp != nil && httpResp.Body != nil {
			httpResp.Body.Close()
		}
	}()

	statusCode = httpResp.StatusCode

	// 检查响应状态码
	if httpResp.StatusCode != http.StatusOK {
		// 错误响应：直接转发
		for key, values := range httpResp.Header {
			for _, value := range values {
				c.Writer.Header().Add(key, value)
			}
		}
		c.Writer.WriteHeader(httpResp.StatusCode)
		_, err = io.Copy(c.Writer, httpResp.Body)
		if err != nil {
			common.LogError(c, fmt.Sprintf("Error copying error response: %v", err))
		}
		funcErr = service.OpenAIErrorWrapperLocal(fmt.Errorf("upstream error with status %d", httpResp.StatusCode), "upstream_error", httpResp.StatusCode)
		return funcErr
	}

	// 复制响应头到客户端
	for key, values := range httpResp.Header {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}

	// 设置响应状态码
	c.Writer.WriteHeader(httpResp.StatusCode)

	// 检查是否为流式响应
	isStream := strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
	relayInfo.IsStream = isStream

	var responseBodyBytes []byte

	if isStream {
		// 流式响应：使用 TeeReader 来同时读取和转发数据
		var buf bytes.Buffer
		tee := io.TeeReader(httpResp.Body, &buf)

		common.LogInfo(c, "Streaming response to client")
		_, err = io.Copy(c.Writer, tee)
		if err != nil {
			common.LogError(c, fmt.Sprintf("Error streaming response: %v", err))
			funcErr = service.OpenAIErrorWrapperLocal(err, "stream_copy_failed", http.StatusInternalServerError)
			return funcErr
		}

		// 确保数据被发送
		if flusher, ok := c.Writer.(http.Flusher); ok {
			flusher.Flush()
		}

		responseBodyBytes = buf.Bytes()
	} else {
		// 非流式响应：读取并转发
		responseBodyBytes, err = io.ReadAll(httpResp.Body)
		if err != nil {
			common.LogError(c, fmt.Sprintf("Error reading response body: %v", err))
			funcErr = service.OpenAIErrorWrapperLocal(err, "read_response_failed", http.StatusInternalServerError)
			return funcErr
		}

		// 写入响应体到客户端
		_, err = c.Writer.Write(responseBodyBytes)
		if err != nil {
			common.LogError(c, fmt.Sprintf("Error writing response: %v", err))
			funcErr = service.OpenAIErrorWrapperLocal(err, "write_response_failed", http.StatusInternalServerError)
			return funcErr
		}
	}

	// 生成处理后的响应字符串用于配额统计
	var processedResponseStr string
	if len(responseBodyBytes) > 0 {
		if isStream {
			// 流式响应：解析SSE格式并提取最后的usage信息
			processedResponseStr = extractUsageFromStreamResponse(responseBodyBytes)
		} else {
			// 非流式响应：正常处理
			var responseData interface{}
			if err := json.Unmarshal(responseBodyBytes, &responseData); err == nil {
				processedResponse := common.ProcessMapValues(responseData)
				if processedJSON, err := json.Marshal(processedResponse); err == nil {
					processedResponseStr = string(processedJSON)
				} else {
					processedResponseStr = string(responseBodyBytes)
				}
			} else {
				processedResponseStr = string(responseBodyBytes)
			}
		}
	}

	// 处理并打印响应体（使用已解析的数据）
	if len(processedResponseStr) > 0 {
		logStr := processedResponseStr
		if len(logStr) > 1000 {
			logStr = logStr[:1000] + fmt.Sprintf("...[truncated, total: %d chars]", len(logStr))
		}
		if isStream {
			common.LogInfo(c, fmt.Sprintf("proxy stream response body: %s", logStr))
		} else {
			common.LogInfo(c, fmt.Sprintf("proxy response body: %s", logStr))
		}
	}

	// 处理配额和统计 - 直接使用 ProcessMapValues 处理的响应体
	proxyPostConsumeQuota(c, relayInfo, nil, 0, 0, priceData, "", processedResponseStr)

	return nil
}

// proxyPostConsumeQuota 后处理配额（代理专用版本）
func proxyPostConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo,
	usage *dto.Usage, preConsumedQuota int, userQuota int, priceData helper.PriceData, extraContent string, responseBodyStr string) {
	// 如果是压测流量，不记录计费日志
	if ctx.GetHeader("X-Test-Traffic") == "true" {
		common.LogInfo(ctx, "test traffic detected, skipping consume log")
		return
	}

	// 创建默认的 usage 结构用于配额计算
	defaultUsage := &dto.Usage{
		PromptTokens:     relayInfo.PromptTokens,
		CompletionTokens: 0,
		TotalTokens:      relayInfo.PromptTokens,
	}
	common.LogInfo(ctx, fmt.Sprintf("Initial defaultUsage: %+v", defaultUsage))

	switch relayInfo.OriginModelName {
	case "gemini-2.5-flash-image-preview":
		var geminiResponse GeminiResponse
		err := json.Unmarshal([]byte(responseBodyStr), &geminiResponse)
		if err != nil {
			common.LogError(ctx, fmt.Sprintf("Failed to unmarshal Gemini response: %v", err))
		} else {
			common.LogInfo(ctx, fmt.Sprintf("Usage metadata: %+v", geminiResponse.UsageMetadata))
			defaultUsage.PromptTokens = geminiResponse.UsageMetadata.PromptTokenCount
			defaultUsage.TotalTokens = geminiResponse.UsageMetadata.TotalTokenCount
			defaultUsage.CompletionTokens = geminiResponse.UsageMetadata.CandidatesTokenCount
			defaultUsage.InputTokens = geminiResponse.UsageMetadata.PromptTokenCount
			defaultUsage.OutputTokens = geminiResponse.UsageMetadata.CandidatesTokenCount
		}
	default:
		// 对于其他模型，尝试解析标准的 usage 字段
		var response map[string]interface{}
		err := json.Unmarshal([]byte(responseBodyStr), &response)
		if err != nil {
			common.LogError(ctx, fmt.Sprintf("Failed to unmarshal response: %v", err))
		} else {
			if usageData, ok := response["usage"]; ok {
				common.LogInfo(ctx, fmt.Sprintf("Found usage data: %+v", usageData))
				usageBytes, err := json.Marshal(usageData)
				if err == nil {
					common.LogInfo(ctx, fmt.Sprintf("Usage JSON: %s", string(usageBytes)))
					err = json.Unmarshal(usageBytes, defaultUsage)
					if err != nil {
						common.LogError(ctx, fmt.Sprintf("Failed to unmarshal usage: %v", err))
					} else {
						common.LogInfo(ctx, fmt.Sprintf("Parsed usage: %+v", defaultUsage))
					}
				}
			}
		}
	}

	// 将字符串转换为[]byte，直接传递给配额处理函数
	responseBodyBytes := []byte(responseBodyStr)

	if strings.HasPrefix(relayInfo.OriginModelName, "gpt-4o-audio") {
		service.PostAudioConsumeQuota(ctx, relayInfo, defaultUsage, preConsumedQuota, userQuota, priceData, extraContent, responseBodyBytes)
	} else {
		postConsumeQuota(ctx, relayInfo, defaultUsage, preConsumedQuota, userQuota, priceData, extraContent, responseBodyBytes)
	}
}

// extractUsageFromStreamResponse 直接将流式响应转换为字符串用于存储
func extractUsageFromStreamResponse(responseBodyBytes []byte) string {
	if len(responseBodyBytes) == 0 {
		return ""
	}

	// 直接返回原始流式响应字符串，用于数据库存储
	return string(responseBodyBytes)
}

type GeminiResponse struct {
	Candidates    []interface{} `json:"candidates"`
	ModelVersion  string        `json:"modelVersion"`
	ResponseId    string        `json:"responseId"`
	UsageMetadata UsageMetadata `json:"usageMetadata"`
}

type UsageMetadata struct {
	CandidatesTokenCount    int           `json:"candidatesTokenCount"`
	CandidatesTokensDetails []TokenDetail `json:"candidatesTokensDetails"`
	PromptTokenCount        int           `json:"promptTokenCount"`
	PromptTokensDetails     []TokenDetail `json:"promptTokensDetails"`
	TotalTokenCount         int           `json:"totalTokenCount"`
}

type TokenDetail struct {
	Modality   string `json:"modality"` // 可能值: "TEXT" | "IMAGE"
	TokenCount int    `json:"tokenCount"`
}
