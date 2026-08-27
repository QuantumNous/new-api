package relayconvert

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiToOpenAIStatefulStreamTerminal(t *testing.T) {
	tests := []struct {
		name                 string
		chunk                *dto.GeminiChatResponse
		wantFinishReason     string
		wantFinishOnFinalize bool
		wantEmptyFinishDelta bool
	}{
		{
			name:                 "stop",
			chunk:                terminalTestGeminiChunk("Hello", "STOP", false),
			wantFinishReason:     types.FinishReasonStop,
			wantEmptyFinishDelta: true,
		},
		{
			name:                 "tool call",
			chunk:                terminalTestGeminiChunk("", "STOP", true),
			wantFinishReason:     types.FinishReasonToolCalls,
			wantEmptyFinishDelta: true,
		},
		{
			name:             "non stop finish reason",
			chunk:            terminalTestGeminiChunk("partial", "MAX_TOKENS", false),
			wantFinishReason: types.FinishReasonLength,
		},
		{
			name:                 "truncated stream",
			chunk:                terminalTestGeminiChunk("partial", "", false),
			wantFinishReason:     types.FinishReasonStop,
			wantFinishOnFinalize: true,
			wantEmptyFinishDelta: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &convmeta.Values{
				ChannelMetaAttached: true,
				UpstreamModelName:   "upstream-model",
			}
			state, err := NewResponseStreamState(
				types.RelayFormatGemini,
				types.RelayFormatOpenAI,
				ResponseStreamOptions{
					ID:      "chatcmpl-fixed",
					Created: 1700000000,
				},
			)
			require.NoError(t, err)

			results, err := ConvertStreamResponseChunk(nil, info, state, tt.chunk)
			require.NoError(t, err)
			chunkFinishes := terminalTestFinishedChatChunks(t, results)
			if tt.wantFinishOnFinalize {
				assert.Empty(t, chunkFinishes)
			} else {
				require.Len(t, chunkFinishes, 1)
			}

			finalResults, err := FinalizeStreamResponse(nil, info, state)
			require.NoError(t, err)
			finalFinishes := terminalTestFinishedChatChunks(t, finalResults)
			if tt.wantFinishOnFinalize {
				require.Len(t, finalFinishes, 1)
			} else {
				assert.Empty(t, finalFinishes)
			}

			finishes := append(chunkFinishes, finalFinishes...)
			require.Len(t, finishes, 1)
			finish := finishes[0]
			require.Len(t, finish.Choices, 1)
			require.NotNil(t, finish.Choices[0].FinishReason)
			assert.Equal(t, tt.wantFinishReason, *finish.Choices[0].FinishReason)
			assert.Equal(t, "chatcmpl-fixed", finish.Id)
			assert.Equal(t, int64(1700000000), finish.Created)
			assert.Equal(t, "upstream-model", finish.Model)
			require.NotNil(t, finish.Usage)
			assert.Equal(t, 4, finish.Usage.PromptTokens)
			assert.Equal(t, 2, finish.Usage.CompletionTokens)
			assert.Equal(t, 6, finish.Usage.TotalTokens)
			if tt.wantEmptyFinishDelta {
				assert.Nil(t, finish.Choices[0].Delta.Content)
				assert.Empty(t, finish.Choices[0].Delta.ToolCalls)
			}

			repeatedFinal, err := FinalizeStreamResponse(nil, info, state)
			require.NoError(t, err)
			assert.Empty(t, repeatedFinal)
		})
	}
}

