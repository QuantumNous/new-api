package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
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

// buildSSEBody 把若干 chunk payload 拼成上游的 SSE 响应体。
// 每个 chunk 都按 `data: {json}\n\n` 格式输出，结尾补 `data: [DONE]\n\n`。
func buildSSEBody(chunks []string) string {
	var b strings.Builder
	for _, ch := range chunks {
		b.WriteString("data: ")
		b.WriteString(ch)
		b.WriteString("\n\n")
	}
	b.WriteString("data: [DONE]\n\n")
	return b.String()
}

// newUsageStreamContext 构造一个调用 OaiStreamHandler 的最小上下文：
// 使用 OpenAI Chat Completions 流式 + 自定义 SSE 响应体。
func newUsageStreamContext(t *testing.T, sseBody string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(sseBody)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "test-model",
		},
		IsStream:    true,
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
	}
	return c, recorder, resp, info
}

// TestOaiStreamHandler_UsageExtractedWhenCostMetadataFrameFollows 验证：
// 当含 usage 的 SSE 帧之后又跟了一个无 usage 的 cost 元数据帧时，
// 最终提取到的 usage 仍然来自含 usage 的那一帧，而不是被空 usage 覆盖。
func TestOaiStreamHandler_UsageExtractedWhenCostMetadataFrameFollows(t *testing.T) {
	gin.SetMode(gin.TestMode)
	defer gin.SetMode(gin.TestMode)

	// StreamScannerHandler 会用 time.NewTicker(StreamingTimeout) 做超时检测，
	// 测试环境下必须设为正值，否则 NewTicker 会 panic。
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 60
	defer func() { constant.StreamingTimeout = oldTimeout }()

	// 1) 正常 chunk（含部分内容）
	// 2) 含 usage 的最终 chunk
	// 3) 上游追加的无 usage cost 元数据帧
	chunks := []string{
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"test-model","choices":[{"index":0,"delta":{"role":"assistant","content":"hi"},"finish_reason":null}]}`,
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"test-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":42,"completion_tokens":7,"total_tokens":49}}`,
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"test-model","choices":[],"usage":null,"cost":{"input":0.01,"output":0.002}}`,
	}

	body := buildSSEBody(chunks)
	c, _, resp, info := newUsageStreamContext(t, body)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr, "no error expected")
	require.NotNil(t, usage, "usage must not be nil")

	// 修复前：最后一帧 usage=null，handleLastResponse 不会更新 usage，
	// 但 containStreamUsage 也不会变 true，最终 usage 来自 ResponseText2Usage，
	// prompt_tokens 通常为 0 或估算值，无法反映上游真实 token 数。
	require.Equal(t, 42, usage.PromptTokens, "prompt_tokens should come from the chunk that carries real usage")
	require.Equal(t, 7, usage.CompletionTokens, "completion_tokens should come from the chunk that carries real usage")
	require.Equal(t, 49, usage.TotalTokens, "total_tokens should come from the chunk that carries real usage")
}

// TestOaiStreamHandler_UsageFromLastChunkWhenNoCostFrame 验证：
// 标准上游（usage 在最后一帧，且没有追加的 cost 元数据帧）行为保持不变。
func TestOaiStreamHandler_UsageFromLastChunkWhenNoCostFrame(t *testing.T) {
	gin.SetMode(gin.TestMode)
	defer gin.SetMode(gin.TestMode)

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 60
	defer func() { constant.StreamingTimeout = oldTimeout }()

	chunks := []string{
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"test-model","choices":[{"index":0,"delta":{"role":"assistant","content":"hi"},"finish_reason":null}]}`,
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"test-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":5,"total_tokens":105}}`,
	}

	body := buildSSEBody(chunks)
	c, _, resp, info := newUsageStreamContext(t, body)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 100, usage.PromptTokens)
	require.Equal(t, 5, usage.CompletionTokens)
}

// TestOaiStreamHandler_NoUsageAnywhereUsesEstimation 验证：
// 上游从头到尾都不返回 usage 时，走估算路径，usage 不为 nil（行为保持兼容）。
func TestOaiStreamHandler_NoUsageAnywhereUsesEstimation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	defer gin.SetMode(gin.TestMode)

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 60
	defer func() { constant.StreamingTimeout = oldTimeout }()

	chunks := []string{
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"test-model","choices":[{"index":0,"delta":{"role":"assistant","content":"hello"},"finish_reason":null}]}`,
		`{"id":"chatcmpl-1","object":"chat.completion.chunk","model":"test-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
	}

	body := buildSSEBody(chunks)
	c, _, resp, info := newUsageStreamContext(t, body)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	// 不应该 panic 或返回 nil；估算路径至少会给出 *dto.Usage（哪怕全 0）
	require.NotNil(t, usage)
}

// 引用 dto 包避免未使用导入（如果未来去掉某个用例）。
var _ dto.Usage
