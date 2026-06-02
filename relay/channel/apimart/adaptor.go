package apimart

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	apiKey  string
	baseURL string
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.apiKey = info.ApiKey
	a.baseURL = info.ChannelBaseUrl
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return strings.TrimRight(info.ChannelBaseUrl, "/") + "/v1/images/generations", nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	header.Set("Authorization", "Bearer "+info.ApiKey)
	header.Set("Content-Type", "application/json")
	return nil
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	n := 1
	if request.N != nil {
		n = int(*request.N)
	}
	return &SubmitRequest{
		Model:  request.Model,
		Prompt: request.Prompt,
		N:      &n,
		Size:   request.Size,
	}, nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("apimart: chat not supported")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("apimart: rerank not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("apimart: embedding not supported")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("apimart: audio not supported")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("apimart: responses not supported")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("apimart: claude not supported")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("apimart: gemini not supported")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	// Read submit response body.
	body, readErr := io.ReadAll(resp.Body)
	resp.Body.Close()
	if readErr != nil {
		return nil, types.NewError(fmt.Errorf("apimart: read submit response: %w", readErr), types.ErrorCodeBadResponse)
	}

	var submitResp SubmitResponse
	if unmarshalErr := common.Unmarshal(body, &submitResp); unmarshalErr != nil {
		return nil, types.NewError(fmt.Errorf("apimart: parse submit response: %w", unmarshalErr), types.ErrorCodeBadResponse)
	}
	if submitResp.Code != 200 || len(submitResp.Data) == 0 {
		return nil, types.NewError(
			fmt.Errorf("apimart: submit failed code=%d msg=%s", submitResp.Code, submitResp.Message),
			types.ErrorCodeBadResponse,
		)
	}

	taskID := submitResp.Data[0].TaskID
	if taskID == "" {
		return nil, types.NewError(errors.New("apimart: empty task_id in submit response"), types.ErrorCodeBadResponse)
	}

	imageURL, pollErr := pollTask(
		c.Request.Context(),
		service.GetHttpClient(),
		a.baseURL,
		a.apiKey,
		taskID,
		3*time.Second,
		10*time.Minute,
	)
	if pollErr != nil {
		return nil, types.NewError(pollErr, types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}

	imageResp := dto.ImageResponse{
		Created: time.Now().Unix(),
		Data:    []dto.ImageData{{Url: imageURL}},
	}
	c.JSON(http.StatusOK, imageResp)

	return &dto.Usage{PromptTokens: 1, TotalTokens: 1}, nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

// pollTask polls GET {baseURL}/v1/tasks/{taskID} until the task completes, fails, or the context/timeout expires.
func pollTask(ctx context.Context, client *http.Client, baseURL, apiKey, taskID string, interval, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	pollURL := strings.TrimRight(baseURL, "/") + "/v1/tasks/" + taskID
	for {
		req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, pollURL, nil)
		if reqErr != nil {
			return "", reqErr
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)

		httpResp, doErr := client.Do(req)
		if doErr != nil {
			return "", doErr
		}
		respBody, _ := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()

		var tr TaskResponse
		if unmarshalErr := common.Unmarshal(respBody, &tr); unmarshalErr != nil {
			return "", fmt.Errorf("apimart: bad task response: %s", string(respBody))
		}

		switch tr.Data.Status {
		case "completed":
			if len(tr.Data.Result.Images) > 0 && len(tr.Data.Result.Images[0].URL) > 0 {
				return tr.Data.Result.Images[0].URL[0], nil
			}
			return "", errors.New("apimart: completed but no image url")
		case "failed":
			return "", fmt.Errorf("apimart: task failed: %s", tr.Data.Error)
		}

		if time.Now().After(deadline) {
			return "", fmt.Errorf("apimart: poll timeout after %s (last status %q)", timeout, tr.Data.Status)
		}
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(interval):
		}
	}
}
