package generationdebug

import (
	"bytes"
	"io"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
)

const contextKey = "generation_debug_capture"

type captureState struct {
	config         CaptureConfig
	requestID      string
	streaming      bool
	inboundPrompt  PromptDebug
	upstreamPrompt PromptDebug
	inbound        *RawValue
	upstream       *RawValue
	response       *limitedCapture
	upstreamStart  time.Time
	upstreamEnd    time.Time
}

type limitedCapture struct {
	mu       sync.Mutex
	maxBytes int
	data     []byte
	total    int
}

type captureReadCloser struct {
	reader io.Reader
	closer io.Closer
}

func Begin(c *gin.Context, requestID string, streaming bool) bool {
	if c == nil {
		return false
	}
	config := LoadConfigFromEnv()
	if !config.Enabled || !sampled(requestID, config.SampleRate) {
		return false
	}
	c.Set(contextKey, &captureState{
		config:    config,
		requestID: requestID,
		streaming: streaming,
	})
	return true
}

func CaptureInboundRequest(c *gin.Context, request any, reader io.ReadSeeker) {
	state := getState(c)
	if state == nil {
		return
	}
	if data, err := common.Marshal(request); err == nil {
		state.inboundPrompt = ExtractPromptFromRequest(data)
	}
	if reader != nil {
		state.inbound = captureReaderValue(reader, state.config.MaxBytes)
	}
}

func CaptureUpstreamRequest(c *gin.Context, data []byte) {
	state := getState(c)
	if state == nil {
		return
	}
	state.upstreamPrompt = ExtractPromptFromRequest(data)
	state.upstream = makeRawValue(data, state.config.MaxBytes)
}

func CapturePassThroughUpstream(c *gin.Context, reader io.ReadSeeker) {
	state := getState(c)
	if state == nil || reader == nil {
		return
	}
	state.upstreamPrompt = state.inboundPrompt
	state.upstream = captureReaderValue(reader, state.config.MaxBytes)
}

func MarkUpstreamStart(c *gin.Context) {
	if state := getState(c); state != nil {
		state.upstreamStart = time.Now()
		state.upstreamEnd = time.Time{}
	}
}

func MarkResponseComplete(c *gin.Context) {
	if state := getState(c); state != nil && !state.upstreamStart.IsZero() {
		state.upstreamEnd = time.Now()
	}
}

func WrapResponseBody(c *gin.Context, body io.ReadCloser, streaming bool) io.ReadCloser {
	state := getState(c)
	if state == nil || body == nil {
		return body
	}
	state.streaming = streaming
	state.response = &limitedCapture{maxBytes: state.config.MaxBytes}
	return &captureReadCloser{
		reader: io.TeeReader(body, state.response),
		closer: body,
	}
}

func MergeContextIntoLogOther(c *gin.Context, other map[string]interface{}, usage *dto.Usage, meta LogMeta) {
	state := getState(c)
	if state == nil || other == nil {
		return
	}
	responseData, responseTruncated, responseBytes := state.responseSnapshot()
	var output ExtractedOutput
	if state.streaming {
		output = ExtractOutputFromSSE(responseData)
	} else {
		output = ExtractOutputFromRawResponse(responseData)
	}
	output.Truncated = output.Truncated || responseTruncated

	cache := BuildCacheStatsFromUsage(usage)
	cacheWriteSource := "provider_usage"
	cacheWriteConfidence := "exact"
	if meta.CacheWriteTokensOverride > cache.CacheWriteTokens {
		cache.CacheWriteTokens = meta.CacheWriteTokensOverride
		cacheWriteSource = "billing_inference"
		cacheWriteConfidence = "inferred"
	}
	latency := int64(0)
	if !state.upstreamStart.IsZero() {
		end := state.upstreamEnd
		if end.IsZero() {
			end = time.Now()
		}
		latency = end.Sub(state.upstreamStart).Milliseconds()
	}
	summary := &Summary{
		Cache:             cache,
		ProviderLatencyMs: latency,
		Streaming:         state.streaming || meta.Streaming,
		RequestID:         firstNonEmpty(meta.RequestID, state.requestID),
		UpstreamRequestID: meta.UpstreamRequestID,
		FinishReason:      output.FinishReason,
		GenerationID:      output.GenerationID,
	}
	if usage != nil {
		summary.PromptTokens = usage.PromptTokens
		summary.CompletionTokens = usage.CompletionTokens
		summary.TotalTokens = usage.TotalTokens
		if summary.TotalTokens == 0 {
			summary.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		}
		summary.ProviderCost = usage.Cost
		summary.Cost = usage.Cost
		if latency > 0 {
			summary.ThroughputTokensPerS = float64(usage.CompletionTokens) / (float64(latency) / 1000)
		}
	}
	if meta.QuotaPerUnit > 0 {
		summary.ChargedCost = float64(meta.Quota) / meta.QuotaPerUnit
		if summary.Cost == nil {
			summary.Cost = summary.ChargedCost
		}
	}
	if state.config.UserVisible {
		prompt := combinePrompts(state.inboundPrompt, state.upstreamPrompt)
		ApplyPromptAccounting(&prompt, usage, cache, cacheWriteSource, cacheWriteConfidence)
		summary.Prompt = &prompt
		completion := &CompletionDebug{
			FinishReason: output.FinishReason,
			GenerationID: output.GenerationID,
			Truncated:    output.Truncated,
		}
		if state.config.CaptureOutput {
			completion.NormalizedOutput = output.Output
			completion.ReasoningOutput = output.Reasoning
		}
		summary.Completion = completion
	}

	var raw *RawDebug
	if state.config.CaptureRaw {
		raw = &RawDebug{
			InboundRequest:  state.inbound,
			UpstreamRequest: state.upstream,
		}
		responseValue := makeRawValueWithMeta(responseData, responseTruncated, responseBytes)
		if state.streaming {
			raw.RawStream = responseValue
		} else {
			raw.RawResponse = responseValue
		}
	}
	MergeIntoLogOther(other, summary, raw)
}

