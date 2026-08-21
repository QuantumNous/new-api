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
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newChatStreamTestContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
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
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeMoonshot,
			UpstreamModelName: "test-model",
		},
		IsStream:    true,
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
	}
	return c, recorder, resp, info
}

// TestOaiStreamHandlerRecoversUsageFromEarlierChunk guards the fix for
// upstreams (e.g. OpenCode.ai) that send a non-standard frame AFTER the
// usage-bearing finish chunk. That trailing frame used to overwrite
// lastStreamData, so the real usage — and the cached_tokens extracted from the
// chunk body by applyUsagePostProcessing — was lost and replaced by an
// estimate. The handler must recover usage from the last chunk that actually
// carried it.
func TestOaiStreamHandlerRecoversUsageFromEarlierChunk(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"Hello"}}]}`,
		// Moonshot 风格：cached_tokens 在 choices[].usage，不在顶层 usage。
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{},"finish_reason":"stop","usage":{"cached_tokens":100}}],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}`,
		// 上游在 usage chunk 之后追加的非标准尾随块（x-opencode-type）。
		`data: {"x-opencode-type":"generation_end"}`,
		`data: [DONE]`,
	}, "\n")

	c, recorder, resp, info := newChatStreamTestContext(t, body)

	usage, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, err)
	require.Equal(t, 10, usage.PromptTokens, "real usage must be recovered from the earlier usage chunk, not estimated")
	require.Equal(t, 20, usage.CompletionTokens)
	require.Equal(t, 30, usage.TotalTokens)
	require.Equal(t, 100, usage.PromptTokensDetails.CachedTokens, "cached_tokens must be extracted from the usage chunk body, not the trailing non-standard frame")
	require.Contains(t, recorder.Body.String(), "Hello")
	require.Contains(t, recorder.Body.String(), "x-opencode-type")
}
