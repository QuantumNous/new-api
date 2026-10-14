package subq

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseUrl := info.ChannelBaseUrl
	if baseUrl == "" {
		baseUrl = "https://api.subq.ai/v1"
	}
	baseUrl = strings.TrimSuffix(baseUrl, "/")
	if !strings.HasSuffix(baseUrl, "/systemone") {
		baseUrl = baseUrl + "/systemone"
	}
	return baseUrl, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	req.Set("User-Agent", "NewAPI-SubQ-Adaptor/1.0")
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	state := "General Context State"
	prompt := "Evaluate probability and criteria."

	for _, m := range request.Messages {
		if m.Role == "system" {
			state = fmt.Sprintf("%v", m.Content)
		} else if m.Role == "user" {
			prompt = fmt.Sprintf("%v", m.Content)
		}
	}

	return map[string]any{
		"model": request.Model,
		"state": state,
		"questions": map[string]any{
			"decision": map[string]any{
				"prompt":       prompt,
				"instructions": "Calibrated decision evaluation.",
				"type":         "choice",
				"criteria": map[string]string{
					"affirmative": "True / Accepted",
					"negative":    "False / Rejected",
				},
			},
		},
	}, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if resp == nil {
		return nil, types.NewError(errors.New("upstream response is nil"), types.ErrorCodeBadResponseBody)
	}
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewError(readErr, types.ErrorCodeBadResponseBody)
	}

	var raw map[string]any
	if unmarshalErr := json.Unmarshal(responseBody, &raw); unmarshalErr != nil {
		return nil, types.NewError(unmarshalErr, types.ErrorCodeBadResponseBody)
	}

	evalsBytes, _ := json.Marshal(raw["evaluations"])
	var openaiResp dto.TextResponse
	openaiResp.Id = fmt.Sprintf("subq-%d", common.GetTimestamp())
	openaiResp.Created = common.GetTimestamp()
	openaiResp.Object = "chat.completion"
	openaiResp.Model = info.UpstreamModelName
	openaiResp.Choices = []dto.OpenAITextResponseChoice{
		{
			Index: 0,
			Message: dto.Message{
				Role:    "assistant",
				Content: string(evalsBytes),
			},
			FinishReason: "stop",
		},
	}

	c.JSON(http.StatusOK, openaiResp)
	return raw["usage"], nil
}

func (a *Adaptor) GetModelList() []string {
	return []string{"subq-latest", "subq-1.0"}
}

func (a *Adaptor) GetChannelName() string {
	return "subq"
}
