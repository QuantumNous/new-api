package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupValidationTest(t *testing.T) {
	t.Helper()

	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	oldEnabled := operation_setting.EmptyResponseRetryEnabled
	oldKeywords := operation_setting.ResponseBlacklistKeywords
	t.Cleanup(func() {
		operation_setting.EmptyResponseRetryEnabled = oldEnabled
		operation_setting.ResponseBlacklistKeywords = oldKeywords
	})
	operation_setting.EmptyResponseRetryEnabled = false
	operation_setting.ResponseBlacklistKeywords = nil
}

func newValidationTextContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"},
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
	}
	return c, recorder, resp, info
}

func TestOpenaiHandlerEmptyResponseValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	tests := []struct {
		name        string
		body        string
		wantErrCode types.ErrorCode
	}{
		{
			name:        "empty content without tool calls",
			body:        `{"id":"1","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":0,"total_tokens":1}}`,
			wantErrCode: types.ErrorCodeEmptyResponse,
		},
		{
			name:        "whitespace content without tool calls",
			body:        `{"id":"1","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":"  \n"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":0,"total_tokens":1}}`,
			wantErrCode: types.ErrorCodeEmptyResponse,
		},
		{
			name:        "reasoning only counts as empty",
			body:        `{"id":"1","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":"","reasoning_content":"thinking hard"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`,
			wantErrCode: types.ErrorCodeEmptyResponse,
		},
		{
			name:        "no choices",
			body:        `{"id":"1","model":"gpt-4o","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":0,"total_tokens":1}}`,
			wantErrCode: types.ErrorCodeEmptyResponse,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, recorder, resp, info := newValidationTextContext(t, tt.body)

			usage, apiErr := OpenaiHandler(c, info, resp)

			require.NotNil(t, apiErr)
			assert.Equal(t, tt.wantErrCode, apiErr.GetErrorCode())
			assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			assert.Nil(t, usage)
			assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
		})
	}
}

func TestOpenaiHandlerValidOutputPassesValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	tests := []struct {
		name string
		body string
	}{
		{
			name: "normal content",
			body: `{"id":"1","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":"hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`,
		},
		{
			name: "tool calls without content",
			body: `{"id":"1","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":null,"tool_calls":[{"id":"c1","type":"function","function":{"name":"get_weather","arguments":"{}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`,
		},
		{
			name: "audio output without text",
			body: `{"id":"1","model":"gpt-4o-audio-preview","choices":[{"index":0,"message":{"role":"assistant","content":null,"audio":{"id":"audio-1","data":"aWZz","expires_at":1800000000,"transcript":"hello"}},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, recorder, resp, info := newValidationTextContext(t, tt.body)

			usage, apiErr := OpenaiHandler(c, info, resp)

			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			assert.Equal(t, tt.body, recorder.Body.String())
		})
	}
}

func TestOpenaiHandlerValidationDisabledKeepsLegacyBehavior(t *testing.T) {
	setupValidationTest(t)

	body := `{"id":"1","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":0,"total_tokens":1}}`
	c, recorder, resp, info := newValidationTextContext(t, body)

	usage, apiErr := OpenaiHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, body, recorder.Body.String())
}

func TestOpenaiHandlerBlacklistedContent(t *testing.T) {
	setupValidationTest(t)
	operation_setting.ResponseBlacklistKeywordsFromString("Internal Server Error")

	body := `{"id":"1","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":"Internal Server Error: please try again later"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":5,"total_tokens":6}}`
	c, recorder, resp, info := newValidationTextContext(t, body)

	usage, apiErr := OpenaiHandler(c, info, resp)

	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeBlacklistedResponse, apiErr.GetErrorCode())
	assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	assert.Nil(t, usage)
	assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
}

func newValidationStreamContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"},
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		IsStream:    true,
	}
	return c, recorder, resp, info
}

func TestOaiStreamHandlerEmptyResponseValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	tests := []struct {
		name string
		body string
	}{
		{
			name: "no data chunks at all",
			body: "",
		},
		{
			name: "non-SSE error body on 200 yields no chunks",
			body: `{"error": "upstream exploded"}`,
		},
		{
			name: "single role-only chunk is never forwarded",
			body: "data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\ndata: [DONE]\n\n",
		},
		{
			name: "single reasoning-only chunk is never forwarded",
			body: "data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"reasoning_content\":\"thinking\"}}]}\n\ndata: [DONE]\n\n",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, recorder, resp, info := newValidationStreamContext(t, tt.body)

			usage, apiErr := OaiStreamHandler(c, info, resp)

			require.NotNil(t, apiErr)
			assert.Equal(t, types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
			assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			assert.Nil(t, usage)
			assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
		})
	}
}

