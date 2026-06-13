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
