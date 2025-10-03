package ollama

import (
	"errors"
	"io"
	"net/http"
	"one-api/dto"
	"one-api/relay/channel"
	"one-api/relay/channel/openai"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	openaiAdaptor := openai.Adaptor{}
	openaiRequest, err := openaiAdaptor.ConvertClaudeRequest(c, info, request)
	if err != nil {
		return nil, err
	}
	openaiRequest.(*dto.GeneralOpenAIRequest).StreamOptions = &dto.StreamOptions{
		IncludeUsage: true,
	}
	// map to ollama chat request (Claude -> OpenAI -> Ollama chat)
	return openAIChatToOllamaChat(c, openaiRequest.(*dto.GeneralOpenAIRequest))
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode == relayconstant.RelayModeEmbeddings {
		return info.ChannelBaseUrl + "/api/embed", nil
	}
	if strings.Contains(info.RequestURLPath, "/v1/completions") || info.RelayMode == relayconstant.RelayModeCompletions {
		return info.ChannelBaseUrl + "/api/generate", nil
	}
	return info.ChannelBaseUrl + "/api/chat", nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	// decide generate or chat
	if strings.Contains(info.RequestURLPath, "/v1/completions") || info.RelayMode == relayconstant.RelayModeCompletions {
		return openAIToGenerate(c, request)
	}
	return openAIChatToOllamaChat(c, request)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return requestOpenAI2Embeddings(request), nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case relayconstant.RelayModeEmbeddings:
		return ollamaEmbeddingHandler(c, info, resp)
	default:
		if info.IsStream {
			return ollamaStreamHandler(c, info, resp)
		}
		return ollamaChatHandler(c, info, resp)
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
