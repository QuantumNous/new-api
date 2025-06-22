package volcengine

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/metrics"
	relaycommon "one-api/relay/common"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// 全局配置变量
const (
	MaxParallelRequests = 2000

	// 限速器默认大小为 MaxParallelRequests 的 3 倍
	RateLimiterSize = MaxParallelRequests * 3
	// 异步调用超时时间配置
	MinAsyncTimeout = 30 * time.Second
	MaxAsyncTimeout = 60 * time.Second
	// 限流等待时间配置 - 用于等待可用请求槽位的超时时间
	MinRateLimitWaitTime = 100 * time.Millisecond
	MaxRateLimitWaitTime = 1000 * time.Millisecond

	// CreateBatchChatCompletion 调用的超时时间
	BatchCompletionTimeout = 24 * time.Hour

	// 子协程最大存活时间
	SubGoroutineMaxLifetime = 24 * time.Hour

	// 分布式锁过期时间
	DistributedLockExpiration = 24 * time.Hour
)

// 异步调用的超时时间 - 可通过环境变量VOLCENGINE_ASYNC_CALL_TIMEOUT配置，默认30秒
var AsyncCallTimeout = time.Duration(common.GetEnvOrDefault("VOLCENGINE_ASYNC_CALL_TIMEOUT", 30)) * time.Second

// 客户端缓存
var (
	clientCache = make(map[string]*arkruntime.Client)
	clientMutex sync.RWMutex
)

// 请求计数器
var (
	requestCounter int64 = 0
)

// 限速器
var (
	rateLimiter = make(chan struct{}, RateLimiterSize)
)

// 建议重试时间相关变量
var (
	batchRequestAvgDuration      float64 = 30.0 // 默认30秒
	batchRequestAvgDurationMutex sync.RWMutex
)

// NewBatchClient 创建一个新的批量请求客户端实例
func NewBatchClient(apiKey string) *arkruntime.Client {
	return arkruntime.NewClientWithApiKey(
		apiKey,
		arkruntime.WithBatchMaxParallel(MaxParallelRequests), // 使用全局变量设置发起请求的最大并发数量
	)
}

// GetBatchClient 根据 channel ID 获取或创建客户端实例
func GetBatchClient(channelId string, apiKey string) *arkruntime.Client {
	clientMutex.RLock()
	if client, exists := clientCache[channelId]; exists {
		clientMutex.RUnlock()
		return client
	}
	clientMutex.RUnlock()

	// 如果缓存中没有，创建新的客户端
	clientMutex.Lock()
	defer clientMutex.Unlock()

	// 双重检查，防止并发创建
	if client, exists := clientCache[channelId]; exists {
		return client
	}

	client := NewBatchClient(apiKey)
	clientCache[channelId] = client
	return client
}

// acquireRequestSlot 获取请求槽位，如果达到上限则返回错误
func acquireRequestSlot() error {
	// 获取当前计数器值
	currentCount := atomic.LoadInt64(&requestCounter)

	// 如果已达到上限，返回错误
	if currentCount >= int64(RateLimiterSize) {
		return fmt.Errorf("request limit reached, please retry later")
	}

	// 尝试获取限速器槽位
	select {
	case rateLimiter <- struct{}{}:
		// 成功获取槽位，增加计数器
		atomic.AddInt64(&requestCounter, 1)
		return nil
	default:
		// 限速器已满，返回错误
		return fmt.Errorf("request limit reached, please retry later")
	}
}

// releaseRequestSlot 释放请求槽位
func releaseRequestSlot() {
	// 减少计数器
	atomic.AddInt64(&requestCounter, -1)
	// 释放限速器槽位
	select {
	case <-rateLimiter:
	default:
		// 如果限速器为空，忽略
	}
}

// waitForAvailableSlot 等待可用的请求槽位
func waitForAvailableSlot(ctx context.Context) error {
	ticker := time.NewTicker(100 * time.Millisecond) // 每100ms检查一次
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := acquireRequestSlot(); err == nil {
				return nil
			}
		}
	}
}

// 从 context 获取异步调用超时时间，如果没有设置则使用随机计算的时间
func getAsyncCallTimeout(ctx context.Context) time.Duration {
	if timeout, ok := ctx.Value("async_call_timeout").(time.Duration); ok && timeout > 0 {
		return timeout
	}
	// 使用随机等待时间作为异步调用超时时间
	return calculateRandomWaitTime()
}

