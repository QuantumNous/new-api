package relayconvert

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIImageToGeminiRequestConverter(t *testing.T) {
	spec, ok := LookupRequestConverter(ConverterOpenAIImageToGeminiContent)
	require.True(t, ok)
	assert.Equal(t, types.RelayFormat(types.RelayFormatOpenAIImage), spec.From)
	assert.Equal(t, types.RelayFormat(types.RelayFormatGemini), spec.To)

	result, err := ConvertRequest(nil, &convmeta.Values{}, types.RelayFormatGemini, &dto.ImageRequest{
		Model:  "nano-banana-2",
		Prompt: "a cat",
		Size:   "1:1",
	})
	require.NoError(t, err)
	require.IsType(t, &dto.GeminiChatRequest{}, result.Value)
	assert.Equal(t, ConverterOpenAIImageToGeminiContent, result.Converter)
}

func TestGeminiToOpenAIImageResponseConverter(t *testing.T) {
	spec, ok := LookupResponseConverter(ConverterGeminiContentToOpenAIImage)
	require.True(t, ok)
	assert.Equal(t, types.RelayFormat(types.RelayFormatGemini), spec.From)
	assert.Equal(t, types.RelayFormat(types.RelayFormatOpenAIImage), spec.To)

	result, err := ConvertResponse(nil, &convmeta.Values{}, types.RelayFormatOpenAIImage, &dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "abc"}},
					},
				},
			},
		},
	})
	require.NoError(t, err)
	imageResp, ok := result.Value.(*dto.ImageResponse)
	require.True(t, ok)
	require.Len(t, imageResp.Data, 1)
	assert.Equal(t, "abc", imageResp.Data[0].B64Json)
}
