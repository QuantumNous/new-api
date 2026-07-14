package cohere

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type failingReadCloser struct {
	closed bool
}

func (r *failingReadCloser) Read([]byte) (int, error) { return 0, errors.New("read failed") }
func (r *failingReadCloser) Close() error {
	r.closed = true
	return nil
}

func newCohereTestContext() (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c, recorder, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "command-r"},
	}
}

func TestCohereHandlerPromotesHTTP200BusinessError(t *testing.T) {
	c, recorder, info := newCohereTestContext()
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"message":"upstream busy"}`)),
	}

	usage, apiErr := cohereHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	require.Contains(t, apiErr.Error(), "upstream busy")
	require.Empty(t, recorder.Body.String())
}

func TestCohereStreamHandlerRejectsBusinessErrorBeforeWriting(t *testing.T) {
	c, recorder, info := newCohereTestContext()
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"event_type":"stream-error","message":"overloaded"}` + "\n")),
	}

	usage, apiErr := cohereStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	require.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	require.Contains(t, apiErr.Error(), "overloaded")
	require.Empty(t, recorder.Body.String())
}

func TestCohereHandlersCloseBodyWhenReadFails(t *testing.T) {
	tests := map[string]func(*gin.Context, *relaycommon.RelayInfo, *http.Response){
		"chat": func(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) {
			_, _ = cohereHandler(c, info, resp)
		},
		"rerank": func(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) {
			_, _ = cohereRerankHandler(c, resp, info)
		},
	}

	for name, handler := range tests {
		t.Run(name, func(t *testing.T) {
			c, _, info := newCohereTestContext()
			body := &failingReadCloser{}
			handler(c, info, &http.Response{StatusCode: http.StatusOK, Body: body})
			require.True(t, body.closed)
		})
	}
}
