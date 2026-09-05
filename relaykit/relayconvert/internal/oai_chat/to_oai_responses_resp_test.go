package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatCompletionsResponseToResponsesPreservesTextToolCallsAndUsage(t *testing.T) {
	chat := &dto.OpenAITextResponse{
		Id:      "chatcmpl_1",
		Model:   "gpt-test",
		Created: 456,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Message:      assistantMessageWithTool("I will call.", "call_1", "lookup", `{"q":"x"}`),
				FinishReason: "tool_calls",
			},
		},
		Usage: dto.Usage{PromptTokens: 3, CompletionTokens: 5, TotalTokens: 8},
	}

	resp, usage, err := ChatCompletionsResponseToResponsesResponse(chat, "resp_1")
	require.NoError(t, err)
	require.NotNil(t, usage)

	assert.Equal(t, "resp_1", resp.ID)
	assert.Equal(t, "response", resp.Object)
	assert.Equal(t, `"completed"`, string(resp.Status))
	assert.Equal(t, 3, resp.Usage.InputTokens)
	assert.Equal(t, 5, resp.Usage.OutputTokens)
	require.Len(t, resp.Output, 2)
	assert.Equal(t, responsesOutputTypeMessage, resp.Output[0].Type)
	assert.Equal(t, "I will call.", resp.Output[0].Content[0].Text)
	assert.Equal(t, responsesOutputTypeFunctionCall, resp.Output[1].Type)
	assert.Equal(t, "call_1", resp.Output[1].CallId)
	assert.Equal(t, "lookup", resp.Output[1].Name)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(resp.Output[1].Arguments))
}

func TestChatCompletionsResponseToResponsesDropsEmptyNameToolCalls(t *testing.T) {
	usage := dto.Usage{PromptTokens: 20, CompletionTokens: 5, TotalTokens: 25}
	usage.PromptTokensDetails.CachedTokens = 7
	usage.BillingUsage = dto.NewOpenAIChatBillingUsage(&usage)
	message := dto.Message{Role: "assistant"}
	message.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_invalid",
			Type: "function",
			Function: dto.FunctionRequest{
				Arguments: `{"ok":true}`,
			},
		},
		{
			ID:       "call_whitespace",
			Function: dto.FunctionRequest{Name: " \t\n", Arguments: `{}`},
		},
		{
			ID:   "call_valid",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "lookup",
				Arguments: `{"q":"x"}`,
			},
		},
	})

	resp, convertedUsage, err := ChatCompletionsResponseToResponsesResponse(&dto.OpenAITextResponse{
		Usage: usage,
		Choices: []dto.OpenAITextResponseChoice{{
			Message:      message,
			FinishReason: "tool_calls",
		}},
	}, "resp_1")
	require.NoError(t, err)

	require.Len(t, resp.Output, 1)
	assert.Equal(t, "call_valid", resp.Output[0].CallId)
	assert.Equal(t, "lookup", resp.Output[0].Name)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(resp.Output[0].Arguments))
	assert.Equal(t, 20, convertedUsage.InputTokens)
	assert.Equal(t, 5, convertedUsage.OutputTokens)
	assert.Equal(t, 25, convertedUsage.TotalTokens)
	require.NotNil(t, convertedUsage.InputTokensDetails)
	assert.Equal(t, 7, convertedUsage.InputTokensDetails.CachedTokens)
	assert.Equal(t, usage.BillingUsage, convertedUsage.BillingUsage)
}

func TestChatCompletionsResponseToResponsesEmitsReasoningSummaryBeforeText(t *testing.T) {
	message := dto.Message{Role: "assistant", Content: "final answer"}
	message.ReasoningContent = lo.ToPtr("thinking summary")
	resp, _, err := ChatCompletionsResponseToResponsesResponse(&dto.OpenAITextResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.OpenAITextResponseChoice{
			{Message: message, FinishReason: "stop"},
		},
	}, "resp_1")
	require.NoError(t, err)

	require.Len(t, resp.Output, 2)
	assert.Equal(t, responsesOutputTypeReasoning, resp.Output[0].Type)
	require.Len(t, resp.Output[0].Summary, 1)
	assert.Equal(t, "thinking summary", resp.Output[0].Summary[0].Text)
	assert.Empty(t, resp.Output[0].Content)
	assert.Equal(t, responsesOutputTypeMessage, resp.Output[1].Type)
	assert.Equal(t, "final answer", resp.Output[1].Content[0].Text)
}

