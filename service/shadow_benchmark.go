package service

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	defaultShadowTargetChannelID = 38
	defaultShadowTimeoutSeconds  = 120
	defaultShadowConcurrency     = 20
	defaultShadowQueueSize       = 2000
)

type shadowModelRule struct {
	Limit int64
}

type shadowBenchmarkConfig struct {
	Enabled         bool
	ExperimentName  string
	TargetName      string
	TargetChannelID int
	Timeout         time.Duration
	Concurrency     int
	QueueSize       int
	Models          map[string]shadowModelRule
}

type ShadowBenchmarkJob struct {
	RequestID            string
	ModelName            string
	RequestPath          string
	ClientType           string
	RelayFormat          types.RelayFormat
	IsStream             bool
	Body                 []byte
	Headers              map[string][]string
	MainSuccess          bool
	MainStatusCode       int
	MainErrorCode        string
	MainTTFTMs           int64
	MainTotalMs          int64
	MainUseChannel       []string
	MainFinalChannelID   int
	MainFinalChannelName string
}

var (
	shadowOnce     sync.Once
	shadowConfig   shadowBenchmarkConfig
	shadowQueue    chan ShadowBenchmarkJob
	shadowCounters sync.Map // map[string]*modelCounter
)

type modelCounter struct {
	mu    sync.Mutex
	count int64
}

func InitShadowBenchmark() {
	shadowOnce.Do(func() {
		shadowConfig = loadShadowBenchmarkConfig()
		if !shadowConfig.Enabled {
			return
		}
		if len(shadowConfig.Models) == 0 {
			common.SysLog("shadow benchmark disabled: no model rules configured")
			shadowConfig.Enabled = false
			return
		}
		seedShadowBenchmarkCounters()
		shadowQueue = make(chan ShadowBenchmarkJob, shadowConfig.QueueSize)
		for i := 0; i < shadowConfig.Concurrency; i++ {
			go shadowBenchmarkWorker(i)
		}
		common.SysLog(fmt.Sprintf(
			"shadow benchmark enabled: target_channel=%d target=%s models=%s concurrency=%d queue=%d timeout=%s",
			shadowConfig.TargetChannelID,
			shadowConfig.TargetName,
			strings.Join(shadowModelNames(), ","),
			shadowConfig.Concurrency,
			shadowConfig.QueueSize,
			shadowConfig.Timeout,
		))
	})
}

func loadShadowBenchmarkConfig() shadowBenchmarkConfig {
	cfg := shadowBenchmarkConfig{
		Enabled:         common.GetEnvOrDefaultBool("NEWAPI_SHADOW_BENCHMARK_ENABLED", false),
		ExperimentName:  strings.TrimSpace(common.GetEnvOrDefaultString("NEWAPI_SHADOW_BENCHMARK_EXPERIMENT", "gpt54_55_openrouter_20260702")),
		TargetName:      strings.TrimSpace(common.GetEnvOrDefaultString("NEWAPI_SHADOW_BENCHMARK_TARGET_NAME", "openRouter")),
		TargetChannelID: common.GetEnvOrDefault("NEWAPI_SHADOW_BENCHMARK_TARGET_CHANNEL_ID", defaultShadowTargetChannelID),
		Timeout:         time.Duration(common.GetEnvOrDefault("NEWAPI_SHADOW_BENCHMARK_TIMEOUT_SECONDS", defaultShadowTimeoutSeconds)) * time.Second,
		Concurrency:     common.GetEnvOrDefault("NEWAPI_SHADOW_BENCHMARK_CONCURRENCY", defaultShadowConcurrency),
		QueueSize:       common.GetEnvOrDefault("NEWAPI_SHADOW_BENCHMARK_QUEUE_SIZE", defaultShadowQueueSize),
		Models:          parseShadowModelRules(os.Getenv("NEWAPI_SHADOW_BENCHMARK_MODELS")),
	}
	if cfg.TargetName == "" {
		cfg.TargetName = "openRouter"
	}
	if cfg.ExperimentName == "" {
		cfg.ExperimentName = "default"
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = defaultShadowConcurrency
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = defaultShadowQueueSize
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = time.Duration(defaultShadowTimeoutSeconds) * time.Second
	}
	return cfg
}

