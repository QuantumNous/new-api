package aionly

import (
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type AionlyImageUsage struct {
	InputTextTokens  int `json:"input_text_tokens"`
	InputImageTokens int `json:"input_image_tokens"`
	InputTotalTokens int `json:"input_total_tokens"`
	OutputTotalTokens int `json:"output_total_tokens"`
	TotalTokens      int `json:"total_tokens"`
	ImagesCount     int `json:"images_count"`
}

func AionlyImageHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var aionlyUsage AionlyImageUsage
	err = common.Unmarshal(responseBody, &aionlyUsage)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	usage := &dto.Usage{
		TotalTokens: aionlyUsage.TotalTokens,
		InputTokens:   aionlyUsage.InputTotalTokens,
		OutputTokens:  aionlyUsage.OutputTotalTokens,
		InputTokensDetails: &dto.InputTokenDetails{
			TextTokens:  aionlyUsage.InputTextTokens,
			ImageTokens: aionlyUsage.InputImageTokens,
		},
	}

	if usage.TotalTokens == 0 {
		usage.TotalTokens = 1
	}
	if usage.InputTokens == 0 {
		usage.InputTokens = 1
	}

	return usage, nil
}
