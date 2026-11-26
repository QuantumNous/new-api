package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponseOpenAI2ClaudeToolUseInputIsObject(t *testing.T) {
	tests := []struct {
		name string
		args string
		want string
	}{
		{name: "large integer", args: `{"id":9007199254740993}`, want: `{"id":9007199254740993}`},
		{name: "nested integer", args: `{"ids":[18446744073709551615]}`, want: `{"ids":[18446744073709551615]}`},
		{name: "precise decimal", args: `{"value":0.123456789012345678901}`, want: `{"value":0.123456789012345678901}`},
		{name: "object", args: `{"q":"x"}`, want: `{"q":"x"}`},
		{name: "empty", args: "", want: `{}`},
		{name: "invalid", args: "{", want: `{}`},
		{name: "null", args: "null", want: `{}`},
		{name: "array", args: `["x"]`, want: `{}`},
		{name: "string", args: `"x"`, want: `{}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := dto.Message{Role: "assistant"}
			msg.SetToolCalls([]dto.ToolCallRequest{
				{
					ID:   "call_1",
					Type: "function",
					Function: dto.FunctionRequest{
						Name:      "lookup",
						Arguments: tt.args,
					},
				},
			})

			resp := ResponseOpenAI2Claude(&dto.OpenAITextResponse{
				Id:    "chatcmpl_1",
				Model: "gpt-test",
				Choices: []dto.OpenAITextResponseChoice{
					{Message: msg, FinishReason: "tool_calls"},
				},
			}, nil)

			require.Len(t, resp.Content, 1)
			assert.Equal(t, "tool_use", resp.Content[0].Type)
			encoded, err := kitutil.Marshal(resp.Content[0].Input)
			require.NoError(t, err)
			assert.Equal(t, tt.want, string(encoded))
		})
	}
}

func TestResponseOpenAI2ClaudeUsageCarriesOpenAIBillingUsage(t *testing.T) {
	resp := ResponseOpenAI2Claude(&dto.OpenAITextResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.OpenAITextResponseChoice{
			{Message: dto.Message{Role: "assistant", Content: "hello"}, FinishReason: "stop"},
		},
		Usage: dto.Usage{
			PromptTokens:     11,
			CompletionTokens: 5,
			TotalTokens:      16,
		},
	}, nil)

	require.NotNil(t, resp.Usage)
	assert.Equal(t, 11, resp.Usage.InputTokens)
	assert.Equal(t, 5, resp.Usage.OutputTokens)
	require.NotNil(t, resp.Usage.BillingUsage)
	require.NotNil(t, resp.Usage.BillingUsage.OpenAIUsage)
	assert.Equal(t, dto.BillingUsageSourceOAIChat, resp.Usage.BillingUsage.Source)
	assert.Equal(t, dto.BillingUsageSemanticOpenAI, resp.Usage.BillingUsage.Semantic)
	assert.Equal(t, 11, resp.Usage.BillingUsage.OpenAIUsage.PromptTokens)
	assert.Equal(t, 5, resp.Usage.BillingUsage.OpenAIUsage.CompletionTokens)
	assert.Equal(t, 16, resp.Usage.BillingUsage.OpenAIUsage.TotalTokens)
	assert.Nil(t, resp.Usage.BillingUsage.OpenAIUsage.BillingUsage)
}

func TestResponseOpenAI2ClaudePreservesReasoningBeforeText(t *testing.T) {
	message := dto.Message{Role: "assistant", Content: "final answer"}
	message.ReasoningContent = ptr("considering the request")
	resp := ResponseOpenAI2Claude(&dto.OpenAITextResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.OpenAITextResponseChoice{
			{Message: message, FinishReason: "stop"},
		},
	}, nil)

	require.Len(t, resp.Content, 2)
	assert.Equal(t, "thinking", resp.Content[0].Type)
	require.NotNil(t, resp.Content[0].Thinking)
	assert.Equal(t, "considering the request", *resp.Content[0].Thinking)
	assert.Equal(t, "text", resp.Content[1].Type)
	assert.Equal(t, "final answer", resp.Content[1].GetText())
}

func TestBuildClaudeUsageFromOpenAICacheWriteUsage(t *testing.T) {
	usage := buildClaudeUsageFromOpenAIUsage(&dto.Usage{
		PromptTokens:     3619,
		CompletionTokens: 36,
		TotalTokens:      3655,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:     2921,
			CacheWriteTokens: 3616,
		},
	})

	require.NotNil(t, usage)
	// Claude semantics reports input_tokens excluding cache read/write; the
	// overlapping unadjusted prefixes drive the remainder negative, clamp to 0.
	assert.Equal(t, 0, usage.InputTokens)
	assert.Equal(t, 2921, usage.CacheReadInputTokens)
	assert.Equal(t, 3616, usage.CacheCreationInputTokens)
	assert.Equal(t, 36, usage.OutputTokens)
	require.NotNil(t, usage.BillingUsage)
	require.NotNil(t, usage.BillingUsage.OpenAIUsage)
	assert.Equal(t, dto.BillingUsageSemanticOpenAI, usage.BillingUsage.Semantic)
	assert.Equal(t, 3616, usage.BillingUsage.OpenAIUsage.PromptTokensDetails.CacheWriteTokens)
}

func TestStreamResponseOpenAI2ClaudeClosesTextThinkingAndToolBlocks(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeNone,
		},
	}

	info.SendResponseCount = 1
	textResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: ptr("hello"),
				},
			},
		},
	}, info)
	require.Len(t, textResponses, 3)
	assert.Equal(t, "message_start", textResponses[0].Type)
	assert.Equal(t, "content_block_start", textResponses[1].Type)
	assert.Equal(t, 0, textResponses[1].GetIndex())
	assert.Equal(t, "content_block_delta", textResponses[2].Type)

	info.SendResponseCount = 2
	thinkingResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ReasoningContent: ptr("thinking"),
				},
			},
		},
	}, info)
	require.Len(t, thinkingResponses, 3)
	assert.Equal(t, "content_block_stop", thinkingResponses[0].Type)
	assert.Equal(t, 0, thinkingResponses[0].GetIndex())
	assert.Equal(t, "content_block_start", thinkingResponses[1].Type)
	assert.Equal(t, 1, thinkingResponses[1].GetIndex())
	assert.Equal(t, "thinking", thinkingResponses[1].ContentBlock.Type)
	assert.Equal(t, "content_block_delta", thinkingResponses[2].Type)

	info.SendResponseCount = 3
	toolResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: ptr(0),
							ID:    "call_1",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "lookup",
								Arguments: `{"q":"x"}`,
							},
						},
					},
				},
			},
		},
	}, info)
	require.Len(t, toolResponses, 3)
	assert.Equal(t, "content_block_stop", toolResponses[0].Type)
	assert.Equal(t, 1, toolResponses[0].GetIndex())
	assert.Equal(t, "content_block_start", toolResponses[1].Type)
	assert.Equal(t, 2, toolResponses[1].GetIndex())
	assert.Equal(t, "tool_use", toolResponses[1].ContentBlock.Type)
	assert.Equal(t, "content_block_delta", toolResponses[2].Type)

	info.SendResponseCount = 4
	finishResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{FinishReason: ptr("tool_calls")},
		},
		Usage: &dto.Usage{
			PromptTokens:     7,
			CompletionTokens: 3,
			TotalTokens:      10,
		},
	}, info)
	finishResponses = append(finishResponses, FinalizeStreamResponseOpenAI2Claude(info)...)
	require.Len(t, finishResponses, 3)
	assert.Equal(t, "content_block_stop", finishResponses[0].Type)
	assert.Equal(t, 2, finishResponses[0].GetIndex())
	assert.Equal(t, "message_delta", finishResponses[1].Type)
	assert.Equal(t, "tool_use", *finishResponses[1].Delta.StopReason)
	require.NotNil(t, finishResponses[1].Usage)
	require.NotNil(t, finishResponses[1].Usage.BillingUsage)
	require.NotNil(t, finishResponses[1].Usage.BillingUsage.OpenAIUsage)
	assert.Equal(t, 7, finishResponses[1].Usage.BillingUsage.OpenAIUsage.PromptTokens)
	assert.Equal(t, 3, finishResponses[1].Usage.BillingUsage.OpenAIUsage.CompletionTokens)
	assert.Equal(t, "message_stop", finishResponses[2].Type)
}

func TestStreamResponseOpenAI2ClaudeFirstFrameUsesUpstreamUsageWhenPresent(t *testing.T) {
	info := &convmeta.Values{
		EstimatePromptTokens: 32,
		SendResponseCount:    1,
		ClaudeConvertInfo:    &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}

	responses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("hello")},
		}},
		Usage: &dto.Usage{PromptTokens: 29, CompletionTokens: 0, TotalTokens: 29},
	}, info)
	require.NotEmpty(t, responses)
	require.Equal(t, "message_start", responses[0].Type)
	require.NotNil(t, responses[0].Message)
	require.NotNil(t, responses[0].Message.Usage)
	assert.Equal(t, 29, responses[0].Message.Usage.InputTokens)
}

func TestStreamResponseOpenAI2ClaudeMessageDeltaCorrectsEstimatedFirstFrame(t *testing.T) {
	info := &convmeta.Values{
		EstimatePromptTokens: 32,
		SendResponseCount:    1,
		ClaudeConvertInfo:    &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}

	first := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("hello")},
		}},
	}, info)
	require.NotEmpty(t, first)
	require.Equal(t, "message_start", first[0].Type)
	require.NotNil(t, first[0].Message.Usage)
	assert.Equal(t, 32, first[0].Message.Usage.InputTokens)

	info.SendResponseCount = 2
	finish := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			FinishReason: ptr("stop"),
		}},
		Usage: &dto.Usage{PromptTokens: 29, CompletionTokens: 4, TotalTokens: 33},
	}, info)
	finish = append(finish, FinalizeStreamResponseOpenAI2Claude(info)...)
	var delta *dto.ClaudeResponse
	for _, resp := range finish {
		if resp.Type == "message_delta" {
			delta = resp
			break
		}
	}
	require.NotNil(t, delta)
	require.NotNil(t, delta.Usage)
	assert.Equal(t, 29, delta.Usage.InputTokens)
	assert.Equal(t, 4, delta.Usage.OutputTokens)
}

func TestStreamResponseOpenAI2ClaudeMessageDeltaDoesNotZeroFirstFrameCache(t *testing.T) {
	info := &convmeta.Values{
		EstimatePromptTokens: 8,
		SendResponseCount:    1,
		ClaudeConvertInfo:    &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}

	first := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("hello")},
		}},
		Usage: &dto.Usage{
			PromptTokens:     40,
			CompletionTokens: 0,
			TotalTokens:      40,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:         20,
				CachedCreationTokens: 10,
			},
		},
	}, info)
	require.Equal(t, "message_start", first[0].Type)
	require.NotNil(t, first[0].Message.Usage)
	assert.Equal(t, 20, first[0].Message.Usage.CacheReadInputTokens)
	assert.Equal(t, 10, first[0].Message.Usage.CacheCreationInputTokens)

	info.SendResponseCount = 2
	finish := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			FinishReason: ptr("stop"),
		}},
		Usage: &dto.Usage{PromptTokens: 29, CompletionTokens: 4, TotalTokens: 33},
	}, info)
	finish = append(finish, FinalizeStreamResponseOpenAI2Claude(info)...)
	var delta *dto.ClaudeResponse
	for _, resp := range finish {
		if resp.Type == "message_delta" {
			delta = resp
			break
		}
	}
	require.NotNil(t, delta)
	require.NotNil(t, delta.Usage)
	assert.Equal(t, 29, delta.Usage.InputTokens)
	assert.Equal(t, 20, delta.Usage.CacheReadInputTokens)
	assert.Equal(t, 10, delta.Usage.CacheCreationInputTokens)
}

func TestStreamResponseOpenAI2ClaudeGeminiBillingUsageOnStartAndDelta(t *testing.T) {
	info := &convmeta.Values{
		EstimatePromptTokens: 4994,
		SendResponseCount:    1,
		ClaudeConvertInfo:    &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}

	firstUsage := &dto.Usage{
		PromptTokens:     3868,
		CompletionTokens: 0,
		TotalTokens:      3868,
		BillingUsage: dto.NewGeminiChatBillingUsage(&dto.GeminiUsageMetadata{
			PromptTokenCount: 3868,
			TotalTokenCount:  3868,
		}),
	}
	first := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("hello")},
		}},
		Usage: firstUsage,
	}, info)
	require.NotEmpty(t, first)
	require.Equal(t, "message_start", first[0].Type)
	require.NotNil(t, first[0].Message)
	require.NotNil(t, first[0].Message.Usage)
	assert.Equal(t, 3868, first[0].Message.Usage.InputTokens)
	require.NotNil(t, first[0].Message.Usage.BillingUsage)
	assert.Equal(t, dto.BillingUsageSourceGeminiChat, first[0].Message.Usage.BillingUsage.Source)
	assert.Equal(t, dto.BillingUsageSemanticGemini, first[0].Message.Usage.BillingUsage.Semantic)
	require.NotNil(t, first[0].Message.Usage.BillingUsage.GeminiUsageMetadata)
	assert.Equal(t, 3868, first[0].Message.Usage.BillingUsage.GeminiUsageMetadata.PromptTokenCount)

	info.SendResponseCount = 2
	finish := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			FinishReason: ptr("stop"),
		}},
		Usage: &dto.Usage{
			PromptTokens:     3868,
			CompletionTokens: 12,
			TotalTokens:      3880,
			BillingUsage: dto.NewGeminiChatBillingUsage(&dto.GeminiUsageMetadata{
				PromptTokenCount:     3868,
				CandidatesTokenCount: 12,
				TotalTokenCount:      3880,
			}),
		},
	}, info)
	finish = append(finish, FinalizeStreamResponseOpenAI2Claude(info)...)
	var delta *dto.ClaudeResponse
	for _, resp := range finish {
		if resp.Type == "message_delta" {
			delta = resp
			break
		}
	}
	require.NotNil(t, delta)
	require.NotNil(t, delta.Usage)
	assert.Equal(t, 3868, delta.Usage.InputTokens)
	assert.Equal(t, 12, delta.Usage.OutputTokens)
	require.NotNil(t, delta.Usage.BillingUsage)
	assert.Equal(t, dto.BillingUsageSourceGeminiChat, delta.Usage.BillingUsage.Source)
	assert.Equal(t, dto.BillingUsageSemanticGemini, delta.Usage.BillingUsage.Semantic)
	require.NotNil(t, delta.Usage.BillingUsage.GeminiUsageMetadata)
	assert.Equal(t, 3868, delta.Usage.BillingUsage.GeminiUsageMetadata.PromptTokenCount)
	assert.Equal(t, 12, delta.Usage.BillingUsage.GeminiUsageMetadata.CandidatesTokenCount)
}

func TestNormalizeCacheCreationSplit(t *testing.T) {
	cache5m, cache1h := NormalizeCacheCreationSplit(10, 3, 2)
	assert.Equal(t, 8, cache5m)
	assert.Equal(t, 2, cache1h)

	cache5m, cache1h = NormalizeCacheCreationSplit(3, 5, 1)
	assert.Equal(t, 5, cache5m)
	assert.Equal(t, 1, cache1h)
}

func ptr[T any](value T) *T {
	return &value
}

func TestOpenAIThinkingUsageMapping(t *testing.T) {
	cases := []struct {
		name, usage string
		want        *int
	}{
		{"native", `{"completion_tokens_details":{"reasoning_tokens":66}}`, ptr(66)},
		{"absent", `{}`, nil},
		{"empty details", `{"completion_tokens_details":{}}`, nil},
		{"null", `{"completion_tokens_details":{"reasoning_tokens":null}}`, nil},
		{"zero", `{"completion_tokens_details":{"reasoning_tokens":0}}`, ptr(0)},
		{"snapshot", `{"billing_usage":{"source":"oai_chat","semantic":"openai","openai_usage":{"completion_tokens":80,"completion_tokens_details":{"reasoning_tokens":66}}}}`, ptr(66)},
		{"native wins", `{"completion_tokens_details":{"reasoning_tokens":12},"billing_usage":{"source":"oai_chat","openai_usage":{"completion_tokens_details":{"reasoning_tokens":66}}}}`, ptr(12)},
		{"native zero wins", `{"completion_tokens_details":{"reasoning_tokens":0},"billing_usage":{"source":"oai_chat","openai_usage":{"completion_tokens_details":{"reasoning_tokens":66}}}}`, ptr(0)},
		{"unrecognized snapshot", `{"billing_usage":{"source":"unknown","openai_usage":{"completion_tokens_details":{"reasoning_tokens":66}}}}`, nil},
		{"estimated snapshot", `{"billing_usage":{"source":"oai_chat","estimated":true,"openai_usage":{"completion_tokens_details":{"reasoning_tokens":66}}}}`, nil},
		{"negative", `{"completion_tokens_details":{"reasoning_tokens":-1}}`, ptr(0)},
		{"exceeds total", `{"completion_tokens_details":{"reasoning_tokens":99}}`, ptr(80)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var usage dto.Usage
			require.NoError(t, kitutil.UnmarshalJsonStr(tc.usage, &usage))
			usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens = 100, 80, 180
			usage.PromptTokensDetails.CachedTokens = 20
			usage.PromptTokensDetails.CachedCreationTokens = 10
			usage.ClaudeCacheCreation5mTokens, usage.ClaudeCacheCreation1hTokens = 4, 6
			before, err := kitutil.Marshal(usage)
			require.NoError(t, err)
			response := ResponseOpenAI2Claude(&dto.OpenAITextResponse{Usage: usage}, nil)
			assert.Equal(t, 80, response.Usage.OutputTokens)
			assert.Equal(t, 70, response.Usage.InputTokens)
			assert.Equal(t, 20, response.Usage.CacheReadInputTokens)
			assert.Equal(t, 10, response.Usage.CacheCreationInputTokens)
			assert.Equal(t, 4, response.Usage.GetCacheCreation5mTokens())
			assert.Equal(t, 6, response.Usage.GetCacheCreation1hTokens())
			if tc.want == nil {
				assert.Nil(t, response.Usage.OutputTokensDetails)
			} else {
				require.NotNil(t, response.Usage.OutputTokensDetails)
				assert.Equal(t, *tc.want, response.Usage.OutputTokensDetails.ThinkingTokens)
			}
			after, err := kitutil.Marshal(usage)
			require.NoError(t, err)
			assert.Equal(t, string(before), string(after), "mapping must not mutate accounting or the raw snapshot")
			if usage.BillingUsage != nil {
				assert.Equal(t, usage.BillingUsage, response.Usage.BillingUsage)
			} else {
				assert.Equal(t, usage.CompletionTokenDetails, response.Usage.BillingUsage.OpenAIUsage.CompletionTokenDetails)
			}
		})
	}
}

func TestOpenAIThinkingCumulativeStreamUsage(t *testing.T) {
	for _, tc := range []struct {
		name    string
		updates []string
		want    *int
	}{
		{"usage only after finish", []string{`{"completion_tokens_details":{"reasoning_tokens":66}}`}, ptr(66)},
		{"snapshot only", []string{`{"billing_usage":{"source":"oai_chat","openai_usage":{"completion_tokens":80,"completion_tokens_details":{"reasoning_tokens":66}}}}`}, ptr(66)},
		{"missing", []string{`{}`, `{"completion_tokens_details":{}}`}, nil},
		{"omitted later", []string{`{"completion_tokens_details":{"reasoning_tokens":66}}`, `{}`}, ptr(66)},
		{"explicit zero", []string{`{"completion_tokens_details":{"reasoning_tokens":66}}`, `{"completion_tokens_details":{"reasoning_tokens":0}}`, `{}`}, ptr(0)},
		{"updated not summed", []string{`{"completion_tokens_details":{"reasoning_tokens":66}}`, `{"completion_tokens_details":{"reasoning_tokens":70}}`}, ptr(70)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &convmeta.Values{SendResponseCount: 1}
			start := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
				Id: "chat-test", Model: "gpt-test",
				Choices: []dto.ChatCompletionsStreamResponseChoice{{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("answer")}}},
				Usage:   &dto.Usage{PromptTokens: 100, CompletionTokens: 80, TotalTokens: 180},
			}, info)
			require.Equal(t, "message_start", start[0].Type)
			info.SendResponseCount++
			finish := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: ptr("stop")}},
			}, info)
			assert.Empty(t, finish, "finish_reason must not close the stream before final usage")
			for _, raw := range tc.updates {
				var usage dto.Usage
				require.NoError(t, kitutil.UnmarshalJsonStr(raw, &usage))
				info.SendResponseCount++
				assert.Empty(t, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{Usage: &usage}, info))
			}
			final := FinalizeStreamResponseOpenAI2Claude(info)
			require.Len(t, final, 3)
			assert.Equal(t, "content_block_stop", final[0].Type)
			assert.Equal(t, "message_delta", final[1].Type)
			assert.Equal(t, "end_turn", *final[1].Delta.StopReason)
			assert.Equal(t, "message_stop", final[2].Type)
			usage := final[1].Usage
			require.NotNil(t, usage)
			assert.Equal(t, 80, usage.OutputTokens)
			if tc.want == nil {
				assert.Nil(t, usage.OutputTokensDetails)
			} else {
				require.NotNil(t, usage.OutputTokensDetails)
				assert.Equal(t, *tc.want, usage.OutputTokensDetails.ThinkingTokens)
			}
			assert.Empty(t, FinalizeStreamResponseOpenAI2Claude(info), "single terminal sequence")
		})
	}
}

// A restored Claude snapshot owns output_tokens and its own thinking count.
// Stream and non-stream conversion apply the same source order: the snapshot's
// count (including explicit 0) wins over the outer Chat count, and the shown
// value is bounded by the Claude output total actually returned.
func TestRestoredClaudeSnapshotThinkingSurvivesStream(t *testing.T) {
	for _, tc := range []struct {
		name               string
		snapshotThinking   *dto.ClaudeOutputTokensDetails
		outerTotal         int
		outerReasoning     *int
		wantOutput, wantTk int
	}{
		{"outer has no reasoning", &dto.ClaudeOutputTokensDetails{ThinkingTokens: 7}, 10, nil, 10, 7},
		{"outer total and reasoning differ", &dto.ClaudeOutputTokensDetails{ThinkingTokens: 7}, 100, ptr(80), 10, 7},
		{"explicit zero beats outer positive", &dto.ClaudeOutputTokensDetails{ThinkingTokensPresent: true}, 100, ptr(80), 10, 0},
		{"no snapshot count falls back within snapshot total", nil, 100, ptr(80), 10, 10},
	} {
		t.Run(tc.name, func(t *testing.T) {
			snapshot := dto.NewClaudeMessagesBillingUsage(&dto.ClaudeUsage{InputTokens: 100, OutputTokens: 10, OutputTokensDetails: tc.snapshotThinking})
			require.NotNil(t, snapshot)
			before, err := kitutil.Marshal(snapshot)
			require.NoError(t, err)
			usage := dto.Usage{PromptTokens: 100, CompletionTokens: tc.outerTotal, BillingUsage: snapshot}
			if tc.outerReasoning != nil {
				usage.CompletionTokenDetails.ReasoningTokens = *tc.outerReasoning
			}

			nonStream := ResponseOpenAI2Claude(&dto.OpenAITextResponse{Usage: usage}, nil).Usage
			info := &convmeta.Values{SendResponseCount: 1}
			StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{Usage: &usage}, info)
			final := FinalizeStreamResponseOpenAI2Claude(info)
			stream := final[len(final)-2].Usage
			for _, got := range []*dto.ClaudeUsage{nonStream, stream} {
				assert.Equal(t, tc.wantOutput, got.OutputTokens)
				require.NotNil(t, got.OutputTokensDetails)
				assert.True(t, got.OutputTokensDetails.HasThinkingTokens())
				assert.Equal(t, tc.wantTk, got.OutputTokensDetails.ThinkingTokens)
			}
			after, err := kitutil.Marshal(snapshot)
			require.NoError(t, err)
			assert.Equal(t, string(before), string(after), "the original snapshot is not modified")
		})
	}
}

func TestThinkingStreamBoundsFollowFinalTotal(t *testing.T) {
	for _, tc := range []struct {
		name   string
		totals []int
		want   int
	}{
		{"late total", []int{0, 80}, 66},
		{"corrected total", []int{80, 40}, 40},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &convmeta.Values{SendResponseCount: 1}
			first := &dto.Usage{CompletionTokens: tc.totals[0], CompletionTokenDetails: dto.OutputTokenDetails{ReasoningTokens: 66}}
			StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{Usage: first}, info)
			info.SendResponseCount++
			StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{Usage: &dto.Usage{CompletionTokens: tc.totals[1]}}, info)
			final := FinalizeStreamResponseOpenAI2Claude(info)
			require.Len(t, final, 2)
			assert.Equal(t, tc.totals[1], final[0].Usage.OutputTokens)
			require.NotNil(t, final[0].Usage.OutputTokensDetails)
			assert.Equal(t, tc.want, final[0].Usage.OutputTokensDetails.ThinkingTokens)
			assert.Equal(t, 66, final[0].Usage.BillingUsage.OpenAIUsage.CompletionTokenDetails.ReasoningTokens)
		})
	}
}