// 从 context 获取批量推理超时时间，如果没有设置则使用默认值
func getBatchCompletionTimeout(ctx context.Context) time.Duration {
	if timeout, ok := ctx.Value("batch_completion_timeout").(time.Duration); ok && timeout > 0 {
		return timeout
	}
	return BatchCompletionTimeout
}

// GetCurrentTimeouts 获取当前 context 中的超时配置
func GetCurrentTimeouts(ctx context.Context) map[string]time.Duration {
	return map[string]time.Duration{
		"async_call_timeout":       getAsyncCallTimeout(ctx),
		"batch_completion_timeout": getBatchCompletionTimeout(ctx),
		"min_async_timeout":        MinAsyncTimeout,
		"max_async_timeout":        MaxAsyncTimeout,
		"min_rate_limit_wait":      MinRateLimitWaitTime,
		"max_rate_limit_wait":      MaxRateLimitWaitTime,
		"default_async_timeout":    AsyncCallTimeout,
		"default_batch_timeout":    BatchCompletionTimeout,
	}
}

// getRequestID 从gin context获取请求ID，使用middleware设置的ID
func getRequestID(c *gin.Context) string {
	// 优先使用retry_request_id
	requestID := c.GetHeader("retry_request_id")
	if requestID == "" {
		// 如果没有retry_request_id，则使用正常的requestID
		requestID = c.GetHeader(common.RequestIdKey)
	}
	return requestID
}

// isRetryRequest 检查是否为重试请求
func isRetryRequest(c *gin.Context) bool {
	retryHeader := c.GetHeader("retry")
	return retryHeader == "true"
}

func DoBatchChatRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	// 获取请求ID
	requestID := getRequestID(c)
	c.Set("Retry_request_id", requestID)

	// 尝试获取分布式锁，避免重复执行
	lockKey := requestID + "_lock"
	lockAcquired, err := TryAcquireLock(lockKey, DistributedLockExpiration)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire lock: %w", err)
	}

	if !lockAcquired {
		// 返回内部错误响应
		errorResponse := gin.H{
			"error": gin.H{
				"message":    fmt.Sprintf("request %s is already being processed, another request is in progress", requestID),
				"type":       "internal_error",
				"code":       "lock_acquisition_failed",
				"request_id": requestID,
			},
		}
		errorJson, _ := json.Marshal(errorResponse)
		response := &http.Response{
			StatusCode: dto.StatusRequestConflict,
			Body:       io.NopCloser(strings.NewReader(string(errorJson))),
			Header:     make(http.Header),
		}
		response.Header.Set("Content-Type", "application/json")
		return response, nil
	}

	// 确保在函数结束时释放锁
	defer func() {
		if releaseErr := ReleaseLock(lockKey); releaseErr != nil {
			common.LogError(c, fmt.Sprintf("Failed to release lock for request %s: %v", requestID, releaseErr))
		}
	}()

	// 检查是否为重试请求
	if isRetryRequest(c) {
		// 从Redis获取结果，使用当前的requestID（可能是retry_request_id）
		resultData, err := GetBatchResultFromRedis(requestID)
		if err == nil {
			// 检查Result是否为空且状态为pending，这种情况说明第一次请求可能超时了
			if resultData.Result == "" && resultData.Status == "pending" {
				common.LogInfo(c.Request.Context(), fmt.Sprintf("Found pending request for %s, returning retry response", requestID))

				// 返回重试提示
				errorResponse := gin.H{
					"error": gin.H{
						"message":    "Request is still being processed, please retry later",
						"type":       "request_in_progress",
						"code":       "request_still_processing",
						"request_id": requestID,
					},
				}
				errorJson, _ := json.Marshal(errorResponse)

				response := &http.Response{
					StatusCode: dto.StatusNewAPIBatchSubmitted, // 203 - 批量请求已提交，需要重试获取结果
					Body:       io.NopCloser(strings.NewReader(string(errorJson))),
					Header:     make(http.Header),
				}
				response.Header.Set("Content-Type", "application/json")
				response.Header.Set("Retry_request_id", requestID)
				// 添加建议重试时间header
				avgDuration := GetBatchRequestAverageDuration()
				response.Header.Set("X-Suggested-Retry-After", fmt.Sprintf("%.0f", avgDuration))
				c.Writer.Header().Set("Retry_request_id", requestID)
				c.Writer.Header().Set("X-Suggested-Retry-After", fmt.Sprintf("%.0f", avgDuration))
				return response, nil
			} else if resultData.Result != "" {
				// 只有在Result不为空时才处理缓存结果
				// 删除Redis中的key
				err = DeleteBatchResultFromRedis(requestID)
				if err != nil {
					common.LogError(c, err.Error())
				}

				// 先用火山引擎格式解析，再转换为SimpleResponse
				openaiResponse, err := convertVolcEngineResponseToOpenAI([]byte(resultData.Result))
				if err != nil {
					return nil, fmt.Errorf("failed to convert cached response format: %w", err)
				}

				// 将转换后的结果序列化为JSON
				openaiResponseJson, err := json.Marshal(openaiResponse)
				if err != nil {
					return nil, fmt.Errorf("failed to marshal cached OpenAI response: %w", err)
				}

				// 找到结果，返回并删除key
				response := &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(string(openaiResponseJson))),
					Header:     make(http.Header),
				}
				response.Header.Set("Content-Type", "application/json")
				return response, nil
			} else {
				// Result为空但状态不是pending，说明是错误状态
				common.LogInfo(c.Request.Context(), fmt.Sprintf("Found error status for request %s, continuing with new request", requestID))
				// 删除Redis中的key，继续执行新建流程
				err = DeleteBatchResultFromRedis(requestID)
				if err != nil {
					common.LogError(c, err.Error())
				}
			}
		}
		// 如果Redis中没有找到结果，继续执行新建流程
	}

	// 尝试获取请求槽位，如果无法立即获取则等待
	if err := acquireRequestSlot(); err != nil {
		// 如果无法立即获取槽位，等待可用槽位
		// 随机计算等待时间：在100ms-1000ms之间随机选择
		waitTime := calculateRateLimitWaitTime()

		ctx, cancel := context.WithTimeout(c.Request.Context(), waitTime)
		defer cancel()

		if waitErr := waitForAvailableSlot(ctx); waitErr != nil {
			// 等待超时，返回自定义限流错误
			errorResponse := gin.H{
				"error": gin.H{
					"message": "Request limit reached, please retry later",
					"type":    "new_api_batch_rate_limit_exceeded",
					"code":    "new_api_batch_rate_limit_exceeded",
				},
			}
			errorJson, _ := json.Marshal(errorResponse)
			response := &http.Response{
				StatusCode: dto.StatusNewAPIBatchRateLimitExceeded,
				Body:       io.NopCloser(strings.NewReader(string(errorJson))),
				Header:     make(http.Header),
			}
			response.Header.Set("Content-Type", "application/json")
			return response, nil
		}
	}

	// 确保在函数结束时释放槽位
	defer releaseRequestSlot()

	// 解析请求体
	var request dto.GeneralOpenAIRequest
	if err := json.NewDecoder(requestBody).Decode(&request); err != nil {
		return nil, fmt.Errorf("failed to decode request body: %w", err)
	}
	// 转换为豆包批量请求格式
	batchRequest, err := convertToBatchRequest(&request, info.Endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to convert request: %w", err)
	}

	// 检查是否有未支持的参数
	checkUnsupportedParameters(&request)

	// 使用 channel ID 获取或创建客户端实例
	client := GetBatchClient(fmt.Sprintf("%d", info.ChannelId), info.ApiKey)

	// 创建带超时的 context，用于异步调用的整体超时
	timeoutDuration := getAsyncCallTimeout(c.Request.Context())
	asyncCtx, asyncCancel := context.WithTimeout(c.Request.Context(), timeoutDuration)
	defer asyncCancel()

	// 创建通道用于接收异步结果
	resultChan := make(chan interface{}, 1)
	errChan := make(chan error, 1)

	// 异步发起批量推理请求
	go func() {
		// 使用独立的context，不受外层asyncCtx影响
		independentCtx := context.Background()

		// 记录batch请求开始时间
		batchStartTime := time.Now()

		result, err := executeBatchRequestWithRedis(independentCtx, client, batchRequest, requestID)

		// 记录batch请求指标
		// 获取实际状态码
		statusCode := "-1" // 默认状态码
		if err != nil {
			statusCode = "request_failed"
		} else if result != nil {
			// 尝试从结果中提取状态码
			if resultMap, ok := result.(map[string]interface{}); ok {
				if code, exists := resultMap["code"]; exists {
					if codeStr, ok := code.(string); ok {
						statusCode = codeStr
					} else if codeInt, ok := code.(float64); ok {
						statusCode = fmt.Sprintf("%.0f", codeInt)
					}
				}
			}
		}

		// 记录指标
		metrics.IncrementBatchRequestCounter(
			info.ChannelTag,
			info.ChannelName,
			info.ChannelTag,
			info.BaseUrl,
			info.UpstreamModelName,
			info.Group,
			statusCode,
			1,
		)
		metrics.ObserveBatchRequestDuration(
			info.ChannelTag,
			info.ChannelName,
			info.ChannelTag,
			info.BaseUrl,
			info.UpstreamModelName,
			info.Group,
			statusCode,
			time.Since(batchStartTime).Seconds(),
		)

		if err != nil {
			common.LogError(c, fmt.Sprintf("Async batch request failed for requestID %s: %v", requestID, err))
			errChan <- err
			return
		}
		resultChan <- result
	}()

	// 等待结果或超时
	var result interface{}
	select {
	case result = <-resultChan:
		// 成功获取结果
		common.LogInfo(c, fmt.Sprintf("Received result for requestID %s", requestID))
	case err := <-errChan:
		// 发生错误
		common.LogError(c, fmt.Sprintf("batch request failed: %v", err))
		return nil, fmt.Errorf("batch request failed: %w", err)
	case <-asyncCtx.Done():
		// 超时
		if asyncCtx.Err() == context.DeadlineExceeded {
			common.LogError(c, fmt.Sprintf("Async call timeout after %v for requestID %s", timeoutDuration, requestID))
			c.Writer.Header().Set("Retry_request_id", requestID)

			// 返回自定义状态码表示请求已提交
			errorResponse := gin.H{
				"error": gin.H{
					"message":    fmt.Sprintf("Async call timeout after %v for requestID %s, please retry later to get the result", timeoutDuration, requestID),
					"type":       "request_submitted",
					"code":       "request_submitted",
					"request_id": requestID,
				},
			}
			errorJson, _ := json.Marshal(errorResponse)
			response := &http.Response{
				StatusCode: dto.StatusNewAPIBatchSubmitted, // 203 - 批量请求已提交，需要重试获取结果
				Body:       io.NopCloser(strings.NewReader(string(errorJson))),
				Header:     make(http.Header),
			}
			response.Header.Set("Content-Type", "application/json")
			response.Header.Set("Retry_request_id", requestID)
			// 添加建议重试时间header
			avgDuration := GetBatchRequestAverageDuration()
			response.Header.Set("X-Suggested-Retry-After", fmt.Sprintf("%.0f", avgDuration))
			c.Writer.Header().Set("Retry_request_id", requestID)
			c.Writer.Header().Set("X-Suggested-Retry-After", fmt.Sprintf("%.0f", avgDuration))
			return response, nil
		}
		common.LogError(c, fmt.Sprintf("Async call cancelled for requestID %s: %w", requestID, asyncCtx.Err()))
		c.Writer.Header().Set("Retry_request_id", requestID)
		return nil, fmt.Errorf("async call cancelled: %w", asyncCtx.Err())
	}

	// 将结果转换为JSON
	resultJson, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	// 将火山引擎的响应转换为标准的OpenAI格式
	openaiResponse, err := convertVolcEngineResponseToOpenAI(resultJson)
	if err != nil {
		return nil, fmt.Errorf("failed to convert response format: %w", err)
	}

	// 将转换后的结果序列化为JSON
	openaiResponseJson, err := json.Marshal(openaiResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OpenAI response: %w", err)
	}

	// 创建HTTP响应
	response := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(string(openaiResponseJson))),
		Header:     make(http.Header),
	}
	response.Header.Set("Content-Type", "application/json")
	response.Header.Set("Retry_request_id", requestID)
	return response, nil
}

