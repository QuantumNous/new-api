package aionly

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type aionlySynthesisRequest struct {
	Model string               `json:"model"`
	Input aionlySynthesisInput `json:"input"`
}

type aionlySynthesisInput struct {
	Text  string `json:"text"`
	Voice string `json:"voice"`
}

type aionlySynthesisResponse struct {
	Code int                  `json:"code"`
	Msg  string               `json:"msg"`
	Data *aionlySynthesisData `json:"data"`
}

type aionlySynthesisData struct {
	URL string `json:"url"`
}

func AionlyTTSHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(
			fmt.Errorf("failed to read aiionly synthesis response: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}

	var synthesisResp aionlySynthesisResponse
	if err := common.Unmarshal(body, &synthesisResp); err != nil {
		return nil, types.NewOpenAIError(
			fmt.Errorf("failed to unmarshal aiionly synthesis response: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}

	if synthesisResp.Code != 200 || synthesisResp.Data == nil || synthesisResp.Data.URL == "" {
		errMsg := synthesisResp.Msg
		if errMsg == "" {
			errMsg = "unknown aiionly synthesis error"
		}
		return nil, types.NewOpenAIError(
			fmt.Errorf("aiionly synthesis failed: %s", errMsg),
			types.ErrorCodeReadResponseBodyFailed,
			resp.StatusCode,
		)
	}

	usage := &dto.Usage{}
	usage.PromptTokens = info.GetEstimatePromptTokens()
	usage.PromptTokensDetails.TextTokens = usage.PromptTokens
	usage.TotalTokens = usage.PromptTokens

	clientResp := synthesisResp
	audioURL := synthesisResp.Data.URL
	if !strings.HasPrefix(audioURL, "http") {
		audioURL = info.ChannelBaseUrl + "/" + strings.TrimPrefix(audioURL, "/")
	}
	clientResp.Data = &aionlySynthesisData{URL: audioURL}

	responseBody, err := common.Marshal(clientResp)
	if err != nil {
		return nil, types.NewOpenAIError(
			fmt.Errorf("failed to marshal aiionly synthesis response: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}
	resp.Header.Set("Content-Type", "application/json")
	service.IOCopyBytesGracefully(c, resp, responseBody)

	return usage, nil
}
