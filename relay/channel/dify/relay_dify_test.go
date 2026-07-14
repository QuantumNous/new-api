package dify

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDifyStreamHandlerBackfillsUsageBeforeMidStreamError ensures delivered
// text remains billable when Dify emits an error before message_end usage.
func TestDifyStreamHandlerBackfillsUsageBeforeMidStreamError(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"event":"message","answer":"partial"}`,
			`data: {"event":"error"}`,
			``,
		}, "\n"))),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "dify-test"},
		IsStream:    true,
		DisablePing: true,
	}
	info.SetEstimatePromptTokens(7)

	usage, apiErr := difyStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 7, usage.PromptTokens)
	assert.Greater(t, usage.CompletionTokens, 0)
	assert.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"error"`)
}
