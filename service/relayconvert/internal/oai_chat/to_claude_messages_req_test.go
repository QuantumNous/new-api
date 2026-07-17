package oaichat

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaymedia "github.com/QuantumNous/new-api/service/relayconvert/internal/media"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatRequestToClaudeMessagesConvertsToolResultImageURL(t *testing.T) {
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{
		GetBase64Data: func(_ *gin.Context, source types.FileSource, _ ...string) (string, string, error) {
			assert.Equal(t, "https://example.com/tool-result.png", source.GetRawData())
			return "resolved-image-data", "image/png", nil
		},
	})
	t.Cleanup(func() {
		relaymedia.SetMediaResolver(relaymedia.MediaResolver{})
	})

	request := toolResultConversionRequest([]any{
		map[string]any{"type": "text", "text": "Image result:"},
		map[string]any{
			"type": dto.ContentTypeImageURL,
			"image_url": map[string]any{
				"url": "https://example.com/tool-result.png",
			},
		},
	})

	claudeRequest, err := OpenAIChatRequestToClaudeMessages(nil, request)
	require.NoError(t, err)
	require.Len(t, claudeRequest.Messages, 3)

	toolResultBlocks, ok := claudeRequest.Messages[2].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, toolResultBlocks, 1)
	assert.Equal(t, "tool_result", toolResultBlocks[0].Type)
	assert.Equal(t, "call_1", toolResultBlocks[0].ToolUseId)

	toolContent, ok := toolResultBlocks[0].Content.([]any)
	require.True(t, ok)
	require.Len(t, toolContent, 2)
	assert.Equal(t, map[string]any{"type": "text", "text": "Image result:"}, toolContent[0])

	imageBlock, ok := toolContent[1].(dto.ClaudeMediaMessage)
	require.True(t, ok)
	assert.Equal(t, "image", imageBlock.Type)
	require.NotNil(t, imageBlock.Source)
	assert.Equal(t, "base64", imageBlock.Source.Type)
	assert.Equal(t, "image/png", imageBlock.Source.MediaType)
	assert.Equal(t, "resolved-image-data", imageBlock.Source.Data)

	payload, err := common.Marshal(claudeRequest)
	require.NoError(t, err)
	assert.NotContains(t, string(payload), `"image_url"`)
	assert.Contains(t, string(payload), `"type":"image"`)
}

func TestOpenAIChatRequestToClaudeMessagesPreservesNonImageURLToolContent(t *testing.T) {
	original := []any{
		map[string]any{"type": "text", "text": "plain result"},
		map[string]any{
			"type": "image",
			"source": map[string]any{
				"type":       "base64",
				"media_type": "image/png",
				"data":       "already-converted",
			},
		},
		map[string]any{"type": "custom", "value": "preserve me"},
	}

	claudeRequest, err := OpenAIChatRequestToClaudeMessages(nil, toolResultConversionRequest(original))
	require.NoError(t, err)
	require.Len(t, claudeRequest.Messages, 3)

	toolResultBlocks, ok := claudeRequest.Messages[2].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, toolResultBlocks, 1)
	assert.Equal(t, original, toolResultBlocks[0].Content)
}

func toolResultConversionRequest(toolContent any) dto.GeneralOpenAIRequest {
	return dto.GeneralOpenAIRequest{
		Model: "test-model",
		Messages: []dto.Message{
			{Role: "user", Content: "Use read_image."},
			{
				Role:      "assistant",
				ToolCalls: json.RawMessage(`[{"id":"call_1","type":"function","function":{"name":"read_image","arguments":"{}"}}]`),
			},
			{
				Role:       "tool",
				ToolCallId: "call_1",
				Content:    toolContent,
			},
		},
	}
}
