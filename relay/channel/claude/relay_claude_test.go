package claude

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFormatClaudeResponseInfo_MessageStart(t *testing.T) {
	claudeInfo := &ClaudeResponseInfo{
		Usage: &dto.Usage{},
	}
	claudeResponse := &dto.ClaudeResponse{
		Type: "message_start",
		Message: &dto.ClaudeMediaMessage{
			Id:    "msg_123",
			Model: "claude-3-5-sonnet",
			Usage: &dto.ClaudeUsage{
				InputTokens:              100,
				OutputTokens:             1,
				CacheCreationInputTokens: 50,
				CacheReadInputTokens:     30,
			},
		},
	}

	ok := FormatClaudeResponseInfo(claudeResponse, nil, claudeInfo)
	require.True(t, ok)
	assert.Equal(t, 100, claudeInfo.Usage.PromptTokens)
	assert.Equal(t, 30, claudeInfo.Usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 50, claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens)
	assert.Equal(t, "msg_123", claudeInfo.ResponseId)
	assert.Equal(t, "claude-3-5-sonnet", claudeInfo.Model)
}

func TestFormatClaudeResponseInfo_MessageDelta_FullUsage(t *testing.T) {
	claudeInfo := &ClaudeResponseInfo{
		Usage: &dto.Usage{
			PromptTokens: 100,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:         30,
				CachedCreationTokens: 50,
			},
			CompletionTokens: 1,
		},
	}

	claudeResponse := &dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			InputTokens:              100,
			OutputTokens:             200,
			CacheCreationInputTokens: 50,
			CacheReadInputTokens:     30,
		},
	}

	ok := FormatClaudeResponseInfo(claudeResponse, nil, claudeInfo)
	require.True(t, ok)
	assert.Equal(t, 100, claudeInfo.Usage.PromptTokens)
	assert.Equal(t, 200, claudeInfo.Usage.CompletionTokens)
	assert.Equal(t, 300, claudeInfo.Usage.TotalTokens)
	assert.True(t, claudeInfo.Done)
}

func TestFormatClaudeResponseInfo_MessageDelta_OnlyOutputTokens(t *testing.T) {
	claudeInfo := &ClaudeResponseInfo{
		Usage: &dto.Usage{
			PromptTokens: 100,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:         30,
				CachedCreationTokens: 50,
			},
			CompletionTokens:            1,
			ClaudeCacheCreation5mTokens: 10,
			ClaudeCacheCreation1hTokens: 20,
		},
	}

	claudeResponse := &dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			OutputTokens: 200,
		},
	}

	ok := FormatClaudeResponseInfo(claudeResponse, nil, claudeInfo)
	require.True(t, ok)
	assert.Equal(t, 100, claudeInfo.Usage.PromptTokens)
	assert.Equal(t, 200, claudeInfo.Usage.CompletionTokens)
	assert.Equal(t, 300, claudeInfo.Usage.TotalTokens)
	assert.Equal(t, 30, claudeInfo.Usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 50, claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens)
	assert.Equal(t, 10, claudeInfo.Usage.ClaudeCacheCreation5mTokens)
	assert.Equal(t, 20, claudeInfo.Usage.ClaudeCacheCreation1hTokens)
	assert.True(t, claudeInfo.Done)
}

func TestFormatClaudeResponseInfo_NilClaudeInfo(t *testing.T) {
	claudeResponse := &dto.ClaudeResponse{Type: "message_start"}
	ok := FormatClaudeResponseInfo(claudeResponse, nil, nil)
	assert.False(t, ok)
}

func TestFormatClaudeResponseInfo_ContentBlockDelta(t *testing.T) {
	text := "hello"
	claudeInfo := &ClaudeResponseInfo{
		Usage:        &dto.Usage{},
		ResponseText: strings.Builder{},
	}
	claudeResponse := &dto.ClaudeResponse{
		Type: "content_block_delta",
		Delta: &dto.ClaudeMediaMessage{
			Text: &text,
		},
	}

	ok := FormatClaudeResponseInfo(claudeResponse, nil, claudeInfo)
	require.True(t, ok)
	assert.Equal(t, "hello", claudeInfo.ResponseText.String())
}

