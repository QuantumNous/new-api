package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Regression test for #5922: reasoning effort from a Claude-format request
// (output_config.effort) must be forwarded as reasoning_effort when converting
// to an OpenAI-format upstream request.
func TestClaudeToOpenAIRequestForwardsEffortAsReasoningEffort(t *testing.T) {
	var claudeRequest dto.ClaudeRequest
	require.NoError(t, common.UnmarshalJsonStr(`{
		"model": "gpt-5.2",
		"max_tokens": 64,
		"output_config": {"effort": "high"},
		"messages": [
			{"role": "user", "content": "hi"}
		]
	}`, &claudeRequest))

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI},
	}
	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, info)
	require.NoError(t, err)
	assert.Equal(t, "high", openAIRequest.ReasoningEffort)

	encoded, err := common.Marshal(openAIRequest)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"reasoning_effort":"high"`)
}

func TestClaudeToOpenAIRequestWithoutEffortLeavesReasoningEffortEmpty(t *testing.T) {
	var claudeRequest dto.ClaudeRequest
	require.NoError(t, common.UnmarshalJsonStr(`{
		"model": "gpt-5.2",
		"max_tokens": 64,
		"messages": [
			{"role": "user", "content": "hi"}
		]
	}`, &claudeRequest))

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI},
	}
	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, info)
	require.NoError(t, err)
	assert.Empty(t, openAIRequest.ReasoningEffort)

	encoded, err := common.Marshal(openAIRequest)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "reasoning_effort")
}

// OpenRouter conversion keeps its existing effort mapping and must not gain
// a duplicate reasoning_effort field from this fix.
func TestClaudeToOpenAIRequestOpenRouterEffortMappingUnchanged(t *testing.T) {
	var claudeRequest dto.ClaudeRequest
	require.NoError(t, common.UnmarshalJsonStr(`{
		"model": "anthropic/claude-sonnet-4",
		"max_tokens": 64,
		"output_config": {"effort": "high"},
		"messages": [
			{"role": "user", "content": "hi"}
		]
	}`, &claudeRequest))

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenRouter},
	}
	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, info)
	require.NoError(t, err)
	assert.Empty(t, openAIRequest.ReasoningEffort)
	assert.Equal(t, `"high"`, string(openAIRequest.Verbosity))
}
