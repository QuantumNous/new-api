package copilot

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	APIEndpoint        = "https://api.githubcopilot.com"
	chatCompletionsURL = APIEndpoint + "/chat/completions"
	claudeMessagesURL  = APIEndpoint + "/v1/messages"
	userAgent          = "opencode/0.4.2"
	githubAPIVersion   = "2026-06-01"
	openAIIntent       = "conversation-edits"
)

var (
	errUnsupportedEndpoint = errors.New("copilot channel: endpoint not supported")
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
	if info == nil {
		return "", errUnsupportedEndpoint
	}
	if info.RelayFormat == types.RelayFormatClaude {
		return claudeMessagesURL, nil
	}
	if info.RelayMode != relayconstant.RelayModeChatCompletions {
		return "", errUnsupportedEndpoint
	}
	return chatCompletionsURL, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	if c == nil || c.Request == nil || info == nil || info.ChannelMeta == nil {
		return errors.New("copilot channel: invalid relay context")
	}
	if info.RelayFormat != types.RelayFormatClaude && info.RelayMode != relayconstant.RelayModeChatCompletions {
		return errUnsupportedEndpoint
	}

	credential := strings.TrimSpace(info.ApiKey)
	if !strings.HasPrefix(credential, "gho_") {
		return errors.New("copilot channel: OAuth Device Flow credential is missing")
	}

	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Authorization", "Bearer "+credential)
	if info.RelayFormat == types.RelayFormatClaude {
		if info.IsStream {
			header.Set("Accept", "text/event-stream")
		} else {
			header.Set("Accept", "application/json")
		}
		header.Set("anthropic-version", "2023-06-01")
	} else {
		header.Set("Accept", "application/json")
	}
	header.Set("User-Agent", userAgent)
	header.Set("Openai-Intent", openAIIntent)
	header.Set("X-GitHub-Api-Version", githubAPIVersion)
	header.Set("x-initiator", "user")
	header.Set("X-Request-Id", common.GetUUID())
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if info == nil || info.RelayMode != relayconstant.RelayModeChatCompletions {
		return nil, errUnsupportedEndpoint
	}
	return a.Adaptor.ConvertOpenAIRequest(c, info, request)
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info == nil || (info.RelayFormat != types.RelayFormatClaude && info.RelayMode != relayconstant.RelayModeChatCompletions) {
		return nil, errUnsupportedEndpoint
	}
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if info == nil || (info.RelayFormat != types.RelayFormatClaude && info.RelayMode != relayconstant.RelayModeChatCompletions) {
		return nil, types.NewError(errUnsupportedEndpoint, types.ErrorCodeInvalidRequest)
	}
	if info.RelayFormat == types.RelayFormatClaude {
		info.FinalRequestRelayFormat = types.RelayFormatClaude
		if info.IsStream {
			return claude.ClaudeStreamHandler(c, resp, info)
		}
		return claude.ClaudeHandler(c, resp, info)
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

func (a *Adaptor) ConvertClaudeRequest(_ *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if info == nil || info.RelayFormat != types.RelayFormatClaude || request == nil {
		return nil, errUnsupportedEndpoint
	}
	return request, nil
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errUnsupportedEndpoint
}