func TestChatCompletionsResponseToResponsesMapsIncompleteFinishReasons(t *testing.T) {
	tests := []struct {
		name         string
		finishReason string
		wantReason   string
	}{
		{name: "length", finishReason: "length", wantReason: responsesIncompleteReasonMaxTokens},
		{name: "content filter", finishReason: "content_filter", wantReason: responsesIncompleteReasonContentFilter},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, _, err := ChatCompletionsResponseToResponsesResponse(&dto.OpenAITextResponse{
				Id:    "chatcmpl_1",
				Model: "gpt-test",
				Choices: []dto.OpenAITextResponseChoice{
					{
						Message:      dto.Message{Role: "assistant", Content: "partial"},
						FinishReason: tt.finishReason,
					},
				},
			}, "resp_1")
			require.NoError(t, err)

			assert.Equal(t, `"incomplete"`, string(resp.Status))
			require.NotNil(t, resp.IncompleteDetails)
			assert.Equal(t, tt.wantReason, resp.IncompleteDetails.Reason)
			require.Len(t, resp.Output, 1)
			assert.Equal(t, "incomplete", resp.Output[0].Status)
		})
	}
}

func TestChatCompletionsStreamToResponsesEventsAggregatesUsageAndToolArgs(t *testing.T) {
	state := NewChatToResponsesStreamState("resp_1", "gpt-test")
	state.Created = 123
	toolIndex := 0

	var events []ChatToResponsesStreamEvent
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Id:      "chatcmpl_1",
		Model:   "gpt-test",
		Created: 123,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant"}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: lo.ToPtr("hello")}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: &toolIndex, ID: "call_1", Type: "function", Function: dto.FunctionResponse{Name: "lookup"}},
			}}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: &toolIndex, Function: dto.FunctionResponse{Arguments: `{"q":"x"}`}},
			}}},
		},
	})...)
	finishReason := "tool_calls"
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, FinishReason: &finishReason},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Usage: &dto.Usage{PromptTokens: 2, CompletionTokens: 4, TotalTokens: 6},
	})...)
	events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

	require.Len(t, events, 10)
	assert.Equal(t, responsesEventCreated, events[0].Type)
	assert.Equal(t, responsesEventOutputTextDelta, events[2].Type)
	assert.Equal(t, "hello", events[2].Payload.Delta)
	assert.Equal(t, responsesEventFunctionArgsDelta, events[4].Type)
	assert.Equal(t, `{"q":"x"}`, events[4].Payload.Delta)
	assert.Equal(t, responsesEventCompleted, events[9].Type)
	require.NotNil(t, events[9].Payload.Response)
	assert.Equal(t, 6, events[9].Payload.Response.Usage.TotalTokens)
	require.Len(t, events[9].Payload.Response.Output, 2)
	assert.Equal(t, "hello", events[9].Payload.Response.Output[0].Content[0].Text)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(events[9].Payload.Response.Output[1].Arguments))
}

