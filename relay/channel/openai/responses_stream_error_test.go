package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newResponsesStreamTestContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo, *http.Response) {
	t.Helper()

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o-mini",
		},
	}

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	return c, recorder, info, resp
}

func TestOaiResponsesStreamHandler_ReturnsErrorBeforeFirstWrite(t *testing.T) {
	t.Parallel()

	body := "data: {\"type\":\"response.error\",\"response\":{\"error\":{\"message\":\"bad request\",\"type\":\"invalid_request_error\",\"code\":\"invalid_request_error\"}}}\n" +
		"data: [DONE]\n"
	c, recorder, info, resp := newResponsesStreamTestContext(t, body)

	usage, streamErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, usage)
	require.NotNil(t, streamErr)
	require.Equal(t, http.StatusInternalServerError, streamErr.StatusCode)
	require.Zero(t, recorder.Body.Len())
}

func TestOaiResponsesToChatStreamHandler_ReturnsErrorBeforeFirstWrite(t *testing.T) {
	t.Parallel()

	body := "data: {\"type\":\"response.failed\",\"response\":{\"error\":{\"message\":\"upstream failed\",\"type\":\"server_error\",\"code\":\"server_error\"}}}\n" +
		"data: [DONE]\n"
	c, recorder, info, resp := newResponsesStreamTestContext(t, body)

	usage, streamErr := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, usage)
	require.NotNil(t, streamErr)
	require.Equal(t, http.StatusInternalServerError, streamErr.StatusCode)
	require.Zero(t, recorder.Body.Len())
}
