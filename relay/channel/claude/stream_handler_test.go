package claude

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
	// StreamScannerHandler uses time.NewTicker(StreamingTimeout); avoid zero-interval panic.
	if constant.StreamingTimeout <= 0 {
		constant.StreamingTimeout = 300
	}
	os.Exit(m.Run())
}

func newStreamTestInfo(model string, trust bool) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: model,
			ChannelSetting:    dto.ChannelSettings{TrustUpstreamUsage: trust},
		},
	}
	info.SetEstimatePromptTokens(100)
	return info
}

func newSSEResp(sse string) *http.Response {
	return &http.Response{
		Body:       io.NopCloser(strings.NewReader(sse)),
		StatusCode: http.StatusOK,
	}
}

func newStreamTestCtx() *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	return c
}

// 上游提供 usage 且 trust=true：应直接用上游 usage（含 output_tokens）。
func TestClaudeStreamHandler_TrustUpstreamUsage(t *testing.T) {
	c := newStreamTestCtx()
	info := newStreamTestInfo("claude-3-5-sonnet", true)
	sse := `data: {"type":"message_start","message":{"id":"msg_1","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":1}}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello world this is the answer"}}
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":100,"output_tokens":42}}
data: {"type":"message_stop"}
`
	usage, apiErr := ClaudeStreamHandler(c, newSSEResp(sse), info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 100, usage.PromptTokens)
	require.Equal(t, 42, usage.CompletionTokens, "trust=true 应采用上游 output_tokens=42")
}

// 上游未给 output_tokens（异常/中断）：应回退到本地流式估算，且不为 0。
func TestClaudeStreamHandler_LocalFallback(t *testing.T) {
	c := newStreamTestCtx()
	info := newStreamTestInfo("claude-3-5-sonnet", false)
	// message_delta 不带 usage，message_stop 前断；本地需要根据文本估算
	sse := `data: {"type":"message_start","message":{"id":"msg_1","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":0}}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello world this is a fairly long answer text"}}
`
	usage, apiErr := ClaudeStreamHandler(c, newSSEResp(sse), info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0, "上游未给 usage 时本地估算应 > 0")
}

// thinking + text 分离计数：thinking 也应计入 completion。
func TestClaudeStreamHandler_ThinkingCounted(t *testing.T) {
	c := newStreamTestCtx()
	info := newStreamTestInfo("claude-3-5-sonnet", false)
	textOnly := `data: {"type":"message_start","message":{"id":"m","model":"claude-3-5-sonnet","usage":{"input_tokens":10,"output_tokens":0}}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"visible answer"}}
`
	withThinking := `data: {"type":"message_start","message":{"id":"m","model":"claude-3-5-sonnet","usage":{"input_tokens":10,"output_tokens":0}}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"visible answer"}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"some internal reasoning content here that is fairly long"}}
`
	u1, e1 := ClaudeStreamHandler(newStreamTestCtx(), newSSEResp(textOnly), info)
	require.Nil(t, e1)
	u2, e2 := ClaudeStreamHandler(c, newSSEResp(withThinking), newStreamTestInfo("claude-3-5-sonnet", false))
	require.Nil(t, e2)
	require.Greater(t, u2.CompletionTokens, u1.CompletionTokens, "带 thinking 的 completion 应更大（thinking 被计入）")
}

// cache 字段（read/creation）必须从 message_start 正确传递到最终 usage，
// 不被本次累积重构破坏。
func TestClaudeStreamHandler_CacheTokensPreserved(t *testing.T) {
	c := newStreamTestCtx()
	info := newStreamTestInfo("claude-3-5-sonnet", true)
	sse := `data: {"type":"message_start","message":{"id":"m","model":"claude-3-5-sonnet","usage":{"input_tokens":50,"output_tokens":1,"cache_read_input_tokens":4096,"cache_creation_input_tokens":256}}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"answer text here"}}
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":50,"output_tokens":20}}
data: {"type":"message_stop"}
`
	usage, apiErr := ClaudeStreamHandler(c, newSSEResp(sse), info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 4096, usage.PromptTokensDetails.CachedTokens, "cache_read 应保留")
	require.Equal(t, 256, usage.PromptTokensDetails.CachedCreationTokens, "cache_creation 应保留")
	require.Equal(t, 20, usage.CompletionTokens, "trust=true 用上游 output_tokens")
}

// 使用从生产 sub2api 抓取的【真实】Claude SSE 响应（含 event: 行、ping、
// cache_creation 嵌套结构、末尾空白），验证 handler 在真实上游格式下正确工作。
// 这不是臆想的格式——是 2026-06 实际抓包内容（已脱敏 id）。
func TestClaudeStreamHandler_RealUpstreamFormat(t *testing.T) {
	c := newStreamTestCtx()
	info := newStreamTestInfo("claude-haiku-4-5", true)
	// 注意：真实流每个 data 行后有尾随空格、event: 行穿插、有 ping 事件。
	sse := "event: message_start\n" +
		`data: {"type":"message_start","message":{"model":"claude-haiku-4-5","id":"msg_x","type":"message","role":"assistant","content":[],"usage":{"input_tokens":8,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":0},"output_tokens":1}}        }` + "\n\n" +
		"event: content_block_start\n" +
		`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}    }` + "\n\n" +
		"event: ping\n" +
		`data: {"type": "ping"}` + "\n\n" +
		"event: content_block_delta\n" +
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hey"}              }` + "\n\n" +
		"event: content_block_delta\n" +
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"! How's it going?"}      }` + "\n\n" +
		"event: content_block_stop\n" +
		`data: {"type":"content_block_stop","index":0  }` + "\n\n" +
		"event: message_delta\n" +
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":8,"output_tokens":11}}` + "\n\n" +
		"event: message_stop\n" +
		`data: {"type":"message_stop"}` + "\n\n"
	usage, apiErr := ClaudeStreamHandler(c, newSSEResp(sse), info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 8, usage.PromptTokens, "真实 message_start input_tokens")
	require.Equal(t, 11, usage.CompletionTokens, "真实 message_delta output_tokens (trust=true)")
}
