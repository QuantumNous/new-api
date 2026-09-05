package xai

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

func newXAIStreamContext(t *testing.T) (*httptest.ResponseRecorder, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "xai-stream-test")
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-4",
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		DisablePing:     true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "grok-4",
		},
	}
	return w, c, info
}

func xaiSSEBody(events ...string) io.Reader {
	var b strings.Builder
	for _, e := range events {
		b.WriteString("data: ")
		b.WriteString(e)
		b.WriteString("\n\n")
	}
	b.WriteString("data: [DONE]\n\n")
	return strings.NewReader(b.String())
}

func xaiSSEResponse(r io.Reader) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(r),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
}

// An upstream error event must be forwarded to the client intact, not
// re-marshaled into a fieldless completion chunk.
func TestXAIStreamForwardsUpstreamErrorEvent(t *testing.T) {
	w, c, info := newXAIStreamContext(t)
	errEvent := `{"error":{"message":"rate limit exceeded","type":"rate_limit_error","code":429}}`
	resp := xaiSSEResponse(xaiSSEBody(errEvent))

	usage, apiErr := xAIStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	body := w.Body.String()
	assert.Contains(t, body, "rate limit exceeded")
	assert.Contains(t, body, `"error"`)
	// The regression symptom: an empty id/object with null choices.
	assert.NotContains(t, body, `"choices":null`)
	assert.NotContains(t, body, `"id":""`)
}

// A normal completion chunk must still be converted and forwarded.
func TestXAIStreamConvertsNormalChunk(t *testing.T) {
	w, c, info := newXAIStreamContext(t)
	chunk := `{"id":"chatcmpl-1","object":"chat.completion.chunk","created":123,"model":"grok-4","choices":[{"index":0,"delta":{"content":"hello"}}]}`
	resp := xaiSSEResponse(xaiSSEBody(chunk))

	usage, apiErr := xAIStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	body := w.Body.String()
	assert.Contains(t, body, "hello")
	assert.Contains(t, body, "chat.completion.chunk")
}
