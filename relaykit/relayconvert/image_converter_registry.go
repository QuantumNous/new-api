package relayconvert

import (
	"fmt"

	"context"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	oaiimage "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/oai_image"
	sharedgemini "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/gemini"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func init() {
	registerBuiltinRequestConverter(RequestConverterSpec{
		ID:      ConverterOpenAIImageToGeminiContent,
		From:    types.RelayFormatOpenAIImage,
		To:      types.RelayFormatGemini,
		Quality: RequestConverterQualityFair,
		Convert: convertOpenAIImageRequestToGemini,
	})
	registerBuiltinResponseConverter(ResponseConverterSpec{
		ID:      ConverterGeminiContentToOpenAIImage,
		From:    types.RelayFormatGemini,
		To:      types.RelayFormatOpenAIImage,
		Quality: ResponseConverterQualityFair,
		Convert: convertGeminiChatResponseToOpenAIImage,
	})
}

func convertOpenAIImageRequestToGemini(c context.Context, info convmeta.Meta, request any) (any, error) {
	imageRequest, ok := request.(*dto.ImageRequest)
	if !ok {
		if value, ok := request.(dto.ImageRequest); ok {
			imageRequest = &value
		}
	}
	if imageRequest == nil {
		return nil, fmt.Errorf("expected OpenAI image request, got %T", request)
	}
	return oaiimage.OpenAIImageRequestToGeminiGenerateContent(c, info, *imageRequest)
}

func convertGeminiChatResponseToOpenAIImage(_ context.Context, _ convmeta.Meta, response any) (any, *dto.Usage, error) {
	geminiResponse, ok := response.(*dto.GeminiChatResponse)
	if !ok {
		if value, ok := response.(dto.GeminiChatResponse); ok {
			geminiResponse = &value
		}
	}
	if geminiResponse == nil {
		return nil, nil, fmt.Errorf("expected Gemini generateContent response, got %T", response)
	}
	return oaiimage.GeminiChatResponseToOpenAIImage(geminiResponse)
}

func IsGeminiGenerateContentImageModel(model string, supportsImagine func(string) bool) bool {
	return sharedgemini.IsGenerateContentImageModel(model, supportsImagine)
}

func IsImagenPredictModel(model string) bool {
	return sharedgemini.IsImagenPredictModel(model)
}
