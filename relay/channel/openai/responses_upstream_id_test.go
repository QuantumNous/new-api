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
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newResponsesIDTestContext() (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "req_local")
	return c, recorder
}

func newResponsesIDTestInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
	}
}

func newResponsesIDTestHTTPResponse(body string, contentType string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func setResponsesStreamTestTimeout(t *testing.T) {
	t.Helper()
	previous := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = previous
	})
}

func TestOaiResponsesHandlerCapturesUpstreamResponseId(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, recorder := newResponsesIDTestContext()
	body := `{"id":"resp_native_non_stream","object":"response","model":"gpt-5","output":[],"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`

	usage, apiErr := OaiResponsesHandler(c, newResponsesIDTestInfo(), newResponsesIDTestHTTPResponse(body, "application/json"))

	require.Nil(t, apiErr)
	require.Equal(t, "resp_native_non_stream", c.GetString(common.UpstreamResponseIdKey))
	require.JSONEq(t, body, recorder.Body.String())
	require.Equal(t, 3, usage.TotalTokens)
}

func TestOaiResponsesStreamHandlerCapturesUpstreamResponseId(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setResponsesStreamTestTimeout(t)
	c, recorder := newResponsesIDTestContext()
	body := "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_native_stream\",\"model\":\"gpt-5\"}}\n\n" +
		"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_native_stream\",\"usage\":{\"input_tokens\":1,\"output_tokens\":2,\"total_tokens\":3}}}\n\n"

	usage, apiErr := OaiResponsesStreamHandler(c, newResponsesIDTestInfo(), newResponsesIDTestHTTPResponse(body, "text/event-stream"))

	require.Nil(t, apiErr)
	require.Equal(t, "resp_native_stream", c.GetString(common.UpstreamResponseIdKey))
	require.Contains(t, recorder.Body.String(), "response.created")
	require.Equal(t, 3, usage.TotalTokens)
}

func TestOaiResponsesToChatHandlerCapturesUpstreamResponseId(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, recorder := newResponsesIDTestContext()
	body := `{"id":"resp_chat_non_stream","object":"response","model":"gpt-5","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hello"}]}],"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`

	usage, apiErr := OaiResponsesToChatHandler(c, newResponsesIDTestInfo(), newResponsesIDTestHTTPResponse(body, "application/json"))

	require.Nil(t, apiErr)
	require.Equal(t, "resp_chat_non_stream", c.GetString(common.UpstreamResponseIdKey))
	require.Contains(t, recorder.Body.String(), "hello")
	require.Equal(t, 3, usage.TotalTokens)
}

func TestOaiResponsesToChatStreamHandlerCapturesUpstreamResponseId(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setResponsesStreamTestTimeout(t)
	c, recorder := newResponsesIDTestContext()
	body := "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_chat_stream\",\"model\":\"gpt-5\",\"created_at\":1}}\n\n" +
		"data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}\n\n" +
		"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_chat_stream\",\"usage\":{\"input_tokens\":1,\"output_tokens\":2,\"total_tokens\":3}}}\n\n"

	usage, apiErr := OaiResponsesToChatStreamHandler(c, newResponsesIDTestInfo(), newResponsesIDTestHTTPResponse(body, "text/event-stream"))

	require.Nil(t, apiErr)
	require.Equal(t, "resp_chat_stream", c.GetString(common.UpstreamResponseIdKey))
	require.Contains(t, recorder.Body.String(), "hello")
	require.Equal(t, 3, usage.TotalTokens)
}
