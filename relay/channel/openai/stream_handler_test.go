package openai

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
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
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
		RelayMode:   relayconstant.RelayModeChatCompletions,
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

func streamCtx(path string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	return c
}

// chat/completions 上游带 stream usage：采用上游。
func TestOaiStreamHandler_UpstreamUsage(t *testing.T) {
	sse := `data: {"id":"c","choices":[{"delta":{"role":"assistant","content":"Hello world answer text"}}]}
data: {"id":"c","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":8,"total_tokens":18}}
data: [DONE]
`
	usage, apiErr := OaiStreamHandler(streamCtx("/v1/chat/completions"), streamInfo("gpt-4o"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 10, usage.PromptTokens)
	require.Equal(t, 8, usage.CompletionTokens)
}

// chat/completions 上游无 usage：本地估算 > 0。
func TestOaiStreamHandler_LocalFallback(t *testing.T) {
	sse := `data: {"id":"c","choices":[{"delta":{"role":"assistant","content":"Hello world this is a long generated answer text without usage"}}]}
data: {"id":"c","choices":[{"delta":{},"finish_reason":"stop"}]}
data: [DONE]
`
	usage, apiErr := OaiStreamHandler(streamCtx("/v1/chat/completions"), streamInfo("gpt-4o"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0)
}

// chat_via_responses 上游 responses 流：解析并计 usage。
func TestOaiResponsesToChatStreamHandler_Basic(t *testing.T) {
	sse := `data: {"type":"response.created","response":{"id":"r","status":"in_progress"}}
data: {"type":"response.output_text.delta","delta":"Hello world this is the answer"}
data: {"type":"response.completed","response":{"id":"r","status":"completed","usage":{"input_tokens":10,"output_tokens":6,"total_tokens":16}}}
`
	usage, apiErr := OaiResponsesToChatStreamHandler(streamCtx("/v1/chat/completions"), streamInfo("gpt-5.5"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0)
}

// tool call（无上游 usage）：completion = 本地文本估算 + toolCount*7。
func TestOaiStreamHandler_ToolCountCompensation(t *testing.T) {
	// 无文本内容、只有一个 tool call：completion 应至少包含 toolCount*7=7
	sse := `data: {"id":"c","choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{}"}}]}}]}
data: {"id":"c","choices":[{"delta":{},"finish_reason":"tool_calls"}]}
data: [DONE]
`
	usage, apiErr := OaiStreamHandler(streamCtx("/v1/chat/completions"), streamInfo("gpt-4o"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.GreaterOrEqual(t, usage.CompletionTokens, 7, "至少含 toolCount*7 补偿")
}

// 多 choice + 空 delta：不 panic，正常累计。
func TestOaiStreamHandler_MultiChoiceAndEmptyDelta(t *testing.T) {
	sse := `data: {"id":"c","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}},{"index":1,"delta":{"content":"World"}}]}
data: {"id":"c","choices":[{"index":0,"delta":{}}]}
data: {"id":"c","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}
data: [DONE]
`
	usage, apiErr := OaiStreamHandler(streamCtx("/v1/chat/completions"), streamInfo("gpt-4o"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 3, usage.CompletionTokens, "上游 usage 优先")
}

// 流中途断（无结束帧、无 usage）：不 panic，本地估算已收到的文本。
func TestOaiStreamHandler_TruncatedStream(t *testing.T) {
	sse := `data: {"id":"c","choices":[{"delta":{"role":"assistant","content":"partial answer before"}}]}
data: {"id":"c","choices":[{"delta":{"content":" the stream was cut"}}]}
`
	usage, apiErr := OaiStreamHandler(streamCtx("/v1/chat/completions"), streamInfo("gpt-4o"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0, "截断流应本地估算已收文本")
}
