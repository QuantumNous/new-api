package dto

import (
	"strings"
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenCountMetaExcludesInlineMediaPayloads(t *testing.T) {
	imageData := strings.Repeat("base64-image-data", 100)
	toolText := "tool output"

	t.Run("claude tool result", func(t *testing.T) {
		request := ClaudeRequest{Messages: []ClaudeMessage{{
			Role: "user",
			Content: []ClaudeMediaMessage{{
				Type: "tool_result",
				Content: []ClaudeMediaMessage{
					{Type: "text", Text: &toolText},
					{Type: "image", Source: &ClaudeMessageSource{Type: "base64", MediaType: "image/png", Data: imageData}},
				},
			}, {
				Type:    "tool_result",
				Content: "string output",
			}},
		}}}

		meta := request.GetTokenCountMeta()

		assert.Contains(t, meta.CombineText, toolText)
		assert.Contains(t, meta.CombineText, "string output")
		assert.NotContains(t, meta.CombineText, imageData)
		require.Len(t, meta.Files, 1)
		assert.Equal(t, imageData, meta.Files[0].Source.GetRawData())
	})

	t.Run("openai message", func(t *testing.T) {
		request := GeneralOpenAIRequest{Messages: []Message{{
			Role: "user",
			Content: []MediaContent{
				{Type: ContentTypeText, Text: "message text"},
				{Type: ContentTypeImageURL, ImageUrl: &MessageImageUrl{Url: "data:image/png;base64," + imageData}},
			},
		}}}

		meta := request.GetTokenCountMeta()

		assert.Contains(t, meta.CombineText, "message text")
		assert.NotContains(t, meta.CombineText, imageData)
		require.Len(t, meta.Files, 1)
	})

	t.Run("openai responses compaction", func(t *testing.T) {
		input, err := kitutil.Marshal([]map[string]any{{
			"type": "message",
			"role": "user",
			"content": []map[string]any{
				{"type": "input_text", "text": "message text"},
				{"type": "input_image", "image_url": "data:image/png;base64," + imageData},
			},
		}})
		require.NoError(t, err)

		meta := (&OpenAIResponsesCompactionRequest{Input: input}).GetTokenCountMeta()

		assert.Contains(t, meta.CombineText, "message text")
		assert.NotContains(t, meta.CombineText, imageData)
		require.Len(t, meta.Files, 1)
	})

	t.Run("gemini inline data", func(t *testing.T) {
		request := GeminiChatRequest{Contents: []GeminiChatContent{{
			Role: "user",
			Parts: []GeminiPart{
				{Text: "message text"},
				{InlineData: &GeminiInlineData{MimeType: "image/png", Data: imageData}},
			},
		}}}

		meta := request.GetTokenCountMeta()

		assert.Contains(t, meta.CombineText, "message text")
		assert.NotContains(t, meta.CombineText, imageData)
		require.Len(t, meta.Files, 1)
	})
}
