package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestClaudeToOpenAIRequestPreservesThinkingForDeepSeekV4(t *testing.T) {
	info := &relaycommon.RelayInfo{
		OriginModelName: "deepseek-v4-flash",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "deepseek-v4-flash",
		},
	}
	req := dto.ClaudeRequest{
		Model: "deepseek-v4-flash",
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []dto.ClaudeMediaMessage{
					{
						Type:     "thinking",
						Thinking: common.GetPointer("checked context"),
					},
					{
						Type: "text",
						Text: common.GetPointer("I will call the tool."),
					},
					{
						Type:  "tool_use",
						Id:    "toolu_1",
						Name:  "search",
						Input: map[string]any{"query": "deepseek"},
					},
				},
			},
		},
	}

	converted, err := ClaudeToOpenAIRequest(req, info)
	require.NoError(t, err)
	require.Len(t, converted.Messages, 1)
	require.Equal(t, "checked context", converted.Messages[0].GetReasoningContent())
	require.Len(t, converted.Messages[0].ParseToolCalls(), 1)
}

func TestClaudeToOpenAIRequestDropsThinkingForOtherModels(t *testing.T) {
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4.1",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4.1",
		},
	}
	req := dto.ClaudeRequest{
		Model: "gpt-4.1",
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []dto.ClaudeMediaMessage{
					{
						Type:     "thinking",
						Thinking: common.GetPointer("internal reasoning"),
					},
					{
						Type: "text",
						Text: common.GetPointer("visible answer"),
					},
				},
			},
		},
	}

	converted, err := ClaudeToOpenAIRequest(req, info)
	require.NoError(t, err)
	require.Len(t, converted.Messages, 1)
	require.Empty(t, converted.Messages[0].GetReasoningContent())
	require.Len(t, converted.Messages[0].ParseContent(), 1)
	require.Equal(t, "visible answer", converted.Messages[0].ParseContent()[0].Text)
}
