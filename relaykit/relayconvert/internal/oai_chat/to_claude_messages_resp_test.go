package oaichat

import (
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

// TestStreamResponseOpenAI2ClaudeDiscardsTrailingTextAfterToolUse verifies
// Bug #1: sglang dsv4 parser emits trailing content='\n' after tool_use
// completes. Anthropic streaming requires tool_use to be the final content
// block, so the trailing text must be discarded, not opened as a new text
// block. Without this fix Claude Code reports "Content block not found".
func TestStreamResponseOpenAI2ClaudeDiscardsTrailingTextAfterToolUse(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeNone,
		},
	}

	// Chunk 1: text content
	info.SendResponseCount = 1
	textResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("Let me check the weather.")}},
		},
	}, info)
	require.Len(t, textResponses, 3)
	assert.Equal(t, "message_start", textResponses[0].Type)
	assert.Equal(t, "content_block_start", textResponses[1].Type)
	assert.Equal(t, "text", textResponses[1].ContentBlock.Type)

	// Chunk 2: tool_use
	info.SendResponseCount = 2
	toolResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
				ToolCalls: []dto.ToolCallResponse{
					{Index: ptr(0), ID: "call_1", Type: "function",
						Function: dto.FunctionResponse{Name: "get_weather", Arguments: `{"city":"Shanghai"}`}},
				},
			}},
		},
	}, info)
	require.True(t, len(toolResponses) >= 2)
	assert.Equal(t, "content_block_stop", toolResponses[0].Type)
	assert.Equal(t, 0, toolResponses[0].GetIndex())
	assert.Equal(t, "content_block_start", toolResponses[1].Type)
	assert.Equal(t, "tool_use", toolResponses[1].ContentBlock.Type)

	// Chunk 3: trailing content='\n' from sglang dsv4 — must be DISCARDED
	info.SendResponseCount = 3
	trailingResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("\n")}},
		},
	}, info)
	assert.Empty(t, trailingResponses, "trailing text after tool_use must be discarded")

	// Chunk 4: finish_reason=tool_calls + usage
	info.SendResponseCount = 4
	finishResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{FinishReason: ptr("tool_calls")},
		},
		Usage: &dto.Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15},
	}, info)
	require.True(t, len(finishResponses) >= 2)
	assert.Equal(t, "content_block_stop", finishResponses[0].Type)
	assert.Equal(t, 1, finishResponses[0].GetIndex(), "should close tool_use at index 1")
	assert.Equal(t, "message_delta", finishResponses[1].Type)
	require.NotNil(t, finishResponses[1].Delta.StopReason)
	assert.Equal(t, "tool_use", *finishResponses[1].Delta.StopReason)
}

// TestStreamResponseOpenAI2ClaudeAppendsEmptyTextForThinkingOnlyStream
// verifies Bug #2: DeepSeek V4-Flash with max reasoning_effort can consume
// the entire max_tokens budget on reasoning (finish_reason=length, content
// empty). The stream then has only thinking blocks and no text/tool_use
// block, which Claude Code rejects as empty/malformed. The fix appends an
// empty text block as fallback.
func TestStreamResponseOpenAI2ClaudeAppendsEmptyTextForThinkingOnlyStream(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeNone,
		},
	}

	// Chunk 1: reasoning content (thinking)
	info.SendResponseCount = 1
	thinkingResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: ptr("thinking hard...")}},
		},
	}, info)
	require.True(t, len(thinkingResponses) >= 3)
	assert.Equal(t, "message_start", thinkingResponses[0].Type)
	assert.Equal(t, "content_block_start", thinkingResponses[1].Type)
	assert.Equal(t, "thinking", thinkingResponses[1].ContentBlock.Type)

	// Chunk 2: more reasoning
	info.SendResponseCount = 2
	moreThinking := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: ptr("still thinking...")}},
		},
	}, info)
	require.Len(t, moreThinking, 1)
	assert.Equal(t, "content_block_delta", moreThinking[0].Type)

	// Chunk 3: finish_reason=length + usage (all budget consumed by thinking)
	info.SendResponseCount = 3
	finishResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{FinishReason: ptr("length")},
		},
		Usage: &dto.Usage{PromptTokens: 10, CompletionTokens: 2000, TotalTokens: 2010},
	}, info)

	// Bug #2 fix: empty text block appended after thinking block.
	// Sequence: content_block_stop(0) → content_block_start(1, text) →
	//           content_block_stop(1) → message_delta → message_stop
	require.Len(t, finishResponses, 5)
	assert.Equal(t, "content_block_stop", finishResponses[0].Type)
	assert.Equal(t, 0, finishResponses[0].GetIndex(), "close thinking at index 0")
	assert.Equal(t, "content_block_start", finishResponses[1].Type)
	assert.Equal(t, 1, finishResponses[1].GetIndex(), "empty text at index 1")
	require.NotNil(t, finishResponses[1].ContentBlock)
	assert.Equal(t, "text", finishResponses[1].ContentBlock.Type)
	assert.Equal(t, "content_block_stop", finishResponses[2].Type)
	assert.Equal(t, 1, finishResponses[2].GetIndex(), "close empty text at index 1")
	assert.Equal(t, "message_delta", finishResponses[3].Type)
	require.NotNil(t, finishResponses[3].Delta.StopReason)
	assert.Equal(t, "max_tokens", *finishResponses[3].Delta.StopReason)
	assert.Equal(t, "message_stop", finishResponses[4].Type)
}

