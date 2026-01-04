package deepinfra

import (
	"encoding/json"
	"io"
	"net/http"
	"sort"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func deepinfraRerankHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)
	var deepinfraResp DeepinfraRerankResponse
	err = json.Unmarshal(responseBody, &deepinfraResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	scores := make([]struct {
		Index int
		Score float64
	}, 0, len(deepinfraResp.Scores))
	for index, score := range deepinfraResp.Scores {
		scores = append(scores, struct {
			Index int
			Score float64
		}{
			Index: index,
			Score: score,
		})
	}
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].Score > scores[j].Score
	})
	results := make([]dto.RerankResponseResult, 0, len(scores))
	for _, item := range scores {
		results = append(results, dto.RerankResponseResult{
			Index:          item.Index,
			RelevanceScore: item.Score,
		})
	}
	promptTokens := deepinfraResp.InferenceStatus.TokensInput
	if promptTokens == 0 {
		promptTokens = deepinfraResp.InputTokens
	}
	if promptTokens == 0 {
		promptTokens = info.GetEstimatePromptTokens()
	}
	usage := &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: 0,
		TotalTokens:      promptTokens,
	}
	rerankResp := &dto.RerankResponse{
		Results: results,
		Usage:   *usage,
	}

	jsonResponse, err := json.Marshal(rerankResp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return usage, nil
}