// calculateRandomWaitTime 在 MinAsyncTimeout-MaxAsyncTimeout 之间随机计算异步调用超时时间
func calculateRandomWaitTime() time.Duration {
	// 计算时间范围（毫秒）
	timeRange := int(MaxAsyncTimeout.Milliseconds() - MinAsyncTimeout.Milliseconds())

	// 如果时间范围为0或负数，直接返回MinAsyncTimeout
	if timeRange <= 0 {
		return MinAsyncTimeout
	}

	// 生成 MinAsyncTimeout-MaxAsyncTimeout 之间的随机等待时间（毫秒）
	waitMilliseconds := rand.Intn(timeRange) + int(MinAsyncTimeout.Milliseconds())

	return time.Duration(waitMilliseconds) * time.Millisecond
}

// calculateRateLimitWaitTime 在 MinRateLimitWaitTime-MaxRateLimitWaitTime 之间随机计算限流等待时间
func calculateRateLimitWaitTime() time.Duration {
	// 计算时间范围（毫秒）
	timeRange := int(MaxRateLimitWaitTime.Milliseconds() - MinRateLimitWaitTime.Milliseconds())

	// 如果时间范围为0或负数，直接返回MinRateLimitWaitTime
	if timeRange <= 0 {
		return MinRateLimitWaitTime
	}

	// 生成 MinRateLimitWaitTime-MaxRateLimitWaitTime 之间的随机等待时间（毫秒）
	waitMilliseconds := rand.Intn(timeRange) + int(MinRateLimitWaitTime.Milliseconds())

	return time.Duration(waitMilliseconds) * time.Millisecond
}

