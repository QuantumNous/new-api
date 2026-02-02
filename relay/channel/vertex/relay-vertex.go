package vertex

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

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
	err = json.Unmarshal(responseBody, &vertexResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	tokenCount := 0
	for _, prediction := range vertexResponse.Predictions {
		tokenCount += prediction.Embeddings.Statistics.TokenCount
	}

	usage := &dto.Usage{
		PromptTokens: tokenCount,
		TotalTokens:  tokenCount,
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	return usage, nil
}
