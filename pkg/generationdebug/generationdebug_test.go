package generationdebug

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSanitizeJSONRedactsSecretsAndLargeMedia(t *testing.T) {
	input := []byte(`{
		"Authorization":"Bearer secret-token",
		"nested":{"api_key":"sk-test","safe":"Bearer another-secret"},
		"image":"data:image/png;base64,AAAA"
	}`)

	sanitized, err := SanitizeJSON(input)
	require.NoError(t, err)

	var value map[string]any
	require.NoError(t, common.Unmarshal(sanitized, &value))
	assert.Equal(t, "[REDACTED]", value["Authorization"])
	nested := value["nested"].(map[string]any)
	assert.Equal(t, "[REDACTED]", nested["api_key"])
	assert.Equal(t, "Bearer [REDACTED]", nested["safe"])
	assert.Contains(t, value["image"], "[OMITTED type=data_uri")
}

func TestTruncateValuePreservesUTF8Boundary(t *testing.T) {
	value, truncated := TruncateValue([]byte("你好世界"), 5)
	assert.True(t, truncated)
	assert.Equal(t, "你", string(value))

	value, truncated = TruncateValue([]byte("hello"), 5)
	assert.False(t, truncated)
	assert.Equal(t, "hello", string(value))
}

func TestSanitizeUnstructuredSummarizesTruncatedBase64(t *testing.T) {
	value := `data: {"image":"` + strings.Repeat("A", 2048)

	sanitized := sanitizeUnstructured([]byte(value))

	assert.NotContains(t, sanitized, strings.Repeat("A", 128))
	assert.Contains(t, sanitized, "[OMITTED type=truncated_string")
}

func TestBuildCacheStatsFromUsageUsesMaximumAndSplitWrites(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:         200,
		PromptCacheHitTokens: 80,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         50,
			CachedCreationTokens: 20,
		},
		InputTokensDetails:          &dto.InputTokenDetails{CachedTokens: 70},
		ClaudeCacheCreation5mTokens: 30,
		ClaudeCacheCreation1hTokens: 40,
	}

	stats := BuildCacheStatsFromUsage(usage)

	assert.Equal(t, 80, stats.CachedTokens)
	assert.Equal(t, 70, stats.CacheWriteTokens)
	assert.InDelta(t, 0.4, stats.CacheHitRate, 0.0001)
}

func TestPromptCacheBoundaryCachedZeroMarksFirstUnitMiss(t *testing.T) {
	prompt := ExtractPromptFromRequest([]byte(`{
		"messages":[{"role":"user","content":"abcdefghijklmnop"}]
	}`))

	ApplyPromptAccounting(&prompt, &dto.Usage{
		PromptTokens:     4,
		CompletionTokens: 1,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedCreationTokens: 9,
		},
	}, BuildCacheStatsFromUsage(&dto.Usage{
		PromptTokens: 4,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedCreationTokens: 9,
		},
	}), "provider_usage", "exact")

	require.Len(t, prompt.Units, 1)
	require.NotNil(t, prompt.TokenAccounting)
	require.NotNil(t, prompt.CacheBoundary)
	assert.Equal(t, 0, prompt.CacheBoundary.CachedTokens)
	assert.Equal(t, 0, prompt.CacheBoundary.BreakUnitIndex)
	assert.Equal(t, "messages[0].content", prompt.CacheBoundary.BreakUnitPath)
	assert.Equal(t, 0, prompt.CacheBoundary.BreakOffsetTokens)
	assert.Equal(t, "miss", prompt.Units[0].CacheStatus)
	assert.Equal(t, 0, prompt.Units[0].CacheOverlapTokens)
	assert.Equal(t, 9, prompt.TokenAccounting.CacheWriteTokens)
	assert.Equal(t, "provider_usage", prompt.TokenAccounting.Source)
	assert.Equal(t, "exact", prompt.TokenAccounting.Confidence)
	assert.Equal(t, "local_estimate", prompt.Units[0].TokenSource)
	assert.Equal(t, "cache_boundary_inference", prompt.Units[0].CacheSource)
	assert.Equal(t, "inferred", prompt.Units[0].Confidence)
}

