package huawei

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

// GetRequestURL routes each relay mode to its Huawei MaaS endpoint.
//
// The client relay format is resolved before the relay mode because
// /v1/messages requests never populate a relay mode, so a mode-only switch
// cannot route them. Claude requests pass through natively to the
// Anthropic-compatible endpoint. Gemini and OpenAI Responses requests are
// downgraded to chat completions and therefore reuse the OpenAI-compatible
// endpoint: MaaS serves no Responses endpoint at all. Embeddings, rerank and
// images use the MaaS native v1 paths.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	var path string
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		path = "/anthropic/v1/messages"
	case types.RelayFormatGemini, types.RelayFormatOpenAIResponses:
		path = "/openai/v1/chat/completions"
	default:
		switch info.RelayMode {
		case relayconstant.RelayModeChatCompletions:
			path = "/openai/v1/chat/completions"
		case relayconstant.RelayModeCompletions:
			path = "/openai/v1/completions"
		case relayconstant.RelayModeEmbeddings:
			path = "/v1/embeddings"
		case relayconstant.RelayModeRerank:
			path = "/v1/rerank"
		case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
			path = "/v1/images/generations"
		default:
			return "", fmt.Errorf("huawei MaaS does not support relay mode %d", info.RelayMode)
		}
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, path, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	req.Set("Content-Type", "application/json")

	if info.RelayFormat == types.RelayFormatClaude {
		// The Anthropic-compatible endpoint authenticates with x-api-key
		// rather than a Bearer token.
		req.Set("x-api-key", info.ApiKey)
		anthropicVersion := c.Request.Header.Get("anthropic-version")
		if anthropicVersion == "" {
			anthropicVersion = "2023-06-01"
		}
		req.Set("anthropic-version", anthropicVersion)
		claude.CommonClaudeHeadersOperation(c, req, info)
		return nil
	}
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return request, nil
}

// ConvertOpenAIResponsesRequest downgrades OpenAI Responses requests to chat
// completions. MaaS exposes no Responses endpoint, so this conversion is the
// only way to serve /v1/responses on this channel.
func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return a.downgradeToChatCompletions(c, info, &request)
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return &MaaSRerankRequest{
		Model:     request.Model,
		Query:     request.Query,
		Documents: request.Documents,
	}, nil
}

// ConvertClaudeRequest passes Anthropic Messages requests through natively.
// MaaS terminates the Anthropic protocol itself, so the request is forwarded
// unchanged and no chat-completions hop can drop thinking or tool fields.
func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	adaptor := claude.Adaptor{}
	return adaptor.ConvertClaudeRequest(c, info, request)
}

// ConvertGeminiRequest downgrades Gemini generateContent requests to chat
// completions, the only chat protocol MaaS serves besides the
// Anthropic-compatible endpoint.
func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return a.downgradeToChatCompletions(c, info, request)
}

// downgradeToChatCompletions runs the registered conversion into the OpenAI
// chat completions format and funnels the result through ConvertOpenAIRequest,
// mirroring how the OpenAI adaptor serves Gemini and Claude clients.
func (a *Adaptor) downgradeToChatCompletions(c *gin.Context, info *relaycommon.RelayInfo, request any) (any, error) {
	result, err := service.ConvertRequest(c, info, types.RelayFormatOpenAI, request)
	if err != nil {
		return nil, err
	}
	chatRequest, ok := result.Value.(*dto.GeneralOpenAIRequest)
	if !ok {
		return nil, fmt.Errorf("expected OpenAI chat completions request, got %T", result.Value)
	}
	return a.ConvertOpenAIRequest(c, info, chatRequest)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("endpoint not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		return convertGenerationRequest(request)
	case relayconstant.RelayModeImagesEdits:
		return convertEditRequest(c, request)
	}
	return nil, fmt.Errorf("unsupported image relay mode: %d", info.RelayMode)
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		// The request was forwarded natively, so the upstream body is already
		// shaped as Anthropic Messages.
		adaptor := claude.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	case types.RelayFormatOpenAIResponses:
		// The upstream body is chat completions and must be lifted back into
		// the Responses shape; the generic OpenAI handler does not do that.
		if info.IsStream {
			return openai.OaiChatToResponsesStreamHandler(c, info, resp)
		}
		return openai.OaiChatToResponsesHandler(c, info, resp)
	}

	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		usage, err = huaweiImageHandler(c, info, resp)
	case relayconstant.RelayModeRerank:
		usage, err = huaweiRerankHandler(c, info, resp)
	default:
		// Chat completions, plus the Gemini client format that the OpenAI
		// handler converts back according to info.RelayFormat.
		adaptor := openai.Adaptor{}
		usage, err = adaptor.DoResponse(c, resp, info)
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
