package advancedcustom

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

const ChannelName = "advanced_custom"

const advancedCustomModelPlaceholder = "{model}"

type Adaptor struct {
	openaiAdaptor openai.Adaptor
	claudeAdaptor claude.Adaptor
	geminiAdaptor gemini.Adaptor

	resolved  bool
	converted bool
	route     dto.AdvancedCustomRoute
	target    string
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.openaiAdaptor.Init(info)
	a.claudeAdaptor.Init(info)
	a.geminiAdaptor.Init(info)
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return a.convertToRouteNative(c, info, request)
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return a.convertToRouteNative(c, info, request)
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return a.convertToRouteNative(c, info, request)
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return a.convertToRouteNative(c, info, &request)
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	if err := a.requireNativeTarget(c, info, "embedding"); err != nil {
		return nil, err
	}
	return a.convertOpenAICompatibleEmbeddingRequest(c, info, request)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	if err := a.requireNativeTarget(c, info, "audio"); err != nil {
		return nil, err
	}
	return a.convertOpenAICompatibleAudioRequest(c, info, request)
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if err := a.requireNativeTarget(c, info, "image"); err != nil {
		return nil, err
	}
	return a.convertOpenAICompatibleImageRequest(c, info, request)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	a.converted = true
	return a.openaiAdaptor.ConvertRerankRequest(c, relayMode, request)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if err := a.resolve(nil, info); err != nil {
		return "", err
	}
	return a.routeURL(info)
}

func (a *Adaptor) BuildModelListRequest(info *relaycommon.RelayInfo) (string, http.Header, error) {
	return a.buildManagementRequest(info, dto.AdvancedCustomModelListPath)
}

func (a *Adaptor) BuildBalanceRequest(info *relaycommon.RelayInfo) (string, http.Header, error) {
	return a.buildManagementRequest(info, dto.AdvancedCustomBalancePath)
}

func (a *Adaptor) buildManagementRequest(info *relaycommon.RelayInfo, managementPath string) (string, http.Header, error) {
	if info == nil {
		return "", nil, errors.New("missing relay info")
	}
	config := info.ChannelOtherSettings.AdvancedCustom
	if config == nil {
		return "", nil, errors.New("advanced_custom is required")
	}
	if err := config.Validate(); err != nil {
		return "", nil, err
	}
	var route dto.AdvancedCustomRoute
	var ok bool
	switch managementPath {
	case dto.AdvancedCustomModelListPath:
		route, ok = config.ModelListRoute()
	case dto.AdvancedCustomBalancePath:
		route, ok = config.BalanceRoute()
	default:
		return "", nil, fmt.Errorf("unsupported advanced custom management path: %s", managementPath)
	}
	if !ok {
		return "", nil, fmt.Errorf("advanced custom channel does not configure a %s route", managementPath)
	}
	target := route.ResolvedTarget()
	if target != dto.AdvancedCustomTargetNative {
		return "", nil, fmt.Errorf("target %q does not support %s requests", target, managementPath)
	}

	requestURL, err := buildRouteURL(route, target, info)
	if err != nil {
		return "", nil, err
	}

	header := http.Header{}
	auth := route.Auth
	if auth == nil {
		header.Set("Authorization", "Bearer "+info.ApiKey)
		return requestURL, header, nil
	}

	switch strings.TrimSpace(auth.Type) {
	case dto.AdvancedCustomAuthTypeNone, dto.AdvancedCustomAuthTypeQuery:
	case dto.AdvancedCustomAuthTypeHeader:
		header.Set(strings.TrimSpace(auth.Name), applyAuthTemplate(auth.Value, info.ApiKey))
	default:
		return "", nil, fmt.Errorf("invalid advanced custom auth type: %s", auth.Type)
	}
	return requestURL, header, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	if err := a.resolve(c, info); err != nil {
		return err
	}

	channel.SetupApiRequestHeader(info, c, header)
	auth := a.route.Auth
	if auth == nil {
		header.Set("Authorization", "Bearer "+info.ApiKey)
	} else {
		switch strings.TrimSpace(auth.Type) {
		case dto.AdvancedCustomAuthTypeNone:
		case dto.AdvancedCustomAuthTypeHeader:
			header.Set(strings.TrimSpace(auth.Name), applyAuthTemplate(auth.Value, info.ApiKey))
		case dto.AdvancedCustomAuthTypeQuery:
		default:
			return fmt.Errorf("invalid advanced custom auth type: %s", auth.Type)
		}
	}

	if shouldApplyClaudeHeaders(a.target, info) {
		applyClaudeHeaders(c, header, info)
	}

	return nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if err := a.resolve(c, info); err != nil {
		return nil, err
	}
	if !a.converted && a.target != dto.AdvancedCustomTargetNative {
		return nil, errors.New("advanced custom converter routes cannot be used with pass-through request body")
	}

	if info.RelayMode == relayconstant.RelayModeAudioTranscription ||
		info.RelayMode == relayconstant.RelayModeAudioTranslation ||
		(info.RelayMode == relayconstant.RelayModeImagesEdits && !isJSONRequest(c)) {
		return channel.DoFormRequest(a, c, info, requestBody)
	}
	if info.RelayMode == relayconstant.RelayModeRealtime {
		return channel.DoWssRequest(a, c, info, requestBody)
	}
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if err := a.resolve(c, info); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	client := types.RelayFormatOpenAI
	if info != nil && info.RelayFormat != "" {
		client = info.RelayFormat
	}
	switch dto.AdvancedCustomTargetFormat(a.target, client) {
	case types.RelayFormatClaude:
		return a.claudeAdaptor.DoResponse(c, resp, info)
	case types.RelayFormatGemini:
		return a.geminiAdaptor.DoResponse(c, resp, info)
	case types.RelayFormatOpenAIResponses:
		if client == types.RelayFormatOpenAIResponses {
			return a.openaiAdaptor.DoResponse(c, resp, info)
		}
		if info != nil && info.IsStream {
			return openai.OaiResponsesToChatStreamHandler(c, info, resp)
		}
		if resp != nil && relaycommon.IsEventStreamContentType(resp.Header.Get("Content-Type")) {
			return openai.OaiResponsesToChatBufferedStreamHandler(c, info, resp)
		}
		return openai.OaiResponsesToChatHandler(c, info, resp)
	default:
		if client == types.RelayFormatOpenAIResponses {
			if info != nil && info.IsStream {
				return openai.OaiChatToResponsesStreamHandler(c, info, resp)
			}
			return openai.OaiChatToResponsesHandler(c, info, resp)
		}
		return a.openaiAdaptor.DoResponse(c, resp, info)
	}
}

