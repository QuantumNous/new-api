package voyage

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const (
	// Contextualized embeddings always auto-chunk documents at the largest
	// chunk size Voyage allows.
	contextChunkSize = 32000

	inputTypeDocument = "document"
	inputTypeQuery    = "query"

	// Voyage counts every 560 pixels of an image or video as one token when
	// it prices pixels.
	pixelsPerImageToken = 560

	contentTypeImageBase64 = "image_base64"
	contentTypeVideoBase64 = "video_base64"
)

type embeddingRequest struct {
	Model           string   `json:"model"`
	Input           []string `json:"input"`
	InputType       *string  `json:"input_type,omitempty"`
	OutputDimension *int     `json:"output_dimension,omitempty"`
	EncodingFormat  string   `json:"encoding_format,omitempty"`
}

type contextualizedEmbeddingRequest struct {
	Model              string `json:"model"`
	Inputs             any    `json:"inputs"`
	InputType          string `json:"input_type"`
	OutputDimension    *int   `json:"output_dimension,omitempty"`
	EnableAutoChunking *bool  `json:"enable_auto_chunking,omitempty"`
	ChunkSize          *int   `json:"chunk_size,omitempty"`
}

type contentPiece struct {
	Type        string `json:"type"`
	Text        string `json:"text,omitempty"`
	ImageURL    string `json:"image_url,omitempty"`
	ImageBase64 string `json:"image_base64,omitempty"`
	VideoURL    string `json:"video_url,omitempty"`
	VideoBase64 string `json:"video_base64,omitempty"`
}

type multimodalInput struct {
	Content []contentPiece `json:"content"`
}

type multimodalEmbeddingRequest struct {
	Model           string            `json:"model"`
	Inputs          []multimodalInput `json:"inputs"`
	InputType       *string           `json:"input_type,omitempty"`
	OutputDimension *int              `json:"output_dimension,omitempty"`
}

type rerankRequest struct {
	Model           string   `json:"model"`
	Query           string   `json:"query"`
	Documents       []string `json:"documents"`
	TopK            *int     `json:"top_k,omitempty"`
	ReturnDocuments *bool    `json:"return_documents,omitempty"`
}

// usageResponse holds the usage Voyage reports. Every field is a pointer so a
// response that omits usage is told apart from one that reports zero.
type usageResponse struct {
	TotalTokens *int64 `json:"total_tokens"`
	TextTokens  *int64 `json:"text_tokens"`
	ImagePixels *int64 `json:"image_pixels"`
	VideoPixels *int64 `json:"video_pixels"`
}

type embeddingResponse struct {
	Data  json.RawMessage `json:"data"`
	Model string          `json:"model"`
	Usage *usageResponse  `json:"usage"`
}

type embeddingResult struct {
	Object string          `json:"object"`
	Data   json.RawMessage `json:"data"`
	Model  string          `json:"model"`
	Usage  dto.Usage       `json:"usage"`
}

type rerankResponse struct {
	Data []struct {
		Index          int     `json:"index"`
		RelevanceScore float64 `json:"relevance_score"`
		Document       *string `json:"document"`
	} `json:"data"`
	Usage *usageResponse `json:"usage"`
}

func modelKind(model string) (ModelKind, error) {
	if model == "" {
		return 0, errors.New("model is required")
	}
	kind, ok := modelKinds[model]
	if !ok {
		return 0, fmt.Errorf("unknown Voyage model: %s", model)
	}
	return kind, nil
}

func checkInputType(inputType *string) error {
	if inputType == nil {
		return nil
	}
	if *inputType != inputTypeDocument && *inputType != inputTypeQuery {
		return fmt.Errorf("input_type must be %q or %q", inputTypeDocument, inputTypeQuery)
	}
	return nil
}

// stringInputs reads an embedding input that holds plain strings only.
func stringInputs(input any) ([]string, error) {
	var texts []string
	switch value := input.(type) {
	case string:
		texts = []string{value}
	case []any:
		texts = make([]string, 0, len(value))
		for i, item := range value {
			text, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("input[%d] must be a string, got %T", i, item)
			}
			texts = append(texts, text)
		}
	default:
		return nil, fmt.Errorf("input must be a string or a list of strings, got %T", input)
	}
	if len(texts) == 0 {
		return nil, errors.New("input is empty")
	}
	for i, text := range texts {
		if text == "" {
			return nil, fmt.Errorf("input[%d] is empty", i)
		}
	}
	return texts, nil
}

