package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestChatCompletionsRequestToResponsesRequestInstructionsAndTools(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		N:     lo.ToPtr(1),
		Messages: []dto.Message{
			{Role: "system", Content: "system rules"},
			{Role: "developer", Content: "developer rules"},
			{Role: "user", Content: []any{
				map[string]any{"type": "text", "text": "look"},
				map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.test/a.png"}},
			}},
			assistantMessageWithTool("partial text", "call_1", "lookup", `{"q":"x"}`),
			{Role: "tool", ToolCallId: "call_1", Content: "tool result"},
		},
	}

	got, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)

	assert.Equal(t, "gpt-test", got.Model)
	assert.Equal(t, `"system rules\n\ndeveloper rules"`, string(got.Instructions))
	assert.Equal(t, "input_image", gjson.GetBytes(got.Input, "0.content.1.type").String())
	assert.Equal(t, "function_call", gjson.GetBytes(got.Input, "2.type").String())
	assert.Equal(t, "call_1", gjson.GetBytes(got.Input, "2.call_id").String())
	assert.Equal(t, "function_call_output", gjson.GetBytes(got.Input, "3.type").String())
}

func TestChatCompletionsRequestToResponsesRequestRejectsMultipleChoices(t *testing.T) {
	_, err := ChatCompletionsRequestToResponsesRequest(&dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		N:     lo.ToPtr(2),
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "n>1")
}

func TestResponsesResponseToChatCompletionsPreservesTextAndToolCalls(t *testing.T) {
	resp := &dto.OpenAIResponsesResponse{
		ID:        "resp_1",
		CreatedAt: 123,
		Model:     "gpt-test",
		Status:    []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{
				Type: responsesOutputTypeMessage,
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: "I will call a tool."},
				},
			},
			{
				Type:      responsesOutputTypeFunctionCall,
				ID:        "fc_1",
				CallId:    "call_1",
				Name:      "lookup",
				Arguments: []byte(`{"q":"x"}`),
			},
		},
		Usage: &dto.Usage{InputTokens: 3, OutputTokens: 4, TotalTokens: 7},
	}

	chat, usage, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_1")
	require.NoError(t, err)
	require.NotNil(t, usage)

	require.Len(t, chat.Choices, 1)
	assert.Equal(t, "tool_calls", chat.Choices[0].FinishReason)
	assert.Equal(t, "I will call a tool.", chat.Choices[0].Message.StringContent())
	toolCalls := chat.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "call_1", toolCalls[0].ID)
	assert.Equal(t, "lookup", toolCalls[0].Function.Name)
	assert.Equal(t, `{"q":"x"}`, toolCalls[0].Function.Arguments)
	assert.Equal(t, 7, usage.TotalTokens)
}

func TestResponsesResponseToChatCompletionsPreservesReasoningSummary(t *testing.T) {
	resp := &dto.OpenAIResponsesResponse{
		ID:     "resp_1",
		Model:  "gpt-test",
		Status: []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{
				Type: responsesOutputTypeReasoning,
				Content: []dto.ResponsesOutputContent{
					{Type: "summary_text", Text: "first summary"},
					{Type: "summary_text", Text: "\n\nsecond summary"},
				},
			},
			{
				Type: responsesOutputTypeMessage,
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: "final"},
				},
			},
		},
	}

	chat, _, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_1")
	require.NoError(t, err)
	assert.Equal(t, "first summary\n\nsecond summary", chat.Choices[0].Message.GetReasoningContent())
	assert.Equal(t, "final", chat.Choices[0].Message.StringContent())
}

