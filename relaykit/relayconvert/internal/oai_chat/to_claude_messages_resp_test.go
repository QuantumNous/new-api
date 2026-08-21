package oaichat

import (
	"fmt"
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
	require.Len(t, toolResponses, 1)
	assert.Equal(t, "content_block_stop", toolResponses[0].Type)
	assert.Equal(t, 1, toolResponses[0].GetIndex())

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
	require.Len(t, finishResponses, 5)
	assert.Equal(t, "content_block_start", finishResponses[0].Type)
	assert.Equal(t, 2, finishResponses[0].GetIndex())
	assert.Equal(t, "content_block_delta", finishResponses[1].Type)
	assert.Equal(t, "content_block_stop", finishResponses[2].Type)
	assert.Equal(t, "message_delta", finishResponses[3].Type)
	assert.Equal(t, "tool_use", *finishResponses[3].Delta.StopReason)
	require.NotNil(t, finishResponses[3].Usage)
	require.NotNil(t, finishResponses[3].Usage.BillingUsage)
	require.NotNil(t, finishResponses[3].Usage.BillingUsage.OpenAIUsage)
	assert.Equal(t, 7, finishResponses[3].Usage.BillingUsage.OpenAIUsage.PromptTokens)
	assert.Equal(t, 3, finishResponses[3].Usage.BillingUsage.OpenAIUsage.CompletionTokens)
	assert.Equal(t, "message_stop", finishResponses[4].Type)
}

func TestNormalizeCacheCreationSplit(t *testing.T) {
	cache5m, cache1h := NormalizeCacheCreationSplit(10, 3, 2)
	assert.Equal(t, 8, cache5m)
	assert.Equal(t, 2, cache1h)

	cache5m, cache1h = NormalizeCacheCreationSplit(3, 5, 1)
	assert.Equal(t, 5, cache5m)
	assert.Equal(t, 1, cache1h)
}

// TestStreamResponseOpenAI2ClaudeParallelToolCallsHaveValidBlockLifecycle
// drives two parallel tool_use blocks (e.g. GLM-5.2 packing multiple tool
// calls per chunk) through the OpenAI→Claude stream converter and asserts the
// Anthropic SSE state machine stays valid: every content_block_delta/stop
// targets an actively-open block index, no block starts twice, and every
// started block is stopped (#4389).
func TestStreamResponseOpenAI2ClaudeParallelToolCallsHaveValidBlockLifecycle(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{},
	}

	info.SendResponseCount = 1
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_1", Model: "glm",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: ptr(0), ID: "call_weather", Function: dto.FunctionResponse{Name: "get_weather"}},
				{Index: ptr(1), ID: "call_time", Function: dto.FunctionResponse{Name: "get_time"}},
			}},
		}},
	}, info)

	info.SendResponseCount = 2
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: ptr(0), Function: dto.FunctionResponse{Arguments: `{"city":"Tokyo"}`}},
				{Index: ptr(1), Function: dto.FunctionResponse{Arguments: `{}`}},
			}},
		}},
	}, info)...)

	info.SendResponseCount = 3
	finishReason := "tool_calls"
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: &finishReason}},
		Usage:   &dto.Usage{},
	}, info)...)

	started := map[int]bool{}
	stopped := map[int]bool{}
	// capture argument payloads by block index so a converter that drops deltas
	// (not just reorders them) still fails the test.
	deltas := map[int][]string{}
	for _, event := range events {
		if event.Index == nil {
			continue
		}
		idx := *event.Index
		switch event.Type {
		case "content_block_start":
			require.False(t, started[idx], "block %d started twice", idx)
			started[idx] = true
		case "content_block_delta":
			assert.True(t, started[idx], "block %d received delta before start", idx)
			assert.False(t, stopped[idx], "block %d received delta after stop", idx)
			if event.Delta != nil && event.Delta.PartialJson != nil {
				deltas[idx] = append(deltas[idx], *event.Delta.PartialJson)
			}
		case "content_block_stop":
			assert.True(t, started[idx], "block %d stopped before start", idx)
			require.False(t, stopped[idx], "block %d stopped twice", idx)
			stopped[idx] = true
		}
	}

	assert.Equal(t, map[int]bool{0: true, 1: true}, started)
	assert.Equal(t, started, stopped)
	assert.Equal(t, []string{`{"city":"Tokyo"}`}, deltas[0], "block 0 must deliver its argument payload")
	assert.Equal(t, []string{`{}`}, deltas[1], "block 1 must deliver its argument payload")
}

