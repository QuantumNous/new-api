package vertex

import (
	"errors"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func VertexEmbeddingHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	var vertexResponse VertexEmbeddingResponse
	if err := common.Unmarshal(responseBody, &vertexResponse); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if len(vertexResponse.Predictions) != 1 {
		return nil, types.NewOpenAIError(errors.New("Vertex embedding response must contain exactly one prediction"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}

	prediction := vertexResponse.Predictions[0]
	if len(prediction.Embeddings.Values) == 0 {
		return nil, types.NewOpenAIError(errors.New("Vertex embedding response contains an empty vector"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}

	promptTokens := prediction.Embeddings.Statistics.TokenCount
	if promptTokens == 0 {
		promptTokens = info.GetEstimatePromptTokens()
	}
	usage := dto.Usage{
		PromptTokens: promptTokens,
		TotalTokens:  promptTokens,
		InputTokens:  promptTokens,
	}
	openAIResponse := dto.OpenAIEmbeddingResponse{
		Object: "list",
		Data: []dto.OpenAIEmbeddingResponseItem{{
			Object:    "embedding",
			Index:     0,
			Embedding: prediction.Embeddings.Values,
		}},
		Model: info.UpstreamModelName,
		Usage: usage,
	}

	jsonResponse, err := common.Marshal(openAIResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return &usage, nil
}
