package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestStreamResponseOpenAI2ClaudeClosesStopChunkWithoutUpstreamUsage(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
			Usage: &dto.Usage{
				PromptTokens:     10,
				CompletionTokens: 20,
			},
		},
	}

	content := func(text string) *dto.ChatCompletionsStreamResponse {
		return &dto.ChatCompletionsStreamResponse{
			Id:      "chatcmpl-test",
			Object:  "chat.completion.chunk",
			Model:   "qwen3.6-plus",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: common.GetPointer(text)}}},
		}
	}
	reasoning := func(text string) *dto.ChatCompletionsStreamResponse {
		return &dto.ChatCompletionsStreamResponse{
			Id:      "chatcmpl-test",
			Object:  "chat.completion.chunk",
			Model:   "qwen3.6-plus",
			Choices: []dto.ChatCompletionsStreamResponseChoice{{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: common.GetPointer(text)}}},
		}
	}

	info.SendResponseCount = 1
	responses := StreamResponseOpenAI2Claude(reasoning("thinking"), info)
	require.Len(t, responses, 3)
	require.Equal(t, "message_start", responses[0].Type)
	require.Equal(t, "content_block_start", responses[1].Type)
	require.Equal(t, "content_block_delta", responses[2].Type)

	info.SendResponseCount = 2
	responses = StreamResponseOpenAI2Claude(content("hello"), info)
	require.Len(t, responses, 3)
	require.Equal(t, "content_block_stop", responses[0].Type)
	require.Equal(t, 0, responses[0].GetIndex())
	require.Equal(t, "content_block_start", responses[1].Type)
	require.Equal(t, 1, responses[1].GetIndex())
	require.Equal(t, "content_block_delta", responses[2].Type)

	finishReason := constant.FinishReasonStop
	responses = StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{
		Id:     "chatcmpl-test",
		Object: "chat.completion.chunk",
		Model:  "qwen3.6-plus",
		Choices: []dto.ChatCompletionsStreamResponseChoice{{
			Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{Content: common.GetPointer("")},
			FinishReason: &finishReason,
		}},
	}, info)

	require.Len(t, responses, 3)
	require.Equal(t, "content_block_stop", responses[0].Type)
	require.Equal(t, 1, responses[0].GetIndex())
	require.Equal(t, "message_delta", responses[1].Type)
	require.NotNil(t, responses[1].Usage)
	require.Equal(t, 10, responses[1].Usage.InputTokens)
	require.Equal(t, 20, responses[1].Usage.OutputTokens)
	require.NotNil(t, responses[1].Delta)
	require.NotNil(t, responses[1].Delta.StopReason)
	require.Equal(t, "end_turn", *responses[1].Delta.StopReason)
	require.Equal(t, "message_stop", responses[2].Type)
	require.True(t, info.ClaudeConvertInfo.Done)
}
