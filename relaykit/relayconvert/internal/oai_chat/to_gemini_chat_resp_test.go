package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponseOpenAI2GeminiMapsTextToolFinishReasonAndUsage(t *testing.T) {
	msg := dto.Message{
		Role:    "assistant",
		Content: "hello",
	}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "lookup",
				Arguments: `{"q":"x"}`,
			},
		},
	})

	resp := ResponseOpenAI2Gemini(&dto.OpenAITextResponse{
		Model: "gpt-test",
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index:        2,
				Message:      msg,
				FinishReason: "length",
			},
		},
		Usage: dto.Usage{
			PromptTokens:     11,
			CompletionTokens: 5,
			TotalTokens:      16,
		},
	}, nil)

	assert.Equal(t, 11, resp.UsageMetadata.PromptTokenCount)
	assert.Equal(t, 5, resp.UsageMetadata.CandidatesTokenCount)
	assert.Equal(t, 16, resp.UsageMetadata.TotalTokenCount)
	require.NotNil(t, resp.UsageMetadata.BillingUsage)
	require.NotNil(t, resp.UsageMetadata.BillingUsage.OpenAIUsage)
	assert.Equal(t, dto.BillingUsageSourceOAIChat, resp.UsageMetadata.BillingUsage.Source)
	assert.Equal(t, dto.BillingUsageSemanticOpenAI, resp.UsageMetadata.BillingUsage.Semantic)
	assert.Equal(t, 11, resp.UsageMetadata.BillingUsage.OpenAIUsage.PromptTokens)
	assert.Equal(t, 5, resp.UsageMetadata.BillingUsage.OpenAIUsage.CompletionTokens)
	assert.Equal(t, 16, resp.UsageMetadata.BillingUsage.OpenAIUsage.TotalTokens)
	assert.Nil(t, resp.UsageMetadata.BillingUsage.OpenAIUsage.BillingUsage)
	require.Len(t, resp.Candidates, 1)
	assert.Equal(t, int64(2), resp.Candidates[0].Index)
	require.NotNil(t, resp.Candidates[0].FinishReason)
	assert.Equal(t, "MAX_TOKENS", *resp.Candidates[0].FinishReason)
	require.Len(t, resp.Candidates[0].Content.Parts, 2)
	assert.Equal(t, "hello", resp.Candidates[0].Content.Parts[0].Text)
	require.NotNil(t, resp.Candidates[0].Content.Parts[1].FunctionCall)
	assert.Equal(t, "lookup", resp.Candidates[0].Content.Parts[1].FunctionCall.FunctionName)
	assert.Equal(t, map[string]any{"q": "x"}, resp.Candidates[0].Content.Parts[1].FunctionCall.Arguments)
}

func TestStreamResponseOpenAI2GeminiMapsToolCallFinishReasonAndUsage(t *testing.T) {
	resp := StreamResponseOpenAI2Gemini(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index:        1,
				FinishReason: geminiRespPtr("tool_calls"),
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Type: "function",
							Function: dto.FunctionResponse{
								Name:      "lookup",
								Arguments: `{"q":"x"}`,
							},
						},
					},
				},
			},
		},
		Usage: &dto.Usage{
			PromptTokens:     13,
			CompletionTokens: 8,
			TotalTokens:      21,
		},
	}, &convmeta.Values{})

	require.NotNil(t, resp)
	assert.Equal(t, 13, resp.UsageMetadata.PromptTokenCount)
	assert.Equal(t, 8, resp.UsageMetadata.CandidatesTokenCount)
	assert.Equal(t, 21, resp.UsageMetadata.TotalTokenCount)
	require.NotNil(t, resp.UsageMetadata.BillingUsage)
	require.NotNil(t, resp.UsageMetadata.BillingUsage.OpenAIUsage)
	assert.Equal(t, 13, resp.UsageMetadata.BillingUsage.OpenAIUsage.PromptTokens)
	assert.Equal(t, 8, resp.UsageMetadata.BillingUsage.OpenAIUsage.CompletionTokens)
	require.Len(t, resp.Candidates, 1)
	assert.Equal(t, int64(1), resp.Candidates[0].Index)
	require.NotNil(t, resp.Candidates[0].FinishReason)
	assert.Equal(t, "STOP", *resp.Candidates[0].FinishReason)
	require.Len(t, resp.Candidates[0].Content.Parts, 1)
	require.NotNil(t, resp.Candidates[0].Content.Parts[0].FunctionCall)
	assert.Equal(t, "lookup", resp.Candidates[0].Content.Parts[0].FunctionCall.FunctionName)
	assert.Equal(t, map[string]any{"q": "x"}, resp.Candidates[0].Content.Parts[0].FunctionCall.Arguments)
}

