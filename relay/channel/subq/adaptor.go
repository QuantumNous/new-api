package subq

import (
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

	var systemParts []string
	var promptParts []string

	for _, m := range request.Messages {
		content := m.StringContent()
		if m.Role == "system" {
			systemParts = append(systemParts, content)
		} else if m.Role == "user" {
			promptParts = append(promptParts, content)
		}
	}

	state := strings.Join(systemParts, "\n")
	if state == "" {
		state = "General Context State"
	}
	prompt := strings.Join(promptParts, "\n")
	if prompt == "" {
		prompt = "Evaluate probability and criteria."
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

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, types.NewError(
			fmt.Errorf("subq upstream returned status %d: %s", resp.StatusCode, string(responseBody)),
			types.ErrorCodeBadResponseStatusCode,
		)
	}

	var raw map[string]any
	if unmarshalErr := common.Unmarshal(responseBody, &raw); unmarshalErr != nil {
		return nil, types.NewError(unmarshalErr, types.ErrorCodeBadResponseBody)
	}

	evalTarget := raw["answers"]
	if evalTarget == nil {
		evalTarget = raw["evaluations"]
	}
	if evalTarget == nil {
		evalTarget = raw
	}

	evalsBytes, _ := common.Marshal(evalTarget)
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

	parsedUsage := &dto.Usage{}
	if rawUsage, ok := raw["usage"]; ok && rawUsage != nil {
		usageBytes, _ := common.Marshal(rawUsage)
		_ = common.Unmarshal(usageBytes, parsedUsage)
	}
	return parsedUsage, nil
}

func (a *Adaptor) GetModelList() []string {
	return []string{"subq-snap-preview", "subq-latest"}
}

func (a *Adaptor) GetChannelName() string {
	return "subq"
}