// GetCurrentRequestCount 获取当前请求计数（用于监控）
func GetCurrentRequestCount() int64 {
	return atomic.LoadInt64(&requestCounter)
}

// GetRateLimiterStatus 获取限速器状态（用于监控）
func GetRateLimiterStatus() (current, capacity int) {
	return len(rateLimiter), cap(rateLimiter)
}

func MustMarshalJson(v interface{}) string {
	s, _ := json.Marshal(v)
	return string(s)
}

// checkUnsupportedParameters 检查请求中是否有未支持的参数
func checkUnsupportedParameters(request *dto.GeneralOpenAIRequest) {
	var unsupportedParams []string

	// 检查 tool_choice 参数（豆包批量推理可能不支持）
	if request.ToolChoice != nil {
		unsupportedParams = append(unsupportedParams, "tool_choice")
	}

	// 检查 n 参数（批量推理不支持，批量推理本身就是多个请求）
	if request.N > 0 {
		unsupportedParams = append(unsupportedParams, "n")
	}

	// 检查 stream 参数（批量推理不支持流式输出）
	if request.Stream {
		unsupportedParams = append(unsupportedParams, "stream")
	}

	// 检查 user 参数（豆包SDK支持，但批量推理可能不支持）
	if request.User != "" {
		unsupportedParams = append(unsupportedParams, "user")
	}

	// 检查 seed 参数（豆包可能不支持）
	if request.Seed != 0 {
		unsupportedParams = append(unsupportedParams, "seed")
	}

	// 检查 response_format 参数（豆包SDK支持，但批量推理可能不支持）
	if request.ResponseFormat != nil {
		unsupportedParams = append(unsupportedParams, "response_format")
	}

	// 检查 stream_options 参数（豆包SDK支持，但批量推理可能不支持）
	if request.StreamOptions != nil {
		unsupportedParams = append(unsupportedParams, "stream_options")
	}

	// 检查 functions 参数（已废弃，使用tools替代）
	if request.Functions != nil {
		unsupportedParams = append(unsupportedParams, "functions")
	}

	// 检查其他可能不支持的参数
	if request.Prompt != nil {
		unsupportedParams = append(unsupportedParams, "prompt")
	}

	if request.Prefix != nil {
		unsupportedParams = append(unsupportedParams, "prefix")
	}

	if request.Suffix != nil {
		unsupportedParams = append(unsupportedParams, "suffix")
	}

	if request.Input != nil {
		unsupportedParams = append(unsupportedParams, "input")
	}

	if request.Instruction != "" {
		unsupportedParams = append(unsupportedParams, "instruction")
	}

	if request.Size != "" {
		unsupportedParams = append(unsupportedParams, "size")
	}

	if request.EncodingFormat != nil {
		unsupportedParams = append(unsupportedParams, "encoding_format")
	}

	if request.Dimensions > 0 {
		unsupportedParams = append(unsupportedParams, "dimensions")
	}

	if request.Modalities != nil {
		unsupportedParams = append(unsupportedParams, "modalities")
	}

	if request.Audio != nil {
		unsupportedParams = append(unsupportedParams, "audio")
	}

	if request.ExtraBody != nil {
		unsupportedParams = append(unsupportedParams, "extra_body")
	}

	if request.Thinking != nil {
		unsupportedParams = append(unsupportedParams, "thinking")
	}

	if request.ThinkingConfig != nil {
		unsupportedParams = append(unsupportedParams, "thinking_config")
	}

	// 如果有未支持的参数，打印错误日志
	if len(unsupportedParams) > 0 {
		fmt.Printf("Error: Unsupported parameters detected in batch request: %v\n", unsupportedParams)
		fmt.Printf("These parameters are not supported by VolcEngine batch inference API and will be ignored.\n")
	}
}