func TestChatCompletionsStreamToResponsesDropsToolCallsThatFinishWithoutName(t *testing.T) {
	state := NewChatToResponsesStreamState("resp_1", "gpt-test")
	state.EmitSequenceNumber = true
	usage := dto.Usage{PromptTokens: 20, CompletionTokens: 5, TotalTokens: 25}
	usage.PromptTokensDetails.CachedTokens = 7
	usage.BillingUsage = dto.NewOpenAIChatBillingUsage(&usage)
	invalidIndex := 0
	validIndex := 1
	whitespaceIndex := 2

	var events []ChatToResponsesStreamEvent
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Usage: &usage,
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Index: 0,
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{
					Index:    &invalidIndex,
					ID:       "call_invalid",
					Type:     "function",
					Function: dto.FunctionResponse{Arguments: `{"ok":true}`},
				},
				{
					Index:    &validIndex,
					ID:       "call_valid",
					Type:     "function",
					Function: dto.FunctionResponse{Name: "lookup", Arguments: `{"q":"x"}`},
				},
				{
					Index:    &whitespaceIndex,
					ID:       "call_whitespace",
					Function: dto.FunctionResponse{Name: " \t\n", Arguments: `{}`},
				},
			}},
		}},
	})...)
	finishReason := "tool_calls"
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{Index: 0, FinishReason: &finishReason}},
	})...)
	events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

	for i, event := range events {
		require.NotNil(t, event.Payload.SequenceNumber)
		assert.Equal(t, i, *event.Payload.SequenceNumber)
		if event.Payload.OutputIndex != nil {
			assert.Equal(t, 0, *event.Payload.OutputIndex)
		}
		if event.Payload.Item != nil && event.Payload.Item.Type == responsesOutputTypeFunctionCall {
			assert.Equal(t, "lookup", event.Payload.Item.Name)
		}
	}
	completed := events[len(events)-1].Payload.Response
	require.NotNil(t, completed)
	require.Len(t, completed.Output, 1)
	assert.Equal(t, "call_valid", completed.Output[0].CallId)
	assert.Equal(t, "lookup", completed.Output[0].Name)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(completed.Output[0].Arguments))
	assert.Equal(t, 20, completed.Usage.InputTokens)
	assert.Equal(t, 5, completed.Usage.OutputTokens)
	assert.Equal(t, 25, completed.Usage.TotalTokens)
	require.NotNil(t, completed.Usage.InputTokensDetails)
	assert.Equal(t, 7, completed.Usage.InputTokensDetails.CachedTokens)
	assert.Equal(t, usage.BillingUsage, completed.Usage.BillingUsage)
}

func TestChatCompletionsStreamToResponsesBuffersToolCallUntilNameArrives(t *testing.T) {
	state := NewChatToResponsesStreamState("resp_1", "gpt-test")
	toolIndex := 0

	firstEvents := mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Index: 0,
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index:    &toolIndex,
				Type:     "function",
				Function: dto.FunctionResponse{Arguments: `{"q":`},
			}}},
		}},
	})
	require.Len(t, firstEvents, 1)
	assert.Equal(t, responsesEventCreated, firstEvents[0].Type)

	secondEvents := mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Index: 0,
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
				Index:    &toolIndex,
				ID:       "call_1",
				Function: dto.FunctionResponse{Name: "lookup", Arguments: `"x"}`},
			}}},
		}},
	})
	require.Len(t, secondEvents, 2)
	assert.Equal(t, responsesEventOutputItemAdded, secondEvents[0].Type)
	require.NotNil(t, secondEvents[0].Payload.Item)
	assert.Equal(t, "lookup", secondEvents[0].Payload.Item.Name)
	assert.Equal(t, "call_1", secondEvents[0].Payload.Item.ID)
	assert.Equal(t, "call_1", secondEvents[0].Payload.Item.CallId)
	assert.Equal(t, responsesEventFunctionArgsDelta, secondEvents[1].Type)
	assert.Equal(t, "call_1", secondEvents[1].Payload.ItemID)
	assert.Equal(t, `{"q":"x"}`, secondEvents[1].Payload.Delta)

	finalEvents := FinalizeChatCompletionsStreamToResponses(state)
	completed := finalEvents[len(finalEvents)-1].Payload.Response
	require.NotNil(t, completed)
	require.Len(t, completed.Output, 1)
	assert.Equal(t, "call_1", completed.Output[0].ID)
	assert.Equal(t, "call_1", completed.Output[0].CallId)
	assert.Equal(t, "lookup", completed.Output[0].Name)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(completed.Output[0].Arguments))
}

func mustResponsesEventsFromChatChunk(t *testing.T, state *ChatToResponsesStreamState, chunk *dto.ChatCompletionsStreamResponse) []ChatToResponsesStreamEvent {
	t.Helper()
	events, err := ChatCompletionsStreamChunkToResponsesEvents(chunk, state)
	require.NoError(t, err)
	return events
}
