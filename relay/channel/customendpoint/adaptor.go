package customendpoint

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/cohere"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/jina"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const ChannelName = "CustomEndpoint"

type Adaptor struct {
	routePath      string
	route          dto.CustomEndpointRoute
	initErr        error
	responseFormat string
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	if info == nil || info.ChannelMeta == nil {
		a.initErr = errors.New("missing channel metadata")
		return
	}

	routePath, kind, route, err := resolveRoute(info)
	if err != nil {
		a.initErr = err
		return
	}
	if err := route.Validate(routePath); err != nil {
		a.initErr = err
		return
	}
	if !isTransformerAllowed(kind, route.Transformer) {
		a.initErr = fmt.Errorf("custom endpoint route %s does not support transformer %s", routePath, route.Transformer)
		return
	}

	a.routePath = routePath
	a.route = route
	a.initErr = nil
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if err := a.ensureRoute(info); err != nil {
		return "", err
	}
	model := ""
	if info != nil {
		model = info.UpstreamModelName
	}
	return strings.ReplaceAll(a.route.Path, "{model}", model), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	if err := a.ensureRoute(info); err != nil {
		return err
	}

	channel.SetupApiRequestHeader(info, c, header)

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerClaudeMessages:
		header.Set("x-api-key", info.ApiKey)
		anthropicVersion := c.Request.Header.Get("anthropic-version")
		if anthropicVersion == "" {
			anthropicVersion = "2023-06-01"
		}
		header.Set("anthropic-version", anthropicVersion)
		claude.CommonClaudeHeadersOperation(c, header, info)
	case dto.CustomEndpointTransformerGeminiGenerateContent,
		dto.CustomEndpointTransformerGeminiEmbeddings,
		dto.CustomEndpointTransformerGeminiImage:
		header.Set("x-goog-api-key", info.ApiKey)
	default:
		header.Set("Authorization", "Bearer "+info.ApiKey)
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if err := a.ensureRoute(info); err != nil {
		return nil, err
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerOpenAIChatCompletions,
		dto.CustomEndpointTransformerOpenAICompletions,
		dto.CustomEndpointTransformerOpenAIModerations:
		return a.convertOpenAICompatibleRequest(c, info, request)
	case dto.CustomEndpointTransformerClaudeMessages:
		return (&claude.Adaptor{}).ConvertOpenAIRequest(c, info, request)
	case dto.CustomEndpointTransformerGeminiGenerateContent:
		return (&gemini.Adaptor{}).ConvertOpenAIRequest(c, info, request)
	case dto.CustomEndpointTransformerOpenAIResponses:
		return service.ChatCompletionsRequestToResponsesRequest(request)
	default:
		return nil, unsupportedTransformer(a.routePath, a.route.Transformer)
	}
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if err := a.ensureRoute(info); err != nil {
		return nil, err
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerClaudeMessages:
		return (&claude.Adaptor{}).ConvertClaudeRequest(c, info, request)
	case dto.CustomEndpointTransformerOpenAIChatCompletions:
		return a.convertClaudeToOpenAIRequest(c, info, request)
	case dto.CustomEndpointTransformerGeminiGenerateContent:
		return (&gemini.Adaptor{}).ConvertClaudeRequest(c, info, request)
	default:
		return nil, unsupportedTransformer(a.routePath, a.route.Transformer)
	}
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	if err := a.ensureRoute(info); err != nil {
		return nil, err
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerGeminiGenerateContent:
		return (&gemini.Adaptor{}).ConvertGeminiRequest(c, info, request)
	case dto.CustomEndpointTransformerOpenAIChatCompletions:
		return a.convertGeminiToOpenAIRequest(c, info, request)
	default:
		return nil, unsupportedTransformer(a.routePath, a.route.Transformer)
	}
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	if err := a.ensureRoute(info); err != nil {
		return nil, err
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerOpenAIResponses,
		dto.CustomEndpointTransformerOpenAIResponsesCompact:
		return (&openai.Adaptor{}).ConvertOpenAIResponsesRequest(c, info, request)
	default:
		return nil, unsupportedTransformer(a.routePath, a.route.Transformer)
	}
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	if err := a.ensureRoute(info); err != nil {
		return nil, err
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerOpenAIEmbeddings:
		return (&openai.Adaptor{}).ConvertEmbeddingRequest(c, info, request)
	case dto.CustomEndpointTransformerGeminiEmbeddings:
		return (&gemini.Adaptor{}).ConvertEmbeddingRequest(c, info, request)
	default:
		return nil, unsupportedTransformer(a.routePath, a.route.Transformer)
	}
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if err := a.ensureRoute(info); err != nil {
		return nil, err
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerOpenAIImages:
		return (&openai.Adaptor{}).ConvertImageRequest(c, info, request)
	case dto.CustomEndpointTransformerGeminiImage:
		return (&gemini.Adaptor{}).ConvertImageRequest(c, info, request)
	default:
		return nil, unsupportedTransformer(a.routePath, a.route.Transformer)
	}
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	if err := a.ensureRoute(info); err != nil {
		return nil, err
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerOpenAIAudio:
		a.responseFormat = request.ResponseFormat
		return (&openai.Adaptor{}).ConvertAudioRequest(c, info, request)
	default:
		return nil, unsupportedTransformer(a.routePath, a.route.Transformer)
	}
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	if err := a.ensureRoute(nil); err != nil {
		return nil, err
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerJinaRerank:
		return (&jina.Adaptor{}).ConvertRerankRequest(c, relayMode, request)
	case dto.CustomEndpointTransformerCohereRerank:
		return (&cohere.Adaptor{}).ConvertRerankRequest(c, relayMode, request)
	default:
		return nil, unsupportedTransformer(a.routePath, a.route.Transformer)
	}
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if err := a.ensureRoute(info); err != nil {
		return nil, err
	}
	if info.RelayMode == relayconstant.RelayModeAudioTranscription ||
		info.RelayMode == relayconstant.RelayModeAudioTranslation ||
		(info.RelayMode == relayconstant.RelayModeImagesEdits && !isJSONRequest(c)) {
		return channel.DoFormRequest(a, c, info, requestBody)
	}
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if err := a.ensureRoute(info); err != nil {
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	switch a.route.Transformer {
	case dto.CustomEndpointTransformerClaudeMessages:
		return (&claude.Adaptor{}).DoResponse(c, resp, info)
	case dto.CustomEndpointTransformerGeminiGenerateContent,
		dto.CustomEndpointTransformerGeminiEmbeddings,
		dto.CustomEndpointTransformerGeminiImage:
		return (&gemini.Adaptor{}).DoResponse(c, resp, info)
	case dto.CustomEndpointTransformerJinaRerank:
		return (&jina.Adaptor{}).DoResponse(c, resp, info)
	case dto.CustomEndpointTransformerCohereRerank:
		return (&cohere.Adaptor{}).DoResponse(c, resp, info)
	case dto.CustomEndpointTransformerOpenAIResponses:
		if info.RelayFormat != types.RelayFormatOpenAIResponses {
			if info.IsStream {
				return openai.OaiResponsesToChatStreamHandler(c, info, resp)
			}
			return openai.OaiResponsesToChatHandler(c, info, resp)
		}
	}

	return (&openai.Adaptor{ResponseFormat: a.responseFormat}).DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return nil
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) ensureRoute(info *relaycommon.RelayInfo) error {
	if a.initErr != nil {
		return a.initErr
	}
	if a.route.Path != "" {
		return nil
	}
	if info != nil {
		a.Init(info)
		return a.initErr
	}
	return errors.New("custom endpoint route is not initialized")
}

func (a *Adaptor) convertOpenAICompatibleRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	converted, err := withOpenAIChannelType(info, func() (any, error) {
		return (&openai.Adaptor{}).ConvertOpenAIRequest(c, info, request)
	})
	if err != nil {
		return nil, err
	}
	if !a.route.SupportsStreamOptions() {
		if openAIRequest, ok := converted.(*dto.GeneralOpenAIRequest); ok {
			openAIRequest.StreamOptions = nil
		}
	}
	return converted, nil
}