func convertEmbeddingRequest(request dto.EmbeddingRequest) (any, error) {
	kind, err := modelKind(request.Model)
	if err != nil {
		return nil, err
	}
	if err = checkInputType(request.InputType); err != nil {
		return nil, err
	}
	switch kind {
	case KindEmbedding:
		input, err := stringInputs(request.Input)
		if err != nil {
			return nil, err
		}
		converted := embeddingRequest{
			Model:           request.Model,
			Input:           input,
			InputType:       request.InputType,
			OutputDimension: request.Dimensions,
		}
		switch request.EncodingFormat {
		case "", "float":
		case "base64":
			converted.EncodingFormat = "base64"
		default:
			return nil, fmt.Errorf("unsupported encoding_format %q, expected float or base64", request.EncodingFormat)
		}
		return converted, nil
	case KindContextualizedEmbedding:
		return convertContextualizedEmbeddingRequest(request)
	case KindMultimodalEmbedding:
		return convertMultimodalEmbeddingRequest(request)
	}
	return nil, fmt.Errorf("Voyage model %s is not an embedding model", request.Model)
}

func convertContextualizedEmbeddingRequest(request dto.EmbeddingRequest) (any, error) {
	if request.EncodingFormat != "" && request.EncodingFormat != "float" {
		return nil, fmt.Errorf("encoding_format %q is not supported for contextualized embeddings", request.EncodingFormat)
	}
	if request.InputType == nil {
		return nil, fmt.Errorf("input_type is required for contextualized embeddings: %q or %q", inputTypeDocument, inputTypeQuery)
	}
	for i, item := range anyList(request.Input) {
		if _, nested := item.([]any); nested {
			return nil, fmt.Errorf("input[%d] is a list: contextualized embeddings chunk each document automatically, pass one string per document", i)
		}
	}
	texts, err := stringInputs(request.Input)
	if err != nil {
		return nil, err
	}
	converted := contextualizedEmbeddingRequest{
		Model:           request.Model,
		InputType:       *request.InputType,
		OutputDimension: request.Dimensions,
	}
	if *request.InputType == inputTypeQuery {
		// Queries are not chunked: each query is a document of one chunk.
		queries := make([][]string, len(texts))
		for i, text := range texts {
			queries[i] = []string{text}
		}
		converted.Inputs = queries
		return converted, nil
	}
	autoChunking, chunkSize := true, contextChunkSize
	converted.Inputs = texts
	converted.EnableAutoChunking = &autoChunking
	converted.ChunkSize = &chunkSize
	return converted, nil
}

func anyList(input any) []any {
	items, _ := input.([]any)
	return items
}

func convertMultimodalEmbeddingRequest(request dto.EmbeddingRequest) (any, error) {
	if request.EncodingFormat != "" && request.EncodingFormat != "float" {
		return nil, fmt.Errorf("encoding_format %q is not supported for multimodal embeddings", request.EncodingFormat)
	}
	var items []any
	switch input := request.Input.(type) {
	case string, map[string]any:
		items = []any{input}
	case []any:
		items = input
	default:
		return nil, fmt.Errorf("unsupported multimodal input type: %T", request.Input)
	}
	if len(items) == 0 {
		return nil, errors.New("input is empty")
	}

	converted := multimodalEmbeddingRequest{
		Model:           request.Model,
		Inputs:          make([]multimodalInput, 0, len(items)),
		InputType:       request.InputType,
		OutputDimension: request.Dimensions,
	}
	var urlImages, base64Images int
	for i, item := range items {
		var parts []any
		switch value := item.(type) {
		case string:
			parts = []any{value}
		case map[string]any:
			// {"content": [...]} embeds its parts as one input; any other
			// object is a single part.
			if content, grouped := value["content"]; grouped {
				parts, _ = content.([]any)
			} else {
				parts = []any{value}
			}
		default:
			return nil, fmt.Errorf("input[%d] has unsupported type %T", i, item)
		}
		if len(parts) == 0 {
			return nil, fmt.Errorf("input[%d] has no content", i)
		}
		input := multimodalInput{Content: make([]contentPiece, 0, len(parts))}
		for _, part := range parts {
			piece, err := newContentPiece(request.Model, part)
			if err != nil {
				return nil, fmt.Errorf("input[%d]: %w", i, err)
			}
			if piece.ImageURL != "" {
				urlImages++
			}
			if piece.ImageBase64 != "" {
				base64Images++
			}
			input.Content = append(input.Content, piece)
		}
		converted.Inputs = append(converted.Inputs, input)
	}
	if urlImages > 0 && base64Images > 0 {
		return nil, errors.New("a request cannot mix image URLs and base64 images")
	}
	return converted, nil
}

