package ollama

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newOllamaStreamTestContext(t *testing.T, format types.RelayFormat) (*gin.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{
		IsStream:           true,
		RelayMode:          relayconstant.RelayModeChatCompletions,
		RelayFormat:        format,
		ShouldIncludeUsage: false,
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "llama3",
		},
	}
	info.SetEstimatePromptTokens(3)

	return ctx, recorder, info
}

func newOllamaStreamResponse() *http.Response {
	body := strings.Join([]string{
		`{"model":"llama3","created_at":"2026-06-07T00:00:00Z","message":{"role":"assistant","content":"hello"},"done":false}`,
		`{"model":"llama3","created_at":"2026-06-07T00:00:01Z","done":true,"done_reason":"stop","prompt_eval_count":3,"eval_count":2}`,
		"",
	}, "\n")

	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestOllamaStreamHandlerConvertsClaudeFormat(t *testing.T) {
	ctx, recorder, info := newOllamaStreamTestContext(t, types.RelayFormatClaude)

	usage, apiErr := ollamaStreamHandler(ctx, info, newOllamaStreamResponse())

	require.Nil(t, apiErr)
	require.Equal(t, 3, usage.PromptTokens)
	require.Equal(t, 2, usage.CompletionTokens)
	require.Equal(t, 5, usage.TotalTokens)

	body := recorder.Body.String()
	require.Contains(t, body, "event: message_start")
	require.Contains(t, body, "event: content_block_start")
	require.Contains(t, body, "event: content_block_delta")
	require.Contains(t, body, `"type":"text_delta"`)
	require.Contains(t, body, `"text":"hello"`)
	require.Contains(t, body, "event: message_delta")
	require.Contains(t, body, "event: message_stop")
	require.NotContains(t, body, `"object":"chat.completion.chunk"`)
	require.NotContains(t, body, "data: [DONE]")
}

func TestOllamaStreamHandlerKeepsOpenAIFormat(t *testing.T) {
	ctx, recorder, info := newOllamaStreamTestContext(t, types.RelayFormatOpenAI)

	usage, apiErr := ollamaStreamHandler(ctx, info, newOllamaStreamResponse())

	require.Nil(t, apiErr)
	require.Equal(t, 5, usage.TotalTokens)

	body := recorder.Body.String()
	require.Contains(t, body, `"object":"chat.completion.chunk"`)
	require.Contains(t, body, `"content":"hello"`)
	require.Contains(t, body, "data: [DONE]")
	require.NotContains(t, body, "event: message_start")
}
