package oaichat_test

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/oai_chat"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatRequestToClaudeMessagesPreservesMediaCacheControl(t *testing.T) {
	relayconvert.SetMediaResolver(relayconvert.MediaResolver{
		GetBase64Data: func(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
			return "aGVsbG8=", "image/png", nil
		},
	})
	t.Cleanup(func() {
		relayconvert.SetMediaResolver(relayconvert.MediaResolver{})
	})

	maxTokens := uint(1024)
	got, err := oaichat.OpenAIChatRequestToClaudeMessages(context.Background(), nil, dto.GeneralOpenAIRequest{
		Model:     "claude-test",
		MaxTokens: &maxTokens,
		Messages: []dto.Message{
			{
				Role: "user",
				Content: []any{
					map[string]any{
						"type":          "image_url",
						"image_url":     map[string]any{"url": "https://example.com/image.png"},
						"cache_control": map[string]any{"type": "ephemeral"},
					},
				},
			},
		},
	})

	require.NoError(t, err)
	content, ok := got.Messages[0].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, content, 1)
	assert.Equal(t, "image", content[0].Type)
	assert.JSONEq(t, `{"type":"ephemeral"}`, string(content[0].CacheControl))
}
