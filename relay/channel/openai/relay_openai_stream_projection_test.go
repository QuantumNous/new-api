package openai

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newOpenAIProjectionTestContext(t *testing.T, body string, target types.RelayFormat) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()
	return newOpenAIProjectionTestContextWithBody(t, io.NopCloser(strings.NewReader(body)), target)
}

func newOpenAIProjectionTestContextWithBody(t *testing.T, body io.ReadCloser, target types.RelayFormat) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	mode := relayconstant.RelayModeChatCompletions
	path := "/v1/chat/completions"
	includeUsage := true
	switch target {
	case types.RelayFormatGemini:
		mode = relayconstant.RelayModeGemini
		path = "/v1beta/models/client:streamGenerateContent"
		includeUsage = false
	case types.RelayFormatClaude:
		mode = relayconstant.RelayModeUnknown
		path = "/v1/messages"
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	c.Set(common.RequestIdKey, "chat-projection-test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       body,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
		},
		IsStream:           true,
		RelayMode:          mode,
		RelayFormat:        target,
		ShouldIncludeUsage: includeUsage,
		DisablePing:        true,
		TextPlan: &relaycommon.TextPlan{
			Client: target,
			Native: types.RelayFormatOpenAI,
		},
	}
	info.SetEstimatePromptTokens(2)
	return c, recorder, resp, info
}

func withOpenAIProjectionTestSettings(t *testing.T) {
	t.Helper()
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
}

func TestOaiStreamHandlerKeepsNativeChatChunksSinglePass(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	body := strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"hello"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newOpenAIProjectionTestContext(t, body, types.RelayFormatOpenAI)
	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	assert.Equal(t, 1, strings.Count(got, `"content":"hello"`))
	assert.Equal(t, 1, strings.Count(got, `"finish_reason":"stop"`))
	assert.Equal(t, 1, strings.Count(got, `"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5`))
	assert.Equal(t, 1, strings.Count(got, "data: [DONE]"))
	assert.Equal(t, 3, info.SendResponseCount)
}

func TestIsLegacyCompletionsEndpointUsesForwardedPathNotRelayMode(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeGemini,
		RequestURLPath: "/v1/completions?api-version=test",
	}
	assert.True(t, IsLegacyCompletionsEndpoint(info))

	info.RelayMode = relayconstant.RelayModeCompletions
	info.RequestURLPath = "/v1/chat/completions"
	assert.False(t, IsLegacyCompletionsEndpoint(info))

	info.RequestURLPath = "/v1/completions"
	info.RelayMode = relayconstant.RelayModeChatCompletions
	info.TextPlan = &relaycommon.TextPlan{Client: types.RelayFormatOpenAI, Native: types.RelayFormatOpenAI}
	assert.False(t, IsLegacyCompletionsEndpoint(info))
}

func TestOaiStreamHandlerRejectsUnexpectedPlannedSourceFormat(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	c, recorder, resp, info := newOpenAIProjectionTestContext(t, "", types.RelayFormatGemini)
	info.TextPlan.Native = types.RelayFormatOpenAIResponses
	usage, apiErr := OaiStreamHandler(c, info, resp)
	assert.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "OpenAI Chat stream handler received unexpected source format")
	assert.Empty(t, recorder.Body.String())
}

func TestOaiStreamHandlerAcceptsRealGeminiMetadataAndProjectsText(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	body := strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"hello gemini"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newOpenAIProjectionTestContext(t, body, types.RelayFormatGemini)
	require.Equal(t, relayconstant.RelayModeGemini, info.RelayMode)
	require.Equal(t, types.RelayFormatOpenAI, info.TextPlan.Native)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Greater(t, usage.CompletionTokens, 0)

	got := recorder.Body.String()
	assert.NotContains(t, got, "cannot project OpenAI completions stream")
	assert.Equal(t, 1, strings.Count(got, "hello gemini"))
	responses := parseGeminiProjectionFrames(t, got)
	assert.Equal(t, []string{"STOP"}, geminiFinishReasons(responses))
}