func TestClaudeTargetStatefulStreamTerminalTail(t *testing.T) {
	tests := []struct {
		name                   string
		from                   types.RelayFormat
		chunks                 []any
		wantFinalizerTerminals bool
		wantStopReason         string
	}{
		{
			name: "gemini to claude",
			from: types.RelayFormatGemini,
			chunks: []any{
				terminalTestGeminiChunkWithoutUsage("Hello", ""),
				terminalTestGeminiChunk(" world", "STOP", false),
			},
			wantStopReason: "end_turn",
		},
		{
			name: "gemini tool call with split usage",
			from: types.RelayFormatGemini,
			chunks: []any{
				terminalTestGeminiToolChunkWithoutUsage(),
				terminalTestGeminiChunk("", "STOP", false),
			},
			wantStopReason: "tool_use",
		},
		{
			name: "gemini non stop finish with split usage",
			from: types.RelayFormatGemini,
			chunks: []any{
				terminalTestGeminiChunkWithoutUsage("partial", "MAX_TOKENS"),
				terminalTestGeminiUsageOnlyChunk(),
			},
			wantStopReason: "max_tokens",
		},
		{
			name: "responses to claude",
			from: types.RelayFormatOpenAIResponses,
			chunks: []any{
				&dto.ResponsesStreamResponse{
					Type:  "response.output_text.delta",
					Delta: "Hello",
				},
				&dto.ResponsesStreamResponse{
					Type:  "response.output_text.delta",
					Delta: " world",
				},
				&dto.ResponsesStreamResponse{
					Type: "response.completed",
					Response: &dto.OpenAIResponsesResponse{
						ID:     "resp-fixed",
						Object: "response",
						Model:  "upstream-model",
						Status: []byte(`"completed"`),
						Usage: &dto.Usage{
							InputTokens:  4,
							OutputTokens: 2,
							TotalTokens:  6,
						},
					},
				},
			},
			wantFinalizerTerminals: true,
			wantStopReason:         "end_turn",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &convmeta.Values{
				ChannelMetaAttached: true,
				UpstreamModelName:   "upstream-model",
				ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
					LastMessagesType: convmeta.LastMessageTypeNone,
				},
			}
			state, err := NewResponseStreamState(
				tt.from,
				types.RelayFormatClaude,
				ResponseStreamOptions{
					ID:      "stream-fixed",
					Model:   "upstream-model",
					Created: 1700000000,
				},
			)
			require.NoError(t, err)

			var results []ResponseResult
			for _, chunk := range tt.chunks {
				chunkResults, err := ConvertStreamResponseChunk(nil, info, state, chunk)
				require.NoError(t, err)
				results = append(results, chunkResults...)
			}

			finalResults, err := FinalizeStreamResponse(nil, info, state)
			require.NoError(t, err)
			if tt.wantFinalizerTerminals {
				require.Len(t, finalResults, 3)
			} else {
				assert.Empty(t, finalResults)
			}
			results = append(results, finalResults...)

			terminalTestAssertClaudeTail(t, results, tt.wantStopReason)
			assert.True(t, info.ClaudeConvertInfo.Done)

			repeatedFinal, err := FinalizeStreamResponse(nil, info, state)
			require.NoError(t, err)
			assert.Empty(t, repeatedFinal)
		})
	}

	t.Run("preserves preseeded usage", func(t *testing.T) {
		info := &convmeta.Values{
			ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
				LastMessagesType: convmeta.LastMessageTypeNone,
			},
		}
		state, err := NewResponseStreamState(
			types.RelayFormatOpenAIResponses,
			types.RelayFormatClaude,
			ResponseStreamOptions{Model: "upstream-model"},
		)
		require.NoError(t, err)

		chunks := []*dto.ResponsesStreamResponse{
			{
				Type:  "response.output_text.delta",
				Delta: "Hello",
			},
			{
				Type: "response.completed",
				Response: &dto.OpenAIResponsesResponse{
					ID:     "resp-fixed",
					Object: "response",
					Model:  "upstream-model",
					Status: []byte(`"completed"`),
					Usage: &dto.Usage{
						InputTokens:  4,
						OutputTokens: 2,
						TotalTokens:  6,
					},
				},
			},
		}
		for _, chunk := range chunks {
			_, err := ConvertStreamResponseChunk(nil, info, state, chunk)
			require.NoError(t, err)
		}

		preseeded := &dto.Usage{
			PromptTokens:     11,
			CompletionTokens: 7,
			TotalTokens:      18,
		}
		info.ClaudeConvertInfo.Usage = preseeded
		finalResults, err := FinalizeStreamResponse(nil, info, state)
		require.NoError(t, err)
		require.Len(t, finalResults, 3)
		assert.Same(t, preseeded, info.ClaudeConvertInfo.Usage)

		messageDelta, ok := finalResults[1].Value.(*dto.ClaudeResponse)
		require.True(t, ok)
		assert.Equal(t, "message_delta", messageDelta.Type)
		require.NotNil(t, messageDelta.Usage)
		assert.Equal(t, 11, messageDelta.Usage.InputTokens)
		assert.Equal(t, 7, messageDelta.Usage.OutputTokens)
	})
}

