package cloudflare_aig

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func isClaudeNativeRoute(info *relaycommon.RelayInfo) bool {
	return info != nil && info.RelayFormat == types.RelayFormatClaude
}

var cfAigPassthroughResponseHeaders = []string{
	"cf-aig-cache-status",
	"cf-aig-cache-ttl",
	"cf-aig-event-id",
	"cf-aig-log-id",
	"cf-aig-request-id",
	"cf-ray",
}

// autoPrefixModel ensures the model name carries a {provider}/ prefix as required
// by Cloudflare AI Gateway's OpenAI-compatible endpoint. If the model already
// contains "/", it is returned unchanged so users can still override.
func autoPrefixModel(model string) string {
	if model == "" || strings.Contains(model, "/") {
		return model
	}
	lower := strings.ToLower(model)
	switch {
	case strings.HasPrefix(lower, "claude"):
		return "anthropic/" + model
	case strings.HasPrefix(lower, "gemini"):
		return "google-ai-studio/" + model
	case strings.HasPrefix(lower, "grok"):
		return "grok/" + model
	case strings.HasPrefix(lower, "deepseek"):
		return "deepseek/" + model
	case strings.HasPrefix(lower, "command"):
		return "cohere/" + model
	case strings.HasPrefix(lower, "mistral"), strings.HasPrefix(lower, "codestral"):
		return "mistral/" + model
	case strings.HasPrefix(lower, "@cf/"):
		return "workers-ai/" + model
	default:
		return "openai/" + model
	}
}

type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	apiVersion := info.ApiVersion
	if apiVersion == "" {
		return "", errors.New("account_id/gateway_id is required (set in Other field, format: {account_id}/{gateway_id})")
	}

	if isClaudeNativeRoute(info) {
		return fmt.Sprintf("%s/v1/%s/anthropic/v1/messages", info.ChannelBaseUrl, apiVersion), nil
	}

	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions:
		return fmt.Sprintf("%s/v1/%s/compat/chat/completions", info.ChannelBaseUrl, apiVersion), nil
	case relayconstant.RelayModeEmbeddings:
		return fmt.Sprintf("%s/v1/%s/compat/embeddings", info.ChannelBaseUrl, apiVersion), nil
	case relayconstant.RelayModeResponses:
		return fmt.Sprintf("%s/v1/%s/compat/responses", info.ChannelBaseUrl, apiVersion), nil
	default:
		return fmt.Sprintf("%s/v1/%s/compat%s", info.ChannelBaseUrl, apiVersion, info.RequestURLPath), nil
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, header)
	header.Del("x-api-key")
	header.Del("cf-aig-authorization")
	header.Del("Authorization")
	var forwarded map[string][]string
	if common.DebugEnabled {
		forwarded = make(map[string][]string)
	}
	for k, vs := range c.Request.Header {
		lk := strings.ToLower(k)
		if !strings.HasPrefix(lk, "cf-aig-") {
			continue
		}
		if lk == "cf-aig-authorization" {
			continue
		}
		header.Del(k)
		for _, v := range vs {
			header.Add(k, v)
		}
		if forwarded != nil {
			forwarded[k] = vs
		}
	}

	if isClaudeNativeRoute(info) {
		header.Set("x-api-key", info.ApiKey)
		anthropicVersion := c.Request.Header.Get("anthropic-version")
		if anthropicVersion == "" {
			anthropicVersion = "2023-06-01"
		}
		header.Set("anthropic-version", anthropicVersion)
		if anthropicBeta := c.Request.Header.Get("anthropic-beta"); anthropicBeta != "" {
			header.Set("anthropic-beta", anthropicBeta)
		}
	} else {
		header.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	}

	if len(forwarded) > 0 {
		logger.LogInfo(c, fmt.Sprintf("[cloudflare_aig] forwarding cf-aig-* request headers: %v", forwarded))
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	request.Model = autoPrefixModel(request.Model)
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	request.Model = autoPrefixModel(request.Model)
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	request.Model = autoPrefixModel(request.Model)
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return request, nil
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	a.passthroughCfAigResponseHeaders(c, resp)
	if isClaudeNativeRoute(info) {
		info.FinalRequestRelayFormat = types.RelayFormatClaude
		if info.IsStream {
			return claude.ClaudeStreamHandler(c, resp, info)
		}
		return claude.ClaudeHandler(c, resp, info)
	}
	switch info.RelayMode {
	case relayconstant.RelayModeResponses:
		if info.IsStream {
			usage, err = openai.OaiResponsesStreamHandler(c, info, resp)
		} else {
			usage, err = openai.OaiResponsesHandler(c, info, resp)
		}
	default:
		if info.IsStream {
			usage, err = openai.OaiStreamHandler(c, info, resp)
		} else {
			usage, err = openai.OpenaiHandler(c, info, resp)
		}
	}
	return
}

func (a *Adaptor) passthroughCfAigResponseHeaders(c *gin.Context, resp *http.Response) {
	if c == nil || c.Writer == nil || resp == nil {
		return
	}
	seen := make(map[string]string)
	for _, name := range cfAigPassthroughResponseHeaders {
		if v := resp.Header.Get(name); v != "" {
			c.Writer.Header().Set(name, v)
			seen[name] = v
		}
	}
	for k, vs := range resp.Header {
		lk := strings.ToLower(k)
		if !strings.HasPrefix(lk, "cf-aig-") {
			continue
		}
		if _, ok := seen[lk]; ok {
			continue
		}
		if len(vs) > 0 {
			c.Writer.Header().Set(k, vs[0])
			seen[lk] = vs[0]
		}
	}
	if common.DebugEnabled && len(seen) > 0 {
		logger.LogInfo(c, fmt.Sprintf("[cloudflare_aig] upstream cf-aig-* response headers: %v", seen))
	}
}

func (a *Adaptor) GetModelList() []string {
	return []string{}
}

func (a *Adaptor) GetChannelName() string {
	return "cloudflare_aig"
}
