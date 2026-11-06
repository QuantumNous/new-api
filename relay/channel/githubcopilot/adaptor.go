package githubcopilot

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"

	hostcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	copilot "github.com/QuantumNous/new-api/service/githubcopilot"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	openaiAdaptor openai.Adaptor
	claudeAdaptor claude.Adaptor
	key           copilot.ChannelKey
	model         string
	endpoint      *copilot.Endpoint
	protocol      copilot.Protocol
	err           error
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.openaiAdaptor.Init(info)
	a.claudeAdaptor.Init(info)
	if info == nil {
		a.err = errors.New("GitHub Copilot relay info is missing")
		return
	}
	a.model = strings.TrimSpace(info.UpstreamModelName)
	a.key, a.err = copilot.ParseChannelKey(info.ApiKey)
	if a.err != nil {
		return
	}
	a.resolveEndpoint(info, false)
}

func (a *Adaptor) resolveEndpoint(info *relaycommon.RelayInfo, forceRefresh bool) {
	endpoint, err := copilot.GetEndpoint(context.Background(), a.key, a.model, forceRefresh)
	if err != nil {
		a.err = err
		return
	}
	protocol, err := endpoint.Protocol()
	if err != nil {
		a.err = err
		return
	}
	a.endpoint = endpoint
	a.protocol = protocol
	a.err = nil
	if info == nil {
		return
	}
	info.ChannelBaseUrl = endpoint.BaseURL
	switch protocol {
	case copilot.ProtocolAnthropic:
		info.FinalRequestRelayFormat = types.RelayFormatClaude
	case copilot.ProtocolOpenAIResponses:
		info.FinalRequestRelayFormat = types.RelayFormatOpenAIResponses
	default:
		info.FinalRequestRelayFormat = types.RelayFormatOpenAI
	}
}

func (a *Adaptor) check(info *relaycommon.RelayInfo) error {
	if a.err != nil {
		return a.err
	}
	if a.endpoint == nil {
		a.resolveEndpoint(info, false)
	}
	if a.err != nil {
		return a.err
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if err := a.check(info); err != nil {
		return nil, err
	}
	switch a.protocol {
	case copilot.ProtocolAnthropic:
		return a.claudeAdaptor.ConvertOpenAIRequest(c, info, request)
	case copilot.ProtocolOpenAIResponses:
		result, err := serviceConvertRequestByID(c, info, relayconvert.ConverterOpenAIChatToOpenAIResponses, request)
		if err != nil {
			return nil, err
		}
		return result, nil
	default:
		return a.openaiAdaptor.ConvertOpenAIRequest(c, info, request)
	}
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if err := a.check(info); err != nil {
		return nil, err
	}
	switch a.protocol {
	case copilot.ProtocolAnthropic:
		return a.claudeAdaptor.ConvertClaudeRequest(c, info, request)
	case copilot.ProtocolOpenAIResponses:
		result, err := serviceConvertRequestByID(c, info, relayconvert.ConverterClaudeMessagesToOpenAIResponses, request)
		if err != nil {
			return nil, err
		}
		return result, nil
	default:
		return a.openaiAdaptor.ConvertClaudeRequest(c, info, request)
	}
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	if err := a.check(info); err != nil {
		return nil, err
	}
	switch a.protocol {
	case copilot.ProtocolAnthropic:
		return a.claudeAdaptor.ConvertGeminiRequest(c, info, request)
	case copilot.ProtocolOpenAIResponses:
		result, err := serviceConvertRequestByID(c, info, relayconvert.ConverterGeminiContentToOpenAIResponses, request)
		if err != nil {
			return nil, err
		}
		return result, nil
	default:
		return a.openaiAdaptor.ConvertGeminiRequest(c, info, request)
	}
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	if err := a.check(info); err != nil {
		return nil, err
	}
	switch a.protocol {
	case copilot.ProtocolAnthropic:
		return a.claudeAdaptor.ConvertOpenAIResponsesRequest(c, info, request)
	case copilot.ProtocolOpenAIChat:
		result, err := serviceConvertRequestByID(c, info, relayconvert.ConverterOpenAIResponsesToOpenAIChat, request)
		if err != nil {
			return nil, err
		}
		return result, nil
	default:
		return a.openaiAdaptor.ConvertOpenAIResponsesRequest(c, info, request)
	}
}

func serviceConvertRequestByID(c *gin.Context, info *relaycommon.RelayInfo, converter string, request any) (any, error) {
	result, err := relayconvert.ConvertRequestByID(c, info, converter, request)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, errors.New("GitHub Copilot request conversion returned no result")
	}
	if info != nil {
		info.RecordConversionDiagnostics(c, result.Diagnostics)
	}
	return result.Value, nil
}

