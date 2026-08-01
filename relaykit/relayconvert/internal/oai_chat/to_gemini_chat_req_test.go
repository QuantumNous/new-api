package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatRequestToGeminiGenerateContentPreservesAssistantReasoning(t *testing.T) {
	reasoning := "需要先定位城市，再调用天气接口"

	t.Run("reasoning precedes function call", func(t *testing.T) {
		assistant := dto.Message{Role: "assistant", ReasoningContent: lo.ToPtr(reasoning)}
		assistant.SetToolCalls([]dto.ToolCallRequest{
			{
				ID:   "call_1",
				Type: "function",
				Function: dto.FunctionRequest{
					Name:      "get_weather",
					Arguments: `{"city":"beijing"}`,
				},
			},
		})

		got, err := OpenAIChatRequestToGeminiGenerateContent(nil, dto.GeneralOpenAIRequest{
			Model: "gemini-test",
			Messages: []dto.Message{
				{Role: "user", Content: "查天气"},
				assistant,
				{Role: "tool", ToolCallId: "call_1", Content: "晴"},
			},
		}, nil)
		require.NoError(t, err)
		require.NotEmpty(t, got.Contents)

		var modelTurn *dto.GeminiChatContent
		for i := range got.Contents {
			if got.Contents[i].Role == "model" {
				modelTurn = &got.Contents[i]
				break
			}
		}
		require.NotNil(t, modelTurn)
		require.Len(t, modelTurn.Parts, 2)
		assert.True(t, modelTurn.Parts[0].Thought)
		assert.Equal(t, reasoning, modelTurn.Parts[0].Text)
		assert.Empty(t, modelTurn.Parts[0].ThoughtSignature)
		require.NotNil(t, modelTurn.Parts[1].FunctionCall)
		assert.Equal(t, "get_weather", modelTurn.Parts[1].FunctionCall.FunctionName)
	})

	t.Run("reasoning only turn is kept", func(t *testing.T) {
		got, err := OpenAIChatRequestToGeminiGenerateContent(nil, dto.GeneralOpenAIRequest{
			Model: "gemini-test",
			Messages: []dto.Message{
				{Role: "user", Content: "hi"},
				{Role: "assistant", ReasoningContent: lo.ToPtr(reasoning)},
			},
		}, nil)
		require.NoError(t, err)
		require.Len(t, got.Contents, 2)
		require.Len(t, got.Contents[1].Parts, 1)
		assert.True(t, got.Contents[1].Parts[0].Thought)
		assert.Equal(t, reasoning, got.Contents[1].Parts[0].Text)
	})

	t.Run("user message reasoning is not emitted", func(t *testing.T) {
		got, err := OpenAIChatRequestToGeminiGenerateContent(nil, dto.GeneralOpenAIRequest{
			Model: "gemini-test",
			Messages: []dto.Message{
				{Role: "user", Content: "hi", ReasoningContent: lo.ToPtr(reasoning)},
			},
		}, nil)
		require.NoError(t, err)
		require.Len(t, got.Contents, 1)
		for _, part := range got.Contents[0].Parts {
			assert.False(t, part.Thought)
		}
	})
}
