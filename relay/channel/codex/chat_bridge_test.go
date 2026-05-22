package codex

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestToCompatChatRequest_MapsBasicFields(t *testing.T) {
	streamTrue := true
	temp := 0.7
	topP := 0.9
	maxTok := uint(1024)

	req := &dto.GeneralOpenAIRequest{
		Model:           "gpt-5",
		Stream:          &streamTrue,
		Temperature:     &temp,
		TopP:            &topP,
		MaxTokens:       &maxTok,
		ReasoningEffort: "high",
		Messages: []dto.Message{
			{Role: "system", Content: json.RawMessage(`"hello sys"`)},
			{Role: "user", Content: json.RawMessage(`"hello user"`)},
		},
	}

	out, err := ToCompatChatRequest(req)
	require.NoError(t, err)
	assert.Equal(t, "gpt-5", out.Model)
	assert.True(t, out.Stream)
	require.NotNil(t, out.Temperature)
	assert.Equal(t, 0.7, *out.Temperature)
	require.NotNil(t, out.TopP)
	assert.Equal(t, 0.9, *out.TopP)
	require.NotNil(t, out.MaxTokens)
	assert.Equal(t, 1024, *out.MaxTokens)
	assert.Equal(t, "high", out.ReasoningEffort)
	require.Len(t, out.Messages, 2)
	assert.Equal(t, "system", out.Messages[0].Role)
	assert.Equal(t, "user", out.Messages[1].Role)
}

func TestToCompatChatRequest_StreamNilTreatedAsFalse(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:    "m",
		Messages: []dto.Message{{Role: "user", Content: json.RawMessage(`"hi"`)}},
	}
	out, err := ToCompatChatRequest(req)
	require.NoError(t, err)
	assert.False(t, out.Stream)
}

func TestApplyCodexConstraints_StripsBannedFields(t *testing.T) {
	temp := 0.7
	topP := 0.9
	maxOut := 1024

	req := &apicompat.ResponsesRequest{
		Model:           "gpt-5",
		MaxOutputTokens: &maxOut,
		Temperature:     &temp,
		TopP:            &topP,
	}

	applyCodexConstraints(req, nil)

	assert.Nil(t, req.MaxOutputTokens)
	assert.Nil(t, req.Temperature)
	assert.Nil(t, req.TopP)
	require.NotNil(t, req.Store)
	assert.False(t, *req.Store)
	assert.True(t, req.Stream)
	// Instructions: 空 info 时应保持空字符串
	assert.Equal(t, "", req.Instructions)
}

func TestEnsureInstructionsField_AddsEmptyWhenAbsent(t *testing.T) {
	req := &apicompat.ResponsesRequest{Model: "gpt-5"}
	m, err := ensureInstructionsField(req)
	require.NoError(t, err)
	v, ok := m["instructions"]
	require.True(t, ok, "instructions key must be present")
	assert.Equal(t, "", v)
}

func TestEnsureInstructionsField_PreservesNonEmpty(t *testing.T) {
	req := &apicompat.ResponsesRequest{Model: "gpt-5", Instructions: "you are helpful"}
	m, err := ensureInstructionsField(req)
	require.NoError(t, err)
	assert.Equal(t, "you are helpful", m["instructions"])
}

func TestRelayChatOverCodex_StreamPath_BasicText(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstreamSSE := strings.Join([]string{
		`event: response.created`,
		`data: {"type":"response.created","response":{"id":"resp_1"}}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":"Hello"}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":" world"}`,
		``,
		`event: response.completed`,
		`data: {"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":3,"output_tokens":2}}}`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte(upstreamSSE))),
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		UserWantsStream: true,
		IsStream:        true,
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
	}

	_, apiErr := RelayChatOverCodex(c, info, resp)
	require.Nil(t, apiErr)

	body := rec.Body.String()
	assert.Contains(t, body, `"role":"assistant"`)
	assert.Contains(t, body, "Hello")
	assert.Contains(t, body, "world")
	assert.Contains(t, body, `"finish_reason":"stop"`)
	assert.Contains(t, body, "[DONE]")
}