func TestGeminiMissingToolIDGetsOnePortableCanonicalID(t *testing.T) {
	for _, target := range []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude, types.RelayFormatOpenAIResponses} {
		target := target
		t.Run(string(target), func(t *testing.T) {
			state, err := NewResponseStreamState(
				types.RelayFormatGemini,
				target,
				ResponseStreamOptions{ID: "stream-tool-id", Model: "gemini-3.7-pro"},
			)
			require.NoError(t, err)
			finish := "STOP"
			chunk := &dto.GeminiChatResponse{
				Candidates: []dto.GeminiChatCandidate{{
					Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{
						FunctionCall: &dto.FunctionCall{FunctionName: "analyze_ledger", Arguments: map[string]any{"receipt": "R-1"}},
					}}},
					FinishReason: &finish,
				}},
				HasUsageMetadata: true,
				UsageMetadata:    dto.GeminiUsageMetadata{PromptTokenCount: 4, CandidatesTokenCount: 2, TotalTokenCount: 6},
			}
			results, err := ConvertStreamResponseChunk(context.Background(), nil, state, chunk)
			require.NoError(t, err)
			final, err := FinalizeStreamResponse(context.Background(), nil, state)
			require.NoError(t, err)
			results = append(results, final...)

			var callID string
			switch target {
			case types.RelayFormatOpenAI:
				for _, result := range results {
					response := result.Value.(*dto.ChatCompletionsStreamResponse)
					for _, call := range response.Choices[0].Delta.ToolCalls {
						if call.ID != "" {
							callID = call.ID
						}
					}
				}
			case types.RelayFormatClaude:
				for _, result := range results {
					response := result.Value.(*dto.ClaudeResponse)
					if response.Type == "content_block_start" && response.ContentBlock != nil && response.ContentBlock.Type == "tool_use" {
						callID = response.ContentBlock.Id
					}
				}
			case types.RelayFormatOpenAIResponses:
				var addedCallID, doneCallID string
				var lifecycle []string
				for _, result := range results {
					event, ok := asResponsesStream(result.Value)
					require.True(t, ok, "unexpected Responses event type %T", result.Value)
					lifecycle = append(lifecycle, event.Type)
					switch event.Type {
					case "response.output_item.added":
						if event.Item != nil && event.Item.Type == "function_call" {
							addedCallID = event.Item.CallId
						}
					case "response.output_item.done":
						if event.Item != nil && event.Item.Type == "function_call" {
							doneCallID = event.Item.CallId
							require.Equal(t, `{"receipt":"R-1"}`, event.Item.ArgumentsString())
						}
					}
				}
				require.Contains(t, lifecycle, "response.function_call_arguments.done")
				require.Contains(t, lifecycle, "response.output_item.done")
				require.Contains(t, lifecycle, "response.completed")
				require.Equal(t, addedCallID, doneCallID)
				callID = doneCallID
			}
			require.NotEmpty(t, callID)
			require.Regexp(t, `^[A-Za-z0-9_-]+$`, callID)
			require.LessOrEqual(t, len(callID), 64)
		})
	}
}