// convertToBatchRequest 将 OpenAI 格式的请求转换为豆包批量请求格式
func convertToBatchRequest(request *dto.GeneralOpenAIRequest, endpoint string) (*model.CreateChatCompletionRequest, error) {
	// 获取消息内容
	if len(request.Messages) == 0 {
		return nil, fmt.Errorf("no messages found in request")
	}

	// 转换消息为豆包格式，支持多模态消息
	messages := make([]*model.ChatCompletionMessage, 0, len(request.Messages))
	for _, msg := range request.Messages {
		// 解析消息内容
		contentParts := msg.ParseContent()

		var messageContent *model.ChatCompletionMessageContent

		if len(contentParts) == 1 && contentParts[0].Type == "text" {
			// 单文本消息
			text := contentParts[0].Text
			messageContent = &model.ChatCompletionMessageContent{
				StringValue: &text,
			}
		} else {
			// 多模态消息或复杂消息
			parts := make([]*model.ChatCompletionMessageContentPart, 0, len(contentParts))
			for _, part := range contentParts {
				switch part.Type {
				case "text":
					parts = append(parts, &model.ChatCompletionMessageContentPart{
						Type: "text",
						Text: part.Text,
					})
				case "image_url":
					if imageUrl, ok := part.ImageUrl.(dto.MessageImageUrl); ok {
						detail := model.ImageURLDetail(imageUrl.Detail)
						parts = append(parts, &model.ChatCompletionMessageContentPart{
							Type: "image_url",
							ImageURL: &model.ChatMessageImageURL{
								URL:    imageUrl.Url,
								Detail: detail,
							},
						})
					}
				}
			}
			if len(parts) > 0 {
				messageContent = &model.ChatCompletionMessageContent{
					ListValue: parts,
				}
			}
		}

		if messageContent != nil {
			messages = append(messages, &model.ChatCompletionMessage{
				Role:    msg.Role,
				Content: messageContent,
			})
		}
	}

	// 转换为豆包批量请求格式
	batchRequest := model.CreateChatCompletionRequest{
		Model:    endpoint,
		Messages: messages,
	}

	// 设置 max_tokens，只有当请求中包含时才设置
	if request.MaxTokens > 0 {
		maxTokens := int(request.MaxTokens)
		batchRequest.MaxTokens = &maxTokens
	}

	// 设置 stop 参数，只有当请求中包含时才设置
	if request.Stop != nil {
		// 类型断言处理 stop 参数
		switch stop := request.Stop.(type) {
		case string:
			batchRequest.Stop = []string{stop}
		case []string:
			batchRequest.Stop = stop
		case []interface{}:
			stopStrings := make([]string, 0, len(stop))
			for _, s := range stop {
				if str, ok := s.(string); ok {
					stopStrings = append(stopStrings, str)
				}
			}
			batchRequest.Stop = stopStrings
		}
	}

	// 设置 frequency_penalty，只有当请求中包含且不为0时才设置
	if request.FrequencyPenalty != 0 {
		freqPenalty := float32(request.FrequencyPenalty)
		batchRequest.FrequencyPenalty = &freqPenalty
	}

	// 设置 presence_penalty，只有当请求中包含且不为0时才设置
	if request.PresencePenalty != 0 {
		presPenalty := float32(request.PresencePenalty)
		batchRequest.PresencePenalty = &presPenalty
	}

	// 设置 temperature，只有当请求中包含时才设置
	if request.Temperature != nil {
		temp := float32(*request.Temperature)
		batchRequest.Temperature = &temp
	}

	// 设置 top_p，只有当请求中包含且不为0时才设置
	if request.TopP != 0 {
		topP := float32(request.TopP)
		batchRequest.TopP = &topP
	}

	// 设置 logprobs，只有当请求中包含且为true时才设置
	if request.LogProbs {
		batchRequest.LogProbs = &request.LogProbs
	}

	// 设置 top_logprobs，只有当请求中包含且大于0时才设置
	if request.TopLogProbs > 0 {
		batchRequest.TopLogProbs = &request.TopLogProbs
	}

	// 设置 logit_bias，只有当请求中包含时才设置
	if len(request.LogitBias) > 0 {
		batchRequest.LogitBias = request.LogitBias
	}

	// 设置 tools，只有当请求中包含时才设置
	if len(request.Tools) > 0 {
		tools := make([]*model.Tool, 0, len(request.Tools))
		for _, tool := range request.Tools {
			// 只支持function类型的工具
			if tool.Type == "function" {
				chatTool := &model.Tool{
					Type: model.ToolTypeFunction,
					Function: &model.FunctionDefinition{
						Name:        tool.Function.Name,
						Description: tool.Function.Description,
						Parameters:  tool.Function.Parameters,
					},
				}
				tools = append(tools, chatTool)
			}
		}
		if len(tools) > 0 {
			batchRequest.Tools = tools
		}
	}

	return &batchRequest, nil
}