func (c *limitedCapture) Write(data []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.total += len(data)
	remaining := c.maxBytes + 1 - len(c.data)
	if remaining > 0 {
		if len(data) < remaining {
			remaining = len(data)
		}
		c.data = append(c.data, data[:remaining]...)
	}
	return len(data), nil
}

func (c *captureReadCloser) Read(data []byte) (int, error) {
	return c.reader.Read(data)
}

func (c *captureReadCloser) Close() error {
	return c.closer.Close()
}

func getState(c *gin.Context) *captureState {
	if c == nil {
		return nil
	}
	value, exists := c.Get(contextKey)
	if !exists {
		return nil
	}
	state, _ := value.(*captureState)
	return state
}

func captureReaderValue(reader io.ReadSeeker, maxBytes int) *RawValue {
	position, err := reader.Seek(0, io.SeekCurrent)
	if err != nil {
		position = 0
	}
	_, _ = reader.Seek(0, io.SeekStart)
	data, _ := io.ReadAll(io.LimitReader(reader, int64(maxBytes)+1))
	_, _ = reader.Seek(position, io.SeekStart)
	return makeRawValue(data, maxBytes)
}

func makeRawValue(data []byte, maxBytes int) *RawValue {
	truncatedData, truncated := TruncateValue(data, maxBytes)
	return makeRawValueWithMeta(truncatedData, truncated, len(data))
}

func makeRawValueWithMeta(data []byte, truncated bool, capturedBytes int) *RawValue {
	if sanitized, err := SanitizeJSON(data); err == nil {
		var value any
		if common.Unmarshal(sanitized, &value) == nil {
			return &RawValue{Value: value, Truncated: truncated, CapturedBytes: capturedBytes}
		}
	}
	return &RawValue{
		Value:         sanitizeUnstructured(data),
		Truncated:     truncated,
		CapturedBytes: capturedBytes,
	}
}

func (s *captureState) responseSnapshot() ([]byte, bool, int) {
	if s.response == nil {
		return nil, false, 0
	}
	s.response.mu.Lock()
	defer s.response.mu.Unlock()
	data := bytes.Clone(s.response.data)
	truncatedData, truncated := TruncateValue(data, s.config.MaxBytes)
	return truncatedData, truncated || s.response.total > s.config.MaxBytes, s.response.total
}

func combinePrompts(inbound, upstream PromptDebug) PromptDebug {
	inbound.UpstreamMessages = upstream.Messages
	inbound.UpstreamUnits = upstream.Units
	inbound.UpstreamInstructions = upstream.Instructions
	inbound.UpstreamTools = upstream.Tools
	inbound.UpstreamRoleCounts = upstream.RoleCounts
	inbound.UpstreamTotalEstimatedTokens = upstream.TotalEstimatedTokens
	if len(upstream.Units) > 0 {
		inbound.Messages = upstream.Messages
		inbound.Units = upstream.Units
		inbound.Instructions = upstream.Instructions
		inbound.Tools = upstream.Tools
		inbound.RoleCounts = upstream.RoleCounts
		inbound.TotalEstimatedTokens = upstream.TotalEstimatedTokens
	}
	inbound.Estimated = true
	return inbound
}
