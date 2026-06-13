package coze

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

type closeNotifyRecorder struct {
	*httptest.ResponseRecorder
	closed chan bool
}

func (c *closeNotifyRecorder) CloseNotify() <-chan bool { return c.closed }

func streamCtx() *gin.Context {
	gin.SetMode(gin.TestMode)
	rec := &closeNotifyRecorder{httptest.NewRecorder(), make(chan bool, 1)}
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v3/chat", nil)
	c.Set("coze_input_count", 10)
	return c
}

// coze 上游 completed 帧带 usage：采用上游。
func TestCozeStreamHandler_UpstreamUsage(t *testing.T) {
	sse := "event: conversation.message.delta\n" +
		`data: {"role":"assistant","type":"text","content":"\"Hello world\""}` + "\n\n" +
		"event: conversation.chat.completed\n" +
		`data: {"id":"chat_x","usage":{"token_count":15,"output_count":5,"input_count":10}}` + "\n\n"
	usage, apiErr := cozeChatStreamHandler(streamCtx(), streamInfo("coze-bot"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 5, usage.CompletionTokens, "应采用上游 completed 的 output_count")
}

// coze 无 completed usage：本地估算 > 0，prompt 来自 coze_input_count。
func TestCozeStreamHandler_LocalFallback(t *testing.T) {
	sse := "event: conversation.message.delta\n" +
		`data: {"role":"assistant","type":"text","content":"\"Hello world this is a fairly long coze generated answer\""}` + "\n\n"
	usage, apiErr := cozeChatStreamHandler(streamCtx(), streamInfo("coze-bot"), sseResp(sse))
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Greater(t, usage.CompletionTokens, 0)
	require.Equal(t, 10, usage.PromptTokens, "prompt 应来自 coze_input_count")
}
