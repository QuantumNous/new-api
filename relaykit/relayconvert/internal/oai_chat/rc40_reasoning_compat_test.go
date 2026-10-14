package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRC40ReasoningStreamLifecycleAndSegmentation(t *testing.T) {
	t.Run("reasoning summary part lifecycle is balanced", func(t *testing.T) {
		state := NewChatToResponsesStreamState("resp_1", "gpt-test")
		stop := "stop"
		var events []ChatToResponsesStreamEvent
		events = append(events, rc40ResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
			Id: "chatcmpl_1", Model: "gpt-test",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: rc40TextPointer("think")},
			}},
		})...)
		events = append(events, rc40ResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{Content: rc40TextPointer("answer")},
				FinishReason: &stop,
			}},
		})...)
		events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

		types := make([]string, 0, len(events))
		for _, event := range events {
			types = append(types, event.Type)
		}
		require.Equal(t, []string{
			responsesEventCreated,
			responsesEventOutputItemAdded,
			"response.reasoning_summary_part.added",
			responsesEventReasoningSummaryDelta,
			responsesEventOutputItemAdded,
			responsesEventOutputTextDelta,
			"response.output_text.done",
			responsesEventOutputItemDone,
			responsesEventReasoningSummaryDone,
			"response.reasoning_summary_part.done",
			responsesEventOutputItemDone,
			responsesEventCompleted,
		}, types)
		assert.Equal(t, "resp_1_reasoning_0", events[2].Payload.ItemID)
		require.NotNil(t, events[2].Payload.Part)
		assert.Equal(t, "summary_text", events[2].Payload.Part.Type)
		assert.Equal(t, "think", events[9].Payload.Part.Text)
	})

	t.Run("finish reason closes a segment before later deltas", func(t *testing.T) {
		state := NewChatToResponsesStreamState("resp_1", "gpt-test")
		toolIndex := 0
		toolCalls := "tool_calls"
		stop := "stop"
		chunks := []*dto.ChatCompletionsStreamResponse{
			{Id: "chatcmpl_1", Model: "gpt-test", Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: rc40TextPointer("round 1")},
			}}},
			{Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: rc40TextPointer("calling")},
			}}},
			{Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{{
					Index: &toolIndex, ID: "call_1", Type: "function",
					Function: dto.FunctionResponse{Name: "lookup", Arguments: "{}"},
				}}},
			}}},
			{Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: &toolCalls}}},
			{Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: rc40TextPointer("round 2")},
			}}},
			{Choices: []dto.ChatCompletionsStreamResponseChoice{{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{Content: rc40TextPointer("final")},
				FinishReason: &stop,
			}}},
		}

		var events []ChatToResponsesStreamEvent
		for _, chunk := range chunks {
			events = append(events, rc40ResponsesEventsFromChatChunk(t, state, chunk)...)
		}
		events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

		open := map[string]bool{}
		partAdded := map[string]int{}
		partDone := map[string]int{}
		for _, event := range events {
			itemID := event.Payload.ItemID
			if event.Payload.Item != nil {
				itemID = event.Payload.Item.ID
			}
			switch event.Type {
			case responsesEventOutputItemAdded:
				assert.Falsef(t, open[itemID], "item %q added twice", itemID)
				open[itemID] = true
			case responsesEventOutputItemDone:
				assert.Truef(t, open[itemID], "item %q closed without being open", itemID)
				delete(open, itemID)
			case "response.reasoning_summary_part.added":
				partAdded[itemID]++
				assert.Truef(t, open[itemID], "part added for closed item %q", itemID)
			case "response.reasoning_summary_part.done":
				partDone[itemID]++
				assert.Truef(t, open[itemID], "part closed after item %q", itemID)
			case responsesEventReasoningSummaryDelta, responsesEventOutputTextDelta:
				assert.Truef(t, open[itemID], "%s targets closed item %q", event.Type, itemID)
			}
		}
		assert.Empty(t, open)
		for _, itemID := range []string{"resp_1_reasoning_0", "resp_1_reasoning_1"} {
			assert.Equal(t, 1, partAdded[itemID], "reasoning summary part added count for %q", itemID)
			assert.Equal(t, 1, partDone[itemID], "reasoning summary part done count for %q", itemID)
		}

		completed := events[len(events)-1]
		require.Equal(t, responsesEventCompleted, completed.Type)
		require.NotNil(t, completed.Payload.Response)
		output := completed.Payload.Response.Output
		require.Len(t, output, 5)
		assert.Equal(t, []string{
			responsesOutputTypeReasoning,
			responsesOutputTypeMessage,
			responsesOutputTypeFunctionCall,
			responsesOutputTypeReasoning,
			responsesOutputTypeMessage,
		}, []string{output[0].Type, output[1].Type, output[2].Type, output[3].Type, output[4].Type})
		assert.Equal(t, []string{
			"resp_1_reasoning_0",
			"resp_1_msg_0",
			"call_1",
			"resp_1_reasoning_1",
			"resp_1_msg_1",
		}, []string{output[0].ID, output[1].ID, output[2].ID, output[3].ID, output[4].ID})
		assert.Equal(t, "round 1", output[0].Summary[0].Text)
		assert.Equal(t, "calling", output[1].Content[0].Text)
		assert.Equal(t, "round 2", output[3].Summary[0].Text)
		assert.Equal(t, "final", output[4].Content[0].Text)
		assert.Equal(t, "calling\nfinal", state.UsageText())
	})
}

func rc40ResponsesEventsFromChatChunk(
	t *testing.T,
	state *ChatToResponsesStreamState,
	chunk *dto.ChatCompletionsStreamResponse,
) []ChatToResponsesStreamEvent {
	t.Helper()
	events, err := ChatCompletionsStreamChunkToResponsesEvents(chunk, state)
	require.NoError(t, err)
	return events
}

func rc40TextPointer(value string) *string {
	return &value
}