func TestOaiStreamHandlerProjectsOneStableGeminiToolCall(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	for _, tt := range []struct {
		name        string
		finishChunk string
	}{
		{
			name:        "finish reason before usage",
			finishChunk: `data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		},
		{name: "EOF without finish reason"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			frames := []string{
				`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"eval_javascript","arguments":"{\"code\":"}}]},"finish_reason":null}]}`,
				`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"1+1\"}"}}]},"finish_reason":null}]}`,
			}
			if tt.finishChunk != "" {
				frames = append(frames, tt.finishChunk)
			}
			frames = append(frames,
				`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
				`data: [DONE]`,
				``,
			)

			c, recorder, resp, info := newOpenAIProjectionTestContext(t, strings.Join(frames, "\n"), types.RelayFormatGemini)
			usage, apiErr := OaiStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			assert.Equal(t, 2, usage.PromptTokens)
			assert.Equal(t, 3, usage.CompletionTokens)
			assert.Equal(t, 5, usage.TotalTokens)

			responses := parseGeminiProjectionFrames(t, recorder.Body.String())
			assert.Equal(t, []dto.FunctionCall{{FunctionName: "eval_javascript", Arguments: map[string]any{"code": "1+1"}}}, geminiFunctionCalls(responses))
			assert.Equal(t, []string{"STOP"}, geminiFinishReasons(responses))
			metadata := geminiUsageMetadata(responses)
			require.Len(t, metadata, 1)
			assert.Equal(t, 2, metadata[0].PromptTokenCount)
			assert.Equal(t, 3, metadata[0].CandidatesTokenCount)
			assert.Equal(t, 5, metadata[0].TotalTokenCount)
			assert.Equal(t, 1, strings.Count(recorder.Body.String(), `"functionCall"`))
		})
	}
}

func TestOaiStreamHandlerProcessesFinalArgumentsFinishAndUsageChunkOnce(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	body := strings.Join([]string{
		`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"eval_javascript","arguments":"{\"code\":"}}]},"finish_reason":null}]}`,
		`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"1+1\"}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newOpenAIProjectionTestContext(t, body, types.RelayFormatGemini)
	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 5, usage.TotalTokens)

	responses := parseGeminiProjectionFrames(t, recorder.Body.String())
	assert.Equal(t, []dto.FunctionCall{{FunctionName: "eval_javascript", Arguments: map[string]any{"code": "1+1"}}}, geminiFunctionCalls(responses))
	assert.Equal(t, []string{"STOP"}, geminiFinishReasons(responses))
	assert.Len(t, geminiUsageMetadata(responses), 1)
	assert.Equal(t, 1, strings.Count(recorder.Body.String(), `"functionCall"`))
}

func TestOaiStreamHandlerGeminiToolLifecycleScenarios(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	tests := []struct {
		name       string
		toolFrames []string
		wantCalls  []dto.FunctionCall
	}{
		{
			name: "empty snapshot does not replace complete arguments",
			toolFrames: []string{
				`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"eval_javascript","arguments":"{}"}}]},"finish_reason":null}]}`,
				`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"code\":\"1+1\"}"}}]},"finish_reason":null}]}`,
			},
			wantCalls: []dto.FunctionCall{{FunctionName: "eval_javascript", Arguments: map[string]any{"code": "1+1"}}},
		},
		{
			name: "parallel calls remain isolated and ordered",
			toolFrames: []string{
				`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_weather","type":"function","function":{"name":"weather","arguments":"{\"city\":"}}]},"finish_reason":null}]}`,
				`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"call_time","type":"function","function":{"name":"time","arguments":"{\"zone\":"}}]},"finish_reason":null}]}`,
				`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"Paris\"}"}}]},"finish_reason":null}]}`,
				`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"\"UTC\"}"}}]},"finish_reason":null}]}`,
			},
			wantCalls: []dto.FunctionCall{
				{FunctionName: "weather", Arguments: map[string]any{"city": "Paris"}},
				{FunctionName: "time", Arguments: map[string]any{"zone": "UTC"}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			frames := append([]string{}, tt.toolFrames...)
			frames = append(frames,
				`data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
				`data: [DONE]`,
				``,
			)
			c, recorder, resp, info := newOpenAIProjectionTestContext(t, strings.Join(frames, "\n"), types.RelayFormatGemini)
			_, apiErr := OaiStreamHandler(c, info, resp)
			require.Nil(t, apiErr)

			responses := parseGeminiProjectionFrames(t, recorder.Body.String())
			assert.Equal(t, tt.wantCalls, geminiFunctionCalls(responses))
			assert.Equal(t, []string{"STOP"}, geminiFinishReasons(responses))
			assert.Equal(t, len(tt.wantCalls), strings.Count(recorder.Body.String(), `"functionCall"`))
		})
	}
}