func TestResponsesFinishReasonFromIncompleteStatus(t *testing.T) {
	tests := []struct {
		name   string
		reason string
		want   string
	}{
		{name: "max output", reason: responsesIncompleteReasonMaxTokens, want: "length"},
		{name: "content filter", reason: responsesIncompleteReasonContentFilter, want: "content_filter"},
		{name: "unknown", reason: "other", want: "length"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := ResponsesFinishReasonFromStatus(&dto.OpenAIResponsesResponse{
				Status:            []byte(`"incomplete"`),
				IncompleteDetails: &dto.IncompleteDetails{Reason: tt.reason},
			})
			require.True(t, ok)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestResponsesStreamEventToChatChunksUsesOutputIndexForToolArguments(t *testing.T) {
	state := newTestResponsesStreamState()
	outputIndex := 1

	var chunks []dto.ChatCompletionsStreamResponse
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{Type: responsesEventCreated})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{Type: responsesEventOutputTextDelta, Delta: "text before tool"})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventFunctionArgsDelta,
		OutputIndex: &outputIndex,
		Delta:       `{"cmd":"ls"}`,
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeFunctionCall,
			ID:     "fc_1",
			CallId: "call_1",
			Name:   "exec",
		},
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type: responsesEventCompleted,
		Response: &dto.OpenAIResponsesResponse{
			Status: []byte(`"completed"`),
			Usage:  &dto.Usage{InputTokens: 1, OutputTokens: 2, TotalTokens: 3},
		},
	})...)

	require.Len(t, chunks, 4)
	assert.Equal(t, "assistant", chunks[0].Choices[0].Delta.Role)
	assert.Equal(t, "text before tool", chunks[1].Choices[0].Delta.GetContentString())
	tool := chunks[2].Choices[0].Delta.ToolCalls[0]
	require.NotNil(t, tool.Index)
	assert.Equal(t, 0, *tool.Index)
	assert.Equal(t, "call_1", tool.ID)
	assert.Equal(t, "exec", tool.Function.Name)
	assert.Equal(t, `{"cmd":"ls"}`, tool.Function.Arguments)
	require.NotNil(t, chunks[3].Choices[0].FinishReason)
	assert.Equal(t, "tool_calls", *chunks[3].Choices[0].FinishReason)
	assert.Equal(t, 3, state.Usage.TotalTokens)
}

func TestResponsesStreamEventToChatChunksCustomToolAndReasoning(t *testing.T) {
	state := newTestResponsesStreamState()
	outputIndex := 0

	chunks := mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:  responsesEventReasoningTextDelta,
		Delta: "thinking",
	})
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeCustomToolCall,
			ID:     "ct_1",
			CallId: "call_custom",
			Name:   "apply_patch",
		},
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventCustomToolInputDelta,
		OutputIndex: &outputIndex,
		Delta:       "patch body",
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type: responsesEventIncomplete,
		Response: &dto.OpenAIResponsesResponse{
			IncompleteDetails: &dto.IncompleteDetails{Reason: responsesIncompleteReasonContentFilter},
		},
	})...)

	require.Len(t, chunks, 5)
	assert.Equal(t, "thinking", chunks[1].Choices[0].Delta.GetReasoningContent())
	assert.Equal(t, "apply_patch", chunks[2].Choices[0].Delta.ToolCalls[0].Function.Name)
	assert.Equal(t, "patch body", chunks[3].Choices[0].Delta.ToolCalls[0].Function.Arguments)
	require.NotNil(t, chunks[4].Choices[0].FinishReason)
	assert.Equal(t, "content_filter", *chunks[4].Choices[0].FinishReason)
}

