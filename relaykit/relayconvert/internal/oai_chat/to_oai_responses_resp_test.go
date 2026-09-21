package oaichat

import (
	"fmt"
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

func mustResponsesEventsFromChatChunk(t *testing.T, state *ChatToResponsesStreamState, chunk *dto.ChatCompletionsStreamResponse) []ChatToResponsesStreamEvent {
	t.Helper()
	events, err := ChatCompletionsStreamChunkToResponsesEvents(chunk, state)
	require.NoError(t, err)
	return events
}

func TestChatCompletionsStreamToResponsesReopensReasoningAfterMidStreamFinishReason(t *testing.T) {
	for _, emitSequenceNumber := range []bool{false, true} {
		t.Run(fmt.Sprintf("EmitSequenceNumber=%t", emitSequenceNumber), func(t *testing.T) {
			state := NewChatToResponsesStreamState("resp_1", "gpt-test")
			state.EmitSequenceNumber = emitSequenceNumber
			toolIndex := 0
			toolCalls := "tool_calls"
			stop := "stop"

			var events []ChatToResponsesStreamEvent
			appendEvents := func(chunk *dto.ChatCompletionsStreamResponse) {
				events = append(events, mustResponsesEventsFromChatChunk(t, state, chunk)...)
			}

			appendEvents(&dto.ChatCompletionsStreamResponse{
				Id:    "chatcmpl_1",
				Model: "gpt-test",
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Index: 0,
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						ReasoningContent: lo.ToPtr("round 1"),
					},
				}},
			})
			appendEvents(&dto.ChatCompletionsStreamResponse{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Index: 0,
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
						Index: &toolIndex,
						ID:    "call_1",
						Type:  "function",
						Function: dto.FunctionResponse{
							Name:      "lookup",
							Arguments: "{}",
						},
					}}},
				}},
			})
			appendEvents(&dto.ChatCompletionsStreamResponse{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Index:        0,
					FinishReason: &toolCalls,
				}},
			})
			appendEvents(&dto.ChatCompletionsStreamResponse{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Index: 0,
					Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
						ReasoningContent: lo.ToPtr("round 2"),
					},
				}},
			})
			appendEvents(&dto.ChatCompletionsStreamResponse{
				Choices: []dto.ChatCompletionsStreamResponseChoice{{
					Index:        0,
					FinishReason: &stop,
				}},
			})
			events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

			openReasoning := map[string]bool{}
			reasoningPartAdded := 0
			for _, event := range events {
				itemID := event.Payload.ItemID
				if event.Payload.Item != nil && itemID == "" {
					itemID = event.Payload.Item.ID
				}
				switch event.Type {
				case responsesEventOutputItemAdded:
					if event.Payload.Item != nil && event.Payload.Item.Type == responsesOutputTypeReasoning {
						openReasoning[itemID] = true
					}
				case responsesEventOutputItemDone:
					delete(openReasoning, itemID)
				case "response.reasoning_summary_part.added":
					reasoningPartAdded++
				case responsesEventReasoningSummaryDelta:
					assert.Truef(t, openReasoning[itemID], "reasoning delta for %q arrived without an active item", itemID)
				}
			}

			assert.Equal(t, 2, reasoningPartAdded)

			require.NotEmpty(t, events)
			completed := events[len(events)-1]
			require.Equal(t, responsesEventCompleted, completed.Type)
			require.NotNil(t, completed.Payload.Response)

			var reasoningOutputs []dto.ResponsesOutput
			for _, output := range completed.Payload.Response.Output {
				if output.Type == responsesOutputTypeReasoning {
					reasoningOutputs = append(reasoningOutputs, output)
				}
			}
			require.Len(t, reasoningOutputs, 2)
			assert.NotEqual(t, reasoningOutputs[0].ID, reasoningOutputs[1].ID)
			require.Len(t, reasoningOutputs[0].Summary, 1)
			require.Len(t, reasoningOutputs[1].Summary, 1)
			assert.Equal(t, "round 1", reasoningOutputs[0].Summary[0].Text)
			assert.Equal(t, "round 2", reasoningOutputs[1].Summary[0].Text)
		})
	}
}