func parseShadowModelRules(raw string) map[string]shadowModelRule {
	rules := make(map[string]shadowModelRule)
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		name, limitText, ok := strings.Cut(part, ":")
		if !ok {
			continue
		}
		name = strings.TrimSpace(name)
		limit, err := strconv.ParseInt(strings.TrimSpace(limitText), 10, 64)
		if name == "" || err != nil || limit <= 0 {
			continue
		}
		rules[name] = shadowModelRule{Limit: limit}
	}
	return rules
}

func shadowModelNames() []string {
	names := make([]string, 0, len(shadowConfig.Models))
	for name := range shadowConfig.Models {
		names = append(names, name)
	}
	return names
}

func seedShadowBenchmarkCounters() {
	counts, err := model.CountShadowBenchmarkLogsByModels(shadowConfig.ExperimentName, shadowModelNames())
	if err != nil {
		logger.LogError(context.Background(), fmt.Sprintf("shadow benchmark seed count failed: %s", err.Error()))
		return
	}
	for name := range shadowConfig.Models {
		shadowCounters.Store(name, &modelCounter{count: counts[name]})
	}
}

func ShadowBenchmarkEnabled() bool {
	return shadowConfig.Enabled
}

func MaybeEnqueueShadowBenchmark(c *gin.Context, relayInfo *relaycommon.RelayInfo, relayFormat types.RelayFormat, finalErr *types.NewAPIError) {
	if !shadowConfig.Enabled || c == nil || relayInfo == nil {
		return
	}
	if strings.EqualFold(strings.TrimSpace(c.GetHeader("X-NewAPI-Replay")), "true") {
		return
	}
	if !isShadowSupportedPath(c) {
		return
	}
	rule, ok := shadowConfig.Models[relayInfo.OriginModelName]
	if !ok {
		return
	}
	counterAny, _ := shadowCounters.LoadOrStore(relayInfo.OriginModelName, &modelCounter{})
	counter, _ := counterAny.(*modelCounter)
	if counter == nil || !counter.tryReserve(rule.Limit) {
		return
	}

	bodyStorage, err := common.GetBodyStorage(c)
	if err != nil {
		counter.release()
		logger.LogWarn(c, fmt.Sprintf("shadow benchmark skip: get body failed: %s", err.Error()))
		return
	}
	body, err := bodyStorage.Bytes()
	if err != nil {
		counter.release()
		logger.LogWarn(c, fmt.Sprintf("shadow benchmark skip: read body failed: %s", err.Error()))
		return
	}

	mainSuccess := finalErr == nil
	mainStatusCode := http.StatusOK
	mainErrorCode := ""
	if finalErr != nil {
		mainStatusCode = finalErr.StatusCode
		mainErrorCode = string(finalErr.GetErrorCode())
	}
	mainTTFTMs := int64(0)
	if relayInfo.HasSendResponse() {
		mainTTFTMs = relayInfo.FirstResponseTime.Sub(relayInfo.StartTime).Milliseconds()
	}
	job := ShadowBenchmarkJob{
		RequestID:            c.GetString(common.RequestIdKey),
		ModelName:            relayInfo.OriginModelName,
		RequestPath:          c.Request.URL.Path,
		ClientType:           extractClientType(c),
		RelayFormat:          relayFormat,
		IsStream:             relayInfo.IsStream,
		Body:                 body,
		Headers:              captureShadowHeaders(c),
		MainSuccess:          mainSuccess,
		MainStatusCode:       mainStatusCode,
		MainErrorCode:        mainErrorCode,
		MainTTFTMs:           mainTTFTMs,
		MainTotalMs:          time.Since(relayInfo.StartTime).Milliseconds(),
		MainUseChannel:       c.GetStringSlice("use_channel"),
		MainFinalChannelID:   c.GetInt("channel_id"),
		MainFinalChannelName: c.GetString("channel_name"),
	}

	select {
	case shadowQueue <- job:
	default:
		counter.release()
		logger.LogWarn(c, "shadow benchmark queue full, sample dropped")
	}
}

