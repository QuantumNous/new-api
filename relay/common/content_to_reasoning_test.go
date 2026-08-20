package common

import (
	"testing"

	commonutil "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newContentToReasoningTestInfo(markers []dto.ContentToReasoningMarkerPair) *RelayInfo {
	info := &RelayInfo{ChannelMeta: &ChannelMeta{}}
	info.ChannelOtherSettings.ContentToReasoning = &dto.ContentToReasoningSettings{
		Enabled: true,
		Markers: markers,
	}
	return info
}

func strPtr(value string) *string {
	return &value
}

func marshalContentToReasoningStream(t *testing.T, stream dto.ChatCompletionsStreamResponse) string {
	t.Helper()
	data, err := commonutil.Marshal(stream)
	require.NoError(t, err)
	return string(data)
}

func requireTextValue(t *testing.T, value *string, want string) {
	t.Helper()
	require.NotNil(t, value)
	assert.Equal(t, want, *value)
}

func TestTransformContentToReasoningStreamSplitsAcrossChunks(t *testing.T) {
	info := newContentToReasoningTestInfo(nil)

	responses, err := info.TransformContentToReasoningStream(marshalContentToReasoningStream(t, dto.ChatCompletionsStreamResponse{
		Id:      "chat-1",
		Created: 1,
		Model:   "test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Role:    "assistant",
					Content: strPtr("<mm:th"),
				},
			},
		},
	}))
	require.NoError(t, err)
	require.Len(t, responses, 1)
	require.Len(t, responses[0].Choices, 1)
	assert.Equal(t, "assistant", responses[0].Choices[0].Delta.Role)
	assert.Nil(t, responses[0].Choices[0].Delta.Content)

	responses, err = info.TransformContentToReasoningStream(marshalContentToReasoningStream(t, dto.ChatCompletionsStreamResponse{
		Id:      "chat-1",
		Created: 1,
		Model:   "test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: strPtr("ink>visible</mm:think>answer"),
				},
			},
		},
	}))
	require.NoError(t, err)
	require.Len(t, responses, 2)

	first := responses[0].Choices[0]
	requireTextValue(t, first.Delta.ReasoningContent, "visible")
	assert.Nil(t, first.Delta.Content)

	second := responses[1].Choices[0]
	requireTextValue(t, second.Delta.Content, "answer")
	assert.Nil(t, second.Delta.ReasoningContent)
}

func TestTransformContentToReasoningStreamPassesThroughStructuredContent(t *testing.T) {
	info := newContentToReasoningTestInfo(nil)

	content := "already structured"
	reasoning := "precomputed"
	responses, err := info.TransformContentToReasoningStream(marshalContentToReasoningStream(t, dto.ChatCompletionsStreamResponse{
		Id:      "chat-2",
		Created: 2,
		Model:   "test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content:          &content,
					ReasoningContent: &reasoning,
				},
			},
		},
	}))
	require.NoError(t, err)
	require.Len(t, responses, 1)
	require.Len(t, responses[0].Choices, 1)

	got := responses[0].Choices[0].Delta
	requireTextValue(t, got.Content, content)
	requireTextValue(t, got.ReasoningContent, reasoning)
}

func TestContentToReasoningFlushEmitsUnclosedReasoning(t *testing.T) {
	info := newContentToReasoningTestInfo(nil)

	_, err := info.TransformContentToReasoningStream(marshalContentToReasoningStream(t, dto.ChatCompletionsStreamResponse{
		Id:      "chat-3",
		Created: 3,
		Model:   "test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: strPtr("<mm:think>unfinished"),
				},
			},
		},
	}))
	require.NoError(t, err)

	responses, flushed := info.ContentToReasoningFlush()
	assert.True(t, flushed)
	require.Len(t, responses, 1)
	require.Len(t, responses[0].Choices, 1)
	requireTextValue(t, responses[0].Choices[0].Delta.ReasoningContent, "unfinished")
}

func TestTransformContentToReasoningStreamPassthroughUsageOnlyChunk(t *testing.T) {
	info := newContentToReasoningTestInfo(nil)
	usage := &dto.Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15}

	responses, err := info.TransformContentToReasoningStream(marshalContentToReasoningStream(t, dto.ChatCompletionsStreamResponse{
		Id:      "chat-4",
		Created: 4,
		Model:   "test",
		Usage:   usage,
	}))
	require.NoError(t, err)
	require.Len(t, responses, 1)
	require.Empty(t, responses[0].Choices)
	require.NotNil(t, responses[0].Usage)
	assert.Equal(t, 15, responses[0].Usage.TotalTokens)
}

func TestTransformContentToReasoningStreamDropsEmptyChunkWithoutUsage(t *testing.T) {
	info := newContentToReasoningTestInfo(nil)

	responses, err := info.TransformContentToReasoningStream(marshalContentToReasoningStream(t, dto.ChatCompletionsStreamResponse{
		Id:      "chat-5",
		Created: 5,
		Model:   "test",
	}))
	require.NoError(t, err)
	assert.Empty(t, responses)
}