func TestRelayChatOverCodex_NonStream_AggregatesAndReturnsJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstreamSSE := strings.Join([]string{
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":"Hello "}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":"world"}`,
		``,
		`event: response.completed`,
		`data: {"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":5,"output_tokens":2}}}`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte(upstreamSSE))),
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		UserWantsStream: false,
		IsStream:        true,
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
	}

	_, apiErr := RelayChatOverCodex(c, info, resp)
	require.Nil(t, apiErr)

	body := rec.Body.String()
	assert.NotContains(t, body, "data: ")
	assert.Contains(t, body, `"choices"`)
	assert.Contains(t, body, "Hello world")
	// usage 必须出现在非流式 chat 响应体里
	assert.Contains(t, body, `"usage"`)
	assert.Contains(t, body, `"prompt_tokens"`)
	assert.Contains(t, body, `"completion_tokens"`)
}

func TestApplyCodexConstraints_DoesNotChangeBehaviorOnResponsesPath(t *testing.T) {
	// 该函数本身确实强制 Stream=true；调用方负责按需还原。
	req := &apicompat.ResponsesRequest{}
	applyCodexConstraints(req, nil)
	assert.True(t, req.Stream, "applyCodexConstraints forces stream=true (callers may override)")
}

func TestConvertOpenAIResponsesRequest_NonCompactPreservesClientStreamFalse(t *testing.T) {
	streamFalse := false
	req := dto.OpenAIResponsesRequest{
		Model:  "gpt-5",
		Stream: &streamFalse,
	}
	a := &Adaptor{}
	out, err := a.ConvertOpenAIResponsesRequest(nil, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}, req)
	require.NoError(t, err)
	m, ok := out.(map[string]any)
	require.True(t, ok, "ConvertOpenAIResponsesRequest non-compact returns map[string]any")
	streamVal, hasStream := m["stream"]
	if hasStream {
		assert.Equal(t, false, streamVal, "client stream:false must survive applyCodexConstraints")
	}
	// 若 omitempty 把 false 丢掉也可接受——上游缺省即为 non-stream。
	// 这条测试关键点是 stream 不能被错误地置为 true。
	assert.NotEqual(t, true, streamVal, "client stream:false must NOT be flipped to true")
}

func TestConvertOpenAIResponsesRequest_NonCompactPreservesClientStreamTrue(t *testing.T) {
	streamTrue := true
	req := dto.OpenAIResponsesRequest{
		Model:  "gpt-5",
		Stream: &streamTrue,
	}
	a := &Adaptor{}
	out, err := a.ConvertOpenAIResponsesRequest(nil, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}, req)
	require.NoError(t, err)
	m, ok := out.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, true, m["stream"], "client stream:true must reach upstream")
}

func TestRelayChatOverCodex_StreamPath_ToolCalls(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// upstream SSE: function_call item added, 2 args deltas, then completed
	upstreamSSE := strings.Join([]string{
		`event: response.output_item.added`,
		`data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"call_abc","name":"calc"}}`,
		``,
		`event: response.function_call_arguments.delta`,
		`data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\"a\":"}`,
		``,
		`event: response.function_call_arguments.delta`,
		`data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"1}"}`,
		``,
		`event: response.completed`,
		`data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","usage":{"input_tokens":3,"output_tokens":2}}}`,
		``,
	}, "\n")
	resp := &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(bytes.NewReader([]byte(upstreamSSE)))}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	_, apiErr := RelayChatOverCodex(c, &relaycommon.RelayInfo{UserWantsStream: true, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"}}, resp)
	require.Nil(t, apiErr)
	body := rec.Body.String()
	assert.Contains(t, body, `"tool_calls"`)
	assert.Contains(t, body, `"call_abc"`)
	assert.Contains(t, body, `"calc"`)
	// arguments arrive as fragments; concatenated must form the full JSON
	assert.Contains(t, body, "{\\\"a\\\":")
	assert.Contains(t, body, "1}")
	assert.Contains(t, body, `"finish_reason":"tool_calls"`)
}

func TestRelayChatOverCodex_StreamPath_ReasoningSummary(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstreamSSE := strings.Join([]string{
		`event: response.reasoning_summary_text.delta`,
		`data: {"type":"response.reasoning_summary_text.delta","output_index":0,"summary_index":0,"delta":"Thinking..."}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":1,"delta":"Answer"}`,
		``,
		`event: response.completed`,
		`data: {"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":3,"output_tokens":2}}}`,
		``,
	}, "\n")
	resp := &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(bytes.NewReader([]byte(upstreamSSE)))}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	_, apiErr := RelayChatOverCodex(c, &relaycommon.RelayInfo{UserWantsStream: true, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"}}, resp)
	require.Nil(t, apiErr)
	body := rec.Body.String()
	assert.Contains(t, body, `"reasoning_content"`)
	assert.Contains(t, body, "Thinking...")
	assert.Contains(t, body, "Answer")
}

func TestRelayChatOverCodex_Non200_PropagatesUpstreamError(t *testing.T) {
	resp := &http.Response{
		StatusCode: 429,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte(`{"error":{"message":"rate limit"}}`))),
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	usage, apiErr := RelayChatOverCodex(c, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}, resp)
	assert.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "429")
	assert.Contains(t, apiErr.Error(), "rate limit")
}

func TestRelayChatOverCodex_NoUsageEvent_ReturnsNonNilZeroUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// upstream stream with deltas but no response.completed/usage
	upstreamSSE := strings.Join([]string{
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":"hi"}`,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: 200, Header: make(http.Header),
		Body: io.NopCloser(bytes.NewReader([]byte(upstreamSSE))),
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	usage, apiErr := RelayChatOverCodex(c, &relaycommon.RelayInfo{UserWantsStream: true, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"}}, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage, "usage interface must be non-nil")
	dtoUsage, ok := usage.(*dto.Usage)
	require.True(t, ok)
	require.NotNil(t, dtoUsage, "*dto.Usage must be non-nil to avoid caller panic")
	assert.Equal(t, 0, dtoUsage.PromptTokens)
	assert.Equal(t, 0, dtoUsage.CompletionTokens)
}

func TestRelayChatOverCodex_UsageReturnedToBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	upstreamSSE := "event: response.completed\n" +
		`data: {"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":11,"output_tokens":7,"input_tokens_details":{"cached_tokens":3},"output_tokens_details":{"reasoning_tokens":2}}}}` +
		"\n\n"
	resp := &http.Response{
		StatusCode: 200,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte(upstreamSSE))),
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		UserWantsStream: false,
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
	}
	usage, apiErr := RelayChatOverCodex(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	dtoUsage, ok := usage.(*dto.Usage)
	require.True(t, ok, "usage should be *dto.Usage")
	assert.Equal(t, 11, dtoUsage.PromptTokens)
	assert.Equal(t, 7, dtoUsage.CompletionTokens)
	assert.Equal(t, 18, dtoUsage.TotalTokens)
	assert.Equal(t, 3, dtoUsage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 2, dtoUsage.CompletionTokenDetails.ReasoningTokens)
}