func (a *Adaptor) GetModelList() []string {
	models := make([]string, 0, len(openai.ModelList)+len(claude.ModelList)+len(gemini.ModelList))
	models = append(models, openai.ModelList...)
	models = append(models, claude.ModelList...)
	models = append(models, gemini.ModelList...)
	return lo.Uniq(models)
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) resolveForConversion(c *gin.Context, info *relaycommon.RelayInfo) error {
	if err := a.resolve(c, info); err != nil {
		return err
	}
	a.converted = true
	return nil
}

func (a *Adaptor) resolve(c *gin.Context, info *relaycommon.RelayInfo) error {
	if a.resolved {
		return nil
	}
	if info == nil {
		return errors.New("missing relay info")
	}
	config := info.ChannelOtherSettings.AdvancedCustom
	if config == nil {
		return errors.New("advanced_custom is required")
	}
	if err := config.Validate(); err != nil {
		return err
	}

	incomingPath := incomingRequestPath(c, info)
	route, ok := config.MatchPathForModel(incomingPath, info.OriginModelName)
	if ok {
		a.route = route
		a.target = route.ResolvedTarget()
		a.resolved = true
		return nil
	}
	return fmt.Errorf("advanced custom channel does not support request path %s for model %s", incomingPath, info.OriginModelName)
}

func incomingRequestPath(c *gin.Context, info *relaycommon.RelayInfo) string {
	if c != nil && c.Request != nil && c.Request.URL != nil {
		return c.Request.URL.Path
	}
	if info == nil {
		return ""
	}
	return strings.Split(info.RequestURLPath, "?")[0]
}

func (a *Adaptor) routeURL(info *relaycommon.RelayInfo) (string, error) {
	return buildRouteURL(a.route, a.target, info)
}

func buildRouteURL(route dto.AdvancedCustomRoute, target string, info *relaycommon.RelayInfo) (string, error) {
	parsedURL, err := resolveUpstreamTargetURL(applyUpstreamPathTemplate(strings.TrimSpace(route.UpstreamPath), info), info)
	if err != nil {
		return "", err
	}
	if shouldUseGeminiStreamURL(target, info) {
		useGeminiStreamGenerateContentURL(parsedURL)
	}
	if info != nil && info.RelayMode == relayconstant.RelayModeRealtime {
		switch parsedURL.Scheme {
		case "https":
			parsedURL.Scheme = "wss"
		case "http":
			parsedURL.Scheme = "ws"
		}
	}
	if route.Auth != nil && strings.TrimSpace(route.Auth.Type) == dto.AdvancedCustomAuthTypeQuery {
		query := parsedURL.Query()
		query.Set(strings.TrimSpace(route.Auth.Name), applyAuthTemplate(route.Auth.Value, info.ApiKey))
		parsedURL.RawQuery = query.Encode()
	}
	return parsedURL.String(), nil
}

