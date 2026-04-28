package volcengine

import (
	"fmt"

	"github.com/QuantumNous/new-api/dto"
)

var MultimodalEmbeddingModels = map[string]bool{
	"doubao-embedding-vision-251215": true,
}

func IsMultimodalEmbeddingModel(model string) bool {
	return MultimodalEmbeddingModels[model]
}

type MultimodalEmbeddingInput struct {
	Type     string                  `json:"type"`
	Text     string                  `json:"text,omitempty"`
	ImageURL *MultimodalImageURLItem `json:"image_url,omitempty"`
	VideoURL *MultimodalVideoURLItem `json:"video_url,omitempty"`
}

type MultimodalImageURLItem struct {
	URL string `json:"url"`
}

type MultimodalVideoURLItem struct {
	URL string `json:"url"`
}

type MultimodalEmbeddingRequest struct {
	Model          string                     `json:"model"`
	Input          []MultimodalEmbeddingInput `json:"input"`
	EncodingFormat string                     `json:"encoding_format,omitempty"`
	Dimensions     *int                       `json:"dimensions,omitempty"`
	User           string                     `json:"user,omitempty"`
}

func convertToMultimodalEmbeddingRequest(request dto.EmbeddingRequest) (*MultimodalEmbeddingRequest, error) {
	inputs, err := convertInputToMultimodal(request.Input)
	if err != nil {
		return nil, err
	}
	return &MultimodalEmbeddingRequest{
		Model:          request.Model,
		Input:          inputs,
		EncodingFormat: request.EncodingFormat,
		Dimensions:     request.Dimensions,
		User:           request.User,
	}, nil
}

func convertInputToMultimodal(input any) ([]MultimodalEmbeddingInput, error) {
	if input == nil {
		return nil, fmt.Errorf("embedding input is empty")
	}

	switch v := input.(type) {
	case string:
		return []MultimodalEmbeddingInput{{Type: "text", Text: v}}, nil
	case []any:
		return convertSliceToMultimodal(v)
	default:
		return nil, fmt.Errorf("unsupported embedding input type: %T", input)
	}
}

func convertSliceToMultimodal(items []any) ([]MultimodalEmbeddingInput, error) {
	if len(items) == 0 {
		return nil, fmt.Errorf("embedding input is empty")
	}

	result := make([]MultimodalEmbeddingInput, 0, len(items))
	for _, item := range items {
		switch v := item.(type) {
		case string:
			result = append(result, MultimodalEmbeddingInput{Type: "text", Text: v})
		case map[string]any:
			entry, err := parseMultimodalInputItem(v)
			if err != nil {
				return nil, err
			}
			result = append(result, entry)
		default:
			return nil, fmt.Errorf("unsupported embedding input item type: %T", item)
		}
	}
	return result, nil
}

func parseMultimodalInputItem(m map[string]any) (MultimodalEmbeddingInput, error) {
	typeStr, ok := m["type"].(string)
	if !ok || typeStr == "" {
		return MultimodalEmbeddingInput{}, fmt.Errorf("multimodal input item missing required 'type' field")
	}
	switch typeStr {
	case "text":
		text, _ := m["text"].(string)
		return MultimodalEmbeddingInput{Type: "text", Text: text}, nil
	case "image_url":
		urlObj, ok := m["image_url"].(map[string]any)
		if !ok {
			return MultimodalEmbeddingInput{}, fmt.Errorf("invalid image_url format")
		}
		url, _ := urlObj["url"].(string)
		if url == "" {
			return MultimodalEmbeddingInput{}, fmt.Errorf("image_url.url is required")
		}
		return MultimodalEmbeddingInput{
			Type:     "image_url",
			ImageURL: &MultimodalImageURLItem{URL: url},
		}, nil
	case "video_url":
		urlObj, ok := m["video_url"].(map[string]any)
		if !ok {
			return MultimodalEmbeddingInput{}, fmt.Errorf("invalid video_url format")
		}
		url, _ := urlObj["url"].(string)
		if url == "" {
			return MultimodalEmbeddingInput{}, fmt.Errorf("video_url.url is required")
		}
		return MultimodalEmbeddingInput{
			Type:     "video_url",
			VideoURL: &MultimodalVideoURLItem{URL: url},
		}, nil
	default:
		return MultimodalEmbeddingInput{}, fmt.Errorf("unsupported multimodal input type: %s", typeStr)
	}
}
