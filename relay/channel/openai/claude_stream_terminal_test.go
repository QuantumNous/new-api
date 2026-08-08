package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOaiStreamHandlerFinalizesClaudeStreamWithoutTerminalChunk(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"coding-deepseek","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"coding-deepseek","choices":[{"index":0,"delta":{"reasoning_content":"thinking"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"coding-deepseek","choices":[{"index":0,"delta":{"content":"XAG_OK"},"finish_reason":null}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	c.Set(common.RequestIdKey, "claude-terminal-test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "coding-deepseek",
		},
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatClaude,
		DisablePing: true,
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeNone,
		},
	}

	usage, relayErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, relayErr)
	require.NotNil(t, usage)

	got := recorder.Body.String()
	assert.Equal(t, 1, strings.Count(got, "event: message_start\n"))
	assert.Equal(t, 2, strings.Count(got, "event: content_block_stop\n"))
	assert.Equal(t, 1, strings.Count(got, "event: message_delta\n"))
	assert.Equal(t, 1, strings.Count(got, "event: message_stop\n"))
	assert.Contains(t, got, `"text":"XAG_OK"`)
	assert.Contains(t, got, `"stop_reason":"end_turn"`)
	requireOrderedSubstrings(t, got,
		"event: message_start\n",
		`"type":"thinking_delta"`,
		"event: content_block_stop\n",
		`"type":"text_delta","text":"XAG_OK"`,
		"event: content_block_stop\n",
		"event: message_delta\n",
		"event: message_stop\n",
	)
}
