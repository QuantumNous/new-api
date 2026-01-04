package deepinfra

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	adaptor := openai.Adaptor{}
	return adaptor.ConvertClaudeRequest(c, info, req)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	adaptor := openai.Adaptor{}
	return adaptor.ConvertAudioRequest(c, info, request)
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// 解析extra到SFImageRequest里，以填入DeepInfra特殊字段。若失败重建一个空的。
	sfRequest := &SFImageRequest{}
	extra, err := common.Marshal(request.Extra)
	if err == nil {
		err = common.Unmarshal(extra, sfRequest)
		if err != nil {
			sfRequest = &SFImageRequest{}
		}
	}

	sfRequest.Model = request.Model
	sfRequest.Prompt = request.Prompt
	// 优先使用image_size/batch_size，否则使用OpenAI标准的size/n
	if sfRequest.ImageSize == "" {
		sfRequest.ImageSize = request.Size
	}
	if sfRequest.BatchSize == 0 {
		sfRequest.BatchSize = request.N
	}

	return sfRequest, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode == constant.RelayModeRerank {
		modelName := info.UpstreamModelName
		if modelName == "" {
			modelName = info.OriginModelName
		}
		modelName = strings.TrimPrefix(modelName, "/")
		return fmt.Sprintf("%s/v1/inference/%s", info.ChannelBaseUrl, modelName), nil
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	// DeepInfra requires messages array for FIM requests, even if client doesn't send it
	if (request.Prefix != nil || request.Suffix != nil) && len(request.Messages) == 0 {
		// Add an empty user message to satisfy DeepInfra's requirement
		request.Messages = []dto.Message{
			{
				Role:    "user",
				Content: "",
			},
		}
	}
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info.RelayMode == constant.RelayModeRerank {
		return channel.DoApiRequest(a, c, info, requestBody)
	}
	adaptor := openai.Adaptor{}
	return adaptor.DoRequest(c, info, requestBody)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	documents := make([]string, 0, len(request.Documents))
	for _, document := range request.Documents {
		documents = append(documents, fmt.Sprintf("%v", document))
	}
	return DeepInfraRerankRequest{
		Queries:   []string{request.Query},
		Documents: documents,
	}, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case constant.RelayModeRerank:
		usage, err = deepinfraRerankHandler(c, info, resp)
	default:
		adaptor := openai.Adaptor{}
		usage, err = adaptor.DoResponse(c, resp, info)
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
