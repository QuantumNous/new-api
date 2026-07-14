package cloudflare

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type failingReadCloser struct {
	closed bool
}

// Read forces the response-body error path used by the close assertions.
func (r *failingReadCloser) Read([]byte) (int, error) { return 0, errors.New("read failed") }

// Close records whether a failed response-body read still releases the body.
func (r *failingReadCloser) Close() error {
	r.closed = true
	return nil
}

// newCloudflareTestContext builds the minimum relay state required by native
// Cloudflare response handlers.
func newCloudflareTestContext(relayMode int) (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		RelayMode:   relayMode,
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "@cf/test-model"},
	}
	info.SetEstimatePromptTokens(7)
	return c, recorder, info
}

// TestCFHandlerPromotesHTTP200BusinessErrors verifies that native and
// OpenAI-compatible error envelopes cannot become empty successful responses.
func TestCFHandlerPromotesHTTP200BusinessErrors(t *testing.T) {
	tests := map[string]string{
		"openai":     `{"error":{"message":"upstream busy","type":"server_error","code":"server_error"}}`,
		"cloudflare": `{"success":false,"errors":[{"code":1000,"message":"workers ai busy"}]}`,
		"unknown":    `{"unexpected":"payload"}`,
	}

	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			c, recorder, info := newCloudflareTestContext(relayconstant.RelayModeChatCompletions)
			resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body))}

			apiErr, usage := cfHandler(c, info, resp)

			require.Nil(t, usage)
			require.NotNil(t, apiErr)
			assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			assert.Empty(t, recorder.Body.String())
		})
	}
}

// TestCFStreamHandlerRejectsBusinessErrorBeforeWriting keeps a business error
// retryable by rejecting it before any model output is sent downstream.
func TestCFStreamHandlerRejectsBusinessErrorBeforeWriting(t *testing.T) {
	c, recorder, info := newCloudflareTestContext(relayconstant.RelayModeChatCompletions)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`data: {"success":false,"errors":[{"message":"overloaded"}]}` + "\n")),
	}

	apiErr, usage := cfStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	assert.Empty(t, recorder.Body.String())
}

// TestCFHandlerPreservesEmbeddingData guards against decoding an embedding
// response through the chat schema and silently dropping its data array.
func TestCFHandlerPreservesEmbeddingData(t *testing.T) {
	c, recorder, info := newCloudflareTestContext(relayconstant.RelayModeEmbeddings)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(
			`{"object":"list","data":[{"object":"embedding","index":0,"embedding":[0.1,0.2]}],"usage":{"prompt_tokens":2,"total_tokens":2}}`,
		)),
	}

	apiErr, usage := cfHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 2, usage.PromptTokens)
	assert.Contains(t, recorder.Body.String(), `"embedding":[0.1,0.2]`)
}

// TestCFHandlersCloseBodyWhenReadFails verifies both chat and audio handlers
// release the upstream connection when reading the response fails.
func TestCFHandlersCloseBodyWhenReadFails(t *testing.T) {
	tests := map[string]func(*gin.Context, *relaycommon.RelayInfo, *http.Response){
		"chat": func(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) {
			_, _ = cfHandler(c, info, resp)
		},
		"audio": func(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) {
			_, _ = cfSTTHandler(c, info, resp)
		},
	}

	for name, handler := range tests {
		t.Run(name, func(t *testing.T) {
			c, _, info := newCloudflareTestContext(relayconstant.RelayModeChatCompletions)
			body := &failingReadCloser{}
			handler(c, info, &http.Response{StatusCode: http.StatusOK, Body: body})
			assert.True(t, body.closed)
		})
	}
}
