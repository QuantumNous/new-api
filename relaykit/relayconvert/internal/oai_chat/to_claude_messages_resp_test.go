package oaichat

import (
	"math"
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

func switchOnMeta() convmeta.Meta {
	return &convmeta.Values{
		Options: &convmeta.Options{
			Claude: convmeta.ClaudeOptions{AnthropicMessagesExcludeCache: true},
		},
	}
}

func TestBuildClaudeUsageFromAnthropicMessagesExcludeCache(t *testing.T) {
	anthropicUsage := &dto.ClaudeUsage{
		InputTokens:          99,
		OutputTokens:         912,
		CacheReadInputTokens: 28416,
	}

	tests := []struct {
		name              string
		info              convmeta.Meta
		oai               dto.Usage
		wantInput         int
		wantCacheRead     int
		wantCacheCreate   int
		wantBillingPrompt int
		wantSameClaudePtr bool
		wantClaudeInput   int
	}{
		{
			name: "switch off cached tokens keeps prompt_tokens",
			info: nil,
			oai: dto.Usage{
				PromptTokens:     30032,
				CompletionTokens: 912,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens: 28416,
				},
			},
			wantInput:         30032,
			wantCacheRead:     28416,
			wantBillingPrompt: 30032,
		},
		{
			name: "switch on subtracts cache read",
			info: switchOnMeta(),
			oai: dto.Usage{
				PromptTokens:     30032,
				CompletionTokens: 912,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens: 28416,
				},
			},
			wantInput:         1616,
			wantCacheRead:     28416,
			wantBillingPrompt: 30032,
		},
		{
			name: "switch on subtracts cache read and cache creation",
			info: switchOnMeta(),
			oai: dto.Usage{
				PromptTokens:     10000,
				CompletionTokens: 10,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens:         3000,
					CachedCreationTokens: 2000,
				},
			},
			wantInput:         5000,
			wantCacheRead:     3000,
			wantCacheCreate:   2000,
			wantBillingPrompt: 10000,
		},
		{
			name: "switch off cache_write still clamps overlapping prefixes",
			info: nil,
			oai: dto.Usage{
				PromptTokens:     3619,
				CompletionTokens: 36,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens:     2921,
					CacheWriteTokens: 3616,
				},
			},
			wantInput:         0,
			wantCacheRead:     2921,
			wantCacheCreate:   3616,
			wantBillingPrompt: 3619,
		},
		{
			name: "switch on and cache_write subtracts once",
			info: switchOnMeta(),
			oai: dto.Usage{
				PromptTokens:     10000,
				CompletionTokens: 10,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens:     1000,
					CacheWriteTokens: 2000,
				},
			},
			wantInput:         7000,
			wantCacheRead:     1000,
			wantCacheCreate:   2000,
			wantBillingPrompt: 10000,
		},
		{
			name: "switch on prompt smaller than cache clamps to zero",
			info: switchOnMeta(),
			oai: dto.Usage{
				PromptTokens:     100,
				CompletionTokens: 10,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens: 150,
				},
			},
			wantInput:         0,
			wantCacheRead:     150,
			wantBillingPrompt: 100,
		},
		{
			name: "switch on does not rewrite anthropic billing usage",
			info: switchOnMeta(),
			oai: dto.Usage{
				PromptTokens:     30032,
				CompletionTokens: 912,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens: 28416,
				},
				BillingUsage: &dto.BillingUsage{
					Source:      dto.BillingUsageSourceClaudeMessages,
					Semantic:    dto.BillingUsageSemanticAnthropic,
					ClaudeUsage: anthropicUsage,
				},
			},
			wantInput:         99,
			wantCacheRead:     28416,
			wantSameClaudePtr: false,
			wantClaudeInput:   99,
		},
		{
			name: "switch on preserves original openai billing prompt tokens",
			info: switchOnMeta(),
			oai: dto.Usage{
				PromptTokens:     30032,
				CompletionTokens: 912,
				TotalTokens:      30944,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens: 28416,
				},
			},
			wantInput:         1616,
			wantCacheRead:     28416,
			wantBillingPrompt: 30032,
		},
		{
			name: "switch on extreme cache counts saturate subtract to zero",
			info: switchOnMeta(),
			oai: dto.Usage{
				PromptTokens:     0,
				CompletionTokens: 10,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens:         math.MaxInt,
					CachedCreationTokens: math.MaxInt,
				},
			},
			wantInput:         0,
			wantCacheRead:     math.MaxInt,
			wantCacheCreate:   math.MaxInt,
			wantBillingPrompt: 0,
		},
		{
			name: "switch on negative prompt with zero cache clamps to zero",
			info: switchOnMeta(),
			oai: dto.Usage{
				PromptTokens:     -1,
				CompletionTokens: 10,
			},
			wantInput:         0,
			wantBillingPrompt: -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usage := buildClaudeUsageFromOpenAIUsage(&tt.oai, tt.info)
			require.NotNil(t, usage)
			assert.Equal(t, tt.wantInput, usage.InputTokens)
			assert.Equal(t, tt.wantCacheRead, usage.CacheReadInputTokens)
			if tt.wantCacheCreate != 0 {
				assert.Equal(t, tt.wantCacheCreate, usage.CacheCreationInputTokens)
			}
			if tt.oai.BillingUsage != nil && tt.oai.BillingUsage.ClaudeUsage != nil {
				assert.Equal(t, tt.wantClaudeInput, usage.InputTokens)
				assert.Equal(t, anthropicUsage.InputTokens, usage.InputTokens)
				return
			}
			require.NotNil(t, usage.BillingUsage)
			require.NotNil(t, usage.BillingUsage.OpenAIUsage)
			assert.Equal(t, tt.wantBillingPrompt, usage.BillingUsage.OpenAIUsage.PromptTokens)
			assert.Equal(t, dto.BillingUsageSemanticOpenAI, usage.BillingUsage.Semantic)
		})
	}
}