// TestFinalizeStreamResponseOpenAI2ClaudeAppendsEmptyTextForThinkingOnly
// verifies Bug #2 fix in the Finalize path (stream ended without
// finish_reason, e.g. upstream connection drop during thinking).
func TestFinalizeStreamResponseOpenAI2ClaudeAppendsEmptyTextForThinkingOnly(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeNone,
		},
	}

	// Chunk 1: reasoning only
	info.SendResponseCount = 1
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: ptr("thinking...")}},
		},
	}, info)

	// Stream ends without finish_reason — Finalize is called
	finalResponses := FinalizeStreamResponseOpenAI2Claude(info)
	// Sequence: content_block_stop(0) → content_block_start(1, text) →
	//           content_block_stop(1) → message_delta → message_stop
	require.Len(t, finalResponses, 5)
	assert.Equal(t, "content_block_stop", finalResponses[0].Type)
	assert.Equal(t, 0, finalResponses[0].GetIndex())
	assert.Equal(t, "content_block_start", finalResponses[1].Type)
	assert.Equal(t, 1, finalResponses[1].GetIndex())
	assert.Equal(t, "text", finalResponses[1].ContentBlock.Type)
	assert.Equal(t, "content_block_stop", finalResponses[2].Type)
	assert.Equal(t, 1, finalResponses[2].GetIndex())
	assert.Equal(t, "message_delta", finalResponses[3].Type)
	assert.Equal(t, "message_stop", finalResponses[4].Type)
}

// TestStreamResponseOpenAI2ClaudeThinkingThenTextDoesNotGetFallback is a
// negative test for Bug #2: when a stream has thinking followed by actual
// text content, no empty text fallback should be appended. The HasContentBlock
// flag prevents false-positive fallback insertion.
func TestStreamResponseOpenAI2ClaudeThinkingThenTextDoesNotGetFallback(t *testing.T) {
	info := &convmeta.Values{
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeNone,
		},
	}

	// Chunk 1: reasoning
	info.SendResponseCount = 1
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: ptr("Thinking...")}},
		},
	}, info)
	assert.False(t, info.ClaudeConvertInfo.HasContentBlock, "thinking alone should not set HasContentBlock")

	// Chunk 2: text content
	info.SendResponseCount = 2
	StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: ptr("Hello!")}},
		},
	}, info)
	assert.True(t, info.ClaudeConvertInfo.HasContentBlock, "text content should set HasContentBlock")

	// Chunk 3: finish
	info.SendResponseCount = 3
	finishResponses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "deepseek-v4-flash",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{FinishReason: ptr("stop")},
		},
		Usage: &dto.Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15},
	}, info)
	require.NotEmpty(t, finishResponses)

	// Count text blocks — should be 0 in finishResponses (the real text block
	// was already opened in chunk 2; finish only closes it).
	textStartCount := 0
	for _, r := range finishResponses {
		if r.Type == "content_block_start" && r.ContentBlock != nil && r.ContentBlock.Type == "text" {
			textStartCount++
		}
	}
	assert.Equal(t, 0, textStartCount, "no fallback text block should be added when content already exists")
}
