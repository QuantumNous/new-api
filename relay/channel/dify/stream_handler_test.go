package dify

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
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat-messages", nil)
	return c
}

// dify 上游 message_end 带 usage：采用上游。
func TestDifyStreamHandler_UpstreamUsage(t *testing.T) {
	sse := `data: {"event":"message","answer":"Hello world answer"}
data: {"event":"message","answer":" more"}
data: {"event":"message_end","metadata":{"usage":{"prompt_tokens":10,"completion_tokens":6,"total_tokens":16}}}
`
	usage, apiErr := difyStreamHandler(streamCtx(), streamInfo("dify-app"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 6, usage.CompletionTokens, "应采用上游 message_end 的 usage")
}

// dify 无 message_end usage：本地估算 > 0。
func TestDifyStreamHandler_LocalFallback(t *testing.T) {
	sse := `data: {"event":"message","answer":"Hello world this is a fairly long dify generated answer text"}
`
	usage, apiErr := difyStreamHandler(streamCtx(), streamInfo("dify-app"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0)
}
