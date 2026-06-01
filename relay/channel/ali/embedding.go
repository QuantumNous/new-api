package ali

import (
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// DashScope 多模态向量不支持 OpenAI 兼容接口,必须走原生 multimodal 端点,故需单独识别。
var MultimodalEmbeddingModels = map[string]bool{
	"qwen3-vl-embedding": true,
}

func IsMultimodalEmbeddingModel(model string) bool {
	return MultimodalEmbeddingModels[model]
}

type AliMultimodalContent struct {
	Text  string `json:"text,omitempty"`
	Image string `json:"image,omitempty"`
	Video string `json:"video,omitempty"`
}

type AliMultimodalEmbeddingRequest struct {
	Model string `json:"model"`
	Input struct {
		Contents []AliMultimodalContent `json:"contents"`
	} `json:"input"`
	Parameters *AliMultimodalEmbeddingParameters `json:"parameters,omitempty"`
}

type AliMultimodalEmbeddingParameters struct {
	Dimension *int `json:"dimension,omitempty"`
}

type AliMultimodalEmbeddingItem struct {
	Index     int       `json:"index"`
	Embedding []float64 `json:"embedding"`
}

type AliMultimodalEmbeddingResponse struct {
	Output struct {
		Embeddings []AliMultimodalEmbeddingItem `json:"embeddings"`
	} `json:"output"`
	Usage     AliUsage `json:"usage"`
	RequestId string   `json:"request_id"`
	AliError
}

func convertToMultimodalEmbeddingRequest(request dto.EmbeddingRequest) (*AliMultimodalEmbeddingRequest, error) {
	contents, err := convertInputToAliContents(request.Input)
	if err != nil {
		return nil, err
	}
	aliReq := &AliMultimodalEmbeddingRequest{Model: request.Model}
	aliReq.Input.Contents = contents
	if request.Dimensions != nil {
		aliReq.Parameters = &AliMultimodalEmbeddingParameters{Dimension: request.Dimensions}
	}
	return aliReq, nil
}

func convertInputToAliContents(input any) ([]AliMultimodalContent, error) {
	if input == nil {
		return nil, fmt.Errorf("embedding input is empty")
	}
	switch v := input.(type) {
	case string:
		return []AliMultimodalContent{{Text: v}}, nil
	case []any:
		return convertSliceToAliContents(v)
	default:
		return nil, fmt.Errorf("unsupported embedding input type: %T", input)
	}
}

func convertSliceToAliContents(items []any) ([]AliMultimodalContent, error) {
	if len(items) == 0 {
		return nil, fmt.Errorf("embedding input is empty")
	}
	result := make([]AliMultimodalContent, 0, len(items))
	for _, item := range items {
		switch v := item.(type) {
		case string:
			result = append(result, AliMultimodalContent{Text: v})
		case map[string]any:
			content, err := parseAliContentItem(v)
			if err != nil {
				return nil, err
			}
			result = append(result, content)
		default:
			return nil, fmt.Errorf("unsupported embedding input item type: %T", item)
		}
	}
	return result, nil
}

func parseAliContentItem(m map[string]any) (AliMultimodalContent, error) {
	typeStr, ok := m["type"].(string)
	if !ok || typeStr == "" {
		return AliMultimodalContent{}, fmt.Errorf("multimodal input item missing required 'type' field")
	}
	switch typeStr {
	case dto.ContentTypeText:
		text, _ := m[dto.ContentTypeText].(string)
		return AliMultimodalContent{Text: text}, nil
	case dto.ContentTypeImageURL:
		url, err := parseURLField(m, dto.ContentTypeImageURL)
		if err != nil {
			return AliMultimodalContent{}, err
		}
		return AliMultimodalContent{Image: url}, nil
	case dto.ContentTypeVideoUrl:
		url, err := parseURLField(m, dto.ContentTypeVideoUrl)
		if err != nil {
			return AliMultimodalContent{}, err
		}
		return AliMultimodalContent{Video: url}, nil
	default:
		return AliMultimodalContent{}, fmt.Errorf("unsupported multimodal input type: %s", typeStr)
	}
}

func parseURLField(m map[string]any, key string) (string, error) {
	urlObj, ok := m[key].(map[string]any)
	if !ok {
		return "", fmt.Errorf("invalid %s format", key)
	}
	url, _ := urlObj["url"].(string)
	if url == "" {
		return "", fmt.Errorf("%s.url is required", key)
	}
	return url, nil
}

func MultimodalEmbeddingHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.Usage) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError), nil
	}
	service.CloseResponseBodyGracefully(resp)

	var aliResponse AliMultimodalEmbeddingResponse
	if err = common.Unmarshal(responseBody, &aliResponse); err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError), nil
	}
	// 原生端点可能返回 200 但 body 带错误码
	if aliResponse.Code != "" {
		return types.WithOpenAIError(types.OpenAIError{
			Message: aliResponse.Message,
			Type:    aliResponse.Code,
			Param:   aliResponse.RequestId,
			Code:    aliResponse.Code,
		}, resp.StatusCode), nil
	}

	data := make([]dto.EmbeddingResponseItem, 0, len(aliResponse.Output.Embeddings))
	for _, embedding := range aliResponse.Output.Embeddings {
		data = append(data, dto.EmbeddingResponseItem{
			Object:    "embedding",
			Index:     embedding.Index,
			Embedding: embedding.Embedding,
		})
	}

	u := aliResponse.Usage
	usage := dto.Usage{
		PromptTokens: u.InputTokens + u.ImageTokens,
		TotalTokens:  u.TotalTokens,
	}
	usage.PromptTokensDetails.TextTokens = u.InputTokens
	usage.PromptTokensDetails.ImageTokens = u.ImageTokens
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens
	}

	embeddingResponse := dto.EmbeddingResponse{
		Object: "list",
		Data:   data,
		Model:  info.UpstreamModelName,
		Usage:  usage,
	}

	jsonResponse, err := common.Marshal(embeddingResponse)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return nil, &usage
}