func (a *Adaptor) convertClaudeToOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	converted, err := withOpenAIChannelType(info, func() (any, error) {
		return (&openai.Adaptor{}).ConvertClaudeRequest(c, info, request)
	})
	if err != nil {
		return nil, err
	}
	if !a.route.SupportsStreamOptions() {
		if openAIRequest, ok := converted.(*dto.GeneralOpenAIRequest); ok {
			openAIRequest.StreamOptions = nil
		}
	}
	return converted, nil
}

func (a *Adaptor) convertGeminiToOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	converted, err := withOpenAIChannelType(info, func() (any, error) {
		return (&openai.Adaptor{}).ConvertGeminiRequest(c, info, request)
	})
	if err != nil {
		return nil, err
	}
	if !a.route.SupportsStreamOptions() {
		if openAIRequest, ok := converted.(*dto.GeneralOpenAIRequest); ok {
			openAIRequest.StreamOptions = nil
		}
	}
	return converted, nil
}

func withOpenAIChannelType(info *relaycommon.RelayInfo, fn func() (any, error)) (any, error) {
	if info == nil || info.ChannelMeta == nil {
		return fn()
	}
	originalChannelType := info.ChannelType
	info.ChannelType = constant.ChannelTypeOpenAI
	defer func() {
		info.ChannelType = originalChannelType
	}()
	return fn()
}

func isJSONRequest(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	return strings.Contains(strings.ToLower(c.Request.Header.Get("Content-Type")), "application/json")
}
