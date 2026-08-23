package geminichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiGenerateContentRequestToOpenAIChatMapsThinkingLevel(t *testing.T) {
	got, err := GeminiGenerateContentRequestToOpenAIChat(&dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{
				Role: "model",
				Parts: []dto.GeminiPart{
					{Text: "thinking", Thought: true},
					{Text: "answer"},
				},
			},
		},
		GenerationConfig: dto.GeminiChatGenerationConfig{
			ThinkingConfig: &dto.GeminiThinkingConfig{
				IncludeThoughts: true,
				ThinkingLevel:   "HIGH",
			},
		},
	}, &convmeta.Values{UpstreamModelName: "gemini-3-pro"})
	require.NoError(t, err)
	assert.Equal(t, reasoning.LevelHigh, got.ReasoningEffort)
	require.Len(t, got.Messages, 1)
	assert.Equal(t, "answer", got.Messages[0].StringContent())
	assert.Equal(t, "thinking", got.Messages[0].GetReasoningContent())
}

func TestStreamResponseGeminiChat2OpenAISplitsThoughtAndText(t *testing.T) {
	resp, _ := StreamResponseGeminiChat2OpenAI(&dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Text: "think", Thought: true},
						{Text: "hello"},
					},
				},
			},
		},
	})
	require.Len(t, resp.Choices, 1)
	assert.Equal(t, "think", resp.Choices[0].Delta.GetReasoningContent())
	assert.Equal(t, "hello", resp.Choices[0].Delta.GetContentString())
}
