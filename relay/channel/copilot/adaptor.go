package copilot

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	APIEndpoint        = "https://api.githubcopilot.com"
	chatCompletionsURL = APIEndpoint + "/chat/completions"
	userAgent          = "GitHubCopilotChat/0.32.4"
	editorVersion      = "vscode/1.105.1"
	editorPlugin       = "copilot-chat/0.32.4"
	integrationID      = "vscode-chat"
)

var (
	errUnsupportedEndpoint = errors.New("copilot channel: endpoint not supported")
	resolveAccessToken     = service.ResolveCopilotAccessToken
)

// Adaptor implements only the verified OpenAI-compatible Chat Completions
// surface exposed by the official GitHub Copilot API.
type Adaptor struct {
	openai.Adaptor
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.Adaptor.Init(info)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info == nil || info.RelayMode != relayconstant.RelayModeChatCompletions {
		return "", errUnsupportedEndpoint
	}
	return chatCompletionsURL, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	if c == nil || c.Request == nil || info == nil || info.ChannelMeta == nil {
		return errors.New("copilot channel: invalid relay context")
	}
	if info.RelayMode != relayconstant.RelayModeChatCompletions {
		return errUnsupportedEndpoint
	}

	token, err := resolveAccessToken(
		c.Request.Context(),
		info.ChannelId,
		info.ChannelMultiKeyIndex,
		info.ApiKey,
		info.ChannelSetting.Proxy,
	)
	if err != nil {
		return fmt.Errorf("copilot channel: authentication failed: %w", err)
	}

	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Authorization", "Bearer "+token)
	header.Set("Accept", "application/json")
	header.Set("User-Agent", userAgent)
	header.Set("Editor-Version", editorVersion)
	header.Set("Editor-Plugin-Version", editorPlugin)
	header.Set("Copilot-Integration-Id", integrationID)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if info == nil || info.RelayMode != relayconstant.RelayModeChatCompletions {
		return nil, errUnsupportedEndpoint
	}
	return a.Adaptor.ConvertOpenAIRequest(c, info, request)
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info == nil || info.RelayMode != relayconstant.RelayModeChatCompletions {
		return nil, errUnsupportedEndpoint
	}
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if info == nil || info.RelayMode != relayconstant.RelayModeChatCompletions {
		return nil, types.NewError(errUnsupportedEndpoint, types.ErrorCodeInvalidRequest)
	}
	if info.IsStream {
		return openai.OaiStreamHandler(c, info, resp)
	}
	return openai.OpenaiHandler(c, info, resp)
}

func (a *Adaptor) GetModelList() []string { return nil }

func (a *Adaptor) GetChannelName() string { return "copilot" }

func (a *Adaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}

func (a *Adaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}

func (a *Adaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, errUnsupportedEndpoint
}

func (a *Adaptor) ConvertImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(*gin.Context, *relaycommon.RelayInfo, dto.OpenAIResponsesRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
