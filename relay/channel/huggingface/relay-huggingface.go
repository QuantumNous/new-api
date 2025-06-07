package huggingface

import (
	"encoding/json"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/service"
	"sort"

	"github.com/gin-gonic/gin"
)

// requestConvertRerank2HuggingFace converts OpenAI rerank request to Hugging Face TEI format
func requestConvertRerank2HuggingFace(rerankRequest dto.RerankRequest) *HuggingFaceTEIRerankRequest {
	// Convert documents to string array
	texts := make([]string, len(rerankRequest.Documents))
	for i, doc := range rerankRequest.Documents {
		switch v := doc.(type) {
		case string:
			texts[i] = v
		case map[string]interface{}:
			if text, ok := v["text"].(string); ok {
				texts[i] = text
			} else if content, ok := v["content"].(string); ok {
				texts[i] = content
			}
		default:
			// Try to convert to string
			if str, ok := doc.(string); ok {
				texts[i] = str
			} else {
				// Fallback: convert to JSON string
				if jsonBytes, err := json.Marshal(doc); err == nil {
					texts[i] = string(jsonBytes)
				}
			}
		}
	}

	return &HuggingFaceTEIRerankRequest{
		Query:     rerankRequest.Query,
		Texts:     texts,
		Truncate:  true,
		RawScores: false,
	}
}

// requestConvertEmbedding2HuggingFace converts OpenAI embedding request to Hugging Face TEI format
func requestConvertEmbedding2HuggingFace(embeddingRequest dto.EmbeddingRequest) *HuggingFaceEmbeddingRequest {
	inputs := embeddingRequest.ParseInput()
	return &HuggingFaceEmbeddingRequest{
		Inputs:    inputs,
		Truncate:  true,
		Normalize: true,
	}
}

// huggingFaceRerankHandler handles the rerank response from Hugging Face TEI
func huggingFaceRerankHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.OpenAIErrorWithStatusCode, *dto.Usage) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError), nil
	}
	err = resp.Body.Close()
	if err != nil {
		return service.OpenAIErrorWrapper(err, "close_response_body_failed", http.StatusInternalServerError), nil
	}

	if common.DebugEnabled {
		common.SysLog("huggingface rerank response body: " + string(responseBody))
	}

	var hfResp HuggingFaceTEIRerankResponse
	err = json.Unmarshal(responseBody, &hfResp)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError), nil
	}

	// Convert HuggingFace response to OpenAI format
	results := make([]dto.RerankResponseResult, len(hfResp))
	for i, result := range hfResp {
		rerankResult := dto.RerankResponseResult{
			Index:          result.Index,
			RelevanceScore: result.Score,
		}

		// Add document if requested
		if info.ReturnDocuments && result.Index < len(info.Documents) {
			rerankResult.Document = info.Documents[result.Index]
		}

		results[i] = rerankResult
	}

	// Sort results by relevance score in descending order
	sort.Slice(results, func(i, j int) bool {
		return results[i].RelevanceScore > results[j].RelevanceScore
	})

	// Create usage information
	usage := dto.Usage{
		PromptTokens: info.PromptTokens,
		TotalTokens:  info.PromptTokens,
	}

	// Create response
	rerankResp := dto.RerankResponse{
		Results: results,
		Usage:   usage,
	}

	jsonResponse, err := json.Marshal(rerankResp)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "marshal_response_body_failed", http.StatusInternalServerError), nil
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "write_response_body_failed", http.StatusInternalServerError), nil
	}

	return nil, &usage
}

// huggingFaceEmbeddingHandler handles the embedding response from Hugging Face TEI
func huggingFaceEmbeddingHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.OpenAIErrorWithStatusCode, *dto.Usage) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError), nil
	}
	err = resp.Body.Close()
	if err != nil {
		return service.OpenAIErrorWrapper(err, "close_response_body_failed", http.StatusInternalServerError), nil
	}

	if common.DebugEnabled {
		common.SysLog("huggingface embedding response body: " + string(responseBody))
	}

	var hfResp HuggingFaceEmbeddingResponse
	err = json.Unmarshal(responseBody, &hfResp)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError), nil
	}

	// Convert HuggingFace response to OpenAI format
	data := make([]dto.OpenAIEmbeddingResponseItem, len(hfResp))
	for i, embedding := range hfResp {
		data[i] = dto.OpenAIEmbeddingResponseItem{
			Object:    "embedding",
			Index:     i,
			Embedding: embedding,
		}
	}

	// Create usage information
	usage := dto.Usage{
		PromptTokens: info.PromptTokens,
		TotalTokens:  info.PromptTokens,
	}

	// Create response
	embeddingResp := dto.OpenAIEmbeddingResponse{
		Object: "list",
		Data:   data,
		Model:  info.UpstreamModelName,
		Usage:  usage,
	}

	jsonResponse, err := json.Marshal(embeddingResp)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "marshal_response_body_failed", http.StatusInternalServerError), nil
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "write_response_body_failed", http.StatusInternalServerError), nil
	}

	return nil, &usage
}
