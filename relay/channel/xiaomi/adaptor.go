package xiaomi

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"

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
	audioFormat string
}

type xiaomiTTSMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type xiaomiTTSAudio struct {
	Voice  string `json:"voice,omitempty"`
	Format string `json:"format"`
}

type xiaomiTTSRequest struct {
	Model    string             `json:"model"`
	Messages []xiaomiTTSMessage `json:"messages"`
	Audio    xiaomiTTSAudio     `json:"audio"`
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	req.Set("api-key", info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	if info.RelayMode != constant.RelayModeAudioSpeech {
		return nil, errors.New("unsupported audio relay mode")
	}
	audioFormat := normalizeMimoAudioFormat(request.ResponseFormat)
	voice := request.Voice
	if shouldDefaultMimoVoice(request.Model) && voice == "" {
		voice = "mimo_default"
	}
	mimoReq := xiaomiTTSRequest{
		Model:    request.Model,
		Messages: buildMimoTTSMessages(request),
		Audio:    xiaomiTTSAudio{Voice: voice, Format: audioFormat},
	}
	if isMimoVoiceDesignModel(request.Model) {
		mimoReq.Audio.Voice = ""
	}
	a.audioFormat = audioFormat
	jsonData, err := common.Marshal(mimoReq)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(jsonData), nil
}

func buildMimoTTSMessages(request dto.AudioRequest) []xiaomiTTSMessage {
	messages := make([]xiaomiTTSMessage, 0, 2)
	if request.Instructions != "" {
		messages = append(messages, xiaomiTTSMessage{
			Role:    "user",
			Content: request.Instructions,
		})
	}
	messages = append(messages, xiaomiTTSMessage{
		Role:    "assistant",
		Content: request.Input,
	})
	return messages
}

func normalizeMimoAudioFormat(format string) string {
	switch format {
	case "":
		return "wav"
	case "pcm":
		return "pcm16"
	default:
		return format
	}
}

func shouldDefaultMimoVoice(model string) bool {
	return !isMimoVoiceDesignModel(model)
}

func isMimoVoiceDesignModel(model string) bool {
	return model == "mimo-v2.5-tts-voicedesign"
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode == constant.RelayModeAudioSpeech {
		return handleTTSResponse(c, resp, info, a.audioFormat)
	}
	adaptor := openai.Adaptor{}
	return adaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
