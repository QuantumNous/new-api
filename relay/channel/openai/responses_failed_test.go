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
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const responsesFailedErrorJSON = `{"message":"server failed","type":"server_error","param":"input","code":"server_error","metadata":{"provider_request_id":"up_123"}}`

func newResponsesFailedTestContext(t *testing.T, body string, stream bool) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "responses-failed-test")

	contentType := "application/json"
	if stream {
		contentType = "text/event-stream"
		oldTimeout := constant.StreamingTimeout
		constant.StreamingTimeout = 30
		t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{contentType}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAI,
		IsStream:    stream,
		DisablePing: true,
	}
	return c, w, resp, info
}

func requireResponsesFailedError(t *testing.T, apiErr *types.NewAPIError, statusCode int) {
	t.Helper()

	require.NotNil(t, apiErr)
	assert.Equal(t, statusCode, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCode("server_error"), apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.Equal(t, "server failed", apiErr.ToOpenAIError().Message)
}

func TestOaiResponsesHandlerResponseFailed(t *testing.T) {
	body := `{"status":"failed","error":` + responsesFailedErrorJSON + `}`
	c, w, resp, info := newResponsesFailedTestContext(t, body, false)
	resp.StatusCode = http.StatusAccepted

	usage, apiErr := OaiResponsesHandler(c, info, resp)

	require.Nil(t, usage)
	requireResponsesFailedError(t, apiErr, http.StatusAccepted)
	assert.Empty(t, w.Body.String())
	assert.Empty(t, apiErr.ToOpenAIError().Metadata)
	rawError, ok := common.GetContextKeyType[[]byte](c, constant.ContextKeyUpstreamResponseError)
	require.True(t, ok)
	var errorObject map[string]any
	require.NoError(t, common.Unmarshal(rawError, &errorObject))
	assert.Equal(t, "server_error", errorObject["code"])
	assert.Equal(t, map[string]any{"provider_request_id": "up_123"}, errorObject["metadata"])
}

func TestOaiResponsesStreamHandlerResponseFailed(t *testing.T) {
	body := `data: {"type":"response.failed","response":{"status":"failed","error":` + responsesFailedErrorJSON + `}}` + "\n"
	c, w, resp, info := newResponsesFailedTestContext(t, body, true)

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	requireResponsesFailedError(t, apiErr, http.StatusOK)
	require.NotNil(t, info.StreamStatus)
	assert.True(t, info.StreamStatus.HasErrors())
	assert.Contains(t, w.Body.String(), "event: response.failed")
}

func TestResponsesToChatHandlersResponseFailed(t *testing.T) {
	t.Run("non streaming", func(t *testing.T) {
		body := `{"status":"failed","error":` + responsesFailedErrorJSON + `}`
		c, w, resp, info := newResponsesFailedTestContext(t, body, false)

		usage, apiErr := OaiResponsesToChatHandler(c, info, resp)

		require.Nil(t, usage)
		requireResponsesFailedError(t, apiErr, http.StatusOK)
		assert.Empty(t, w.Body.String())
	})

	t.Run("buffered stream", func(t *testing.T) {
		body := `data: {"type":"response.failed","response":{"status":"failed","error":` + responsesFailedErrorJSON + `}}` + "\n"
		c, w, resp, info := newResponsesFailedTestContext(t, body, false)

		usage, apiErr := OaiResponsesToChatBufferedStreamHandler(c, info, resp)

		require.Nil(t, usage)
		requireResponsesFailedError(t, apiErr, http.StatusOK)
		assert.Empty(t, w.Body.String())
	})

	t.Run("direct stream", func(t *testing.T) {
		body := `data: {"type":"response.failed","response":{"status":"failed","error":` + responsesFailedErrorJSON + `}}` + "\n"
		c, w, resp, info := newResponsesFailedTestContext(t, body, true)

		usage, apiErr := OaiResponsesToChatStreamHandler(c, info, resp)

		require.Nil(t, usage)
		requireResponsesFailedError(t, apiErr, http.StatusOK)
		assert.Contains(t, w.Body.String(), `data: {"error":`)
		assert.Contains(t, w.Body.String(), "data: [DONE]")
		assert.NotContains(t, w.Body.String(), "event: response.failed")
	})
}