// executeBatchRequestWithRedis 执行批量请求并保存结果到Redis
func executeBatchRequestWithRedis(ctx context.Context, client *arkruntime.Client, batchRequest *model.CreateChatCompletionRequest, requestID string) (interface{}, error) {
	// 在发起请求前先创建Redis key
	if err := CreateBatchRequestKey(requestID); err != nil {
		common.LogError(ctx, fmt.Sprintf("Failed to create initial Redis key for request %s: %v", requestID, err))
		// 即使创建Redis key失败，也继续执行请求，只是不保存结果
	}

	// 为 CreateBatchChatCompletion 创建独立的超时 context，不复用传入的ctx
	apiCtx, apiCancel := context.WithTimeout(context.Background(), getBatchCompletionTimeout(ctx))
	defer apiCancel()

	common.LogInfo(ctx, fmt.Sprintf("Batch chat completion request: %+v ", batchRequest))
	result, err := client.CreateBatchChatCompletion(apiCtx, batchRequest)
	if err != nil {
		common.LogError(ctx, err.Error())
		// 检查是否是超时错误
		if apiCtx.Err() == context.DeadlineExceeded {
			timeoutMsg := fmt.Sprintf("batch completion timeout after %v", getBatchCompletionTimeout(ctx))
			if saveErr := SaveBatchErrorToRedis(requestID, timeoutMsg); saveErr != nil {
				fmt.Printf("Failed to save timeout error to Redis for request %s: %v\n", requestID, saveErr)
			}
		} else {
			if saveErr := SaveBatchErrorToRedis(requestID, err.Error()); saveErr != nil {
				fmt.Printf("Failed to save error to Redis for request %s: %v\n", requestID, saveErr)
			}
		}
		return nil, err
	}
	// 保存成功结果到Redis，子协程独立运行
	common.LogInfo(ctx, fmt.Sprintf("Batch chat completion result: %+v", result))
	if saveErr := SaveBatchResultToRedis(requestID, result, "completed"); saveErr != nil {
		fmt.Printf("Failed to save result to Redis for request %s: %v\n", requestID, saveErr)
	}

	return result, nil
}