func (a *Adaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, errors.New("GitHub Copilot channel: rerank endpoint is not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("GitHub Copilot channel: embeddings endpoint is not supported")
}

func (a *Adaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("GitHub Copilot channel: audio endpoint is not supported")
}

func (a *Adaptor) ConvertImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error) {
	return nil, errors.New("GitHub Copilot channel: image endpoint is not supported")
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if err := a.check(info); err != nil {
		return "", err
	}
	if info != nil && info.RelayMode == relayconstant.RelayModeResponsesCompact {
		return "", errors.New("GitHub Copilot channel: responses compact is not supported")
	}
	baseURL := strings.TrimRight(a.endpoint.BaseURL, "/")
	switch a.protocol {
	case copilot.ProtocolAnthropic:
		if !strings.HasSuffix(baseURL, "/v1") {
			baseURL += "/v1"
		}
		return baseURL + "/messages", nil
	case copilot.ProtocolOpenAIResponses:
		return baseURL + "/responses", nil
	default:
		return baseURL + "/chat/completions", nil
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	if err := a.check(info); err != nil {
		return err
	}
	channel.SetupApiRequestHeader(info, c, req)
	// The channel key is a profile reference, not an upstream credential. Clear
	// any generic authentication header before applying the short-lived
	// credentials issued by the Copilot CLI.
	req.Del("Authorization")
	req.Del("x-api-key")
	req.Del("x-goog-api-key")
	for name, value := range a.endpoint.Headers {
		req.Set(name, value)
	}
	if a.endpoint.SessionToken != nil {
		req.Set(a.endpoint.SessionToken.Header, a.endpoint.SessionToken.Token)
	}
	if a.endpoint.APIKey != "" {
		switch a.protocol {
		case copilot.ProtocolAnthropic:
			if req.Get("Authorization") == "" && req.Get("x-api-key") == "" {
				req.Set("x-api-key", a.endpoint.APIKey)
			}
		default:
			req.Set("Authorization", "Bearer "+a.endpoint.APIKey)
		}
	}
	if a.protocol == copilot.ProtocolAnthropic {
		if req.Get("anthropic-version") == "" {
			req.Set("anthropic-version", "2023-06-01")
		}
		if c != nil && c.Request != nil {
			if beta := strings.Join(c.Request.Header.Values("anthropic-beta"), ","); beta != "" && req.Get("anthropic-beta") == "" {
				req.Set("anthropic-beta", beta)
			}
		}
	}
	req.Set("Content-Type", "application/json")
	return nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if err := a.check(info); err != nil {
		return nil, err
	}
	var ownedStorage hostcommon.BodyStorage
	replayable, ok := requestBody.(hostcommon.ReplayableBody)
	if !ok {
		data, err := io.ReadAll(requestBody)
		if err != nil {
			return nil, err
		}
		storage, err := hostcommon.CreateBodyStorage(data)
		if err != nil {
			return nil, err
		}
		ownedStorage = storage
		replayable = hostcommon.NewReplayableBodyReader(storage)
	}
	if ownedStorage != nil {
		defer ownedStorage.Close()
	}
	resp, err := channel.DoApiRequest(a, c, info, replayable)
	if err != nil || resp == nil {
		return resp, err
	}
	if resp.StatusCode != http.StatusUnauthorized && resp.StatusCode != http.StatusForbidden {
		return resp, nil
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
	_ = resp.Body.Close()
	previousProtocol := a.protocol
	copilot.InvalidateEndpoint(a.key, a.model)
	a.resolveEndpoint(info, true)
	if a.err != nil {
		return nil, a.err
	}
	if a.protocol != previousProtocol {
		return nil, errors.New("GitHub Copilot changed the model's upstream protocol; retry the request")
	}
	replay, err := replayable.NewReader()
	if err != nil {
		return nil, err
	}
	defer replay.Close()
	return channel.DoApiRequest(a, c, info, replay)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if a.err != nil {
		return nil, types.NewOpenAIError(a.err, types.ErrorCodeBadResponse, http.StatusBadGateway)
	}
	switch a.protocol {
	case copilot.ProtocolAnthropic:
		return a.claudeAdaptor.DoResponse(c, resp, info)
	case copilot.ProtocolOpenAIResponses:
		if info != nil && info.RelayFormat == types.RelayFormatOpenAIResponses {
			return a.openaiAdaptor.DoResponse(c, resp, info)
		}
		if info != nil && info.IsStream {
			return openai.OaiResponsesToChatStreamHandler(c, info, resp)
		}
		return openai.OaiResponsesToChatHandler(c, info, resp)
	default:
		if info != nil && info.RelayFormat == types.RelayFormatOpenAIResponses {
			if info.IsStream {
				return openai.OaiChatToResponsesStreamHandler(c, info, resp)
			}
			return openai.OaiChatToResponsesHandler(c, info, resp)
		}
		return a.openaiAdaptor.DoResponse(c, resp, info)
	}
}

func (a *Adaptor) GetModelList() []string {
	return nil
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
