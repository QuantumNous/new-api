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
	"regexp"
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
	MinAsyncTimeout = 1 * time.Second
	MaxAsyncTimeout = 3 * time.Second
	// 限流等待时间配置 - 用于等待可用请求槽位的超时时间
	MinRateLimitWaitTime = 100 * time.Millisecond
	MaxRateLimitWaitTime = 1000 * time.Millisecond

	// 重试响应延迟时间配置 - 用于控制重试请求的返回时间
	MinRetryResponseDelay = 0 * time.Millisecond
	MaxRetryResponseDelay = 0 * time.Millisecond

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
	batchRequestAvgDuration      float64 = 60.0 // 默认30秒
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
		"min_retry_response_delay": MinRetryResponseDelay,
		"max_retry_response_delay": MaxRetryResponseDelay,
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

	// 获取 retry header 状态
	retryHeaderStatus := "false"
	if isRetryRequest(c) {
		retryHeaderStatus = "true"
	}

	// 记录请求开始时间
	requestStartTime := time.Now()

	// 用于记录最终状态码的变量
	var finalStatusCode string
	var finalError error

	// 使用 defer 确保在所有情况下都记录指标
	defer func() {
		// 如果没有设置状态码，说明是正常流程
		if finalStatusCode == "" {
			finalStatusCode = "success"
		}

		metrics.IncrementBatchRequestCounter(
			fmt.Sprintf("%d", info.ChannelId),
			info.ChannelName,
			info.ChannelTag,
			info.BaseUrl,
			info.UpstreamModelName,
			info.Group,
			finalStatusCode,
			retryHeaderStatus,
			1,
		)
		metrics.ObserveBatchRequestDuration(
			fmt.Sprintf("%d", info.ChannelId),
			info.ChannelName,
			info.ChannelTag,
			info.BaseUrl,
			info.UpstreamModelName,
			info.Group,
			finalStatusCode,
			retryHeaderStatus,
			time.Since(requestStartTime).Seconds(),
		)
	}()

	// 尝试获取分布式锁，避免重复执行
	lockKey := requestID + "_lock"
	lockAcquired, err := TryAcquireLock(lockKey, DistributedLockExpiration)
	if err != nil {
		finalStatusCode = "lock_acquisition_error"
		finalError = fmt.Errorf("failed to acquire lock: %w", err)
		return nil, finalError
	}

	if !lockAcquired {
		finalStatusCode = "lock_already_acquired"

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
		// 应用重试响应延迟
		retryDelay := calculateRetryResponseDelay()
		if retryDelay > 0 {
			common.LogInfo(c.Request.Context(), fmt.Sprintf("Applying retry response delay: %v for request %s", retryDelay, requestID))
			time.Sleep(retryDelay)
		}

		// 从Redis获取结果，使用当前的requestID（可能是retry_request_id）
		resultData, err := GetBatchResultFromRedis(requestID)
		if err == nil {
			// 检查Result是否为空且状态为pending，这种情况说明第一次请求可能超时了
			if resultData.Result == "" && resultData.Status == "pending" {
				finalStatusCode = "retry_pending"
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
				finalStatusCode = "retry_cache_hit"
				// 只有在Result不为空时才处理缓存结果
				// 删除Redis中的key
				err = DeleteBatchResultFromRedis(requestID)
				if err != nil {
					common.LogError(c, err.Error())
				}

				// 先用火山引擎格式解析，再转换为SimpleResponse
				openaiResponse, err := convertVolcEngineResponseToOpenAI([]byte(resultData.Result))
				if err != nil {
					finalStatusCode = "retry_cache_convert_error"
					finalError = fmt.Errorf("failed to convert cached response format: %w", err)
					return nil, finalError
				}

				// 将转换后的结果序列化为JSON
				openaiResponseJson, err := json.Marshal(openaiResponse)
				if err != nil {
					finalStatusCode = "retry_cache_marshal_error"
					finalError = fmt.Errorf("failed to marshal cached OpenAI response: %w", err)
					return nil, finalError
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
			finalStatusCode = "rate_limit_exceeded"
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
		finalStatusCode = "request_decode_error"
		finalError = fmt.Errorf("failed to decode request body: %w", err)
		return nil, finalError
	}
	// 转换为豆包批量请求格式
	batchRequest, err := convertToBatchRequest(c.Request.Context(), &request, info.Endpoint)
	if err != nil {
		finalStatusCode = "request_convert_error"
		finalError = fmt.Errorf("failed to convert request: %w", err)
		return nil, finalError
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

		result, err := executeBatchRequestWithRedis(independentCtx, client, batchRequest, requestID)

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
		finalStatusCode = "async_request_failed"
		finalError = fmt.Errorf("batch request failed: %w", err)
		common.LogError(c, fmt.Sprintf("batch request failed: %v", err))
		return nil, finalError
	case <-asyncCtx.Done():
		// 超时
		if asyncCtx.Err() == context.DeadlineExceeded {
			finalStatusCode = "async_timeout"
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
		finalStatusCode = "async_cancelled"
		finalError = fmt.Errorf("async call cancelled: %w", asyncCtx.Err())
		common.LogError(c, fmt.Sprintf("Async call cancelled for requestID %s: %w", requestID, asyncCtx.Err()))
		c.Writer.Header().Set("Retry_request_id", requestID)
		return nil, finalError
	}

	// 将结果转换为JSON
	resultJson, err := json.Marshal(result)
	if err != nil {
		finalStatusCode = "result_marshal_error"
		finalError = fmt.Errorf("failed to marshal result: %w", err)
		return nil, finalError
	}

	// 将火山引擎的响应转换为标准的OpenAI格式
	openaiResponse, err := convertVolcEngineResponseToOpenAI(resultJson)
	if err != nil {
		finalStatusCode = "response_convert_error"
		finalError = fmt.Errorf("failed to convert response format: %w", err)
		return nil, finalError
	}

	// 将转换后的结果序列化为JSON
	openaiResponseJson, err := json.Marshal(openaiResponse)
	if err != nil {
		finalStatusCode = "openai_response_marshal_error"
		finalError = fmt.Errorf("failed to marshal OpenAI response: %w", err)
		return nil, finalError
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

// calculateRetryResponseDelay 在 MinRetryResponseDelay-MaxRetryResponseDelay 之间随机计算重试响应延迟时间
func calculateRetryResponseDelay() time.Duration {
	// 计算时间范围（毫秒）
	timeRange := int(MaxRetryResponseDelay.Milliseconds() - MinRetryResponseDelay.Milliseconds())

	// 如果时间范围为0或负数，直接返回MinRetryResponseDelay
	if timeRange <= 0 {
		return MinRetryResponseDelay
	}

	// 生成 MinRetryResponseDelay-MaxRetryResponseDelay 之间的随机延迟时间（毫秒）
	delayMilliseconds := rand.Intn(timeRange) + int(MinRetryResponseDelay.Milliseconds())

	return time.Duration(delayMilliseconds) * time.Millisecond
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
// 支持多模态消息：文本、图片、视频形式
func convertToBatchRequest(ctx context.Context, request *dto.GeneralOpenAIRequest, endpoint string) (*model.CreateChatCompletionRequest, error) {
	// 获取消息内容
	if len(request.Messages) == 0 {
		return nil, fmt.Errorf("no messages found in request")
	}

	// 转换消息为豆包格式，支持多模态消息
	messages := make([]*model.ChatCompletionMessage, 0, len(request.Messages))
	for i, msg := range request.Messages {
		// 解析消息内容
		contentParts := msg.ParseContent()

		// 记录多模态内容信息
		if len(contentParts) > 1 {
			common.SysLog(fmt.Sprintf("Processing multimodal message %d with %d content parts", i, len(contentParts)))
			for j, part := range contentParts {
				common.SysLog(fmt.Sprintf("  Part %d: type=%s", j, part.Type))
			}
		} else if len(contentParts) == 1 {
			common.SysLog(fmt.Sprintf("Processing single content message %d: type=%s", i, contentParts[0].Type))
		}

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
					// 文本内容
					if part.Text != "" {
						parts = append(parts, &model.ChatCompletionMessageContentPart{
							Type: "text",
							Text: part.Text,
						})
						common.SysLog(fmt.Sprintf("Added text part: length=%d", len(part.Text)))
					}
				case "image_url":
					// 图片内容 - 支持URL格式和base64格式
					if imageUrl, ok := part.ImageUrl.(dto.MessageImageUrl); ok {
						detail := model.ImageURLDetail(imageUrl.Detail)

						// 检查Format是否为"url"或"base64"
						switch imageUrl.Format {
						case "url":
							parts = append(parts, &model.ChatCompletionMessageContentPart{
								Type: "image_url",
								ImageURL: &model.ChatMessageImageURL{
									URL:    imageUrl.Url,
									Detail: detail,
								},
							})
							common.SysLog(fmt.Sprintf("Added image_url part: url=%s, detail=%s", replaceBase64InURL(imageUrl.Url), imageUrl.Detail))
						case "base64":
							// 处理base64格式的图片
							// 从data字段中提取base64数据
							base64Data := imageUrl.Data
							if base64Data != "" {
								// 根据URL或格式判断图片类型，设置正确的MIME类型
								mimeType := "image/jpeg" // 默认MIME类型

								// 如果URL包含文件扩展名，根据扩展名判断MIME类型
								if imageUrl.Url != "" {
									url := strings.ToLower(imageUrl.Url)
									if strings.Contains(url, ".jpg") || strings.Contains(url, ".jpeg") {
										mimeType = "image/jpeg"
									} else if strings.Contains(url, ".png") {
										mimeType = "image/png"
									} else if strings.Contains(url, ".gif") {
										mimeType = "image/gif"
									} else if strings.Contains(url, ".webp") {
										mimeType = "image/webp"
									} else if strings.Contains(url, ".bmp") {
										mimeType = "image/bmp"
									} else if strings.Contains(url, ".tiff") || strings.Contains(url, ".tif") {
										mimeType = "image/tiff"
									} else if strings.Contains(url, ".ico") {
										mimeType = "image/x-icon"
									} else if strings.Contains(url, ".dib") {
										mimeType = "image/bmp"
									} else if strings.Contains(url, ".icns") {
										mimeType = "image/icns"
									} else if strings.Contains(url, ".sgi") {
										mimeType = "image/sgi"
									} else if strings.Contains(url, ".j2c") || strings.Contains(url, ".j2k") || strings.Contains(url, ".jp2") || strings.Contains(url, ".jpc") || strings.Contains(url, ".jpf") || strings.Contains(url, ".jpx") {
										mimeType = "image/jp2"
									} else if strings.Contains(url, ".heic") {
										mimeType = "image/heic"
									} else if strings.Contains(url, ".heif") {
										mimeType = "image/heif"
									}
								}

								// 构造data URL格式
								dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
								parts = append(parts, &model.ChatCompletionMessageContentPart{
									Type: "image_url",
									ImageURL: &model.ChatMessageImageURL{
										URL:    dataURL,
										Detail: detail,
									},
								})
								common.SysLog(fmt.Sprintf("Added image_url part: base64 data length=%d, detail=%s, mime_type=%s", len(base64Data), imageUrl.Detail, mimeType))
							} else {
								common.SysLog(fmt.Sprintf("Skipping empty base64 image_url part"))
							}
						default:
							// 如果不是支持的格式，跳过该部分
							common.SysLog(fmt.Sprintf("Skipping unsupported image_url part: format=%s", imageUrl.Format))
						}
					}
				case "video_url":
					// 视频内容 - 支持URL格式和base64格式
					common.SysLog(fmt.Sprintf("Processing video_url part: InputAudio type=%T", part.InputAudio))
					if videoUrl, ok := part.InputAudio.(dto.MessageInputAudio); ok {
						common.SysLog(fmt.Sprintf("Video URL details: url=%s, format=%s, fps=%f", replaceBase64InURL(videoUrl.Url), videoUrl.Format, videoUrl.Fps))

						// 检查Format是否为"url"或"base64"
						switch videoUrl.Format {
						case "url":
							parts = append(parts, &model.ChatCompletionMessageContentPart{
								Type: "video_url",
								VideoURL: &model.ChatMessageVideoURL{
									URL: videoUrl.Url,
									FPS: &videoUrl.Fps,
								},
							})
							common.SysLog(fmt.Sprintf("Added video_url part: url=%s, fps=%f", replaceBase64InURL(videoUrl.Url), videoUrl.Fps))
						case "base64":
							// 处理base64格式的视频
							// 从data字段中提取base64数据
							base64Data := videoUrl.Data
							if base64Data != "" {
								// 根据URL或格式判断视频类型，设置正确的MIME类型
								mimeType := "video/mp4" // 默认MIME类型

								// 如果URL包含文件扩展名，根据扩展名判断MIME类型
								if videoUrl.Url != "" {
									url := strings.ToLower(videoUrl.Url)
									if strings.Contains(url, ".mp4") {
										mimeType = "video/mp4"
									} else if strings.Contains(url, ".avi") {
										mimeType = "video/avi"
									} else if strings.Contains(url, ".mov") {
										mimeType = "video/quicktime"
									}
								}

								// 构造data URL格式
								dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
								parts = append(parts, &model.ChatCompletionMessageContentPart{
									Type: "video_url",
									VideoURL: &model.ChatMessageVideoURL{
										URL: dataURL,
										FPS: &videoUrl.Fps,
									},
								})
								common.SysLog(fmt.Sprintf("Added video_url part: base64 data length=%d, fps=%f, mime_type=%s", len(base64Data), videoUrl.Fps, mimeType))
							} else {
								common.SysLog("Skipping empty base64 video_url part")
							}
						default:
							// 如果不是支持的格式，跳过该部分
							common.SysLog(fmt.Sprintf("Skipping unsupported video_url part: format=%s", videoUrl.Format))
						}
					} else {
						common.SysLog(fmt.Sprintf("Failed to cast InputAudio to MessageInputAudio: %v", part.InputAudio))
					}
				default:
					// 对于不支持的内容类型，直接返回错误
					return nil, fmt.Errorf("unsupported content type: %s", part.Type)
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

	// 使用JSON序列化来更好地显示messages内容
	messagesJson, _ := json.Marshal(messages)
	// 替换base64数据为占位符
	replacedMessagesJson := replaceBase64InString(string(messagesJson))
	common.LogInfo(ctx, fmt.Sprintf("Messages: %s", replacedMessagesJson))
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

	// 使用JSON序列化来更好地显示batchRequest内容
	batchRequestJson, _ := json.Marshal(batchRequest)
	// 替换base64数据为占位符
	replacedBatchRequestJson := replaceBase64InString(string(batchRequestJson))
	common.LogInfo(ctx, fmt.Sprintf("Batch chat completion request: %s", replacedBatchRequestJson))
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

// replaceBase64InString 替换字符串中的base64数据为占位符
func replaceBase64InString(input string) string {
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

	return dataURLPattern.ReplaceAllStringFunc(input, replacer)
}

// replaceBase64InURL 替换URL中的base64数据为占位符
func replaceBase64InURL(url string) string {
	// 检查是否是data URL格式
	if strings.HasPrefix(url, "data:") && strings.Contains(url, ";base64,") {
		// 提取MIME类型
		parts := strings.Split(url, ";base64,")
		if len(parts) == 2 {
			mimeType := strings.TrimPrefix(parts[0], "data:")
			base64Data := parts[1]
			// 计算字符数
			charCount := len(base64Data)
			return fmt.Sprintf("data:%s;base64,[BASE64_DATA_%d_chars]", mimeType, charCount)
		}
	}
	return url
}
