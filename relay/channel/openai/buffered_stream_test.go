package openai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOaiBufferedStreamHandler_AggregatesContent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"kimi-k2.6","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"kimi-k2.6","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"kimi-k2.6","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}]}`,
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"kimi-k2.6","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "kimi-k2.6"},
		IsStream:    true,
		UpstreamStreamForced: true,
	}

	usage, apiErr := OaiBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 3, usage.CompletionTokens)
	assert.Equal(t, 10, usage.PromptTokens)

	body := w.Body.String()
	assert.Contains(t, body, `"object":"chat.completion"`)
	assert.Contains(t, body, "Hello world!")
}

func TestOaiBufferedStreamHandler_AggregatesReasoningContent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-2","object":"chat.completion.chunk","created":1,"model":"deepseek-r1","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"Thinking"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-2","object":"chat.completion.chunk","created":1,"model":"deepseek-r1","choices":[{"index":0,"delta":{"reasoning_content":" about it"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-2","object":"chat.completion.chunk","created":1,"model":"deepseek-r1","choices":[{"index":0,"delta":{"content":"Answer"},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "deepseek-r1"},
		IsStream:    true,
		UpstreamStreamForced: true,
	}

	usage, apiErr := OaiBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	body := w.Body.String()
	assert.Contains(t, body, "Answer")
	// Verify reasoning_content is present in the response
	var textResp dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal([]byte(body), &textResp))
	require.Len(t, textResp.Choices, 1)
	assert.NotEmpty(t, textResp.Choices[0].Message.GetReasoningContent())
	assert.Contains(t, textResp.Choices[0].Message.GetReasoningContent(), "Thinking about it")
}

func TestOaiBufferedStreamHandler_AggregatesToolCalls(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-3","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-3","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"loc"}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-3","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ation\":\"NYC\"}"}}]},"finish_reason":"tool_calls"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4"},
		IsStream:    true,
		UpstreamStreamForced: true,
	}

	usage, apiErr := OaiBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	body := w.Body.String()
	var textResp dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal([]byte(body), &textResp))
	require.Len(t, textResp.Choices, 1)
	toolCalls := textResp.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "get_weather", toolCalls[0].Function.Name)
	assert.Equal(t, `{"location":"NYC"}`, toolCalls[0].Function.Arguments)
	assert.Equal(t, "tool_calls", textResp.Choices[0].FinishReason)
}

func TestOaiBufferedStreamHandler_MissingFinishChunk(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-4","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "test"},
		IsStream:    true,
		UpstreamStreamForced: true,
	}

	usage, apiErr := OaiBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	body := w.Body.String()
	assert.Contains(t, body, "Hi")
	assert.Contains(t, body, `"object":"chat.completion"`)
}

// TestOaiBufferedStreamHandler_ToolCallBilling verifies that the buffered
// handler counts billable tool calls for special tool pricing, matching
// OaiStreamHandler and OpenaiHandler (P2-3). Without this, forced streams
// that return tool_calls skip per-call tool billing.
func TestOaiBufferedStreamHandler_ToolCallBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)

	operation_setting.SetToolPriceForTest("my_priced_fn", 5.0)
	t.Cleanup(func() {
		operation_setting.DeleteToolPriceForTest("my_priced_fn")
	})

	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-tb","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"my_priced_fn","arguments":""}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-tb","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]},"finish_reason":"tool_calls"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta:          &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4"},
		OriginModelName:      "gpt-4",
		IsStream:             true,
		UpstreamStreamForced: true,
	}

	_, apiErr := OaiBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)

	require.NotNil(t, info.ResponsesUsageInfo, "ResponsesUsageInfo must be initialized by CountBillableToolCall")
	require.Contains(t, info.ResponsesUsageInfo.BuiltInTools, "my_priced_fn",
		"priced tool call must be counted for billing")
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools["my_priced_fn"].CallCount,
		"call count must be 1 for a single tool invocation")
}

