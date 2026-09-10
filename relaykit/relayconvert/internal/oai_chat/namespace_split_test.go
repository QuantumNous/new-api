package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The request converter flattens a Responses namespace group into
// "namespace__tool" so chat completions can carry it. A client that declared
// the tool inside a group only recognises the call when both halves come back
// separated, so the flat name has to be split again on the way out.
func TestSplitNamespacedToolNames(t *testing.T) {
	t.Run("non-streaming", func(t *testing.T) {
		tests := []struct {
			name          string
			toolName      string
			wantName      string
			wantNamespace string
		}{
			{name: "namespaced", toolName: "container__js", wantName: "js", wantNamespace: "container"},
			{name: "nested namespace", toolName: "mcp__codex_app__read_thread", wantName: "read_thread", wantNamespace: "mcp__codex_app"},
			{name: "plain tool keeps its whole name", toolName: "lookup", wantName: "lookup", wantNamespace: ""},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				resp, _, err := ChatCompletionsResponseToResponsesResponse(&dto.OpenAITextResponse{
					Id:    "chatcmpl_1",
					Model: "gpt-test",
					Choices: []dto.OpenAITextResponseChoice{
						{
							Message:      assistantMessageWithTool("", "call_1", tt.toolName, "{}"),
							FinishReason: "tool_calls",
						},
					},
				}, "resp_1")
				require.NoError(t, err)

				require.Len(t, resp.Output, 1)
				assert.Equal(t, tt.wantName, resp.Output[0].Name)
				assert.Equal(t, tt.wantNamespace, resp.Output[0].Namespace)
			})
		}
	})

	t.Run("streaming", func(t *testing.T) {
		state := NewChatToResponsesStreamState("resp_1", "gpt-test")
		toolIndex := 0
		events := mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
			Choices: []dto.ChatCompletionsStreamResponseChoice{
				{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
					{Index: &toolIndex, ID: "call_1", Type: "function", Function: dto.FunctionResponse{Name: "container__js"}},
				}}},
			},
		})

		added, found := lo.Find(events, func(event ChatToResponsesStreamEvent) bool {
			return event.Type == responsesEventOutputItemAdded
		})
		require.True(t, found)
		require.NotNil(t, added.Payload.Item)
		assert.Equal(t, "js", added.Payload.Item.Name)
		assert.Equal(t, "container", added.Payload.Item.Namespace)
	})
}
