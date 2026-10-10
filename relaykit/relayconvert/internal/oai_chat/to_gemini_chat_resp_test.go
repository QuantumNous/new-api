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
	for name, tc := range geminiResponseReasoningCases() {
		t.Run(name, func(t *testing.T) {
			resp := ResponseOpenAI2Gemini(&dto.OpenAITextResponse{
				Choices: []dto.OpenAITextResponseChoice{{
					Message: dto.Message{
						Role: "assistant", Content: "answer",
						ReasoningContent: tc.reasoningContent, Reasoning: tc.reasoning,
					},
					FinishReason: "stop",
				}},
			}, nil)

			require.Len(t, resp.Candidates, 1)
			want := []dto.GeminiPart{}
			if tc.want != "" {
				want = append(want, dto.GeminiPart{Text: tc.want, Thought: true})
			}
			want = append(want, dto.GeminiPart{Text: "answer"})
			assert.Equal(t, want, resp.Candidates[0].Content.Parts)
		})
	}
}

func TestStreamResponseOpenAI2GeminiKeepsReasoningOnlyChunk(t *testing.T) {
	for name, tc := range geminiResponseReasoningCases() {
		t.Run(name, func(t *testing.T) {
			resp := StreamResponseOpenAI2Gemini(&dto.ChatCompletionsStreamResponse{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						ReasoningContent: tc.reasoningContent, Reasoning: tc.reasoning,
					},
				}},
			}, &convmeta.Values{})

			if tc.want == "" {
				assert.Nil(t, resp, "an empty chunk must still be skipped")
				return
			}
			require.NotNil(t, resp, "a chunk that only carries reasoning must not be dropped")
			require.Len(t, resp.Candidates, 1)
			assert.Equal(t, []dto.GeminiPart{{Text: tc.want, Thought: true}}, resp.Candidates[0].Content.Parts)
		})
	}
}

func TestChatToGeminiStreamStateConvertsOpenRouterReasoningChunks(t *testing.T) {
	for name, tc := range geminiResponseReasoningCases() {
		t.Run(name, func(t *testing.T) {
			state := NewChatToGeminiStreamState()
			reasoningWithDetails := dto.ChatCompletionsStreamResponseChoiceDelta{
				Content: geminiRespPtr(""), Role: "assistant",
				ReasoningContent: tc.reasoningContent, Reasoning: tc.reasoning,
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

			want := []dto.GeminiPart{}
			if tc.want != "" {
				want = append(want, dto.GeminiPart{Text: tc.want, Thought: true})
			}
			want = append(want, dto.GeminiPart{Text: "answer"})
			assert.Equal(t, want, parts)
			assert.Equal(t, []string{"STOP"}, finishReasons)
		})
	}
}

func geminiResponseReasoningCases() map[string]struct {
	reasoningContent *string
	reasoning        *string
	want             string
} {
	return map[string]struct {
		reasoningContent *string
		reasoning        *string
		want             string
	}{
		"reasoning":                          {nil, geminiRespPtr("thinking"), "thinking"},
		"reasoning_content":                  {geminiRespPtr("thinking"), nil, "thinking"},
		"empty_reasoning_content_falls_back": {geminiRespPtr(""), geminiRespPtr("thinking"), "thinking"},
		"reasoning_content_takes_precedence": {geminiRespPtr("thinking"), geminiRespPtr("other thinking"), "thinking"},
		"whitespace_is_preserved":            {geminiRespPtr(" \n"), geminiRespPtr("thinking"), " \n"},
		"both_absent":                        {nil, nil, ""},
		"both_empty":                         {geminiRespPtr(""), geminiRespPtr(""), ""},
		"empty_reasoning_content":            {geminiRespPtr(""), nil, ""},
	}
}

func geminiRespPtr[T any](value T) *T {
	return &value
}