// TestStreamResponseOpenAI2ClaudeReplayedToolNameDoesNotDuplicateStart covers
// providers that echo the full tool_call (id+name) in every delta instead of
// streaming incremental fragments: a replayed name for an already-open index
// must not emit a second content_block_start.
func TestStreamResponseOpenAI2ClaudeReplayedToolNameDoesNotDuplicateStart(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{},
	}

	info.SendResponseCount = 1
	first := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_1", Model: "glm",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: ptr(0), ID: "call_weather", Function: dto.FunctionResponse{Name: "get_weather"}},
			}},
		}},
	}, info)

	info.SendResponseCount = 2
	// upstream re-echoes name+id alongside an arguments fragment
	second := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: ptr(0), ID: "call_weather", Function: dto.FunctionResponse{Name: "get_weather", Arguments: `{"city":"Tokyo"}`}},
			}},
		}},
	}, info)

	info.SendResponseCount = 3
	finishReason := "tool_calls"
	third := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: &finishReason}},
		Usage:   &dto.Usage{},
	}, info)

	// collect every content_block_start index; a replayed name must not start a
	// new block at any index (e.g. a spurious index 1), so assert the exact set.
	var startIndexes []int
	for _, event := range append(append(first, second...), third...) {
		if event.Type != "content_block_start" || event.Index == nil {
			continue
		}
		startIndexes = append(startIndexes, *event.Index)
	}
	assert.Equal(t, []int{0}, startIndexes, "only block 0 may start despite replayed name")
}

func TestStreamResponseOpenAI2ClaudeDiscardsWhitespaceOnlyTextAfterToolUse(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}

	info.SendResponseCount = 1
	toolResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_deepseek", Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(0), ID: "call_1", Type: "function",
				Function: dto.FunctionResponse{Name: "lookup", Arguments: `{"q":"x"}`},
			}}},
		}},
	}, info)
	require.Len(t, toolResponses, 1)
	assert.Equal(t, "message_start", toolResponses[0].Type)

	info.SendResponseCount = 2
	trailingResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("\n")},
		}},
	}, info)
	assert.Empty(t, trailingResponses, "DeepSeek trailing whitespace must not create a text block")

	info.SendResponseCount = 3
	finishResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: ptr("tool_calls")}},
		Usage:   &dto.Usage{},
	}, info)
	require.Len(t, finishResponses, 5)
	assert.Equal(t, "content_block_start", finishResponses[0].Type)
	assert.Equal(t, 0, finishResponses[0].GetIndex())
	assert.Equal(t, "content_block_delta", finishResponses[1].Type)
	assert.Equal(t, "content_block_stop", finishResponses[2].Type)
	assert.Equal(t, "message_delta", finishResponses[3].Type)
	assert.Equal(t, "message_stop", finishResponses[4].Type)
}

