package openai

import (
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	claudeFinalizeChunkText = `{"id":"c1","object":"chat.completion.chunk","model":"m","choices":[{"index":0,"delta":{"role":"assistant","content":"hi"}}]}`
	// finish_reason without usage: the converter defers the terminal events.
	claudeFinalizeChunkFinishNoUsage = `{"id":"c1","object":"chat.completion.chunk","model":"m","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`
	// trailing chunk with non-empty choices, no finish_reason and no usage —
	// seen on DashScope-style gateways after the finish_reason chunk.
	claudeFinalizeChunkTrailingSilent = `{"id":"c1","object":"chat.completion.chunk","model":"m","choices":[{"index":0,"delta":{}}]}`
	// healthy upstream: the finish_reason chunk itself carries usage.
	claudeFinalizeChunkFinishWithUsage = `{"id":"c1","object":"chat.completion.chunk","model":"m","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}`
)

func countClaudeEvent(body, event string) int {
	return strings.Count(body, "event: "+event+"\n")
}

// Regression: when an OpenAI-chat upstream ends without a usable usage frame,
// HandleFinalResponse closed the converted Claude stream without the terminal
// message_delta/message_stop events and clients saw a dropped connection.
func TestHandleFinalResponseFinalizesOpenAIChatClaudeStream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/messages", nil)

	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}
	info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "m"}

	// Mirror the relay loop: chunks are converted lagging one frame, the last
	// chunk is handled by HandleFinalResponse.
	for _, chunk := range []string{claudeFinalizeChunkText, claudeFinalizeChunkFinishNoUsage} {
		require.NoError(t, HandleStreamFormat(c, info, chunk, false, false))
	}
	HandleFinalResponse(c, info, claudeFinalizeChunkTrailingSilent, "c1", 0, "m", "", &dto.Usage{}, false)

	body := w.Body.String()
	assert.Equal(t, 1, countClaudeEvent(body, "message_delta"), "stream must end with exactly one message_delta:\n%s", body)
	assert.Equal(t, 1, countClaudeEvent(body, "message_stop"), "stream must end with exactly one message_stop:\n%s", body)
	assert.True(t, info.ClaudeConvertInfo.Done)
}

func TestHandleFinalResponseDoesNotDuplicateTerminalEvents(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/messages", nil)

	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}
	info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "m"}

	require.NoError(t, HandleStreamFormat(c, info, claudeFinalizeChunkText, false, false))
	HandleFinalResponse(c, info, claudeFinalizeChunkFinishWithUsage, "c1", 0, "m", "", &dto.Usage{}, true)

	body := w.Body.String()
	assert.Equal(t, 1, countClaudeEvent(body, "message_delta"), "healthy streams must not get a second message_delta:\n%s", body)
	assert.Equal(t, 1, countClaudeEvent(body, "message_stop"), "healthy streams must not get a second message_stop:\n%s", body)
}
