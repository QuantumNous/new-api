package openai

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func buildResponsesSSE(t *testing.T, events ...dto.ResponsesStreamResponse) io.Reader {
	t.Helper()

	var body strings.Builder
	for _, event := range events {
		data, err := common.Marshal(event)
		require.NoError(t, err)
		fmt.Fprintf(&body, "data: %s\n\n", data)
	}
	body.WriteString("data: [DONE]\n")
	return strings.NewReader(body.String())
}

func newClaudeResponsesStreamTestContext(t *testing.T, body io.Reader) (*gin.Context, *http.Response, *relaycommon.RelayInfo, *httptest.ResponseRecorder) {
	t.Helper()

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	c.Set(common.RequestIdKey, "test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(body),
		Header:     make(http.Header),
	}

	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4.1",
		},
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
	}

	return c, resp, info, recorder
}

func TestOaiResponsesToChatStreamHandler_ClaudeEmitsFinalStopEventsForText(t *testing.T) {
	t.Parallel()

	body := buildResponsesSSE(t,
		dto.ResponsesStreamResponse{
			Type:  "response.output_text.delta",
			Delta: "hello",
		},
		dto.ResponsesStreamResponse{
			Type: "response.completed",
			Response: &dto.OpenAIResponsesResponse{
				Model:     "gpt-4.1",
				CreatedAt: 1710000000,
				Usage: &dto.Usage{
					InputTokens:  10,
					OutputTokens: 5,
					TotalTokens:  15,
				},
			},
		},
	)

	c, resp, info, recorder := newClaudeResponsesStreamTestContext(t, body)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)

	output := recorder.Body.String()
	require.Contains(t, output, "event: content_block_stop\n")
	require.Contains(t, output, "event: message_delta\n")
	require.Contains(t, output, "event: message_stop\n")
}

func TestOaiResponsesToChatStreamHandler_ClaudeEmitsFinalStopEventsAfterThinkingAndText(t *testing.T) {
	t.Parallel()

	body := buildResponsesSSE(t,
		dto.ResponsesStreamResponse{
			Type:  "response.reasoning_summary_text.delta",
			Delta: "thinking",
		},
		dto.ResponsesStreamResponse{
			Type:  "response.reasoning_summary_text.done",
			Delta: "",
		},
		dto.ResponsesStreamResponse{
			Type:  "response.output_text.delta",
			Delta: "answer",
		},
		dto.ResponsesStreamResponse{
			Type: "response.completed",
			Response: &dto.OpenAIResponsesResponse{
				Model:     "gpt-4.1",
				CreatedAt: 1710000001,
				Usage: &dto.Usage{
					InputTokens:  10,
					OutputTokens: 12,
					TotalTokens:  22,
				},
			},
		},
	)

	c, resp, info, recorder := newClaudeResponsesStreamTestContext(t, body)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)

	output := recorder.Body.String()
	require.Contains(t, output, "data: {\"type\":\"content_block_stop\",\"index\":0}")
	require.Contains(t, output, "data: {\"type\":\"content_block_stop\",\"index\":1}")
	require.Contains(t, output, "event: message_delta\n")
	require.Contains(t, output, "event: message_stop\n")
}