func TestOaiStreamHandlerUsesChatStatisticsForGeminiMetadata(t *testing.T) {
	withOpenAIProjectionTestSettings(t)
	operation_setting.SetToolPriceForTest("priced_tool", 1)
	t.Cleanup(func() { operation_setting.DeleteToolPriceForTest("priced_tool") })

	body := strings.Join([]string{
		`data: {"choices":[{"index":0,"delta":{"reasoning_content":"reasoning ","content":"answer "},"finish_reason":null}]}`,
		`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"priced_tool","arguments":"{\"q\":"}}]},"finish_reason":null}]}`,
		`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]},"finish_reason":null}]}`,
		`data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, _, resp, info := newOpenAIProjectionTestContext(t, body, types.RelayFormatGemini)
	info.OriginModelName = "gpt-test"
	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Greater(t, usage.CompletionTokens, 7)
	require.NotNil(t, info.ResponsesUsageInfo)
	require.Contains(t, info.BuiltInTools, "priced_tool")
	assert.Equal(t, 1, info.BuiltInTools["priced_tool"].CallCount)
}

func TestOaiStreamHandlerFinalizesClaudeToolLifecycleAtEOF(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	body := strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lookup","arguments":"{\"q\":"}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	c, recorder, resp, info := newOpenAIProjectionTestContext(t, body, types.RelayFormatClaude)
	require.Equal(t, relayconstant.RelayModeUnknown, info.RelayMode)
	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	assert.Equal(t, 1, strings.Count(got, "event: message_start\n"))
	assert.Equal(t, 1, strings.Count(got, "event: content_block_start\n"))
	assert.Equal(t, 2, strings.Count(got, "event: content_block_delta\n"))
	assert.Equal(t, 1, strings.Count(got, "event: content_block_stop\n"))
	assert.Equal(t, 1, strings.Count(got, "event: message_delta\n"))
	assert.Equal(t, 1, strings.Count(got, "event: message_stop\n"))
	assert.Equal(t, 1, strings.Count(got, `"type":"tool_use"`))
	assert.Contains(t, got, `"name":"lookup"`)
	assert.Contains(t, got, `"partial_json":"{\"q\":"`)
	assert.Contains(t, got, `"partial_json":"\"x\"}"`)
	assert.Contains(t, got, `"stop_reason":"tool_use"`)
	assert.True(t, info.Done)
}

func TestOaiStreamHandlerDoesNotFinalizeAfterScannerError(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	body := "data: {\"choices\":[{\"index\":0,\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"lookup\",\"arguments\":\"{\\\"q\\\":\\\"x\\\"}\"}}]},\"finish_reason\":null}]}\n"
	reader := &errorAfterReader{reader: strings.NewReader(body), err: errors.New("upstream read failed")}
	c, recorder, resp, info := newOpenAIProjectionTestContextWithBody(t, reader, types.RelayFormatGemini)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	assert.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "scanner_error")
	assert.NotContains(t, recorder.Body.String(), `"functionCall"`)
	assert.Empty(t, geminiFinishReasons(parseGeminiProjectionFrames(t, recorder.Body.String())))
}

func TestOaiCompletionsStreamHandlerKeepsLegacyDTOBoundary(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	body := strings.Join([]string{
		`data: {"id":"cmpl_1","object":"text_completion","created":1710000000,"model":"legacy-test","choices":[{"index":0,"text":"legacy text","finish_reason":null}]}`,
		`data: {"id":"cmpl_1","object":"text_completion","created":1710000000,"model":"legacy-test","choices":[{"index":0,"text":"","finish_reason":"stop"}]}`,
		`data: {"id":"cmpl_1","object":"text_completion","created":1710000000,"model":"legacy-test","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/completions", nil)
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{"Content-Type": []string{"text/event-stream"}}}
	info := &relaycommon.RelayInfo{
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "legacy-test"},
		IsStream:           true,
		RelayMode:          relayconstant.RelayModeCompletions,
		RelayFormat:        types.RelayFormatOpenAI,
		DisablePing:        true,
		ShouldIncludeUsage: true,
	}
	info.SetEstimatePromptTokens(2)

	usage, apiErr := OaiCompletionsStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 5, usage.TotalTokens)
	got := recorder.Body.String()
	assert.Equal(t, 1, strings.Count(got, "legacy text"))
	assert.NotContains(t, got, `"delta"`)
	assert.Equal(t, 3, strings.Count(got, `"object":"text_completion"`))
	assert.Equal(t, 1, strings.Count(got, "data: [DONE]"))
}