func TestStreamResponseOpenAI2ClaudeSubtractsCacheWhenSwitchOn(t *testing.T) {
	info := &convmeta.Values{
		SendResponseCount: 2,
		ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
			LastMessagesType: convmeta.LastMessageTypeText,
			Index:            0,
		},
		Options: &convmeta.Options{
			Claude: convmeta.ClaudeOptions{AnthropicMessagesExcludeCache: true},
		},
	}

	responses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{FinishReason: ptr("stop")},
		},
		Usage: &dto.Usage{
			PromptTokens:     30032,
			CompletionTokens: 912,
			TotalTokens:      30944,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens: 28416,
			},
		},
	}, info)
	require.NotEmpty(t, responses)

	var delta *dto.ClaudeResponse
	for _, resp := range responses {
		if resp != nil && resp.Type == "message_delta" {
			delta = resp
			break
		}
	}
	require.NotNil(t, delta)
	require.NotNil(t, delta.Usage)
	assert.Equal(t, 1616, delta.Usage.InputTokens)
	assert.Equal(t, 28416, delta.Usage.CacheReadInputTokens)
	assert.Equal(t, 912, delta.Usage.OutputTokens)
	require.NotNil(t, delta.Usage.BillingUsage)
	require.NotNil(t, delta.Usage.BillingUsage.OpenAIUsage)
	assert.Equal(t, 30032, delta.Usage.BillingUsage.OpenAIUsage.PromptTokens)
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
	}, nil)

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

func TestStreamResponseOpenAI2ClaudeMessageStartZerosInputWhenSwitchOn(t *testing.T) {
	info := &convmeta.Values{
		SendResponseCount:    1,
		EstimatePromptTokens: 29829,
		Options: &convmeta.Options{
			Claude: convmeta.ClaudeOptions{AnthropicMessagesExcludeCache: true},
		},
	}

	responses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
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
	require.NotEmpty(t, responses)
	require.Equal(t, "message_start", responses[0].Type)
	require.NotNil(t, responses[0].Message)
	require.NotNil(t, responses[0].Message.Usage)
	assert.Equal(t, 0, responses[0].Message.Usage.InputTokens)
	assert.Equal(t, 0, responses[0].Message.Usage.OutputTokens)
	assert.Equal(t, 0, responses[0].Message.Usage.CacheReadInputTokens)
	assert.Equal(t, 0, responses[0].Message.Usage.CacheCreationInputTokens)
}

func TestStreamResponseOpenAI2ClaudeMessageStartKeepsEstimateWhenSwitchOff(t *testing.T) {
	info := &convmeta.Values{
		SendResponseCount:    1,
		EstimatePromptTokens: 29829,
	}

	responses := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
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
	require.NotEmpty(t, responses)
	require.Equal(t, "message_start", responses[0].Type)
	require.NotNil(t, responses[0].Message)
	require.NotNil(t, responses[0].Message.Usage)
	assert.Equal(t, 29829, responses[0].Message.Usage.InputTokens)
	assert.Equal(t, 0, responses[0].Message.Usage.OutputTokens)
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