func TestStreamResponseOpenAI2ClaudePreservesTextAfterToolUse(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}

	info.SendResponseCount = 1
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_mixed", Model: "openai-compatible",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(0), ID: "call_1", Type: "function",
				Function: dto.FunctionResponse{Name: "lookup", Arguments: `{}`},
			}}},
		}},
	}, info)

	info.SendResponseCount = 2
	textResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("Tool call queued.")},
		}},
	}, info)
	require.Len(t, textResponses, 5)
	assert.Equal(t, "content_block_start", textResponses[0].Type)
	assert.Equal(t, 0, textResponses[0].GetIndex())
	assert.Equal(t, "content_block_delta", textResponses[1].Type)
	assert.Equal(t, "content_block_stop", textResponses[2].Type)
	assert.Equal(t, "content_block_start", textResponses[3].Type)
	assert.Equal(t, 1, textResponses[3].GetIndex())
	assert.Equal(t, "text", textResponses[3].ContentBlock.Type)
	assert.Equal(t, "content_block_delta", textResponses[4].Type)
	require.NotNil(t, textResponses[4].Delta)
	require.NotNil(t, textResponses[4].Delta.Text)
	assert.Equal(t, "Tool call queued.", *textResponses[4].Delta.Text)
}

func TestStreamResponseOpenAI2ClaudeBuffersArgsBeforeMetadataUntilFinish(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	info.SendResponseCount = 1
	first := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_args_first", Model: "deepseek",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(7), Function: dto.FunctionResponse{Arguments: `{"q":`},
			}}},
		}},
	}, info)
	require.Equal(t, []string{"message_start"}, claudeEventSignatures(first))

	info.SendResponseCount = 2
	second := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(7), ID: "call_1", Function: dto.FunctionResponse{Name: "lookup", Arguments: `"x"}`},
			}}},
		}},
	}, info)
	assert.Empty(t, second, "tool segment must remain buffered before a protocol boundary")

	final := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: ptr("tool_calls")}},
		Usage:   &dto.Usage{},
	}, info)
	assert.Equal(t, []string{
		"start:0:tool_use:lookup:call_1",
		`delta:0:input_json_delta:{"q":"x"}`,
		"stop:0",
		"message_delta:tool_use",
		"message_stop",
	}, claudeEventSignatures(final))
	assertValidClaudeEventSequence(t, append(append(first, second...), final...))
}

func TestStreamResponseOpenAI2ClaudeSparseParallelReplayUsesContiguousIndexes(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	info.SendResponseCount = 1
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_sparse", Model: "compatible",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: ptr(9), Function: dto.FunctionResponse{Arguments: `{"b":`}},
				{Index: ptr(2), Function: dto.FunctionResponse{Arguments: `{"a":`}},
			}},
		}},
	}, info)

	info.SendResponseCount = 2
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: ptr(9), ID: "call_", Function: dto.FunctionResponse{Name: "get_", Arguments: `{"b":2}`}},
				{Index: ptr(2), ID: "call_", Function: dto.FunctionResponse{Name: "get_", Arguments: `{"a":1}`}},
			}},
		}},
	}, info)...)

	info.SendResponseCount = 3
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				// Cumulative metadata/arguments are intentionally replayed.
				{Index: ptr(2), ID: "call_alpha", Function: dto.FunctionResponse{Name: "get_alpha", Arguments: `{"a":1}`}},
				{Index: ptr(9), ID: "call_beta", Function: dto.FunctionResponse{Name: "get_beta", Arguments: `{"b":2}`}},
			}},
		}},
	}, info)...)

	info.SendResponseCount = 4
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: ptr("tool_calls")}},
		Usage:   &dto.Usage{},
	}, info)...)

	assert.Equal(t, []string{
		"message_start",
		"start:0:tool_use:get_alpha:call_alpha",
		`delta:0:input_json_delta:{"a":1}`,
		"stop:0",
		"start:1:tool_use:get_beta:call_beta",
		`delta:1:input_json_delta:{"b":2}`,
		"stop:1",
		"message_delta:tool_use",
		"message_stop",
	}, claudeEventSignatures(events))
	assertValidClaudeEventSequence(t, events)
}