func newContentPiece(model string, part any) (contentPiece, error) {
	if text, ok := part.(string); ok {
		part = map[string]any{"type": dto.ContentTypeText, "text": text}
	}
	fields, ok := part.(map[string]any)
	if !ok {
		return contentPiece{}, fmt.Errorf("content part has unsupported type %T", part)
	}
	partType, _ := fields["type"].(string)
	switch partType {
	case dto.ContentTypeText:
		text, _ := fields["text"].(string)
		if text == "" {
			return contentPiece{}, errors.New("text part is empty")
		}
		return contentPiece{Type: partType, Text: text}, nil
	case dto.ContentTypeImageURL, contentTypeImageBase64:
		source, err := mediaSource(fields[partType])
		if err != nil {
			return contentPiece{}, fmt.Errorf("%s: %w", partType, err)
		}
		if partType == contentTypeImageBase64 || strings.HasPrefix(source, "data:") {
			return contentPiece{Type: contentTypeImageBase64, ImageBase64: source}, nil
		}
		return contentPiece{Type: dto.ContentTypeImageURL, ImageURL: source}, nil
	case dto.ContentTypeVideoUrl, contentTypeVideoBase64:
		if model != "voyage-multimodal-3.5" {
			return contentPiece{}, fmt.Errorf("%s does not accept video input", model)
		}
		source, err := mediaSource(fields[partType])
		if err != nil {
			return contentPiece{}, fmt.Errorf("%s: %w", partType, err)
		}
		if partType == contentTypeVideoBase64 || strings.HasPrefix(source, "data:") {
			return contentPiece{Type: contentTypeVideoBase64, VideoBase64: source}, nil
		}
		return contentPiece{Type: dto.ContentTypeVideoUrl, VideoURL: source}, nil
	case "":
		return contentPiece{}, errors.New("content part is missing the type field")
	}
	return contentPiece{}, fmt.Errorf("unsupported content part type %q", partType)
}

// mediaSource reads a media value given either as a string or as {"url": ...}.
func mediaSource(value any) (string, error) {
	switch source := value.(type) {
	case string:
		if source != "" {
			return source, nil
		}
	case map[string]any:
		if url, _ := source["url"].(string); url != "" {
			return url, nil
		}
	}
	return "", errors.New("a URL or data URL is required")
}

func convertRerankRequest(request dto.RerankRequest) (any, error) {
	kind, err := modelKind(request.Model)
	if err != nil {
		return nil, err
	}
	if kind != KindRerank {
		return nil, fmt.Errorf("Voyage model %s is not a rerank model", request.Model)
	}
	if request.Query == "" {
		return nil, errors.New("query is required")
	}
	if len(request.Documents) == 0 {
		return nil, errors.New("documents is empty")
	}
	documents := make([]string, 0, len(request.Documents))
	for i, document := range request.Documents {
		switch value := document.(type) {
		case string:
			documents = append(documents, value)
		case map[string]any:
			text, ok := value["text"].(string)
			if !ok {
				return nil, fmt.Errorf("documents[%d] must be a string or an object with a text string", i)
			}
			documents = append(documents, text)
		default:
			return nil, fmt.Errorf("documents[%d] must be a string or an object with a text string, got %T", i, document)
		}
	}
	return rerankRequest{
		Model:           request.Model,
		Query:           request.Query,
		Documents:       documents,
		TopK:            request.TopN,
		ReturnDocuments: request.ReturnDocuments,
	}, nil
}

// tokenCount bounds a count the upstream reports before it is billed.
func tokenCount(value int64) int {
	return int(min(value, math.MaxInt32))
}

