package oaichat

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponseOpenAI2ClaudeToolUseInputIsObject(t *testing.T) {
	tests := []struct {
		name string
		args string
		want map[string]interface{}
	}{
		{name: "object", args: `{"q":"x"}`, want: map[string]interface{}{"q": "x"}},
		{name: "empty", args: "", want: map[string]interface{}{}},
		{name: "invalid", args: "{", want: map[string]interface{}{}},
		{name: "null", args: "null", want: map[string]interface{}{}},
		{name: "array", args: `["x"]`, want: map[string]interface{}{}},
		{name: "string", args: `"x"`, want: map[string]interface{}{}},
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
			assert.Equal(t, tt.want, resp.Content[0].Input)
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

// collectTextDeltas returns the concatenated text from content_block_delta events.
func collectTextDeltas(responses []*dto.ClaudeResponse) string {
	var sb strings.Builder
	for _, r := range responses {
		if r.Type == "content_block_delta" && r.Delta != nil && r.Delta.Text != nil {
			sb.WriteString(*r.Delta.Text)
		}
	}
	return sb.String()
}

// countTerminalEvents counts the terminal events in a response slice.
func countTerminalEvents(responses []*dto.ClaudeResponse) (stops, deltas, messageStops int) {
	for _, r := range responses {
		switch r.Type {
		case "content_block_stop":
			stops++
		case "message_delta":
			deltas++
		case "message_stop":
			messageStops++
		}
	}
	return
}

// TestStreamResponseOpenAI2ClaudeFinishWithContentNoUsagePreservesTextAndClosesOnce
// covers P1: a finish_reason sharing a chunk with the final text delta but no usage
// must retain the full text and emit the terminal events exactly once (the host
// finalizer supplies usage later).
func TestStreamResponseOpenAI2ClaudeFinishWithContentNoUsagePreservesTextAndClosesOnce(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}
	info.SendResponseCount = 1

	text1 := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("Hello")}},
		},
	}, info)
	require.Len(t, text1, 3)
	require.Equal(t, "content_block_delta", text1[2].Type)
	require.NotNil(t, text1[2].Delta)
	require.NotNil(t, text1[2].Delta.Text)
	assert.Equal(t, "Hello", *text1[2].Delta.Text)

	info.SendResponseCount = 2
	// Final delta + finish_reason, but no usage on this chunk.
	finishing := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr(" world")},
				FinishReason: ptr("stop"),
			},
		},
	}, info)

	// The finishing delta must be forwarded (no lost content).
	fullText := collectTextDeltas(finishing)
	assert.Equal(t, " world", fullText, "finishing delta must be preserved before deferral")
	// Deferred: no terminal events yet because usage is missing.
	stops, deltas, messageStops := countTerminalEvents(finishing)
	assert.Equal(t, 0, stops+deltas+messageStops, "terminals deferred until usage present")
	assert.False(t, info.ClaudeConvertInfo.Done, "stream not closed until usage arrives")

	// Host finalizer supplies usage and closes the stream exactly once.
	info.ClaudeConvertInfo.Usage = &dto.Usage{PromptTokens: 7, CompletionTokens: 3, TotalTokens: 10}
	final := FinalizeStreamResponseOpenAI2Claude(info)
	stops, deltas, messageStops = countTerminalEvents(final)
	assert.Equal(t, 1, stops, "one content_block_stop")
	assert.Equal(t, 1, deltas, "one message_delta")
	assert.Equal(t, 1, messageStops, "one message_stop")
	require.NotNil(t, final[1].Usage)
	assert.Equal(t, 7, final[1].Usage.InputTokens)
	assert.Equal(t, 3, final[1].Usage.OutputTokens)
	require.NotNil(t, final[1].Delta)
	require.NotNil(t, final[1].Delta.StopReason)
	assert.Equal(t, "end_turn", *final[1].Delta.StopReason)

	// Idempotent: a second finalizer returns nothing.
	require.Empty(t, FinalizeStreamResponseOpenAI2Claude(info))
}