func TestOaiStreamHandlerBlacklistedSingleChunk(t *testing.T) {
	setupValidationTest(t)
	operation_setting.ResponseBlacklistKeywordsFromString("upstream exploded")

	body := "data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"upstream exploded, sorry\"}}]}\n\ndata: [DONE]\n\n"
	c, recorder, resp, info := newValidationStreamContext(t, body)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeBlacklistedResponse, apiErr.GetErrorCode())
	assert.Nil(t, usage)
	assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
}

func TestOaiStreamHandlerNormalContentPassesValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true
	operation_setting.ResponseBlacklistKeywordsFromString("upstream exploded")

	body := "data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\n" +
		"data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello\"}}]}\n\n" +
		"data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n" +
		"data: [DONE]\n\n"
	c, recorder, resp, info := newValidationStreamContext(t, body)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Contains(t, recorder.Body.String(), "hello")
	assert.Contains(t, recorder.Body.String(), "data: [DONE]")
}

func TestOaiStreamHandlerSkipsRetryAfterDataSent(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	// Two reasoning-only chunks: the first chunk is forwarded before the empty
	// output is detected, so the stream must complete without a retry.
	body := "data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"reasoning_content\":\"thinking 1\"}}]}\n\n" +
		"data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"reasoning_content\":\" thinking 2\"}}]}\n\n" +
		"data: [DONE]\n\n"
	c, recorder, resp, info := newValidationStreamContext(t, body)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr, "no retry is possible once stream data reached the client")
	require.NotNil(t, usage)
	assert.Contains(t, recorder.Body.String(), "thinking 1")
	assert.Contains(t, recorder.Body.String(), "data: [DONE]")
}

func TestStreamHandlersSkipRetryAfterPingSent(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	t.Run("openai chat stream", func(t *testing.T) {
		body := "data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\ndata: [DONE]\n\n"
		c, recorder, resp, info := newValidationStreamContext(t, body)

		helper.SetEventStreamHeaders(c)
		require.NoError(t, helper.PingData(c))

		usage, apiErr := OaiStreamHandler(c, info, resp)

		require.Nil(t, apiErr, "a committed ping must prevent another retry attempt")
		require.NotNil(t, usage)
		assert.False(t, helper.StreamResponseRetryAvailable(c))
		assert.Contains(t, recorder.Body.String(), ": PING")
		assert.Contains(t, recorder.Body.String(), "data: [DONE]")
		assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	})

	t.Run("responses stream", func(t *testing.T) {
		c, recorder, resp, info := newValidationResponsesContext(t, "", true)

		helper.SetEventStreamHeaders(c)
		require.NoError(t, helper.PingData(c))

		usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

		require.Nil(t, apiErr, "a committed ping must prevent another retry attempt")
		require.NotNil(t, usage)
		assert.False(t, helper.StreamResponseRetryAvailable(c))
		assert.Contains(t, recorder.Body.String(), ": PING")
		assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	})

	t.Run("chat upstream to responses stream", func(t *testing.T) {
		body := "data: {\"id\":\"1\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\ndata: [DONE]\n\n"
		c, recorder, resp, info := newValidationResponsesContext(t, body, true)

		helper.SetEventStreamHeaders(c)
		require.NoError(t, helper.PingData(c))

		usage, apiErr := OaiChatToResponsesStreamHandler(c, info, resp)

		require.Nil(t, apiErr, "a committed ping must prevent another retry attempt")
		require.NotNil(t, usage)
		assert.False(t, helper.StreamResponseRetryAvailable(c))
		assert.Contains(t, recorder.Body.String(), ": PING")
		assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	})

	t.Run("responses upstream to chat stream", func(t *testing.T) {
		body := "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"type\":\"reasoning\",\"id\":\"rs1\"}],\"usage\":{\"input_tokens\":1,\"output_tokens\":1,\"total_tokens\":2}}}\n\ndata: [DONE]\n\n"
		c, recorder, resp, info := newValidationResponsesContext(t, body, true)

		helper.SetEventStreamHeaders(c)
		require.NoError(t, helper.PingData(c))

		usage, apiErr := OaiResponsesToChatStreamHandler(c, info, resp)

		require.Nil(t, apiErr, "a committed ping must prevent another retry attempt")
		require.NotNil(t, usage)
		assert.False(t, helper.StreamResponseRetryAvailable(c))
		assert.Contains(t, recorder.Body.String(), ": PING")
		assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	})
}

func TestOaiStreamHandlerValidationDisabledKeepsLegacyBehavior(t *testing.T) {
	setupValidationTest(t)

	c, recorder, resp, info := newValidationStreamContext(t, "")

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Contains(t, recorder.Body.String(), "data: [DONE]")
}

func newValidationResponsesContext(t *testing.T, body string, stream bool) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	contentType := "application/json"
	if stream {
		contentType = "text/event-stream"
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{contentType}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAI,
		IsStream:    stream,
	}
	return c, recorder, resp, info
}

func TestOaiResponsesHandlerValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true
	operation_setting.ResponseBlacklistKeywordsFromString("upstream exploded")

	tests := []struct {
		name        string
		body        string
		wantErrCode types.ErrorCode // empty means no error expected
	}{
		{
			name:        "empty output list",
			body:        `{"id":"r1","model":"gpt-5","status":"completed","output":[]}`,
			wantErrCode: types.ErrorCodeEmptyResponse,
		},
		{
			name:        "reasoning only output",
			body:        `{"id":"r1","model":"gpt-5","status":"completed","output":[{"type":"reasoning","id":"rs1"}]}`,
			wantErrCode: types.ErrorCodeEmptyResponse,
		},
		{
			name:        "message with blacklisted text",
			body:        `{"id":"r1","model":"gpt-5","status":"completed","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"upstream exploded"}]}]}`,
			wantErrCode: types.ErrorCodeBlacklistedResponse,
		},
		{
			name: "message with normal text",
			body: `{"id":"r1","model":"gpt-5","status":"completed","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hello world"}]}]}`,
		},
		{
			name: "function call without text",
			body: `{"id":"r1","model":"gpt-5","status":"completed","output":[{"type":"function_call","call_id":"c1","name":"get_weather","arguments":"{}"}]}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, recorder, resp, info := newValidationResponsesContext(t, tt.body, false)

			usage, apiErr := OaiResponsesHandler(c, info, resp)

			if tt.wantErrCode == "" {
				require.Nil(t, apiErr)
				require.NotNil(t, usage)
				assert.Equal(t, tt.body, recorder.Body.String())
				return
			}
			require.NotNil(t, apiErr)
			assert.Equal(t, tt.wantErrCode, apiErr.GetErrorCode())
			assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			assert.Nil(t, usage)
			assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
		})
	}
}

func TestOaiResponsesStreamHandlerEmptyValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	c, recorder, resp, info := newValidationResponsesContext(t, "", true)

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
	assert.Nil(t, usage)
	assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
}

func TestOaiResponsesStreamHandlerTextDeltaPassesValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	body := "data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}\n\n" +
		"data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"usage\":{\"input_tokens\":1,\"output_tokens\":1,\"total_tokens\":2}}}\n\n" +
		"data: [DONE]\n\n"
	c, recorder, resp, info := newValidationResponsesContext(t, body, true)

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Contains(t, recorder.Body.String(), "hello")
}

func TestOaiResponsesToChatHandlerValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	body := `{"id":"r1","model":"gpt-5","status":"completed","output":[]}`
	c, recorder, resp, info := newValidationResponsesContext(t, body, false)

	usage, apiErr := OaiResponsesToChatHandler(c, info, resp)

	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
	assert.Nil(t, usage)
	assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
}

func TestOaiResponsesToChatBufferedStreamHandlerValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	t.Run("empty upstream stream retries", func(t *testing.T) {
		c, recorder, resp, info := newValidationResponsesContext(t, "", true)

		usage, apiErr := OaiResponsesToChatBufferedStreamHandler(c, info, resp)

		require.NotNil(t, apiErr)
		assert.Equal(t, types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
		assert.Nil(t, usage)
		assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
	})

	t.Run("reasoning-only upstream stream retries", func(t *testing.T) {
		body := "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"type\":\"reasoning\",\"id\":\"rs1\"}]}}\n\ndata: [DONE]\n\n"
		c, recorder, resp, info := newValidationResponsesContext(t, body, true)

		usage, apiErr := OaiResponsesToChatBufferedStreamHandler(c, info, resp)

		require.NotNil(t, apiErr)
		assert.Equal(t, types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
		assert.Nil(t, usage)
		assert.Empty(t, recorder.Body.String())
	})

	t.Run("valid output passes", func(t *testing.T) {
		body := "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"hello world\"}]}],\"usage\":{\"input_tokens\":1,\"output_tokens\":2,\"total_tokens\":3}}}\n\ndata: [DONE]\n\n"
		c, recorder, resp, info := newValidationResponsesContext(t, body, true)

		usage, apiErr := OaiResponsesToChatBufferedStreamHandler(c, info, resp)

		require.Nil(t, apiErr)
		require.NotNil(t, usage)
		assert.Contains(t, recorder.Body.String(), "hello world")
	})
}

func TestOaiChatToResponsesHandlerValidation(t *testing.T) {
	setupValidationTest(t)
	operation_setting.EmptyResponseRetryEnabled = true

	body := `{"id":"1","model":"gpt-4o","choices":[{"index":0,"message":{"role":"assistant","content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":0,"total_tokens":1}}`
	c, recorder, resp, info := newValidationResponsesContext(t, body, false)

	usage, apiErr := OaiChatToResponsesHandler(c, info, resp)

	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
	assert.Nil(t, usage)
	assert.Empty(t, recorder.Body.String(), "nothing must be written to the client before retry")
}
