// Package volcnative defines the channel metadata for Fire Ark's native API.
//
// Requests are relayed by the dedicated /api/v3 handlers. This adaptor exists
// so that channel type 61 has an explicit API type and can never silently fall
// back to an OpenAI-compatible adaptor.
package volcnative

import (
	"errors"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/relay/channel/task/volcnative"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct{}

func (a *Adaptor) Init(_ *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return "", errors.New("volc native channels only support /api/v3 fire ark endpoints")
}

func (a *Adaptor) SetupRequestHeader(_ *gin.Context, _ *http.Header, _ *relaycommon.RelayInfo) error {
	return errors.New("volc native request headers are handled by the native relay")
}

func (a *Adaptor) ConvertOpenAIRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("volc native channels do not accept OpenAI-compatible requests")
}

func (a *Adaptor) ConvertRerankRequest(_ *gin.Context, _ int, _ dto.RerankRequest) (any, error) {
	return nil, errors.New("volc native channels do not support rerank")
}

func (a *Adaptor) ConvertEmbeddingRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("volc native channels do not support embeddings")
}

func (a *Adaptor) ConvertAudioRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("volc native channels do not support audio")
}

func (a *Adaptor) ConvertImageRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.ImageRequest) (any, error) {
	return nil, errors.New("volc native image requests must use /api/v3/images/generations")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("volc native channels do not support the responses API")
}

func (a *Adaptor) ConvertClaudeRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("volc native channels do not accept Claude-compatible requests")
}

func (a *Adaptor) ConvertGeminiRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("volc native channels do not accept Gemini-compatible requests")
}

func (a *Adaptor) DoRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ io.Reader) (any, error) {
	return nil, errors.New("volc native requests are handled by the native relay")
}

func (a *Adaptor) DoResponse(_ *gin.Context, _ *http.Response, _ *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	return nil, types.NewError(errors.New("volc native responses are handled by the native relay"), types.ErrorCodeInvalidApiType)
}

func (a *Adaptor) GetModelList() []string { return volcnative.ModelList }

func (a *Adaptor) GetChannelName() string { return "volc-native" }
