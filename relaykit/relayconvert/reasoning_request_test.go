package relayconvert

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

const requestReasoning = "Need the lookup."

func reasoningConversionMeta() *convmeta.Values {
	return &convmeta.Values{
		UpstreamModelName:   "xiaomi-mimo-v2-flash",
		ChannelMetaAttached: true,
		Options: &convmeta.Options{
			PreserveReasoningContent: true,
		},
	}
}

func chatRequestWithReasoning() *dto.GeneralOpenAIRequest {
	maxTokens := uint(128)
	reasoning := requestReasoning
	return &dto.GeneralOpenAIRequest{
		Model:     "xiaomi-mimo-v2-flash",
		MaxTokens: &maxTokens,
		Messages: []dto.Message{
			{Role: "assistant", Content: "Calling the tool.", ReasoningContent: &reasoning},
		},
	}
}

func responsesRequestWithReasoning(t *testing.T) *dto.OpenAIResponsesRequest {
	t.Helper()
	maxOutputTokens := uint(128)
	return &dto.OpenAIResponsesRequest{
		Model:           "xiaomi-mimo-v2-flash",
		MaxOutputTokens: &maxOutputTokens,
		Input: mustRawMessage(t, []map[string]any{
			{"role": "assistant", "content": "Calling the tool."},
			{
				"type": "reasoning",
				"summary": []map[string]any{
					{"type": "summary_text", "text": requestReasoning},
				},
			},
			{
				"type":      "function_call",
				"call_id":   "call_1",
				"name":      "lookup",
				"arguments": `{}`,
			},
		}),
	}
}

