package zhipu

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	//TODO implement me
	panic("implement me")
	return nil, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// Force non-streaming for GLM via New API for stability with Responses API.
	info.IsStream = false
	method := "invoke"
	return fmt.Sprintf("%s/api/paas/v3/model-api/%s/%s", info.ChannelBaseUrl, info.UpstreamModelName, method), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	token := getZhipuToken(info.ApiKey)
	req.Set("Authorization", token)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if lo.FromPtrOr(request.TopP, 0) >= 1 {
		request.TopP = lo.ToPtr(0.99)
	}
	return requestOpenAI2Zhipu(*request), nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// Bridge Responses API to standard OpenAI Chat format
	oaiReq := &dto.GeneralOpenAIRequest{
		Model:  request.Model,
		Stream: lo.ToPtr(false),
	}

	if request.MaxOutputTokens != nil {
		oaiReq.MaxTokens = request.MaxOutputTokens
	}
	if request.Temperature != nil {
		oaiReq.Temperature = request.Temperature
	}
	if request.TopP != nil {
		oaiReq.TopP = request.TopP
	}

	// Instructions -> System Message
	if len(request.Instructions) > 0 {
		var instrStr string
		if err := json.Unmarshal(request.Instructions, &instrStr); err == nil && instrStr != "" {
			oaiReq.Messages = append(oaiReq.Messages, dto.Message{
				Role:    "system",
				Content: instrStr,
			})
		}
	}

	// Input -> User Messages
	if len(request.Input) > 0 {
		inputs := request.ParseInput()
		var contentParts []dto.MediaContent
		for _, inp := range inputs {
			if inp.Type == "input_text" {
				contentParts = append(contentParts, dto.MediaContent{Type: "text", Text: inp.Text})
			}
		}
		if len(contentParts) == 1 {
			oaiReq.Messages = append(oaiReq.Messages, dto.Message{
				Role:    "user",
				Content: contentParts[0].Text,
			})
		} else if len(contentParts) > 1 {
			msg := dto.Message{Role: "user"}
			msg.SetMediaContent(contentParts)
			oaiReq.Messages = append(oaiReq.Messages, msg)
		}
	}

	return a.ConvertOpenAIRequest(c, info, oaiReq)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	// Force non-streaming handler
	info.IsStream = false
	usage, err = zhipuHandler(c, info, resp)
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