func (c *modelCounter) tryReserve(limit int64) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.count >= limit {
		return false
	}
	c.count++
	return true
}

func (c *modelCounter) release() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.count > 0 {
		c.count--
	}
}

func isShadowSupportedPath(c *gin.Context) bool {
	if c == nil || c.Request == nil || c.Request.URL == nil {
		return false
	}
	path := c.Request.URL.Path
	return path == "/v1/responses" || path == "/v1/chat/completions"
}

func extractClientType(c *gin.Context) string {
	if c == nil {
		return ""
	}
	if common.GetContextKeyBool(c, constant.ContextKeyIsCodexClient) || strings.Contains(strings.ToLower(c.GetHeader("Originator")), "codex") {
		return "codex"
	}
	if strings.Contains(c.Request.URL.Path, "/responses") {
		return "responses"
	}
	return "openai_compatible"
}

func captureShadowHeaders(c *gin.Context) map[string][]string {
	headers := make(map[string][]string)
	allow := map[string]bool{
		"Accept":           true,
		"Content-Type":     true,
		"OpenAI-Beta":      true,
		"OpenAI-Intent":    true,
		"OpenAI-Project":   true,
		"OpenAI-Org":       true,
		"User-Agent":       true,
		"X-Client-Name":    true,
		"X-Client-Version": true,
	}
	for key, values := range c.Request.Header {
		canonical := http.CanonicalHeaderKey(key)
		if !allow[canonical] {
			continue
		}
		copied := make([]string, 0, len(values))
		for _, value := range values {
			copied = append(copied, value)
		}
		headers[canonical] = copied
	}
	return headers
}

func shadowBenchmarkWorker(index int) {
	for job := range shadowQueue {
		if err := executeShadowBenchmark(job); err != nil {
			logger.LogError(context.Background(), fmt.Sprintf("shadow benchmark worker %d failed request=%s: %s", index, job.RequestID, err.Error()))
		}
	}
}

func executeShadowBenchmark(job ShadowBenchmarkJob) error {
	channel, err := model.GetChannelById(shadowConfig.TargetChannelID, true)
	if err != nil {
		return saveShadowResult(job, nil, "channel_error", 0, "", err.Error(), 0, 0, 0, 0)
	}
	apiKey, _, keyErr := channel.GetNextEnabledKey()
	if keyErr != nil {
		return saveShadowResult(job, channel, "channel_key_error", 0, string(keyErr.GetErrorCode()), keyErr.Error(), 0, 0, 0, 0)
	}
	targetURL := strings.TrimRight(channel.GetBaseURL(), "/") + job.RequestPath
	ctx, cancel := context.WithTimeout(context.Background(), shadowConfig.Timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(job.Body))
	if err != nil {
		return saveShadowResult(job, channel, "request_error", 0, "", err.Error(), 0, 0, 0, 0)
	}
	for key, values := range job.Headers {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	if req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if req.Header.Get("Accept") == "" && job.IsStream {
		req.Header.Set("Accept", "text/event-stream")
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("X-NewAPI-Shadow-Benchmark", "true")
	req.Header.Set("X-NewAPI-Shadow-Source-Request-Id", job.RequestID)
	if req.Header.Get("HTTP-Referer") == "" {
		req.Header.Set("HTTP-Referer", "https://apimaster.ai")
	}
	if req.Header.Get("X-OpenRouter-Title") == "" {
		req.Header.Set("X-OpenRouter-Title", "APIMaster Shadow Benchmark")
	}

	start := time.Now()
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return saveShadowResult(job, channel, "timeout", 0, "", ctx.Err().Error(), 0, shadowConfig.Timeout.Milliseconds(), 0, 0)
		}
		return saveShadowResult(job, channel, "request_failed", 0, "", err.Error(), 0, time.Since(start).Milliseconds(), 0, 0)
	}
	defer resp.Body.Close()

	status, errorCode, errorMessage, ttftMs, totalMs, responseBytes, firstChunkBytes := readShadowResponse(resp, start)
	return saveShadowResult(job, channel, status, resp.StatusCode, errorCode, errorMessage, ttftMs, totalMs, responseBytes, firstChunkBytes)
}