// convertVolcEngineResponseToOpenAI 将火山引擎的响应转换为标准的OpenAI格式
func convertVolcEngineResponseToOpenAI(resultJson []byte) (*dto.SimpleResponse, error) {
	// 添加调试日志
	fmt.Printf("Original volcengine response: %s\n", string(resultJson))

	// 直接解析为火山引擎的原始格式
	var volcResponse map[string]interface{}
	if err := json.Unmarshal(resultJson, &volcResponse); err != nil {
		return nil, fmt.Errorf("failed to unmarshal volcengine response: %w", err)
	}

	// 提取choices和usage
	choices, ok := volcResponse["choices"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid choices field in volcengine response")
	}

	usageRaw, ok := volcResponse["usage"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid usage field in volcengine response")
	}

	// 转换usage
	usage := dto.Usage{}
	if promptTokens, ok := usageRaw["prompt_tokens"].(float64); ok {
		usage.PromptTokens = int(promptTokens)
	}
	if completionTokens, ok := usageRaw["completion_tokens"].(float64); ok {
		usage.CompletionTokens = int(completionTokens)
	}
	if totalTokens, ok := usageRaw["total_tokens"].(float64); ok {
		usage.TotalTokens = int(totalTokens)
	}

	// 转换为标准的OpenAI格式
	openaiResponse := &dto.SimpleResponse{
		Usage:   usage,
		Choices: []dto.OpenAITextResponseChoice{},
	}

	// 转换choices
	for _, choice := range choices {
		choiceMap, ok := choice.(map[string]interface{})
		if !ok {
			continue
		}

		message, ok := choiceMap["message"].(map[string]interface{})
		if !ok {
			continue
		}

		// 处理content字段
		content := ""
		if contentRaw, exists := message["content"]; exists {
			switch v := contentRaw.(type) {
			case string:
				content = v
			case []interface{}:
				// 如果是数组，提取文本内容
				for _, part := range v {
					if partMap, ok := part.(map[string]interface{}); ok {
						if partType, ok := partMap["type"].(string); ok && partType == "text" {
							if text, ok := partMap["text"].(string); ok {
								content += text
							}
						}
					}
				}
			}
		}

		// 处理reasoning_content字段
		if reasoningContent, exists := message["reasoning_content"]; exists {
			if reasoningStr, ok := reasoningContent.(string); ok && reasoningStr != "" {
				content = reasoningStr + "\n" + content
			}
		}

		// 构建转换后的choice
		index := 0
		if indexRaw, ok := choiceMap["index"].(float64); ok {
			index = int(indexRaw)
		}

		finishReason := ""
		if finishReasonRaw, ok := choiceMap["finish_reason"].(string); ok {
			finishReason = finishReasonRaw
		}

		role := ""
		if roleRaw, ok := message["role"].(string); ok {
			role = roleRaw
		}

		convertedChoice := dto.OpenAITextResponseChoice{
			Index: index,
			Message: dto.Message{
				Role: role,
			},
			FinishReason: finishReason,
		}
		convertedChoice.Message.SetStringContent(content)

		openaiResponse.Choices = append(openaiResponse.Choices, convertedChoice)
	}

	// 添加调试日志
	openaiResponseJson, _ := json.Marshal(openaiResponse)
	fmt.Printf("Converted OpenAI response: %s\n", string(openaiResponseJson))

	return openaiResponse, nil
}

// GetBatchRequestAverageDuration 获取batch请求的平均耗时（秒）
// 这个函数返回一个估算的平均耗时，用于建议重试时间
func GetBatchRequestAverageDuration() float64 {
	batchRequestAvgDurationMutex.RLock()
	defer batchRequestAvgDurationMutex.RUnlock()
	return batchRequestAvgDuration
}

// SetBatchRequestAverageDuration 设置batch请求的平均耗时（秒）
func SetBatchRequestAverageDuration(duration float64) {
	batchRequestAvgDurationMutex.Lock()
	defer batchRequestAvgDurationMutex.Unlock()
	if duration > 0 {
		batchRequestAvgDuration = duration
	}
}

// InitBatchRequestAverageDuration 初始化batch请求的平均耗时
// 从环境变量读取配置，如果没有配置则使用默认值
func InitBatchRequestAverageDuration() {
	if avgDurationStr := os.Getenv("BATCH_REQUEST_AVG_DURATION"); avgDurationStr != "" {
		if avgDuration, err := strconv.ParseFloat(avgDurationStr, 64); err == nil && avgDuration > 0 {
			SetBatchRequestAverageDuration(avgDuration)
		}
	}
}
