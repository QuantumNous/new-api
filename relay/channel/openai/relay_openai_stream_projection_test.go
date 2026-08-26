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
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newOpenAIProjectionTestContext(t *testing.T, body string, target types.RelayFormat) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/client:streamGenerateContent", nil)
	c.Set(common.RequestIdKey, "chat-projection-test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
		},
		IsStream:           true,
		RelayMode:          relayconstant.RelayModeChatCompletions,
		RelayFormat:        target,
		ShouldIncludeUsage: true,
		DisablePing:        true,
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
			var calls []dto.FunctionCall
			var finishReasons []string
			var usageMetadata []dto.GeminiUsageMetadata
			for _, response := range responses {
				for _, candidate := range response.Candidates {
					if candidate.FinishReason != nil {
						finishReasons = append(finishReasons, *candidate.FinishReason)
					}
					for _, part := range candidate.Content.Parts {
						if part.FunctionCall != nil {
							calls = append(calls, *part.FunctionCall)
						}
					}
				}
				if response.HasUsageMetadata {
					usageMetadata = append(usageMetadata, response.UsageMetadata)
				}
			}

			require.Len(t, calls, 1)
			assert.Equal(t, "eval_javascript", calls[0].FunctionName)
			assert.Equal(t, map[string]any{"code": "1+1"}, calls[0].Arguments)
			assert.Equal(t, []string{"STOP"}, finishReasons)
			require.Len(t, usageMetadata, 1)
			assert.Equal(t, 2, usageMetadata[0].PromptTokenCount)
			assert.Equal(t, 3, usageMetadata[0].CandidatesTokenCount)
			assert.Equal(t, 5, usageMetadata[0].TotalTokenCount)
			assert.Equal(t, 1, strings.Count(recorder.Body.String(), `"functionCall"`))
		})
	}
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