func TestRequestOpenAI2ClaudeMessage_AssistantToolCallWithEmptyContent(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-opus-4-6",
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "what time is it",
			},
		},
	}
	assistantMessage := dto.Message{
		Role:    "assistant",
		Content: "",
	}
	assistantMessage.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "get_current_time",
				Arguments: "{}",
			},
		},
	})
	request.Messages = append(request.Messages, assistantMessage)

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	require.Len(t, claudeRequest.Messages, 2)

	assistantClaudeMessage := claudeRequest.Messages[1]
	assert.Equal(t, "assistant", assistantClaudeMessage.Role)

	contentBlocks, ok := assistantClaudeMessage.Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, contentBlocks, 1)

	assert.Equal(t, "tool_use", contentBlocks[0].Type)
	assert.Equal(t, "call_1", contentBlocks[0].Id)
	assert.Equal(t, "get_current_time", contentBlocks[0].Name)
	if assert.NotNil(t, contentBlocks[0].Input) {
		_, isMap := contentBlocks[0].Input.(map[string]any)
		assert.True(t, isMap)
	}
	if contentBlocks[0].Text != nil {
		assert.NotEqual(t, "", *contentBlocks[0].Text)
	}
}

func TestRequestOpenAI2ClaudeMessage_AssistantToolCallWithMalformedArguments(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-opus-4-6",
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "what time is it",
			},
		},
	}
	assistantMessage := dto.Message{
		Role:    "assistant",
		Content: "",
	}
	assistantMessage.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_bad_args",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "get_current_timestamp",
				Arguments: "{",
			},
		},
	})
	request.Messages = append(request.Messages, assistantMessage)

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	require.Len(t, claudeRequest.Messages, 2)

	assistantClaudeMessage := claudeRequest.Messages[1]
	contentBlocks, ok := assistantClaudeMessage.Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, contentBlocks, 1)

	assert.Equal(t, "tool_use", contentBlocks[0].Type)
	assert.Equal(t, "call_bad_args", contentBlocks[0].Id)
	assert.Equal(t, "get_current_timestamp", contentBlocks[0].Name)

	inputObj, ok := contentBlocks[0].Input.(map[string]any)
	require.True(t, ok)
	assert.Empty(t, inputObj)
}

func TestStreamResponseClaude2OpenAI_EmptyInputJSONDeltaFallback(t *testing.T) {
	empty := ""
	resp := &dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: func() *int { v := 1; return &v }(),
		Delta: &dto.ClaudeMediaMessage{
			Type:        "input_json_delta",
			PartialJson: &empty,
		},
	}

	chunk := StreamResponseClaude2OpenAI(resp)
	require.NotNil(t, chunk)
	require.Len(t, chunk.Choices, 1)
	require.NotNil(t, chunk.Choices[0].Delta.ToolCalls)
	require.Len(t, chunk.Choices[0].Delta.ToolCalls, 1)
	assert.Equal(t, "{}", chunk.Choices[0].Delta.ToolCalls[0].Function.Arguments)
}

func TestStreamResponseClaude2OpenAI_NonEmptyInputJSONDeltaPreserved(t *testing.T) {
	partial := `{"timezone":"Asia/Shanghai"}`
	resp := &dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: func() *int { v := 1; return &v }(),
		Delta: &dto.ClaudeMediaMessage{
			Type:        "input_json_delta",
			PartialJson: &partial,
		},
	}

	chunk := StreamResponseClaude2OpenAI(resp)
	require.NotNil(t, chunk)
	require.Len(t, chunk.Choices, 1)
	require.NotNil(t, chunk.Choices[0].Delta.ToolCalls)
	require.Len(t, chunk.Choices[0].Delta.ToolCalls, 1)
	assert.Equal(t, partial, chunk.Choices[0].Delta.ToolCalls[0].Function.Arguments)
}