func TestResponseOpenAI2GeminiEmitsReasoningAsThoughtPartBeforeText(t *testing.T) {
	for name, message := range map[string]dto.Message{
		"reasoning":         {Role: "assistant", Content: "answer", Reasoning: geminiRespPtr("thinking")},
		"reasoning_content": {Role: "assistant", Content: "answer", ReasoningContent: geminiRespPtr("thinking")},
	} {
		t.Run(name, func(t *testing.T) {
			resp := ResponseOpenAI2Gemini(&dto.OpenAITextResponse{
				Choices: []dto.OpenAITextResponseChoice{{Message: message, FinishReason: "stop"}},
			}, nil)

			require.Len(t, resp.Candidates, 1)
			parts := resp.Candidates[0].Content.Parts
			require.Len(t, parts, 2)
			assert.Equal(t, dto.GeminiPart{Text: "thinking", Thought: true}, parts[0])
			assert.Equal(t, dto.GeminiPart{Text: "answer"}, parts[1])
		})
	}
}

func TestStreamResponseOpenAI2GeminiKeepsReasoningOnlyChunk(t *testing.T) {
	resp := StreamResponseOpenAI2Gemini(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Reasoning: geminiRespPtr("thinking")},
		}},
	}, &convmeta.Values{})

	require.NotNil(t, resp, "a chunk that only carries reasoning must not be dropped")
	require.Len(t, resp.Candidates, 1)
	assert.Equal(t, []dto.GeminiPart{{Text: "thinking", Thought: true}}, resp.Candidates[0].Content.Parts)
}

func TestChatToGeminiStreamStateConvertsOpenRouterReasoningChunks(t *testing.T) {
	state := NewChatToGeminiStreamState()
	reasoningWithDetails := dto.ChatCompletionsStreamResponseChoiceDelta{
		Content:   geminiRespPtr(""),
		Role:      "assistant",
		Reasoning: geminiRespPtr("thinking"),
	}
	textOnly := dto.ChatCompletionsStreamResponseChoiceDelta{Content: geminiRespPtr("answer")}
	// OpenRouter closes a reasoning block with "reasoning": null before finishing.
	finish := dto.ChatCompletionsStreamResponseChoiceDelta{Content: geminiRespPtr(""), Role: "assistant"}

	var parts []dto.GeminiPart
	var finishReasons []string
	for _, step := range []struct {
		delta  dto.ChatCompletionsStreamResponseChoiceDelta
		finish *string
	}{
		{delta: reasoningWithDetails},
		{delta: textOnly},
		{delta: finish, finish: geminiRespPtr("stop")},
	} {
		responses, err := state.ConvertChunk(&dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{Delta: step.delta, FinishReason: step.finish}},
		}, &convmeta.Values{})
		require.NoError(t, err)
		for _, response := range responses {
			for _, candidate := range response.Candidates {
				parts = append(parts, candidate.Content.Parts...)
				if candidate.FinishReason != nil {
					finishReasons = append(finishReasons, *candidate.FinishReason)
				}
			}
		}
	}

	assert.Equal(t, []dto.GeminiPart{{Text: "thinking", Thought: true}, {Text: "answer"}}, parts)
	assert.Equal(t, []string{"STOP"}, finishReasons)
}

func geminiRespPtr[T any](value T) *T {
	return &value
}
