package chat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/stretchr/testify/require"
)

func TestFromStreamAssociatesMissingIndexWithUniqueOpenTool(t *testing.T) {
	t.Parallel()
	state := ir.NewStreamState("chat_1", "gpt-test")
	_, err := FromStream(chatToolChunk(dto.ToolCallResponse{
		ID: "call_1",
		Function: dto.FunctionResponse{
			Name:      "lookup",
			Arguments: `{"q":`,
		},
	}), state)
	require.NoError(t, err)

	events, err := FromStream(chatToolChunk(dto.ToolCallResponse{
		Function: dto.FunctionResponse{Arguments: `"x"}`},
	}), state)
	require.NoError(t, err)
	require.NotEmpty(t, events)
	blockIndex := state.ToolIndex[0]
	require.Equal(t, blockIndex, events[len(events)-1].Index)
}

func TestFromStreamRejectsAmbiguousMissingToolIndex(t *testing.T) {
	t.Parallel()
	state := ir.NewStreamState("chat_1", "gpt-test")
	_, err := FromStream(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{ID: "call_1", Function: dto.FunctionResponse{Name: "first"}},
				{ID: "call_2", Function: dto.FunctionResponse{Name: "second"}},
			}},
		}},
	}, state)
	require.NoError(t, err)

	_, err = FromStream(chatToolChunk(dto.ToolCallResponse{
		Function: dto.FunctionResponse{Arguments: `{}`},
	}), state)
	require.ErrorContains(t, err, "ambiguous tool arguments delta")
}

func chatToolChunk(tool dto.ToolCallResponse) *dto.ChatCompletionsStreamResponse {
	return &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{tool}},
		}},
	}
}