// TestOaiBufferedStreamHandler_UsagePostProcessing verifies that the buffered
// handler applies channel-specific usage post-processing (e.g. DeepSeek
// cache-hit token migration), matching OpenaiHandler (P2-3). Without this,
// DeepSeek cached-token billing is silently lost on forced streams.
func TestOaiBufferedStreamHandler_UsagePostProcessing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-up","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":"stop"}]}`,
		`data: {"id":"chatcmpl-up","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":1,"total_tokens":11,"prompt_cache_hit_tokens":5}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeDeepSeek,
			UpstreamModelName: "deepseek-chat",
		},
		OriginModelName:      "deepseek-chat",
		IsStream:             true,
		UpstreamStreamForced: true,
	}

	usage, apiErr := OaiBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	assert.Equal(t, 5, usage.PromptTokensDetails.CachedTokens,
		"DeepSeek prompt_cache_hit_tokens must be migrated to PromptTokensDetails.CachedTokens by applyUsagePostProcessing")

	body := w.Body.String()
	var textResp dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal([]byte(body), &textResp))
	assert.Equal(t, 5, textResp.Usage.PromptTokensDetails.CachedTokens,
		"response body must reflect migrated cached tokens")
}

// TestOaiBufferedStreamHandler_ContentTypeIsJSON verifies that the buffered
// handler sets Content-Type to application/json, not the upstream's
// text/event-stream.  A strict HTTP client rejects a JSON body declared as
// text/event-stream (P0-1).
func TestOaiBufferedStreamHandler_ContentTypeIsJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-ct","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta:          &relaycommon.ChannelMeta{UpstreamModelName: "test"},
		IsStream:             true,
		UpstreamStreamForced: true,
	}

	_, apiErr := OaiBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)

	contentType := w.Header().Get("Content-Type")
	assert.Contains(t, contentType, "application/json",
		"Content-Type must be application/json, got: %s", contentType)
	assert.NotContains(t, contentType, "text/event-stream",
		"Content-Type must not leak upstream text/event-stream")
}

// TestOaiBufferedStreamHandler_UpstreamErrorEvent verifies that an error event
// in the SSE stream is surfaced as an API error -- the handler returns a
// NewAPIError and nil usage so the client sees the failure and billing is not
// charged for an empty success.
func TestOaiBufferedStreamHandler_UpstreamErrorEvent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sseBody := strings.Join([]string{
		`data: {"error":{"message":"rate limited","type":"rate_limit_error"}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta:          &relaycommon.ChannelMeta{UpstreamModelName: "test"},
		IsStream:             true,
		UpstreamStreamForced: true,
	}

	usage, apiErr := OaiBufferedStreamHandler(c, info, resp)
	// An upstream error event is a real error, not data. The handler must
	// return a NewAPIError and nil usage so the client sees the failure
	// and billing is not charged for an empty success.
	require.NotNil(t, apiErr, "handler must return API error for in-stream error event")
	assert.Nil(t, usage, "usage must be nil when upstream returns error")
	assert.Contains(t, apiErr.Error(), "upstream error", "error message must mention upstream")
}

// TestOaiBufferedStreamHandler_MalformedDataLines verifies that malformed
// data lines in the SSE stream are skipped without causing errors.
// Note: an empty data payload ("data: \n") is treated as stream end by
// the handler (matching OaiStreamHandler behavior), so this test only
// covers non-empty malformed lines.
func TestOaiBufferedStreamHandler_MalformedDataLines(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sseBody := strings.Join([]string{
		`data: not-json`,
		`data: {"id":"x","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{"content":"OK"},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta:          &relaycommon.ChannelMeta{UpstreamModelName: "test"},
		IsStream:             true,
		UpstreamStreamForced: true,
	}

	_, apiErr := OaiBufferedStreamHandler(c, info, resp)
	assert.Nil(t, apiErr, "handler must skip malformed lines without error")
	body := w.Body.String()
	assert.Contains(t, body, "OK", "valid content after malformed lines must be aggregated")
}

// TestOaiBufferedStreamHandler_ToolCallOnlyChoiceNotDropped verifies that a
// choice index which receives only tool_calls (no content, no reasoning, no
// finish_reason) is still present in the aggregated response. Without
// collecting indices from accumulatedToolCalls, such a choice is silently
// dropped from allIndices and never appears in the output.
func TestOaiBufferedStreamHandler_ToolCallOnlyChoiceNotDropped(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Choice index 1 receives ONLY tool_calls — no content, no finish_reason.
	// The buggy code only collected indices from content/reasoning/finishReason,
	// so index 1 would be dropped. The fix adds accumulatedToolCalls to the
	// index collection.
	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-tc-only","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}`,
		`data: {"id":"chatcmpl-tc-only","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":1,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_x","type":"function","function":{"name":"do_thing","arguments":"{}"}}]}}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta:          &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4"},
		IsStream:             true,
		UpstreamStreamForced: true,
	}

	_, apiErr := OaiBufferedStreamHandler(c, info, resp)
	require.Nil(t, apiErr)

	body := w.Body.String()
	var textResp dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal([]byte(body), &textResp))
	require.Len(t, textResp.Choices, 2, "both choice indices must appear: index 0 (content) and index 1 (tool_calls only)")

	// Find choice with index 1
	var choice1 *dto.OpenAITextResponseChoice
	for i := range textResp.Choices {
		if textResp.Choices[i].Index == 1 {
			choice1 = &textResp.Choices[i]
			break
		}
	}
	require.NotNil(t, choice1, "choice index 1 (tool_calls only) must not be dropped")
	toolCalls := choice1.Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "do_thing", toolCalls[0].Function.Name)
}

// TestOaiBufferedStreamHandler_NilUsageNoPanic verifies that the handler does
// not panic when the upstream returns no usage object and the fallback
// estimator returns nil (simulated via empty content + empty model name).
// Without the nil guard, `Usage: *usage` dereferences a nil pointer.
func TestOaiBufferedStreamHandler_NilUsageNoPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// SSE stream with no usage chunk and no content (so ResponseText2Usage
	// gets empty string). An empty model name makes the estimator return nil.
	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-nil","object":"chat.completion.chunk","created":1,"model":"","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta:          &relaycommon.ChannelMeta{UpstreamModelName: ""},
		IsStream:             true,
		UpstreamStreamForced: true,
	}

	// Must not panic
	require.NotPanics(t, func() {
		usage, apiErr := OaiBufferedStreamHandler(c, info, resp)
		require.Nil(t, apiErr)
		require.NotNil(t, usage, "usage must be non-nil even when estimator returns nil")
	})

	body := w.Body.String()
	assert.Contains(t, body, "chat.completion", "response must still be valid JSON")
}