func TestChatToGeminiStatefulStreamEmitsOneStableToolCall(t *testing.T) {
	state, err := NewResponseStreamState(
		types.RelayFormatOpenAI,
		types.RelayFormatGemini,
		ResponseStreamOptions{ID: "chatcmpl-tool", Model: "gemini-3.7-pro"},
	)
	require.NoError(t, err)

	index := 0
	chunks := []*dto.ChatCompletionsStreamResponse{
		{
			Id: "chatcmpl-tool", Model: "gemini-3.7-pro",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
				ToolCalls: []dto.ToolCallResponse{{
					Index: &index, ID: "call_1", Type: "function",
					Function: dto.FunctionResponse{Name: "eval_javascript", Arguments: `{}`},
				}},
			}}},
		},
		{
			Id: "chatcmpl-tool", Model: "gemini-3.7-pro",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
				ToolCalls: []dto.ToolCallResponse{{
					Index:    &index,
					Function: dto.FunctionResponse{Arguments: `{"code":"1+1"}`},
				}},
			}}},
		},
		{
			Id: "chatcmpl-tool", Model: "gemini-3.7-pro",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: terminalTestPtr(types.FinishReasonToolCalls)}},
			Usage:   &dto.Usage{PromptTokens: 4, CompletionTokens: 2, TotalTokens: 6},
		},
	}

	var results []ResponseResult
	for i, chunk := range chunks {
		converted, err := ConvertStreamResponseChunk(context.Background(), nil, state, chunk)
		require.NoError(t, err)
		if i < 2 {
			require.Empty(t, terminalTestGeminiFunctionCalls(t, converted), "tool call emitted before finalization")
		}
		results = append(results, converted...)
	}
	final, err := FinalizeStreamResponse(context.Background(), nil, state)
	require.NoError(t, err)
	results = append(results, final...)

	calls := terminalTestGeminiFunctionCalls(t, results)
	require.Len(t, calls, 1)
	require.Equal(t, "eval_javascript", calls[0].FunctionName)
	require.Equal(t, map[string]any{"code": "1+1"}, calls[0].Arguments)

	_, err = ConvertStreamResponseChunk(context.Background(), nil, state, chunks[len(chunks)-1])
	require.ErrorContains(t, err, "already finalized")
}

func TestChatToGeminiStatefulStreamKeepsParallelToolsIsolatedAndSourceOrdered(t *testing.T) {
	state, err := NewResponseStreamState(
		types.RelayFormatOpenAI,
		types.RelayFormatGemini,
		ResponseStreamOptions{ID: "chatcmpl-parallel", Model: "gemini-3.7-pro"},
	)
	require.NoError(t, err)

	firstIndex, secondIndex := 0, 1
	chunks := []*dto.ChatCompletionsStreamResponse{
		{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
					{Index: &secondIndex, ID: "call_2", Type: "function", Function: dto.FunctionResponse{Name: "second", Arguments: `{"value":`}},
					{Index: &firstIndex, ID: "call_1", Type: "function", Function: dto.FunctionResponse{Name: "first", Arguments: `{"value":`}},
				}},
			}},
		},
		{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
					{Index: &firstIndex, Function: dto.FunctionResponse{Arguments: `"a"}`}},
					{Index: &secondIndex, Function: dto.FunctionResponse{Arguments: `"b"}`}},
				}},
			}},
		},
		{
			Choices: []dto.ChatCompletionsStreamResponseChoice{},
			Usage:   &dto.Usage{PromptTokens: 4, CompletionTokens: 3, TotalTokens: 7},
		},
	}

	var results []ResponseResult
	for _, chunk := range chunks {
		converted, err := ConvertStreamResponseChunk(context.Background(), nil, state, chunk)
		require.NoError(t, err)
		require.Empty(t, terminalTestGeminiFunctionCalls(t, converted), "parallel tool emitted before EOF")
		results = append(results, converted...)
	}
	final, err := FinalizeStreamResponse(context.Background(), nil, state)
	require.NoError(t, err)
	results = append(results, final...)

	calls := terminalTestGeminiFunctionCalls(t, results)
	require.Len(t, calls, 2)
	assert.Equal(t, "first", calls[0].FunctionName)
	assert.Equal(t, map[string]any{"value": "a"}, calls[0].Arguments)
	assert.Equal(t, "second", calls[1].FunctionName)
	assert.Equal(t, map[string]any{"value": "b"}, calls[1].Arguments)
}