func TestPromptCacheBoundaryPartialInsideMessage(t *testing.T) {
	prompt := ExtractPromptFromRequest([]byte(`{
		"messages":[
			{"role":"system","content":"abcdefghijklmnop"},
			{"role":"user","content":"abcdefghijkl"}
		]
	}`))
	usage := &dto.Usage{
		PromptTokens:     7,
		CompletionTokens: 1,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 6,
		},
	}

	ApplyPromptAccounting(&prompt, usage, BuildCacheStatsFromUsage(usage), "provider_usage", "exact")

	require.Len(t, prompt.Units, 2)
	assert.Equal(t, "hit", prompt.Units[0].CacheStatus)
	assert.Equal(t, 4, prompt.Units[0].CacheOverlapTokens)
	assert.Equal(t, "partial", prompt.Units[1].CacheStatus)
	assert.Equal(t, 2, prompt.Units[1].CacheOverlapTokens)
	assert.Equal(t, 1, prompt.CacheBoundary.BreakUnitIndex)
	assert.Equal(t, "messages[1].content", prompt.CacheBoundary.BreakUnitPath)
	assert.Equal(t, 2, prompt.CacheBoundary.BreakOffsetTokens)
}

func TestPromptCacheBoundaryHitMissAcrossMessages(t *testing.T) {
	prompt := ExtractPromptFromRequest([]byte(`{
		"messages":[
			{"role":"system","content":"abcdefghijklmnop"},
			{"role":"user","content":"abcdefghijkl"},
			{"role":"assistant","content":"abcdefgh"}
		]
	}`))
	usage := &dto.Usage{
		PromptTokens: 9,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 7,
		},
	}

	ApplyPromptAccounting(&prompt, usage, BuildCacheStatsFromUsage(usage), "provider_usage", "exact")

	require.Len(t, prompt.Units, 3)
	assert.Equal(t, "hit", prompt.Units[0].CacheStatus)
	assert.Equal(t, "hit", prompt.Units[1].CacheStatus)
	assert.Equal(t, "miss", prompt.Units[2].CacheStatus)
	assert.Equal(t, 2, prompt.CacheBoundary.BreakUnitIndex)
	assert.Equal(t, 0, prompt.CacheBoundary.BreakOffsetTokens)
}

func TestPromptCacheBoundaryScalesProviderTokensToEstimatedFields(t *testing.T) {
	prompt := ExtractPromptFromRequest([]byte(`{
		"messages":[
			{"role":"system","content":"abcdefghijklmnop"},
			{"role":"user","content":"abcdefghijklmnop"}
		]
	}`))
	usage := &dto.Usage{
		PromptTokens: 1000,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 750,
		},
	}

	ApplyPromptAccounting(&prompt, usage, BuildCacheStatsFromUsage(usage), "provider_usage", "exact")

	require.NotNil(t, prompt.CacheBoundary)
	assert.InDelta(t, 0.75, prompt.CacheBoundary.CacheHitRate, 0.0001)
	assert.Equal(t, 6, prompt.CacheBoundary.EstimatedCachedTokens)
	assert.Equal(t, 1, prompt.CacheBoundary.BreakUnitIndex)
	assert.Equal(t, 2, prompt.CacheBoundary.BreakOffsetTokens)
	assert.Equal(t, "hit", prompt.Units[0].CacheStatus)
	assert.Equal(t, "partial", prompt.Units[1].CacheStatus)
	assert.Equal(t, 2, prompt.Units[1].CacheOverlapTokens)
}

func TestPromptCacheBoundaryZeroTokenUnitDoesNotCreateFalseGap(t *testing.T) {
	prompt := PromptDebug{
		TotalEstimatedTokens: 8,
		Units: []PromptUnit{
			{Index: 0, EstimatedTokens: 4, CumulativeStart: 0, CumulativeEnd: 4},
			{Index: 1, EstimatedTokens: 0, CumulativeStart: 4, CumulativeEnd: 4},
			{Index: 2, EstimatedTokens: 4, CumulativeStart: 4, CumulativeEnd: 8},
		},
	}

	applyCacheBoundary(&prompt, 6, 8)

	assert.Equal(t, "hit", prompt.Units[0].CacheStatus)
	assert.Equal(t, "hit", prompt.Units[1].CacheStatus)
	assert.Equal(t, "partial", prompt.Units[2].CacheStatus)
	assert.Equal(t, 2, prompt.CacheBoundary.BreakUnitIndex)
	assert.Equal(t, 2, prompt.CacheBoundary.BreakOffsetTokens)
}

