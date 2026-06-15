package xai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	if constant.StreamingTimeout <= 0 {
		constant.StreamingTimeout = 300
	}
	os.Exit(m.Run())
}

func streamInfo(model string) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: model,
			ChannelSetting:    dto.ChannelSettings{},
		},
	}
	info.SetEstimatePromptTokens(100)
	return info
}

func sseResp(s string) *http.Response {
	return &http.Response{Body: io.NopCloser(strings.NewReader(s)), StatusCode: http.StatusOK}
}

func streamCtx() *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

// 上游带 usage：直接采用。
func TestXAIStreamHandler_UpstreamUsage(t *testing.T) {
	sse := `data: {"id":"x","choices":[{"delta":{"role":"assistant","content":"Hello world answer"}}]}
data: {"id":"x","choices":[{"delta":{"content":" more"}}],"usage":{"prompt_tokens":10,"completion_tokens":7,"total_tokens":17}}
data: [DONE]
`
	usage, apiErr := xAIStreamHandler(streamCtx(), streamInfo("grok-2"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 10, usage.PromptTokens)
	require.Equal(t, 7, usage.CompletionTokens)
}

// 上游无 usage：本地估算 > 0。
func TestXAIStreamHandler_LocalFallback(t *testing.T) {
	sse := `data: {"id":"x","choices":[{"delta":{"role":"assistant","content":"Hello world this is a fairly long generated answer text"}}]}
data: [DONE]
`
	usage, apiErr := xAIStreamHandler(streamCtx(), streamInfo("grok-2"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0)
}