func TestStreamResponseOpenAI2ClaudeFinishChunkKeepsFinalToolDeltaWithoutUsage(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	info.SendResponseCount = 1
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_finish_delta", Model: "deepseek",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(0), ID: "call_1", Function: dto.FunctionResponse{Name: "lookup", Arguments: `{"q":`},
			}}},
		}},
	}, info)

	info.SendResponseCount = 2
	finishEvents := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			FinishReason: ptr("tool_calls"),
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(0), Function: dto.FunctionResponse{Arguments: `"x"}`},
			}}},
		}},
	}, info)
	events = append(events, finishEvents...)
	assert.Equal(t, []string{
		"start:0:tool_use:lookup:call_1",
		`delta:0:input_json_delta:{"q":"x"}`,
		"stop:0",
	}, claudeEventSignatures(finishEvents))
	assert.False(t, info.ClaudeConvertInfo.Done, "terminal events wait for the later usage chunk")

	info.SendResponseCount = 3
	terminal := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{Usage: &dto.Usage{}}, info)
	events = append(events, terminal...)
	assert.Equal(t, []string{"message_delta:tool_use", "message_stop"}, claudeEventSignatures(terminal))
	assertValidClaudeEventSequence(t, events)
}

func TestStreamResponseOpenAI2ClaudeIncompleteToolFailsClosed(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	info.SendResponseCount = 1
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_incomplete", Model: "compatible",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			FinishReason: ptr("tool_calls"),
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(99), ID: "call_without_name", Function: dto.FunctionResponse{Arguments: `{}`},
			}}},
		}},
		Usage: &dto.Usage{},
	}, info)

	assert.Equal(t, []string{"message_start", "error:relay stream conversion error: incomplete tool call missing id or name"}, claudeEventSignatures(events))
	assert.Zero(t, info.ClaudeConvertInfo.Index, "discarded malformed tools must not consume a downstream index")
	assertValidClaudeEventSequence(t, events)
}

func TestResolveToolArgumentsDoesNotGuessPrefixDeltas(t *testing.T) {
	t.Run("true delta that is also an earlier prefix", func(t *testing.T) {
		arguments, err := resolveToolArguments([]string{`{"x":"`, `{"}`})
		require.NoError(t, err)
		assert.Equal(t, `{"x":"{"}`, arguments)
	})

	t.Run("cumulative snapshots fall back to longest valid object", func(t *testing.T) {
		arguments, err := resolveToolArguments([]string{`{"x":`, `{"x":1}`, `{"x":1}`})
		require.NoError(t, err)
		assert.Equal(t, `{"x":1}`, arguments)
	})

	t.Run("non object fails closed", func(t *testing.T) {
		_, err := resolveToolArguments([]string{`[1,2]`})
		require.Error(t, err)
	})
}

func TestStreamResponseOpenAI2ClaudeMessageStartDoesNotDependOnSendCount(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_no_counter", Model: "deepseek",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("hello")},
		}},
	}, info)
	assert.Equal(t, []string{
		"message_start",
		"start:0:text::",
		"delta:0:text_delta:hello",
	}, claudeEventSignatures(events))
	assert.True(t, info.ClaudeConvertInfo.MessageStarted)
}

func TestStreamResponseOpenAI2ClaudeUsageOnlyWithoutFinishKeepsEndTurnFallback(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_usage_only", Model: "compatible",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("hello")},
		}},
	}, info)
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Usage: &dto.Usage{},
	}, info)...)

	assert.Equal(t, []string{
		"message_start",
		"start:0:text::",
		"delta:0:text_delta:hello",
		"stop:0",
		"message_delta:end_turn",
		"message_stop",
	}, claudeEventSignatures(events))
	assertValidClaudeEventSequence(t, events)
}

