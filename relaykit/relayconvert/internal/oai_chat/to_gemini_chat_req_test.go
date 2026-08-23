package oaichat

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatRequestToGeminiEnablesImageModalitiesFromImagineList(t *testing.T) {
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), dto.GeneralOpenAIRequest{
		Model:    "my-custom-draw",
		Messages: []dto.Message{{Role: "user", Content: "a cat"}},
	}, &convmeta.Values{
		ChannelMetaAttached: true,
		OriginModelName:     "my-custom-draw",
		UpstreamModelName:   "gemini-2.5-pro",
		Options: &convmeta.Options{
			Gemini: convmeta.GeminiOptions{
				SupportsImagine: func(model string) bool { return model == "my-custom-draw" },
			},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"TEXT", "IMAGE"}, got.GenerationConfig.ResponseModalities)
}

func TestOpenAIChatRequestToGeminiUsesThinkingLevelAndThoughts(t *testing.T) {
	reasoningText := "let me think"
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), dto.GeneralOpenAIRequest{
		Model:           "gemini-3-pro",
		ReasoningEffort: reasoning.LevelXHigh,
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
			{
				Role:             "assistant",
				Content:          "hello",
				ReasoningContent: &reasoningText,
			},
		},
	}, &convmeta.Values{UpstreamModelName: "gemini-3-pro"})
	require.NoError(t, err)
	require.NotNil(t, got.GenerationConfig.ThinkingConfig)
	assert.Equal(t, reasoning.LevelHigh, got.GenerationConfig.ThinkingConfig.ThinkingLevel)
	assert.True(t, got.GenerationConfig.ThinkingConfig.IncludeThoughts)
	assert.Nil(t, got.GenerationConfig.ThinkingConfig.ThinkingBudget)

	require.Len(t, got.Contents, 2)
	require.GreaterOrEqual(t, len(got.Contents[1].Parts), 2)
	assert.True(t, got.Contents[1].Parts[0].Thought)
	assert.Equal(t, reasoningText, got.Contents[1].Parts[0].Text)
	assert.Equal(t, "hello", got.Contents[1].Parts[1].Text)
}

func TestResponseOpenAI2GeminiMapsReasoningContent(t *testing.T) {
	reasoningText := "internal thought"
	resp := ResponseOpenAI2Gemini(&dto.OpenAITextResponse{
		Choices: []dto.OpenAITextResponseChoice{
			{
				Message: dto.Message{
					Role:             "assistant",
					Content:          "answer",
					ReasoningContent: &reasoningText,
				},
				FinishReason: "stop",
			},
		},
	}, nil)
	require.Len(t, resp.Candidates, 1)
	require.Len(t, resp.Candidates[0].Content.Parts, 2)
	assert.True(t, resp.Candidates[0].Content.Parts[0].Thought)
	assert.Equal(t, reasoningText, resp.Candidates[0].Content.Parts[0].Text)
	assert.Equal(t, "answer", resp.Candidates[0].Content.Parts[1].Text)
}

func TestStreamResponseOpenAI2GeminiMapsReasoningDelta(t *testing.T) {
	resp := StreamResponseOpenAI2Gemini(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ReasoningContent: ptr("think"),
					Content:          ptr("hi"),
				},
			},
		},
	}, &convmeta.Values{})
	require.NotNil(t, resp)
	require.Len(t, resp.Candidates[0].Content.Parts, 2)
	assert.True(t, resp.Candidates[0].Content.Parts[0].Thought)
	assert.Equal(t, "think", resp.Candidates[0].Content.Parts[0].Text)
	assert.Equal(t, "hi", resp.Candidates[0].Content.Parts[1].Text)
}