func resolveUpstreamTargetURL(upstreamPath string, info *relaycommon.RelayInfo) (*url.URL, error) {
	if strings.HasPrefix(upstreamPath, "/") {
		if strings.HasPrefix(upstreamPath, "//") {
			return nil, errors.New("advanced custom upstream path must be a full URL or a path starting with /")
		}
		if info == nil || strings.TrimSpace(info.ChannelBaseUrl) == "" {
			return nil, errors.New("channel base URL is required when advanced custom upstream path is relative")
		}
		return joinBaseURLAndUpstreamPath(info.ChannelBaseUrl, upstreamPath)
	}

	parsedURL, err := url.Parse(upstreamPath)
	if err != nil {
		return nil, err
	}
	if parsedURL.Scheme == "" || parsedURL.Host == "" {
		return nil, errors.New("advanced custom upstream path must be a full URL or a path starting with /")
	}
	if !strings.EqualFold(parsedURL.Scheme, "http") && !strings.EqualFold(parsedURL.Scheme, "https") {
		return nil, errors.New("advanced custom upstream path must use http or https")
	}
	return parsedURL, nil
}

func joinBaseURLAndUpstreamPath(baseURL string, upstreamPath string) (*url.URL, error) {
	parsedBaseURL, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return nil, err
	}
	if parsedBaseURL.Scheme == "" || parsedBaseURL.Host == "" {
		return nil, errors.New("channel base URL must be a full URL when advanced custom upstream path is relative")
	}
	if !strings.EqualFold(parsedBaseURL.Scheme, "http") && !strings.EqualFold(parsedBaseURL.Scheme, "https") {
		return nil, errors.New("channel base URL must use http or https when advanced custom upstream path is relative")
	}

	parsedPath, err := url.Parse(upstreamPath)
	if err != nil {
		return nil, err
	}
	parsedBaseURL.Path = strings.TrimRight(parsedBaseURL.Path, "/") + "/" + strings.TrimLeft(parsedPath.Path, "/")
	parsedBaseURL.RawPath = ""
	parsedBaseURL.RawQuery = parsedPath.RawQuery
	parsedBaseURL.Fragment = parsedPath.Fragment
	return parsedBaseURL, nil
}

func applyUpstreamPathTemplate(upstreamPath string, info *relaycommon.RelayInfo) string {
	if info == nil {
		return upstreamPath
	}
	return strings.ReplaceAll(upstreamPath, advancedCustomModelPlaceholder, info.UpstreamModelName)
}

func shouldUseGeminiStreamURL(target string, info *relaycommon.RelayInfo) bool {
	return info != nil && info.IsStream && target == dto.AdvancedCustomTargetGemini
}

func useGeminiStreamGenerateContentURL(parsedURL *url.URL) {
	if strings.Contains(parsedURL.Path, ":generateContent") {
		parsedURL.Path = strings.Replace(parsedURL.Path, ":generateContent", ":streamGenerateContent", 1)
	}
	if strings.Contains(parsedURL.Path, ":streamGenerateContent") {
		query := parsedURL.Query()
		query.Set("alt", "sse")
		parsedURL.RawQuery = query.Encode()
	}
}

func shouldApplyClaudeHeaders(target string, info *relaycommon.RelayInfo) bool {
	if target == dto.AdvancedCustomTargetClaude {
		return true
	}
	return target == dto.AdvancedCustomTargetNative && info != nil && info.RelayFormat == types.RelayFormatClaude
}

func applyClaudeHeaders(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) {
	anthropicVersion := ""
	if c != nil && c.Request != nil {
		anthropicVersion = c.Request.Header.Get("anthropic-version")
	}
	if anthropicVersion == "" {
		anthropicVersion = "2023-06-01"
	}
	header.Set("anthropic-version", anthropicVersion)
	if c != nil {
		claude.CommonClaudeHeadersOperation(c, header, info)
	}
}

func applyAuthTemplate(template string, apiKey string) string {
	return strings.ReplaceAll(template, "{api_key}", apiKey)
}

func isJSONRequest(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	return strings.Contains(strings.ToLower(c.Request.Header.Get("Content-Type")), "application/json")
}

func (a *Adaptor) convertToRouteNative(c *gin.Context, info *relaycommon.RelayInfo, request any) (any, error) {
	if err := a.resolveForConversion(c, info); err != nil {
		return nil, err
	}
	client := types.RelayFormatOpenAI
	if info != nil && info.RelayFormat != "" {
		client = info.RelayFormat
	}
	native := dto.AdvancedCustomTargetFormat(a.target, client)
	if incoming, ok := relaycommon.GuessRelayFormatFromRequest(request); ok && incoming != native {
		result, err := service.ConvertRequest(c, info, native, request)
		if err != nil {
			return nil, err
		}
		request = result.Value
	}
	return a.adaptRouteNative(c, info, native, request)
}

