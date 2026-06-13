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

// 上游 message_end 带完整 usage（含 total），其后 node_finished 帧又给 nodeToken
// 补偿到 completion：最终 TotalTokens 必须把 nodeToken 一并计入，不能停在上游的旧 total。
// 复现并守护 #3：nodeToken 之前在 TotalTokens 算定后才加，导致 total 少算。
func TestDifyStreamHandler_NodeTokenIncludedInTotal(t *testing.T) {
	prev := constant.DifyDebug
	constant.DifyDebug = true // node_finished 仅在 debug 下产生 reasoning → nodeToken
	defer func() { constant.DifyDebug = prev }()

	sse := `data: {"event":"message","answer":"Hello answer"}
data: {"event":"node_finished","data":{"node_type":"llm","status":"succeeded"}}
data: {"event":"message_end","metadata":{"usage":{"prompt_tokens":10,"completion_tokens":6,"total_tokens":16}}}
`
	usage, apiErr := difyStreamHandler(streamCtx(), streamInfo("dify-app"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 7, usage.CompletionTokens, "completion 应为上游 6 + nodeToken 1")
	require.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens,
		"TotalTokens 必须 = prompt + (completion+nodeToken)，不能停在上游旧 total")
}
