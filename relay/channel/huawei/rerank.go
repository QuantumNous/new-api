package huawei

import (
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// huaweiRerankHandler converts the MaaS rerank response into the
// OpenAI-compatible rerank shape. MaaS nests the document text under
// document.text; it is flattened before the response is written back.
func huaweiRerankHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	var hwResp MaaSRerankResponse
	if err := common.Unmarshal(responseBody, &hwResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if hwResp.Error != nil {
		return nil, types.WithOpenAIError(types.OpenAIError{Message: fmt.Sprintf("huawei maas rerank error: %v", hwResp.Error)}, resp.StatusCode)
	}

	rerankResp := dto.RerankResponse{
		Results: make([]dto.RerankResponseResult, 0, len(hwResp.Results)),
		Usage: dto.Usage{
			PromptTokens: hwResp.Usage.TotalTokens,
			TotalTokens:  hwResp.Usage.TotalTokens,
		},
	}
	for _, result := range hwResp.Results {
		item := dto.RerankResponseResult{
			Index:          result.Index,
			RelevanceScore: result.RelevanceScore,
		}
		if info.ReturnDocuments {
			if result.Document.Text != nil {
				item.Document = result.Document.Text
			} else if result.Index >= 0 && result.Index < len(info.Documents) {
				item.Document = info.Documents[result.Index]
			}
		}
		rerankResp.Results = append(rerankResp.Results, item)
	}

	jsonResponse, err := common.Marshal(rerankResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return &rerankResp.Usage, nil
}
