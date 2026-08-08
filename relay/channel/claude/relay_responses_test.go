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

	body := w.Body.String()
	assert.Contains(t, body, "response.created")
	assert.Contains(t, body, "response.output_text.delta")
}