func TestOaiCompletionsStreamHandlerRejectsCrossFormatProjection(t *testing.T) {
	withOpenAIProjectionTestSettings(t)

	c, recorder, resp, info := newOpenAIProjectionTestContext(t, "", types.RelayFormatGemini)
	info.RelayMode = relayconstant.RelayModeCompletions
	usage, apiErr := OaiCompletionsStreamHandler(c, info, resp)
	assert.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "legacy OpenAI Completions stream cannot be projected")
	assert.Empty(t, recorder.Body.String())
}

type errorAfterReader struct {
	reader *strings.Reader
	err    error
}

func (r *errorAfterReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	if err == io.EOF {
		return n, r.err
	}
	return n, err
}

func (r *errorAfterReader) Close() error { return nil }

func parseGeminiProjectionFrames(t *testing.T, body string) []*dto.GeminiChatResponse {
	t.Helper()
	responses := make([]*dto.GeminiChatResponse, 0)
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") || line == "data: [DONE]" {
			continue
		}
		var response dto.GeminiChatResponse
		require.NoError(t, common.UnmarshalJsonStr(strings.TrimPrefix(line, "data: "), &response))
		responses = append(responses, &response)
	}
	return responses
}

func geminiFunctionCalls(responses []*dto.GeminiChatResponse) []dto.FunctionCall {
	var calls []dto.FunctionCall
	for _, response := range responses {
		for _, candidate := range response.Candidates {
			for _, part := range candidate.Content.Parts {
				if part.FunctionCall != nil {
					calls = append(calls, *part.FunctionCall)
				}
			}
		}
	}
	return calls
}

func geminiFinishReasons(responses []*dto.GeminiChatResponse) []string {
	var reasons []string
	for _, response := range responses {
		for _, candidate := range response.Candidates {
			if candidate.FinishReason != nil {
				reasons = append(reasons, *candidate.FinishReason)
			}
		}
	}
	return reasons
}

func geminiUsageMetadata(responses []*dto.GeminiChatResponse) []dto.GeminiUsageMetadata {
	var metadata []dto.GeminiUsageMetadata
	for _, response := range responses {
		if response.HasUsageMetadata {
			metadata = append(metadata, response.UsageMetadata)
		}
	}
	return metadata
}
