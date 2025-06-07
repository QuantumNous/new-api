package huggingface

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/dto"
	"one-api/relay/channel"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// For rerank requests, use /rerank endpoint
	if info.RelayMode == relayconstant.RelayModeRerank {
		return fmt.Sprintf("%s/rerank", info.BaseUrl), nil
	}
	// For embedding requests, use /embed endpoint
	if info.RelayMode == relayconstant.RelayModeEmbeddings {
		return fmt.Sprintf("%s/embed", info.BaseUrl), nil
	}
	return "", errors.New("unsupported relay mode for HuggingFace TEI")
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Content-Type", "application/json")
	
	// Add authorization header if API key is provided
	if info.ApiKey != "" {
		req.Set("Authorization", "Bearer "+info.ApiKey)
	}
	
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	// HuggingFace TEI doesn't support chat completions
	return nil, errors.New("HuggingFace TEI does not support chat completions")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return requestConvertRerank2HuggingFace(request), nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return requestConvertEmbedding2HuggingFace(request), nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("HuggingFace TEI does not support audio requests")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("HuggingFace TEI does not support image requests")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("HuggingFace TEI does not support Claude requests")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("HuggingFace TEI does not support responses requests")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *dto.OpenAIErrorWithStatusCode) {
	if info.RelayMode == relayconstant.RelayModeRerank {
		err, usage = huggingFaceRerankHandler(c, resp, info)
	} else if info.RelayMode == relayconstant.RelayModeEmbeddings {
		err, usage = huggingFaceEmbeddingHandler(c, resp, info)
	} else {
		err = &dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "unsupported relay mode for HuggingFace TEI",
				Type:    "invalid_request_error",
			},
			StatusCode: http.StatusBadRequest,
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