func readShadowResponse(resp *http.Response, start time.Time) (string, string, string, int64, int64, int64, int64) {
	status := "success"
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		status = "http_error"
	}
	reader := bufio.NewReader(resp.Body)
	var responseBytes int64
	var firstChunkBytes int64
	var firstChunk []byte
	ttftMs := int64(0)
	limit := int64(2 << 20)
	buf := make([]byte, 32*1024)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			if ttftMs == 0 {
				ttftMs = time.Since(start).Milliseconds()
				firstChunkBytes = int64(n)
				firstChunk = append(firstChunk, buf[:min(n, 4096)]...)
			}
			responseBytes += int64(n)
			if responseBytes >= limit {
				_, _ = io.Copy(io.Discard, reader)
				break
			}
		}
		if err != nil {
			break
		}
	}
	totalMs := time.Since(start).Milliseconds()
	errorCode, errorMessage := parseShadowError(firstChunk)
	if status == "success" && errorCode != "" {
		status = "upstream_error"
	}
	return status, errorCode, errorMessage, ttftMs, totalMs, responseBytes, firstChunkBytes
}

func parseShadowError(body []byte) (string, string) {
	text := strings.TrimSpace(string(body))
	if text == "" {
		return "", ""
	}
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err == nil {
		if errObj, ok := payload["error"].(map[string]any); ok {
			code := fmt.Sprint(errObj["code"])
			if code == "<nil>" {
				code = ""
			}
			message := fmt.Sprint(errObj["message"])
			if message == "<nil>" {
				message = ""
			}
			return code, message
		}
	}
	if len(text) > 500 {
		text = text[:500]
	}
	return "", text
}

func saveShadowResult(job ShadowBenchmarkJob, channel *model.Channel, status string, httpStatus int, errorCode string, errorMessage string, ttftMs int64, totalMs int64, responseBytes int64, firstChunkBytes int64) error {
	channelID := shadowConfig.TargetChannelID
	channelName := ""
	if channel != nil {
		channelID = channel.Id
		channelName = channel.Name
	}
	hash := sha256.Sum256(job.Body)
	log := &model.ShadowBenchmarkLog{
		RequestId:             job.RequestID,
		ExperimentName:        shadowConfig.ExperimentName,
		ModelName:             job.ModelName,
		RequestPath:           job.RequestPath,
		ClientType:            job.ClientType,
		RelayFormat:           string(job.RelayFormat),
		IsStream:              job.IsStream,
		BodySize:              int64(len(job.Body)),
		BodyHash:              hex.EncodeToString(hash[:]),
		MainSuccess:           job.MainSuccess,
		MainStatusCode:        job.MainStatusCode,
		MainErrorCode:         job.MainErrorCode,
		MainTTFTMs:            job.MainTTFTMs,
		MainTotalMs:           job.MainTotalMs,
		MainUseChannel:        common.GetJsonString(job.MainUseChannel),
		MainFinalChannelId:    job.MainFinalChannelID,
		MainFinalChannelName:  job.MainFinalChannelName,
		TargetName:            shadowConfig.TargetName,
		TargetChannelId:       channelID,
		TargetChannelName:     channelName,
		TargetStatus:          status,
		TargetHTTPStatus:      httpStatus,
		TargetErrorCode:       errorCode,
		TargetErrorMessage:    errorMessage,
		TargetTTFTMs:          ttftMs,
		TargetTotalMs:         totalMs,
		TargetResponseBytes:   responseBytes,
		TargetFirstChunkBytes: firstChunkBytes,
	}
	return model.SaveShadowBenchmarkLog(log)
}
