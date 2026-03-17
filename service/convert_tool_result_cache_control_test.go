package service

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestClaudeToOpenAIRequest_ToolResultCacheControl(t *testing.T) {
	t.Parallel()

	cacheControl := json.RawMessage(`{"type":"ephemeral"}`)
	claudeRequest := dto.ClaudeRequest{
		Model: "claude-3",
		Messages: []dto.ClaudeMessage{
			{
				Role: "user",
				Content: []dto.ClaudeMediaMessage{
					{
						Type:         "tool_result",
						Name:         "exec",
						ToolUseId:    "tool-1",
						Content:      "ok",
						CacheControl: cacheControl,
					},
				},
			},
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:      constant.ChannelTypeOpenRouter,
			UpstreamModelName: "anthropic/claude-3",
		},
	}

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, info)
	require.NoError(t, err)
	require.Len(t, openAIRequest.Messages, 1)

	toolMsg := openAIRequest.Messages[0]
	require.Equal(t, "tool", toolMsg.Role)
	require.Equal(t, "tool-1", toolMsg.ToolCallId)
	require.False(t, toolMsg.IsStringContent())

	contentArr, ok := toolMsg.Content.([]any)
	require.True(t, ok)
	require.Len(t, contentArr, 1)
	contentMap, ok := contentArr[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "text", contentMap["type"])
	require.Equal(t, "ok", contentMap["text"])
	cacheControlRaw, ok := contentMap["cache_control"].(json.RawMessage)
	require.True(t, ok)
	require.JSONEq(t, `{"type":"ephemeral"}`, string(cacheControlRaw))
}
