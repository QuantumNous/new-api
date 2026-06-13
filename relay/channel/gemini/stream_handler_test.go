package gemini

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
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/x:streamGenerateContent", nil)
	return c
}

// 上游 usageMetadata 带 candidatesTokenCount：采用上游。
func TestGeminiStreamHandler_UpstreamUsage(t *testing.T) {
	sse := `data: {"candidates":[{"content":{"parts":[{"text":"Hello world answer"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":9,"totalTokenCount":19}}
data: {"candidates":[{"content":{"parts":[{"text":" more text"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":12,"totalTokenCount":22}}
data: [DONE]
`
	usage, apiErr := GeminiChatStreamHandler(streamCtx(), streamInfo("gemini-1.5-flash"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 12, usage.CompletionTokens, "应采用上游最后的 candidatesTokenCount=12")
}

// 上游无 usageMetadata：本地估算 > 0。
func TestGeminiStreamHandler_LocalFallback(t *testing.T) {
	sse := `data: {"candidates":[{"content":{"parts":[{"text":"Hello world this is a fairly long generated gemini answer text"}]}}]}
data: [DONE]
`
	usage, apiErr := GeminiChatStreamHandler(streamCtx(), streamInfo("gemini-1.5-flash"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0)
}

// 图片输出：无上游 usage 时按 imageCount*1400 计 completion。
func TestGeminiStreamHandler_ImageCount(t *testing.T) {
	sse := `data: {"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"iVBORw0KGgo="}}]}}]}
data: [DONE]
`
	usage, apiErr := GeminiChatStreamHandler(streamCtx(), streamInfo("gemini-2-flash-image"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 1400, usage.CompletionTokens, "1 张图应计 1400 token")
}
