package ali

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/dto"
	"one-api/relay/channel"
	"one-api/relay/channel/openai"
	relaycommon "one-api/relay/common"
	"one-api/relay/constant"
	"one-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	imageProcessMode *ImageProcessMode
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	//TODO implement me
	panic("implement me")
	return nil, nil
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.imageProcessMode = selectImageProcessMode(info)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	var fullRequestURL string
	switch info.RelayMode {
	case constant.RelayModeEmbeddings:
		fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/embeddings", info.BaseUrl)
	case constant.RelayModeRerank:
		fullRequestURL = fmt.Sprintf("%s/api/v1/services/rerank/text-rerank/text-rerank", info.BaseUrl)
	case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
		{
			if a.imageProcessMode != nil {
				urlSuffix := a.imageProcessMode.Url
				fullRequestURL = fmt.Sprintf("%s%s", info.BaseUrl, urlSuffix)
			} else {
				fullRequestURL = fmt.Sprintf("%s/api/v1/services/aigc/text2image/image-synthesis", info.BaseUrl)
			}
		}
	case constant.RelayModeCompletions:
		fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/completions", info.BaseUrl)
	default:
		fullRequestURL = fmt.Sprintf("%s/compatible-mode/v1/chat/completions", info.BaseUrl)
	}
	return fullRequestURL, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Content-Type", "application/json")
	req.Set("Authorization", "Bearer "+info.ApiKey)
	if info.IsStream {
		req.Set("X-DashScope-SSE", "enable")
	}
	if c.GetString("plugin") != "" {
		req.Set("X-DashScope-Plugin", c.GetString("plugin"))
	}
	if a.imageProcessMode != nil && a.imageProcessMode.Async {
		req.Set("X-DashScope-Async", "enable")
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	// fix: ali parameter.enable_thinking must be set to false for non-streaming calls
	if !info.IsStream {
		request.EnableThinking = false
	}

	switch info.RelayMode {
	default:
		aliReq := requestOpenAI2Ali(*request)
		return aliReq, nil
	}
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	aliRequest, err := oaiImage2Ali(a, c, info, request)
	if err != nil {
		return nil, err
	}

	return aliRequest, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return ConvertRerankRequest(request), nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
		err, usage = aliImageHandler(a, c, resp, info)
	case constant.RelayModeEmbeddings:
		err, usage = aliEmbeddingHandler(c, resp)
	case constant.RelayModeRerank:
		err, usage = RerankHandler(c, resp, info)
	default:
		if info.IsStream {
			usage, err = openai.OaiStreamHandler(c, info, resp)
		} else {
			usage, err = openai.OpenaiHandler(c, info, resp)
		}
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
