package vertex

import (
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// isVertexEmbedding decides whether to route the response through the Vertex
// embedding handler. Both the OpenAI-compatible /v1/embeddings path and the
// Gemini-native :embedContent / :batchEmbedContents paths land here, plus
// embedding model names regardless of relay mode.
func isVertexEmbedding(info *relaycommon.RelayInfo) bool {
	if strings.Contains(info.RequestURLPath, "embed") {
		return true
	}
	m := info.UpstreamModelName
	return strings.HasPrefix(m, "gemini-embedding") ||
		strings.HasPrefix(m, "text-embedding") ||
		strings.HasPrefix(m, "text-multilingual-embedding")
}

func GetModelRegion(other string, localModelName string) string {
	// if other is json string
	if common.IsJsonObject(other) {
		m, err := common.StrToMap(other)
		if err != nil {
			return other // return original if parsing fails
		}
		if m[localModelName] != nil {
			return m[localModelName].(string)
		} else {
			if v, ok := m["default"]; ok {
				return v.(string)
			}
			return "global"
		}
	}
	return other
}

type VertexEmbeddingResponse struct {
	Predictions []struct {
		Embeddings struct {
			Statistics struct {
				TokenCount int `json:"token_count"`
			} `json:"statistics"`
			Values []float64 `json:"values"`
		} `json:"embeddings"`
	} `json:"predictions"`
	Metadata struct {
		BillableCharacterCount int `json:"billableCharacterCount"`
	} `json:"metadata"`
}

func vertexEmbeddingHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if common.DebugEnabled {
		logger.LogDebug(c, "Vertex Embedding response body: "+string(responseBody))
	}

	var vertexResponse VertexEmbeddingResponse
	if err := common.Unmarshal(responseBody, &vertexResponse); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	openAIResponse := dto.OpenAIEmbeddingResponse{
		Object: "list",
		Data:   make([]dto.OpenAIEmbeddingResponseItem, 0, len(vertexResponse.Predictions)),
		Model:  info.UpstreamModelName,
	}

	tokenCount := 0
	for i, prediction := range vertexResponse.Predictions {
		openAIResponse.Data = append(openAIResponse.Data, dto.OpenAIEmbeddingResponseItem{
			Object:    "embedding",
			Embedding: prediction.Embeddings.Values,
			Index:     i,
		})
		tokenCount += prediction.Embeddings.Statistics.TokenCount
	}

	usage := &dto.Usage{
		PromptTokens: tokenCount,
		TotalTokens:  tokenCount,
	}
	openAIResponse.Usage = *usage

	jsonResponse, err := common.Marshal(openAIResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write(jsonResponse)

	return usage, nil
}