// textUsage turns the usage of an embedding or rerank response into billing
// usage. A response without usage fails instead of billing nothing.
func textUsage(usage *usageResponse) (*dto.Usage, error) {
	if usage == nil || usage.TotalTokens == nil {
		return nil, errors.New("Voyage response has no usage, refusing to bill it")
	}
	if *usage.TotalTokens < 0 {
		return nil, fmt.Errorf("Voyage response reports negative usage: %d", *usage.TotalTokens)
	}
	tokens := tokenCount(*usage.TotalTokens)
	return &dto.Usage{PromptTokens: tokens, TotalTokens: tokens}, nil
}

// multimodalUsage bills text tokens, and image and video pixels as image
// tokens of 560 pixels, which prices a pixel the way Voyage's pixel rate does.
func multimodalUsage(usage *usageResponse) (*dto.Usage, error) {
	if usage == nil || usage.TextTokens == nil || usage.ImagePixels == nil || usage.VideoPixels == nil {
		return nil, errors.New("Voyage response has no usage, refusing to bill it")
	}
	if *usage.TextTokens < 0 || *usage.ImagePixels < 0 || *usage.VideoPixels < 0 {
		return nil, errors.New("Voyage response reports negative usage")
	}
	const maxPixels = int64(math.MaxInt32) * pixelsPerImageToken
	pixels := min(*usage.ImagePixels, maxPixels) + min(*usage.VideoPixels, maxPixels)
	imageTokens := tokenCount((pixels + pixelsPerImageToken - 1) / pixelsPerImageToken)
	textTokens := tokenCount(*usage.TextTokens)
	promptTokens := tokenCount(int64(textTokens) + int64(imageTokens))
	result := &dto.Usage{PromptTokens: promptTokens, TotalTokens: promptTokens}
	result.PromptTokensDetails.TextTokens = textTokens
	result.PromptTokensDetails.ImageTokens = imageTokens
	return result, nil
}

func readResponseBody(c *gin.Context, resp *http.Response) ([]byte, *types.NewAPIError) {
	body, err := io.ReadAll(resp.Body)
	service.CloseResponseBodyGracefully(resp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	logger.LogDebug(c, "voyage response body: %s", common.LocalLogPreview(string(body)))
	return body, nil
}

func embeddingHandler(c *gin.Context, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	return writeEmbeddingResult(c, resp, textUsage)
}

func multimodalEmbeddingHandler(c *gin.Context, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	return writeEmbeddingResult(c, resp, multimodalUsage)
}

// writeEmbeddingResult re-emits an OpenAI-shaped embedding response. Data is
// copied untouched so base64 vectors survive.
func writeEmbeddingResult(c *gin.Context, resp *http.Response, toUsage func(*usageResponse) (*dto.Usage, error)) (*dto.Usage, *types.NewAPIError) {
	body, apiErr := readResponseBody(c, resp)
	if apiErr != nil {
		return nil, apiErr
	}
	var parsed embeddingResponse
	if err := common.Unmarshal(body, &parsed); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if len(parsed.Data) == 0 {
		return nil, types.NewOpenAIError(errors.New("Voyage response has no data"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	usage, err := toUsage(parsed.Usage)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	out, err := common.Marshal(embeddingResult{Object: "list", Data: parsed.Data, Model: parsed.Model, Usage: *usage})
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, out)
	return usage, nil
}

// contextualizedEmbeddingHandler forwards Voyage's own response: its
// document-grouped vectors and chunk texts have no OpenAI equivalent.
func contextualizedEmbeddingHandler(c *gin.Context, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	body, apiErr := readResponseBody(c, resp)
	if apiErr != nil {
		return nil, apiErr
	}
	var parsed embeddingResponse
	if err := common.Unmarshal(body, &parsed); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	usage, err := textUsage(parsed.Usage)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, body)
	return usage, nil
}

func rerankHandler(c *gin.Context, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	body, apiErr := readResponseBody(c, resp)
	if apiErr != nil {
		return nil, apiErr
	}
	var parsed rerankResponse
	if err := common.Unmarshal(body, &parsed); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	usage, err := textUsage(parsed.Usage)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	results := make([]dto.RerankResponseResult, len(parsed.Data))
	for i, item := range parsed.Data {
		results[i] = dto.RerankResponseResult{Index: item.Index, RelevanceScore: item.RelevanceScore}
		if item.Document != nil {
			results[i].Document = *item.Document
		}
	}
	out, err := common.Marshal(dto.RerankResponse{Results: results, Usage: *usage})
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, out)
	return usage, nil
}
