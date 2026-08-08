package claude

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp), "body should be Responses JSON, got: %s", w.Body.String())
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
	// the Claude text, and a terminal response.completed with final usage.
	var (
		createdID  string
		deltaText  strings.Builder
		sawDelta   bool
		completed  bool
		finalUsage *dto.Usage
		sawCreated bool
	)
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
		require.NoError(t, json.Unmarshal([]byte(dataLine), &payload), "SSE data should be JSON: %s", dataLine)

		switch eventType {
		case "response.created":
			sawCreated = true
			if respObj, ok := payload["response"].(map[string]any); ok {
				createdID, _ = respObj["id"].(string)
			}
		case "response.output_text.delta":
			sawDelta = true
			if d, ok := payload["delta"].(string); ok {
				deltaText.WriteString(d)
			}
		case "response.completed":
			completed = true
			if respObj, ok := payload["response"].(map[string]any); ok {
				if u, ok := respObj["usage"].(map[string]any); ok {
					b, _ := json.Marshal(u)
					var uu dto.Usage
					if json.Unmarshal(b, &uu) == nil {
						finalUsage = &uu
					}
				}
			}
		}
	}

	assert.True(t, sawCreated, "should emit response.created")
	assert.NotEmpty(t, createdID, "response.created should carry the response ID")
	assert.True(t, sawDelta, "should emit response.output_text.delta")
	assert.Equal(t, "ok", deltaText.String(), "text deltas should join to the Claude text")
	assert.True(t, completed, "should emit a terminal response.completed")
	require.NotNil(t, finalUsage, "response.completed should carry usage")
	assert.Equal(t, 10, finalUsage.PromptTokens)
	assert.Equal(t, 5, finalUsage.CompletionTokens)
}