func TestStreamResponseOpenAI2ClaudeNoIndexParallelUsesStableIDs(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_no_index", Model: "compatible",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{ID: "call_alpha", Function: dto.FunctionResponse{Name: "alpha", Arguments: `{"a":`}},
				{ID: "call_beta", Function: dto.FunctionResponse{Name: "beta", Arguments: `{"b":`}},
			}},
		}},
	}, info)

	// Only beta appears at position zero in this chunk. Its stable ID must route
	// to beta rather than being merged into alpha's original position-zero call.
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{ID: "call_beta", Function: dto.FunctionResponse{Arguments: `2}`}},
			}},
		}},
	}, info)...)
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			FinishReason: ptr("tool_calls"),
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{ID: "call_alpha", Function: dto.FunctionResponse{Arguments: `1}`}},
			}},
		}},
		Usage: &dto.Usage{},
	}, info)...)

	assert.Equal(t, []string{
		"message_start",
		"start:0:tool_use:alpha:call_alpha",
		`delta:0:input_json_delta:{"a":1}`,
		"stop:0",
		"start:1:tool_use:beta:call_beta",
		`delta:1:input_json_delta:{"b":2}`,
		"stop:1",
		"message_delta:tool_use",
		"message_stop",
	}, claudeEventSignatures(events))
	assertValidClaudeEventSequence(t, events)
}

func TestStreamResponseOpenAI2ClaudeDuplicatePartialIDsDoNotMergeParallelTools(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{ID: "call_", Function: dto.FunctionResponse{Name: "alpha", Arguments: `{"a":`}},
				{ID: "call_", Function: dto.FunctionResponse{Name: "beta", Arguments: `{"b":`}},
			}},
		}},
	}, info)
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			FinishReason: ptr("tool_calls"),
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{ID: "call_alpha", Function: dto.FunctionResponse{Arguments: `1}`}},
				{ID: "call_beta", Function: dto.FunctionResponse{Arguments: `2}`}},
			}},
		}},
		Usage: &dto.Usage{},
	}, info)...)
	assert.Equal(t, []string{
		"message_start",
		"start:0:tool_use:alpha:call_alpha",
		`delta:0:input_json_delta:{"a":1}`,
		"stop:0",
		"start:1:tool_use:beta:call_beta",
		`delta:1:input_json_delta:{"b":2}`,
		"stop:1",
		"message_delta:tool_use",
		"message_stop",
	}, claudeEventSignatures(events))
	assertValidClaudeEventSequence(t, events)
}

func TestStreamResponseOpenAI2ClaudeAmbiguousNoIndexFragmentFailsClosed(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{ID: "call_alpha", Function: dto.FunctionResponse{Name: "alpha"}},
				{ID: "call_beta", Function: dto.FunctionResponse{Name: "beta"}},
			}},
		}},
	}, info)
	// Relocate beta to position zero using its stable id; position zero becomes
	// ambiguous for any later fragment that has neither id nor index.
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				ID: "call_beta", Function: dto.FunctionResponse{Arguments: `{}`},
			}}},
		}},
	}, info)
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Function: dto.FunctionResponse{Arguments: `{}`},
			}}},
		}},
	}, info)
	assert.Equal(t, []string{
		"error:relay stream conversion error: ambiguous no-index tool fragment at position 0",
	}, claudeEventSignatures(events))
}

func TestStreamResponseOpenAI2ClaudeArgsBeforeIDSubsetFailsClosed(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Function: dto.FunctionResponse{Arguments: `{"a":`}},
				{Function: dto.FunctionResponse{Arguments: `{"b":`}},
			}},
		}},
	}, info)
	// Only one newly identified call returns, but neither prior args-only buffer
	// had an id/index. Position zero is not enough evidence to choose safely.
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				ID: "call_beta", Function: dto.FunctionResponse{Name: "beta", Arguments: `2}`},
			}}},
		}},
	}, info)
	assert.Equal(t, []string{
		"error:relay stream conversion error: cannot disambiguate 2 no-index tools from a 1-call subset",
	}, claudeEventSignatures(events))
}

