package openai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
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
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
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
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
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
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
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
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
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