func (a *Adaptor) requireNativeTarget(c *gin.Context, info *relaycommon.RelayInfo, kind string) error {
	if err := a.resolveForConversion(c, info); err != nil {
		return err
	}
	if a.target != dto.AdvancedCustomTargetNative {
		return fmt.Errorf("target %q does not support %s requests", a.target, kind)
	}
	return nil
}

func (a *Adaptor) adaptRouteNative(c *gin.Context, info *relaycommon.RelayInfo, native types.RelayFormat, request any) (any, error) {
	switch native {
	case types.RelayFormatClaude:
		req, ok := asClaudeRequest(request)
		if !ok {
			return nil, fmt.Errorf("expected Anthropic Messages request, got %T", request)
		}
		return a.claudeAdaptor.ConvertClaudeRequest(c, info, req)
	case types.RelayFormatGemini:
		req, ok := asGeminiRequest(request)
		if !ok {
			return nil, fmt.Errorf("expected Gemini generateContent request, got %T", request)
		}
		return a.geminiAdaptor.ConvertGeminiRequest(c, info, req)
	case types.RelayFormatOpenAIResponses:
		req, ok := asResponsesRequest(request)
		if !ok {
			return nil, fmt.Errorf("expected OpenAI responses request, got %T", request)
		}
		out, err := a.convertOpenAICompatibleResponsesRequest(c, info, *req)
		if err != nil {
			return nil, err
		}
		if value, ok := out.(dto.OpenAIResponsesRequest); ok {
			return &value, nil
		}
		return out, nil
	default:
		req, ok := asChatRequest(request)
		if !ok {
			return nil, fmt.Errorf("expected OpenAI chat completions request, got %T", request)
		}
		return a.convertOpenAICompatibleRequest(c, info, req)
	}
}

func asChatRequest(request any) (*dto.GeneralOpenAIRequest, bool) {
	switch value := request.(type) {
	case *dto.GeneralOpenAIRequest:
		return value, value != nil
	case dto.GeneralOpenAIRequest:
		return &value, true
	default:
		return nil, false
	}
}

func asClaudeRequest(request any) (*dto.ClaudeRequest, bool) {
	switch value := request.(type) {
	case *dto.ClaudeRequest:
		return value, value != nil
	case dto.ClaudeRequest:
		return &value, true
	default:
		return nil, false
	}
}

func asGeminiRequest(request any) (*dto.GeminiChatRequest, bool) {
	switch value := request.(type) {
	case *dto.GeminiChatRequest:
		return value, value != nil
	case dto.GeminiChatRequest:
		return &value, true
	default:
		return nil, false
	}
}

func asResponsesRequest(request any) (*dto.OpenAIResponsesRequest, bool) {
	switch value := request.(type) {
	case *dto.OpenAIResponsesRequest:
		return value, value != nil
	case dto.OpenAIResponsesRequest:
		return &value, true
	default:
		return nil, false
	}
}

func (a *Adaptor) convertOpenAICompatibleRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	old := info.ChannelType
	info.ChannelType = constant.ChannelTypeOpenAI
	converted, err := a.openaiAdaptor.ConvertOpenAIRequest(c, info, request)
	info.ChannelType = old
	return converted, err
}

func (a *Adaptor) convertOpenAICompatibleResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	old := info.ChannelType
	info.ChannelType = constant.ChannelTypeOpenAI
	converted, err := a.openaiAdaptor.ConvertOpenAIResponsesRequest(c, info, request)
	info.ChannelType = old
	return converted, err
}

func (a *Adaptor) convertOpenAICompatibleEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	old := info.ChannelType
	info.ChannelType = constant.ChannelTypeOpenAI
	converted, err := a.openaiAdaptor.ConvertEmbeddingRequest(c, info, request)
	info.ChannelType = old
	return converted, err
}

func (a *Adaptor) convertOpenAICompatibleAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	old := info.ChannelType
	info.ChannelType = constant.ChannelTypeOpenAI
	converted, err := a.openaiAdaptor.ConvertAudioRequest(c, info, request)
	info.ChannelType = old
	return converted, err
}

func (a *Adaptor) convertOpenAICompatibleImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	old := info.ChannelType
	info.ChannelType = constant.ChannelTypeOpenAI
	converted, err := a.openaiAdaptor.ConvertImageRequest(c, info, request)
	info.ChannelType = old
	return converted, err
}
