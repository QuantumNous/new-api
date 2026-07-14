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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// failingReadCloser simulates a response body that fails before yielding data.
type failingReadCloser struct {
	closed bool
}

// Read returns the deterministic body-read failure.
func (r *failingReadCloser) Read([]byte) (int, error) { return 0, errors.New("read failed") }

// Close records body cleanup for leak assertions.
func (r *failingReadCloser) Close() error {
	r.closed = true
	return nil
}

// newCohereTestContext builds a minimal Chat Completions relay fixture.
func newCohereTestContext() (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c, recorder, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "command-r"},
	}
}

// TestCohereHandlerPromotesHTTP200BusinessError verifies business-error
// payloads never escape as successful HTTP 200 responses.
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

// TestCohereStreamHandlerRejectsBusinessErrorBeforeWriting preserves retry
// eligibility when the first Cohere event is an error.
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

// TestCohereStreamHandlerBackfillsUsageBeforeMidStreamError ensures partial
// Cohere text is counted before forwarding a later error event.
func TestCohereStreamHandlerBackfillsUsageBeforeMidStreamError(t *testing.T) {
	c, recorder, info := newCohereTestContext()
	info.SetEstimatePromptTokens(7)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`{"text":"partial"}`,
			`{"event_type":"stream-error","message":"overloaded"}`,
			``,
		}, "\n"))),
	}

	usage, apiErr := cohereStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 7, usage.PromptTokens)
	assert.Greater(t, usage.CompletionTokens, 0)
	assert.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"error"`)
}

// TestCohereHandlersCloseBodyWhenReadFails protects connection reuse on every
// non-stream body-read failure path.
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