func TestRequestConvertersPreserveConfiguredReasoningContent(t *testing.T) {
	const reasoning = requestReasoning
	t.Run("Chat Completions to Responses", func(t *testing.T) {
		result, err := ConvertRequest(nil, reasoningConversionMeta(), types.RelayFormatOpenAIResponses, chatRequestWithReasoning())
		require.NoError(t, err)
		converted := result.Value.(*dto.OpenAIResponsesRequest)
		assert.Equal(t, "reasoning", gjson.GetBytes(converted.Input, "0.type").String())
		assert.Equal(t, reasoning, gjson.GetBytes(converted.Input, "0.summary.0.text").String())
	})

	t.Run("Chat Completions to Claude", func(t *testing.T) {
		result, err := ConvertRequest(nil, reasoningConversionMeta(), types.RelayFormatClaude, chatRequestWithReasoning())
		require.NoError(t, err)
		converted := result.Value.(*dto.ClaudeRequest)
		require.NotEmpty(t, converted.Messages)
		parts, err := converted.Messages[len(converted.Messages)-1].ParseContent()
		require.NoError(t, err)
		require.NotEmpty(t, parts)
		assert.Equal(t, "thinking", parts[0].Type)
		require.NotNil(t, parts[0].Thinking)
		assert.Equal(t, reasoning, *parts[0].Thinking)
	})

	t.Run("Chat Completions to Gemini", func(t *testing.T) {
		result, err := ConvertRequest(nil, reasoningConversionMeta(), types.RelayFormatGemini, chatRequestWithReasoning())
		require.NoError(t, err)
		converted := result.Value.(*dto.GeminiChatRequest)
		require.NotEmpty(t, converted.Contents)
		require.NotEmpty(t, converted.Contents[0].Parts)
		assert.True(t, converted.Contents[0].Parts[0].Thought)
		assert.Equal(t, reasoning, converted.Contents[0].Parts[0].Text)
	})

	t.Run("Responses to Chat Completions", func(t *testing.T) {
		result, err := ConvertRequest(nil, reasoningConversionMeta(), types.RelayFormatOpenAI, responsesRequestWithReasoning(t))
		require.NoError(t, err)
		converted := result.Value.(*dto.GeneralOpenAIRequest)
		require.NotEmpty(t, converted.Messages)
		assert.Equal(t, reasoning, converted.Messages[0].GetReasoningContent())
		assert.Len(t, converted.Messages[0].ParseToolCalls(), 1)
	})

	t.Run("Responses to Claude", func(t *testing.T) {
		result, err := ConvertRequest(nil, reasoningConversionMeta(), types.RelayFormatClaude, responsesRequestWithReasoning(t))
		require.NoError(t, err)
		converted := result.Value.(*dto.ClaudeRequest)
		require.NotEmpty(t, converted.Messages)
		parts, err := converted.Messages[len(converted.Messages)-1].ParseContent()
		require.NoError(t, err)
		require.Len(t, parts, 3)
		assert.Equal(t, "thinking", parts[0].Type)
		require.NotNil(t, parts[0].Thinking)
		assert.Equal(t, reasoning, *parts[0].Thinking)
		assert.Equal(t, "tool_use", parts[2].Type)
		assert.Equal(t, "call_1", parts[2].Id)
	})

	t.Run("Responses to Gemini", func(t *testing.T) {
		result, err := ConvertRequest(nil, reasoningConversionMeta(), types.RelayFormatGemini, responsesRequestWithReasoning(t))
		require.NoError(t, err)
		converted := result.Value.(*dto.GeminiChatRequest)
		require.NotEmpty(t, converted.Contents)
		require.Len(t, converted.Contents[0].Parts, 3)
		assert.True(t, converted.Contents[0].Parts[0].Thought)
		assert.Equal(t, reasoning, converted.Contents[0].Parts[0].Text)
		require.NotNil(t, converted.Contents[0].Parts[1].FunctionCall)
		assert.Equal(t, "lookup", converted.Contents[0].Parts[1].FunctionCall.FunctionName)
	})

	t.Run("Claude to Chat Completions", func(t *testing.T) {
		thought := reasoning
		text := "Calling the tool."
		request := &dto.ClaudeRequest{
			Model: "xiaomi-mimo-v2-flash",
			Messages: []dto.ClaudeMessage{{
				Role: "assistant",
				Content: []dto.ClaudeMediaMessage{
					{Type: "thinking", Thinking: &thought},
					{Type: "text", Text: &text},
				},
			}},
		}
		result, err := ConvertRequest(nil, reasoningConversionMeta(), types.RelayFormatOpenAI, request)
		require.NoError(t, err)
		converted := result.Value.(*dto.GeneralOpenAIRequest)
		require.NotEmpty(t, converted.Messages)
		assert.Equal(t, reasoning, converted.Messages[0].GetReasoningContent())
	})

	t.Run("Gemini to Chat Completions", func(t *testing.T) {
		request := &dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{{
				Role: "model",
				Parts: []dto.GeminiPart{
					{Text: reasoning, Thought: true},
					{Text: "Calling the tool."},
				},
			}},
		}
		result, err := ConvertRequest(nil, reasoningConversionMeta(), types.RelayFormatOpenAI, request)
		require.NoError(t, err)
		converted := result.Value.(*dto.GeneralOpenAIRequest)
		require.NotEmpty(t, converted.Messages)
		assert.Equal(t, reasoning, converted.Messages[0].GetReasoningContent())
	})
}

func TestRequestConvertersDoNotEmitReasoningContentWithoutOption(t *testing.T) {
	reasoning := "hidden reasoning"
	result, err := ConvertRequest(nil, &convmeta.Values{}, types.RelayFormatOpenAIResponses, &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{{
			Role:             "assistant",
			Content:          "answer",
			ReasoningContent: &reasoning,
		}},
	})
	require.NoError(t, err)
	converted := result.Value.(*dto.OpenAIResponsesRequest)
	assert.NotEqual(t, "reasoning", gjson.GetBytes(converted.Input, "0.type").String())

	thought := "hidden thought"
	result, err = ConvertRequest(nil, &convmeta.Values{}, types.RelayFormatOpenAI, &dto.ClaudeRequest{
		Model: "gpt-test",
		Messages: []dto.ClaudeMessage{{
			Role:    "assistant",
			Content: []dto.ClaudeMediaMessage{{Type: "thinking", Thinking: &thought}},
		}},
	})
	require.NoError(t, err)
	convertedChat := result.Value.(*dto.GeneralOpenAIRequest)
	assert.Empty(t, convertedChat.Messages)
}
