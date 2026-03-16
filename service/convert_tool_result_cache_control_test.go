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

	content := toolMsg.ParseContent()
	require.Len(t, content, 1)
	require.Equal(t, "text", content[0].Type)
	require.Equal(t, "ok", content[0].Text)
	require.JSONEq(t, `{"type":"ephemeral"}`, string(content[0].CacheControl))
}