func TestCombinePromptsUsesUpstreamFieldsForProviderAccounting(t *testing.T) {
	inbound := ExtractPromptFromRequest([]byte(`{
		"messages":[{"role":"user","content":"inbound"}]
	}`))
	upstream := ExtractPromptFromRequest([]byte(`{
		"messages":[
			{"role":"system","content":"upstream system"},
			{"role":"user","content":"upstream user"}
		]
	}`))

	combined := combinePrompts(inbound, upstream)

	require.Len(t, combined.Units, 2)
	assert.Equal(t, upstream.Units, combined.Units)
	assert.Equal(t, upstream.TotalEstimatedTokens, combined.TotalEstimatedTokens)
	assert.Equal(t, upstream.RoleCounts, combined.RoleCounts)
	assert.Equal(t, upstream.Units, combined.UpstreamUnits)
}

func TestPromptCacheWriteTokensAreNotCacheHitsAndOverrideIsInferred(t *testing.T) {
	prompt := ExtractPromptFromRequest([]byte(`{
		"messages":[{"role":"user","content":"abcdefghijklmnop"}]
	}`))
	cache := CacheStats{CacheWriteTokens: 12}

	ApplyPromptAccounting(&prompt, &dto.Usage{PromptTokens: 4}, cache, "billing_inference", "inferred")

	require.Len(t, prompt.Units, 1)
	assert.Equal(t, "miss", prompt.Units[0].CacheStatus)
	assert.Equal(t, 0, prompt.Units[0].CacheOverlapTokens)
	require.NotNil(t, prompt.TokenAccounting)
	assert.Equal(t, 12, prompt.TokenAccounting.CacheWriteTokens)
	assert.Equal(t, "billing_inference", prompt.TokenAccounting.CacheWriteSource)
	assert.Equal(t, "inferred", prompt.TokenAccounting.CacheWriteConfidence)
}

func TestExtractOutputFromSSE(t *testing.T) {
	stream := strings.Join([]string{
		`data: {"id":"gen-1","choices":[{"delta":{"content":"Hello ","reasoning_content":"think "},"finish_reason":null}]}`,
		`data: {"id":"gen-1","choices":[{"delta":{"content":"world"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2}}`,
		`data: [DONE]`,
	}, "\n\n")

	output := ExtractOutputFromSSE([]byte(stream))

	assert.Equal(t, "Hello world", output.Output)
	assert.Equal(t, "think ", output.Reasoning)
	assert.Equal(t, "stop", output.FinishReason)
	assert.Equal(t, "gen-1", output.GenerationID)
}

