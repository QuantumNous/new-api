package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestStreamResponseOpenAI2ClaudeFirstChunkKeepsThinkingAndText(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		SendResponseCount: 1,
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
	}
	resp := &dto.ChatCompletionsStreamResponse{
		Id:    "resp_1",
		Model: "gemini-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0},
		},
	}
	resp.Choices[0].Delta.SetReasoningContent("thinking")
	resp.Choices[0].Delta.SetContentString("answer")

	out := StreamResponseOpenAI2Claude(resp, info)

	require.Len(t, out, 6)
	require.Equal(t, "message_start", out[0].Type)
	require.Equal(t, "content_block_start", out[1].Type)
	require.Equal(t, "thinking", out[1].ContentBlock.Type)
	require.Equal(t, "content_block_delta", out[2].Type)
	require.Equal(t, "thinking_delta", out[2].Delta.Type)
	require.Equal(t, "thinking", *out[2].Delta.Thinking)
	require.Equal(t, "content_block_stop", out[3].Type)
	require.Equal(t, 0, *out[3].Index)
	require.Equal(t, "content_block_start", out[4].Type)
	require.Equal(t, "text", out[4].ContentBlock.Type)
	require.Equal(t, "content_block_delta", out[5].Type)
	require.Equal(t, "text_delta", out[5].Delta.Type)
	require.Equal(t, "answer", *out[5].Delta.Text)
}

func TestStreamResponseOpenAI2ClaudeMidStreamKeepsThinkingAndText(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		SendResponseCount: 2,
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
	}
	resp := &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0},
		},
	}
	resp.Choices[0].Delta.SetReasoningContent("thinking")
	resp.Choices[0].Delta.SetContentString("answer")

	out := StreamResponseOpenAI2Claude(resp, info)

	require.Len(t, out, 5)
	require.Equal(t, "content_block_start", out[0].Type)
	require.Equal(t, "thinking", out[0].ContentBlock.Type)
	require.Equal(t, "content_block_delta", out[1].Type)
	require.Equal(t, "thinking_delta", out[1].Delta.Type)
	require.Equal(t, "thinking", *out[1].Delta.Thinking)
	require.Equal(t, "content_block_stop", out[2].Type)
	require.Equal(t, 0, *out[2].Index)
	require.Equal(t, "content_block_start", out[3].Type)
	require.Equal(t, "text", out[3].ContentBlock.Type)
	require.Equal(t, "content_block_delta", out[4].Type)
	require.Equal(t, "text_delta", out[4].Delta.Type)
	require.Equal(t, "answer", *out[4].Delta.Text)
}
