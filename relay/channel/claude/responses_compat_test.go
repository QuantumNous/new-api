package claude

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	constant.StreamingTimeout = 30
}

func TestClaudeResponsesStreamHandlerEmitsResponseCompleted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	upstream := strings.Join([]string{
		`event: message_start`,
		`data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-sonnet-4-6","usage":{"input_tokens":11,"output_tokens":0}}}`,
		``,
		`event: content_block_start`,
		`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
		``,
		`event: content_block_delta`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello"}}`,
		``,
		`event: content_block_stop`,
		`data: {"type":"content_block_stop","index":0}`,
		``,
		`event: message_delta`,
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"input_tokens":11,"output_tokens":3}}`,
		``,
		`event: message_stop`,
		`data: {"type":"message_stop"}`,
		``,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(upstream)),
	}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "claude-sonnet-4-6"}}

	usage, err := ClaudeResponsesStreamHandler(c, resp, info)
	require.Nil(t, err)
	require.Equal(t, 11, usage.PromptTokens)
	require.Equal(t, 3, usage.CompletionTokens)

	body := w.Body.String()
	require.Contains(t, body, "event: response.created")
	require.Contains(t, body, `"status":"in_progress"`)
	require.Contains(t, body, `"output":[]`)
	require.NotContains(t, body, `"output":null`)
	require.NotContains(t, body, `"input_tokens_details":null`)
	require.Contains(t, body, `"output_tokens_details":`)
	require.Contains(t, body, `"sequence_number":0`)
	require.Contains(t, body, "event: response.output_text.delta")
	require.Contains(t, body, "event: response.completed")
	require.Contains(t, body, `"status":"completed"`)

	var completedSeen bool
	for _, block := range strings.Split(body, "\n\n") {
		if strings.Contains(block, "event: response.completed") {
			completedSeen = true
			data := strings.TrimSpace(strings.TrimPrefix(strings.Split(block, "data: ")[1], ""))
			var payload map[string]any
			require.NoError(t, common.Unmarshal([]byte(data), &payload))
			require.Equal(t, "response.completed", payload["type"])
		}
	}
	require.True(t, completedSeen)
}

func TestClaudeResponsesStreamHandlerMapsThinkingToReasoningSummary(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	upstream := strings.Join([]string{
		`data: {"type":"message_start","message":{"id":"msg_thinking","type":"message","role":"assistant","model":"grok-4.6","usage":{"input_tokens":9,"output_tokens":0}}}`,
		``,
		`data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}`,
		``,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"checking sources"}}`,
		``,
		`data: {"type":"content_block_stop","index":0}`,
		``,
		`data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}`,
		``,
		`data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"answer"}}`,
		``,
		`data: {"type":"content_block_stop","index":1}`,
		``,
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":9,"output_tokens":5}}`,
		``,
		`data: {"type":"message_stop"}`,
		``,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(upstream)),
	}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "grok-4.6"}}

	_, err := ClaudeResponsesStreamHandler(c, resp, info)
	require.Nil(t, err)
	body := w.Body.String()
	require.Contains(t, body, "event: response.reasoning_summary_part.added")
	require.Contains(t, body, "event: response.reasoning_summary_text.delta")
	require.Contains(t, body, `"delta":"checking sources"`)
	require.Contains(t, body, "event: response.reasoning_summary_text.done")
	require.Contains(t, body, "event: response.reasoning_summary_part.done")
	require.Contains(t, body, `"type":"reasoning"`)
	require.Contains(t, body, `"summary":[{"type":"summary_text","text":"checking sources"}]`)
	require.Contains(t, body, "event: response.output_text.delta")
	require.Less(t, strings.Index(body, "response.reasoning_summary_text.delta"), strings.Index(body, "response.output_text.delta"))
}

func TestClaudeResponsesStreamHandlerEmitsEmptyFunctionArgumentsOnAdded(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	upstream := strings.Join([]string{
		`data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"grok-4.6","usage":{"input_tokens":11,"output_tokens":0}}}`,
		``,
		`data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_1","name":"read_file","input":{}}}`,
		``,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"path\":\"probe.txt\"}"}}`,
		``,
		`data: {"type":"content_block_stop","index":0}`,
		``,
		`data: {"type":"message_stop"}`,
		``,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(upstream)),
	}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "grok-4.6"}}

	_, err := ClaudeResponsesStreamHandler(c, resp, info)
	require.Nil(t, err)
	body := w.Body.String()
	require.Contains(t, body, "event: response.output_item.added")
	require.Contains(t, body, `"arguments":""`)
	require.Contains(t, body, `"arguments":"{\"path\":\"probe.txt\"}"`)
	require.Contains(t, body, `"parallel_tool_calls":true`)
	require.NotContains(t, body, `"parallel_tool_calls":false`)
	require.NotContains(t, body, `"role":""`)
	require.NotContains(t, body, `"content":null`)
	require.NotContains(t, body, `"quality":""`)
	require.NotContains(t, body, `"prompt_tokens"`)

	sequence := 0
	for _, line := range strings.Split(body, "\n") {
		if !strings.HasPrefix(line, "data: {") {
			continue
		}
		var event map[string]any
		require.NoError(t, common.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &event))
		require.Equal(t, float64(sequence), event["sequence_number"])
		sequence++
	}
	require.Greater(t, sequence, 1)
}

func TestClaudeResponsesHandlerReturnsCompletedResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	text := "hello"
	body := `{
		"id":"msg_1",
		"type":"message",
		"role":"assistant",
		"model":"claude-sonnet-4-6",
		"content":[{"type":"text","text":"hello"}],
		"usage":{"input_tokens":7,"output_tokens":2}
	}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "claude-sonnet-4-6"}}

	usage, err := ClaudeResponsesHandler(c, resp, info)
	require.Nil(t, err)
	require.Equal(t, 7, usage.PromptTokens)
	require.Equal(t, 2, usage.CompletionTokens)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &payload))
	require.Equal(t, "response", payload["object"])
	require.Equal(t, "completed", payload["status"])
	require.Equal(t, "claude-sonnet-4-6", payload["model"])
	outputs, ok := payload["output"].([]any)
	require.True(t, ok)
	require.NotEmpty(t, outputs)
	first, ok := outputs[0].(map[string]any)
	require.True(t, ok)
	content, ok := first["content"].([]any)
	require.True(t, ok)
	require.NotEmpty(t, content)
	firstContent, ok := content[0].(map[string]any)
	require.True(t, ok)
	gotText, _ := firstContent["text"].(string)
	require.Contains(t, gotText, text)
}

