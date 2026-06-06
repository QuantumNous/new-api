package openai

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOaiResponsesStreamHandlerRejectsChatCompletionChunk(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := newResponsesRelayInfo()
	resp := newChatCompletionSSE(http.StatusOK, `data: {"id":"chatcmpl-bad","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"pong"},"finish_reason":null}]}

data: [DONE]
`)

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, http.StatusBadGateway, newAPIError.StatusCode)
	require.Equal(t, types.ErrorCodeBadResponse, newAPIError.GetErrorCode())
	require.Contains(t, newAPIError.Error(), "chat completions chunk")
	require.False(t, c.Writer.Written())
	require.Empty(t, recorder.Body.String())
}

func TestOaiResponsesStreamHandlerRejectsEmptyEventChunk(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := newResponsesRelayInfo()
	resp := newChatCompletionSSE(http.StatusOK, `data: {"id":"resp-bad","response":{"usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}}

data: [DONE]
`)

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, http.StatusBadGateway, newAPIError.StatusCode)
	require.Equal(t, types.ErrorCodeBadResponse, newAPIError.GetErrorCode())
	require.Contains(t, newAPIError.Error(), "missing response event type")
	require.False(t, c.Writer.Written())
	require.Empty(t, recorder.Body.String())
}

func TestOaiResponsesStreamHandlerStopsButSkipsRetryAfterWritten(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := newResponsesRelayInfo()
	resp := newChatCompletionSSE(http.StatusOK, `data: {"type":"response.output_text.delta","delta":"pong"}

data: {"id":"chatcmpl-bad","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"bad"},"finish_reason":null}]}

data: [DONE]
`)

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	require.Equal(t, http.StatusBadGateway, newAPIError.StatusCode)
	require.Equal(t, types.ErrorCodeBadResponse, newAPIError.GetErrorCode())
	require.True(t, types.IsSkipRetryError(newAPIError))
	require.True(t, c.Writer.Written())
	require.Contains(t, recorder.Body.String(), "event: response.output_text.delta")
}

func TestOaiResponsesStreamHandlerForwardsValidResponsesEvents(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := newResponsesRelayInfo()
	resp := newChatCompletionSSE(http.StatusOK, `data: {"type":"response.output_text.delta","delta":"pong"}

data: {"type":"response.completed","response":{"id":"resp-test","object":"response","created_at":123,"model":"gpt-test","output":[],"usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}}

data: [DONE]
`)

	usage, newAPIError := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	require.Equal(t, &dto.Usage{PromptTokens: 2, CompletionTokens: 1, TotalTokens: 3}, usage)
	require.True(t, c.Writer.Written())

	body := recorder.Body.String()
	require.Contains(t, body, "event: response.output_text.delta")
	require.Contains(t, body, "event: response.completed")
	require.Contains(t, body, `"type":"response.completed"`)
}

func newResponsesRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponses,
		RelayFormat:     types.RelayFormatOpenAIResponses,
		OriginModelName: "gpt-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
			ChannelType:       constant.ChannelTypeOpenAI,
		},
	}
}