// TestStreamResponseOpenAI2ClaudeDelayedUsagePreserved verifies usage that arrives
// in a later choices:[] usage-only chunk is attached by the finalizer with its
// real values (not silently dropped or replaced by local estimation).
func TestStreamResponseOpenAI2ClaudeDelayedUsagePreserved(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}
	info.SendResponseCount = 1
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_2",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("Hi")}},
		},
	}, info)

	info.SendResponseCount = 2
	// Finish with no usage.
	finishing := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_2",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{}, FinishReason: ptr("stop")},
		},
	}, info)
	require.Empty(t, finishing, "empty finishing chunk with no usage must not emit terminals")
	assert.False(t, info.ClaudeConvertInfo.Done)

	// Later usage-only chunk closes the stream with the upstream usage values.
	info.SendResponseCount = 3
	usageChunk := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:      "chatcmpl_2",
		Model:   "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{},
		Usage:   &dto.Usage{PromptTokens: 4, CompletionTokens: 2, TotalTokens: 6},
	}, info)
	stops, deltas, messageStops := countTerminalEvents(usageChunk)
	assert.Equal(t, 1, stops)
	assert.Equal(t, 1, deltas)
	assert.Equal(t, 1, messageStops)
	assert.True(t, info.ClaudeConvertInfo.Done)

	// The deferred usage is attached with its real values, not zeroed.
	require.NotNil(t, usageChunk[1].Usage)
	assert.Equal(t, 4, usageChunk[1].Usage.InputTokens)
	assert.Equal(t, 2, usageChunk[1].Usage.OutputTokens)
	require.NotNil(t, usageChunk[1].Delta)
	require.NotNil(t, usageChunk[1].Delta.StopReason)
	assert.Equal(t, "end_turn", *usageChunk[1].Delta.StopReason)
}

// TestStreamResponseOpenAI2ClaudeFirstChunkFinishNoUsageDefers covers the
// distinct first-chunk boundary: when the very first chunk (SendResponseCount==1)
// carries both visible text and finish_reason but no usage, the converter must
// forward the text delta and defer the terminal block until the finalizer
// supplies usage. This is separate from the multi-chunk finish path and must not
// prematurely emit (or drop) terminals when usage is absent.
func TestStreamResponseOpenAI2ClaudeFirstChunkFinishNoUsageDefers(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}
	info.SendResponseCount = 1

	first := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_9",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("hello")},
				FinishReason: ptr("stop"),
			},
		},
	}, info)

	// message_start + text content_block_start + text delta were emitted, and the
	// text delta is preserved (no lost content on the single finishing chunk).
	require.NotEmpty(t, first)
	assert.Equal(t, "hello", collectTextDeltas(first))
	// No terminal events yet: usage is still missing.
	stops, deltas, messageStops := countTerminalEvents(first)
	assert.Equal(t, 0, stops+deltas+messageStops, "terminals deferred until usage present")
	assert.False(t, info.ClaudeConvertInfo.Done, "stream not closed until usage arrives")

	// Finalizer closes exactly once with the attached usage values.
	info.ClaudeConvertInfo.Usage = &dto.Usage{PromptTokens: 9, CompletionTokens: 1, TotalTokens: 10}
	final := FinalizeStreamResponseOpenAI2Claude(info)
	stops, deltas, messageStops = countTerminalEvents(final)
	assert.Equal(t, 1, stops)
	assert.Equal(t, 1, deltas)
	assert.Equal(t, 1, messageStops)
	require.NotNil(t, final[1].Usage)
	assert.Equal(t, 9, final[1].Usage.InputTokens)
	assert.Equal(t, 1, final[1].Usage.OutputTokens)
	require.NotNil(t, final[1].Delta)
	require.NotNil(t, final[1].Delta.StopReason)
	assert.Equal(t, "end_turn", *final[1].Delta.StopReason)

	require.Empty(t, FinalizeStreamResponseOpenAI2Claude(info), "idempotent: second finalize returns nothing")
}

// TestStreamResponseOpenAI2ClaudeFinishWithUsageSameChunk closes inline when the
// finishing chunk carries both content and usage (no deferral, no lost text).
func TestStreamResponseOpenAI2ClaudeFinishWithUsageSameChunk(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}
	info.SendResponseCount = 1
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_3",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("A")}},
		},
	}, info)

	info.SendResponseCount = 2
	finishing := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_3",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("B")},
				FinishReason: ptr("stop"),
			},
		},
		Usage: &dto.Usage{PromptTokens: 5, CompletionTokens: 1, TotalTokens: 6},
	}, info)

	// Full text retained: "B" is present, no duplicate terminal.
	assert.Equal(t, "B", collectTextDeltas(finishing))
	stops, deltas, messageStops := countTerminalEvents(finishing)
	assert.Equal(t, 1, stops)
	assert.Equal(t, 1, deltas)
	assert.Equal(t, 1, messageStops)
	assert.True(t, info.ClaudeConvertInfo.Done)
}

// TestFinalizeStreamResponseOpenAI2ClaudeEmptyStreamEmitsNothing covers the
// empty/role-only upstream: when no content block was ever opened, the
// finalizer must not synthesize a bare message_delta/message_stop pair
// without a matching content_block_start.
func TestFinalizeStreamResponseOpenAI2ClaudeEmptyStreamEmitsNothing(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{LastMessagesType: convmeta.LastMessageTypeNone},
	}
	info.SendResponseCount = 1
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:      "chatcmpl_empty",
		Model:   "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant"}}},
	}, info)

	final := FinalizeStreamResponseOpenAI2Claude(info)
	require.Empty(t, final, "empty stream must not synthesize terminal events")
}
