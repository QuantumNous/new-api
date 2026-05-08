package volcadapter

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	channelconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	taskvolcadapter "github.com/QuantumNous/new-api/relay/channel/task/volcadapter"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// Adaptor handles ChannelTypeVolcAdapter (58): Volc-native image endpoints only.
// It only supports the /api/v3/images/generations endpoint; all other relay
// modes return a clear "not supported" error directing users to the volcengine
// channel for OpenAI-format requests.
type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseUrl := info.ChannelBaseUrl
	if baseUrl == "" {
		baseUrl = channelconstant.ChannelBaseURLs[channelconstant.ChannelTypeVolcAdapter]
	}
	switch info.RelayMode {
	case constant.RelayModeImagesGenerations, constant.RelayModeImagesEdits:
		return fmt.Sprintf("%s/api/v3/images/generations", baseUrl), nil
	default:
		return "", fmt.Errorf("volcadapter does not support relay mode %d; for OpenAI-format requests use the volcengine channel", info.RelayMode)
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

// ConvertOpenAIRequest is not supported; volcadapter only accepts Volc-native format.
func (a *Adaptor) ConvertOpenAIRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("volcadapter only supports Volc-native API; use the volcengine channel for OpenAI-format requests")
}

func (a *Adaptor) ConvertRerankRequest(_ *gin.Context, _ int, _ dto.RerankRequest) (any, error) {
	return nil, errors.New("volcadapter does not support rerank; use the volcengine channel instead")
}

func (a *Adaptor) ConvertEmbeddingRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("volcadapter does not support embeddings; use the volcengine channel instead")
}

func (a *Adaptor) ConvertAudioRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("volcadapter does not support audio; use the volcengine channel instead")
}

func (a *Adaptor) ConvertImageRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.ImageRequest) (any, error) {
	return nil, errors.New("volcadapter only supports Volc-native image format; use ConvertVolcRequest path")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("volcadapter does not support responses API; use the volcengine channel instead")
}

func (a *Adaptor) ConvertClaudeRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("volcadapter does not support Claude format; use the volcengine channel instead")
}

func (a *Adaptor) ConvertGeminiRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("volcadapter does not support Gemini format; use the volcengine channel instead")
}

// ConvertVolcRequest is a no-op pass-through required by relay/volc_handler.go's
// volcImageConverter interface. The request body is already in Volc-native format.
func (a *Adaptor) ConvertVolcRequest(_ *gin.Context, _ *relaycommon.RelayInfo, request *dto.VolcImageRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	// Volc image responses are OpenAI-compatible; delegate to openai.Adaptor.DoResponse.
	adaptor := openai.Adaptor{}
	return adaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	// Reuse the task volcadapter model list — both route to the same Volc native endpoints.
	return taskvolcadapter.ModelList
}

func (a *Adaptor) GetChannelName() string { return "volcadapter" }