func TestUsageFromClaudeUsageFallsBackWhenUpstreamInputIsZero(t *testing.T) {
	info := &relaycommon.RelayInfo{}
	info.SetEstimatePromptTokens(321)

	usage := usageFromClaudeUsage(&dto.ClaudeUsage{OutputTokens: 7}, info)

	require.Equal(t, 321, usage.PromptTokens)
	require.Equal(t, 321, usage.InputTokens)
	require.Equal(t, 7, usage.CompletionTokens)
	require.Equal(t, 328, usage.TotalTokens)
}

func TestUsageFromClaudeUsageDoesNotEstimateCacheOnlyInput(t *testing.T) {
	info := &relaycommon.RelayInfo{}
	info.SetEstimatePromptTokens(999)

	usage := usageFromClaudeUsage(&dto.ClaudeUsage{
		OutputTokens:             7,
		CacheReadInputTokens:     101,
		CacheCreationInputTokens: 13,
	}, info)

	require.Equal(t, 114, usage.PromptTokens)
	require.Equal(t, 101, usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 13, usage.PromptTokensDetails.CachedCreationTokens)
	require.Equal(t, 121, usage.TotalTokens)
}

func TestCursorHarnessResponsesToolTurnDefersOutputOnlyUsage(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType:       constant.ChannelTypeCursorAgent,
		UpstreamModelName: "claude-sonnet-4-6",
	}}
	info.SetEstimatePromptTokens(999)
	raw := &dto.ClaudeUsage{InputTokens: 100, CacheReadInputTokens: 80, OutputTokens: 7}

	usage := deferCursorHarnessResponsesUsage(info, true, usageFromClaudeUsage(raw, info))

	require.Zero(t, usage.PromptTokens)
	require.Zero(t, usage.CompletionTokens)
	require.Zero(t, usage.TotalTokens)
	require.Equal(t, dto.UsageSourceCursorHarnessDeferred, usage.UsageSource)
}

func TestCursorHarnessResponsesStreamToolTurnForcesDeferredUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType:       constant.ChannelTypeCursorAgent,
		UpstreamModelName: "claude-sonnet-4-6",
	}}
	info.SetEstimatePromptTokens(456)
	state := newClaudeResponsesStreamState(c, info)
	state.hasToolUse = true
	state.mergeClaudeUsage(&dto.ClaudeUsage{OutputTokens: 9})

	require.NoError(t, state.complete(c))
	require.Zero(t, state.usage.PromptTokens)
	require.Zero(t, state.usage.CompletionTokens)
	require.Zero(t, state.usage.TotalTokens)
	require.Equal(t, dto.UsageSourceCursorHarnessDeferred, state.usage.UsageSource)
}

func TestClaudeResponsesStreamCompletionFallsBackWhenUpstreamInputIsZero(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "grok-4.6"}}
	info.SetEstimatePromptTokens(456)
	state := newClaudeResponsesStreamState(c, info)
	state.mergeClaudeUsage(&dto.ClaudeUsage{OutputTokens: 9})

	require.NoError(t, state.complete(c))
	require.Equal(t, 456, state.usage.PromptTokens)
	require.Equal(t, 456, state.usage.InputTokens)
	require.Equal(t, 9, state.usage.CompletionTokens)
	require.Equal(t, 465, state.usage.TotalTokens)
}

func TestClaudeResponsesStreamMergePreservesCacheAcrossOutputOnlyDelta(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "grok-4.6"}}
	info.SetEstimatePromptTokens(999)
	state := newClaudeResponsesStreamState(c, info)

	state.mergeClaudeUsage(&dto.ClaudeUsage{
		CacheReadInputTokens:     101,
		CacheCreationInputTokens: 13,
	})
	state.mergeClaudeUsage(&dto.ClaudeUsage{OutputTokens: 7})

	require.Equal(t, 114, state.usage.PromptTokens)
	require.Equal(t, 101, state.usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 13, state.usage.PromptTokensDetails.CachedCreationTokens)
	require.NotNil(t, state.usage.InputTokensDetails)
	require.Equal(t, 101, state.usage.InputTokensDetails.CachedTokens)
	require.Equal(t, 13, state.usage.InputTokensDetails.CachedCreationTokens)
	require.Equal(t, 7, state.usage.CompletionTokens)
	require.Equal(t, 121, state.usage.TotalTokens)
}
