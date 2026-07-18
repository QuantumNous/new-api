package claude

import (
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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/gin-gonic/gin"
)

func TestAdaptorDoResponseBuffersClaudeStreamForNonStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	clientStream := false
	info := &relaycommon.RelayInfo{
		Request: &dto.ClaudeRequest{
			Stream: &clientStream,
		},
		RelayFormat: types.RelayFormatClaude,
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-test",
		},
	}
	sse := strings.Join([]string{
		`event: message_start`,
		`data: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","model":"claude-test","content":[],"usage":{"input_tokens":11,"cache_creation_input_tokens":2,"cache_read_input_tokens":3,"output_tokens":1}}}`,
		``,
		`event: content_block_start`,
		`data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}`,
		``,
		`event: content_block_delta`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"consider"}}`,
		``,
		`event: content_block_delta`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig"}}`,
		``,
		`event: content_block_stop`,
		`data: {"type":"content_block_stop","index":0}`,
		``,
		`event: content_block_start`,
		`data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}`,
		``,
		`event: content_block_delta`,
		`data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"OK"}}`,
		``,
		`event: content_block_stop`,
		`data: {"type":"content_block_stop","index":1}`,
		``,
		`event: content_block_start`,
		`data: {"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"tool_1","name":"lookup","input":{}}}`,
		``,
		`event: content_block_delta`,
		`data: {"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{\"city\":"}}`,
		``,
		`event: content_block_delta`,
		`data: {"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"\"Paris\"}"}}`,
		``,
		`event: content_block_stop`,
		`data: {"type":"content_block_stop","index":2}`,
		``,
		`event: message_delta`,
		`data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":9}}`,
		``,
		`event: message_stop`,
		`data: {"type":"message_stop"}`,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"text/event-stream"},
		},
		Body: io.NopCloser(strings.NewReader(sse)),
	}

	usageValue, apiErr := (&Adaptor{}).DoResponse(c, resp, info)
	require.Nil(t, apiErr)
	usage, ok := usageValue.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 9, usage.CompletionTokens)
	assert.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))
	assert.False(t, info.IsStream)

	var response dto.ClaudeResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	var responseObject map[string]interface{}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &responseObject))
	stopSequence, exists := responseObject["stop_sequence"]
	assert.True(t, exists)
	assert.Nil(t, stopSequence)
	assert.Equal(t, "msg_test", response.Id)
	assert.Equal(t, "message", response.Type)
	assert.Equal(t, "assistant", response.Role)
	assert.Equal(t, "claude-test", response.Model)
	assert.Equal(t, "tool_use", response.StopReason)
	require.Len(t, response.Content, 3)
	assert.Equal(t, "thinking", response.Content[0].Type)
	require.NotNil(t, response.Content[0].Thinking)
	assert.Equal(t, "consider", *response.Content[0].Thinking)
	assert.Equal(t, "sig", response.Content[0].Signature)
	assert.Equal(t, "text", response.Content[1].Type)
	assert.Equal(t, "OK", response.Content[1].GetText())
	assert.Equal(t, "tool_use", response.Content[2].Type)
	assert.Equal(t, "tool_1", response.Content[2].Id)
	assert.Equal(t, "lookup", response.Content[2].Name)
	assert.Equal(t, map[string]interface{}{"city": "Paris"}, response.Content[2].Input)
	require.NotNil(t, response.Usage)
	assert.Equal(t, 11, response.Usage.InputTokens)
	assert.Equal(t, 2, response.Usage.CacheCreationInputTokens)
	assert.Equal(t, 3, response.Usage.CacheReadInputTokens)
	assert.Equal(t, 9, response.Usage.OutputTokens)
}

func TestAdaptorDoResponseKeepsClaudeStreamForStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = previousStreamingTimeout
	})
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	clientStream := true
	info := &relaycommon.RelayInfo{
		Request: &dto.ClaudeRequest{
			Stream: &clientStream,
		},
		RelayFormat: types.RelayFormatClaude,
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-test",
		},
	}
	sse := strings.Join([]string{
		`data: {"type":"message_start","message":{"id":"msg_stream","type":"message","role":"assistant","model":"claude-test","content":[],"usage":{"input_tokens":1,"output_tokens":1}}}`,
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}`,
		`data: {"type":"message_stop"}`,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"text/event-stream"},
		},
		Body: io.NopCloser(strings.NewReader(sse)),
	}

	_, apiErr := (&Adaptor{}).DoResponse(c, resp, info)
	require.Nil(t, apiErr)
	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	assert.True(t, info.IsStream)
	assert.Contains(t, recorder.Body.String(), `"type":"message_start"`)
}
