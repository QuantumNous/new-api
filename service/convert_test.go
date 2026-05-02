package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func testRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta:       &relaycommon.ChannelMeta{},
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{},
	}
}

func TestStreamResponseOpenAI2ClaudeEmitsSignatureBeforeToolUse(t *testing.T) {
	info := testRelayInfo()
	info.RelayFormat = types.RelayFormatClaude
	info.SendResponseCount = 1
	reasoning := "Need to inspect the file."
	opaque := "EqQBCgIYAhIMsignedOpaqueBlob"

	start := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_123",
		Model: "deepseek-v4-pro",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role:             "assistant",
					ReasoningContent: &reasoning,
				},
			},
		},
	}
	responses := StreamResponseOpenAI2Claude(start, info)
	require.Len(t, responses, 3)
	require.Equal(t, "content_block_start", responses[1].Type)
	require.Equal(t, "thinking", responses[1].ContentBlock.Type)
	require.NotNil(t, responses[1].ContentBlock.Thinking)
	require.Equal(t, "", *responses[1].ContentBlock.Thinking)
	require.Equal(t, "thinking_delta", responses[2].Delta.Type)
	require.Equal(t, reasoning, *responses[2].Delta.Thinking)

	info.SendResponseCount++
	signature := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_123",
		Model: "deepseek-v4-pro",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ReasoningOpaque: &opaque,
				},
			},
		},
	}
	responses = StreamResponseOpenAI2Claude(signature, info)
	require.Empty(t, responses)

	info.SendResponseCount++
	args := `{"filePath":"/tmp/1.txt"}`
	tool := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_123",
		Model: "deepseek-v4-pro",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: common.GetPointer[int](0),
							ID:    "call_123",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "read",
								Arguments: args,
							},
						},
					},
				},
			},
		},
	}
	responses = StreamResponseOpenAI2Claude(tool, info)
	require.GreaterOrEqual(t, len(responses), 4)
	require.Equal(t, "content_block_delta", responses[0].Type)
	require.Equal(t, "signature_delta", responses[0].Delta.Type)
	require.NotNil(t, responses[0].Delta.Signature)
	require.Equal(t, opaque, *responses[0].Delta.Signature)
	require.Equal(t, "content_block_stop", responses[1].Type)
	require.Equal(t, "content_block_start", responses[2].Type)
	require.Equal(t, "tool_use", responses[2].ContentBlock.Type)
}

func TestStreamResponseOpenAI2ClaudeEmitsBlankSignatureBeforeToolUse(t *testing.T) {
	info := testRelayInfo()
	info.RelayFormat = types.RelayFormatClaude
	info.SendResponseCount = 1
	reasoning := "Need to inspect the file."

	start := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_123",
		Model: "deepseek-v4-pro",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role:             "assistant",
					ReasoningContent: &reasoning,
				},
			},
		},
	}
	responses := StreamResponseOpenAI2Claude(start, info)
	require.Len(t, responses, 3)
	require.Equal(t, "thinking_delta", responses[2].Delta.Type)

	info.SendResponseCount++
	args := `{"filePath":"/tmp/1.txt"}`
	tool := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_123",
		Model: "deepseek-v4-pro",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: common.GetPointer[int](0),
							ID:    "call_123",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "read",
								Arguments: args,
							},
						},
					},
				},
			},
		},
	}
	responses = StreamResponseOpenAI2Claude(tool, info)
	require.GreaterOrEqual(t, len(responses), 4)
	require.Equal(t, "content_block_delta", responses[0].Type)
	require.Equal(t, "signature_delta", responses[0].Delta.Type)
	require.NotNil(t, responses[0].Delta.Signature)
	require.Equal(t, "", *responses[0].Delta.Signature)
	require.Equal(t, "content_block_stop", responses[1].Type)
	require.Equal(t, "content_block_start", responses[2].Type)
	require.Equal(t, "tool_use", responses[2].ContentBlock.Type)
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
						Signature: &signature,
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
						Signature: &signature,
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
	require.NotNil(t, claudeResponse.Content[0].Signature)
	require.Equal(t, opaque, *claudeResponse.Content[0].Signature)
	require.Equal(t, "tool_use", claudeResponse.Content[1].Type)
	require.Equal(t, "call_123", claudeResponse.Content[1].Id)
	require.Equal(t, "read", claudeResponse.Content[1].Name)
}