func terminalTestGeminiFunctionCalls(t *testing.T, results []ResponseResult) []dto.FunctionCall {
	t.Helper()
	var calls []dto.FunctionCall
	for _, result := range results {
		response, ok := result.Value.(*dto.GeminiChatResponse)
		require.True(t, ok, "unexpected stream result type %T", result.Value)
		for _, candidate := range response.Candidates {
			for _, part := range candidate.Content.Parts {
				if part.FunctionCall != nil {
					calls = append(calls, *part.FunctionCall)
				}
			}
		}
	}
	return calls
}

func TestConvertStreamResponseKeepsStatelessCompatibility(t *testing.T) {
	t.Run("gemini to openai", func(t *testing.T) {
		info := &convmeta.Values{
			ChannelMetaAttached: true,
			UpstreamModelName:   "upstream-model",
		}
		result, err := ConvertStreamResponse(
			nil,
			info,
			types.RelayFormatOpenAI,
			terminalTestGeminiChunk("Hello", "STOP", false),
		)
		require.NoError(t, err)
		require.IsType(t, &dto.ChatCompletionsStreamResponse{}, result.Value)

		response := result.Value.(*dto.ChatCompletionsStreamResponse)
		require.Len(t, response.Choices, 1)
		require.NotNil(t, response.Choices[0].Delta.Content)
		assert.Equal(t, "Hello", *response.Choices[0].Delta.Content)
		assert.Nil(t, response.Choices[0].FinishReason)
		assert.Equal(t, "upstream-model", response.Model)
		require.NotNil(t, response.Usage)
		assert.Equal(t, 4, response.Usage.PromptTokens)
		assert.Equal(t, 2, response.Usage.CompletionTokens)
		assert.Equal(t, 6, response.Usage.TotalTokens)
	})

	t.Run("openai to claude", func(t *testing.T) {
		info := &convmeta.Values{
			SendResponseCount: 1,
			ClaudeConvertInfo: &convmeta.ClaudeConvertInfo{
				LastMessagesType: convmeta.LastMessageTypeNone,
			},
		}
		result, err := ConvertStreamResponse(
			nil,
			info,
			types.RelayFormatClaude,
			&dto.ChatCompletionsStreamResponse{
				Id:      "chatcmpl-fixed",
				Object:  "chat.completion.chunk",
				Created: 1700000000,
				Model:   "upstream-model",
				Choices: []dto.ChatCompletionsStreamResponseChoice{
					{
						Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
							Role:    "assistant",
							Content: terminalTestPtr("Hello"),
						},
					},
				},
				Usage: &dto.Usage{
					PromptTokens:     4,
					CompletionTokens: 2,
					TotalTokens:      6,
				},
			},
		)
		require.NoError(t, err)
		require.IsType(t, []*dto.ClaudeResponse{}, result.Value)

		responses := result.Value.([]*dto.ClaudeResponse)
		require.Len(t, responses, 3)
		assert.Equal(t, "message_start", responses[0].Type)
		assert.Equal(t, "content_block_start", responses[1].Type)
		assert.Equal(t, "content_block_delta", responses[2].Type)
		require.NotNil(t, responses[2].Delta)
		require.NotNil(t, responses[2].Delta.Text)
		assert.Equal(t, "Hello", *responses[2].Delta.Text)
		assert.False(t, info.ClaudeConvertInfo.Done)
		assert.Equal(t, 6, result.Usage.TotalTokens)
	})
}

