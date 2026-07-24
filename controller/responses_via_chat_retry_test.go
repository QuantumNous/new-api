package controller

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relayopenai "github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestResponsesViaChatRetriesRateLimitErrorBeforeOutput(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	oldRanges := operation_setting.AutomaticRetryStatusCodeRanges
	constant.StreamingTimeout = 30
	operation_setting.AutomaticRetryStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: 429, End: 429}}
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
		operation_setting.AutomaticRetryStatusCodeRanges = oldRanges
	})

	body := "data: {\"error\":{\"message\":\"rate limited\",\"type\":\"rate_limit_error\",\"code\":\"rate_limit_exceeded\"}}\n\n"
	c, recorder, resp, info := newResponsesViaChatRetryContext(body)

	usage, relayErr := relayopenai.OaiChatToResponsesStreamHandler(c, info, resp)
	require.Nil(t, usage)
	require.NotNil(t, relayErr)
	require.Equal(t, http.StatusTooManyRequests, relayErr.StatusCode)
	require.Zero(t, recorder.Body.Len())
	require.True(t, shouldRetry(c, relayErr, 1))
}

func TestResponsesViaChatDoesNotRetryRateLimitAfterOutput(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	oldRanges := operation_setting.AutomaticRetryStatusCodeRanges
	constant.StreamingTimeout = 30
	operation_setting.AutomaticRetryStatusCodeRanges = []operation_setting.StatusCodeRange{{Start: 429, End: 429}}
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
		operation_setting.AutomaticRetryStatusCodeRanges = oldRanges
	})

	body := strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"test-model","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}`,
		`data: {"error":{"message":"rate limited","type":"rate_limit_error","code":"rate_limit_exceeded"}}`,
		``,
	}, "\n")
	c, recorder, resp, info := newResponsesViaChatRetryContext(body)

	usage, relayErr := relayopenai.OaiChatToResponsesStreamHandler(c, info, resp)
	require.Nil(t, usage)
	require.NotNil(t, relayErr)
	require.Equal(t, http.StatusOK, relayErr.StatusCode)
	require.NotZero(t, recorder.Body.Len())
	require.False(t, shouldRetry(c, relayErr, 1))
}

func newResponsesViaChatRetryContext(body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "test-model"},
		IsStream:    true,
		RelayFormat: types.RelayFormatOpenAI,
		DisablePing: true,
	}
	return c, recorder, resp, info
}
