package oaiimage

import (
	"context"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestMain(m *testing.M) {
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{
		GetBase64Data: func(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
			return "aGVsbG8=", "image/png", nil
		},
		DecodeBase64FileData: func(base64String string) (string, string, error) {
			return "image/png", "aGVsbG8=", nil
		},
	})
	os.Exit(m.Run())
}

func TestOpenAIImageRequestToGeminiGenerateContent(t *testing.T) {
	got, err := OpenAIImageRequestToGeminiGenerateContent(context.Background(), &convmeta.Values{
		Options: &convmeta.Options{
			Gemini: convmeta.GeminiOptions{
				SafetySetting: func(string) string { return "OFF" },
			},
		},
	}, dto.ImageRequest{
		Model:   "nano-banana-2",
		Prompt:  "a cat in a hat",
		N:       lo.ToPtr(uint(2)),
		Size:    "1792x1024",
		Quality: "hd",
		Images:  []byte(`["https://example.test/cat.png"]`),
	})
	require.NoError(t, err)
	require.Len(t, got.Contents, 1)
	require.Len(t, got.Contents[0].Parts, 2)
	assert.Equal(t, "a cat in a hat", got.Contents[0].Parts[0].Text)
	require.NotNil(t, got.Contents[0].Parts[1].InlineData)
	assert.Equal(t, []string{"TEXT", "IMAGE"}, got.GenerationConfig.ResponseModalities)
	require.NotNil(t, got.GenerationConfig.CandidateCount)
	assert.Equal(t, 2, *got.GenerationConfig.CandidateCount)
	assert.Equal(t, "16:9", gjson.GetBytes(got.GenerationConfig.ImageConfig, "aspectRatio").String())
	assert.Equal(t, "2K", gjson.GetBytes(got.GenerationConfig.ImageConfig, "imageSize").String())
}

func TestGeminiChatResponseToOpenAIImageUsesB64(t *testing.T) {
	got, usage, err := GeminiChatResponseToOpenAIImage(&dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Text: "here you go"},
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "abc123"}},
					},
				},
			},
		},
		HasUsageMetadata: true,
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     10,
			CandidatesTokenCount: 20,
			TotalTokenCount:      30,
		},
	})
	require.NoError(t, err)
	require.Len(t, got.Data, 1)
	assert.Equal(t, "abc123", got.Data[0].B64Json)
	assert.Empty(t, got.Data[0].Url)
	require.NotNil(t, usage)
	assert.Equal(t, 10, usage.PromptTokens)
	assert.Equal(t, 20, usage.CompletionTokens)
}
