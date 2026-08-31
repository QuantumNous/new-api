package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newResponsesChatTestContext(t *testing.T, body string, isStream bool) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "responses-test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		IsStream:           isStream,
		RelayFormat:        types.RelayFormatOpenAI,
		ShouldIncludeUsage: true,
		DisablePing:        true,
	}
	return c, recorder, resp, info
}

func responsesChatSSE(events ...string) string {
	lines := make([]string, 0, len(events)+2)
	for _, event := range events {
		lines = append(lines, "data: "+event)
	}
	lines = append(lines, "data: [DONE]", "")
	return strings.Join(lines, "\n")
}

func TestOaiResponsesToChatStreamFallbackUsageMatchesResponseText2Usage(t *testing.T) {
	body := responsesChatSSE(
		`{"type":"response.created","response":{"id":"resp_test","created_at":1710000000,"model":"gpt-test"}}`,
		`{"type":"response.reasoning_summary_text.delta","delta":"Reasoning summary 123"}`,
		`{"type":"response.reasoning_summary_text.done"}`,
		`{"type":"response.reasoning_summary_text.delta","delta":"second paragraph"}`,
		`{"type":"response.output_text.delta","delta":" Visible output 中文"}`,
		`{"type":"response.completed","response":{"usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}`,
	)

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
	info.SetEstimatePromptTokens(37)
	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)

	expectedContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	expected := service.ResponseText2Usage(expectedContext, "Reasoning summary 123\n\nsecond paragraph Visible output 中文", info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected, usage)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), `"usage":{"prompt_tokens":37`)
}

func TestOaiResponsesToChatStreamFallbackUsageCountsToolCalls(t *testing.T) {
	body := responsesChatSSE(
		`{"type":"response.created","response":{"id":"resp_test","created_at":1710000000,"model":"gpt-test"}}`,
		`{"type":"response.output_item.added","output_index":0,"item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"lookup"}}`,
		`{"type":"response.function_call_arguments.delta","output_index":0,"item_id":"fc_1","delta":"{\"city\":\"Beijing\"}"}`,
		`{"type":"response.completed","response":{"usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}`,
	)

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
	info.SetEstimatePromptTokens(37)
	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)

	expectedContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	expected := service.ResponseText2Usage(expectedContext, `lookup{"city":"Beijing"}`, info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected, usage)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), `"finish_reason":"tool_calls"`)
}

func TestOaiResponsesToChatStreamUsesUpstreamUsageWithoutLocalCountFlag(t *testing.T) {
	body := responsesChatSSE(
		`{"type":"response.created","response":{"id":"resp_test","created_at":1710000000,"model":"gpt-test"}}`,
		`{"type":"response.output_text.delta","delta":"Visible output that must not be locally counted"}`,
		`{"type":"response.completed","response":{"usage":{"input_tokens":11,"output_tokens":13,"total_tokens":24,"input_tokens_details":{"cached_tokens":7},"completion_tokens_details":{"reasoning_tokens":5}}}}`,
	)

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 13, usage.CompletionTokens)
	assert.Equal(t, 24, usage.TotalTokens)
	assert.Equal(t, 11, usage.InputTokens)
	assert.Equal(t, 13, usage.OutputTokens)
	assert.Equal(t, 7, usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 5, usage.CompletionTokenDetails.ReasoningTokens)
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), `"usage":{"prompt_tokens":11`)
}

func TestOaiResponsesToChatStreamCompletesUpstreamUsageTotalWithoutLocalCountFlag(t *testing.T) {
	body := responsesChatSSE(
		`{"type":"response.created","response":{"id":"resp_test","created_at":1710000000,"model":"gpt-test"}}`,
		`{"type":"response.output_text.delta","delta":"Visible output with upstream input and output tokens"}`,
		`{"type":"response.completed","response":{"usage":{"input_tokens":11,"output_tokens":13,"total_tokens":0}}}`,
	)

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 13, usage.CompletionTokens)
	assert.Equal(t, 24, usage.TotalTokens)
	assert.Equal(t, 11, usage.InputTokens)
	assert.Equal(t, 13, usage.OutputTokens)
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), `"usage":{"prompt_tokens":11`)
}