func TestExtractOutputFromResponsesSSE(t *testing.T) {
	stream := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"Hello "}`,
		`data: {"type":"response.output_text.delta","delta":"Responses"}`,
		`data: {"type":"response.completed","response":{"id":"resp-1","status":"completed"}}`,
	}, "\n\n")

	output := ExtractOutputFromSSE([]byte(stream))

	assert.Equal(t, "Hello Responses", output.Output)
	assert.Equal(t, "stop", output.FinishReason)
	assert.Equal(t, "resp-1", output.GenerationID)
}

func TestCaptureAndMergeIntoLogOther(t *testing.T) {
	t.Setenv("GENERATION_DEBUG_ENABLED", "true")
	t.Setenv("GENERATION_DEBUG_CAPTURE_RAW", "true")
	t.Setenv("GENERATION_DEBUG_CAPTURE_OUTPUT", "true")
	t.Setenv("GENERATION_DEBUG_USER_VISIBLE", "true")
	t.Setenv("GENERATION_DEBUG_MAX_BYTES", "4096")

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	requestJSON := `{"model":"test","messages":[{"role":"user","content":"hello"}],"api_key":"secret"}`
	requestReader := strings.NewReader(requestJSON)

	require.True(t, Begin(ctx, "request-1", false))
	CaptureInboundRequest(ctx, map[string]any{
		"model": "test",
		"messages": []any{
			map[string]any{"role": "user", "content": "hello"},
		},
	}, requestReader)
	CaptureUpstreamRequest(ctx, []byte(requestJSON))
	MarkUpstreamStart(ctx)

	response := `{"id":"generation-1","choices":[{"message":{"content":"world"},"finish_reason":"stop"}]}`
	body := WrapResponseBody(ctx, io.NopCloser(strings.NewReader(response)), false)
	_, err := io.ReadAll(body)
	require.NoError(t, err)
	require.NoError(t, body.Close())
	MarkResponseComplete(ctx)

	other := map[string]interface{}{"admin_info": map[string]interface{}{}}
	MergeContextIntoLogOther(ctx, other, &dto.Usage{
		PromptTokens:     10,
		CompletionTokens: 2,
		TotalTokens:      12,
	}, LogMeta{RequestID: "request-1"})

	summary, ok := other["generation_debug"].(*Summary)
	require.True(t, ok)
	require.NotNil(t, summary.Prompt)
	require.NotNil(t, summary.Completion)
	assert.Equal(t, "world", summary.Completion.NormalizedOutput)
	assert.Equal(t, "generation-1", summary.GenerationID)

	adminInfo := other["admin_info"].(map[string]interface{})
	raw, ok := adminInfo["generation_debug_raw"].(*RawDebug)
	require.True(t, ok)
	require.NotNil(t, raw.InboundRequest)
	inbound := raw.InboundRequest.Value.(map[string]any)
	assert.Equal(t, "[REDACTED]", inbound["api_key"])
	require.NotNil(t, raw.RawResponse)
	assert.False(t, raw.RawResponse.Truncated)
}

// TestBeginDisabledByDefault ensures that when GENERATION_DEBUG_ENABLED is unset
// (default false), no capture state is created and merge is a no-op, so Log.Other
// gains no generation_debug field at all.
func TestBeginDisabledByDefaultLeavesOtherUntouched(t *testing.T) {
	t.Setenv("GENERATION_DEBUG_ENABLED", "")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	require.False(t, Begin(ctx, "request-1", false))

	other := map[string]interface{}{"admin_info": map[string]interface{}{"existing": 1}}
	MergeContextIntoLogOther(ctx, other, &dto.Usage{}, LogMeta{})

	assert.NotContains(t, other, "generation_debug")
	adminInfo := other["admin_info"].(map[string]interface{})
	assert.NotContains(t, adminInfo, "generation_debug_raw")
	assert.Equal(t, 1, adminInfo["existing"])
}

// TestExtractOutputFromRawResponse covers Chat Completions non-stream parsing:
// choices[].message.content, reasoning_content, finish_reason and root id.
func TestExtractOutputFromRawResponse(t *testing.T) {
	data := []byte(`{
		"id":"chatcmpl-1",
		"choices":[
			{"index":0,"message":{"content":"Hello","reasoning_content":"think"},"finish_reason":"stop"},
			{"index":1,"message":{"content":" world"},"finish_reason":null}
		]
	}`)

	output := ExtractOutputFromRawResponse(data)

	assert.Equal(t, "Hello world", output.Output)
	assert.Equal(t, "think", output.Reasoning)
	assert.Equal(t, "stop", output.FinishReason)
	assert.Equal(t, "chatcmpl-1", output.GenerationID)
}

// TestExtractOutputFromResponsesRawResponse covers Responses non-stream parsing:
// output[].content[].text extraction and status-derived finish reason.
func TestExtractOutputFromResponsesRawResponse(t *testing.T) {
	data := []byte(`{
		"id":"resp-9",
		"status":"completed",
		"output":[
			{"type":"message","content":[{"type":"output_text","text":"Hi there"}]}
		]
	}`)

	output := ExtractOutputFromRawResponse(data)

	assert.Equal(t, "Hi there", output.Output)
	assert.Equal(t, "stop", output.FinishReason)
	assert.Equal(t, "resp-9", output.GenerationID)
}

// TestBuildCacheStatsFromUsageOpenRouterCostOnly simulates an OpenRouter upstream
// that only reports usage.cost and cached_tokens: BuildCacheStatsFromUsage reads
// the cache-hit source maximum and computes cache_hit_rate against prompt_tokens.
// The OpenRouter cache-creation back-computation happens in the billing layer and
// is fed in via CacheWriteTokensOverride; this test locks the base computation.
func TestBuildCacheStatsFromUsageOpenRouterCostOnly(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 100,
		Cost:             0.0123,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 400,
		},
	}

	stats := BuildCacheStatsFromUsage(usage)

	assert.Equal(t, 400, stats.CachedTokens)
	assert.Equal(t, 0, stats.CacheWriteTokens)
	assert.InDelta(t, 0.4, stats.CacheHitRate, 0.0001)
}

// TestMergeContextAppliesCacheWriteOverride locks the contract that the billing
// layer's OpenRouter-derived cache_write_tokens (from CalcOpenRouterCacheCreateTokens
// via cacheWriteTokensTotal) overrides the raw usage value in the debug summary.
func TestMergeContextAppliesCacheWriteOverride(t *testing.T) {
	t.Setenv("GENERATION_DEBUG_ENABLED", "true")
	t.Setenv("GENERATION_DEBUG_USER_VISIBLE", "false")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.True(t, Begin(ctx, "req", false))

	other := map[string]interface{}{}
	// usage has no explicit cache creation; override simulates the billing-derived value.
	MergeContextIntoLogOther(ctx, other, &dto.Usage{
		PromptTokens: 1000,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 400,
		},
	}, LogMeta{CacheWriteTokensOverride: 250})

	summary, ok := other["generation_debug"].(*Summary)
	require.True(t, ok)
	assert.Equal(t, 250, summary.Cache.CacheWriteTokens)
	assert.Equal(t, 400, summary.Cache.CachedTokens)
}

// TestMergeContextUserVisibleFalseOmitsPromptCompletion ensures that when
// GENERATION_DEBUG_USER_VISIBLE=false, the summary keeps metrics but drops the
// prompt and completion payloads that may contain user-visible prompt/output text.
func TestMergeContextUserVisibleFalseOmitsPromptCompletion(t *testing.T) {
	t.Setenv("GENERATION_DEBUG_ENABLED", "true")
	t.Setenv("GENERATION_DEBUG_USER_VISIBLE", "false")
	t.Setenv("GENERATION_DEBUG_CAPTURE_OUTPUT", "true")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.True(t, Begin(ctx, "req", false))
	CaptureInboundRequest(ctx, map[string]any{
		"messages": []any{map[string]any{"role": "user", "content": "secret prompt"}},
	}, strings.NewReader(`{"messages":[{"role":"user","content":"secret prompt"}]}`))

	other := map[string]interface{}{}
	MergeContextIntoLogOther(ctx, other, &dto.Usage{PromptTokens: 5, CompletionTokens: 2}, LogMeta{})

	summary, ok := other["generation_debug"].(*Summary)
	require.True(t, ok)
	assert.Nil(t, summary.Prompt)
	assert.Nil(t, summary.Completion)
	assert.Equal(t, 5, summary.PromptTokens)
}

// TestMergeContextCaptureRawFalseOmitsAdminRaw ensures RAW is never written to
// admin_info when GENERATION_DEBUG_CAPTURE_RAW=false (default), even with admin
// privileges. RAW must remain admin-only and opt-in.
func TestMergeContextCaptureRawFalseOmitsAdminRaw(t *testing.T) {
	t.Setenv("GENERATION_DEBUG_ENABLED", "true")
	t.Setenv("GENERATION_DEBUG_CAPTURE_RAW", "false")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.True(t, Begin(ctx, "req", false))
	CaptureInboundRequest(ctx, map[string]any{"messages": []any{}}, strings.NewReader(`{}`))
	CaptureUpstreamRequest(ctx, []byte(`{"model":"x"}`))
	body := WrapResponseBody(ctx, io.NopCloser(strings.NewReader(`{"id":"g"}`)), false)
	_, _ = io.ReadAll(body)
	_ = body.Close()

	other := map[string]interface{}{}
	MergeContextIntoLogOther(ctx, other, &dto.Usage{}, LogMeta{})

	_, ok := other["generation_debug"].(*Summary)
	require.True(t, ok)
	adminInfo, hasAdmin := other["admin_info"].(map[string]interface{})
	if hasAdmin {
		assert.NotContains(t, adminInfo, "generation_debug_raw")
	}
}

// runCaptureLifecycle drives Begin->capture->wrap->read->merge for a single
// request shape and returns the resulting other map. Centralizes the mock
// Chat/Responses lifecycle used by the integration tests below.
func runCaptureLifecycle(t *testing.T, streaming bool, response string, usage *dto.Usage) map[string]interface{} {
	t.Helper()
	t.Setenv("GENERATION_DEBUG_ENABLED", "true")
	t.Setenv("GENERATION_DEBUG_CAPTURE_RAW", "true")
	t.Setenv("GENERATION_DEBUG_CAPTURE_OUTPUT", "true")
	t.Setenv("GENERATION_DEBUG_USER_VISIBLE", "true")

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.True(t, Begin(ctx, "request-1", streaming))

	requestJSON := `{"model":"test","messages":[{"role":"user","content":"hello"}]}`
	CaptureInboundRequest(ctx, map[string]any{
		"model": "test",
		"messages": []any{
			map[string]any{"role": "user", "content": "hello"},
		},
	}, strings.NewReader(requestJSON))
	CaptureUpstreamRequest(ctx, []byte(requestJSON))
	MarkUpstreamStart(ctx)

	body := WrapResponseBody(ctx, io.NopCloser(strings.NewReader(response)), streaming)
	_, err := io.ReadAll(body)
	require.NoError(t, err)
	require.NoError(t, body.Close())
	MarkResponseComplete(ctx)

	other := map[string]interface{}{}
	MergeContextIntoLogOther(ctx, other, usage, LogMeta{RequestID: "request-1"})
	return other
}

// TestIntegrationChatNonStream verifies a mock Chat Completions non-stream request
// writes summary + prompt + completion into Other.generation_debug, and RAW into
// admin_info.generation_debug_raw only.
func TestIntegrationChatNonStream(t *testing.T) {
	response := `{"id":"chatcmpl-1","choices":[{"message":{"content":"world"},"finish_reason":"stop"}]}`
	other := runCaptureLifecycle(t, false, response, &dto.Usage{
		PromptTokens:     10,
		CompletionTokens: 1,
		TotalTokens:      11,
	})

	summary, ok := other["generation_debug"].(*Summary)
	require.True(t, ok)
	require.NotNil(t, summary.Prompt)
	require.NotNil(t, summary.Completion)
	assert.Equal(t, "world", summary.Completion.NormalizedOutput)
	assert.Equal(t, "stop", summary.Completion.FinishReason)
	assert.Equal(t, "chatcmpl-1", summary.GenerationID)
	assert.False(t, summary.Streaming)

	adminInfo := other["admin_info"].(map[string]interface{})
	raw, ok := adminInfo["generation_debug_raw"].(*RawDebug)
	require.True(t, ok)
	require.NotNil(t, raw.InboundRequest)
	require.NotNil(t, raw.UpstreamRequest)
	require.NotNil(t, raw.RawResponse)
	assert.Nil(t, raw.RawStream)
}

// TestIntegrationChatSSE verifies a mock Chat Completions SSE stream writes a
// raw_stream summary, best-effort extracts the LLM output and finish_reason,
// and tags streaming=true.
func TestIntegrationChatSSE(t *testing.T) {
	stream := strings.Join([]string{
		`data: {"id":"chatcmpl-2","choices":[{"delta":{"content":"Hello "}}]}`,
		`data: {"id":"chatcmpl-2","choices":[{"delta":{"content":"world"},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
	}, "\n\n")
	other := runCaptureLifecycle(t, true, stream, &dto.Usage{
		PromptTokens:     10,
		CompletionTokens: 2,
	})

	summary, ok := other["generation_debug"].(*Summary)
	require.True(t, ok)
	require.NotNil(t, summary.Completion)
	assert.Equal(t, "Hello world", summary.Completion.NormalizedOutput)
	assert.Equal(t, "stop", summary.Completion.FinishReason)
	assert.Equal(t, "chatcmpl-2", summary.GenerationID)
	assert.True(t, summary.Streaming)

	adminInfo := other["admin_info"].(map[string]interface{})
	raw, ok := adminInfo["generation_debug_raw"].(*RawDebug)
	require.True(t, ok)
	require.NotNil(t, raw.RawStream)
	assert.Nil(t, raw.RawResponse)
}

