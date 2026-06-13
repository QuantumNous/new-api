package cohere

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

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
		StartTime:   time.Now(),
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

// closeNotifyRecorder 包装 httptest.ResponseRecorder 以满足 gin c.Stream 需要的
// http.CloseNotifier 接口（ResponseRecorder 本身不实现）。
type closeNotifyRecorder struct {
	*httptest.ResponseRecorder
	closed chan bool
}

func newCloseNotifyRecorder() *closeNotifyRecorder {
	return &closeNotifyRecorder{httptest.NewRecorder(), make(chan bool, 1)}
}

func (c *closeNotifyRecorder) CloseNotify() <-chan bool { return c.closed }

func streamCtx() *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(newCloseNotifyRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat", nil)
	return c
}

// 上游 stream-end 帧带 billed_units（prompt/completion）但不含 total：
// 最终返回的 usage.TotalTokens 必须等于 prompt+completion，不能停在 0。
// 复现并守护 #2：上游提供 usage 时跳过本地回退块，TotalTokens 之前会遗漏。
func TestCohereStreamHandler_UpstreamUsageTotalTokens(t *testing.T) {
	sse := `{"is_finished":false,"event_type":"text-generation","text":"Hello world answer"}
{"is_finished":true,"event_type":"stream-end","finish_reason":"COMPLETE","response":{"meta":{"billed_units":{"input_tokens":12,"output_tokens":5}}}}`
	usage, apiErr := cohereStreamHandler(streamCtx(), streamInfo("command-r-plus"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 12, usage.PromptTokens)
	require.Equal(t, 5, usage.CompletionTokens)
	require.Equal(t, 17, usage.TotalTokens, "上游有 usage 时 TotalTokens 必须 = prompt+completion")
}

// cohere 流式（JSON-per-line），上游 finish 帧不带 usage prompt → 本地估算 > 0。
func TestCohereStreamHandler_LocalEstimate(t *testing.T) {
	sse := `{"is_finished":false,"event_type":"text-generation","text":"Hello world this is"}
{"is_finished":false,"event_type":"text-generation","text":" a generated answer"}
{"is_finished":true,"event_type":"stream-end","finish_reason":"COMPLETE"}`
	usage, apiErr := cohereStreamHandler(streamCtx(), streamInfo("command-r-plus"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0)
}