func TestStreamResponseOpenAI2ClaudeConflictingIndexAndIDFailsClosed(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: ptr(0), ID: "call_alpha", Function: dto.FunctionResponse{Name: "alpha"}},
				{Index: ptr(1), ID: "call_beta", Function: dto.FunctionResponse{Name: "beta"}},
			}},
		}},
	}, info)
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(0), ID: "call_beta", Function: dto.FunctionResponse{Arguments: `{}`},
			}}},
		}},
	}, info)
	assert.Equal(t, []string{
		`error:relay stream conversion error: conflicting tool identity for index 0 and id "call_beta"`,
	}, claudeEventSignatures(events))
}

func TestStreamResponseOpenAI2ClaudePositionOnlyDifferentIdentityFailsClosed(t *testing.T) {
	t.Run("different id and name", func(t *testing.T) {
		info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
		StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
					ID: "a", Function: dto.FunctionResponse{Name: "foo", Arguments: `{"x":`},
				}}},
			}},
		}, info)
		events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
					ID: "b", Function: dto.FunctionResponse{Name: "bar", Arguments: `1}`},
				}}},
			}},
		}, info)
		assert.Equal(t, []string{
			`error:relay stream conversion error: ambiguous position-only tool ids "a" and "b" at position 0`,
		}, claudeEventSignatures(events))
	})

	t.Run("different stable ids with prefix relation", func(t *testing.T) {
		info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
		StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
					ID: "call_a", Function: dto.FunctionResponse{Name: "foo", Arguments: `{"x":`},
				}}},
			}},
		}, info)
		events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
					ID: "call_ab", Function: dto.FunctionResponse{Name: "bar", Arguments: `1}`},
				}}},
			}},
		}, info)
		assert.Equal(t, []string{
			`error:relay stream conversion error: ambiguous position-only tool ids "call_a" and "call_ab" at position 0`,
		}, claudeEventSignatures(events))
	})

	t.Run("name fallback without ids", func(t *testing.T) {
		info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
		StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
					Function: dto.FunctionResponse{Name: "foo", Arguments: `{"x":`},
				}}},
			}},
		}, info)
		events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
					Function: dto.FunctionResponse{Name: "bar", Arguments: `1}`},
				}}},
			}},
		}, info)
		assert.Equal(t, []string{
			`error:relay stream conversion error: ambiguous position-only tool names "foo" and "bar" at position 0`,
		}, claudeEventSignatures(events))
	})
}

func TestStreamResponseOpenAI2ClaudeCumulativeIDReplacesPriorMapAliases(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	cumulativeIDs := []string{"call_a", "call_ab", "call_abc", "call_abcd"}
	for position, id := range cumulativeIDs {
		name := ""
		if position == 0 {
			name = "lookup"
		}
		events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
					Index: ptr(0), ID: id, Function: dto.FunctionResponse{Name: name},
				}}},
			}},
		}, info)
		if position == 0 {
			require.Equal(t, []string{"message_start"}, claudeEventSignatures(events))
		} else {
			require.Empty(t, events)
		}
	}
	lastID := cumulativeIDs[len(cumulativeIDs)-1]
	require.Len(t, info.ClaudeConvertInfo.ToolCallByID, 1, "cumulative ids must replace, not retain, prior map keys")
	assert.Equal(t, 0, info.ClaudeConvertInfo.ToolCallByID[lastID])
	assert.Equal(t, lastID, info.ClaudeConvertInfo.PendingToolCalls[0].ID)
}

