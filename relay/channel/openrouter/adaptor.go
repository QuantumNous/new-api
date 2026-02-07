package openrouter

import (
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	ChannelType    int
	ResponseFormat string
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	if info.ChannelSetting.ThinkingToContent {
		info.ThinkingContentInfo = relaycommon.ThinkingContentInfo{
			IsFirstThinkingContent:  true,
			SendLastThinkingContent: false,
			HasSentThinkingContent:  false,
		}
	}
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode == relayconstant.RelayModeRealtime {
		if strings.HasPrefix(info.ChannelBaseUrl, "https://") {
			baseURL := strings.TrimPrefix(info.ChannelBaseUrl, "https://")
			info.ChannelBaseUrl = "wss://" + baseURL
		} else if strings.HasPrefix(info.ChannelBaseUrl, "http://") {
			baseURL := strings.TrimPrefix(info.ChannelBaseUrl, "http://")
			info.ChannelBaseUrl = "ws://" + baseURL
		}
	}

	if info.RelayFormat == types.RelayFormatClaude {
		requestURL := fmt.Sprintf("%s/v1/messages", info.ChannelBaseUrl)
		if info.IsClaudeBetaQuery {
			requestURL += "?beta=true"
		}
		return requestURL, nil
	}

	if info.RelayFormat == types.RelayFormatGemini {
		return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
	}

	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, header)

	hasAuthOverride := false
	if len(info.HeadersOverride) > 0 {
		for key := range info.HeadersOverride {
			if strings.EqualFold(key, "Authorization") {
				hasAuthOverride = true
				break
			}
		}
	}

	if info.RelayMode == relayconstant.RelayModeRealtime {
		swp := c.Request.Header.Get("Sec-WebSocket-Protocol")
		if swp != "" {
			items := []string{
				"realtime",
				"openai-insecure-api-key." + info.ApiKey,
				"openai-beta.realtime-v1",
			}
			header.Set("Sec-WebSocket-Protocol", strings.Join(items, ","))
		} else {
			header.Set("openai-beta", "realtime=v1")
			if !hasAuthOverride {
				header.Set("Authorization", "Bearer "+info.ApiKey)
			}
		}
	} else {
		if !hasAuthOverride {
			header.Set("Authorization", "Bearer "+info.ApiKey)
		}
	}

	header.Set("HTTP-Referer", "https://www.newapi.ai")
	header.Set("X-Title", "New API")

	if info.RelayFormat == types.RelayFormatClaude {
		anthropicVersion := c.Request.Header.Get("anthropic-version")
		if anthropicVersion == "" {
			anthropicVersion = "2023-06-01"
		}
		header.Set("anthropic-version", anthropicVersion)
		claude.CommonClaudeHeadersOperation(c, header, info)
	}

	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(_ *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	request.StreamOptions = nil

	if len(request.Usage) == 0 {
		request.Usage = json.RawMessage(`{"include":true}`)
	}

	if !model_setting.ShouldPreserveThinkingSuffix(info.OriginModelName) && strings.HasSuffix(info.UpstreamModelName, "-thinking") {
		info.UpstreamModelName = strings.TrimSuffix(info.UpstreamModelName, "-thinking")
		request.Model = info.UpstreamModelName
		if len(request.Reasoning) == 0 {
			reasoning := map[string]any{"enabled": true}
			if request.ReasoningEffort != "" && request.ReasoningEffort != "none" {
				reasoning["effort"] = request.ReasoningEffort
			}
			marshal, err := common.Marshal(reasoning)
			if err != nil {
				return nil, fmt.Errorf("error marshalling reasoning: %w", err)
			}
			request.Reasoning = marshal
		}
		request.ReasoningEffort = ""
	} else {
		if len(request.Reasoning) == 0 && request.ReasoningEffort != "" {
			reasoning := map[string]any{"enabled": true}
			if request.ReasoningEffort != "none" {
				reasoning["effort"] = request.ReasoningEffort
				marshal, err := common.Marshal(reasoning)
				if err != nil {
					return nil, fmt.Errorf("error marshalling reasoning: %w", err)
				}
				request.Reasoning = marshal
			}
		}
		request.ReasoningEffort = ""
	}

	if request.THINKING != nil && strings.HasPrefix(info.UpstreamModelName, "anthropic") {
		var thinking dto.Thinking
		if err := json.Unmarshal(request.THINKING, &thinking); err != nil {
			return nil, fmt.Errorf("error Unmarshal thinking: %w", err)
		}

		if thinking.Type == "enabled" {
			if thinking.BudgetTokens == nil {
				return nil, fmt.Errorf("BudgetTokens is nil when thinking is enabled")
			}

			reasoning := dto.OpenRouterRequestReasoning{MaxTokens: *thinking.BudgetTokens}
			marshal, err := common.Marshal(reasoning)
			if err != nil {
				return nil, fmt.Errorf("error marshalling reasoning: %w", err)
			}
			request.Reasoning = marshal
		}

		request.THINKING = nil
	}

	if strings.HasPrefix(info.UpstreamModelName, "o") || strings.HasPrefix(info.UpstreamModelName, "gpt-5") {
		if request.MaxCompletionTokens == 0 && request.MaxTokens != 0 {
			request.MaxCompletionTokens = request.MaxTokens
			request.MaxTokens = 0
		}

		if strings.HasPrefix(info.UpstreamModelName, "o") {
			request.Temperature = nil
		}

		if strings.HasPrefix(info.UpstreamModelName, "gpt-5") {
			request.Temperature = nil
			request.TopP = 0
			request.LogProbs = false
		}

		effort, originModel := parseReasoningEffortFromModelSuffix(info.UpstreamModelName)
		if effort != "" {
			request.ReasoningEffort = effort
			info.UpstreamModelName = originModel
			request.Model = originModel
		}

		info.ReasoningEffort = request.ReasoningEffort

		if !strings.HasPrefix(info.UpstreamModelName, "o1-mini") && !strings.HasPrefix(info.UpstreamModelName, "o1-preview") {
			if len(request.Messages) > 0 && request.Messages[0].Role == "system" {
				request.Messages[0].Role = "developer"
			}
		}
	}

	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(_ *gin.Context, _ int, request dto.RerankRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(_ *gin.Context, _ *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	a.ResponseFormat = request.ResponseFormat
	adaptor := openai.Adaptor{}
	return adaptor.ConvertAudioRequest(c, info, request)
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	adaptor := openai.Adaptor{}
	return adaptor.ConvertImageRequest(c, info, request)
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(_ *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	effort, originModel := parseReasoningEffortFromModelSuffix(request.Model)
	if effort != "" {
		if request.Reasoning == nil {
			request.Reasoning = &dto.Reasoning{Effort: effort}
		} else {
			request.Reasoning.Effort = effort
		}
		request.Model = originModel
	}
	if info != nil && request.Reasoning != nil && request.Reasoning.Effort != "" {
		info.ReasoningEffort = request.Reasoning.Effort
	}
	return request, nil
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
	if info.RelayFormat == types.RelayFormatClaude {
		if info.IsStream {
			return claude.ClaudeStreamHandler(c, resp, info)
		}
		return claude.ClaudeHandler(c, resp, info)
	}

	adaptor := openai.Adaptor{ResponseFormat: a.ResponseFormat}
	return adaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	if info.RelayFormat == types.RelayFormatClaude {
		return request, nil
	}

	aiRequest, err := service.ClaudeToOpenAIRequest(*request, info)
	if err != nil {
		return nil, err
	}
	if info.SupportStreamOptions && info.IsStream {
		aiRequest.StreamOptions = &dto.StreamOptions{IncludeUsage: true}
	}
	return a.ConvertOpenAIRequest(c, info, aiRequest)
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	openaiRequest, err := service.GeminiToOpenAIRequest(request, info)
	if err != nil {
		return nil, err
	}
	return a.ConvertOpenAIRequest(c, info, openaiRequest)
}

func parseReasoningEffortFromModelSuffix(model string) (string, string) {
	effortSuffixes := []string{"-high", "-minimal", "-low", "-medium", "-none", "-xhigh"}
	for _, suffix := range effortSuffixes {
		if strings.HasSuffix(model, suffix) {
			effort := strings.TrimPrefix(suffix, "-")
			originModel := strings.TrimSuffix(model, suffix)
			return effort, originModel
		}
	}
	return "", model
}
