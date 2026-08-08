package claude

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Non-streaming: a Claude Messages response routed from /v1/responses must be
// converted to OpenAI Responses JSON on the wire.
func TestHandleClaudeResponseData_ConvertsToResponsesFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAIResponses,
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "claude-test"},
	}
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}

	data := []byte(`{
		"id": "msg_123",
		"type": "message",
		"role": "assistant",
		"model": "claude-test",
		"content": [{"type": "text", "text": "ok"}],
		"stop_reason": "end_turn",
		"usage": {"input_tokens": 10, "output_tokens": 5}
	}`)

	httpResp := &http.Response{StatusCode: http.StatusOK, Header: http.Header{}}
	err := HandleClaudeResponseData(c, info, claudeInfo, httpResp, data)
	require.Nil(t, err)

	var resp dto.OpenAIResponsesResponse
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp), "body should be Responses JSON, got: %s", w.Body.String())
	assert.Equal(t, "response", resp.Object)
	assert.NotEmpty(t, resp.ID, "response ID should be set")

	// converted output items: the Claude text block becomes an output_text message
	var outputText string
	for _, item := range resp.Output {
		for _, content := range item.Content {
			if content.Type == "output_text" {
				outputText += content.Text
			}
		}
	}
	assert.Equal(t, "ok", outputText, "Claude text should be converted to output_text")

	// usage: input 10 + output 5 = 15 total tokens
	require.NotNil(t, resp.Usage, "usage should be populated")
	assert.Equal(t, 10, resp.Usage.PromptTokens)
	assert.Equal(t, 5, resp.Usage.CompletionTokens)
	assert.Equal(t, 15, resp.Usage.TotalTokens)
}

// Streaming: a Claude SSE stream routed from /v1/responses must be converted to
// OpenAI Responses SSE events.
func TestClaudeResponsesStreamHandler_EmitsResponsesSSE(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() { constant.StreamingTimeout = oldStreamingTimeout })
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	sse := "event: message_start\n" +
		"data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"model\":\"claude-test\",\"usage\":{\"input_tokens\":10,\"output_tokens\":0}}}\n\n" +
		"event: content_block_start\n" +
		"data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n" +
		"event: content_block_delta\n" +
		"data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"ok\"}}\n\n" +
		"event: content_block_stop\n" +
		"data: {\"type\":\"content_block_stop\",\"index\":0}\n\n" +
		"event: message_delta\n" +
		"data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"input_tokens\":10,\"output_tokens\":5}}\n\n" +
		"event: message_stop\n" +
		"data: {\"type\":\"message_stop\"}\n\n"

	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAIResponses,
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "claude-test"},
	}
	httpResp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader(sse)),
	}

	usage, err := ClaudeResponsesStreamHandler(c, info, httpResp)
	require.Nil(t, err)
	require.NotNil(t, usage)

	// Parse the emitted Responses SSE stream and assert the converted contract:
	// a response.created carrying the response ID, output_text deltas that join to
	// the Claude text, and a terminal response.completed with final usage. Event
	// positions are recorded so ordering can be asserted as well.
	var (
		createdID    string
		deltaText    strings.Builder
		finalUsage   *dto.Usage
		createdIndex = -1
		deltaIndex   = -1
		doneIndex    = -1
	)
	eventIndex := 0
	for _, block := range strings.Split(w.Body.String(), "\n\n") {
		var eventType, dataLine string
		for _, line := range strings.Split(block, "\n") {
			if rest, ok := strings.CutPrefix(line, "event: "); ok {
				eventType = rest
			}
			if rest, ok := strings.CutPrefix(line, "data: "); ok {
				dataLine = rest
			}
		}
		if dataLine == "" {
			continue
		}
		var payload map[string]any
		require.NoError(t, common.Unmarshal([]byte(dataLine), &payload), "SSE data should be JSON: %s", dataLine)

		switch eventType {
		case "response.created":
			if createdIndex == -1 {
				createdIndex = eventIndex
			}
			if respObj, ok := payload["response"].(map[string]any); ok {
				createdID, _ = respObj["id"].(string)
			}
		case "response.output_text.delta":
			deltaIndex = eventIndex
			if d, ok := payload["delta"].(string); ok {
				deltaText.WriteString(d)
			}
		case "response.completed":
			doneIndex = eventIndex
			if respObj, ok := payload["response"].(map[string]any); ok {
				if u, ok := respObj["usage"].(map[string]any); ok {
					b, mErr := common.Marshal(u)
					require.NoError(t, mErr)
					var uu dto.Usage
					require.NoError(t, common.Unmarshal(b, &uu))
					finalUsage = &uu
				}
			}
		}
		eventIndex++
	}

	assert.NotEqual(t, -1, createdIndex, "should emit response.created")
	assert.NotEmpty(t, createdID, "response.created should carry the response ID")
	assert.NotEqual(t, -1, deltaIndex, "should emit response.output_text.delta")
	assert.Equal(t, "ok", deltaText.String(), "text deltas should join to the Claude text")
	assert.NotEqual(t, -1, doneIndex, "should emit a terminal response.completed")
	require.NotNil(t, finalUsage, "response.completed should carry usage")
	assert.Equal(t, 10, finalUsage.PromptTokens)
	assert.Equal(t, 5, finalUsage.CompletionTokens)
	assert.Equal(t, 15, finalUsage.TotalTokens)

	// ordering: created precedes the output deltas; completed follows them
	assert.Less(t, createdIndex, deltaIndex, "response.created should precede output events")
	assert.Greater(t, doneIndex, deltaIndex, "response.completed should follow output events")
}
