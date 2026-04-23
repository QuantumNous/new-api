package aionly

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	aionlyProbeTimeout         = 8 * time.Second
	aionlyMaxProbeDownloadSize = 12 * 1024 * 1024
	aionlyMinAudioTokens       = 1
)

var estimateAionlyAudioTokensFn = estimateAionlyAudioTokens

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

	clientResp := synthesisResp
	audioURL := synthesisResp.Data.URL
	if !strings.HasPrefix(audioURL, "http") {
		audioURL = info.ChannelBaseUrl + "/" + strings.TrimPrefix(audioURL, "/")
	}
	clientResp.Data = &aionlySynthesisData{URL: audioURL}

	completionAudioTokens := estimateAionlyAudioTokensFn(c, audioURL)
	usage.CompletionTokens = completionAudioTokens
	usage.CompletionTokenDetails.AudioTokens = completionAudioTokens
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens

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

func estimateAionlyAudioTokens(c *gin.Context, audioURL string) int {
	duration, estimatedSize, err := probeAionlyAudio(c, audioURL)
	if err == nil && duration > 0 {
		return completionTokensFromDuration(duration)
	}
	if estimatedSize > 0 {
		return completionTokensFromSize(estimatedSize)
	}
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("aionly audio probe failed, use minimal tokens: %v", err))
	}
	return aionlyMinAudioTokens
}

func probeAionlyAudio(c *gin.Context, audioURL string) (float64, int64, error) {
	if audioURL == "" {
		return 0, 0, fmt.Errorf("empty audio url")
	}
	if c == nil || c.Request == nil {
		return 0, 0, fmt.Errorf("invalid request context")
	}
	if err := validateAudioURL(audioURL); err != nil {
		return 0, 0, fmt.Errorf("invalid audio url: %w", err)
	}

	client := service.GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}

	probeCtx, cancel := context.WithTimeout(c.Request.Context(), aionlyProbeTimeout)
	defer cancel()

	sizeFromHead := int64(0)
	headRequest, err := http.NewRequestWithContext(probeCtx, http.MethodHead, audioURL, nil)
	if err == nil {
		headResponse, headErr := client.Do(headRequest)
		if headErr == nil {
			if headResponse.ContentLength > 0 {
				sizeFromHead = headResponse.ContentLength
			}
			_ = headResponse.Body.Close()
		}
	}

	if sizeFromHead > aionlyMaxProbeDownloadSize {
		return 0, sizeFromHead, fmt.Errorf("audio is too large for duration probe")
	}

	getRequest, err := http.NewRequestWithContext(probeCtx, http.MethodGet, audioURL, nil)
	if err != nil {
		return 0, sizeFromHead, fmt.Errorf("failed to create audio probe request: %w", err)
	}
	getResponse, err := client.Do(getRequest)
	if err != nil {
		return 0, sizeFromHead, fmt.Errorf("failed to fetch audio for probe: %w", err)
	}
	defer getResponse.Body.Close()

	if getResponse.StatusCode != http.StatusOK {
		return 0, maxInt64(sizeFromHead, getResponse.ContentLength), fmt.Errorf("audio probe returned status %d", getResponse.StatusCode)
	}

	limitedReader := io.LimitReader(getResponse.Body, aionlyMaxProbeDownloadSize+1)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return 0, maxInt64(sizeFromHead, getResponse.ContentLength), fmt.Errorf("failed to read probe audio body: %w", err)
	}

	estimatedSize := maxInt64(sizeFromHead, getResponse.ContentLength)
	if estimatedSize <= 0 {
		estimatedSize = int64(len(body))
	}

	if len(body) > aionlyMaxProbeDownloadSize {
		return 0, estimatedSize, fmt.Errorf("audio probe body exceeds limit")
	}

	ext := resolveAudioExtension(audioURL, getResponse.Header.Get("Content-Type"))
	duration, durationErr := common.GetAudioDuration(probeCtx, bytes.NewReader(body), ext)
	if durationErr != nil {
		return 0, estimatedSize, durationErr
	}

	return duration, estimatedSize, nil
}

func validateAudioURL(audioURL string) error {
	fetchSetting := system_setting.GetFetchSetting()
	return common.ValidateURLWithFetchSetting(
		audioURL,
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	)
}

func resolveAudioExtension(audioURL string, contentType string) string {
	if parsedURL, err := url.Parse(audioURL); err == nil {
		ext := strings.ToLower(path.Ext(parsedURL.Path))
		if ext != "" {
			return ext
		}
	}
	contentTypeLower := strings.ToLower(contentType)
	switch {
	case strings.Contains(contentTypeLower, "audio/wav") || strings.Contains(contentTypeLower, "audio/x-wav"):
		return ".wav"
	case strings.Contains(contentTypeLower, "audio/ogg"):
		return ".ogg"
	case strings.Contains(contentTypeLower, "audio/flac"):
		return ".flac"
	case strings.Contains(contentTypeLower, "audio/aac"):
		return ".aac"
	case strings.Contains(contentTypeLower, "audio/mpeg"):
		return ".mp3"
	default:
		return ".mp3"
	}
}

func completionTokensFromDuration(duration float64) int {
	if duration <= 0 {
		return aionlyMinAudioTokens
	}
	tokens := int(math.Round(math.Ceil(duration) / 60.0 * 1000.0))
	if tokens <= 0 {
		return aionlyMinAudioTokens
	}
	return tokens
}

func completionTokensFromSize(sizeInBytes int64) int {
	if sizeInBytes <= 0 {
		return aionlyMinAudioTokens
	}
	tokens := int(math.Ceil(float64(sizeInBytes) / 1000.0))
	if tokens <= 0 {
		return aionlyMinAudioTokens
	}
	return tokens
}

func maxInt64(left int64, right int64) int64 {
	if left > right {
		return left
	}
	return right
}
