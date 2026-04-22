package aionly

import (
	"bytes"
	"fmt"
	"io"
	"math"
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

type aionlySynthesisRequest struct {
	Model string               `json:"model"`
	Input aionlySynthesisInput `json:"input"`
}

type aionlySynthesisInput struct {
	Text  string `json:"text"`
	Voice string `json:"voice"`
}

type aionlySynthesisResponse struct {
	Code int                   `json:"code"`
	Msg  string                `json:"msg"`
	Data *aionlySynthesisData  `json:"data"`
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

	audioURL := synthesisResp.Data.URL
	if !strings.HasPrefix(audioURL, "http") {
		audioURL = info.ChannelBaseUrl + "/" + strings.TrimPrefix(audioURL, "/")
	}

	audioData, err := downloadAudio(c, audioURL)
	if err != nil {
		return nil, types.NewOpenAIError(
			fmt.Errorf("failed to download aiionly synthesis audio: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}

	usage := &dto.Usage{}
	usage.PromptTokens = info.GetEstimatePromptTokens()
	usage.PromptTokensDetails.TextTokens = usage.PromptTokens

	ext := ".mp3"
	reader := bytes.NewReader(audioData)
	duration, durationErr := common.GetAudioDuration(c.Request.Context(), reader, ext)

	if durationErr != nil {
		logger.LogWarn(c, fmt.Sprintf("failed to get audio duration: %v", durationErr))
		sizeInKB := float64(len(audioData)) / 1000.0
		estimatedTokens := int(math.Ceil(sizeInKB))
		usage.CompletionTokens = estimatedTokens
		usage.CompletionTokenDetails.AudioTokens = estimatedTokens
	} else if duration > 0 {
		completionTokens := int(math.Round(math.Ceil(duration) / 60.0 * 1000))
		usage.CompletionTokens = completionTokens
		usage.CompletionTokenDetails.AudioTokens = completionTokens
	}
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens

	c.Writer.Header().Set("Content-Type", "audio/mpeg")
	c.Writer.WriteHeader(http.StatusOK)
	if _, err := c.Writer.Write(audioData); err != nil {
		logger.LogError(c, fmt.Sprintf("failed to write TTS audio response: %v", err))
	}

	return usage, nil
}

func downloadAudio(c *gin.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create download request: %w", err)
	}

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to download audio: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("audio download returned status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read audio data: %w", err)
	}

	return data, nil
}
