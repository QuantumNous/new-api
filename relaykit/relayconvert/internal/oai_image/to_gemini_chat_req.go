package oaiimage

import (
	"fmt"
	"strings"

	"context"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
	sharedgemini "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/gemini"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/samber/lo"
)

func OpenAIImageRequestToGeminiGenerateContent(c context.Context, info convmeta.Meta, request dto.ImageRequest) (*dto.GeminiChatRequest, error) {
	prompt := strings.TrimSpace(request.Prompt)
	if prompt == "" {
		return nil, fmt.Errorf("prompt is required")
	}

	opts := convmeta.OptionsOf(info)
	geminiRequest := &dto.GeminiChatRequest{
		GenerationConfig: dto.GeminiChatGenerationConfig{
			ResponseModalities: []string{"TEXT", "IMAGE"},
		},
	}

	parts := []dto.GeminiPart{{Text: prompt}}
	referenceParts, err := imageRequestReferenceParts(c, request)
	if err != nil {
		return nil, err
	}
	parts = append(parts, referenceParts...)
	geminiRequest.Contents = []dto.GeminiChatContent{{
		Role:  "user",
		Parts: parts,
	}}

	imageN := int(lo.FromPtrOr(request.N, uint(1)))
	if imageN > 1 {
		geminiRequest.GenerationConfig.CandidateCount = kitutil.GetPointer(imageN)
	}

	imageConfig := map[string]any{
		"aspectRatio": sharedgemini.AspectRatioFromOpenAIImageSize(request.Size),
	}
	if quality := strings.TrimSpace(request.Quality); quality != "" {
		imageConfig["imageSize"] = sharedgemini.ImageSizeFromOpenAIQuality(quality)
	} else if size := strings.TrimSpace(request.Size); size == "2K" || size == "4K" || size == "1K" {
		imageConfig["imageSize"] = size
	}
	imageConfigBytes, err := kitutil.Marshal(imageConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal image_config: %w", err)
	}
	geminiRequest.GenerationConfig.ImageConfig = imageConfigBytes

	var safetySettings []dto.GeminiChatSafetySettings
	for _, category := range sharedgemini.SafetySettingCategories {
		threshold := opts.Gemini.SafetySettingFor(category)
		if threshold == "" {
			continue
		}
		safetySettings = append(safetySettings, dto.GeminiChatSafetySettings{
			Category:  category,
			Threshold: threshold,
		})
	}
	if len(safetySettings) > 0 {
		geminiRequest.SafetySettings = safetySettings
	}

	return geminiRequest, nil
}

func imageRequestReferenceParts(c context.Context, request dto.ImageRequest) ([]dto.GeminiPart, error) {
	sources := make([]types.FileSource, 0)
	parsed, err := parseImageReferenceSources(request.Images)
	if err != nil {
		return nil, err
	}
	sources = append(sources, parsed...)
	parsed, err = parseImageReferenceSources(request.Image)
	if err != nil {
		return nil, err
	}
	sources = append(sources, parsed...)
	parsed, err = parseImageReferenceSources(request.Mask)
	if err != nil {
		return nil, err
	}
	sources = append(sources, parsed...)

	parts := make([]dto.GeminiPart, 0, len(sources))
	for _, source := range sources {
		if source == nil {
			continue
		}
		base64Data, mimeType, err := relaymedia.ResolveBase64Data(c, source, "formatting image for Gemini image generation")
		if err != nil {
			return nil, fmt.Errorf("get file data from '%s' failed: %w", source.GetIdentifier(), err)
		}
		if mimeType == "" {
			mimeType = "image/png"
		}
		parts = append(parts, dto.GeminiPart{
			InlineData: &dto.GeminiInlineData{
				MimeType: mimeType,
				Data:     base64Data,
			},
		})
	}
	return parts, nil
}

func parseImageReferenceSources(raw []byte) ([]types.FileSource, error) {
	if len(raw) == 0 || kitutil.GetJsonType(raw) == "null" {
		return nil, nil
	}
	switch kitutil.GetJsonType(raw) {
	case "string":
		var value string
		if err := kitutil.Unmarshal(raw, &value); err != nil {
			return nil, fmt.Errorf("invalid image reference: %w", err)
		}
		if source := fileSourceFromImageValue(value); source != nil {
			return []types.FileSource{source}, nil
		}
		return nil, nil
	case "array":
		var values []any
		if err := kitutil.Unmarshal(raw, &values); err != nil {
			return nil, fmt.Errorf("invalid image reference array: %w", err)
		}
		sources := make([]types.FileSource, 0, len(values))
		for _, value := range values {
			if source := fileSourceFromImageValue(value); source != nil {
				sources = append(sources, source)
			}
		}
		return sources, nil
	case "object":
		var value map[string]any
		if err := kitutil.Unmarshal(raw, &value); err != nil {
			return nil, fmt.Errorf("invalid image reference object: %w", err)
		}
		if source := fileSourceFromImageValue(value); source != nil {
			return []types.FileSource{source}, nil
		}
		return nil, nil
	default:
		return nil, nil
	}
}

func fileSourceFromImageValue(value any) types.FileSource {
	switch typed := value.(type) {
	case string:
		data := strings.TrimSpace(typed)
		if data == "" {
			return nil
		}
		return types.NewFileSourceFromData(data, "")
	case map[string]any:
		if nested := typed["image_url"]; nested != nil {
			if source := fileSourceFromImageValue(nested); source != nil {
				return source
			}
		}
		for _, key := range []string{"url", "b64_json", "image", "file_data", "data"} {
			if data := strings.TrimSpace(kitutil.Interface2String(typed[key])); data != "" {
				mimeType := strings.TrimSpace(kitutil.Interface2String(typed["mime_type"]))
				if mimeType == "" {
					mimeType = strings.TrimSpace(kitutil.Interface2String(typed["mimeType"]))
				}
				return types.NewFileSourceFromData(data, mimeType)
			}
		}
	}
	return nil
}
