package multiendpoint

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	openai openai.Adaptor
	claude claude.Adaptor
	gemini gemini.Adaptor
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.openai.Init(info)
	a.claude.Init(info)
	a.gemini.Init(info)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	resolved, err := common.ResolveMultiEndpointRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.UpstreamModelName)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(resolved) == "" {
		return "", fmt.Errorf("多端点渠道 base_url 未配置或未匹配当前端点")
	}

	info.ChannelBaseUrl = resolved
	if info.ChannelMeta != nil {
		info.ChannelMeta.ChannelBaseUrl = resolved
	}

	return resolved, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		return a.claude.SetupRequestHeader(c, header, info)
	case types.RelayFormatGemini:
		return a.gemini.SetupRequestHeader(c, header, info)
	default:
		if err := a.openai.SetupRequestHeader(c, header, info); err != nil {
			return err
		}
		if info.Organization != "" {
			header.Set("OpenAI-Organization", info.Organization)
		}
		return nil
	}
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return a.openai.ConvertOpenAIRequest(c, info, request)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return a.openai.ConvertRerankRequest(c, relayMode, request)
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	if info.RelayFormat == types.RelayFormatGemini {
		return a.gemini.ConvertEmbeddingRequest(c, info, request)
	}
	return a.openai.ConvertEmbeddingRequest(c, info, request)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return a.openai.ConvertAudioRequest(c, info, request)
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return a.openai.ConvertImageRequest(c, info, request)
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return a.openai.ConvertOpenAIResponsesRequest(c, info, request)
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info.RelayMode == relayconstant.RelayModeAudioTranscription ||
		info.RelayMode == relayconstant.RelayModeAudioTranslation ||
		info.RelayMode == relayconstant.RelayModeImagesEdits {
		return channel.DoFormRequest(a, c, info, requestBody)
	}
	if info.RelayMode == relayconstant.RelayModeRealtime {
		return channel.DoWssRequest(a, c, info, requestBody)
	}
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		return a.claude.DoResponse(c, resp, info)
	case types.RelayFormatGemini:
		return a.gemini.DoResponse(c, resp, info)
	default:
		return a.openai.DoResponse(c, resp, info)
	}
}

func (a *Adaptor) GetModelList() []string {
	return a.openai.GetModelList()
}

func (a *Adaptor) GetChannelName() string {
	return "multi_endpoint"
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return a.claude.ConvertClaudeRequest(c, info, request)
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return a.gemini.ConvertGeminiRequest(c, info, request)
}