func TestResponsesStreamEventToChatChunksUsesTerminalDoneOutput(t *testing.T) {
	state := newTestResponsesStreamState()
	chunks := mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type: responsesEventDone,
		Response: &dto.OpenAIResponsesResponse{
			Status: []byte(`"completed"`),
			Output: []dto.ResponsesOutput{
				{
					Type: responsesOutputTypeMessage,
					Role: "assistant",
					Content: []dto.ResponsesOutputContent{
						{Type: "output_text", Text: "terminal text"},
					},
				},
				{
					Type:      responsesOutputTypeFunctionCall,
					ID:        "fc_1",
					CallId:    "call_1",
					Name:      "lookup",
					Arguments: []byte(`{"q":"x"}`),
				},
			},
		},
	})

	require.Len(t, chunks, 4)
	assert.Equal(t, "assistant", chunks[0].Choices[0].Delta.Role)
	assert.Equal(t, "terminal text", chunks[1].Choices[0].Delta.GetContentString())
	tool := chunks[2].Choices[0].Delta.ToolCalls[0]
	assert.Equal(t, "lookup", tool.Function.Name)
	assert.Equal(t, `{"q":"x"}`, tool.Function.Arguments)
	require.NotNil(t, chunks[3].Choices[0].FinishReason)
	assert.Equal(t, "tool_calls", *chunks[3].Choices[0].FinishReason)
}

func TestFinalizeResponsesToChatStreamFlushesPendingDeltaOnlyArguments(t *testing.T) {
	state := newTestResponsesStreamState()
	outputIndex := 2
	_, err := ResponsesStreamEventToChatChunks(&dto.ResponsesStreamResponse{
		Type:        responsesEventFunctionArgsDelta,
		OutputIndex: &outputIndex,
		Delta:       `{"pending":true}`,
	}, state)
	require.NoError(t, err)

	chunks := FinalizeResponsesToChatStream(state)
	require.Len(t, chunks, 3)
	tool := chunks[1].Choices[0].Delta.ToolCalls[0]
	assert.Equal(t, "call_output_2", tool.ID)
	assert.Equal(t, `{"pending":true}`, tool.Function.Arguments)
	require.NotNil(t, chunks[2].Choices[0].FinishReason)
	assert.Equal(t, "tool_calls", *chunks[2].Choices[0].FinishReason)
}

func TestResponsesStreamEventToChatChunksFailedEventReturnsError(t *testing.T) {
	_, err := ResponsesStreamEventToChatChunks(&dto.ResponsesStreamResponse{Type: responsesEventFailed}, newTestResponsesStreamState())
	require.Error(t, err)
}

func TestResponsesBufferedAccumulatorSupplementsEmptyTerminalOutput(t *testing.T) {
	acc := NewResponsesBufferedAccumulator()
	outputIndex := 1
	acc.ProcessEvent(&dto.ResponsesStreamResponse{Type: responsesEventOutputTextDelta, Delta: "buffered text"})
	acc.ProcessEvent(&dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeFunctionCall,
			ID:     "fc_1",
			CallId: "call_1",
			Name:   "lookup",
		},
	})
	acc.ProcessEvent(&dto.ResponsesStreamResponse{
		Type:        responsesEventFunctionArgsDelta,
		OutputIndex: &outputIndex,
		Delta:       `{"q":"x"}`,
	})

	resp := &dto.OpenAIResponsesResponse{
		Status: []byte(`"completed"`),
		Model:  "gpt-test",
	}
	acc.SupplementResponseOutput(resp)

	chat, _, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_1")
	require.NoError(t, err)
	assert.Equal(t, "buffered text", chat.Choices[0].Message.StringContent())
	toolCalls := chat.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, `{"q":"x"}`, toolCalls[0].Function.Arguments)
}

func assistantMessageWithTool(content string, id string, name string, args string) dto.Message {
	msg := dto.Message{Role: "assistant", Content: content}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   id,
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      name,
				Arguments: args,
			},
		},
	})
	return msg
}

func newTestResponsesStreamState() *ResponsesToChatStreamState {
	state := NewResponsesToChatStreamState("gpt-test", false)
	state.ID = "chatcmpl_test"
	state.Created = 123
	return state
}

func mustStreamChunks(t *testing.T, state *ResponsesToChatStreamState, event *dto.ResponsesStreamResponse) []dto.ChatCompletionsStreamResponse {
	t.Helper()
	chunks, err := ResponsesStreamEventToChatChunks(event, state)
	require.NoError(t, err)
	return chunks
}