func terminalTestGeminiChunk(text string, finishReason string, toolCall bool) *dto.GeminiChatResponse {
	response := terminalTestGeminiChunkWithoutUsage(text, finishReason)
	response.HasUsageMetadata = true
	response.UsageMetadata = dto.GeminiUsageMetadata{
		PromptTokenCount:     4,
		CandidatesTokenCount: 2,
		TotalTokenCount:      6,
	}
	if toolCall {
		response.Candidates[0].Content.Parts = []dto.GeminiPart{
			{
				FunctionCall: &dto.FunctionCall{
					FunctionName: "lookup",
					Arguments:    map[string]any{"q": "x"},
				},
			},
		}
	}
	return response
}

func terminalTestGeminiChunkWithoutUsage(text string, finishReason string) *dto.GeminiChatResponse {
	candidate := dto.GeminiChatCandidate{
		Content: dto.GeminiChatContent{
			Role:  "model",
			Parts: []dto.GeminiPart{{Text: text}},
		},
	}
	if finishReason != "" {
		candidate.FinishReason = terminalTestPtr(finishReason)
	}
	return &dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{candidate},
	}
}

func terminalTestGeminiToolChunkWithoutUsage() *dto.GeminiChatResponse {
	return &dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Role: "model",
					Parts: []dto.GeminiPart{
						{
							FunctionCall: &dto.FunctionCall{
								FunctionName: "lookup",
								Arguments:    map[string]any{"q": "x"},
							},
						},
					},
				},
			},
		},
	}
}

func terminalTestGeminiUsageOnlyChunk() *dto.GeminiChatResponse {
	return &dto.GeminiChatResponse{
		HasUsageMetadata: true,
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     4,
			CandidatesTokenCount: 2,
			TotalTokenCount:      6,
		},
	}
}

func terminalTestFinishedChatChunks(t *testing.T, results []ResponseResult) []*dto.ChatCompletionsStreamResponse {
	t.Helper()
	finished := make([]*dto.ChatCompletionsStreamResponse, 0, 1)
	for _, result := range results {
		response, ok := result.Value.(*dto.ChatCompletionsStreamResponse)
		require.True(t, ok, "unexpected stream result type %T", result.Value)
		if response.IsFinished() {
			finished = append(finished, response)
		}
	}
	return finished
}

func terminalTestAssertClaudeTail(t *testing.T, results []ResponseResult, wantStopReason string) {
	t.Helper()
	responses := make([]*dto.ClaudeResponse, 0, len(results))
	eventCounts := make(map[string]int)
	for _, result := range results {
		response, ok := result.Value.(*dto.ClaudeResponse)
		require.True(t, ok, "unexpected stream result type %T", result.Value)
		responses = append(responses, response)
		eventCounts[response.Type]++
	}

	require.GreaterOrEqual(t, len(responses), 4)
	assert.Equal(t, "message_start", responses[0].Type)
	tail := responses[len(responses)-3:]
	assert.Equal(t, "content_block_stop", tail[0].Type)
	require.NotNil(t, tail[0].Index)
	assert.Equal(t, 0, *tail[0].Index)
	assert.Equal(t, "message_delta", tail[1].Type)
	require.NotNil(t, tail[1].Delta)
	require.NotNil(t, tail[1].Delta.StopReason)
	assert.Equal(t, wantStopReason, *tail[1].Delta.StopReason)
	require.NotNil(t, tail[1].Usage)
	assert.Equal(t, 4, tail[1].Usage.InputTokens)
	assert.Equal(t, 2, tail[1].Usage.OutputTokens)
	assert.Equal(t, "message_stop", tail[2].Type)
	assert.Equal(t, 1, eventCounts["content_block_stop"])
	assert.Equal(t, 1, eventCounts["message_delta"])
	assert.Equal(t, 1, eventCounts["message_stop"])
}

func terminalTestPtr[T any](value T) *T {
	return &value
}