// TestIntegrationResponsesRequest verifies a mock OpenAI Responses request writes
// generation_debug with Responses-shaped output extraction.
func TestIntegrationResponsesRequest(t *testing.T) {
	response := `{"id":"resp-3","status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"done"}]}]}`
	other := runCaptureLifecycle(t, false, response, &dto.Usage{
		PromptTokens:     8,
		CompletionTokens: 1,
	})

	summary, ok := other["generation_debug"].(*Summary)
	require.True(t, ok)
	require.NotNil(t, summary.Completion)
	assert.Equal(t, "done", summary.Completion.NormalizedOutput)
	assert.Equal(t, "resp-3", summary.GenerationID)

	adminInfo := other["admin_info"].(map[string]interface{})
	raw, ok := adminInfo["generation_debug_raw"].(*RawDebug)
	require.True(t, ok)
	require.NotNil(t, raw.RawResponse)
}

// TestUserLogStrippingRemovesAdminRaw mirrors model.formatUserLogs: it deletes the
// whole admin_info key from Other. This locks the guarantee that RAW (which lives
// only under admin_info.generation_debug_raw) never reaches ordinary users, while
// the user-visible generation_debug summary survives.
func TestUserLogStrippingRemovesAdminRaw(t *testing.T) {
	response := `{"id":"g","choices":[{"message":{"content":"x"},"finish_reason":"stop"}]}`
	other := runCaptureLifecycle(t, false, response, &dto.Usage{PromptTokens: 1, CompletionTokens: 1})

	// Serialize as the log layer does, then strip admin_info like formatUserLogs.
	otherBytes, err := common.Marshal(other)
	require.NoError(t, err)
	stripped, err := common.StrToMap(string(otherBytes))
	require.NoError(t, err)
	delete(stripped, "admin_info")

	_, hasUserSummary := stripped["generation_debug"]
	assert.True(t, hasUserSummary, "user-visible generation_debug must survive stripping")
	assert.NotContains(t, stripped, "admin_info", "admin_info must be removed for ordinary users")

	// Re-encode and confirm no generation_debug_raw string leaks into user payload.
	userJSON := common.MapToJsonStr(stripped)
	assert.NotContains(t, userJSON, "generation_debug_raw")
	assert.NotContains(t, userJSON, "admin_info")
}

