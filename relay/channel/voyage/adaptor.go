package voyage

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

var errEmbeddingsAndRerankOnly = errors.New("Voyage AI channels serve embeddings and rerank only")

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errEmbeddingsAndRerankOnly
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errEmbeddingsAndRerankOnly
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errEmbeddingsAndRerankOnly
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errEmbeddingsAndRerankOnly
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errEmbeddingsAndRerankOnly
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errEmbeddingsAndRerankOnly
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	kind, err := modelKind(info.UpstreamModelName)
	if err != nil {
		return "", err
	}
	switch {
	case info.RelayMode == constant.RelayModeRerank && kind == KindRerank:
		return fmt.Sprintf("%s/v1/rerank", info.ChannelBaseUrl), nil
	case info.RelayMode == constant.RelayModeEmbeddings && kind == KindEmbedding:
		return fmt.Sprintf("%s/v1/embeddings", info.ChannelBaseUrl), nil
	case info.RelayMode == constant.RelayModeEmbeddings && kind == KindContextualizedEmbedding:
		return fmt.Sprintf("%s/v1/contextualizedembeddings", info.ChannelBaseUrl), nil
	case info.RelayMode == constant.RelayModeEmbeddings && kind == KindMultimodalEmbedding:
		return fmt.Sprintf("%s/v1/multimodalembeddings", info.ChannelBaseUrl), nil
	}
	return "", fmt.Errorf("Voyage model %s cannot be used for relay mode %d", info.UpstreamModelName, info.RelayMode)
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	return nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	converted, err := convertRerankRequest(request)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	return converted, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	converted, err := convertEmbeddingRequest(request)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	return converted, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	kind, kindErr := modelKind(info.UpstreamModelName)
	if kindErr != nil {
		return nil, types.NewError(kindErr, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	switch kind {
	case KindRerank:
		return rerankHandler(c, resp)
	case KindEmbedding:
		return embeddingHandler(c, resp)
	case KindContextualizedEmbedding:
		return contextualizedEmbeddingHandler(c, resp)
	case KindMultimodalEmbedding:
		return multimodalEmbeddingHandler(c, resp)
	}
	return nil, types.NewError(fmt.Errorf("unsupported Voyage model kind %d", kind), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
