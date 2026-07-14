package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestOpenaiHandlerTurnsSuccessfulErrorPayloadIntoRetryableStatus verifies an
// error envelope carried by HTTP 200 is normalized to a gateway failure.
func TestOpenaiHandlerTurnsSuccessfulErrorPayloadIntoRetryableStatus(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"error":{"message":"upstream busy","type":"overloaded_error","code":"overloaded"}}`)),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		RelayFormat: types.RelayFormatOpenAI,
	}

	usage, apiErr := OpenaiHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	require.Equal(t, types.ErrorCode("overloaded"), apiErr.GetErrorCode())
}

// TestUpstreamErrorStatusCodePreservesFailureStatus verifies genuine upstream
// failure statuses survive normalization unchanged.
func TestUpstreamErrorStatusCodePreservesFailureStatus(t *testing.T) {
	require.Equal(t, http.StatusServiceUnavailable, upstreamErrorStatusCode(http.StatusServiceUnavailable))
}

// TestResponsesStreamErrorRecognizesTopLevelErrorEvent protects the flat error
// event variant used by the Responses streaming API.
func TestResponsesStreamErrorRecognizesTopLevelErrorEvent(t *testing.T) {
	apiErr := responsesStreamError(&dto.ResponsesStreamResponse{
		Type:    "error",
		Code:    "server_error",
		Message: "upstream busy",
		Param:   "model",
	})

	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	require.Equal(t, types.ErrorCode("server_error"), apiErr.GetErrorCode())
}

// TestOpenaiHandlerRecognizesErrorWithoutType verifies a missing optional type
// does not hide an otherwise valid upstream error envelope.
func TestOpenaiHandlerRecognizesErrorWithoutType(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"error":{"message":"upstream busy","code":"server_error"}}`)),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		RelayFormat: types.RelayFormatOpenAI,
	}

	usage, apiErr := OpenaiHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	require.Equal(t, types.ErrorCode("server_error"), apiErr.GetErrorCode())
}

// TestOaiStreamHandlerRejectsFailuresBeforeWritingResponse keeps first-event
// failures retryable and leaves the downstream body untouched.
func TestOaiStreamHandlerRejectsFailuresBeforeWritingResponse(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	tests := []struct {
		name string
		body string
	}{
		{name: "empty stream", body: ""},
		{name: "malformed first event", body: "data: not-json\n\ndata: [DONE]\n\n"},
		{name: "premature eof", body: `data: {"id":"chatcmpl-1","choices":[{"index":0,"delta":{"content":"partial"}}]}` + "\n\n"},
		{name: "error payload", body: `data: {"error":{"message":"busy","type":"overloaded_error","code":"overloaded"}}` + "\n\ndata: [DONE]\n\n"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			resp := &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
				Body:       io.NopCloser(strings.NewReader(tt.body)),
			}
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
				RelayFormat: types.RelayFormatOpenAI,
				RelayMode:   relayconstant.RelayModeChatCompletions,
				IsStream:    true,
				DisablePing: true,
			}

			usage, apiErr := OaiStreamHandler(c, info, resp)

			require.Nil(t, usage)
			require.NotNil(t, apiErr)
			require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			require.Empty(t, recorder.Body.String())
		})
	}
}

// TestOaiResponsesStreamHandlerRejectsErrorEventBeforeWritingResponse keeps a
// first Responses error event retryable without emitting partial protocol data.
func TestOaiResponsesStreamHandlerRejectsErrorEventBeforeWritingResponse(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	body := `data: {"type":"response.failed","response":{"error":{"message":"busy","type":"overloaded_error","code":"overloaded"}}}` + "\n\ndata: [DONE]\n\n"
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		RelayFormat: types.RelayFormatOpenAIResponses,
		IsStream:    true,
		DisablePing: true,
	}

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	require.Empty(t, recorder.Body.String())
}

// TestOaiStreamHandlerDoesNotReturnRetryableErrorAfterWritingResponse prevents
// failover from duplicating Chat Completions output after a mid-stream error.
func TestOaiStreamHandlerDoesNotReturnRetryableErrorAfterWritingResponse(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-1","choices":[{"index":0,"delta":{"role":"assistant"}}]}`,
		`data: {"id":"chatcmpl-1","choices":[{"index":0,"delta":{"content":"partial"}}]}`,
		`data: {"error":{"message":"busy","type":"overloaded_error","code":"overloaded"}}`,
		`data: [DONE]`,
		``,
	}, "\n\n")
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		RelayFormat: types.RelayFormatOpenAI,
		RelayMode:   relayconstant.RelayModeChatCompletions,
		IsStream:    true,
		DisablePing: true,
	}

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.NotEmpty(t, recorder.Body.String())
	require.Contains(t, recorder.Body.String(), `"error"`)
	require.NotContains(t, recorder.Body.String(), "data: [DONE]")
}

// TestOaiResponsesStreamHandlerForwardsMidStreamError verifies a Responses
// error after text is forwarded and the delivered text remains billable.
func TestOaiResponsesStreamHandlerForwardsMidStreamError(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp-1"}}`,
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		`data: {"type":"error","code":"server_error","message":"upstream busy"}`,
		`data: [DONE]`,
		``,
	}, "\n\n")
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		RelayFormat: types.RelayFormatOpenAIResponses,
		IsStream:    true,
		DisablePing: true,
	}
	info.ChannelMeta.UpstreamModelName = "custom-test"
	info.SetEstimatePromptTokens(7)

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 7, usage.PromptTokens)
	assert.Greater(t, usage.CompletionTokens, 0)
	assert.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
	require.Contains(t, recorder.Body.String(), `"type":"error"`)
	require.Contains(t, recorder.Body.String(), `"message":"upstream busy"`)
	require.NotContains(t, recorder.Body.String(), `"type":"response.completed"`)
}
