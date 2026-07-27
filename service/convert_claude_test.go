package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func claudeTool(name string) dto.Tool {
	return dto.Tool{
		Name: name,
		InputSchema: map[string]interface{}{
			"type": "object",
		},
	}
}

func claudeConversionRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
	}
}

func TestClaudeToOpenAIRequestToolChoice(t *testing.T) {
	tests := []struct {
		name              string
		choice            any
		wantChoice        any
		wantParallelTools *bool
	}{
		{
			name:       "auto",
			choice:     map[string]any{"type": "auto"},
			wantChoice: "auto",
		},
		{
			name:       "any becomes required",
			choice:     map[string]any{"type": "any"},
			wantChoice: "required",
		},
		{
			name:       "none",
			choice:     map[string]any{"type": "none"},
			wantChoice: "none",
		},
		{
			name: "specific tool",
			choice: map[string]any{
				"type": "tool",
				"name": "Bash",
			},
			wantChoice: map[string]any{
				"type": "function",
				"function": map[string]any{
					"name": "Bash",
				},
			},
		},
		{
			name: "disable parallel tools",
			choice: map[string]any{
				"type":                      "auto",
				"disable_parallel_tool_use": true,
			},
			wantChoice:        "auto",
			wantParallelTools: func() *bool { value := false; return &value }(),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request, err := ClaudeToOpenAIRequest(dto.ClaudeRequest{
				Model:      "glm-5.2",
				Stream:     func() *bool { value := true; return &value }(),
				Tools:      []dto.Tool{claudeTool("Bash")},
				ToolChoice: test.choice,
			}, claudeConversionRelayInfo())

			require.NoError(t, err)
			require.Equal(t, test.wantChoice, request.ToolChoice)
			require.Equal(t, test.wantParallelTools, request.ParallelTooCalls)
		})
	}
}

func TestClaudeToOpenAIRequestDoesNotInferProviderToolStreamCapability(t *testing.T) {
	stream := true
	request, err := ClaudeToOpenAIRequest(dto.ClaudeRequest{
		Model:  "GLM-5.2",
		Stream: &stream,
		Tools:  []dto.Tool{claudeTool("Bash")},
	}, claudeConversionRelayInfo())

	require.NoError(t, err)
	require.Nil(t, request.ToolStream)
}

func TestStreamResponseOpenAI2ClaudeUsageWithoutFinishReasonStaysIncomplete(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeThinking,
			Usage:            &dto.Usage{CompletionTokens: 54},
		},
		SendResponseCount: 2,
	}

	responses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Usage: &dto.Usage{CompletionTokens: 54},
	}, info)

	require.Empty(t, responses)
	require.False(t, info.ClaudeConvertInfo.Done)
	require.Empty(t, info.FinishReason)
}

func TestStreamResponseOpenAI2ClaudeFinishesAfterUsageOnlyChunk(t *testing.T) {
	finishReason := "tool_calls"
	info := &relaycommon.RelayInfo{
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeTools,
		},
		SendResponseCount: 2,
	}

	finishResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{FinishReason: &finishReason},
		},
	}, info)
	require.Empty(t, finishResponses)
	require.False(t, info.ClaudeConvertInfo.Done)
	require.Equal(t, "tool_calls", info.FinishReason)

	usageResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Usage: &dto.Usage{CompletionTokens: 54},
	}, info)

	require.True(t, info.ClaudeConvertInfo.Done)
	require.Len(t, usageResponses, 3)
	require.Equal(t, "content_block_stop", usageResponses[0].Type)
	require.Equal(t, "message_delta", usageResponses[1].Type)
	require.Equal(t, "tool_use", *usageResponses[1].Delta.StopReason)
	require.Equal(t, "message_stop", usageResponses[2].Type)
}

func TestStreamResponseOpenAI2ClaudeConvertsThinkingToolCallFlow(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
		SendResponseCount: 1,
	}
	reasoning := "I should inspect the workspace."
	reasoningResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "GLM-5.2",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ReasoningContent: &reasoning,
				},
			},
		},
	}, info)
	require.Equal(t, "message_start", reasoningResponses[0].Type)
	require.Equal(t, "thinking", reasoningResponses[1].ContentBlock.Type)

	info.SendResponseCount = 2
	toolIndex := 0
	toolResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &toolIndex,
							ID:    "call_bash",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "Bash",
								Arguments: `{"command":"pwd"}`,
							},
						},
					},
				},
			},
		},
	}, info)
	require.Equal(t, "content_block_stop", toolResponses[0].Type)
	require.Equal(t, "tool_use", toolResponses[1].ContentBlock.Type)
	require.Equal(t, "Bash", toolResponses[1].ContentBlock.Name)
	require.Equal(t, "input_json_delta", toolResponses[2].Delta.Type)

	finishReason := "tool_calls"
	finishResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{FinishReason: &finishReason},
		},
		Usage: &dto.Usage{CompletionTokens: 54},
	}, info)
	require.Len(t, finishResponses, 3)
	require.Equal(t, "content_block_stop", finishResponses[0].Type)
	require.Equal(t, "message_delta", finishResponses[1].Type)
	require.Equal(t, "tool_use", *finishResponses[1].Delta.StopReason)
	require.Equal(t, "message_stop", finishResponses[2].Type)
	require.True(t, info.ClaudeConvertInfo.Done)
}
