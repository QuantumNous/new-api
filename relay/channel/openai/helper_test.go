package openai

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relay/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	claudeContentChunk = `{"id":"chatcmpl_1","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"hello"}}]}`
	claudeFinishChunk  = `{"id":"chatcmpl_1","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`
)

func newClaudeRelayContext(t *testing.T) (*gin.Context, *relaycommon.RelayInfo, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/v1/messages", nil)

	info, err := common.GenRelayInfo(ctx, types.RelayFormatClaude, &dto.GeneralOpenAIRequest{Model: "gpt-test"}, nil)
	require.NoError(t, err)
	return ctx, info, recorder
}

func countEvent(body string, eventType string) int {
	return strings.Count(body, "event: "+eventType+"\n")
}

// Issue #1428: an OpenAI-upstream stream that ends without delivering the
// terminal frame to the Anthropic client (finish chunk without usage still
// waiting for a usage-only frame) must be closed with message_delta +
// message_stop, without duplicating message_start.
func TestHandleFinalResponseSynthesizesClaudeStreamTerminator(t *testing.T) {
	ctx, info, recorder := newClaudeRelayContext(t)

	require.NoError(t, HandleStreamFormat(ctx, info, claudeContentChunk, false, false))
	require.NoError(t, HandleStreamFormat(ctx, info, claudeFinishChunk, false, false))

	usage := &dto.Usage{PromptTokens: 3, CompletionTokens: 2, TotalTokens: 5}
	HandleFinalResponse(ctx, info, claudeFinishChunk, "chatcmpl_1", 123, "gpt-test", "gpt-test", usage, true)

	body := recorder.Body.String()
	assert.Equal(t, 1, countEvent(body, "message_start"), "message_start must be emitted exactly once, body:\n%s", body)
	assert.Equal(t, 1, countEvent(body, "message_delta"))
	assert.Equal(t, 1, countEvent(body, "message_stop"))
	assert.Contains(t, body, `"stop_reason":"end_turn"`)
	assert.True(t, info.ClaudeConvertInfo.Done)
}

// A single-chunk stream (finish chunk only) still gets message_start plus the
// terminal events; the message_start heuristic no longer depends on the chunk
// counter.
func TestHandleFinalResponseSingleChunkStreamGetsFullFraming(t *testing.T) {
	ctx, info, recorder := newClaudeRelayContext(t)

	usage := &dto.Usage{PromptTokens: 3, CompletionTokens: 2, TotalTokens: 5}
	HandleFinalResponse(ctx, info, claudeFinishChunk, "chatcmpl_1", 123, "gpt-test", "gpt-test", usage, true)

	body := recorder.Body.String()
	assert.Equal(t, 1, countEvent(body, "message_start"), "body:\n%s", body)
	assert.Equal(t, 1, countEvent(body, "message_delta"))
	assert.Equal(t, 1, countEvent(body, "message_stop"))
}

// Normal termination already produced message_delta + message_stop from the
// finish chunk; the finalizer must not append a duplicate.
func TestHandleFinalResponseNoDuplicateTerminatorAfterDone(t *testing.T) {
	ctx, info, recorder := newClaudeRelayContext(t)

	finishWithUsage := `{"id":"chatcmpl_1","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}`
	require.NoError(t, HandleStreamFormat(ctx, info, claudeContentChunk, false, false))
	require.NoError(t, HandleStreamFormat(ctx, info, finishWithUsage, false, false))

	usage := &dto.Usage{PromptTokens: 3, CompletionTokens: 2, TotalTokens: 5}
	HandleFinalResponse(ctx, info, finishWithUsage, "chatcmpl_1", 123, "gpt-test", "gpt-test", usage, true)

	body := recorder.Body.String()
	assert.Equal(t, 1, countEvent(body, "message_start"), "body:\n%s", body)
	assert.Equal(t, 1, countEvent(body, "message_stop"), "body:\n%s", body)
}
