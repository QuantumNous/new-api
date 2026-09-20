package openai

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleLastResponse_DropPureUsageChunk(t *testing.T) {
	data := `{"id":"chatcmpl-1","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	info := &relaycommon.RelayInfo{ShouldIncludeUsage: false}

	var responseId string
	var createAt int64
	var systemFingerprint string
	var model string
	var usage = &dto.Usage{}
	var containStreamUsage bool
	shouldSendLastResp := true

	err := handleLastResponse(data, &responseId, &createAt, &systemFingerprint, &model, &usage, &containStreamUsage, info, &shouldSendLastResp)
	require.NoError(t, err)
	assert.True(t, containStreamUsage)
	assert.False(t, shouldSendLastResp, "pure usage chunk with no choices should be dropped when client does not request usage")
	assert.Equal(t, 10, usage.PromptTokens)
	assert.Equal(t, 5, usage.CompletionTokens)
}

func TestHandleLastResponse_PreserveFinishReasonWithoutContent(t *testing.T) {
	// Standard OpenAI-compatible provider emitting terminal stop with empty delta alongside usage
	data := `{"id":"chatcmpl-1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	info := &relaycommon.RelayInfo{ShouldIncludeUsage: false}

	var responseId string
	var createAt int64
	var systemFingerprint string
	var model string
	var usage = &dto.Usage{}
	var containStreamUsage bool
	shouldSendLastResp := true

	err := handleLastResponse(data, &responseId, &createAt, &systemFingerprint, &model, &usage, &containStreamUsage, info, &shouldSendLastResp)
	require.NoError(t, err)
	assert.True(t, containStreamUsage)
	assert.True(t, shouldSendLastResp, "terminal chunk with finish_reason must be preserved even if delta content is empty")
}

func TestHandleLastResponse_PreserveToolCallsWithoutContent(t *testing.T) {
	// Provider emitting final tool call chunk with finish_reason and usage
	data := `{"id":"chatcmpl-1","choices":[{"index":0,"delta":{"tool_calls":[{"id":"call_1","type":"function","function":{"name":"search","arguments":"{}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	info := &relaycommon.RelayInfo{ShouldIncludeUsage: false}

	var responseId string
	var createAt int64
	var systemFingerprint string
	var model string
	var usage = &dto.Usage{}
	var containStreamUsage bool
	shouldSendLastResp := true

	err := handleLastResponse(data, &responseId, &createAt, &systemFingerprint, &model, &usage, &containStreamUsage, info, &shouldSendLastResp)
	require.NoError(t, err)
	assert.True(t, containStreamUsage)
	assert.True(t, shouldSendLastResp, "chunk with tool_calls must be preserved even when usage is present and client did not request usage")
}

func TestHandleLastResponse_MiniMaxStyleMessageWithFinishReason(t *testing.T) {
	// MiniMax-style upstream emitting `message` instead of `delta` in the final usage frame
	data := `{"id":"chatcmpl-1","choices":[{"index":0,"message":{"role":"assistant","content":"Done"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	info := &relaycommon.RelayInfo{ShouldIncludeUsage: false}

	var responseId string
	var createAt int64
	var systemFingerprint string
	var model string
	var usage = &dto.Usage{}
	var containStreamUsage bool
	shouldSendLastResp := true

	err := handleLastResponse(data, &responseId, &createAt, &systemFingerprint, &model, &usage, &containStreamUsage, info, &shouldSendLastResp)
	require.NoError(t, err)
	assert.True(t, containStreamUsage)
	assert.True(t, shouldSendLastResp, "MiniMax frame with finish_reason must be preserved")
}

func TestHandleLastResponse_PreserveDeltaContent(t *testing.T) {
	data := `{"id":"chatcmpl-1","choices":[{"index":0,"delta":{"content":"world"},"finish_reason":null}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	info := &relaycommon.RelayInfo{ShouldIncludeUsage: false}

	var responseId string
	var createAt int64
	var systemFingerprint string
	var model string
	var usage = &dto.Usage{}
	var containStreamUsage bool
	shouldSendLastResp := true

	err := handleLastResponse(data, &responseId, &createAt, &systemFingerprint, &model, &usage, &containStreamUsage, info, &shouldSendLastResp)
	require.NoError(t, err)
	assert.True(t, containStreamUsage)
	assert.True(t, shouldSendLastResp, "chunk with content must be preserved")
}
