package helper

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSummarizeGeminiImageRequestRedactsBinaryData(t *testing.T) {
	request := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{{
			Role: "user",
			Parts: []dto.GeminiPart{
				{Text: "生成一张红色苹果的 4K 产品图"},
				{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "sensitive-base64-payload"}},
				{FileData: &dto.GeminiFileData{MimeType: "image/jpeg", FileUri: "https://example.com/private/object?token=secret"}},
			},
		}},
		GenerationConfig: dto.GeminiChatGenerationConfig{
			ResponseModalities: []string{"IMAGE"},
			ImageConfig:        []byte(`{"imageSize":"4K","aspectRatio":"1:1"}`),
		},
	}

	data, err := common.Marshal(summarizeGeminiImageRequest(request))
	require.NoError(t, err)
	text := string(data)

	assert.Contains(t, text, "生成一张红色苹果的 4K 产品图")
	assert.Contains(t, text, `"imageSize":"4K"`)
	assert.Contains(t, text, `"data_bytes":24`)
	assert.Contains(t, text, `https://example.com/[redacted]`)
	assert.NotContains(t, text, "sensitive-base64-payload")
	assert.NotContains(t, text, "token=secret")
}

func TestSummarizeOpenAIImageRequestRedactsSecretsAndMedia(t *testing.T) {
	request := &dto.ImageRequest{
		Model:  "gpt-image-2",
		Prompt: "生成 2K 海报",
		Size:   "2048x2048",
		Images: []byte(`"data:image/png;base64,sensitive-image"`),
		Extra: map[string]json.RawMessage{
			"aspect_ratio": []byte(`"16:9"`),
			"api_key":      []byte(`"secret-key"`),
		},
	}

	data, err := common.Marshal(summarizeOpenAIImageRequest(request))
	require.NoError(t, err)
	text := string(data)

	assert.Contains(t, text, "生成 2K 海报")
	assert.Contains(t, text, "2048x2048")
	assert.Contains(t, text, "16:9")
	assert.Contains(t, text, `"api_key":"[redacted]"`)
	assert.NotContains(t, text, "sensitive-image")
	assert.NotContains(t, text, "secret-key")
}

func TestTruncateImageAuditTextBoundsPrompt(t *testing.T) {
	value := strings.Repeat("a", imageAuditTextLimit+100)
	result := truncateImageAuditText(value)

	assert.Contains(t, result, "original_length=4196")
	assert.Less(t, len(result), len(value))
}

func TestSummarizeImageRequestHandlesTypedNil(t *testing.T) {
	var geminiRequest *dto.GeminiChatRequest
	var openAIRequest *dto.ImageRequest

	geminiData, err := common.Marshal(summarizeImageRequest(geminiRequest))
	require.NoError(t, err)
	openAIData, err := common.Marshal(summarizeImageRequest(openAIRequest))
	require.NoError(t, err)

	assert.JSONEq(t, `{"parsed":false,"type":"gemini"}`, string(geminiData))
	assert.JSONEq(t, `{"parsed":false,"type":"openai_image"}`, string(openAIData))
}