func TestStreamResponseOpenAI2ClaudeMixedChunkPreservesReasoningToolsTextOrder(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_mixed_fields", Model: "compatible",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			FinishReason: ptr("tool_calls"),
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
				ReasoningContent: ptr("think"),
				ToolCalls: []dto.ToolCallResponse{{
					Index: ptr(4), ID: "call_1", Function: dto.FunctionResponse{Name: "lookup", Arguments: `{}`},
				}},
				Content: ptr("answer"),
			},
		}},
		Usage: &dto.Usage{},
	}, info)
	assert.Equal(t, []string{
		"message_start",
		"start:0:thinking::",
		"delta:0:thinking_delta:think",
		"stop:0",
		"start:1:tool_use:lookup:call_1",
		"delta:1:input_json_delta:{}",
		"stop:1",
		"start:2:text::",
		"delta:2:text_delta:answer",
		"stop:2",
		"message_delta:tool_use",
		"message_stop",
	}, claudeEventSignatures(events))
	assertValidClaudeEventSequence(t, events)
}

func TestStreamResponseOpenAI2ClaudeToolBufferLimitReturnsError(t *testing.T) {
	info := &convmeta.Values{ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{}}
	events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index: ptr(0), ID: "call_1", Function: dto.FunctionResponse{
					Name:      "lookup",
					Arguments: strings.Repeat("x", maxToolCallBufferBytes),
				},
			}}},
		}},
	}, info)
	require.Len(t, events, 2)
	assert.Equal(t, "message_start", events[0].Type)
	assert.Contains(t, claudeEventSignatures(events)[1], "tool-call buffer exceeds")
	assert.True(t, info.ClaudeConvertInfo.Done)
}

func claudeEventSignatures(events []*dto.ClaudeResponse) []string {
	signatures := make([]string, 0, len(events))
	for _, event := range events {
		if event == nil {
			signatures = append(signatures, "<nil>")
			continue
		}
		switch event.Type {
		case "content_block_start":
			signatures = append(signatures, fmt.Sprintf("start:%d:%s:%s:%s", event.GetIndex(), event.ContentBlock.Type, event.ContentBlock.Name, event.ContentBlock.Id))
		case "content_block_delta":
			value := ""
			if event.Delta != nil {
				switch {
				case event.Delta.PartialJson != nil:
					value = *event.Delta.PartialJson
				case event.Delta.Text != nil:
					value = *event.Delta.Text
				case event.Delta.Thinking != nil:
					value = *event.Delta.Thinking
				}
			}
			signatures = append(signatures, fmt.Sprintf("delta:%d:%s:%s", event.GetIndex(), event.Delta.Type, value))
		case "content_block_stop":
			signatures = append(signatures, fmt.Sprintf("stop:%d", event.GetIndex()))
		case "message_delta":
			stopReason := ""
			if event.Delta != nil && event.Delta.StopReason != nil {
				stopReason = *event.Delta.StopReason
			}
			signatures = append(signatures, "message_delta:"+stopReason)
		case "error":
			message := ""
			if claudeError := event.GetClaudeError(); claudeError != nil {
				message = claudeError.Message
			}
			signatures = append(signatures, "error:"+message)
		default:
			signatures = append(signatures, event.Type)
		}
	}
	return signatures
}

func assertValidClaudeEventSequence(t *testing.T, events []*dto.ClaudeResponse) {
	t.Helper()
	open := make(map[int]bool)
	nextIndex := 0
	for _, event := range events {
		if event == nil {
			continue
		}
		switch event.Type {
		case "content_block_start":
			require.NotNil(t, event.Index)
			idx := *event.Index
			assert.Equal(t, nextIndex, idx, "content block indexes must be contiguous")
			require.False(t, open[idx], "block %d started twice", idx)
			open[idx] = true
			nextIndex++
		case "content_block_delta":
			require.NotNil(t, event.Index)
			assert.True(t, open[*event.Index], "block %d received delta without start", *event.Index)
		case "content_block_stop":
			require.NotNil(t, event.Index)
			idx := *event.Index
			require.True(t, open[idx], "block %d stopped without start", idx)
			delete(open, idx)
		case "message_stop":
			assert.Empty(t, open, "message stopped with open content blocks")
		}
	}
	assert.Empty(t, open, "stream ended with open content blocks")
}

func ptr[T any](value T) *T {
	return &value
}