func TestOaiResponsesToChatStreamHandlerConvertsSSEOrderAndUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_1","model":"gpt-test","created_at":1710000000}}`,
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		`data: {"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","id":"fc_1","call_id":"call_1","name":"lookup"}}`,
		`data: {"type":"response.function_call_arguments.delta","output_index":1,"delta":"{\"q\":\"x\"}"}`,
		`data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 3, usage.CompletionTokens)
	require.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	require.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	require.Contains(t, got, `"role":"assistant"`)
	require.Contains(t, got, `"content":"hello"`)
	require.Contains(t, got, `"name":"lookup"`)
	require.Contains(t, got, `"arguments":"{\"q\":\"x\"}"`)
	require.Contains(t, got, `"finish_reason":"tool_calls"`)
	require.Contains(t, got, `"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5`)
	require.Contains(t, got, `data: [DONE]`)
	requireOrderedSubstrings(t, got,
		`"role":"assistant"`,
		`"content":"hello"`,
		`"name":"lookup"`,
		`"arguments":"{\"q\":\"x\"}"`,
		`"finish_reason":"tool_calls"`,
		`"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5`,
		`data: [DONE]`,
	)
}

func TestOaiResponsesToChatStreamHandlerConvertsClaudeSSETerminalsAndUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_1","model":"gpt-test","created_at":1710000000}}`,
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		`data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
	info.RelayFormat = types.RelayFormatClaude

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	assert.Equal(t, 2, usage.PromptTokens)
	assert.Equal(t, 3, usage.CompletionTokens)
	assert.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	assert.Equal(t, 1, strings.Count(got, "event: message_start\n"))
	assert.Equal(t, 1, strings.Count(got, "event: content_block_stop\n"))
	assert.Equal(t, 1, strings.Count(got, "event: message_delta\n"))
	assert.Equal(t, 1, strings.Count(got, "event: message_stop\n"))

	messageDeltaFrame := ""
	for _, frame := range strings.Split(got, "\n\n") {
		if strings.HasPrefix(frame, "event: message_delta\n") {
			messageDeltaFrame = frame
			break
		}
	}
	require.NotEmpty(t, messageDeltaFrame)
	assert.Contains(t, messageDeltaFrame, `"type":"message_delta"`)
	assert.Contains(t, messageDeltaFrame, `"stop_reason":"end_turn"`)
	assert.Contains(t, messageDeltaFrame, `"input_tokens":2`)
	assert.Contains(t, messageDeltaFrame, `"output_tokens":3`)
	requireOrderedSubstrings(t, got,
		"event: message_start\n",
		"event: content_block_stop\n",
		"event: message_delta\n",
		"event: message_stop\n",
	)
}

func TestOaiResponsesToChatBufferedStreamHandlerReturnsJSONFromSSE(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"buffered text"}`,
		`data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","id":"fc_1","call_id":"call_1","name":"lookup"}}`,
		`data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\"q\":\"x\"}"}`,
		`data: {"type":"response.done","response":{"model":"gpt-test","status":"completed","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newResponsesChatTestContext(t, body, false)

	usage, err := OaiResponsesToChatBufferedStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 3, usage.TotalTokens)

	got := recorder.Body.String()
	require.NotContains(t, got, `data:`)
	require.Contains(t, got, `"object":"chat.completion"`)
	require.Contains(t, got, `"content":"buffered text"`)
	require.Contains(t, got, `"name":"lookup"`)
	require.Contains(t, got, `"arguments":"{\"q\":\"x\"}"`)
	require.Contains(t, got, `"finish_reason":"tool_calls"`)
}

func TestOaiChatToResponsesStreamHandlerConvertsSSEOrderAndUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lookup"}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":\"x\"}"}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newResponsesChatTestContext(t, body, true)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	usage, err := OaiChatToResponsesStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 3, usage.CompletionTokens)
	require.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	require.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	require.Contains(t, got, `event: response.created`)
	require.Contains(t, got, `event: response.output_text.delta`)
	require.Contains(t, got, `"delta":"hello"`)
	require.Contains(t, got, `event: response.function_call_arguments.delta`)
	require.Contains(t, got, `"delta":"{\"q\":\"x\"}"`)
	require.Contains(t, got, `event: response.completed`)
	require.Contains(t, got, `"input_tokens":2`)
	require.Contains(t, got, `"output_tokens":3`)
	requireOrderedSubstrings(t, got,
		`event: response.created`,
		`event: response.output_item.added`,
		`event: response.output_text.delta`,
		`event: response.output_item.added`,
		`event: response.function_call_arguments.delta`,
		`event: response.output_text.done`,
		`event: response.function_call_arguments.done`,
		`event: response.completed`,
	)
}

func requireOrderedSubstrings(t *testing.T, s string, parts ...string) {
	t.Helper()

	offset := 0
	for _, part := range parts {
		idx := strings.Index(s[offset:], part)
		require.NotEqualf(t, -1, idx, "missing %q after byte offset %d", part, offset)
		offset += idx + len(part)
	}
}
