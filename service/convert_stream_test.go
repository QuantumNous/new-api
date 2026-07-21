package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStreamResponseOpenAI2ClaudeParallelToolCallsHaveValidBlockLifecycle(t *testing.T) {
	info := &relaycommon.RelayInfo{SendResponseCount: 1, ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{}}
	first := &dto.ChatCompletionsStreamResponse{
		Id: "chatcmpl_1", Model: "glm",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: pointerTo(0), ID: "call_weather", Function: dto.FunctionResponse{Name: "get_weather"}},
				{Index: pointerTo(1), ID: "call_time", Function: dto.FunctionResponse{Name: "get_time"}},
			}},
		}},
	}

	events := StreamResponseOpenAI2Claude(first, info)
	info.SendResponseCount++
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: pointerTo(0), Function: dto.FunctionResponse{Arguments: `{"city":"Tokyo"}`}},
				{Index: pointerTo(1), Function: dto.FunctionResponse{Arguments: `{}`}},
			}},
		}},
	}, info)...)
	info.SendResponseCount++
	finishReason := "tool_calls"
	events = append(events, StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{FinishReason: &finishReason}},
		Usage:   &dto.Usage{},
	}, info)...)

	started := map[int]bool{}
	stopped := map[int]bool{}
	for _, event := range events {
		if event.Index == nil {
			continue
		}
		switch event.Type {
		case "content_block_start":
			require.False(t, started[*event.Index], "block %d started twice", *event.Index)
			started[*event.Index] = true
		case "content_block_delta":
			assert.True(t, started[*event.Index], "block %d received delta before start", *event.Index)
			assert.False(t, stopped[*event.Index], "block %d received delta after stop", *event.Index)
		case "content_block_stop":
			assert.True(t, started[*event.Index], "block %d stopped before start", *event.Index)
			stopped[*event.Index] = true
		}
	}

	assert.Equal(t, map[int]bool{0: true, 1: true}, started)
	assert.Equal(t, started, stopped)
}

func pointerTo[T any](value T) *T {
	return &value
}
