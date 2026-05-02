package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func testRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
}

func TestClaudeToOpenAIRequestPreservesThinkingForToolUse(t *testing.T) {
	thinking := "I need to inspect the file before answering."
	signature := "EqQBCgIYAhIM1xYvopaqueSignature"
	claudeRequest := dto.ClaudeRequest{
		Model: "deepseek-v4-pro",
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []dto.ClaudeMediaMessage{
					{
						Type:      "thinking",
						Thinking:  &thinking,
						Signature: signature,
					},
					{
						Type:  "tool_use",
						Id:    "call_123",
						Name:  "read",
						Input: map[string]any{"filePath": "/tmp/1.txt"},
					},
				},
			},
		},
	}

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, testRelayInfo())
	require.NoError(t, err)
	require.Len(t, openAIRequest.Messages, 1)

	message := openAIRequest.Messages[0]
	require.Equal(t, "assistant", message.Role)
	require.Equal(t, thinking, message.GetReasoningContent())
	require.Equal(t, signature, message.GetReasoningOpaque())
	require.Len(t, message.ParseToolCalls(), 1)
	require.JSONEq(t, `{"filePath":"/tmp/1.txt"}`, message.ParseToolCalls()[0].Function.Arguments)
}

func TestClaudeToOpenAIRequestPreservesSignedThinkingContent(t *testing.T) {
	thinking := "Visible reasoning that DeepSeek needs for tool replay."
	signature := "EqQBCgIYAhIMsignedOpaqueBlob"
	claudeRequest := dto.ClaudeRequest{
		Model: "deepseek-v4-pro",
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []dto.ClaudeMediaMessage{
					{
						Type:      "thinking",
						Thinking:  &thinking,
						Signature: signature,
					},
					{
						Type:  "tool_use",
						Id:    "call_456",
						Name:  "lookup",
						Input: map[string]any{"query": "reasoning"},
					},
				},
			},
		},
	}

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, testRelayInfo())
	require.NoError(t, err)
	require.Len(t, openAIRequest.Messages, 1)
	require.Equal(t, thinking, openAIRequest.Messages[0].GetReasoningContent())
	require.Equal(t, signature, openAIRequest.Messages[0].GetReasoningOpaque())
	require.Len(t, openAIRequest.Messages[0].ParseToolCalls(), 1)
}

func TestClaudeToOpenAIRequestSkipsEmptyThinkingOnlyMessage(t *testing.T) {
	claudeRequest := dto.ClaudeRequest{
		Model: "deepseek-v4-pro",
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []dto.ClaudeMediaMessage{
					{Type: "thinking"},
				},
			},
		},
	}

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, testRelayInfo())
	require.NoError(t, err)
	require.Empty(t, openAIRequest.Messages)
}

func TestClaudeToOpenAIRequestHandlesNilRelayInfo(t *testing.T) {
	claudeRequest := dto.ClaudeRequest{Model: "deepseek-v4-pro"}

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, nil)
	require.NoError(t, err)
	require.Equal(t, "deepseek-v4-pro", openAIRequest.Model)
}

func TestClaudeToOpenAIRequestPreservesThinkingWithNilChannelMeta(t *testing.T) {
	thinking := "Need to call a tool."
	claudeRequest := dto.ClaudeRequest{
		Model: "deepseek-v4-pro",
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []dto.ClaudeMediaMessage{
					{Type: "thinking", Thinking: &thinking},
					{Type: "tool_use", Id: "call_123", Name: "read"},
				},
			},
		},
	}

	openAIRequest, err := ClaudeToOpenAIRequest(claudeRequest, &relaycommon.RelayInfo{})
	require.NoError(t, err)
	require.Len(t, openAIRequest.Messages, 1)
	require.Equal(t, thinking, openAIRequest.Messages[0].GetReasoningContent())
}

func TestResponseOpenAI2ClaudePreservesReasoningBeforeToolUse(t *testing.T) {
	reasoning := "Need the file content first."
	opaque := "EqQBCgIYAhIMsignedOpaqueBlob"
	toolCalls := []dto.ToolCallRequest{
		{
			ID:   "call_123",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "read",
				Arguments: `{"filePath":"/tmp/1.txt"}`,
			},
		},
	}
	toolCallsJSON, err := common.Marshal(toolCalls)
	require.NoError(t, err)

	openAIResponse := &dto.OpenAITextResponse{
		Id:    "chatcmpl_123",
		Model: "deepseek-v4-pro",
		Choices: []dto.OpenAITextResponseChoice{
			{
				Message: dto.Message{
					Role:             "assistant",
					ReasoningContent: &reasoning,
					ReasoningOpaque:  &opaque,
					ToolCalls:        toolCallsJSON,
				},
				FinishReason: "tool_calls",
			},
		},
	}

	claudeResponse := ResponseOpenAI2Claude(openAIResponse, &relaycommon.RelayInfo{})
	require.Len(t, claudeResponse.Content, 2)
	require.Equal(t, "thinking", claudeResponse.Content[0].Type)
	require.NotNil(t, claudeResponse.Content[0].Thinking)
	require.Equal(t, reasoning, *claudeResponse.Content[0].Thinking)
	require.Equal(t, opaque, claudeResponse.Content[0].Signature)
	require.Equal(t, "tool_use", claudeResponse.Content[1].Type)
	require.Equal(t, "call_123", claudeResponse.Content[1].Id)
	require.Equal(t, "read", claudeResponse.Content[1].Name)
}
