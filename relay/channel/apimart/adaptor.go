// Package apimart converts APIMart's asynchronous image protocol into an
// ordinary OpenAI Images response. It is deliberately separate from the
// synchronous OpenAI adaptor so a submit-only response cannot be charged or
// returned as a completed image.
package apimart

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const pollMaxAttempts = 20

// Variables keep production defaults explicit while allowing the polling state
// machine to be exercised locally without waiting for real timeouts.
var (
	pollInitialDelay = 5 * time.Second
	pollInterval     = 10 * time.Second
)

type Adaptor struct{ openai.Adaptor }

type apiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type submitResponse struct {
	Code int `json:"code"`
	Data []struct {
		Status string `json:"status"`
		TaskID string `json:"task_id"`
	} `json:"data"`
	Error *apiError `json:"error"`
}

type taskResponse struct {
	Code int `json:"code"`
	Data struct {
		Status string `json:"status"`
		Result struct {
			Images []struct {
				URL []string `json:"url"`
			} `json:"images"`
		} `json:"result"`
	} `json:"data"`
	Error *apiError `json:"error"`
}

func (a *Adaptor) GetChannelName() string { return "apimart-image" }

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	body, err := io.ReadAll(resp.Body)
	service.CloseResponseBodyGracefully(resp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var submitted submitResponse
	if err = common.Unmarshal(body, &submitted); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	if submitted.Error != nil {
		return nil, upstreamError(submitted.Error, http.StatusBadGateway)
	}
	if len(submitted.Data) != 1 || strings.TrimSpace(submitted.Data[0].TaskID) == "" {
		return nil, types.NewError(fmt.Errorf("APIMart submit response has no task_id"), types.ErrorCodeBadResponse)
	}

	completed, err := waitForTask(info, submitted.Data[0].TaskID)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponse)
	}
	if completed.Error != nil {
		return nil, upstreamError(completed.Error, http.StatusBadGateway)
	}
	if !strings.EqualFold(completed.Data.Status, "completed") {
		return nil, types.NewError(fmt.Errorf("APIMart task ended with status %q", completed.Data.Status), types.ErrorCodeBadResponse)
	}

	imageResponse := dto.ImageResponse{Created: info.StartTime.Unix()}
	for _, image := range completed.Data.Result.Images {
		for _, url := range image.URL {
			if strings.TrimSpace(url) != "" {
				imageResponse.Data = append(imageResponse.Data, dto.ImageData{Url: url})
			}
		}
	}
	if len(imageResponse.Data) == 0 {
		return nil, types.NewError(fmt.Errorf("APIMart completed task returned no image URL"), types.ErrorCodeBadResponse)
	}

	// Only successful, result-bearing tasks reach the normal per-call billing
	// path. Failed/expired/timeout tasks return before a usage object exists.
	info.PriceData.AddOtherRatio("n", float64(len(imageResponse.Data)))
	jsonResponse, err := common.Marshal(imageResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return &dto.Usage{}, nil
}

func waitForTask(info *relaycommon.RelayInfo, taskID string) (*taskResponse, error) {
	time.Sleep(pollInitialDelay)
	for attempt := 0; attempt < pollMaxAttempts; attempt++ {
		result, err := fetchTask(info, taskID)
		if err == nil && (result.Error != nil || isTerminal(result.Data.Status)) {
			return result, nil
		}
		if attempt == pollMaxAttempts-1 {
			if err != nil {
				return nil, err
			}
			break
		}
		time.Sleep(pollInterval)
	}
	return nil, fmt.Errorf("APIMart task %s timed out", taskID)
}

func fetchTask(info *relaycommon.RelayInfo, taskID string) (*taskResponse, error) {
	url := fmt.Sprintf("%s/v1/tasks/%s?language=en", strings.TrimRight(info.ChannelBaseUrl, "/"), taskID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+info.ApiKey)
	req.Header.Set("Accept", "application/json")
	client, err := service.GetHttpClientWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return nil, err
	}
	// Tests and one-off command paths may execute before the shared client is
	// initialized. Production uses the configured shared client; the fallback
	// keeps this adaptor fail-safe rather than panicking.
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("APIMart task query returned HTTP %d", resp.StatusCode)
	}
	var result taskResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func isTerminal(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "completed", "failed", "canceled", "cancelled", "error":
		return true
	default:
		return false
	}
}

func upstreamError(err *apiError, fallback int) *types.NewAPIError {
	status := err.Code
	if status < 400 || status > 599 {
		status = fallback
	}
	return types.NewErrorWithStatusCode(fmt.Errorf("APIMart: %s", err.Message), types.ErrorCodeBadResponse, status)
}