// TestRawStreamTruncation verifies the tee reader caps captured bytes at
// GENERATION_DEBUG_MAX_BYTES and marks truncated=true when the stream exceeds it.
func TestRawStreamTruncation(t *testing.T) {
	t.Setenv("GENERATION_DEBUG_ENABLED", "true")
	t.Setenv("GENERATION_DEBUG_CAPTURE_RAW", "true")
	t.Setenv("GENERATION_DEBUG_MAX_BYTES", "64")
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.True(t, Begin(ctx, "req", true))
	CaptureInboundRequest(ctx, map[string]any{}, strings.NewReader(`{}`))
	CaptureUpstreamRequest(ctx, []byte(`{}`))
	MarkUpstreamStart(ctx)

	long := "data: " + strings.Repeat("a", 400) + "\n\n"
	body := WrapResponseBody(ctx, io.NopCloser(strings.NewReader(long)), true)
	_, err := io.ReadAll(body)
	require.NoError(t, err)
	require.NoError(t, body.Close())

	other := map[string]interface{}{}
	MergeContextIntoLogOther(ctx, other, &dto.Usage{}, LogMeta{})

	adminInfo := other["admin_info"].(map[string]interface{})
	raw, ok := adminInfo["generation_debug_raw"].(*RawDebug)
	require.True(t, ok)
	require.NotNil(t, raw.RawStream)
	assert.True(t, raw.RawStream.Truncated, "stream larger than MAX_BYTES must be marked truncated")
	assert.Greater(t, raw.RawStream.CapturedBytes, 64)
}
