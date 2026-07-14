package baidu

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestBaiduStreamHandlerTreatsIsEndFollowedByEOFAsDone(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body: io.NopCloser(strings.NewReader(
			`data: {"id":"chat-1","object":"chat.completion","created":1,"result":"ok","is_end":true,"usage":{"prompt_tokens":1,"total_tokens":2}}` + "\n\n",
		)),
	}
	info := &common.RelayInfo{
		ChannelMeta: &common.ChannelMeta{UpstreamModelName: "ernie-test"},
		IsStream:    true,
		DisablePing: true,
	}

	apiErr, usage := baiduStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, 1, usage.PromptTokens)
	require.Equal(t, 1, usage.CompletionTokens)
	require.Equal(t, 2, usage.TotalTokens)
	require.NotNil(t, info.StreamStatus)
	require.Equal(t, common.StreamEndReasonDone, info.StreamStatus.EndReason)
	require.False(t, info.StreamStatus.HasErrors())
	require.Contains(t, recorder.Body.String(), `"finish_reason":"stop"`)
	require.NotContains(t, recorder.Body.String(), `"error"`)
}
