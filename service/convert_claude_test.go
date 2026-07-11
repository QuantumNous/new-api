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

func newClaudeRelayInfo(channelType int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channelType},
	}
}

func parseClaudeRequest(t *testing.T, body string) dto.ClaudeRequest {
	t.Helper()
	var claudeRequest dto.ClaudeRequest
	require.NoError(t, common.UnmarshalJsonStr(body, &claudeRequest))
	return claudeRequest
}

// Regression test for #5982: text-only content block arrays must be merged
// into a string content, and Anthropic-specific cache_control must not leak
// to generic OpenAI-compatible upstreams.
func TestClaudeToOpenAIRequestMergesTextBlocksForOpenAICompatible(t *testing.T) {
	claudeRequest := parseClaudeRequest(t, `{
		"model": "glm-4.5",
		"max_tokens": 64,
		"messages": [
			{
				"role": "user",
				"content": [
					{"type": "text", "text": "只回复 "},
					{"type": "text", "text": "OK", "cache_control": {"type": "ephemeral"}}
				]
			}
		]
	}`)

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, newClaudeRelayInfo(constant.ChannelTypeOpenAI))
	require.NoError(t, err)
	require.Len(t, openAIRequest.Messages, 1)

	message := openAIRequest.Messages[0]
	assert.Equal(t, "user", message.Role)
	require.True(t, message.IsStringContent())
	assert.Equal(t, "只回复 OK", message.StringContent())

	encoded, err := common.Marshal(openAIRequest)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "cache_control")
}

func TestClaudeToOpenAIRequestKeepsContentPartsForMultimodal(t *testing.T) {
	claudeRequest := parseClaudeRequest(t, `{
		"model": "glm-4.5",
		"max_tokens": 64,
		"messages": [
			{
				"role": "user",
				"content": [
					{"type": "text", "text": "看图", "cache_control": {"type": "ephemeral"}},
					{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "iVBORw0KGgo="}}
				]
			}
		]
	}`)

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, newClaudeRelayInfo(constant.ChannelTypeOpenAI))
	require.NoError(t, err)
	require.Len(t, openAIRequest.Messages, 1)

	message := openAIRequest.Messages[0]
	require.False(t, message.IsStringContent())
	mediaContents, ok := message.Content.([]dto.MediaContent)
	require.True(t, ok)
	require.Len(t, mediaContents, 2)
	assert.Equal(t, dto.ContentTypeText, mediaContents[0].Type)
	assert.Empty(t, mediaContents[0].CacheControl)
	assert.Equal(t, dto.ContentTypeImageURL, mediaContents[1].Type)
}

func TestClaudeToOpenAIRequestPreservesCacheControlForOpenRouter(t *testing.T) {
	claudeRequest := parseClaudeRequest(t, `{
		"model": "anthropic/claude-sonnet-4",
		"max_tokens": 64,
		"messages": [
			{
				"role": "user",
				"content": [
					{"type": "text", "text": "只回复 "},
					{"type": "text", "text": "OK", "cache_control": {"type": "ephemeral"}}
				]
			}
		]
	}`)

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, newClaudeRelayInfo(constant.ChannelTypeOpenRouter))
	require.NoError(t, err)
	require.Len(t, openAIRequest.Messages, 1)

	message := openAIRequest.Messages[0]
	require.False(t, message.IsStringContent())
	mediaContents, ok := message.Content.([]dto.MediaContent)
	require.True(t, ok)
	require.Len(t, mediaContents, 2)
	assert.Empty(t, mediaContents[0].CacheControl)
	assert.JSONEq(t, `{"type": "ephemeral"}`, string(mediaContents[1].CacheControl))
}
