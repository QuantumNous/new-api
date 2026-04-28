package ali

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// isMultimodalEmbeddingModel checks if the model name indicates a multimodal embedding model.
func isMultimodalEmbeddingModel(modelName string) bool {
	lower := strings.ToLower(modelName)
	return strings.Contains(lower, "vl-embedding")
}

// convertToMultimodalEmbeddingRequest converts an OpenAI-format EmbeddingRequest
// to a DashScope multimodal embedding request.
func convertToMultimodalEmbeddingRequest(request dto.EmbeddingRequest) (*AliMultimodalEmbeddingRequest, error) {
	contents, err := parseInputToContents(request.Input)
	if err != nil {
		return nil, err
	}

	return &AliMultimodalEmbeddingRequest{
		Model: request.Model,
		Input: AliMultimodalEmbeddingInput{
			Contents: contents,
		},
		Parameters: AliMultimodalEmbeddingParameters{
			EnableFusion: true,
		},
	}, nil
}

// parseInputToContents converts the OpenAI embedding input (any type) into
// DashScope multimodal content entries.
// Supported input formats:
//   - string: treated as text
//   - []string: each element treated as text
//   - []any: each element can be a string (text) or a map with type/image_url/video_url keys
func parseInputToContents(input any) ([]AliMultimodalContent, error) {
	if input == nil {
		return nil, fmt.Errorf("input is nil")
	}

	var contents []AliMultimodalContent

	switch v := input.(type) {
	case string:
		contents = append(contents, AliMultimodalContent{Text: v})
	case []any:
		for _, item := range v {
			switch elem := item.(type) {
			case string:
				contents = append(contents, AliMultimodalContent{Text: elem})
			case map[string]any:
				content, err := parseMapToContent(elem)
				if err != nil {
					return nil, err
				}
				contents = append(contents, content)
			default:
				return nil, fmt.Errorf("unsupported input element type: %T", elem)
			}
		}
	default:
		return nil, fmt.Errorf("unsupported input type: %T", v)
	}

	if len(contents) == 0 {
		return nil, fmt.Errorf("no valid content found in input")
	}

	return contents, nil
}

// parseMapToContent converts a map input element to an AliMultimodalContent.
// Supports two formats:
//   - OpenAI vision style: {"type": "image_url", "image_url": {"url": "..."}}
//   - DashScope native style: {"image": "..."} or {"video": "..."} or {"text": "..."}
func parseMapToContent(m map[string]any) (AliMultimodalContent, error) {
	// DashScope native shorthand: {"text": "..."}, {"image": "..."}, {"video": "..."}
	if text, ok := m["text"].(string); ok {
		return AliMultimodalContent{Text: text}, nil
	}
	if image, ok := m["image"].(string); ok {
		return AliMultimodalContent{Image: image}, nil
	}
	if video, ok := m["video"].(string); ok {
		return AliMultimodalContent{Video: video}, nil
	}

	// OpenAI vision-compatible format: {"type": "image_url", "image_url": {"url": "..."}}
	if typeName, ok := m["type"].(string); ok {
		switch typeName {
		case "text":
			if textObj, ok := m["text"].(string); ok {
				return AliMultimodalContent{Text: textObj}, nil
			}
		case "image_url":
			if imgObj, ok := m["image_url"].(map[string]any); ok {
				if url, ok := imgObj["url"].(string); ok {
					return AliMultimodalContent{Image: url}, nil
				}
			}
		case "video_url":
			if vidObj, ok := m["video_url"].(map[string]any); ok {
				if url, ok := vidObj["url"].(string); ok {
					return AliMultimodalContent{Video: url}, nil
				}
			}
		}
	}

	return AliMultimodalContent{}, fmt.Errorf("cannot parse content map: %v", m)
}

// MultimodalEmbeddingHandler processes the DashScope multimodal embedding response
// and converts it to OpenAI-compatible format.
func MultimodalEmbeddingHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.Usage) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError), nil
	}
	service.CloseResponseBodyGracefully(resp)

	var aliResponse AliMultimodalEmbeddingResponse
	err = json.Unmarshal(responseBody, &aliResponse)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError), nil
	}

	// Check for DashScope error response
	if aliResponse.Code != "" {
		return types.WithOpenAIError(types.OpenAIError{
			Message: aliResponse.Message,
			Type:    aliResponse.Code,
			Param:   aliResponse.RequestId,
			Code:    aliResponse.Code,
		}, resp.StatusCode), nil
	}

	// Convert to OpenAI embedding response format
	var embeddingItems []dto.EmbeddingResponseItem
	for i, item := range aliResponse.Output.Embeddings {
		embeddingItems = append(embeddingItems, dto.EmbeddingResponseItem{
			Object:    "embedding",
			Index:     i,
			Embedding: item.Embedding,
		})
	}

	usage := dto.Usage{
		PromptTokens:     aliResponse.Usage.TotalTokens,
		CompletionTokens: 0,
		TotalTokens:      aliResponse.Usage.TotalTokens,
	}

	embeddingResponse := dto.EmbeddingResponse{
		Object: "list",
		Data:   embeddingItems,
		Model:  info.UpstreamModelName,
		Usage:  usage,
	}

	jsonResponse, err := json.Marshal(embeddingResponse)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError), nil
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	c.Writer.Write(jsonResponse)
	return nil, &usage
}